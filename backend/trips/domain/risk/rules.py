from collections.abc import Callable, Mapping
from dataclasses import dataclass
from enum import StrEnum
from types import MappingProxyType
from typing import Protocol

from trips.domain.models import RiskLevel, WeatherConditions
from trips.domain.risk.thresholds import SeverityThresholds


class WeatherFactor(StrEnum):
    WIND = "wind"
    RAIN = "rain"
    SNOW = "snow"


@dataclass(frozen=True, slots=True)
class FactorDescription:
    label: str
    unit: str
    display_decimals: int
    read_value: Callable[[WeatherConditions], float]

    def describe(self, measured_value: float) -> str:
        return f"{self.label} {measured_value:.{self.display_decimals}f} {self.unit}"


FACTOR_DESCRIPTIONS: Mapping[WeatherFactor, FactorDescription] = MappingProxyType(
    {
        WeatherFactor.WIND: FactorDescription(
            label="Wind",
            unit="mph",
            display_decimals=1,
            read_value=lambda conditions: conditions.wind_speed_mph,
        ),
        WeatherFactor.RAIN: FactorDescription(
            label="Rain",
            unit="in/hr",
            display_decimals=2,
            read_value=lambda conditions: conditions.rain_inches_per_hour,
        ),
        WeatherFactor.SNOW: FactorDescription(
            label="Snow",
            unit="in/hr",
            display_decimals=2,
            read_value=lambda conditions: conditions.snowfall_inches_per_hour,
        ),
    }
)


@dataclass(frozen=True, slots=True)
class RuleOutcome:
    level: RiskLevel
    reason: str


class RiskRule(Protocol):
    def evaluate(self, conditions: WeatherConditions, load_pounds: float) -> RuleOutcome | None: ...


@dataclass(frozen=True, slots=True)
class ThresholdRule:
    factor: WeatherFactor
    thresholds: SeverityThresholds

    def evaluate(self, conditions: WeatherConditions, load_pounds: float) -> RuleOutcome:
        description = FACTOR_DESCRIPTIONS[self.factor]
        measured_value = description.read_value(conditions)
        level = self.thresholds.classify(measured_value)
        return RuleOutcome(
            level=level, reason=f"{description.describe(measured_value)} → {level.label}"
        )


@dataclass(frozen=True, slots=True)
class LoadEscalation:
    wind_from_mph: float
    wind_below_mph: float
    load_above_pounds: float
    escalated_level: RiskLevel

    def applies_to(self, wind_speed_mph: float, load_pounds: float) -> bool:
        return (
            self.wind_from_mph <= wind_speed_mph < self.wind_below_mph
            and load_pounds > self.load_above_pounds
        )


@dataclass(frozen=True, slots=True)
class LoadSensitiveWindRule:
    escalations: tuple[LoadEscalation, ...]

    def evaluate(self, conditions: WeatherConditions, load_pounds: float) -> RuleOutcome | None:
        wind_speed_mph = conditions.wind_speed_mph
        escalated_levels = [
            escalation.escalated_level
            for escalation in self.escalations
            if escalation.applies_to(wind_speed_mph, load_pounds)
        ]
        if not escalated_levels:
            return None
        level = max(escalated_levels)
        wind_description = FACTOR_DESCRIPTIONS[WeatherFactor.WIND].describe(wind_speed_mph)
        return RuleOutcome(
            level=level,
            reason=f"{wind_description} with {load_pounds:,.0f} lb load → {level.label}",
        )
