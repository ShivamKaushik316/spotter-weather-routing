from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("api/", include("trips.api.urls")),
    path("api/schema", SpectacularAPIView.as_view(), name="openapi-schema"),
    path(
        "api/docs",
        SpectacularSwaggerView.as_view(url_name="openapi-schema"),
        name="swagger-ui",
    ),
]
