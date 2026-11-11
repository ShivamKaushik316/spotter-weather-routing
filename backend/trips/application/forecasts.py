from collections.abc import Iterable

from core.metrics import current_metrics
from trips.domain.geo import snap_to_grid
from trips.domain.models import Coordinate
from trips.domain.weather import ForecastGrid, TimeWindow
from trips.ports import WeatherProvider

DEFAULT_GRID_RESOLUTION_DEGREES = 0.1


class ForecastGridLoader:
    def __init__(
        self,
        weather_provider: WeatherProvider,
        grid_resolution_degrees: float = DEFAULT_GRID_RESOLUTION_DEGREES,
    ) -> None:
        self._weather_provider = weather_provider
        self._grid_resolution_degrees = grid_resolution_degrees

    def load(self, coordinates: Iterable[Coordinate], window: TimeWindow) -> ForecastGrid:
        grid_cells = list(
            dict.fromkeys(
                snap_to_grid(coordinate, self._grid_resolution_degrees)
                for coordinate in coordinates
            )
        )
        current_metrics().increment("weather_locations", len(grid_cells))
        series_by_cell = self._weather_provider.fetch_hourly_forecasts(grid_cells, window)
        return ForecastGrid(self._grid_resolution_degrees, series_by_cell)
