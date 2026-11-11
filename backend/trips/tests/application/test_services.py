from datetime import timedelta

import pytest

from core.exceptions import NoRouteFoundError
from core.metrics import collect_metrics
from trips.application.departure_window import DepartureWindowService
from trips.application.forecasts import ForecastGridLoader
from trips.application.geocode import GeocodeService
from trips.application.heatmap import CorridorHeatmapService
from trips.application.requests import DepartureWindowRequest, HeatmapRequest, TripRequest
from trips.domain.corridor import CorridorGridBuilder
from trips.domain.models import Coordinate, Place, RiskLevel
from trips.domain.ranking import RouteRanker
from trips.domain.risk.config import build_risk_evaluator, build_weather_intensity_scale
from trips.tests.fakes import (
    FIXED_DEPARTURE,
    LIGHT_LOAD_POUNDS,
    FakeGeocoder,
    FakeRoutingProvider,
    FakeWeatherProvider,
    build_plan_trip_service,
    build_route_evaluator,
    build_straight_route,
    build_weather,
    constant_weather,
)

ORIGIN = Coordinate(35.0, -100.0)
DESTINATION = Coordinate(35.0, -99.0)
CALM_ROUTE = build_straight_route(
    Coordinate(34.0, -100.0), Coordinate(34.0, -99.0), distance_miles=70.0, provider_name="calm"
)
WINDY_ROUTE = build_straight_route(
    Coordinate(36.0, -100.0), Coordinate(36.0, -99.0), distance_miles=55.0, provider_name="windy"
)


def wind_by_latitude(location, moment):
    if location.latitude > 35.5:
        return build_weather(wind_speed_mph=48.0)
    return build_weather(wind_speed_mph=10.0)


def build_trip_request(load_pounds: float = LIGHT_LOAD_POUNDS) -> TripRequest:
    return TripRequest(
        origin=ORIGIN,
        destination=DESTINATION,
        departure=FIXED_DEPARTURE,
        load_pounds=load_pounds,
        interval_miles=25,
    )


def test_plan_recommends_calmer_route_even_if_longer() -> None:
    service = build_plan_trip_service([WINDY_ROUTE, CALM_ROUTE], wind_by_latitude)

    plan = service.execute(build_trip_request())

    assert plan.recommended_route.candidate.provider_name == "calm"
    assert plan.recommended_route.route_id == "B"
    assert plan.recommendation_reason.startswith("Route B recommended: 55.0 fewer Severe miles")


def test_plan_records_routing_provider_labels() -> None:
    service = build_plan_trip_service([WINDY_ROUTE, CALM_ROUTE], wind_by_latitude)

    with collect_metrics() as metrics:
        service.execute(build_trip_request())

    snapshot = metrics.snapshot()
    assert snapshot.labels["routing_providers"] == ("windy", "calm")
    assert {"routing", "sampling", "weather", "risk", "ranking"} <= set(snapshot.timings_ms)


def test_plan_without_routes_raises_no_route() -> None:
    service = build_plan_trip_service([], wind_by_latitude)

    with pytest.raises(NoRouteFoundError):
        service.execute(build_trip_request())


def test_missing_weather_becomes_unknown_with_warning() -> None:
    service = build_plan_trip_service([CALM_ROUTE], lambda location, moment: None)

    plan = service.execute(build_trip_request())

    assert all(not checkpoint.risk.is_known for checkpoint in plan.recommended_route.checkpoints)
    assert "Route A: forecast unavailable for 70.0 mi." in plan.warnings


def test_departure_window_finds_delay_that_avoids_storm() -> None:
    storm_clears_at = FIXED_DEPARTURE + timedelta(hours=3)

    def storm_until_nine(location, moment):
        if moment < storm_clears_at:
            return build_weather(wind_speed_mph=50.0)
        return build_weather(wind_speed_mph=5.0)

    service = DepartureWindowService(
        FakeRoutingProvider([CALM_ROUTE]),
        build_route_evaluator(FakeWeatherProvider(storm_until_nine)),
        RouteRanker(),
    )

    window_plan = service.execute(
        DepartureWindowRequest(trip=build_trip_request(), window_hours=6, option_limit=3)
    )

    assert window_plan.baseline.delay_hours == 0
    assert window_plan.baseline.best_route.summary.miles_at(RiskLevel.SEVERE) == 70.0
    assert window_plan.recommended_option.delay_hours == 3
    assert window_plan.recommended_option.change_from_baseline == "Severe miles 70.0 → 0.0"
    assert len(window_plan.ranked_options) == 3


def build_heatmap(wind_speed_mph: float, load_pounds: float):
    service = CorridorHeatmapService(
        CorridorGridBuilder(),
        ForecastGridLoader(
            FakeWeatherProvider(constant_weather(build_weather(wind_speed_mph=wind_speed_mph)))
        ),
        build_risk_evaluator(),
        build_weather_intensity_scale(),
    )
    return service.execute(
        HeatmapRequest(
            route_geometries=(CALM_ROUTE.coordinates,),
            departure=FIXED_DEPARTURE,
            load_pounds=load_pounds,
        )
    )


def test_heatmap_has_one_value_per_forecast_hour() -> None:
    heatmap = build_heatmap(wind_speed_mph=40.0, load_pounds=10_000.0)

    assert len(heatmap.moments) == 49
    assert heatmap.cells
    assert all(len(cell.hourly_heat) == 49 for cell in heatmap.cells)


def test_heatmap_shows_calm_weather_as_low_continuous_intensity() -> None:
    heatmap = build_heatmap(wind_speed_mph=11.0, load_pounds=10_000.0)

    assert {heat for cell in heatmap.cells for heat in cell.hourly_heat} == {0.2}


def test_heatmap_never_shows_less_than_the_load_adjusted_risk_level() -> None:
    heatmap = build_heatmap(wind_speed_mph=40.0, load_pounds=45_000.0)

    assert {heat for cell in heatmap.cells for heat in cell.hourly_heat} == {0.75}


def test_geocode_normalizes_whitespace() -> None:
    geocoder = FakeGeocoder([Place("Denver, CO, USA", Coordinate(39.74, -104.99))])

    places = GeocodeService(geocoder).search("  Denver   CO ", result_limit=5)

    assert geocoder.received_queries == ["Denver CO"]
    assert places[0].label == "Denver, CO, USA"
