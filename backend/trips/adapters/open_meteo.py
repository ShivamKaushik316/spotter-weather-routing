import logging
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from itertools import batched
from typing import Any

from core.exceptions import UpstreamServiceError
from core.http import JsonGetRequest, JsonHttpClient
from trips.domain.models import Coordinate, WeatherConditions
from trips.domain.weather import ForecastSeries, TimeWindow

logger = logging.getLogger(__name__)

OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
HOURLY_VARIABLES = ("wind_speed_10m", "wind_gusts_10m", "rain", "snowfall")
OPEN_METEO_TIME_FORMAT = "%Y-%m-%dT%H:%M"
REQUEST_COORDINATE_DECIMALS = 4


class OpenMeteoWeatherProvider:
    def __init__(
        self,
        http_client: JsonHttpClient,
        *,
        locations_per_request: int = 80,
        max_concurrent_requests: int = 4,
    ) -> None:
        self._http_client = http_client
        self._locations_per_request = locations_per_request
        self._max_concurrent_requests = max_concurrent_requests

    def fetch_hourly_forecasts(
        self, locations: Sequence[Coordinate], window: TimeWindow
    ) -> dict[Coordinate, ForecastSeries]:
        location_batches = list(batched(dict.fromkeys(locations), self._locations_per_request))
        responses = self._http_client.get_json_concurrently(
            [self._build_request(batch, window) for batch in location_batches],
            self._max_concurrent_requests,
        )
        series_by_location: dict[Coordinate, ForecastSeries] = {}
        for batch, response in zip(location_batches, responses, strict=True):
            if isinstance(response, UpstreamServiceError):
                logger.warning(
                    "weather_batch_failed",
                    extra={"location_count": len(batch), "upstream_detail": response.detail},
                )
                continue
            series_by_location.update(_parse_batch(batch, response))
        return series_by_location

    @staticmethod
    def _build_request(batch: Sequence[Coordinate], window: TimeWindow) -> JsonGetRequest:
        return JsonGetRequest(
            url=OPEN_METEO_FORECAST_URL,
            query_parameters={
                "latitude": _join_values(location.latitude for location in batch),
                "longitude": _join_values(location.longitude for location in batch),
                "hourly": ",".join(HOURLY_VARIABLES),
                "wind_speed_unit": "mph",
                "precipitation_unit": "inch",
                "timezone": "GMT",
                "start_hour": window.start.astimezone(UTC).strftime(OPEN_METEO_TIME_FORMAT),
                "end_hour": window.end.astimezone(UTC).strftime(OPEN_METEO_TIME_FORMAT),
            },
        )


def parse_forecast_series(payload: Mapping[str, Any]) -> ForecastSeries | None:
    try:
        hourly_values = payload["hourly"]
        hour_labels = hourly_values["time"]
        if not hour_labels:
            return None
        first_hour = datetime.strptime(hour_labels[0], OPEN_METEO_TIME_FORMAT).replace(tzinfo=UTC)
        return ForecastSeries(
            first_hour=first_hour,
            hourly_conditions=tuple(
                _conditions_at(hourly_values, hour_index) for hour_index in range(len(hour_labels))
            ),
        )
    except (KeyError, IndexError, TypeError, ValueError):
        logger.warning("weather_payload_malformed")
        return None


def _parse_batch(batch: Sequence[Coordinate], response: Any) -> dict[Coordinate, ForecastSeries]:
    payloads = response if isinstance(response, list) else [response]
    parsed_series: dict[Coordinate, ForecastSeries] = {}
    for location, payload in zip(batch, payloads, strict=False):
        series = parse_forecast_series(payload)
        if series is not None:
            parsed_series[location] = series
    return parsed_series


def _conditions_at(hourly_values: Mapping[str, Any], hour_index: int) -> WeatherConditions | None:
    readings = [hourly_values[variable][hour_index] for variable in HOURLY_VARIABLES]
    if any(reading is None for reading in readings):
        return None
    wind_speed, wind_gust, rain, snowfall = (float(reading) for reading in readings)
    return WeatherConditions(
        wind_speed_mph=wind_speed,
        wind_gust_mph=wind_gust,
        rain_inches_per_hour=rain,
        snowfall_inches_per_hour=snowfall,
    )


def _join_values(values: Any) -> str:
    return ",".join(f"{value:.{REQUEST_COORDINATE_DECIMALS}f}" for value in values)
