from collections.abc import Sequence

from trips.domain.models import RiskAssessment, RiskLevel, WeatherConditions
from trips.domain.risk.rules import RiskRule, RuleOutcome

FORECAST_UNAVAILABLE_REASON = "Forecast unavailable for this place and time"
ALL_CONDITIONS_LOW_REASON = "All conditions within Low thresholds"


class RiskEvaluator:
    def __init__(self, rules: Sequence[RiskRule]) -> None:
        if not rules:
            raise ValueError("A risk evaluator needs at least one rule.")
        self._rules = tuple(rules)

    def evaluate(self, conditions: WeatherConditions | None, load_pounds: float) -> RiskAssessment:
        if conditions is None:
            return RiskAssessment(level=None, reasons=(FORECAST_UNAVAILABLE_REASON,))
        elevated_outcomes = sorted(
            (
                outcome
                for outcome in self._collect_outcomes(conditions, load_pounds)
                if outcome.level > RiskLevel.LOW
            ),
            key=lambda outcome: outcome.level,
            reverse=True,
        )
        if not elevated_outcomes:
            return RiskAssessment(level=RiskLevel.LOW, reasons=(ALL_CONDITIONS_LOW_REASON,))
        return RiskAssessment(
            level=elevated_outcomes[0].level,
            reasons=tuple(outcome.reason for outcome in elevated_outcomes),
        )

    def _collect_outcomes(
        self, conditions: WeatherConditions, load_pounds: float
    ) -> list[RuleOutcome]:
        outcomes = (rule.evaluate(conditions, load_pounds) for rule in self._rules)
        return [outcome for outcome in outcomes if outcome is not None]
