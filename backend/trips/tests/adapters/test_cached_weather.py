from datetime import timedelta

from core.metrics import collect_metrics
from trips.adapters.cached_weather import CachedWeatherProvider
from trips.domain.models import Coordinate
from trips.domain.weather import TimeWindow
from trips.tests.fakes import (
    FIXED_DEPARTURE,
    FakeWeatherProvider,
    InMemoryForecastCache,
    build_weather,
    constant_weather,
)

DENVER = Coordinate(39.7, -105.0)
DALLAS = Coordinate(32.8, -96.8)
WINDOW = TimeWindow(FIXED_DEPARTURE, FIXED_DEPARTURE + timedelta(hours=2))


def build_cached_provider() -> tuple[CachedWeatherProvider, FakeWeatherProvider]:
    origin_provider = FakeWeatherProvider(constant_weather(build_weather(wind_speed_mph=30.0)))
    return CachedWeatherProvider(origin_provider, InMemoryForecastCache(), 600), origin_provider


def test_second_request_is_served_from_cache() -> None:
    cached_provider, origin_provider = build_cached_provider()

    cached_provider.fetch_hourly_forecasts([DENVER], WINDOW)
    with collect_metrics() as metrics:
        forecasts = cached_provider.fetch_hourly_forecasts([DENVER], WINDOW)

    conditions = forecasts[DENVER].conditions_at(FIXED_DEPARTURE + timedelta(hours=1))
    assert conditions is not None
    assert conditions.wind_speed_mph == 30.0
    assert len(origin_provider.requested_location_batches) == 1
    assert metrics.snapshot().counters["weather_cache_hits"] == 1


def test_only_uncached_locations_are_fetched() -> None:
    cached_provider, origin_provider = build_cached_provider()

    cached_provider.fetch_hourly_forecasts([DENVER], WINDOW)
    cached_provider.fetch_hourly_forecasts([DENVER, DALLAS], WINDOW)

    assert origin_provider.requested_location_batches[-1] == (DALLAS,)


def test_wider_window_refetches_location() -> None:
    cached_provider, origin_provider = build_cached_provider()
    wider_window = TimeWindow(WINDOW.start, WINDOW.end + timedelta(hours=1))

    cached_provider.fetch_hourly_forecasts([DENVER], WINDOW)
    cached_provider.fetch_hourly_forecasts([DENVER], wider_window)

    assert len(origin_provider.requested_location_batches) == 2
