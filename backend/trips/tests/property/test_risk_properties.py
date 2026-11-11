from hypothesis import given
from hypothesis import strategies as st

from trips.domain.models import RiskLevel
from trips.domain.risk.config import build_risk_evaluator
from trips.domain.sampling import checkpoint_distances, represented_miles
from trips.tests.fakes import build_weather

RISK_EVALUATOR = build_risk_evaluator()

wind_speeds = st.floats(min_value=0, max_value=120, allow_nan=False)
rain_rates = st.floats(min_value=0, max_value=3, allow_nan=False)
snow_rates = st.floats(min_value=0, max_value=6, allow_nan=False)
loads = st.floats(min_value=0, max_value=80_000, allow_nan=False)


def risk_level(wind: float, rain: float, snow: float, load: float) -> RiskLevel:
    level = RISK_EVALUATOR.evaluate(
        build_weather(
            wind_speed_mph=wind, rain_inches_per_hour=rain, snowfall_inches_per_hour=snow
        ),
        load,
    ).level
    assert level is not None
    return level


@given(wind_speeds, wind_speeds, rain_rates, snow_rates, loads)
def test_more_wind_never_lowers_risk(
    first_wind: float, second_wind: float, rain: float, snow: float, load: float
) -> None:
    calmer, windier = sorted((first_wind, second_wind))

    assert risk_level(windier, rain, snow, load) >= risk_level(calmer, rain, snow, load)


@given(wind_speeds, rain_rates, rain_rates, snow_rates, loads)
def test_more_rain_never_lowers_risk(
    wind: float, first_rain: float, second_rain: float, snow: float, load: float
) -> None:
    drier, wetter = sorted((first_rain, second_rain))

    assert risk_level(wind, wetter, snow, load) >= risk_level(wind, drier, snow, load)


@given(wind_speeds, rain_rates, snow_rates, snow_rates, loads)
def test_more_snow_never_lowers_risk(
    wind: float, rain: float, first_snow: float, second_snow: float, load: float
) -> None:
    lighter, heavier = sorted((first_snow, second_snow))

    assert risk_level(wind, rain, heavier, load) >= risk_level(wind, rain, lighter, load)


@given(wind_speeds, rain_rates, snow_rates, loads, loads)
def test_heavier_load_never_lowers_risk(
    wind: float, rain: float, snow: float, first_load: float, second_load: float
) -> None:
    lighter, heavier = sorted((first_load, second_load))

    assert risk_level(wind, rain, snow, heavier) >= risk_level(wind, rain, snow, lighter)


@given(
    st.floats(min_value=0.1, max_value=3_000, allow_nan=False),
    st.sampled_from([10.0, 25.0, 50.0]),
)
def test_represented_miles_always_sum_to_route_length(
    route_miles: float, interval_miles: float
) -> None:
    distances = checkpoint_distances(route_miles, interval_miles)

    assert abs(sum(represented_miles(distances)) - route_miles) < 1e-6
    assert distances[0] == 0.0
    assert distances[-1] == route_miles
