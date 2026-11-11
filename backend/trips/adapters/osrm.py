from collections.abc import Mapping, Sequence
from typing import Any

from core.exceptions import NoRouteFoundError
from core.http import JsonHttpClient
from trips.domain.models import Coordinate, RouteCandidate, RouteStep

OSRM_PUBLIC_BASE_URL = "https://router.project-osrm.org"
OSRM_DRIVING_PROFILE = "driving"
OSRM_SUCCESS_CODE = "Ok"
METERS_PER_MILE = 1609.344


class OsrmRoutingProvider:
    name = "osrm"

    def __init__(
        self,
        http_client: JsonHttpClient,
        *,
        base_url: str = OSRM_PUBLIC_BASE_URL,
        profile: str = OSRM_DRIVING_PROFILE,
    ) -> None:
        self._http_client = http_client
        self._route_url_prefix = f"{base_url}/route/v1/{profile}"

    def find_routes(
        self, origin: Coordinate, destination: Coordinate, route_limit: int
    ) -> list[RouteCandidate]:
        return self._request_routes([origin, destination], alternative_count=route_limit - 1)

    def route_through(self, waypoints: Sequence[Coordinate]) -> RouteCandidate:
        return self._request_routes(waypoints, alternative_count=0)[0]

    def _request_routes(
        self, waypoints: Sequence[Coordinate], alternative_count: int
    ) -> list[RouteCandidate]:
        waypoint_path = ";".join(
            f"{waypoint.longitude:.6f},{waypoint.latitude:.6f}" for waypoint in waypoints
        )
        payload = self._http_client.get_json(
            f"{self._route_url_prefix}/{waypoint_path}",
            {
                "overview": "full",
                "geometries": "geojson",
                "steps": "true",
                "alternatives": str(alternative_count) if alternative_count > 0 else "false",
            },
        )
        routes = payload.get("routes") or []
        if payload.get("code") != OSRM_SUCCESS_CODE or not routes:
            raise NoRouteFoundError("OSRM returned no route.")
        return [self._parse_route(route) for route in routes]

    def _parse_route(self, route: Mapping[str, Any]) -> RouteCandidate:
        return RouteCandidate(
            provider_name=self.name,
            coordinates=tuple(
                Coordinate(latitude=float(position[1]), longitude=float(position[0]))
                for position in route["geometry"]["coordinates"]
            ),
            distance_miles=float(route["distance"]) / METERS_PER_MILE,
            duration_seconds=float(route["duration"]),
            steps=tuple(
                RouteStep(
                    distance_miles=float(step["distance"]) / METERS_PER_MILE,
                    duration_seconds=float(step["duration"]),
                )
                for leg in route.get("legs", [])
                for step in leg.get("steps", [])
            ),
        )
