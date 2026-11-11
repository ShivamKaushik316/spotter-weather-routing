import math
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from trips.domain.models import AssessedRoute, RiskLevel

MILES_COMPARISON_DECIMALS = 1
AVERAGE_RISK_COMPARISON_DECIMALS = 2
SECONDS_PER_MINUTE = 60


class RankingCriterion(Protocol):
    def score(self, route: AssessedRoute) -> float: ...

    def describe_advantage(self, preferred: AssessedRoute, alternative: AssessedRoute) -> str: ...


@dataclass(frozen=True, slots=True)
class MilesAtLevelCriterion:
    level: RiskLevel

    def score(self, route: AssessedRoute) -> float:
        return round(route.summary.miles_at(self.level), MILES_COMPARISON_DECIMALS)

    def describe_advantage(self, preferred: AssessedRoute, alternative: AssessedRoute) -> str:
        miles_avoided = self.score(alternative) - self.score(preferred)
        return (
            f"{miles_avoided:.1f} fewer {self.level.label} miles than Route {alternative.route_id}"
        )


@dataclass(frozen=True, slots=True)
class AverageRiskCriterion:
    def score(self, route: AssessedRoute) -> float:
        average = route.summary.average_risk_score
        return math.inf if average is None else round(average, AVERAGE_RISK_COMPARISON_DECIMALS)

    def describe_advantage(self, preferred: AssessedRoute, alternative: AssessedRoute) -> str:
        return (
            f"lower average risk than Route {alternative.route_id} "
            f"({_format_average(preferred)} vs {_format_average(alternative)})"
        )


@dataclass(frozen=True, slots=True)
class TravelTimeCriterion:
    def score(self, route: AssessedRoute) -> float:
        return round(route.summary.duration_seconds / SECONDS_PER_MINUTE)

    def describe_advantage(self, preferred: AssessedRoute, alternative: AssessedRoute) -> str:
        minutes_saved = int(self.score(alternative) - self.score(preferred))
        return f"{minutes_saved} min faster than Route {alternative.route_id}"


DEFAULT_RANKING_CRITERIA: tuple[RankingCriterion, ...] = (
    MilesAtLevelCriterion(RiskLevel.NO_TRAVEL),
    MilesAtLevelCriterion(RiskLevel.SEVERE),
    MilesAtLevelCriterion(RiskLevel.HIGH),
    AverageRiskCriterion(),
    TravelTimeCriterion(),
)


class RouteRanker:
    def __init__(self, criteria: Sequence[RankingCriterion] = DEFAULT_RANKING_CRITERIA) -> None:
        if not criteria:
            raise ValueError("A route ranker needs at least one criterion.")
        self._criteria = tuple(criteria)

    def sort_key(self, route: AssessedRoute) -> tuple[float, ...]:
        return tuple(criterion.score(route) for criterion in self._criteria)

    def rank(self, routes: Sequence[AssessedRoute]) -> tuple[AssessedRoute, ...]:
        return tuple(sorted(routes, key=self.sort_key))

    def explain_preference(self, preferred: AssessedRoute, alternative: AssessedRoute) -> str:
        for criterion in self._criteria:
            if criterion.score(preferred) < criterion.score(alternative):
                return criterion.describe_advantage(preferred, alternative)
        return f"equivalent to Route {alternative.route_id} on every criterion"

    def explain_recommendation(self, ranked_routes: Sequence[AssessedRoute]) -> str:
        if not ranked_routes:
            raise ValueError("Cannot explain a recommendation without routes.")
        if len(ranked_routes) == 1:
            return f"Route {ranked_routes[0].route_id} is the only route option available."
        recommended, runner_up = ranked_routes[0], ranked_routes[1]
        reason = self.explain_preference(recommended, runner_up)
        return f"Route {recommended.route_id} recommended: {reason}."


def _format_average(route: AssessedRoute) -> str:
    average = route.summary.average_risk_score
    return "unknown" if average is None else f"{average:.2f}"
