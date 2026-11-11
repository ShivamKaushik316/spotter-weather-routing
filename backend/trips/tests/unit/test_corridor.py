from trips.domain.corridor import (
    DEFAULT_LATERAL_OFFSETS_KILOMETERS,
    DEFAULT_SNAP_RESOLUTION_DEGREES,
    CorridorGridBuilder,
)
from trips.domain.geo import KILOMETERS_PER_MILE, haversine_miles
from trips.domain.models import Coordinate
from trips.tests.fakes import build_straight_route

MILES_PER_DEGREE_LATITUDE = 69.1

EASTBOUND_ROUTE = build_straight_route(Coordinate(35.0, -100.0), Coordinate(35.0, -98.0))


def test_grid_spreads_points_on_both_sides_of_route() -> None:
    points = CorridorGridBuilder().build([EASTBOUND_ROUTE.coordinates])

    latitudes = {point.latitude for point in points}

    assert min(latitudes) < 35.0 < max(latitudes)


def test_grid_points_stay_inside_corridor() -> None:
    points = CorridorGridBuilder().build([EASTBOUND_ROUTE.coordinates])
    widest_offset_miles = max(DEFAULT_LATERAL_OFFSETS_KILOMETERS) / KILOMETERS_PER_MILE
    snapping_error_miles = DEFAULT_SNAP_RESOLUTION_DEGREES / 2 * MILES_PER_DEGREE_LATITUDE
    maximum_offset_miles = widest_offset_miles + snapping_error_miles

    assert all(
        haversine_miles(point, Coordinate(35.0, point.longitude)) <= maximum_offset_miles
        for point in points
    )


def test_overlapping_routes_do_not_duplicate_points() -> None:
    builder = CorridorGridBuilder()

    single = builder.build([EASTBOUND_ROUTE.coordinates])
    doubled = builder.build([EASTBOUND_ROUTE.coordinates, EASTBOUND_ROUTE.coordinates])

    assert single == doubled
    assert len(set(single)) == len(single)


def test_grid_is_thinned_to_maximum_points() -> None:
    long_route = build_straight_route(Coordinate(35.0, -120.0), Coordinate(35.0, -80.0))

    points = CorridorGridBuilder(max_points=50).build([long_route.coordinates])

    assert len(points) <= 50


def test_degenerate_geometries_are_ignored() -> None:
    assert CorridorGridBuilder().build([[Coordinate(35.0, -100.0)]]) == ()
