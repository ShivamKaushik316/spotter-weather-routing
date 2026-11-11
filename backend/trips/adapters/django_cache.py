from collections.abc import Iterable, Mapping
from typing import Any

from django.core.cache import BaseCache


class DjangoForecastCache:
    def __init__(self, cache_backend: BaseCache) -> None:
        self._cache_backend = cache_backend

    def get_many(self, keys: Iterable[str]) -> Mapping[str, Any]:
        return self._cache_backend.get_many(list(keys))

    def set_many(self, entries: Mapping[str, Any], time_to_live_seconds: int) -> None:
        if entries:
            self._cache_backend.set_many(dict(entries), timeout=time_to_live_seconds)
