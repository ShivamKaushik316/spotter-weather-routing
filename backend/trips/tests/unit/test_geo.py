import pytest

from trips.domain.geo import (
    KILOMETERS_PER_MILE,
    PolylineWalker,
    destination_coordinate,
    haversine_miles,
    initial_bearing_degrees,
    simplify_polyline,
    snap_to_grid,
)
from trips.domain.models import Coordinate

NEW_YORK = Coordinate(40.7128, -74.0060)
LOS_ANGELES = Coordinate(34.0522, -118.2437)


def test_haversine_matches_known_city_distance() -> None:
    assert haversine_miles(NEW_YORK, LOS_ANGELES) == pytest.approx(2445.6, abs=5)


def test_haversine_of_same_point_is_zero() -> None:
    assert haversine_miles(NEW_YORK, NEW_YORK) == 0


def test_destination_coordinate_travels_requested_distance() -> None:
    origin = Coordinate(0.0, 0.0)

    destination = destination_coordinate(origin, 90.0, 100.0)

    assert haversine_miles(origin, destination) * KILOMETERS_PER_MILE == pytest.approx(100.0)
    assert initial_bearing_degrees(origin, destination) == pytest.approx(90.0)


def test_negative_distance_travels_opposite_direction() -> None:
    destination = destination_coordinate(Coordinate(10.0, 10.0), 0.0, -50.0)

    assert destination.latitude < 10.0


def test_snap_to_grid_rounds_to_resolution() -> None:
    assert snap_to_grid(Coordinate(40.04, -100.06), 0.1) == Coordinate(40.0, -100.1)


def test_polyline_walker_interpolates_along_line() -> None:
    walker = PolylineWalker([Coordinate(0.0, 0.0), Coordinate(0.0, 1.0)])

    midpoint = walker.coordinate_at_fraction(0.5)

    assert midpoint.latitude == pytest.approx(0.0)
    assert midpoint.longitude == pytest.approx(0.5)
    assert walker.total_miles == pytest.approx(69.09, abs=0.1)
    assert walker.bearing_at_miles(10.0) == pytest.approx(90.0)


def test_polyline_walker_clamps_out_of_range_positions() -> None:
    start = Coordinate(0.0, 0.0)
    end = Coordinate(1.0, 0.0)
    walker = PolylineWalker([start, end])

    assert walker.coordinate_at_miles(-5.0) == start
    assert walker.coordinate_at_miles(10_000.0) == end


def test_polyline_walker_requires_two_points() -> None:
    with pytest.raises(ValueError, match="at least two"):
        PolylineWalker([Coordinate(0.0, 0.0)])


def test_simplify_polyline_drops_collinear_points() -> None:
    line = [Coordinate(0.0, float(index)) for index in range(10)]

    assert simplify_polyline(line, 0.0001) == (line[0], line[-1])


def test_simplify_polyline_keeps_significant_corner() -> None:
    corner = Coordinate(1.0, 1.0)
    line = [Coordinate(0.0, 0.0), Coordinate(0.5, 0.5), corner, Coordinate(0.0, 2.0)]

    assert corner in simplify_polyline(line, 0.01)
