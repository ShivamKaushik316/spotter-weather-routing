from datetime import UTC, datetime, timedelta
from typing import Any

from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from trips.application.requests import DepartureWindowRequest, HeatmapRequest, TripRequest
from trips.domain.geo import haversine_miles
from trips.domain.models import Coordinate

MAXIMUM_LOAD_POUNDS = 80_000
SAMPLING_INTERVAL_CHOICES = (10, 25, 50)
DEPARTURE_PAST_TOLERANCE = timedelta(minutes=30)
MAXIMUM_DEPARTURE_LEAD = timedelta(days=14)
MINIMUM_TRIP_MILES = 1.0
MAXIMUM_HEATMAP_ROUTES = 5
MAXIMUM_POINTS_PER_ROUTE = 20_000
DEFAULT_DEPARTURE_WINDOW_HOURS = 12
MAXIMUM_DEPARTURE_WINDOW_HOURS = 24
DEFAULT_DEPARTURE_OPTION_LIMIT = 5
MAXIMUM_DEPARTURE_OPTION_LIMIT = 10
DEFAULT_GEOCODE_RESULTS = 5
MAXIMUM_GEOCODE_RESULTS = 10

LINE_STRING_SCHEMA = {
    "type": "array",
    "minItems": 2,
    "items": {"type": "array", "minItems": 2, "maxItems": 2, "items": {"type": "number"}},
    "description": "GeoJSON LineString coordinates as [longitude, latitude] pairs.",
}


def validate_departure_time(departure: datetime) -> datetime:
    now = timezone.now()
    if departure < now - DEPARTURE_PAST_TOLERANCE:
        raise serializers.ValidationError("Departure cannot be in the past.")
    if departure > now + MAXIMUM_DEPARTURE_LEAD:
        raise serializers.ValidationError(
            f"Departure must be within the next {MAXIMUM_DEPARTURE_LEAD.days} days."
        )
    return departure.astimezone(UTC)


class CoordinateInputSerializer(serializers.Serializer):
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)

    def to_internal_value(self, data: Any) -> Coordinate:
        validated = super().to_internal_value(data)
        return Coordinate(latitude=validated["latitude"], longitude=validated["longitude"])


class TripRequestSerializer(serializers.Serializer):
    origin = CoordinateInputSerializer()
    destination = CoordinateInputSerializer()
    departure = serializers.DateTimeField()
    load_pounds = serializers.FloatField(min_value=0, max_value=MAXIMUM_LOAD_POUNDS)
    interval_miles = serializers.ChoiceField(choices=SAMPLING_INTERVAL_CHOICES)

    def validate_departure(self, departure: datetime) -> datetime:
        return validate_departure_time(departure)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if haversine_miles(attrs["origin"], attrs["destination"]) < MINIMUM_TRIP_MILES:
            raise serializers.ValidationError(
                {"destination": "Destination must be different from the origin."}
            )
        return attrs

    def to_trip_request(self) -> TripRequest:
        validated = self.validated_data
        return TripRequest(
            origin=validated["origin"],
            destination=validated["destination"],
            departure=validated["departure"],
            load_pounds=float(validated["load_pounds"]),
            interval_miles=int(validated["interval_miles"]),
        )


class DepartureWindowRequestSerializer(TripRequestSerializer):
    window_hours = serializers.IntegerField(
        min_value=1,
        max_value=MAXIMUM_DEPARTURE_WINDOW_HOURS,
        default=DEFAULT_DEPARTURE_WINDOW_HOURS,
    )
    option_limit = serializers.IntegerField(
        min_value=1,
        max_value=MAXIMUM_DEPARTURE_OPTION_LIMIT,
        default=DEFAULT_DEPARTURE_OPTION_LIMIT,
    )

    def to_departure_window_request(self) -> DepartureWindowRequest:
        return DepartureWindowRequest(
            trip=self.to_trip_request(),
            window_hours=int(self.validated_data["window_hours"]),
            option_limit=int(self.validated_data["option_limit"]),
        )


@extend_schema_field(LINE_STRING_SCHEMA)
class LineStringCoordinatesField(serializers.Field):
    def to_internal_value(self, data: Any) -> tuple[Coordinate, ...]:
        if not isinstance(data, list) or not 2 <= len(data) <= MAXIMUM_POINTS_PER_ROUTE:
            raise serializers.ValidationError(
                f"A route needs between 2 and {MAXIMUM_POINTS_PER_ROUTE} positions."
            )
        return tuple(_parse_position(position) for position in data)

    def to_representation(self, value: tuple[Coordinate, ...]) -> list[list[float]]:
        return [[coordinate.longitude, coordinate.latitude] for coordinate in value]


class HeatmapRequestSerializer(serializers.Serializer):
    routes = serializers.ListField(
        child=LineStringCoordinatesField(), min_length=1, max_length=MAXIMUM_HEATMAP_ROUTES
    )
    departure = serializers.DateTimeField()
    load_pounds = serializers.FloatField(min_value=0, max_value=MAXIMUM_LOAD_POUNDS)

    def validate_departure(self, departure: datetime) -> datetime:
        return validate_departure_time(departure)

    def to_heatmap_request(self) -> HeatmapRequest:
        validated = self.validated_data
        return HeatmapRequest(
            route_geometries=tuple(validated["routes"]),
            departure=validated["departure"],
            load_pounds=float(validated["load_pounds"]),
        )


class GeocodeQuerySerializer(serializers.Serializer):
    query = serializers.CharField(min_length=2, max_length=200)
    limit = serializers.IntegerField(
        min_value=1, max_value=MAXIMUM_GEOCODE_RESULTS, default=DEFAULT_GEOCODE_RESULTS
    )


def _parse_position(position: Any) -> Coordinate:
    if not isinstance(position, list | tuple) or len(position) != 2:
        raise serializers.ValidationError("Each position must be a [longitude, latitude] pair.")
    longitude, latitude = position
    if not all(_is_number(value) for value in (longitude, latitude)):
        raise serializers.ValidationError("Positions must contain numbers only.")
    if not (-180 <= longitude <= 180 and -90 <= latitude <= 90):
        raise serializers.ValidationError("Position is outside valid longitude/latitude ranges.")
    return Coordinate(latitude=float(latitude), longitude=float(longitude))


def _is_number(value: Any) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool)
