from collections.abc import Sequence
from datetime import datetime

from core.metrics import current_metrics
from trips.domain.models import Coordinate, WeatherConditions
from trips.domain.weather import ForecastSeries, TimeWindow
from trips.ports import ForecastCache, WeatherProvider

CACHE_KEY_PREFIX = "weather:v1"

CachedConditions = tuple[float, float, float, float]


def forecast_cache_key(location: Coordinate, hour: datetime) -> str:
    return f"{CACHE_KEY_PREFIX}:{location.latitude:.4f}:{location.longitude:.4f}:{hour:%Y%m%d%H}"


class CachedWeatherProvider:
    def __init__(
        self,
        origin_provider: WeatherProvider,
        cache: ForecastCache,
        time_to_live_seconds: int,
    ) -> None:
        self._origin_provider = origin_provider
        self._cache = cache
        self._time_to_live_seconds = time_to_live_seconds

    def fetch_hourly_forecasts(
        self, locations: Sequence[Coordinate], window: TimeWindow
    ) -> dict[Coordinate, ForecastSeries]:
        hours = window.hourly_moments()
        keys_by_location = {
            location: [forecast_cache_key(location, hour) for hour in hours]
            for location in dict.fromkeys(locations)
        }
        cached_entries = self._cache.get_many(
            [key for keys in keys_by_location.values() for key in keys]
        )
        series_by_location: dict[Coordinate, ForecastSeries] = {}
        uncached_locations: list[Coordinate] = []
        for location, keys in keys_by_location.items():
            if all(key in cached_entries for key in keys):
                series_by_location[location] = ForecastSeries(
                    first_hour=hours[0],
                    hourly_conditions=tuple(_decode(cached_entries[key]) for key in keys),
                )
            else:
                uncached_locations.append(location)
        metrics = current_metrics()
        metrics.increment("weather_cache_hits", len(series_by_location))
        metrics.increment("weather_cache_misses", len(uncached_locations))
        if uncached_locations:
            fetched_series = self._origin_provider.fetch_hourly_forecasts(
                uncached_locations, window
            )
            self._cache.set_many(
                _entries_to_cache(fetched_series, hours), self._time_to_live_seconds
            )
            series_by_location.update(fetched_series)
        return series_by_location


def _entries_to_cache(
    series_by_location: dict[Coordinate, ForecastSeries], hours: Sequence[datetime]
) -> dict[str, CachedConditions]:
    entries: dict[str, CachedConditions] = {}
    for location, series in series_by_location.items():
        for hour in hours:
            conditions = series.conditions_at(hour)
            if conditions is not None:
                entries[forecast_cache_key(location, hour)] = _encode(conditions)
    return entries


def _encode(conditions: WeatherConditions) -> CachedConditions:
    return (
        conditions.wind_speed_mph,
        conditions.wind_gust_mph,
        conditions.rain_inches_per_hour,
        conditions.snowfall_inches_per_hour,
    )


def _decode(cached: CachedConditions) -> WeatherConditions:
    wind_speed, wind_gust, rain, snowfall = cached
    return WeatherConditions(
        wind_speed_mph=wind_speed,
        wind_gust_mph=wind_gust,
        rain_inches_per_hour=rain,
        snowfall_inches_per_hour=snowfall,
    )
