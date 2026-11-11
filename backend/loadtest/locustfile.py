import random
from datetime import UTC, datetime, timedelta
from typing import Any

from locust import HttpUser, between, task

from loadtest.plan_invariants import find_plan_invariant_violations

TRIP_ENDPOINTS = (
    ((47.6062, -122.3321), (45.5152, -122.6784)),
    ((41.8781, -87.6298), (38.6270, -90.1994)),
    ((32.7767, -96.7970), (39.7392, -104.9903)),
    ((34.0522, -118.2437), (41.8781, -87.6298)),
)
SAMPLING_INTERVALS = (10, 25, 50)
REPEATED_TRIP_LOAD_POUNDS = 42_000
HEATMAP_FORECAST_HOURS = 48
HEATMAP_LINE_POINTS = 50


def next_whole_hour() -> str:
    upcoming = datetime.now(UTC) + timedelta(hours=1)
    return upcoming.replace(minute=0, second=0, microsecond=0).isoformat()


def build_trip_payload(
    origin: tuple[float, float],
    destination: tuple[float, float],
    interval_miles: int,
    load_pounds: float,
) -> dict[str, Any]:
    return {
        "origin": {"latitude": origin[0], "longitude": origin[1]},
        "destination": {"latitude": destination[0], "longitude": destination[1]},
        "departure": next_whole_hour(),
        "load_pounds": round(load_pounds),
        "interval_miles": interval_miles,
    }


def build_straight_line(
    origin: tuple[float, float], destination: tuple[float, float]
) -> list[list[float]]:
    return [
        [
            origin[1] + (destination[1] - origin[1]) * step / (HEATMAP_LINE_POINTS - 1),
            origin[0] + (destination[0] - origin[0]) * step / (HEATMAP_LINE_POINTS - 1),
        ]
        for step in range(HEATMAP_LINE_POINTS)
    ]


class TripPlannerUser(HttpUser):
    wait_time = between(0.5, 2.0)

    @task(5)
    def plan_random_trip(self) -> None:
        origin, destination = random.choice(TRIP_ENDPOINTS)
        payload = build_trip_payload(
            origin,
            destination,
            random.choice(SAMPLING_INTERVALS),
            random.uniform(5_000, 80_000),
        )
        self._plan_trip(payload, request_name="plan [random trip]")

    @task(2)
    def plan_repeated_trip(self) -> None:
        origin, destination = TRIP_ENDPOINTS[1]
        payload = build_trip_payload(origin, destination, 25, REPEATED_TRIP_LOAD_POUNDS)
        self._plan_trip(payload, request_name="plan [repeated trip]")

    @task(1)
    def corridor_heatmap(self) -> None:
        origin, destination = random.choice(TRIP_ENDPOINTS)
        payload = {
            "routes": [build_straight_line(origin, destination)],
            "departure": next_whole_hour(),
            "load_pounds": REPEATED_TRIP_LOAD_POUNDS,
        }
        with self.client.post(
            "/api/trips/heatmap", json=payload, name="heatmap", catch_response=True
        ) as response:
            if response.status_code != 200:
                response.failure(f"HTTP {response.status_code}")
                return
            if len(response.json()["hours"]) != HEATMAP_FORECAST_HOURS + 1:
                response.failure("Heatmap does not cover every forecast hour.")
                return
            response.success()

    def _plan_trip(self, payload: dict[str, Any], request_name: str) -> None:
        with self.client.post(
            "/api/trips/plan", json=payload, name=request_name, catch_response=True
        ) as response:
            if response.status_code != 200:
                response.failure(f"HTTP {response.status_code}")
                return
            violations = find_plan_invariant_violations(response.json())
            if violations:
                response.failure("; ".join(violations))
                return
            response.success()
