import logging
from collections.abc import Mapping, Sequence
from typing import Any

from core.exceptions import NoRouteFoundError, UpstreamServiceError
from core.http import JsonHttpClient
from trips.domain.models import Coordinate, Place, RouteCandidate, RouteStep

logger = logging.getLogger(__name__)

OPENROUTESERVICE_BASE_URL = "https://api.openrouteservice.org"
TRUCK_PROFILE = "driving-hgv"
MAXIMUM_ALTERNATIVE_ROUTES = 3
ALTERNATIVE_ROUTE_WEIGHT_FACTOR = 1.6
ALTERNATIVE_ROUTE_SHARE_FACTOR = 0.6
UNNAMED_PLACE_LABEL = "Unnamed place"


class OpenRouteServiceRoutingProvider:
    name = "openrouteservice"

    def __init__(
        self,
        http_client: JsonHttpClient,
        *,
        profile: str = TRUCK_PROFILE,
        base_url: str = OPENROUTESERVICE_BASE_URL,
    ) -> None:
        self._http_client = http_client
        self._directions_url = f"{base_url}/v2/directions/{profile}/geojson"

    def find_routes(
        self, origin: Coordinate, destination: Coordinate, route_limit: int
    ) -> list[RouteCandidate]:
        request_body = _directions_body([origin, destination])
        if route_limit > 1:
            try:
                return self._request_routes(
                    {**request_body, "alternative_routes": _alternative_routes_options(route_limit)}
                )
            except UpstreamServiceError as error:
                if not error.is_client_error:
                    raise
                logger.info(
                    "openrouteservice_alternatives_rejected",
                    extra={"upstream_status": error.status_code},
                )
        return self._request_routes(request_body)

    def route_through(self, waypoints: Sequence[Coordinate]) -> RouteCandidate:
        return self._request_routes(_directions_body(waypoints))[0]

    def _request_routes(self, request_body: Mapping[str, Any]) -> list[RouteCandidate]:
        payload = self._http_client.post_json(self._directions_url, request_body)
        features = payload.get("features") or []
        if not features:
            raise NoRouteFoundError("OpenRouteService returned no route.")
        return [self._parse_feature(feature) for feature in features]

    def _parse_feature(self, feature: Mapping[str, Any]) -> RouteCandidate:
        properties = feature["properties"]
        summary = properties.get("summary", {})
        return RouteCandidate(
            provider_name=self.name,
            coordinates=tuple(
                Coordinate(latitude=float(position[1]), longitude=float(position[0]))
                for position in feature["geometry"]["coordinates"]
            ),
            distance_miles=float(summary.get("distance", 0.0)),
            duration_seconds=float(summary.get("duration", 0.0)),
            steps=tuple(
                RouteStep(
                    distance_miles=float(step.get("distance", 0.0)),
                    duration_seconds=float(step.get("duration", 0.0)),
                )
                for segment in properties.get("segments", [])
                for step in segment.get("steps", [])
            ),
        )


class OpenRouteServiceGeocoder:
    def __init__(
        self, http_client: JsonHttpClient, *, base_url: str = OPENROUTESERVICE_BASE_URL
    ) -> None:
        self._http_client = http_client
        self._autocomplete_url = f"{base_url}/geocode/autocomplete"

    def search(self, query: str, result_limit: int) -> list[Place]:
        payload = self._http_client.get_json(
            self._autocomplete_url, {"text": query, "size": str(result_limit)}
        )
        return [_parse_place(feature) for feature in payload.get("features") or []]


def _directions_body(waypoints: Sequence[Coordinate]) -> dict[str, Any]:
    return {
        "coordinates": [[waypoint.longitude, waypoint.latitude] for waypoint in waypoints],
        "units": "mi",
        "instructions": True,
    }


def _alternative_routes_options(route_limit: int) -> dict[str, float]:
    return {
        "target_count": min(route_limit, MAXIMUM_ALTERNATIVE_ROUTES),
        "weight_factor": ALTERNATIVE_ROUTE_WEIGHT_FACTOR,
        "share_factor": ALTERNATIVE_ROUTE_SHARE_FACTOR,
    }


def _parse_place(feature: Mapping[str, Any]) -> Place:
    longitude, latitude = feature["geometry"]["coordinates"][:2]
    return Place(
        label=feature.get("properties", {}).get("label", UNNAMED_PLACE_LABEL),
        coordinate=Coordinate(latitude=float(latitude), longitude=float(longitude)),
    )
