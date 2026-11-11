from config.settings import *

PROVIDER_MODE = "stub"
STUB_LATENCY_SECONDS = 0.0
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "weather-aware-routing-tests",
        "OPTIONS": {"MAX_ENTRIES": LOCAL_MEMORY_CACHE_MAX_ENTRIES},
    }
}
REST_FRAMEWORK = {**REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": {"anon": "100000/min"}}
