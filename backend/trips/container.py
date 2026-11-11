from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from enum import StrEnum
from functools import cache, cached_property
from types import MappingProxyType
from typing import Any

from django.conf import settings
from django.core.cache import BaseCache, caches
from django.core.exceptions import ImproperlyConfigured

from core.http import JsonHttpClient
from trips.adapters.cached_weather import CachedWeatherProvider
from trips.adapters.detour import DetourRoutingProvider
from trips.adapters.django_cache import DjangoForecastCache
from trips.adapters.open_meteo import OpenMeteoWeatherProvider
from trips.adapters.openrouteservice import (
    OpenRouteServiceGeocoder,
    OpenRouteServiceRoutingProvider,
)
from trips.adapters.osrm import OsrmRoutingProvider
from trips.adapters.routing_chain import FallbackRoutingProvider
from trips.adapters.stub import StubGeocoder, StubRoutingProvider, StubWeatherProvider
from trips.adapters.truck_speed import TruckSpeedAdjustedRoutingProvider
from trips.application.departure_window import DepartureWindowService
from trips.application.forecasts import ForecastGridLoader
from trips.application.geocode import GeocodeService
from trips.application.heatmap import CorridorHeatmapService
from trips.application.plan_trip import PlanTripService
from trips.application.route_evaluation import RouteEvaluator
from trips.domain.assessment import RouteAssessor
from trips.domain.corridor import CorridorGridBuilder
from trips.domain.ranking import RouteRanker
from trips.domain.risk.config import build_risk_evaluator, build_weather_intensity_scale
from trips.domain.risk.evaluator import RiskEvaluator
from trips.domain.route_overlap import RouteOverlapDetector
from trips.domain.sampling import CheckpointSampler
from trips.ports import Geocoder, RoutingProvider, WeatherProvider

logger = logging.getLogger(__name__)


class ProviderMode(StrEnum):
    LIVE = "live"
    STUB = "stub"


@dataclass(frozen=True, slots=True)
class ContainerSettings:
    provider_mode: ProviderMode
    routing_chain: tuple[str, ...]
    openrouteservice_api_key: str
    osrm_base_url: str
    http_timeout_seconds: float
    weather_cache_ttl_seconds: int
    stub_latency_seconds: float
    risk_rules: Mapping[str, Any]
    car_to_truck_duration_factor: float

    @classmethod
    def from_django_settings(cls) -> ContainerSettings:
        return cls(
            provider_mode=ProviderMode(settings.PROVIDER_MODE),
            routing_chain=tuple(settings.ROUTING_CHAIN),
            openrouteservice_api_key=settings.OPENROUTESERVICE_API_KEY,
            osrm_base_url=settings.OSRM_BASE_URL,
            http_timeout_seconds=settings.HTTP_TIMEOUT_SECONDS,
            weather_cache_ttl_seconds=settings.WEATHER_CACHE_TTL_SECONDS,
            stub_latency_seconds=settings.STUB_LATENCY_SECONDS,
            risk_rules=settings.RISK_RULES,
            car_to_truck_duration_factor=settings.CAR_TO_TRUCK_DURATION_FACTOR,
        )


