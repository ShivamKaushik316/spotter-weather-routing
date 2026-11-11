from datetime import timedelta

import pytest

from trips.domain.assessment import RouteAssessor, summarize_route
from trips.domain.models import (
    Checkpoint,
    Coordinate,
    RiskAssessment,
    RiskLevel,
    SampledPoint,
)
from trips.domain.risk.config import build_risk_evaluator
from trips.domain.sampling import CheckpointSampler
from trips.tests.fakes import FIXED_DEPARTURE, build_straight_route, build_weather

ROUTE = build_straight_route(Coordinate(35.0, -100.0), Coordinate(35.0, -99.0), distance_miles=50)


def build_checkpoint(represented_miles: float, level: RiskLevel | None) -> Checkpoint:
    return Checkpoint(
        position=SampledPoint(
            sequence=0,
            coordinate=Coordinate(35.0, -100.0),
            distance_from_origin_miles=0.0,
            represented_miles=represented_miles,
            estimated_arrival=FIXED_DEPARTURE,
        ),
        conditions=None,
        risk=RiskAssessment(level=level, reasons=()),
    )


def test_summary_counts_miles_per_level_and_weighted_average() -> None:
    checkpoints = [
        build_checkpoint(12.5, RiskLevel.MODERATE),
        build_checkpoint(25.0, RiskLevel.HIGH),
        build_checkpoint(12.5, RiskLevel.SEVERE),
    ]

    summary = summarize_route(ROUTE, checkpoints)

    assert summary.miles_at(RiskLevel.MODERATE) == 12.5
    assert summary.miles_at(RiskLevel.HIGH) == 25.0
    assert summary.miles_at(RiskLevel.SEVERE) == 12.5
    assert summary.average_risk_score == pytest.approx(2.0)
    assert summary.highest_level is RiskLevel.SEVERE


def test_unknown_miles_are_excluded_from_average() -> None:
    checkpoints = [build_checkpoint(30.0, RiskLevel.HIGH), build_checkpoint(20.0, None)]

    summary = summarize_route(ROUTE, checkpoints)

    assert summary.unknown_miles == 20.0
    assert summary.average_risk_score == pytest.approx(2.0)


def test_fully_unknown_route_has_no_average() -> None:
    summary = summarize_route(ROUTE, [build_checkpoint(50.0, None)])

    assert summary.average_risk_score is None
    assert summary.highest_level is None


class StormAfterHalfHour:
    def conditions_at(self, coordinate, moment):
        if moment > FIXED_DEPARTURE + timedelta(minutes=30):
            return build_weather(wind_speed_mph=50.0)
        return build_weather()


def test_assessor_reads_weather_at_each_checkpoint_eta() -> None:
    sampled_points = CheckpointSampler().sample(ROUTE, FIXED_DEPARTURE, 25.0)
    assessor = RouteAssessor(build_risk_evaluator())

    assessed = assessor.assess("A", ROUTE, sampled_points, 10_000.0, StormAfterHalfHour())

    assert [checkpoint.risk.level for checkpoint in assessed.checkpoints] == [
        RiskLevel.LOW,
        RiskLevel.LOW,
        RiskLevel.SEVERE,
    ]
