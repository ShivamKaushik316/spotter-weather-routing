from datetime import timedelta

import httpx
import pytest
import respx

from core.http import JsonHttpClient, RetryPolicy
from trips.adapters.open_meteo import (
    OPEN_METEO_FORECAST_URL,
    OpenMeteoWeatherProvider,
    parse_forecast_series,
)
from trips.domain.models import Coordinate
from trips.domain.weather import TimeWindow
from trips.tests.fakes import FIXED_DEPARTURE

DENVER = Coordinate(39.7, -105.0)
DALLAS = Coordinate(32.8, -96.8)
TWO_HOUR_WINDOW = TimeWindow(FIXED_DEPARTURE, FIXED_DEPARTURE + timedelta(hours=1))
SINGLE_ATTEMPT = RetryPolicy(max_attempts=1, initial_backoff_seconds=0.0)


def open_meteo_payload(wind_speeds=(10.0, 20.0), rain=(0.0, 0.2)) -> dict:
    return {
        "hourly": {
            "time": ["2026-11-12T06:00", "2026-11-12T07:00"],
            "wind_speed_10m": list(wind_speeds),
            "wind_gusts_10m": [15.0, 30.0],
            "rain": list(rain),
            "snowfall": [0.0, 0.0],
        }
    }


def build_provider(locations_per_request: int = 80) -> OpenMeteoWeatherProvider:
    return OpenMeteoWeatherProvider(
        JsonHttpClient("open-meteo", retry_policy=SINGLE_ATTEMPT),
        locations_per_request=locations_per_request,
    )


@respx.mock
def test_parses_multi_location_response_in_request_order() -> None:
    route = respx.get(url__startswith=OPEN_METEO_FORECAST_URL).mock(
        return_value=httpx.Response(
            200, json=[open_meteo_payload(), open_meteo_payload(wind_speeds=(40.0, 50.0))]
        )
    )

    forecasts = build_provider().fetch_hourly_forecasts([DENVER, DALLAS], TWO_HOUR_WINDOW)

    dallas_conditions = forecasts[DALLAS].conditions_at(FIXED_DEPARTURE)
    assert dallas_conditions is not None
    assert dallas_conditions.wind_speed_mph == 40.0
    query = route.calls.last.request.url.params
    assert query["wind_speed_unit"] == "mph"
    assert query["precipitation_unit"] == "inch"
    assert query["start_hour"] == "2026-11-12T06:00"
    assert query["end_hour"] == "2026-11-12T07:00"


@respx.mock
def test_single_location_response_is_an_object() -> None:
    respx.get(url__startswith=OPEN_METEO_FORECAST_URL).mock(
        return_value=httpx.Response(200, json=open_meteo_payload())
    )

    forecasts = build_provider().fetch_hourly_forecasts([DENVER], TWO_HOUR_WINDOW)

    conditions = forecasts[DENVER].conditions_at(FIXED_DEPARTURE + timedelta(minutes=30))
    assert conditions is not None
    assert conditions.wind_speed_mph == pytest.approx(15.0)
    assert conditions.rain_inches_per_hour == pytest.approx(0.1)


@respx.mock
def test_failed_batch_leaves_its_locations_missing() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        if request.url.params["latitude"].startswith("39.7"):
            return httpx.Response(500)
        return httpx.Response(200, json=open_meteo_payload())

    respx.get(url__startswith=OPEN_METEO_FORECAST_URL).mock(side_effect=respond)

    forecasts = build_provider(locations_per_request=1).fetch_hourly_forecasts(
        [DENVER, DALLAS], TWO_HOUR_WINDOW
    )

    assert DENVER not in forecasts
    assert DALLAS in forecasts


def test_null_readings_become_unknown_hours() -> None:
    payload = open_meteo_payload()
    payload["hourly"]["rain"] = [None, 0.0]

    series = parse_forecast_series(payload)

    assert series is not None
    assert series.hourly_conditions[0] is None
    assert series.hourly_conditions[1] is not None


@pytest.mark.parametrize("payload", [{}, {"hourly": {"time": []}}, {"hourly": "broken"}])
def test_malformed_payload_is_ignored(payload: dict) -> None:
    assert parse_forecast_series(payload) is None