class ServiceContainer:
    def __init__(self, container_settings: ContainerSettings, cache_backend: BaseCache) -> None:
        self._settings = container_settings
        self._cache_backend = cache_backend

    @property
    def settings(self) -> ContainerSettings:
        return self._settings

    @property
    def uses_stub_providers(self) -> bool:
        return self._settings.provider_mode is ProviderMode.STUB

    @cached_property
    def risk_evaluator(self) -> RiskEvaluator:
        return build_risk_evaluator(self._settings.risk_rules)

    @cached_property
    def route_ranker(self) -> RouteRanker:
        return RouteRanker()

    @cached_property
    def openrouteservice_http_client(self) -> JsonHttpClient:
        return self._create_http_client(
            "openrouteservice", {"Authorization": self._settings.openrouteservice_api_key}
        )

    @cached_property
    def osrm_routing_provider(self) -> OsrmRoutingProvider:
        return OsrmRoutingProvider(
            self._create_http_client("osrm"), base_url=self._settings.osrm_base_url
        )

    @cached_property
    def routing_provider(self) -> RoutingProvider:
        if self.uses_stub_providers:
            return StubRoutingProvider(self._settings.stub_latency_seconds)
        return FallbackRoutingProvider(self._configured_routing_providers(), RouteOverlapDetector())

    @cached_property
    def weather_provider(self) -> WeatherProvider:
        origin_provider: WeatherProvider = (
            StubWeatherProvider(self._settings.stub_latency_seconds)
            if self.uses_stub_providers
            else OpenMeteoWeatherProvider(self._create_http_client("open-meteo"))
        )
        return CachedWeatherProvider(
            origin_provider,
            DjangoForecastCache(self._cache_backend),
            self._settings.weather_cache_ttl_seconds,
        )

    @cached_property
    def geocoder(self) -> Geocoder:
        if self.uses_stub_providers:
            return StubGeocoder()
        return OpenRouteServiceGeocoder(self.openrouteservice_http_client)

    @cached_property
    def forecast_grid_loader(self) -> ForecastGridLoader:
        return ForecastGridLoader(self.weather_provider)

    @cached_property
    def route_evaluator(self) -> RouteEvaluator:
        return RouteEvaluator(
            CheckpointSampler(), RouteAssessor(self.risk_evaluator), self.forecast_grid_loader
        )

    @cached_property
    def plan_trip_service(self) -> PlanTripService:
        return PlanTripService(self.routing_provider, self.route_evaluator, self.route_ranker)

    @cached_property
    def departure_window_service(self) -> DepartureWindowService:
        return DepartureWindowService(
            self.routing_provider, self.route_evaluator, self.route_ranker
        )

    @cached_property
    def corridor_heatmap_service(self) -> CorridorHeatmapService:
        return CorridorHeatmapService(
            CorridorGridBuilder(),
            self.forecast_grid_loader,
            self.risk_evaluator,
            build_weather_intensity_scale(self._settings.risk_rules),
        )

    @cached_property
    def geocode_service(self) -> GeocodeService:
        return GeocodeService(self.geocoder)

    def _configured_routing_providers(self) -> list[RoutingProvider]:
        providers: list[RoutingProvider] = []
        for provider_name in self._settings.routing_chain:
            factory = ROUTING_PROVIDER_FACTORIES.get(provider_name)
            if factory is None:
                raise ImproperlyConfigured(f"Unknown routing provider '{provider_name}'.")
            provider = factory(self)
            if provider is None:
                logger.warning("routing_provider_skipped", extra={"provider": provider_name})
                continue
            providers.append(provider)
        if not providers:
            raise ImproperlyConfigured("No routing provider is configured.")
        return providers

    def _create_http_client(
        self, service_name: str, default_headers: Mapping[str, str] | None = None
    ) -> JsonHttpClient:
        return JsonHttpClient(
            service_name,
            timeout_seconds=self._settings.http_timeout_seconds,
            default_headers=default_headers,
        )


RoutingProviderFactory = Callable[[ServiceContainer], RoutingProvider | None]


def _build_openrouteservice_routing(container: ServiceContainer) -> RoutingProvider | None:
    if not container.settings.openrouteservice_api_key:
        return None
    return OpenRouteServiceRoutingProvider(container.openrouteservice_http_client)


def _adjusted_for_truck(
    container: ServiceContainer, car_provider: RoutingProvider
) -> RoutingProvider:
    return TruckSpeedAdjustedRoutingProvider(
        car_provider, container.settings.car_to_truck_duration_factor
    )


def _build_osrm_routing(container: ServiceContainer) -> RoutingProvider:
    return _adjusted_for_truck(container, container.osrm_routing_provider)


def _build_detour_routing(container: ServiceContainer) -> RoutingProvider:
    return _adjusted_for_truck(container, DetourRoutingProvider(container.osrm_routing_provider))


ROUTING_PROVIDER_FACTORIES: Mapping[str, RoutingProviderFactory] = MappingProxyType(
    {
        "ors": _build_openrouteservice_routing,
        "osrm": _build_osrm_routing,
        "detour": _build_detour_routing,
    }
)


@cache
def get_container() -> ServiceContainer:
    return ServiceContainer(ContainerSettings.from_django_settings(), caches["default"])
