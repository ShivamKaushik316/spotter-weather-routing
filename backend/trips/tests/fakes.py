from collections.abc import Callable, Iterable, Mapping, Sequence
from datetime import UTC, datetime
from types import MappingProxyType
from typing import Any

from trips.application.forecasts import ForecastGridLoader
from trips.application.plan_trip import PlanTripService
from trips.application.route_evaluation import RouteEvaluator
from trips.domain.assessment import RouteAssessor
from trips.domain.geo import PolylineWalker, interpolate_coordinate
from trips.domain.models import (
    AssessedRoute,
    Coordinate,
    Place,
    RiskLevel,
    RouteCandidate,
    RouteRiskSummary,
    RouteStep,
    WeatherConditions,
)
from trips.domain.ranking import RouteRanker
from trips.domain.risk.config import build_risk_evaluator
from trips.domain.sampling import CheckpointSampler
from trips.domain.weather import ForecastSeries, TimeWindow

FIXED_DEPARTURE = datetime(2026, 11, 12, 6, 0, tzinfo=UTC)
LIGHT_LOAD_POUNDS = 10_000.0

ConditionsFunction = Callable[[Coordinate, datetime], WeatherConditions | None]


def build_weather(
    *,
    wind_speed_mph: float = 5.0,
    rain_inches_per_hour: float = 0.0,
    snowfall_inches_per_hour: float = 0.0,
) -> WeatherConditions:
    return WeatherConditions(
        wind_speed_mph=wind_speed_mph,
        wind_gust_mph=wind_speed_mph * 1.3,
        rain_inches_per_hour=rain_inches_per_hour,
        snowfall_inches_per_hour=snowfall_inches_per_hour,
    )


def constant_weather(conditions: WeatherConditions) -> ConditionsFunction:
    return lambda location, moment: conditions


def build_straight_route(
    start: Coordinate,
    end: Coordinate,
    *,
    distance_miles: float | None = None,
    duration_seconds: float | None = None,
    average_speed_mph: float = 50.0,
    point_count: int = 41,
    provider_name: str = "fake",
    steps: Sequence[RouteStep] | None = None,
) -> RouteCandidate:
    coordinates = tuple(
        interpolate_coordinate(start, end, point_index / (point_count - 1))
        for point_index in range(point_count)
    )
    route_distance = (
        PolylineWalker(coordinates).total_miles if distance_miles is None else distance_miles
    )
    route_duration = (
        route_distance / average_speed_mph * 3600 if duration_seconds is None else duration_seconds
    )
    return RouteCandidate(
        provider_name=provider_name,
        coordinates=coordinates,
        distance_miles=route_distance,
        duration_seconds=route_duration,
        steps=tuple(steps) if steps is not None else (RouteStep(route_distance, route_duration),),
    )


def build_assessed_route(
    route_id: str,
    *,
    no_travel_miles: float = 0.0,
    severe_miles: float = 0.0,
    high_miles: float = 0.0,
    average_risk_score: float | None = 0.0,
    duration_minutes: float = 60.0,
) -> AssessedRoute:
    miles_by_level = {
        RiskLevel.NO_TRAVEL: no_travel_miles,
        RiskLevel.SEVERE: severe_miles,
        RiskLevel.HIGH: high_miles,
    }
    return AssessedRoute(
        route_id=route_id,
        candidate=build_straight_route(Coordinate(35.0, -100.0), Coordinate(35.0, -99.0)),
        checkpoints=(),
        summary=RouteRiskSummary(
            distance_miles=100.0,
            duration_seconds=duration_minutes * 60,
            miles_by_level=MappingProxyType(miles_by_level),
            unknown_miles=0.0,
            average_risk_score=average_risk_score,
            highest_level=None,
        ),
    )


class FakeRoutingProvider:
    def __init__(
        self,
        routes: Sequence[RouteCandidate] = (),
        *,
        error: Exception | None = None,
        name: str = "fake",
    ) -> None:
        self.name = name
        self._routes = list(routes)
        self._error = error
        self.requested_route_limits: list[int] = []

    def find_routes(
        self, origin: Coordinate, destination: Coordinate, route_limit: int
    ) -> list[RouteCandidate]:
        self.requested_route_limits.append(route_limit)
        if self._error is not None:
            raise self._error
        return self._routes[:route_limit]


class FakeWeatherProvider:
    def __init__(self, conditions_function: ConditionsFunction) -> None:
        self._conditions_function = conditions_function
        self.requested_location_batches: list[tuple[Coordinate, ...]] = []

    def fetch_hourly_forecasts(
        self, locations: Sequence[Coordinate], window: TimeWindow
    ) -> dict[Coordinate, ForecastSeries]:
        self.requested_location_batches.append(tuple(locations))
        hours = window.hourly_moments()
        return {
            location: ForecastSeries(
                first_hour=hours[0],
                hourly_conditions=tuple(
                    self._conditions_function(location, hour) for hour in hours
                ),
            )
            for location in locations
        }


class FakeGeocoder:
    def __init__(self, places: Sequence[Place]) -> None:
        self._places = list(places)
        self.received_queries: list[str] = []

    def search(self, query: str, result_limit: int) -> list[Place]:
        self.received_queries.append(query)
        return self._places[:result_limit]


class InMemoryForecastCache:
    def __init__(self) -> None:
        self.entries: dict[str, Any] = {}

    def get_many(self, keys: Iterable[str]) -> Mapping[str, Any]:
        return {key: self.entries[key] for key in keys if key in self.entries}

    def set_many(self, entries: Mapping[str, Any], time_to_live_seconds: int) -> None:
        self.entries.update(entries)


def build_route_evaluator(weather_provider: FakeWeatherProvider) -> RouteEvaluator:
    return RouteEvaluator(
        CheckpointSampler(),
        RouteAssessor(build_risk_evaluator()),
        ForecastGridLoader(weather_provider),
    )


def build_plan_trip_service(
    routes: Sequence[RouteCandidate], conditions_function: ConditionsFunction
) -> PlanTripService:
    return PlanTripService(
        FakeRoutingProvider(routes),
        build_route_evaluator(FakeWeatherProvider(conditions_function)),
        RouteRanker(),
    )
