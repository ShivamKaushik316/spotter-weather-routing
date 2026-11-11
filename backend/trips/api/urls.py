from django.urls import path

from trips.api.views import (
    CorridorHeatmapView,
    DepartureWindowView,
    GeocodeView,
    HealthView,
    PlanTripView,
)

urlpatterns = [
    path("health", HealthView.as_view(), name="health"),
    path("geocode", GeocodeView.as_view(), name="geocode"),
    path("trips/plan", PlanTripView.as_view(), name="trip-plan"),
    path("trips/departure-window", DepartureWindowView.as_view(), name="trip-departure-window"),
    path("trips/heatmap", CorridorHeatmapView.as_view(), name="trip-heatmap"),
]
