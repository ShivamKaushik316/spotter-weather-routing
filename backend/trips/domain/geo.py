import math
from bisect import bisect_left
from collections.abc import Sequence
from itertools import pairwise

from trips.domain.models import Coordinate

EARTH_RADIUS_MILES = 3958.7613
KILOMETERS_PER_MILE = 1.609344
EARTH_RADIUS_KILOMETERS = EARTH_RADIUS_MILES * KILOMETERS_PER_MILE
SNAPPED_COORDINATE_DECIMALS = 6


def haversine_miles(start: Coordinate, end: Coordinate) -> float:
    start_latitude = math.radians(start.latitude)
    end_latitude = math.radians(end.latitude)
    latitude_delta = end_latitude - start_latitude
    longitude_delta = math.radians(end.longitude - start.longitude)
    half_chord_squared = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(start_latitude) * math.cos(end_latitude) * math.sin(longitude_delta / 2) ** 2
    )
    return 2 * EARTH_RADIUS_MILES * math.asin(math.sqrt(min(1.0, half_chord_squared)))


def interpolate_coordinate(start: Coordinate, end: Coordinate, fraction: float) -> Coordinate:
    return Coordinate(
        latitude=start.latitude + (end.latitude - start.latitude) * fraction,
        longitude=start.longitude + (end.longitude - start.longitude) * fraction,
    )


def initial_bearing_degrees(start: Coordinate, end: Coordinate) -> float:
    start_latitude = math.radians(start.latitude)
    end_latitude = math.radians(end.latitude)
    longitude_delta = math.radians(end.longitude - start.longitude)
    eastward_component = math.sin(longitude_delta) * math.cos(end_latitude)
    northward_component = math.cos(start_latitude) * math.sin(end_latitude) - math.sin(
        start_latitude
    ) * math.cos(end_latitude) * math.cos(longitude_delta)
    return (math.degrees(math.atan2(eastward_component, northward_component)) + 360) % 360


def destination_coordinate(
    origin: Coordinate, bearing_degrees: float, distance_kilometers: float
) -> Coordinate:
    angular_distance = distance_kilometers / EARTH_RADIUS_KILOMETERS
    bearing = math.radians(bearing_degrees)
    origin_latitude = math.radians(origin.latitude)
    origin_longitude = math.radians(origin.longitude)
    destination_latitude = math.asin(
        math.sin(origin_latitude) * math.cos(angular_distance)
        + math.cos(origin_latitude) * math.sin(angular_distance) * math.cos(bearing)
    )
    destination_longitude = origin_longitude + math.atan2(
        math.sin(bearing) * math.sin(angular_distance) * math.cos(origin_latitude),
        math.cos(angular_distance) - math.sin(origin_latitude) * math.sin(destination_latitude),
    )
    return Coordinate(
        latitude=math.degrees(destination_latitude),
        longitude=_normalize_longitude(math.degrees(destination_longitude)),
    )


def snap_to_grid(coordinate: Coordinate, resolution_degrees: float) -> Coordinate:
    return Coordinate(
        latitude=_snap_value(coordinate.latitude, resolution_degrees),
        longitude=_snap_value(coordinate.longitude, resolution_degrees),
    )


def simplify_polyline(
    coordinates: Sequence[Coordinate], tolerance_degrees: float
) -> tuple[Coordinate, ...]:
    if len(coordinates) <= 2:
        return tuple(coordinates)
    keep_flags = [False] * len(coordinates)
    keep_flags[0] = keep_flags[-1] = True
    pending_ranges = [(0, len(coordinates) - 1)]
    while pending_ranges:
        first_index, last_index = pending_ranges.pop()
        farthest_index = -1
        farthest_distance = 0.0
        for candidate_index in range(first_index + 1, last_index):
            distance = _planar_distance_to_segment(
                coordinates[candidate_index], coordinates[first_index], coordinates[last_index]
            )
            if distance > farthest_distance:
                farthest_index = candidate_index
                farthest_distance = distance
        if farthest_distance > tolerance_degrees:
            keep_flags[farthest_index] = True
            pending_ranges.append((first_index, farthest_index))
            pending_ranges.append((farthest_index, last_index))
    return tuple(
        coordinate for coordinate, keep in zip(coordinates, keep_flags, strict=True) if keep
    )


class PolylineWalker:
    def __init__(self, coordinates: Sequence[Coordinate]) -> None:
        if len(coordinates) < 2:
            raise ValueError("A polyline needs at least two coordinates.")
        self._coordinates = tuple(coordinates)
        cumulative_miles = [0.0]
        for start, end in pairwise(self._coordinates):
            cumulative_miles.append(cumulative_miles[-1] + haversine_miles(start, end))
        self._cumulative_miles = cumulative_miles

    @property
    def total_miles(self) -> float:
        return self._cumulative_miles[-1]

    def coordinate_at_fraction(self, fraction: float) -> Coordinate:
        return self.coordinate_at_miles(min(max(fraction, 0.0), 1.0) * self.total_miles)

    def coordinate_at_miles(self, miles: float) -> Coordinate:
        target_miles = self._clamp_miles(miles)
        segment_index = self._segment_index_at(target_miles)
        segment_start_miles = self._cumulative_miles[segment_index - 1]
        segment_length = self._cumulative_miles[segment_index] - segment_start_miles
        progress = (
            0.0 if segment_length == 0 else (target_miles - segment_start_miles) / segment_length
        )
        return interpolate_coordinate(
            self._coordinates[segment_index - 1], self._coordinates[segment_index], progress
        )

    def bearing_at_miles(self, miles: float) -> float:
        segment_index = self._segment_index_at(self._clamp_miles(miles))
        segment_start = self._coordinates[segment_index - 1]
        segment_end = self._coordinates[segment_index]
        if segment_start == segment_end:
            return initial_bearing_degrees(self._coordinates[0], self._coordinates[-1])
        return initial_bearing_degrees(segment_start, segment_end)

    def _clamp_miles(self, miles: float) -> float:
        return min(max(miles, 0.0), self.total_miles)

    def _segment_index_at(self, target_miles: float) -> int:
        index = bisect_left(self._cumulative_miles, target_miles)
        return min(max(index, 1), len(self._coordinates) - 1)


def _snap_value(value: float, resolution_degrees: float) -> float:
    return round(
        round(value / resolution_degrees) * resolution_degrees, SNAPPED_COORDINATE_DECIMALS
    )


def _normalize_longitude(longitude: float) -> float:
    return (longitude + 540) % 360 - 180


def _planar_distance_to_segment(
    point: Coordinate, segment_start: Coordinate, segment_end: Coordinate
) -> float:
    longitude_span = segment_end.longitude - segment_start.longitude
    latitude_span = segment_end.latitude - segment_start.latitude
    span_length_squared = longitude_span**2 + latitude_span**2
    if span_length_squared == 0:
        return math.hypot(
            point.longitude - segment_start.longitude, point.latitude - segment_start.latitude
        )
    projection = (
        (point.longitude - segment_start.longitude) * longitude_span
        + (point.latitude - segment_start.latitude) * latitude_span
    ) / span_length_squared
    clamped_projection = min(1.0, max(0.0, projection))
    nearest_longitude = segment_start.longitude + clamped_projection * longitude_span
    nearest_latitude = segment_start.latitude + clamped_projection * latitude_span
    return math.hypot(point.longitude - nearest_longitude, point.latitude - nearest_latitude)
