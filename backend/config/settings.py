from pathlib import Path

import environ

from trips.domain.models import RiskLevel
from trips.domain.risk.config import DEFAULT_RISK_RULES_CONFIG

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env()
ENV_FILE_PATH = BASE_DIR / ".env"
if ENV_FILE_PATH.exists():
    environ.Env.read_env(ENV_FILE_PATH)

DEBUG = env.bool("DJANGO_DEBUG", default=False)
SECRET_KEY = env.str("DJANGO_SECRET_KEY", default="development-only-secret-key")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    "trips",
]

MIDDLEWARE = [
    "core.middleware.RequestIdMiddleware",
    "core.middleware.AccessLogMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": ["django.template.context_processors.request"]},
    }
]

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = False
USE_TZ = True
STATIC_URL = "static/"

REDIS_URL = env.str("REDIS_URL", default="")
LOCAL_MEMORY_CACHE_MAX_ENTRIES = env.int("LOCAL_MEMORY_CACHE_MAX_ENTRIES", default=200_000)
CACHES = {
    "default": (
        {"BACKEND": "django.core.cache.backends.redis.RedisCache", "LOCATION": REDIS_URL}
        if REDIS_URL
        else {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "weather-aware-routing",
            "OPTIONS": {"MAX_ENTRIES": LOCAL_MEMORY_CACHE_MAX_ENTRIES},
        }
    )
}

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=["http://localhost:5173"])
CORS_EXPOSE_HEADERS = ["X-Request-ID"]

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        *(["rest_framework.renderers.BrowsableAPIRenderer"] if DEBUG else []),
    ],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "UNAUTHENTICATED_USER": None,
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.AnonRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"anon": env.str("API_THROTTLE_RATE", default="120/min")},
    "EXCEPTION_HANDLER": "core.api_errors.api_exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Weather-Aware Truck Routing API",
    "DESCRIPTION": "Plans truck routes, rates weather risk along them and recommends the safest.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "ENUM_NAME_OVERRIDES": {"RiskLevelLabel": [level.label for level in RiskLevel]},
}

PROVIDER_MODE = env.str("PROVIDER_MODE", default="live")
ROUTING_CHAIN = env.list("ROUTING_CHAIN", default=["ors", "osrm", "detour"])
OPENROUTESERVICE_API_KEY = env.str("OPENROUTESERVICE_API_KEY", default="")
OSRM_BASE_URL = env.str("OSRM_BASE_URL", default="https://router.project-osrm.org")
HTTP_TIMEOUT_SECONDS = env.float("HTTP_TIMEOUT_SECONDS", default=10.0)
WEATHER_CACHE_TTL_SECONDS = env.int("WEATHER_CACHE_TTL_SECONDS", default=1800)
STUB_LATENCY_SECONDS = env.float("STUB_LATENCY_SECONDS", default=0.0)
CAR_TO_TRUCK_DURATION_FACTOR = env.float("CAR_TO_TRUCK_DURATION_FACTOR", default=1.13)
RISK_RULES = env.json("RISK_RULES_JSON", default=DEFAULT_RISK_RULES_CONFIG)

LOG_LEVEL = env.str("LOG_LEVEL", default="INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"request_id": {"()": "core.logging.RequestIdLogFilter"}},
    "formatters": {"json": {"()": "core.logging.JsonLogFormatter"}},
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
            "filters": ["request_id"],
        }
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
}
