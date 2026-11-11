import string
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

from core.exceptions import NoRouteFoundError
from core.metrics import current_metrics
from trips.application.forecasts import ForecastGridLoader
from trips.domain.assessment import RouteAssessor
from trips.domain.models import AssessedRoute, Coordinate, RouteCandidate, SampledPoint
from trips.domain.sampling import CheckpointSampler
from trips.domain.weather import TimeWindow
from trips.ports import RoutingProvider

REQUESTED_ROUTE_COUNT = 3
ROUTE_LABELS = string.ascii_uppercase


@dataclass(frozen=True, slots=True)
class LabelledRoute:
    route_id: str
    candidate: RouteCandidate


def find_labelled_routes(
    routing_provider: RoutingProvider, origin: Coordinate, destination: Coordinate
) -> list[LabelledRoute]:
    metrics = current_metrics()
    with metrics.measure("routing"):
        candidates = routing_provider.find_routes(origin, destination, REQUESTED_ROUTE_COUNT)
    if not candidates:
        raise NoRouteFoundError("No drivable route was found between origin and destination.")
    for candidate in candidates:
        metrics.record_label("routing_providers", candidate.provider_name)
    return [
        LabelledRoute(route_id=route_label, candidate=candidate)
        for route_label, candidate in zip(ROUTE_LABELS, candidates, strict=False)
    ]


class RouteEvaluator:
    def __init__(
        self,
        sampler: CheckpointSampler,
        assessor: RouteAssessor,
        forecast_loader: ForecastGridLoader,
    ) -> None:
        self._sampler = sampler
        self._assessor = assessor
        self._forecast_loader = forecast_loader

    def evaluate(
        self,
        routes: Sequence[LabelledRoute],
        departures: Sequence[datetime],
        load_pounds: float,
        interval_miles: float,
    ) -> dict[datetime, tuple[AssessedRoute, ...]]:
        metrics = current_metrics()
        with metrics.measure("sampling"):
            samples_by_departure = {
                departure: [
                    (route, self._sampler.sample(route.candidate, departure, interval_miles))
                    for route in routes
                ]
                for departure in departures
            }
        all_points = [
            point
            for route_samples in samples_by_departure.values()
            for _, sampled_points in route_samples
            for point in sampled_points
        ]
        with metrics.measure("weather"):
            forecast_grid = self._forecast_loader.load(
                (point.coordinate for point in all_points), _window_covering(all_points)
            )
        with metrics.measure("risk"):
            return {
                departure: tuple(
                    self._assessor.assess(
                        route.route_id, route.candidate, sampled_points, load_pounds, forecast_grid
                    )
                    for route, sampled_points in route_samples
                )
                for departure, route_samples in samples_by_departure.items()
            }


def _window_covering(points: Sequence[SampledPoint]) -> TimeWindow:
    return TimeWindow.covering(point.estimated_arrival for point in points)
