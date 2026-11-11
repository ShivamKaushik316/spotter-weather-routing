from collections.abc import Mapping
from datetime import datetime, timedelta
from itertools import pairwise
from typing import Any

EXPECTED_ROUTE_COUNT = 3
ETA_TOLERANCE_SECONDS = 2.0
BASE_MILES_TOLERANCE = 0.2
ROUNDING_TOLERANCE_PER_CHECKPOINT = 0.01


def find_plan_invariant_violations(
    plan: Mapping[str, Any], expected_route_count: int = EXPECTED_ROUTE_COUNT
) -> list[str]:
    routes = plan.get("routes", [])
    violations: list[str] = []
    if len(routes) != expected_route_count:
        violations.append(f"Expected {expected_route_count} routes, received {len(routes)}.")
    if routes and plan.get("recommended_route_id") != routes[0]["route_id"]:
        violations.append("Recommended route is not ranked first.")
    departure = datetime.fromisoformat(plan["departure"])
    for route in routes:
        violations.extend(_route_violations(route, departure))
    return violations


def _route_violations(route: Mapping[str, Any], departure: datetime) -> list[str]:
    route_id = route["route_id"]
    checkpoints = route["checkpoints"]
    summary = route["summary"]
    violations: list[str] = []
    if not checkpoints:
        return [f"Route {route_id} has no checkpoints."]
    if checkpoints[0]["distance_from_origin_miles"] != 0:
        violations.append(f"Route {route_id} does not start sampling at the origin.")
    represented_total = sum(checkpoint["represented_miles"] for checkpoint in checkpoints)
    miles_tolerance = BASE_MILES_TOLERANCE + ROUNDING_TOLERANCE_PER_CHECKPOINT * len(checkpoints)
    if abs(represented_total - summary["distance_miles"]) > miles_tolerance:
        violations.append(
            f"Route {route_id} represented miles {represented_total:.2f} "
            f"differ from distance {summary['distance_miles']:.2f}."
        )
    arrivals = [
        datetime.fromisoformat(checkpoint["estimated_arrival"]) for checkpoint in checkpoints
    ]
    if any(later < earlier for earlier, later in pairwise(arrivals)):
        violations.append(f"Route {route_id} checkpoint ETAs are not in order.")
    expected_final_arrival = departure + timedelta(seconds=summary["duration_seconds"])
    if abs((arrivals[-1] - expected_final_arrival).total_seconds()) > ETA_TOLERANCE_SECONDS:
        violations.append(f"Route {route_id} final ETA does not match route duration.")
    return violations
