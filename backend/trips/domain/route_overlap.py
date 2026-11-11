import math
from collections.abc import Iterable, Sequence

from trips.domain.geo import PolylineWalker, snap_to_grid
from trips.domain.models import Coordinate

RouteFootprint = frozenset[Coordinate]


class RouteOverlapDetector:
    def __init__(
        self,
        sample_spacing_miles: float = 1.0,
        cell_size_degrees: float = 0.02,
        duplicate_overlap_ratio: float = 0.8,
    ) -> None:
        self._sample_spacing_miles = sample_spacing_miles
        self._cell_size_degrees = cell_size_degrees
        self._duplicate_overlap_ratio = duplicate_overlap_ratio

    def footprint(self, coordinates: Sequence[Coordinate]) -> RouteFootprint:
        if len(coordinates) < 2:
            return frozenset(
                snap_to_grid(coordinate, self._cell_size_degrees) for coordinate in coordinates
            )
        walker = PolylineWalker(coordinates)
        sample_count = max(2, math.ceil(walker.total_miles / self._sample_spacing_miles) + 1)
        return frozenset(
            snap_to_grid(
                walker.coordinate_at_fraction(sample_index / (sample_count - 1)),
                self._cell_size_degrees,
            )
            for sample_index in range(sample_count)
        )

    def is_duplicate(
        self, footprint: RouteFootprint, accepted_footprints: Iterable[RouteFootprint]
    ) -> bool:
        return any(
            overlap_ratio(footprint, accepted) >= self._duplicate_overlap_ratio
            for accepted in accepted_footprints
        )


def overlap_ratio(first: RouteFootprint, second: RouteFootprint) -> float:
    smaller_size = min(len(first), len(second))
    if smaller_size == 0:
        return 0.0
    return len(first & second) / smaller_size
