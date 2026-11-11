from trips.domain.models import Coordinate, RouteCandidate, TravelProfile
from trips.ports import RoutingProvider

DEFAULT_CAR_TO_TRUCK_DURATION_FACTOR = 1.13


class TruckSpeedAdjustedRoutingProvider:
    def __init__(
        self,
        car_routing_provider: RoutingProvider,
        duration_factor: float = DEFAULT_CAR_TO_TRUCK_DURATION_FACTOR,
    ) -> None:
        if duration_factor < 1:
            raise ValueError("Trucks are never faster than cars; the factor must be at least 1.")
        self._car_routing_provider = car_routing_provider
        self._duration_factor = duration_factor
        self.name = car_routing_provider.name

    def find_routes(
        self, origin: Coordinate, destination: Coordinate, route_limit: int
    ) -> list[RouteCandidate]:
        return [
            route.with_duration_scaled(self._duration_factor, TravelProfile.CAR_ADJUSTED_FOR_TRUCK)
            for route in self._car_routing_provider.find_routes(origin, destination, route_limit)
        ]
