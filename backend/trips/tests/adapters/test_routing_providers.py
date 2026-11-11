import json

import httpx
import pytest
import respx

from core.exceptions import NoRouteFoundError
from core.http import JsonHttpClient, RetryPolicy
from trips.adapters.openrouteservice import (
    OPENROUTESERVICE_BASE_URL,
    OpenRouteServiceGeocoder,
    OpenRouteServiceRoutingProvider,
)
from trips.adapters.osrm import OSRM_PUBLIC_BASE_URL, OsrmRoutingProvider
from trips.domain.models import Coordinate

ORIGIN = Coordinate(39.74, -104.99)
DESTINATION = Coordinate(32.78, -96.80)
SINGLE_ATTEMPT = RetryPolicy(max_attempts=1, initial_backoff_seconds=0.0)
ORS_DIRECTIONS_URL = f"{OPENROUTESERVICE_BASE_URL}/v2/directions/driving-hgv/geojson"


def build_http_client(service_name: str) -> JsonHttpClient:
    return JsonHttpClient(service_name, retry_policy=SINGLE_ATTEMPT)


def ors_feature(distance_miles: float = 780.5) -> dict:
    return {
        "geometry": {"coordinates": [[-104.99, 39.74, 1600.0], [-96.80, 32.78, 140.0]]},
        "properties": {
            "summary": {"distance": distance_miles, "duration": 43_200.0},
            "segments": [
                {
                    "steps": [
                        {"distance": 10.0, "duration": 900.0},
                        {"distance": 770.5, "duration": 42_300.0},
                    ]
                }
            ],
        },
    }


@respx.mock
def test_openrouteservice_parses_geojson_routes() -> None:
    respx.post(ORS_DIRECTIONS_URL).mock(
        return_value=httpx.Response(200, json={"features": [ors_feature(), ors_feature(800.0)]})
    )
    provider = OpenRouteServiceRoutingProvider(build_http_client("openrouteservice"))

    routes = provider.find_routes(ORIGIN, DESTINATION, route_limit=3)

    assert len(routes) == 2
    assert routes[0].coordinates[0] == Coordinate(39.74, -104.99)
    assert routes[0].distance_miles == 780.5
    assert [step.duration_seconds for step in routes[0].steps] == [900.0, 42_300.0]


@respx.mock
def test_openrouteservice_retries_without_alternatives_when_rejected() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        if "alternative_routes" in json.loads(request.content):
            return httpx.Response(400, json={"error": {"code": 2004}})
        return httpx.Response(200, json={"features": [ors_feature()]})

    route = respx.post(ORS_DIRECTIONS_URL).mock(side_effect=respond)
    provider = OpenRouteServiceRoutingProvider(build_http_client("openrouteservice"))

    routes = provider.find_routes(ORIGIN, DESTINATION, route_limit=3)

    assert len(routes) == 1
    assert route.call_count == 2


@respx.mock
def test_openrouteservice_without_features_means_no_route() -> None:
    respx.post(ORS_DIRECTIONS_URL).mock(return_value=httpx.Response(200, json={"features": []}))
    provider = OpenRouteServiceRoutingProvider(build_http_client("openrouteservice"))

    with pytest.raises(NoRouteFoundError):
        provider.find_routes(ORIGIN, DESTINATION, route_limit=1)


@respx.mock
def test_openrouteservice_geocoder_parses_places() -> None:
    respx.get(url__startswith=f"{OPENROUTESERVICE_BASE_URL}/geocode/autocomplete").mock(
        return_value=httpx.Response(
            200,
            json={
                "features": [
                    {
                        "geometry": {"coordinates": [-104.99, 39.74]},
                        "properties": {"label": "Denver, CO, USA"},
                    }
                ]
            },
        )
    )
    geocoder = OpenRouteServiceGeocoder(build_http_client("openrouteservice"))

    places = geocoder.search("Denver", result_limit=5)

    assert places[0].label == "Denver, CO, USA"
    assert places[0].coordinate == Coordinate(39.74, -104.99)


@respx.mock
def test_osrm_converts_meters_to_miles() -> None:
    respx.get(url__startswith=OSRM_PUBLIC_BASE_URL).mock(
        return_value=httpx.Response(
            200,
            json={
                "code": "Ok",
                "routes": [
                    {
                        "distance": 16_093.44,
                        "duration": 720.0,
                        "geometry": {"coordinates": [[-104.99, 39.74], [-104.80, 39.80]]},
                        "legs": [{"steps": [{"distance": 16_093.44, "duration": 720.0}]}],
                    }
                ],
            },
        )
    )
    provider = OsrmRoutingProvider(build_http_client("osrm"))

    routes = provider.find_routes(ORIGIN, DESTINATION, route_limit=3)

    assert routes[0].distance_miles == pytest.approx(10.0)
    assert routes[0].steps[0].distance_miles == pytest.approx(10.0)
    assert routes[0].provider_name == "osrm"


@respx.mock
def test_osrm_no_route_code_raises() -> None:
    respx.get(url__startswith=OSRM_PUBLIC_BASE_URL).mock(
        return_value=httpx.Response(200, json={"code": "NoRoute", "routes": []})
    )
    provider = OsrmRoutingProvider(build_http_client("osrm"))

    with pytest.raises(NoRouteFoundError):
        provider.find_routes(ORIGIN, DESTINATION, route_limit=1)
