from dataclasses import dataclass

from trips.domain.models import RiskLevel


@dataclass(frozen=True, slots=True)
class SeverityThresholds:
    moderate_from: float
    high_from: float
    severe_from: float
    no_travel_from: float
    no_travel_includes_boundary: bool

    def __post_init__(self) -> None:
        if not self.moderate_from < self.high_from < self.severe_from <= self.no_travel_from:
            raise ValueError("Severity thresholds must be in ascending order.")

    def classify(self, measured_value: float) -> RiskLevel:
        if self._reaches_no_travel(measured_value):
            return RiskLevel.NO_TRAVEL
        if measured_value >= self.severe_from:
            return RiskLevel.SEVERE
        if measured_value >= self.high_from:
            return RiskLevel.HIGH
        if measured_value >= self.moderate_from:
            return RiskLevel.MODERATE
        return RiskLevel.LOW

    def _reaches_no_travel(self, measured_value: float) -> bool:
        if self.no_travel_includes_boundary:
            return measured_value >= self.no_travel_from
        return measured_value > self.no_travel_from
