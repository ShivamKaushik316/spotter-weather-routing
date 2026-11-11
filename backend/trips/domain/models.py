from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, replace
from datetime import datetime
from enum import IntEnum, StrEnum


class RiskLevel(IntEnum):
    LOW = 0
    MODERATE = 1
    HIGH = 2
    SEVERE = 3
    NO_TRAVEL = 4

    @property
    def label(self) -> str:
        return self.name.replace("_", " ").title()


@dataclass(frozen=True, slots=True)
class Coordinate:
    latitude: float
    longitude: float


@dataclass(frozen=True, slots=True)
class Place:
    label: str
    coordinate: Coordinate


@dataclass(frozen=True, slots=True)
class RouteStep:
    distance_miles: float
    duration_seconds: float


class TravelProfile(StrEnum):
    TRUCK = "truck"
    CAR_ADJUSTED_FOR_TRUCK = "car_adjusted_for_truck"


@dataclass(frozen=True, slots=True)
class RouteCandidate:
    provider_name: str
    coordinates: tuple[Coordinate, ...]
    distance_miles: float
    duration_seconds: float
    steps: tuple[RouteStep, ...]
    travel_profile: TravelProfile = TravelProfile.TRUCK

    def with_duration_scaled(self, factor: float, travel_profile: TravelProfile) -> RouteCandidate:
        return replace(
            self,
            duration_seconds=self.duration_seconds * factor,
            steps=tuple(
                replace(step, duration_seconds=step.duration_seconds * factor)
                for step in self.steps
            ),
            travel_profile=travel_profile,
        )


@dataclass(frozen=True, slots=True)
class WeatherConditions:
    wind_speed_mph: float
    wind_gust_mph: float
    rain_inches_per_hour: float
    snowfall_inches_per_hour: float

    def blend_towards(self, other: WeatherConditions, weight: float) -> WeatherConditions:
        retained_weight = 1.0 - weight
        return WeatherConditions(
            wind_speed_mph=self.wind_speed_mph * retained_weight + other.wind_speed_mph * weight,
            wind_gust_mph=self.wind_gust_mph * retained_weight + other.wind_gust_mph * weight,
            rain_inches_per_hour=(
                self.rain_inches_per_hour * retained_weight + other.rain_inches_per_hour * weight
            ),
            snowfall_inches_per_hour=(
                self.snowfall_inches_per_hour * retained_weight
                + other.snowfall_inches_per_hour * weight
            ),
        )


@dataclass(frozen=True, slots=True)
class RiskAssessment:
    level: RiskLevel | None
    reasons: tuple[str, ...]

    @property
    def is_known(self) -> bool:
        return self.level is not None


@dataclass(frozen=True, slots=True)
class SampledPoint:
    sequence: int
    coordinate: Coordinate
    distance_from_origin_miles: float
    represented_miles: float
    estimated_arrival: datetime


@dataclass(frozen=True, slots=True)
class Checkpoint:
    position: SampledPoint
    conditions: WeatherConditions | None
    risk: RiskAssessment


@dataclass(frozen=True, slots=True)
class RouteRiskSummary:
    distance_miles: float
    duration_seconds: float
    miles_by_level: Mapping[RiskLevel, float]
    unknown_miles: float
    average_risk_score: float | None
    highest_level: RiskLevel | None

    def miles_at(self, level: RiskLevel) -> float:
        return self.miles_by_level.get(level, 0.0)


@dataclass(frozen=True, slots=True)
class AssessedRoute:
    route_id: str
    candidate: RouteCandidate
    checkpoints: tuple[Checkpoint, ...]
    summary: RouteRiskSummary


@dataclass(frozen=True, slots=True)
class TripPlan:
    departure: datetime
    load_pounds: float
    interval_miles: int
    ranked_routes: tuple[AssessedRoute, ...]
    recommendation_reason: str
    warnings: tuple[str, ...]

    @property
    def recommended_route(self) -> AssessedRoute:
        return self.ranked_routes[0]
