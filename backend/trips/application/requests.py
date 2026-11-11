from dataclasses import dataclass
from datetime import datetime

from trips.domain.models import Coordinate

HEATMAP_FORECAST_HOURS = 48


@dataclass(frozen=True, slots=True)
class TripRequest:
    origin: Coordinate
    destination: Coordinate
    departure: datetime
    load_pounds: float
    interval_miles: int


@dataclass(frozen=True, slots=True)
class DepartureWindowRequest:
    trip: TripRequest
    window_hours: int
    option_limit: int


@dataclass(frozen=True, slots=True)
class HeatmapRequest:
    route_geometries: tuple[tuple[Coordinate, ...], ...]
    departure: datetime
    load_pounds: float
    forecast_hours: int = HEATMAP_FORECAST_HOURS
