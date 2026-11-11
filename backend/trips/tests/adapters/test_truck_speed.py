import pytest

from trips.adapters.truck_speed import TruckSpeedAdjustedRoutingProvider
from trips.domain.models import Coordinate, RouteStep, TravelProfile
from trips.tests.fakes import FakeRoutingProvider, build_straight_route

ORIGIN = Coordinate(35.0, -100.0)
DESTINATION = Coordinate(35.0, -98.0)
CAR_ROUTE = build_straight_route(
    ORIGIN,
    DESTINATION,
    distance_miles=100.0,
    duration_seconds=6000.0,
    steps=(RouteStep(10.0, 1000.0), RouteStep(90.0, 5000.0)),
    provider_name="osrm",
)


def test_car_durations_are_scaled_to_truck_speed() -> None:
    provider = TruckSpeedAdjustedRoutingProvider(FakeRoutingProvider([CAR_ROUTE], name="osrm"), 1.2)

    [adjusted] = provider.find_routes(ORIGIN, DESTINATION, route_limit=3)

    assert adjusted.duration_seconds == pytest.approx(7200.0)
    assert [step.duration_seconds for step in adjusted.steps] == pytest.approx([1200.0, 6000.0])
    assert adjusted.distance_miles == CAR_ROUTE.distance_miles
    assert adjusted.travel_profile is TravelProfile.CAR_ADJUSTED_FOR_TRUCK
    assert provider.name == "osrm"


def test_truck_routes_keep_their_profile_by_default() -> None:
    assert CAR_ROUTE.travel_profile is TravelProfile.TRUCK


def test_factor_below_one_is_rejected() -> None:
    with pytest.raises(ValueError, match="at least 1"):
        TruckSpeedAdjustedRoutingProvider(FakeRoutingProvider([CAR_ROUTE]), 0.9)
