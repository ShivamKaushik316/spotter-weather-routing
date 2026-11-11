from collections.abc import Sequence
from datetime import datetime
from types import MappingProxyType
from typing import Protocol

from trips.domain.models import (
    AssessedRoute,
    Checkpoint,
    Coordinate,
    RiskLevel,
    RouteCandidate,
    RouteRiskSummary,
    SampledPoint,
    WeatherConditions,
)
from trips.domain.risk.evaluator import RiskEvaluator


class ConditionsSource(Protocol):
    def conditions_at(
        self, coordinate: Coordinate, moment: datetime
    ) -> WeatherConditions | None: ...


class RouteAssessor:
    def __init__(self, risk_evaluator: RiskEvaluator) -> None:
        self._risk_evaluator = risk_evaluator

    def assess(
        self,
        route_id: str,
        candidate: RouteCandidate,
        sampled_points: Sequence[SampledPoint],
        load_pounds: float,
        conditions_source: ConditionsSource,
    ) -> AssessedRoute:
        checkpoints = tuple(
            self._assess_point(point, load_pounds, conditions_source) for point in sampled_points
        )
        return AssessedRoute(
            route_id=route_id,
            candidate=candidate,
            checkpoints=checkpoints,
            summary=summarize_route(candidate, checkpoints),
        )

    def _assess_point(
        self, point: SampledPoint, load_pounds: float, conditions_source: ConditionsSource
    ) -> Checkpoint:
        conditions = conditions_source.conditions_at(point.coordinate, point.estimated_arrival)
        return Checkpoint(
            position=point,
            conditions=conditions,
            risk=self._risk_evaluator.evaluate(conditions, load_pounds),
        )


def summarize_route(
    candidate: RouteCandidate, checkpoints: Sequence[Checkpoint]
) -> RouteRiskSummary:
    miles_by_level = dict.fromkeys(RiskLevel, 0.0)
    unknown_miles = 0.0
    weighted_risk_total = 0.0
    for checkpoint in checkpoints:
        level = checkpoint.risk.level
        segment_miles = checkpoint.position.represented_miles
        if level is None:
            unknown_miles += segment_miles
            continue
        miles_by_level[level] += segment_miles
        weighted_risk_total += int(level) * segment_miles
    known_miles = sum(miles_by_level.values())
    known_levels = [
        checkpoint.risk.level for checkpoint in checkpoints if checkpoint.risk.level is not None
    ]
    return RouteRiskSummary(
        distance_miles=candidate.distance_miles,
        duration_seconds=candidate.duration_seconds,
        miles_by_level=MappingProxyType(miles_by_level),
        unknown_miles=unknown_miles,
        average_risk_score=weighted_risk_total / known_miles if known_miles > 0 else None,
        highest_level=max(known_levels, default=None),
    )
