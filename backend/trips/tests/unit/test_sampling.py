from datetime import timedelta
from itertools import pairwise

import pytest

from trips.domain.models import Coordinate, RouteStep
from trips.domain.sampling import CheckpointSampler, checkpoint_distances, represented_miles
from trips.tests.fakes import FIXED_DEPARTURE, build_straight_route

SAMPLER = CheckpointSampler()
CITY_THEN_HIGHWAY_STEPS = (RouteStep(10.0, 1800.0), RouteStep(110.0, 6000.0))


def build_city_then_highway_route():
    return build_straight_route(
        Coordinate(35.0, -100.0),
        Coordinate(35.0, -98.0),
        distance_miles=120.0,
        duration_seconds=7800.0,
        steps=CITY_THEN_HIGHWAY_STEPS,
    )


def test_checkpoints_every_interval_plus_destination() -> None:
    assert checkpoint_distances(120.0, 25.0) == [0.0, 25.0, 50.0, 75.0, 100.0, 120.0]


def test_exact_multiple_does_not_duplicate_destination() -> None:
    assert checkpoint_distances(100.0, 25.0) == [0.0, 25.0, 50.0, 75.0, 100.0]


def test_route_shorter_than_interval_has_origin_and_destination() -> None:
    assert checkpoint_distances(8.0, 10.0) == [0.0, 8.0]


def test_non_positive_interval_is_rejected() -> None:
    with pytest.raises(ValueError, match="positive"):
        checkpoint_distances(100.0, 0.0)


def test_represented_miles_split_at_midpoints() -> None:
    distances = [0.0, 25.0, 50.0, 75.0, 100.0, 120.0]

    assert represented_miles(distances) == [12.5, 25.0, 25.0, 25.0, 22.5, 10.0]


def test_represented_miles_sum_to_route_length() -> None:
    sampled_points = SAMPLER.sample(build_city_then_highway_route(), FIXED_DEPARTURE, 25.0)

    assert sum(point.represented_miles for point in sampled_points) == pytest.approx(120.0)


def test_eta_uses_step_speeds_not_average_speed() -> None:
    sampled_points = SAMPLER.sample(build_city_then_highway_route(), FIXED_DEPARTURE, 25.0)
    expected_seconds = 1800 + (15 / 110) * 6000

    elapsed_seconds = (sampled_points[1].estimated_arrival - FIXED_DEPARTURE).total_seconds()

    assert sampled_points[1].distance_from_origin_miles == 25.0
    assert elapsed_seconds == pytest.approx(expected_seconds, abs=1)


def test_etas_are_monotonic_and_end_at_route_duration() -> None:
    sampled_points = SAMPLER.sample(build_city_then_highway_route(), FIXED_DEPARTURE, 10.0)
    arrivals = [point.estimated_arrival for point in sampled_points]

    assert all(earlier <= later for earlier, later in pairwise(arrivals))
    assert arrivals[0] == FIXED_DEPARTURE
    assert arrivals[-1] == FIXED_DEPARTURE + timedelta(seconds=7800)


def test_checkpoints_lie_on_route_geometry() -> None:
    sampled_points = SAMPLER.sample(build_city_then_highway_route(), FIXED_DEPARTURE, 25.0)

    assert sampled_points[0].coordinate == Coordinate(35.0, -100.0)
    assert sampled_points[-1].coordinate.longitude == pytest.approx(-98.0)
    assert all(point.coordinate.latitude == pytest.approx(35.0) for point in sampled_points)
