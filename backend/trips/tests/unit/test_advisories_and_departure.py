from dataclasses import replace

from trips.domain.advisories import EVERY_ROUTE_BLOCKED_WARNING, collect_trip_warnings
from trips.domain.departure import UNCHANGED_RISK_DESCRIPTION, describe_risk_change
from trips.tests.fakes import build_assessed_route


def test_warns_when_fewer_routes_than_requested() -> None:
    warnings = collect_trip_warnings([build_assessed_route("A")], requested_route_count=3)

    assert warnings == ("Only 1 distinct route(s) found; 3 were requested.",)


def test_warns_about_no_travel_and_blocked_trip() -> None:
    routes = [
        build_assessed_route("A", no_travel_miles=12.5),
        build_assessed_route("B", no_travel_miles=5.0),
    ]

    warnings = collect_trip_warnings(routes, requested_route_count=2)

    assert "Route A crosses 12.5 mi of No Travel conditions." in warnings
    assert warnings[-1] == EVERY_ROUTE_BLOCKED_WARNING


def test_warns_about_unknown_forecast_miles() -> None:
    route = build_assessed_route("A")
    route_with_gap = replace(route, summary=replace(route.summary, unknown_miles=7.5))

    warnings = collect_trip_warnings([route_with_gap], requested_route_count=1)

    assert warnings == ("Route A: forecast unavailable for 7.5 mi.",)


def test_risk_change_lists_changed_levels() -> None:
    baseline = build_assessed_route("A", severe_miles=40.0, high_miles=10.0).summary
    delayed = build_assessed_route("A", severe_miles=0.0, high_miles=10.0).summary

    assert describe_risk_change(baseline, delayed) == "Severe miles 40.0 → 0.0"


def test_risk_change_falls_back_to_average_then_unchanged() -> None:
    baseline = build_assessed_route("A", average_risk_score=1.2).summary
    calmer = build_assessed_route("A", average_risk_score=0.4).summary

    assert describe_risk_change(baseline, calmer) == "Average risk 1.20 → 0.40"
    assert describe_risk_change(baseline, baseline) == UNCHANGED_RISK_DESCRIPTION
