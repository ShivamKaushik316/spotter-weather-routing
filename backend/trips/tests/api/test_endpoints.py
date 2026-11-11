from datetime import timedelta
from types import SimpleNamespace

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from core.exceptions import NoRouteFoundError, UpstreamServiceError
from loadtest.plan_invariants import find_plan_invariant_violations
from trips.application.plan_trip import PlanTripService
from trips.domain.ranking import RouteRanker
from trips.tests.fakes import (
    FakeRoutingProvider,
    FakeWeatherProvider,
    build_route_evaluator,
    build_weather,
    constant_weather,
)

DENVER = {"latitude": 39.7392, "longitude": -104.9903}
DALLAS = {"latitude": 32.7767, "longitude": -96.7970}


@pytest.fixture(autouse=True)
def clear_cache() -> None:
    cache.clear()


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


def upcoming_departure() -> str:
    return (timezone.now() + timedelta(hours=2)).isoformat()


def trip_payload(**overrides) -> dict:
    return {
        "origin": DENVER,
        "destination": DALLAS,
        "departure": upcoming_departure(),
        "load_pounds": 42_000,
        "interval_miles": 25,
        **overrides,
    }


def replace_plan_service(monkeypatch: pytest.MonkeyPatch, routing_error: Exception) -> None:
    plan_trip_service = PlanTripService(
        FakeRoutingProvider(error=routing_error),
        build_route_evaluator(FakeWeatherProvider(constant_weather(build_weather()))),
        RouteRanker(),
    )
    monkeypatch.setattr(
        "trips.api.views.get_container",
        lambda: SimpleNamespace(plan_trip_service=plan_trip_service),
    )


def test_health(api_client: APIClient) -> None:
    response = api_client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_plan_trip_returns_ranked_routes_with_meta(api_client: APIClient) -> None:
    response = api_client.post("/api/trips/plan", trip_payload(), format="json")

    body = response.json()
    assert response.status_code == 200
    assert find_plan_invariant_violations(body) == []
    assert body["recommended_route_id"] == body["routes"][0]["route_id"]
    assert body["routes"][0]["geometry"]["type"] == "LineString"
    assert set(body["routes"][0]["summary"]["miles_by_level"]) == {
        "Low",
        "Moderate",
        "High",
        "Severe",
        "No Travel",
    }
    assert body["meta"]["labels"]["routing_providers"] == ["stub"]
    assert "total" in body["meta"]["timings_ms"]
    assert body["meta"]["request_id"] == response["X-Request-ID"]


def test_checkpoint_payload_shape(api_client: APIClient) -> None:
    response = api_client.post("/api/trips/plan", trip_payload(), format="json")

    checkpoint = response.json()["routes"][0]["checkpoints"][0]
    assert set(checkpoint) == {
        "sequence",
        "latitude",
        "longitude",
        "distance_from_origin_miles",
        "represented_miles",
        "estimated_arrival",
        "weather",
        "risk_level",
        "risk_score",
        "risk_reasons",
    }


def test_repeated_plan_hits_weather_cache(api_client: APIClient) -> None:
    payload = trip_payload()

    api_client.post("/api/trips/plan", payload, format="json")
    second_response = api_client.post("/api/trips/plan", payload, format="json")

    counters = second_response.json()["meta"]["counters"]
    assert counters["weather_cache_misses"] == 0
    assert counters["weather_cache_hits"] > 0


def test_incoming_request_id_is_echoed(api_client: APIClient) -> None:
    response = api_client.get("/api/health", HTTP_X_REQUEST_ID="trace-123")

    assert response["X-Request-ID"] == "trace-123"


@pytest.mark.parametrize(
    ("overrides", "invalid_field"),
    [
        ({"load_pounds": -1}, "load_pounds"),
        ({"load_pounds": 90_000}, "load_pounds"),
        ({"interval_miles": 15}, "interval_miles"),
        ({"departure": "2020-01-01T00:00:00Z"}, "departure"),
        ({"destination": DENVER}, "destination"),
        ({"origin": {"latitude": 120, "longitude": 0}}, "origin"),
    ],
)
def test_invalid_trip_requests_are_rejected(
    api_client: APIClient, overrides: dict, invalid_field: str
) -> None:
    response = api_client.post("/api/trips/plan", trip_payload(**overrides), format="json")

    error = response.json()["error"]
    assert response.status_code == 400
    assert error["code"] == "invalid_request"
    assert invalid_field in error["details"]


def test_upstream_failure_maps_to_bad_gateway(
    api_client: APIClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    replace_plan_service(monkeypatch, UpstreamServiceError("routing", "timeout"))

    response = api_client.post("/api/trips/plan", trip_payload(), format="json")

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "upstream_service_error"
    assert "timeout" not in response.json()["error"]["message"]


def test_missing_route_maps_to_unprocessable(
    api_client: APIClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    replace_plan_service(monkeypatch, NoRouteFoundError("No drivable route."))

    response = api_client.post("/api/trips/plan", trip_payload(), format="json")

    assert response.status_code == 422
    assert response.json()["error"] == {"code": "no_route_found", "message": "No drivable route."}


def test_departure_window(api_client: APIClient) -> None:
    response = api_client.post(
        "/api/trips/departure-window",
        trip_payload(window_hours=3, option_limit=5),
        format="json",
    )

    body = response.json()
    assert response.status_code == 200
    assert body["baseline"]["delay_hours"] == 0
    assert len(body["options"]) == 4
    assert body["recommended_option"] == body["options"][0]


def test_corridor_heatmap(api_client: APIClient) -> None:
    payload = {
        "routes": [[[-104.99, 39.74], [-100.0, 36.0], [-96.80, 32.78]]],
        "departure": upcoming_departure(),
        "load_pounds": 42_000,
    }

    response = api_client.post("/api/trips/heatmap", payload, format="json")

    body = response.json()
    assert response.status_code == 200
    assert body["type"] == "FeatureCollection"
    assert len(body["hours"]) == 49
    assert len(body["features"][0]["properties"]) == 49


@pytest.mark.parametrize(
    "routes",
    [[], [[[-104.99, 39.74]]], [[[-104.99, 39.74], ["x", 1]]], [[[500, 39.74], [-96.8, 32.7]]]],
)
def test_invalid_heatmap_routes_are_rejected(api_client: APIClient, routes: list) -> None:
    payload = {"routes": routes, "departure": upcoming_departure(), "load_pounds": 1_000}

    response = api_client.post("/api/trips/heatmap", payload, format="json")

    assert response.status_code == 400
    assert "routes" in response.json()["error"]["details"]


def test_geocode_with_stub_provider(api_client: APIClient) -> None:
    response = api_client.get("/api/geocode", {"query": "den"})

    results = response.json()["results"]
    assert response.status_code == 200
    assert results[0]["label"] == "Denver, CO, USA"


def test_geocode_requires_query(api_client: APIClient) -> None:
    response = api_client.get("/api/geocode", {"query": "d"})

    assert response.status_code == 400


def test_openapi_schema_is_generated(api_client: APIClient) -> None:
    response = api_client.get("/api/schema", HTTP_ACCEPT="application/json")

    assert response.status_code == 200
