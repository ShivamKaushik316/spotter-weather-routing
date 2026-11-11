from datetime import timedelta

from core.metrics import current_metrics
from trips.application.forecasts import ForecastGridLoader
from trips.application.requests import HeatmapRequest
from trips.domain.corridor import CorridorGridBuilder, CorridorHeatmap, HeatmapCell
from trips.domain.models import WeatherConditions
from trips.domain.risk.evaluator import RiskEvaluator
from trips.domain.risk.intensity import WeatherIntensityScale
from trips.domain.weather import TimeWindow

ONE_HOUR = timedelta(hours=1)


class CorridorHeatmapService:
    def __init__(
        self,
        grid_builder: CorridorGridBuilder,
        forecast_loader: ForecastGridLoader,
        risk_evaluator: RiskEvaluator,
        intensity_scale: WeatherIntensityScale,
    ) -> None:
        self._grid_builder = grid_builder
        self._forecast_loader = forecast_loader
        self._risk_evaluator = risk_evaluator
        self._intensity_scale = intensity_scale

    def execute(self, request: HeatmapRequest) -> CorridorHeatmap:
        metrics = current_metrics()
        with metrics.measure("corridor_grid"):
            corridor_points = self._grid_builder.build(request.route_geometries)
        moments = tuple(
            request.departure + ONE_HOUR * hour_offset
            for hour_offset in range(request.forecast_hours + 1)
        )
        with metrics.measure("weather"):
            forecast_grid = self._forecast_loader.load(
                corridor_points, TimeWindow.covering(moments)
            )
        with metrics.measure("risk"):
            cells = tuple(
                HeatmapCell(
                    coordinate=point,
                    hourly_heat=tuple(
                        self._heat_value(forecast_grid.conditions_at(point, moment), request)
                        for moment in moments
                    ),
                )
                for point in corridor_points
            )
        return CorridorHeatmap(moments=moments, cells=cells)

    def _heat_value(
        self, conditions: WeatherConditions | None, request: HeatmapRequest
    ) -> float | None:
        level = self._risk_evaluator.evaluate(conditions, request.load_pounds).level
        return self._intensity_scale.heat_value(conditions, level)
