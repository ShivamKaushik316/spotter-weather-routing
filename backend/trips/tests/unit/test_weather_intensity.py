import pytest

from trips.domain.models import RiskLevel
from trips.domain.risk.config import build_weather_intensity_scale
from trips.tests.fakes import build_weather

SCALE = build_weather_intensity_scale()


@pytest.mark.parametrize(
    ("conditions", "expected_intensity"),
    [
        (build_weather(wind_speed_mph=0.0), 0.0),
        (build_weather(wind_speed_mph=27.5), 0.5),
        (build_weather(rain_inches_per_hour=0.25), 0.25),
        (build_weather(snowfall_inches_per_hour=1.5), 0.5),
        (build_weather(wind_speed_mph=11.0, rain_inches_per_hour=0.6), 0.6),
        (build_weather(wind_speed_mph=80.0), 1.0),
    ],
)
def test_intensity_is_strongest_factor_relative_to_no_travel_limit(
    conditions, expected_intensity: float
) -> None:
    assert SCALE.intensity(conditions) == pytest.approx(expected_intensity)


def test_heat_value_is_floored_by_the_risk_level() -> None:
    calm_but_heavy = build_weather(wind_speed_mph=38.0)

    assert SCALE.heat_value(calm_but_heavy, RiskLevel.SEVERE) == 0.75
    assert SCALE.heat_value(calm_but_heavy, RiskLevel.HIGH) == pytest.approx(0.691, abs=0.001)


def test_heat_value_is_unknown_without_forecast() -> None:
    assert SCALE.heat_value(None, None) is None
