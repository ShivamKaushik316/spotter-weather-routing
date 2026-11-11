from collections.abc import Sequence

from trips.domain.models import AssessedRoute, RiskLevel

EVERY_ROUTE_BLOCKED_WARNING = (
    "Every route includes No Travel conditions. Consider delaying departure."
)


def collect_trip_warnings(
    ranked_routes: Sequence[AssessedRoute], requested_route_count: int
) -> tuple[str, ...]:
    warnings: list[str] = []
    if len(ranked_routes) < requested_route_count:
        warnings.append(
            f"Only {len(ranked_routes)} distinct route(s) found; "
            f"{requested_route_count} were requested."
        )
    for route in ranked_routes:
        no_travel_miles = route.summary.miles_at(RiskLevel.NO_TRAVEL)
        if no_travel_miles > 0:
            warnings.append(
                f"Route {route.route_id} crosses {no_travel_miles:.1f} mi of No Travel conditions."
            )
        if route.summary.unknown_miles > 0:
            warnings.append(
                f"Route {route.route_id}: forecast unavailable for "
                f"{route.summary.unknown_miles:.1f} mi."
            )
    if ranked_routes and all(
        route.summary.miles_at(RiskLevel.NO_TRAVEL) > 0 for route in ranked_routes
    ):
        warnings.append(EVERY_ROUTE_BLOCKED_WARNING)
    return tuple(warnings)
