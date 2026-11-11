import logging
from collections.abc import Sequence

from core.exceptions import NoRouteFoundError, UpstreamServiceError
from trips.domain.models import Coordinate, RouteCandidate
from trips.domain.route_overlap import RouteFootprint, RouteOverlapDetector
from trips.ports import RoutingProvider

logger = logging.getLogger(__name__)


class FallbackRoutingProvider:
    name = "fallback-chain"

    def __init__(
        self, providers: Sequence[RoutingProvider], overlap_detector: RouteOverlapDetector
    ) -> None:
        if not providers:
            raise ValueError("A fallback routing chain needs at least one provider.")
        self._providers = tuple(providers)
        self._overlap_detector = overlap_detector

    def find_routes(
        self, origin: Coordinate, destination: Coordinate, route_limit: int
    ) -> list[RouteCandidate]:
        accepted_routes: list[RouteCandidate] = []
        accepted_footprints: list[RouteFootprint] = []
        provider_failures: list[UpstreamServiceError] = []
        for provider in self._providers:
            if len(accepted_routes) >= route_limit:
                break
            try:
                offered_routes = provider.find_routes(origin, destination, route_limit)
            except NoRouteFoundError:
                continue
            except UpstreamServiceError as error:
                logger.warning(
                    "routing_provider_failed",
                    extra={"provider": provider.name, "upstream_detail": error.detail},
                )
                provider_failures.append(error)
                continue
            for route in offered_routes:
                if len(accepted_routes) >= route_limit:
                    break
                footprint = self._overlap_detector.footprint(route.coordinates)
                if self._overlap_detector.is_duplicate(footprint, accepted_footprints):
                    continue
                accepted_routes.append(route)
                accepted_footprints.append(footprint)
        if accepted_routes:
            return accepted_routes
        if len(provider_failures) == len(self._providers):
            raise UpstreamServiceError("routing", "Every routing provider failed.")
        raise NoRouteFoundError("No drivable route was found between origin and destination.")
