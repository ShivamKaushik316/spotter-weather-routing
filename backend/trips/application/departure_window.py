from datetime import datetime, timedelta

from core.metrics import current_metrics
from trips.application.requests import DepartureWindowRequest
from trips.application.route_evaluation import RouteEvaluator, find_labelled_routes
from trips.domain.departure import DepartureOption, DepartureWindowPlan, describe_risk_change
from trips.domain.models import AssessedRoute
from trips.domain.ranking import RouteRanker
from trips.ports import RoutingProvider

ONE_HOUR = timedelta(hours=1)


class DepartureWindowService:
    def __init__(
        self,
        routing_provider: RoutingProvider,
        route_evaluator: RouteEvaluator,
        ranker: RouteRanker,
    ) -> None:
        self._routing_provider = routing_provider
        self._route_evaluator = route_evaluator
        self._ranker = ranker

    def execute(self, request: DepartureWindowRequest) -> DepartureWindowPlan:
        trip = request.trip
        labelled_routes = find_labelled_routes(
            self._routing_provider, trip.origin, trip.destination
        )
        departures = [
            trip.departure + ONE_HOUR * delay_hours
            for delay_hours in range(request.window_hours + 1)
        ]
        assessed_by_departure = self._route_evaluator.evaluate(
            labelled_routes, departures, trip.load_pounds, trip.interval_miles
        )
        with current_metrics().measure("ranking"):
            best_route_by_departure = {
                departure: self._ranker.rank(assessed_routes)[0]
                for departure, assessed_routes in assessed_by_departure.items()
            }
            ordered_departures = sorted(
                departures,
                key=lambda departure: (
                    self._ranker.sort_key(best_route_by_departure[departure]),
                    departure,
                ),
            )
        baseline_route = best_route_by_departure[trip.departure]
        return DepartureWindowPlan(
            baseline=_build_option(trip.departure, trip.departure, baseline_route, baseline_route),
            ranked_options=tuple(
                _build_option(
                    departure, trip.departure, best_route_by_departure[departure], baseline_route
                )
                for departure in ordered_departures[: request.option_limit]
            ),
        )


def _build_option(
    departure: datetime,
    planned_departure: datetime,
    best_route: AssessedRoute,
    baseline_route: AssessedRoute,
) -> DepartureOption:
    return DepartureOption(
        departure=departure,
        delay_hours=round((departure - planned_departure) / ONE_HOUR),
        best_route=best_route,
        change_from_baseline=describe_risk_change(baseline_route.summary, best_route.summary),
    )
