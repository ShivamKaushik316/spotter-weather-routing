from collections.abc import Callable, Mapping
from typing import Any

from rest_framework import serializers
from rest_framework.response import Response

from core.metrics import RequestMetrics, collect_metrics
from core.request_context import current_request_id


class ResponseMetaSerializer(serializers.Serializer):
    request_id = serializers.CharField(read_only=True)
    timings_ms = serializers.DictField(child=serializers.FloatField(), read_only=True)
    counters = serializers.DictField(child=serializers.IntegerField(), read_only=True)
    labels = serializers.DictField(
        child=serializers.ListField(child=serializers.CharField()), read_only=True
    )


def build_response_meta(metrics: RequestMetrics) -> dict[str, Any]:
    snapshot = metrics.snapshot()
    return {
        "request_id": current_request_id(),
        "timings_ms": {stage: round(elapsed, 1) for stage, elapsed in snapshot.timings_ms.items()},
        "counters": dict(snapshot.counters),
        "labels": {name: list(values) for name, values in snapshot.labels.items()},
    }


def respond_with_metrics(compute_body: Callable[[], Mapping[str, Any]]) -> Response:
    with collect_metrics() as metrics:
        body = compute_body()
    return Response({**body, "meta": build_response_meta(metrics)})


def with_response_meta(
    serializer_class: type[serializers.Serializer],
) -> type[serializers.Serializer]:
    schema_name = serializer_class.__name__.removesuffix("Serializer")
    return type(
        f"{schema_name}ResponseSerializer",
        (serializer_class,),
        {"meta": ResponseMetaSerializer(read_only=True)},
    )
