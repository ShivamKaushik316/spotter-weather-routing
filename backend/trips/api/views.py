from typing import Any, TypeVar

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from trips.api.meta import respond_with_metrics, with_response_meta
from trips.api.request_serializers import (
    DepartureWindowRequestSerializer,
    GeocodeQuerySerializer,
    HeatmapRequestSerializer,
    TripRequestSerializer,
)
from trips.api.response_serializers import (
    CorridorHeatmapSerializer,
    DepartureWindowPlanSerializer,
    GeocodeResultsSerializer,
    PlaceSerializer,
    TripPlanSerializer,
)
from trips.container import get_container

ValidatedSerializer = TypeVar("ValidatedSerializer", bound=serializers.Serializer)


def validate_input(
    serializer_class: type[ValidatedSerializer], payload: Any
) -> ValidatedSerializer:
    serializer = serializer_class(data=payload)
    serializer.is_valid(raise_exception=True)
    return serializer


class HealthView(APIView):
    throttle_classes = ()

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request: Request) -> Response:
        return Response({"status": "ok"})


class GeocodeView(APIView):
    @extend_schema(
        parameters=[GeocodeQuerySerializer],
        responses=with_response_meta(GeocodeResultsSerializer),
    )
    def get(self, request: Request) -> Response:
        query = validate_input(GeocodeQuerySerializer, request.query_params).validated_data
        geocode_service = get_container().geocode_service
        return respond_with_metrics(
            lambda: {
                "results": PlaceSerializer(
                    geocode_service.search(query["query"], query["limit"]), many=True
                ).data
            }
        )


class PlanTripView(APIView):
    @extend_schema(request=TripRequestSerializer, responses=with_response_meta(TripPlanSerializer))
    def post(self, request: Request) -> Response:
        trip_request = validate_input(TripRequestSerializer, request.data).to_trip_request()
        plan_trip_service = get_container().plan_trip_service
        return respond_with_metrics(
            lambda: TripPlanSerializer(plan_trip_service.execute(trip_request)).data
        )


class DepartureWindowView(APIView):
    @extend_schema(
        request=DepartureWindowRequestSerializer,
        responses=with_response_meta(DepartureWindowPlanSerializer),
    )
    def post(self, request: Request) -> Response:
        window_request = validate_input(
            DepartureWindowRequestSerializer, request.data
        ).to_departure_window_request()
        departure_window_service = get_container().departure_window_service
        return respond_with_metrics(
            lambda: DepartureWindowPlanSerializer(
                departure_window_service.execute(window_request)
            ).data
        )


class CorridorHeatmapView(APIView):
    @extend_schema(request=HeatmapRequestSerializer, responses={200: OpenApiTypes.OBJECT})
    def post(self, request: Request) -> Response:
        heatmap_request = validate_input(
            HeatmapRequestSerializer, request.data
        ).to_heatmap_request()
        corridor_heatmap_service = get_container().corridor_heatmap_service
        return respond_with_metrics(
            lambda: CorridorHeatmapSerializer(
                corridor_heatmap_service.execute(heatmap_request)
            ).data
        )
