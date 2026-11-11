import logging
from collections.abc import Sequence

from core.exceptions import NoRouteFoundError, UpstreamServiceError
from trips.domain.geo import (
    KILOMETERS_PER_MILE,
    destination_coordinate,
    haversine_miles,
    initial_bearing_degrees,
    interpolate_coordinate,
)
from trips.domain.models import Coordinate, RouteCandidate
from trips.ports import WaypointRouter

logger = logging.getLogger(__name__)

DEFAULT_LATERAL_OFFSET_RATIOS = (0.15, -0.15, 0.3, -0.3)
RIGHT_ANGLE_DEGREES = 90.0


class DetourRoutingProvider:
    name = "detour"

    def __init__(
        self,
        waypoint_router: WaypointRouter,
        lateral_offset_ratios: Sequence[float] = DEFAULT_LATERAL_OFFSET_RATIOS,
    ) -> None:
        self._waypoint_router = waypoint_router
        self._lateral_offset_ratios = tuple(lateral_offset_ratios)

    def find_routes(
        self, origin: Coordinate, destination: Coordinate, route_limit: int
    ) -> list[RouteCandidate]:
        direct_distance_kilometers = haversine_miles(origin, destination) * KILOMETERS_PER_MILE
        midpoint = interpolate_coordinate(origin, destination, 0.5)
        perpendicular_bearing = initial_bearing_degrees(origin, destination) + RIGHT_ANGLE_DEGREES
        detours: list[RouteCandidate] = []
        for offset_ratio in self._lateral_offset_ratios:
            if len(detours) >= route_limit:
                break
            via_point = destination_coordinate(
                midpoint, perpendicular_bearing, direct_distance_kilometers * offset_ratio
            )
            try:
                detours.append(
                    self._waypoint_router.route_through([origin, via_point, destination])
                )
            except (NoRouteFoundError, UpstreamServiceError):
                logger.info("detour_route_unavailable", extra={"offset_ratio": offset_ratio})
        return detours
