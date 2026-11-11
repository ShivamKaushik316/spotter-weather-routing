import time
from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass

TOTAL_STAGE_NAME = "total"


@dataclass(frozen=True, slots=True)
class MetricsSnapshot:
    timings_ms: Mapping[str, float]
    counters: Mapping[str, int]
    labels: Mapping[str, tuple[str, ...]]


class RequestMetrics:
    def __init__(self) -> None:
        self._timings_ms: dict[str, float] = {}
        self._counters: dict[str, int] = {}
        self._labels: dict[str, list[str]] = {}

    @contextmanager
    def measure(self, stage_name: str) -> Iterator[None]:
        started_at = time.perf_counter()
        try:
            yield
        finally:
            elapsed_ms = (time.perf_counter() - started_at) * 1000
            self._timings_ms[stage_name] = self._timings_ms.get(stage_name, 0.0) + elapsed_ms

    def increment(self, counter_name: str, amount: int = 1) -> None:
        self._counters[counter_name] = self._counters.get(counter_name, 0) + amount

    def record_label(self, label_name: str, value: str) -> None:
        recorded_values = self._labels.setdefault(label_name, [])
        if value not in recorded_values:
            recorded_values.append(value)

    def snapshot(self) -> MetricsSnapshot:
        return MetricsSnapshot(
            timings_ms=dict(self._timings_ms),
            counters=dict(self._counters),
            labels={name: tuple(values) for name, values in self._labels.items()},
        )


_active_request_metrics: ContextVar[RequestMetrics | None] = ContextVar(
    "active_request_metrics", default=None
)


def current_metrics() -> RequestMetrics:
    active_metrics = _active_request_metrics.get()
    return active_metrics if active_metrics is not None else RequestMetrics()


@contextmanager
def collect_metrics() -> Iterator[RequestMetrics]:
    metrics = RequestMetrics()
    token = _active_request_metrics.set(metrics)
    try:
        with metrics.measure(TOTAL_STAGE_NAME):
            yield metrics
    finally:
        _active_request_metrics.reset(token)
