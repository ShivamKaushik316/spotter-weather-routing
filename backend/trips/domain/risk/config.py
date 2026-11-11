from collections.abc import Mapping
from typing import Any

from trips.domain.models import RiskLevel
from trips.domain.risk.evaluator import RiskEvaluator
from trips.domain.risk.intensity import WeatherIntensityScale
from trips.domain.risk.rules import (
    LoadEscalation,
    LoadSensitiveWindRule,
    RiskRule,
    ThresholdRule,
    WeatherFactor,
)
from trips.domain.risk.thresholds import SeverityThresholds

DEFAULT_RISK_RULES_CONFIG: Mapping[str, Any] = {
    "thresholds": {
        "wind": {
            "moderate_from": 25,
            "high_from": 35,
            "severe_from": 45,
            "no_travel_from": 55,
            "no_travel_includes_boundary": True,
        },
        "rain": {
            "moderate_from": 0.10,
            "high_from": 0.25,
            "severe_from": 0.50,
            "no_travel_from": 1.00,
            "no_travel_includes_boundary": False,
        },
        "snow": {
            "moderate_from": 0.5,
            "high_from": 1.0,
            "severe_from": 2.0,
            "no_travel_from": 3.0,
            "no_travel_includes_boundary": False,
        },
    },
    "load_escalations": [
        {
            "wind_from_mph": 45,
            "wind_below_mph": 55,
            "load_above_pounds": 30_000,
            "escalated_level": "NO_TRAVEL",
        },
        {
            "wind_from_mph": 35,
            "wind_below_mph": 45,
            "load_above_pounds": 40_000,
            "escalated_level": "SEVERE",
        },
    ],
}


def build_risk_evaluator(config: Mapping[str, Any] = DEFAULT_RISK_RULES_CONFIG) -> RiskEvaluator:
    rules: list[RiskRule] = [
        ThresholdRule(factor=WeatherFactor(factor_name), thresholds=_build_thresholds(values))
        for factor_name, values in config["thresholds"].items()
    ]
    rules.append(
        LoadSensitiveWindRule(
            escalations=tuple(_build_escalation(item) for item in config["load_escalations"])
        )
    )
    return RiskEvaluator(rules)


def build_weather_intensity_scale(
    config: Mapping[str, Any] = DEFAULT_RISK_RULES_CONFIG,
) -> WeatherIntensityScale:
    return WeatherIntensityScale(
        no_travel_limits={
            WeatherFactor(factor_name): float(values["no_travel_from"])
            for factor_name, values in config["thresholds"].items()
        }
    )


def _build_thresholds(values: Mapping[str, Any]) -> SeverityThresholds:
    return SeverityThresholds(
        moderate_from=float(values["moderate_from"]),
        high_from=float(values["high_from"]),
        severe_from=float(values["severe_from"]),
        no_travel_from=float(values["no_travel_from"]),
        no_travel_includes_boundary=bool(values["no_travel_includes_boundary"]),
    )


def _build_escalation(item: Mapping[str, Any]) -> LoadEscalation:
    return LoadEscalation(
        wind_from_mph=float(item["wind_from_mph"]),
        wind_below_mph=float(item["wind_below_mph"]),
        load_above_pounds=float(item["load_above_pounds"]),
        escalated_level=RiskLevel[item["escalated_level"]],
    )
