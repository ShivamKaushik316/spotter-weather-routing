from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from trips.domain.corridor import CorridorHeatmap
from trips.domain.geo import simplify_polyline
from trips.domain.models import AssessedRoute, RiskLevel, RouteRiskSummary, TravelProfile

GEOMETRY_SIMPLIFICATION_TOLERANCE_DEGREES = 0.0002
GEOMETRY_COORDINATE_DECIMALS = 5

RISK_LEVEL_LABEL_SCHEMA = {
    "type": "string",
    "enum": [level.label for level in RiskLevel],
    "nullable": True,
    "description": "Null when the forecast is unavailable.",
}
MILES_BY_LEVEL_SCHEMA = {"type": "object", "additionalProperties": {"type": "number"}}
LINE_STRING_GEOMETRY_SCHEMA = {
    "type": "object",
    "required": ["type", "coordinates"],
    "properties": {
        "type": {"type": "string", "enum": ["LineString"]},
        "coordinates": {"type": "array", "items": {"type": "array", "items": {"type": "number"}}},
    },
}


class RoundedFloatField(serializers.FloatField):
    def __init__(self, *, decimal_places: int, **kwargs: Any) -> None:
        kwargs.setdefault("read_only", True)
        super().__init__(**kwargs)
        self.decimal_places = decimal_places

    def to_representation(self, value: Any) -> float:
        return round(float(value), self.decimal_places)


@extend_schema_field(RISK_LEVEL_LABEL_SCHEMA)
class RiskLevelLabelField(serializers.Field):
    def __init__(self, **kwargs: Any) -> None:
        kwargs["read_only"] = True
        super().__init__(**kwargs)

    def to_representation(self, value: RiskLevel) -> str:
        return value.label


class PlaceSerializer(serializers.Serializer):
    label = serializers.CharField(read_only=True)
    latitude = RoundedFloatField(source="coordinate.latitude", decimal_places=6)
    longitude = RoundedFloatField(source="coordinate.longitude", decimal_places=6)


class GeocodeResultsSerializer(serializers.Serializer):
    results = PlaceSerializer(many=True, read_only=True)


class WeatherConditionsSerializer(serializers.Serializer):
    wind_speed_mph = RoundedFloatField(decimal_places=1)
    wind_gust_mph = RoundedFloatField(decimal_places=1)
    rain_inches_per_hour = RoundedFloatField(decimal_places=2)
    snowfall_inches_per_hour = RoundedFloatField(decimal_places=2)


class CheckpointSerializer(serializers.Serializer):
    sequence = serializers.IntegerField(source="position.sequence", read_only=True)
    latitude = RoundedFloatField(source="position.coordinate.latitude", decimal_places=5)
    longitude = RoundedFloatField(source="position.coordinate.longitude", decimal_places=5)
    distance_from_origin_miles = RoundedFloatField(
        source="position.distance_from_origin_miles", decimal_places=2
    )
    represented_miles = RoundedFloatField(source="position.represented_miles", decimal_places=2)
    estimated_arrival = serializers.DateTimeField(
        source="position.estimated_arrival", read_only=True
    )
    weather = WeatherConditionsSerializer(source="conditions", read_only=True, allow_null=True)
    risk_level = RiskLevelLabelField(source="risk.level", allow_null=True)
    risk_score = serializers.IntegerField(source="risk.level", read_only=True, allow_null=True)
    risk_reasons = serializers.ListField(
        source="risk.reasons", child=serializers.CharField(), read_only=True
    )


class RouteSummarySerializer(serializers.Serializer):
    distance_miles = RoundedFloatField(decimal_places=1)
    duration_seconds = RoundedFloatField(decimal_places=0)
    miles_by_level = serializers.SerializerMethodField()
    unknown_miles = RoundedFloatField(decimal_places=1)
    average_risk_score = RoundedFloatField(decimal_places=2, allow_null=True)
    highest_risk_level = RiskLevelLabelField(source="highest_level", allow_null=True)

    @extend_schema_field(MILES_BY_LEVEL_SCHEMA)
    def get_miles_by_level(self, summary: RouteRiskSummary) -> dict[str, float]:
        return {level.label: round(summary.miles_at(level), 1) for level in RiskLevel}


class RouteSerializer(serializers.Serializer):
    route_id = serializers.CharField(read_only=True)
    provider = serializers.CharField(source="candidate.provider_name", read_only=True)
    travel_profile = serializers.ChoiceField(
        source="candidate.travel_profile",
        choices=[profile.value for profile in TravelProfile],
        read_only=True,
        help_text=(
            "truck: routed with a truck profile. car_adjusted_for_truck: car route whose "
            "durations were scaled to truck speeds."
        ),
    )
    geometry = serializers.SerializerMethodField()
    summary = RouteSummarySerializer(read_only=True)
    checkpoints = CheckpointSerializer(many=True, read_only=True)

    @extend_schema_field(LINE_STRING_GEOMETRY_SCHEMA)
    def get_geometry(self, route: AssessedRoute) -> dict[str, Any]:
        simplified_coordinates = simplify_polyline(
            route.candidate.coordinates, GEOMETRY_SIMPLIFICATION_TOLERANCE_DEGREES
        )
        return {
            "type": "LineString",
            "coordinates": [
                [
                    round(coordinate.longitude, GEOMETRY_COORDINATE_DECIMALS),
                    round(coordinate.latitude, GEOMETRY_COORDINATE_DECIMALS),
                ]
                for coordinate in simplified_coordinates
            ],
        }


class TripPlanSerializer(serializers.Serializer):
    departure = serializers.DateTimeField(read_only=True)
    load_pounds = RoundedFloatField(decimal_places=0)
    interval_miles = serializers.IntegerField(read_only=True)
    recommended_route_id = serializers.CharField(
        source="recommended_route.route_id", read_only=True
    )
    recommendation_reason = serializers.CharField(read_only=True)
    warnings = serializers.ListField(child=serializers.CharField(), read_only=True)
    routes = RouteSerializer(source="ranked_routes", many=True, read_only=True)


class DepartureOptionSerializer(serializers.Serializer):
    departure = serializers.DateTimeField(read_only=True)
    delay_hours = serializers.IntegerField(read_only=True)
    best_route_id = serializers.CharField(source="best_route.route_id", read_only=True)
    summary = RouteSummarySerializer(source="best_route.summary", read_only=True)
    change_from_baseline = serializers.CharField(read_only=True)


class DepartureWindowPlanSerializer(serializers.Serializer):
    baseline = DepartureOptionSerializer(read_only=True)
    recommended_option = DepartureOptionSerializer(read_only=True)
    options = DepartureOptionSerializer(source="ranked_options", many=True, read_only=True)


class CorridorHeatmapSerializer(serializers.BaseSerializer):
    def to_representation(self, instance: CorridorHeatmap) -> dict[str, Any]:
        return {
            "type": "FeatureCollection",
            "hours": [moment.isoformat() for moment in instance.moments],
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [cell.coordinate.longitude, cell.coordinate.latitude],
                    },
                    "properties": {
                        f"h{hour_offset}": heat for hour_offset, heat in enumerate(cell.hourly_heat)
                    },
                }
                for cell in instance.cells
            ],
        }
