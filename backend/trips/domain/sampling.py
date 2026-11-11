from bisect import bisect_left
from collections.abc import Sequence
from datetime import datetime, timedelta
from itertools import accumulate, pairwise

from trips.domain.geo import PolylineWalker
from trips.domain.models import RouteCandidate, SampledPoint

DISTANCE_TOLERANCE_MILES = 1e-6


def checkpoint_distances(total_miles: float, interval_miles: float) -> list[float]:
    if interval_miles <= 0:
        raise ValueError("Sampling interval must be positive.")
    distances: list[float] = []
    checkpoint_index = 0
    while checkpoint_index * interval_miles < total_miles - DISTANCE_TOLERANCE_MILES:
        distances.append(checkpoint_index * interval_miles)
        checkpoint_index += 1
    distances.append(max(total_miles, 0.0))
    return distances


def represented_miles(distances: Sequence[float]) -> list[float]:
    boundaries = [
        distances[0],
        *((previous + following) / 2 for previous, following in pairwise(distances)),
        distances[-1],
    ]
    return [end - start for start, end in pairwise(boundaries)]


class TravelTimeEstimator:
    def __init__(self, route: RouteCandidate) -> None:
        self._route_distance_miles = route.distance_miles
        self._route_duration_seconds = route.duration_seconds
        self._distance_fractions, self._time_fractions = _progress_knots(route)

    def elapsed_seconds_at(self, distance_miles: float) -> float:
        if self._route_distance_miles <= 0:
            return 0.0
        distance_fraction = min(max(distance_miles / self._route_distance_miles, 0.0), 1.0)
        knot_index = min(
            max(bisect_left(self._distance_fractions, distance_fraction), 1),
            len(self._distance_fractions) - 1,
        )
        start_distance = self._distance_fractions[knot_index - 1]
        end_distance = self._distance_fractions[knot_index]
        start_time = self._time_fractions[knot_index - 1]
        end_time = self._time_fractions[knot_index]
        knot_span = end_distance - start_distance
        progress = 0.0 if knot_span <= 0 else (distance_fraction - start_distance) / knot_span
        time_fraction = start_time + (end_time - start_time) * progress
        return time_fraction * self._route_duration_seconds


class CheckpointSampler:
    def sample(
        self, route: RouteCandidate, departure: datetime, interval_miles: float
    ) -> tuple[SampledPoint, ...]:
        walker = PolylineWalker(route.coordinates)
        travel_time = TravelTimeEstimator(route)
        distances = checkpoint_distances(route.distance_miles, interval_miles)
        return tuple(
            SampledPoint(
                sequence=sequence,
                coordinate=walker.coordinate_at_fraction(
                    _fraction_of(distance, route.distance_miles)
                ),
                distance_from_origin_miles=distance,
                represented_miles=represented,
                estimated_arrival=departure
                + timedelta(seconds=travel_time.elapsed_seconds_at(distance)),
            )
            for sequence, (distance, represented) in enumerate(
                zip(distances, represented_miles(distances), strict=True)
            )
        )


def _progress_knots(route: RouteCandidate) -> tuple[list[float], list[float]]:
    total_step_distance = sum(step.distance_miles for step in route.steps)
    total_step_duration = sum(step.duration_seconds for step in route.steps)
    if total_step_distance <= 0 or total_step_duration <= 0:
        return [0.0, 1.0], [0.0, 1.0]
    distance_fractions = [
        0.0,
        *(
            cumulative / total_step_distance
            for cumulative in accumulate(step.distance_miles for step in route.steps)
        ),
    ]
    time_fractions = [
        0.0,
        *(
            cumulative / total_step_duration
            for cumulative in accumulate(step.duration_seconds for step in route.steps)
        ),
    ]
    return distance_fractions, time_fractions


def _fraction_of(distance_miles: float, total_miles: float) -> float:
    return 0.0 if total_miles <= 0 else distance_miles / total_miles
