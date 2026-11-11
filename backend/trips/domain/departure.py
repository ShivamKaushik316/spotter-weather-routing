from dataclasses import dataclass
from datetime import datetime

from trips.domain.models import AssessedRoute, RiskLevel, RouteRiskSummary

COMPARED_LEVELS = (RiskLevel.NO_TRAVEL, RiskLevel.SEVERE, RiskLevel.HIGH)
UNCHANGED_RISK_DESCRIPTION = "Same risk profile as the planned departure"


@dataclass(frozen=True, slots=True)
class DepartureOption:
    departure: datetime
    delay_hours: int
    best_route: AssessedRoute
    change_from_baseline: str


@dataclass(frozen=True, slots=True)
class DepartureWindowPlan:
    baseline: DepartureOption
    ranked_options: tuple[DepartureOption, ...]

    @property
    def recommended_option(self) -> DepartureOption:
        return self.ranked_options[0]


def describe_risk_change(baseline: RouteRiskSummary, candidate: RouteRiskSummary) -> str:
    level_changes = [
        f"{level.label} miles {baseline.miles_at(level):.1f} → {candidate.miles_at(level):.1f}"
        for level in COMPARED_LEVELS
        if round(baseline.miles_at(level), 1) != round(candidate.miles_at(level), 1)
    ]
    if level_changes:
        return "; ".join(level_changes)
    baseline_average = baseline.average_risk_score
    candidate_average = candidate.average_risk_score
    if (
        baseline_average is not None
        and candidate_average is not None
        and round(baseline_average, 2) != round(candidate_average, 2)
    ):
        return f"Average risk {baseline_average:.2f} → {candidate_average:.2f}"
    return UNCHANGED_RISK_DESCRIPTION
