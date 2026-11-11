import pytest

from trips.domain.models import RiskLevel
from trips.domain.risk.config import build_risk_evaluator
from trips.domain.risk.thresholds import SeverityThresholds
from trips.tests.fakes import LIGHT_LOAD_POUNDS, build_weather

RISK_EVALUATOR = build_risk_evaluator()


@pytest.mark.parametrize(
    ("wind_speed_mph", "expected_level"),
    [
        (0.0, RiskLevel.LOW),
        (24.99, RiskLevel.LOW),
        (25.0, RiskLevel.MODERATE),
        (34.99, RiskLevel.MODERATE),
        (35.0, RiskLevel.HIGH),
        (44.99, RiskLevel.HIGH),
        (45.0, RiskLevel.SEVERE),
        (54.99, RiskLevel.SEVERE),
        (55.0, RiskLevel.NO_TRAVEL),
        (90.0, RiskLevel.NO_TRAVEL),
    ],
)
def test_wind_thresholds(wind_speed_mph: float, expected_level: RiskLevel) -> None:
    assessment = RISK_EVALUATOR.evaluate(
        build_weather(wind_speed_mph=wind_speed_mph), LIGHT_LOAD_POUNDS
    )

    assert assessment.level is expected_level


@pytest.mark.parametrize(
    ("rain_inches_per_hour", "expected_level"),
    [
        (0.0, RiskLevel.LOW),
        (0.0999, RiskLevel.LOW),
        (0.10, RiskLevel.MODERATE),
        (0.2499, RiskLevel.MODERATE),
        (0.25, RiskLevel.HIGH),
        (0.4999, RiskLevel.HIGH),
        (0.50, RiskLevel.SEVERE),
        (1.00, RiskLevel.SEVERE),
        (1.0001, RiskLevel.NO_TRAVEL),
    ],
)
def test_rain_thresholds(rain_inches_per_hour: float, expected_level: RiskLevel) -> None:
    assessment = RISK_EVALUATOR.evaluate(
        build_weather(rain_inches_per_hour=rain_inches_per_hour), LIGHT_LOAD_POUNDS
    )

    assert assessment.level is expected_level


@pytest.mark.parametrize(
    ("snowfall_inches_per_hour", "expected_level"),
    [
        (0.0, RiskLevel.LOW),
        (0.49, RiskLevel.LOW),
        (0.5, RiskLevel.MODERATE),
        (0.99, RiskLevel.MODERATE),
        (1.0, RiskLevel.HIGH),
        (1.99, RiskLevel.HIGH),
        (2.0, RiskLevel.SEVERE),
        (3.0, RiskLevel.SEVERE),
        (3.01, RiskLevel.NO_TRAVEL),
    ],
)
def test_snow_thresholds(snowfall_inches_per_hour: float, expected_level: RiskLevel) -> None:
    assessment = RISK_EVALUATOR.evaluate(
        build_weather(snowfall_inches_per_hour=snowfall_inches_per_hour), LIGHT_LOAD_POUNDS
    )

    assert assessment.level is expected_level


def test_thresholds_must_be_ascending() -> None:
    with pytest.raises(ValueError, match="ascending"):
        SeverityThresholds(
            moderate_from=10,
            high_from=5,
            severe_from=20,
            no_travel_from=30,
            no_travel_includes_boundary=True,
        )
