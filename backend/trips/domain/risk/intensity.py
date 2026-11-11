from collections.abc import Mapping
from dataclasses import dataclass

from trips.domain.models import RiskLevel, WeatherConditions
from trips.domain.risk.rules import FACTOR_DESCRIPTIONS, WeatherFactor

HEAT_DECIMALS = 3


@dataclass(frozen=True, slots=True)
class WeatherIntensityScale:
    no_travel_limits: Mapping[WeatherFactor, float]

    def intensity(self, conditions: WeatherConditions) -> float:
        ratios = [
            FACTOR_DESCRIPTIONS[factor].read_value(conditions) / limit
            for factor, limit in self.no_travel_limits.items()
            if limit > 0
        ]
        return min(1.0, max(ratios, default=0.0))

    def heat_value(
        self, conditions: WeatherConditions | None, level: RiskLevel | None
    ) -> float | None:
        if conditions is None or level is None:
            return None
        level_floor = int(level) / int(RiskLevel.NO_TRAVEL)
        return round(max(self.intensity(conditions), level_floor), HEAT_DECIMALS)
