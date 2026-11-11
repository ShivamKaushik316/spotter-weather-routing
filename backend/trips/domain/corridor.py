import math
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from datetime import datetime

from trips.domain.geo import PolylineWalker, destination_coordinate, snap_to_grid
from trips.domain.models import Coordinate
from trips.domain.sampling import checkpoint_distances

DEFAULT_ALONG_ROUTE_SPACING_MILES = 25.0
DEFAULT_LATERAL_OFFSETS_KILOMETERS = (0.0, 30.0, -30.0, 60.0, -60.0)
DEFAULT_SNAP_RESOLUTION_DEGREES = 0.25
DEFAULT_MAX_POINTS = 300
RIGHT_ANGLE_DEGREES = 90.0


@dataclass(frozen=True, slots=True)
class HeatmapCell:
    coordinate: Coordinate
    hourly_heat: tuple[float | None, ...]


@dataclass(frozen=True, slots=True)
class CorridorHeatmap:
    moments: tuple[datetime, ...]
    cells: tuple[HeatmapCell, ...]


class CorridorGridBuilder:
    def __init__(
        self,
        *,
        along_route_spacing_miles: float = DEFAULT_ALONG_ROUTE_SPACING_MILES,
        lateral_offsets_kilometers: Sequence[float] = DEFAULT_LATERAL_OFFSETS_KILOMETERS,
        snap_resolution_degrees: float = DEFAULT_SNAP_RESOLUTION_DEGREES,
        max_points: int = DEFAULT_MAX_POINTS,
    ) -> None:
        self._along_route_spacing_miles = along_route_spacing_miles
        self._lateral_offsets_kilometers = tuple(lateral_offsets_kilometers)
        self._snap_resolution_degrees = snap_resolution_degrees
        self._max_points = max_points

    def build(self, route_geometries: Sequence[Sequence[Coordinate]]) -> tuple[Coordinate, ...]:
        unique_points: dict[Coordinate, None] = {}
        for geometry in route_geometries:
            if len(geometry) < 2:
                continue
            for point in self._points_along(PolylineWalker(geometry)):
                unique_points.setdefault(snap_to_grid(point, self._snap_resolution_degrees), None)
        return self._thin(tuple(unique_points))

    def _points_along(self, walker: PolylineWalker) -> Iterator[Coordinate]:
        for distance in checkpoint_distances(walker.total_miles, self._along_route_spacing_miles):
            center = walker.coordinate_at_miles(distance)
            perpendicular_bearing = walker.bearing_at_miles(distance) + RIGHT_ANGLE_DEGREES
            for offset_kilometers in self._lateral_offsets_kilometers:
                if offset_kilometers == 0:
                    yield center
                else:
                    yield destination_coordinate(center, perpendicular_bearing, offset_kilometers)

    def _thin(self, points: tuple[Coordinate, ...]) -> tuple[Coordinate, ...]:
        if len(points) <= self._max_points:
            return points
        stride = math.ceil(len(points) / self._max_points)
        return points[::stride]
