from trips.domain.models import Coordinate
from trips.domain.route_overlap import RouteOverlapDetector, overlap_ratio
from trips.tests.fakes import build_straight_route

DETECTOR = RouteOverlapDetector()
NORTHERN_ROUTE = build_straight_route(Coordinate(36.0, -100.0), Coordinate(36.0, -98.0))
SOUTHERN_ROUTE = build_straight_route(Coordinate(34.0, -100.0), Coordinate(34.0, -98.0))


def test_identical_routes_are_duplicates() -> None:
    footprint = DETECTOR.footprint(NORTHERN_ROUTE.coordinates)

    assert DETECTOR.is_duplicate(footprint, [DETECTOR.footprint(NORTHERN_ROUTE.coordinates)])


def test_separate_routes_are_not_duplicates() -> None:
    northern = DETECTOR.footprint(NORTHERN_ROUTE.coordinates)
    southern = DETECTOR.footprint(SOUTHERN_ROUTE.coordinates)

    assert not DETECTOR.is_duplicate(northern, [southern])


def test_overlap_ratio_of_empty_footprint_is_zero() -> None:
    assert overlap_ratio(frozenset(), frozenset({Coordinate(0.0, 0.0)})) == 0.0
