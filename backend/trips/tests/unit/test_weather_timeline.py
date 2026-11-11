from datetime import timedelta

import pytest

from trips.domain.models import Coordinate
from trips.domain.weather import ForecastGrid, ForecastSeries, TimeWindow
from trips.tests.fakes import FIXED_DEPARTURE, build_weather

SIX_AM = FIXED_DEPARTURE
SEVEN_AM = FIXED_DEPARTURE + timedelta(hours=1)


def build_two_hour_series(second_hour_wind_mph: float | None = 20.0) -> ForecastSeries:
    second_hour = (
        None if second_hour_wind_mph is None else build_weather(wind_speed_mph=second_hour_wind_mph)
    )
    return ForecastSeries(
        first_hour=SIX_AM,
        hourly_conditions=(build_weather(wind_speed_mph=10.0), second_hour),
    )


def test_conditions_are_interpolated_between_hours() -> None:
    conditions = build_two_hour_series().conditions_at(SIX_AM + timedelta(minutes=45))

    assert conditions is not None
    assert conditions.wind_speed_mph == pytest.approx(17.5)


def test_exact_hour_returns_forecast_value() -> None:
    conditions = build_two_hour_series().conditions_at(SEVEN_AM)

    assert conditions is not None
    assert conditions.wind_speed_mph == pytest.approx(20.0)


@pytest.mark.parametrize("moment", [SIX_AM - timedelta(minutes=1), SEVEN_AM + timedelta(minutes=1)])
def test_moments_outside_forecast_are_unknown(moment) -> None:
    assert build_two_hour_series().conditions_at(moment) is None


def test_interpolating_into_missing_hour_is_unknown() -> None:
    series = build_two_hour_series(second_hour_wind_mph=None)

    assert series.conditions_at(SIX_AM + timedelta(minutes=30)) is None
    assert series.conditions_at(SIX_AM) is not None


def test_time_window_covers_moments_on_whole_hours() -> None:
    window = TimeWindow.covering(
        [SIX_AM + timedelta(minutes=44), SIX_AM + timedelta(hours=3, minutes=10)]
    )

    assert window.start == SIX_AM
    assert window.end == SIX_AM + timedelta(hours=4)
    assert len(window.hourly_moments()) == 5


def test_time_window_rejects_empty_input() -> None:
    with pytest.raises(ValueError, match="at least one moment"):
        TimeWindow.covering([])


def test_forecast_grid_snaps_lookup_coordinates() -> None:
    grid = ForecastGrid(0.1, {Coordinate(40.0, -100.0): build_two_hour_series()})

    assert grid.conditions_at(Coordinate(40.03, -99.98), SIX_AM) is not None
    assert grid.conditions_at(Coordinate(45.0, -99.98), SIX_AM) is None
