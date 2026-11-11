from collections.abc import Iterable, Mapping, Sequence
from typing import Any, Protocol

from trips.domain.models import Coordinate, Place, RouteCandidate
from trips.domain.weather import ForecastSeries, TimeWindow


class Geocoder(Protocol):
    def search(self, query: str, result_limit: int) -> list[Place]: ...


class RoutingProvider(Protocol):
    name: str

    def find_routes(
        self, origin: Coordinate, destination: Coordinate, route_limit: int
    ) -> list[RouteCandidate]: ...


class WaypointRouter(Protocol):
    def route_through(self, waypoints: Sequence[Coordinate]) -> RouteCandidate: ...


class WeatherProvider(Protocol):
    def fetch_hourly_forecasts(
        self, locations: Sequence[Coordinate], window: TimeWindow
    ) -> dict[Coordinate, ForecastSeries]: ...


class ForecastCache(Protocol):
    def get_many(self, keys: Iterable[str]) -> Mapping[str, Any]: ...

    def set_many(self, entries: Mapping[str, Any], time_to_live_seconds: int) -> None: ...
