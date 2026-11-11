import math
import time
from collections.abc import Sequence
from datetime import datetime

from trips.domain.geo import (
    KILOMETERS_PER_MILE,
    PolylineWalker,
    destination_coordinate,
    haversine_miles,
    initial_bearing_degrees,
    interpolate_coordinate,
)
from trips.domain.models import Coordinate, Place, RouteCandidate, RouteStep, WeatherConditions
from trips.domain.weather import ForecastSeries, TimeWindow

STUB_ROUTE_PROFILES = ((0.0, 55.0), (0.18, 60.0), (-0.18, 58.0))
STUB_SEGMENTS_PER_ROUTE = 80
ROAD_WINDING_FACTOR = 1.18
SECONDS_PER_HOUR = 3600
RIGHT_ANGLE_DEGREES = 90.0
FREEZING_LATITUDE_THRESHOLD = 41.0
STORM_PERIOD_HOURS = 8.0

STUB_PLACES = (
    Place("Chicago, IL, USA", Coordinate(41.8781, -87.6298)),
    Place("St. Louis, MO, USA", Coordinate(38.6270, -90.1994)),
    Place("Dallas, TX, USA", Coordinate(32.7767, -96.7970)),
    Place("Denver, CO, USA", Coordinate(39.7392, -104.9903)),
    Place("Los Angeles, CA, USA", Coordinate(34.0522, -118.2437)),
    Place("Seattle, WA, USA", Coordinate(47.6062, -122.3321)),
    Place("Portland, OR, USA", Coordinate(45.5152, -122.6784)),
    Place("Atlanta, GA, USA", Coordinate(33.7490, -84.3880)),
    Place("Kansas City, MO, USA", Coordinate(39.0997, -94.5786)),
    Place("Salt Lake City, UT, USA", Coordinate(40.7608, -111.8910)),
    Place("Minneapolis, MN, USA", Coordinate(44.9778, -93.2650)),
    Place("Nashville, TN, USA", Coordinate(36.1627, -86.7816)),
    Place("Houston, TX, USA", Coordinate(29.7604, -95.3698)),
    Place("Phoenix, AZ, USA", Coordinate(33.4484, -112.0740)),
    Place("New York, NY, USA", Coordinate(40.7128, -74.0060)),
)


class StubRoutingProvider:
    name = "stub"

    def __init__(self, simulated_latency_seconds: float = 0.0) -> None:
        self._simulated_latency_seconds = simulated_latency_seconds

    def find_routes(
        self, origin: Coordinate, destination: Coordinate, route_limit: int
    ) -> list[RouteCandidate]:
        _simulate_latency(self._simulated_latency_seconds)
        return [
            self._build_curved_route(origin, destination, bend_ratio, average_speed_mph)
            for bend_ratio, average_speed_mph in STUB_ROUTE_PROFILES[:route_limit]
        ]

    def _build_curved_route(
        self,
        origin: Coordinate,
        destination: Coordinate,
        bend_ratio: float,
        average_speed_mph: float,
    ) -> RouteCandidate:
        direct_distance_kilometers = haversine_miles(origin, destination) * KILOMETERS_PER_MILE
        control_point = destination_coordinate(
            interpolate_coordinate(origin, destination, 0.5),
            initial_bearing_degrees(origin, destination) + RIGHT_ANGLE_DEGREES,
            direct_distance_kilometers * bend_ratio,
        )
        coordinates = tuple(
            _quadratic_bezier(
                origin, control_point, destination, segment_index / STUB_SEGMENTS_PER_ROUTE
            )
            for segment_index in range(STUB_SEGMENTS_PER_ROUTE + 1)
        )
        road_miles = PolylineWalker(coordinates).total_miles * ROAD_WINDING_FACTOR
        duration_seconds = road_miles / average_speed_mph * SECONDS_PER_HOUR
        return RouteCandidate(
            provider_name=self.name,
            coordinates=coordinates,
            distance_miles=road_miles,
            duration_seconds=duration_seconds,
            steps=tuple(
                RouteStep(
                    distance_miles=road_miles / STUB_SEGMENTS_PER_ROUTE,
                    duration_seconds=duration_seconds / STUB_SEGMENTS_PER_ROUTE,
                )
                for _ in range(STUB_SEGMENTS_PER_ROUTE)
            ),
        )


class StubWeatherProvider:
    def __init__(self, simulated_latency_seconds: float = 0.0) -> None:
        self._simulated_latency_seconds = simulated_latency_seconds

    def fetch_hourly_forecasts(
        self, locations: Sequence[Coordinate], window: TimeWindow
    ) -> dict[Coordinate, ForecastSeries]:
        _simulate_latency(self._simulated_latency_seconds)
        hours = window.hourly_moments()
        return {
            location: ForecastSeries(
                first_hour=hours[0],
                hourly_conditions=tuple(synthetic_conditions(location, hour) for hour in hours),
            )
            for location in locations
        }


class StubGeocoder:
    def search(self, query: str, result_limit: int) -> list[Place]:
        normalized_query = query.casefold()
        return [place for place in STUB_PLACES if normalized_query in place.label.casefold()][
            :result_limit
        ]


def synthetic_conditions(location: Coordinate, moment: datetime) -> WeatherConditions:
    hours_since_epoch = moment.timestamp() / SECONDS_PER_HOUR
    storm_phase = (
        0.35 * location.longitude + 0.5 * location.latitude - hours_since_epoch / STORM_PERIOD_HOURS
    )
    storm_intensity = max(0.0, math.sin(storm_phase)) ** 4
    wind_speed_mph = 6.0 + 52.0 * storm_intensity
    precipitation_rate = 1.1 * storm_intensity**1.5
    is_freezing = location.latitude >= FREEZING_LATITUDE_THRESHOLD
    return WeatherConditions(
        wind_speed_mph=round(wind_speed_mph, 1),
        wind_gust_mph=round(wind_speed_mph * 1.35, 1),
        rain_inches_per_hour=0.0 if is_freezing else round(precipitation_rate, 2),
        snowfall_inches_per_hour=round(precipitation_rate * 3, 2) if is_freezing else 0.0,
    )


def _quadratic_bezier(
    start: Coordinate, control: Coordinate, end: Coordinate, progress: float
) -> Coordinate:
    remaining = 1.0 - progress
    return Coordinate(
        latitude=remaining**2 * start.latitude
        + 2 * remaining * progress * control.latitude
        + progress**2 * end.latitude,
        longitude=remaining**2 * start.longitude
        + 2 * remaining * progress * control.longitude
        + progress**2 * end.longitude,
    )


def _simulate_latency(latency_seconds: float) -> None:
    if latency_seconds > 0:
        time.sleep(latency_seconds)
