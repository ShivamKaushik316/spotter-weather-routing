import pytest

from trips.domain.models import RiskLevel
from trips.domain.risk.config import build_risk_evaluator
from trips.domain.risk.evaluator import (
    ALL_CONDITIONS_LOW_REASON,
    FORECAST_UNAVAILABLE_REASON,
    RiskEvaluator,
)
from trips.tests.fakes import LIGHT_LOAD_POUNDS, build_weather

RISK_EVALUATOR = build_risk_evaluator()


@pytest.mark.parametrize(
    ("wind_speed_mph", "load_pounds", "expected_level"),
    [
        (55.0, 0.0, RiskLevel.NO_TRAVEL),
        (45.0, 30_000.0, RiskLevel.SEVERE),
        (45.0, 30_001.0, RiskLevel.NO_TRAVEL),
        (54.9, 35_000.0, RiskLevel.NO_TRAVEL),
        (35.0, 40_000.0, RiskLevel.HIGH),
        (35.0, 40_001.0, RiskLevel.SEVERE),
        (44.9, 45_000.0, RiskLevel.SEVERE),
        (40.0, 35_000.0, RiskLevel.HIGH),
        (34.9, 80_000.0, RiskLevel.MODERATE),
    ],
)
def test_load_rules_escalate_wind_risk(
    wind_speed_mph: float, load_pounds: float, expected_level: RiskLevel
) -> None:
    assessment = RISK_EVALUATOR.evaluate(build_weather(wind_speed_mph=wind_speed_mph), load_pounds)

    assert assessment.level is expected_level


def test_checkpoint_level_is_worst_factor() -> None:
    assessment = RISK_EVALUATOR.evaluate(
        build_weather(wind_speed_mph=30.0, rain_inches_per_hour=0.3), LIGHT_LOAD_POUNDS
    )

    assert assessment.level is RiskLevel.HIGH
    assert assessment.reasons == ("Rain 0.30 in/hr → High", "Wind 30.0 mph → Moderate")


def test_load_rule_reason_mentions_load() -> None:
    assessment = RISK_EVALUATOR.evaluate(build_weather(wind_speed_mph=38.0), 42_000.0)

    assert assessment.level is RiskLevel.SEVERE
    assert assessment.reasons[0] == "Wind 38.0 mph with 42,000 lb load → Severe"


def test_calm_conditions_are_low_with_explanation() -> None:
    assessment = RISK_EVALUATOR.evaluate(build_weather(), LIGHT_LOAD_POUNDS)

    assert assessment.level is RiskLevel.LOW
    assert assessment.reasons == (ALL_CONDITIONS_LOW_REASON,)


def test_missing_forecast_is_unknown() -> None:
    assessment = RISK_EVALUATOR.evaluate(None, LIGHT_LOAD_POUNDS)

    assert assessment.level is None
    assert not assessment.is_known
    assert assessment.reasons == (FORECAST_UNAVAILABLE_REASON,)


def test_evaluator_requires_rules() -> None:
    with pytest.raises(ValueError, match="at least one rule"):
        RiskEvaluator([])


def test_custom_config_changes_thresholds() -> None:
    stricter_config = {
        "thresholds": {
            "wind": {
                "moderate_from": 10,
                "high_from": 20,
                "severe_from": 30,
                "no_travel_from": 40,
                "no_travel_includes_boundary": True,
            }
        },
        "load_escalations": [],
    }
    stricter_evaluator = build_risk_evaluator(stricter_config)

    assessment = stricter_evaluator.evaluate(build_weather(wind_speed_mph=20.0), 0.0)

    assert assessment.level is RiskLevel.HIGH
