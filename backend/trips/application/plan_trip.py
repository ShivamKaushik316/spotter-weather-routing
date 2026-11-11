from core.metrics import current_metrics
from trips.application.requests import TripRequest
from trips.application.route_evaluation import (
    REQUESTED_ROUTE_COUNT,
    RouteEvaluator,
    find_labelled_routes,
)
from trips.domain.advisories import collect_trip_warnings
from trips.domain.models import TripPlan
from trips.domain.ranking import RouteRanker
from trips.ports import RoutingProvider


class PlanTripService:
    def __init__(
        self,
        routing_provider: RoutingProvider,
        route_evaluator: RouteEvaluator,
        ranker: RouteRanker,
    ) -> None:
        self._routing_provider = routing_provider
        self._route_evaluator = route_evaluator
        self._ranker = ranker

    def execute(self, request: TripRequest) -> TripPlan:
        labelled_routes = find_labelled_routes(
            self._routing_provider, request.origin, request.destination
        )
        assessed_routes = self._route_evaluator.evaluate(
            labelled_routes, [request.departure], request.load_pounds, request.interval_miles
        )[request.departure]
        with current_metrics().measure("ranking"):
            ranked_routes = self._ranker.rank(assessed_routes)
        return TripPlan(
            departure=request.departure,
            load_pounds=request.load_pounds,
            interval_miles=request.interval_miles,
            ranked_routes=ranked_routes,
            recommendation_reason=self._ranker.explain_recommendation(ranked_routes),
            warnings=collect_trip_warnings(ranked_routes, REQUESTED_ROUTE_COUNT),
        )
