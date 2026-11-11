from core.metrics import current_metrics
from trips.domain.models import Place
from trips.ports import Geocoder


class GeocodeService:
    def __init__(self, geocoder: Geocoder) -> None:
        self._geocoder = geocoder

    def search(self, query: str, result_limit: int) -> list[Place]:
        normalized_query = " ".join(query.split())
        with current_metrics().measure("geocoding"):
            return self._geocoder.search(normalized_query, result_limit)
