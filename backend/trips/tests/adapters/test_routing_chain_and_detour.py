from collections.abc import Sequence

import pytest

from core.exceptions import NoRouteFoundError, UpstreamServiceError
from trips.adapters.detour import DetourRoutingProvider
from trips.adapters.routing_chain import FallbackRoutingProvider
from trips.domain.models import Coordinate, RouteCandidate
from trips.domain.route_overlap import RouteOverlapDetector
from trips.tests.fakes import FakeRoutingProvider, build_straight_route

ORIGIN = Coordinate(35.0, -100.0)
DESTINATION = Coordinate(35.0, -98.0)
DIRECT_ROUTE = build_straight_route(ORIGIN, DESTINATION, provider_name="primary")
NORTHERN_ROUTE = build_straight_route(
    Coordinate(36.0, -100.0), Coordinate(36.0, -98.0), provider_name="secondary"
)
SOUTHERN_ROUTE = build_straight_route(
    Coordinate(34.0, -100.0), Coordinate(34.0, -98.0), provider_name="secondary"
)


def build_chain(*providers: FakeRoutingProvider) -> FallbackRoutingProvider:
    return FallbackRoutingProvider(providers, RouteOverlapDetector())


def test_chain_collects_distinct_routes_across_providers() -> None:
    chain = build_chain(
        FakeRoutingProvider([DIRECT_ROUTE]),
        FakeRoutingProvider([DIRECT_ROUTE, NORTHERN_ROUTE, SOUTHERN_ROUTE]),
    )

    routes = chain.find_routes(ORIGIN, DESTINATION, route_limit=3)

    assert routes == [DIRECT_ROUTE, NORTHERN_ROUTE, SOUTHERN_ROUTE]


def test_chain_stops_once_enough_routes_are_found() -> None:
    unused_provider = FakeRoutingProvider([NORTHERN_ROUTE])
    chain = build_chain(FakeRoutingProvider([DIRECT_ROUTE, SOUTHERN_ROUTE]), unused_provider)

    routes = chain.find_routes(ORIGIN, DESTINATION, route_limit=2)

    assert len(routes) == 2
    assert unused_provider.requested_route_limits == []


def test_chain_skips_failing_provider() -> None:
    chain = build_chain(
        FakeRoutingProvider(error=UpstreamServiceError("primary", "down")),
        FakeRoutingProvider([DIRECT_ROUTE]),
    )

    assert chain.find_routes(ORIGIN, DESTINATION, route_limit=3) == [DIRECT_ROUTE]


def test_chain_raises_upstream_error_when_every_provider_fails() -> None:
    chain = build_chain(
        FakeRoutingProvider(error=UpstreamServiceError("primary", "down")),
        FakeRoutingProvider(error=UpstreamServiceError("secondary", "down")),
    )

    with pytest.raises(UpstreamServiceError):
        chain.find_routes(ORIGIN, DESTINATION, route_limit=3)


def test_chain_raises_no_route_when_nothing_is_drivable() -> None:
    chain = build_chain(
        FakeRoutingProvider(error=NoRouteFoundError("none")),
        FakeRoutingProvider([]),
    )

    with pytest.raises(NoRouteFoundError):
        chain.find_routes(ORIGIN, DESTINATION, route_limit=3)


def test_chain_requires_providers() -> None:
    with pytest.raises(ValueError, match="at least one provider"):
        FallbackRoutingProvider([], RouteOverlapDetector())


class RecordingWaypointRouter:
    def __init__(self, failing_call_numbers: Sequence[int] = ()) -> None:
        self.received_waypoints: list[tuple[Coordinate, ...]] = []
        self._failing_call_numbers = set(failing_call_numbers)

    def route_through(self, waypoints: Sequence[Coordinate]) -> RouteCandidate:
        self.received_waypoints.append(tuple(waypoints))
        if len(self.received_waypoints) in self._failing_call_numbers:
            raise NoRouteFoundError("unreachable via point")
        return build_straight_route(waypoints[0], waypoints[-1], provider_name="detour")


def test_detour_routes_pass_through_offset_via_points() -> None:
    router = RecordingWaypointRouter()

    detours = DetourRoutingProvider(router).find_routes(ORIGIN, DESTINATION, route_limit=2)

    assert len(detours) == 2
    first_via, second_via = (waypoints[1] for waypoints in router.received_waypoints)
    assert first_via.latitude < ORIGIN.latitude < second_via.latitude


def test_detour_skips_unreachable_via_points() -> None:
    router = RecordingWaypointRouter(failing_call_numbers=[1])

    detours = DetourRoutingProvider(router).find_routes(ORIGIN, DESTINATION, route_limit=2)

    assert len(detours) == 2
    assert len(router.received_waypoints) == 3
