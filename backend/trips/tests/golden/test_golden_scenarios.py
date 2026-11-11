from datetime import timedelta

import pytest

from trips.application.requests import TripRequest
from trips.domain.advisories import EVERY_ROUTE_BLOCKED_WARNING
from trips.domain.models import Coordinate, RiskLevel
from trips.tests.fakes import (
    FIXED_DEPARTURE,
    build_plan_trip_service,
    build_straight_route,
    build_weather,
)

ORIGIN = Coordinate(35.0, -100.0)
DESTINATION = Coordinate(35.0, -98.0)

GUSTY_ROUTE = build_straight_route(
    Coordinate(35.0, -100.0),
    Coordinate(35.0, -98.0),
    distance_miles=100.0,
    duration_seconds=6000.0,
)
RAINY_ROUTE = build_straight_route(
    Coordinate(37.0, -100.0),
    Coordinate(37.0, -98.0),
    distance_miles=120.0,
    duration_seconds=7800.0,
)


def gusty_south_rainy_north(location, moment):
    if location.latitude < 36.0:
        return build_weather(wind_speed_mph=46.0)
    return build_weather(wind_speed_mph=10.0, rain_inches_per_hour=0.6)


def trip_request(load_pounds: float, interval_miles: int = 25) -> TripRequest:
    return TripRequest(
        origin=ORIGIN,
        destination=DESTINATION,
        departure=FIXED_DEPARTURE,
        load_pounds=load_pounds,
        interval_miles=interval_miles,
    )


def miles_by_label(route) -> dict[str, float]:
    return {
        level.label: route.summary.miles_at(level)
        for level in RiskLevel
        if route.summary.miles_at(level) > 0
    }


def test_light_load_prefers_shorter_severe_exposure() -> None:
    plan = build_plan_trip_service([GUSTY_ROUTE, RAINY_ROUTE], gusty_south_rainy_north).execute(
        trip_request(load_pounds=20_000)
    )

    gusty, rainy = sorted(plan.ranked_routes, key=lambda route: route.route_id)
    assert [point.position.represented_miles for point in gusty.checkpoints] == [
        12.5,
        25.0,
        25.0,
        25.0,
        12.5,
    ]
    assert [point.position.represented_miles for point in rainy.checkpoints] == [
        12.5,
        25.0,
        25.0,
        25.0,
        22.5,
        10.0,
    ]
    assert miles_by_label(gusty) == {"Severe": 100.0}
    assert miles_by_label(rainy) == {"Severe": 120.0}
    assert plan.recommended_route.route_id == "A"
    assert plan.recommendation_reason == (
        "Route A recommended: 20.0 fewer Severe miles than Route B."
    )


def test_heavy_load_turns_gusts_into_no_travel_and_flips_recommendation() -> None:
    plan = build_plan_trip_service([GUSTY_ROUTE, RAINY_ROUTE], gusty_south_rainy_north).execute(
        trip_request(load_pounds=35_000)
    )

    gusty = next(route for route in plan.ranked_routes if route.route_id == "A")
    assert miles_by_label(gusty) == {"No Travel": 100.0}
    assert gusty.checkpoints[0].risk.reasons[0] == ("Wind 46.0 mph with 35,000 lb load → No Travel")
    assert plan.recommended_route.route_id == "B"
    assert plan.recommendation_reason == (
        "Route B recommended: 100.0 fewer No Travel miles than Route A."
    )
    assert "Route A crosses 100.0 mi of No Travel conditions." in plan.warnings


def test_checkpoint_eta_follows_route_duration() -> None:
    plan = build_plan_trip_service([GUSTY_ROUTE, RAINY_ROUTE], gusty_south_rainy_north).execute(
        trip_request(load_pounds=20_000)
    )

    rainy = next(route for route in plan.ranked_routes if route.route_id == "B")
    checkpoint_at_100_miles = rainy.checkpoints[4]
    assert checkpoint_at_100_miles.position.distance_from_origin_miles == 100.0
    assert checkpoint_at_100_miles.position.estimated_arrival == FIXED_DEPARTURE + timedelta(
        seconds=6500
    )


INTERPOLATION_ROUTE = build_straight_route(
    Coordinate(35.0, -100.0),
    Coordinate(35.0, -99.0),
    distance_miles=50.0,
    duration_seconds=3600.0,
)


def wind_rising_twenty_mph_per_hour(location, moment):
    hours_after_departure = (moment - FIXED_DEPARTURE) / timedelta(hours=1)
    return build_weather(wind_speed_mph=30.0 + 20.0 * hours_after_departure)


@pytest.mark.parametrize(
    ("load_pounds", "expected_levels", "expected_average"),
    [
        (20_000, [RiskLevel.MODERATE, RiskLevel.HIGH, RiskLevel.SEVERE], 2.0),
        (45_000, [RiskLevel.MODERATE, RiskLevel.SEVERE, RiskLevel.NO_TRAVEL], 2.75),
    ],
)
def test_weather_is_interpolated_at_checkpoint_eta(
    load_pounds: float, expected_levels: list[RiskLevel], expected_average: float
) -> None:
    plan = build_plan_trip_service([INTERPOLATION_ROUTE], wind_rising_twenty_mph_per_hour).execute(
        trip_request(load_pounds=load_pounds)
    )

    route = plan.recommended_route
    winds = [checkpoint.conditions.wind_speed_mph for checkpoint in route.checkpoints]
    assert winds == pytest.approx([30.0, 40.0, 50.0])
    assert [checkpoint.risk.level for checkpoint in route.checkpoints] == expected_levels
    assert route.summary.average_risk_score == pytest.approx(expected_average)


def test_every_route_blocked_triggers_delay_advice() -> None:
    plan = build_plan_trip_service(
        [GUSTY_ROUTE, RAINY_ROUTE], lambda location, moment: build_weather(wind_speed_mph=60.0)
    ).execute(trip_request(load_pounds=5_000))

    assert plan.warnings[-1] == EVERY_ROUTE_BLOCKED_WARNING
