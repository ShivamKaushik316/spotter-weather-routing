from __future__ import annotations

import math
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Self

from trips.domain.geo import snap_to_grid
from trips.domain.models import Coordinate, WeatherConditions

ONE_HOUR = timedelta(hours=1)
HOUR_OFFSET_TOLERANCE = 1e-9


def floor_to_hour(moment: datetime) -> datetime:
    return moment.replace(minute=0, second=0, microsecond=0)


def ceil_to_hour(moment: datetime) -> datetime:
    floored_moment = floor_to_hour(moment)
    return floored_moment if floored_moment == moment else floored_moment + ONE_HOUR


@dataclass(frozen=True, slots=True)
class TimeWindow:
    start: datetime
    end: datetime

    def __post_init__(self) -> None:
        if self.end < self.start:
            raise ValueError("A time window cannot end before it starts.")

    @classmethod
    def covering(cls, moments: Iterable[datetime]) -> Self:
        ordered_moments = sorted(moments)
        if not ordered_moments:
            raise ValueError("A time window needs at least one moment.")
        return cls(start=floor_to_hour(ordered_moments[0]), end=ceil_to_hour(ordered_moments[-1]))

    def hourly_moments(self) -> tuple[datetime, ...]:
        hour_count = int((self.end - self.start) / ONE_HOUR)
        return tuple(self.start + ONE_HOUR * hour_offset for hour_offset in range(hour_count + 1))


@dataclass(frozen=True, slots=True)
class ForecastSeries:
    first_hour: datetime
    hourly_conditions: tuple[WeatherConditions | None, ...]

    def conditions_at(self, moment: datetime) -> WeatherConditions | None:
        last_index = len(self.hourly_conditions) - 1
        hours_from_start = (moment - self.first_hour) / ONE_HOUR
        if last_index < 0 or hours_from_start < -HOUR_OFFSET_TOLERANCE:
            return None
        if hours_from_start > last_index + HOUR_OFFSET_TOLERANCE:
            return None
        bounded_offset = min(max(hours_from_start, 0.0), float(last_index))
        lower_index = math.floor(bounded_offset)
        upper_index = min(lower_index + 1, last_index)
        blend_weight = bounded_offset - lower_index
        lower_conditions = self.hourly_conditions[lower_index]
        if blend_weight <= HOUR_OFFSET_TOLERANCE:
            return lower_conditions
        upper_conditions = self.hourly_conditions[upper_index]
        if lower_conditions is None or upper_conditions is None:
            return None
        return lower_conditions.blend_towards(upper_conditions, blend_weight)


class ForecastGrid:
    def __init__(
        self, resolution_degrees: float, series_by_cell: Mapping[Coordinate, ForecastSeries]
    ) -> None:
        self._resolution_degrees = resolution_degrees
        self._series_by_cell = series_by_cell

    def conditions_at(self, coordinate: Coordinate, moment: datetime) -> WeatherConditions | None:
        series = self._series_by_cell.get(snap_to_grid(coordinate, self._resolution_degrees))
        return None if series is None else series.conditions_at(moment)
