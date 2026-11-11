import pytest

from trips.domain.ranking import RouteRanker
from trips.tests.fakes import build_assessed_route

RANKER = RouteRanker()


def test_ranks_by_severe_then_high_then_average_risk() -> None:
    route_a = build_assessed_route(
        "A", severe_miles=25.0, average_risk_score=0.83, duration_minutes=130
    )
    route_b = build_assessed_route(
        "B", high_miles=50.0, average_risk_score=1.4, duration_minutes=160
    )
    route_c = build_assessed_route(
        "C", high_miles=50.0, average_risk_score=1.1, duration_minutes=175
    )

    ranked = RANKER.rank([route_a, route_b, route_c])

    assert [route.route_id for route in ranked] == ["C", "B", "A"]
    assert RANKER.explain_recommendation(ranked) == (
        "Route C recommended: lower average risk than Route B (1.10 vs 1.40)."
    )


def test_no_travel_miles_outrank_severe_miles() -> None:
    blocked_route = build_assessed_route("A", no_travel_miles=20.0)
    severe_route = build_assessed_route("B", severe_miles=10.0)

    ranked = RANKER.rank([blocked_route, severe_route])

    assert ranked[0].route_id == "B"
    assert RANKER.explain_recommendation(ranked) == (
        "Route B recommended: 20.0 fewer No Travel miles than Route A."
    )


def test_fewer_high_miles_beats_lower_average() -> None:
    fewer_high = build_assessed_route("A", high_miles=10.0, average_risk_score=1.5)
    more_high = build_assessed_route("B", high_miles=30.0, average_risk_score=0.5)

    assert RANKER.rank([more_high, fewer_high])[0].route_id == "A"


def test_travel_time_breaks_full_risk_tie() -> None:
    slower = build_assessed_route("A", duration_minutes=150)
    faster = build_assessed_route("B", duration_minutes=120)

    ranked = RANKER.rank([slower, faster])

    assert ranked[0].route_id == "B"
    assert RANKER.explain_preference(ranked[0], ranked[1]) == "30 min faster than Route A"


def test_unknown_average_ranks_after_known_average() -> None:
    unknown = build_assessed_route("A", average_risk_score=None)
    known = build_assessed_route("B", average_risk_score=3.0)

    assert RANKER.rank([unknown, known])[0].route_id == "B"


def test_identical_routes_keep_provider_order() -> None:
    first = build_assessed_route("A")
    second = build_assessed_route("B")

    ranked = RANKER.rank([first, second])

    assert [route.route_id for route in ranked] == ["A", "B"]
    assert "equivalent to Route B" in RANKER.explain_recommendation(ranked)


def test_single_route_explanation() -> None:
    only_route = build_assessed_route("A")

    assert RANKER.explain_recommendation([only_route]) == (
        "Route A is the only route option available."
    )


def test_explanation_requires_routes() -> None:
    with pytest.raises(ValueError, match="without routes"):
        RANKER.explain_recommendation([])
