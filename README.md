# Night Dispatch — Weather-Aware Truck Routing

Plan a truck trip, see the weather the truck will **actually** meet at every point **at the time it gets there**, and get the safest of three routes — with the reason why.

- **Stack:** React 18 · TypeScript (strict) · Vite · MapLibre GL · TanStack Query · Zustand · Tailwind — Django 5 · DRF · drf-spectacular · httpx
- **Live demo:** _to be added_
- **Walkthrough video:** _to be added_

---

## Contents

1. [What it does](#1-what-it-does)
2. [Quick start](#2-quick-start)
3. [Configuration](#3-configuration)
4. [Backend architecture](#4-backend-architecture)
5. [Core logic](#5-core-logic)
6. [Frontend architecture](#6-frontend-architecture)
7. [Frontend practices](#7-frontend-practices)
8. [API](#8-api)
9. [Testing & quality gates](#9-testing--quality-gates)
10. [Trade-offs & known limits](#10-trade-offs--known-limits)
11. [Further reading](#11-further-reading)

---

## 1. What it does

| Input | Output |
|---|---|
| Origin & destination (search **or click on the map**) | Up to **3 distinct routes** (A, B, C) drawn on the map |
| Departure time | **Checkpoints** every 10 / 25 / 50 miles, each with an ETA |
| Load weight (0–80,000 lb) | Forecast wind / rain / snow **at each checkpoint's ETA** |
| Sampling interval | Risk level per checkpoint + miles per risk level per route |
| | **Recommended route** with a plain-language reason |
| | **48-hour corridor heatmap** with a scrubbable, playable timeline and moving trucks |
| | Departure-window comparison, shareable URL, dark & light themes, satellite basemap |

---

## 2. Quick start

### Prerequisites

- Python **3.12+**
- Node **20+**
- A free **OpenRouteService** API key — <https://openrouteservice.org/dev/#/signup> (optional: without it, use stub mode or the OSRM fallback)

### 2.1 Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate              # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                   # then set OPENROUTESERVICE_API_KEY
python manage.py runserver 127.0.0.1:8000
```

- Swagger UI: <http://127.0.0.1:8000/api/docs>
- Health check: <http://127.0.0.1:8000/api/health>

> **Never commit `backend/.env`.** It holds your API key and is already listed in `.gitignore`.

### 2.2 Frontend

```bash
cd frontend
npm install
npm run dev                            # http://localhost:5173
```

The Vite dev server proxies `/api` to `http://127.0.0.1:8000`, so no CORS setup is needed locally.

### 2.3 Offline demo (no API keys, no network)

Set `PROVIDER_MODE=stub` in `backend/.env`. Routing, geocoding and weather are then served by deterministic stub providers that include synthetic storms, so every risk level can be seen. The Playwright E2E suite uses this mode.

### 2.4 Docker (backend + Redis)

```bash
docker compose up --build
```

### 2.5 Production build

```bash
cd frontend
VITE_API_BASE_URL=https://your-backend.example.com npm run build   # output in dist/
```

Backend in production: `gunicorn config.wsgi:application`, with `DJANGO_DEBUG=false`, a real `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` and, ideally, `REDIS_URL`.

---

## 3. Configuration

All backend settings come from environment variables (`backend/.env`).

| Variable | Default | Purpose |
|---|---|---|
| `PROVIDER_MODE` | `live` | `live` = real APIs, `stub` = offline deterministic providers |
| `ROUTING_CHAIN` | `ors,osrm,detour` | Routing providers tried in order |
| `OPENROUTESERVICE_API_KEY` | — | Truck (HGV) routing + geocoding |
| `OSRM_BASE_URL` | `https://router.project-osrm.org` | Fallback routing |
| `CAR_TO_TRUCK_DURATION_FACTOR` | `1.13` | Scales car-profile durations to truck speed |
| `WEATHER_CACHE_TTL_SECONDS` | `1800` | Forecast cache lifetime |
| `REDIS_URL` | empty | Shared cache; falls back to in-process memory cache |
| `HTTP_TIMEOUT_SECONDS` | `10` | Upstream timeout |
| `API_THROTTLE_RATE` | `120/min` | Anonymous rate limit |
| `RISK_RULES_JSON` | built-in | Override every risk threshold without code changes |
| `DJANGO_DEBUG`, `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `LOG_LEVEL` | dev values | Standard Django settings |

Frontend: `VITE_API_BASE_URL` (empty in development because of the proxy).

---

## 4. Backend architecture

### 4.1 Hexagonal (ports & adapters)

```
            ┌─────────────────────────── api/ (DRF views, serializers) ─────────────────┐
HTTP  ───►  │  validate request  ─►  application/ use-case  ─►  serialize response        │
            └──────────────────────────────────┬────────────────────────────────────────────┘
                                               │ depends on Protocols (ports)
            ┌──────────────────────────────────▼──────────────────────────────────────────┐
            │ domain/  — pure Python, no Django, no HTTP                                  │
            │   models · geo · sampling · weather interpolation · risk engine · ranking   │
            │   route overlap · corridor grid · departure window · advisories            │
            └──────────────────────────────────▲──────────────────────────────────────────┘
                                               │ implemented by
            ┌──────────────────────────────────┴──────────────────────────────────────────┐
            │ adapters/ — OpenRouteService · OSRM · detour · Open-Meteo · cache · stubs   │
            └─────────────────────────────────────────────────────────────────────────────┘
                    container.py is the only place that builds concrete classes
```

```
backend/
├── config/            Django settings, URLs, WSGI
├── core/              HTTP client (retry, concurrency), errors, metrics, middleware, logging
├── trips/
│   ├── domain/        business rules (framework-free, fully unit-tested)
│   │   └── risk/      thresholds · rules · evaluator · config · intensity
│   ├── adapters/      external services behind ports
│   ├── application/   use-cases: plan trip, heatmap, departure window, geocode
│   ├── api/           views, serializers, URLs
│   └── container.py   composition root (dependency wiring)
└── loadtest/          Locust scenarios + response invariants
```

### 4.2 SOLID in practice

| Principle | Where |
|---|---|
| **S**ingle responsibility | Sampler only samples; evaluator only rates risk; ranker only ranks; each adapter only calls one API and maps its response. |
| **O**pen/closed | A new hazard (ice, visibility) is a new `RiskRule`. A new provider is a new adapter registered in the container. Existing code is untouched. |
| **L**iskov substitution | Real adapters, stubs and test fakes honour the same port contract and are interchangeable. |
| **I**nterface segregation | Three small ports: `Geocoder`, `RoutingProvider`, `WeatherProvider`. |
| **D**ependency inversion | Services receive Protocols through their constructors; only `container.py` knows concrete classes. |

### 4.3 Design patterns (only where they earn their place)

| Pattern | Where | Why |
|---|---|---|
| **Strategy** | `RiskRule`, `RankingCriterion` | Rules and ranking order are lists of small objects; reorder or extend without editing logic. |
| **Chain of Responsibility** | Routing chain `ors → osrm → detour` | Keeps collecting routes until there are 3 distinct ones. |
| **Decorator** | `CachedWeatherProvider`, `TruckSpeedAdjustedRoutingProvider` | Adds caching / truck-speed scaling without touching the wrapped provider. |
| **Factory / Registry** | `container.py` | `ROUTING_CHAIN` and `PROVIDER_MODE` pick implementations by name. |
| **Facade / Use-case** | `PlanTripService` and friends | Views call one method. |
| **Value Object** | frozen, slotted dataclasses | Immutable domain data; no accidental mutation. |

Deliberately **not** used: microservices, task queues, GraphQL, user accounts — over-engineering for this scope.

### 4.4 Cross-cutting

- **Resilience:** retries with back-off and concurrent fetching in `core/http.py`; graceful fallback between routing providers.
- **Caching:** forecasts cached per rounded coordinate (Redis if configured, otherwise in-memory).
- **Observability:** request-ID middleware, structured access log, per-request upstream metrics.
- **Errors:** one JSON error shape for validation, upstream and unexpected failures.
- **Contract:** OpenAPI schema generated by drf-spectacular and consumed by the frontend.

---

## 5. Core logic

### 5.1 Pipeline

```
geocode ─► 3 routes ─► sample checkpoints ─► ETA per checkpoint ─► forecast at ETA ─► risk per checkpoint
                                                                                          │
                       recommendation + reason ◄─ rank routes ◄─ miles per risk level ◄──┘
```

1. **Routes.** OpenRouteService `driving-hgv` (truck profile) first. ORS rejects alternatives on long trips, so OSRM fills the remaining slots, and a synthetic detour is the last resort. Routes overlapping **> 80 %** are treated as duplicates.
2. **Truck speed.** OSRM only has a car profile. Its durations are multiplied by `CAR_TO_TRUCK_DURATION_FACTOR` (1.13) and the UI tells the user the route was car-routed with times scaled to truck speed.
3. **Sampling.** A checkpoint every 10 / 25 / 50 miles along the geometry, plus the destination.
4. **ETA.** `departure + cumulative drive time` at that distance. All times are UTC internally.
5. **Weather at ETA.** Hourly Open-Meteo forecast, **linearly interpolated to the exact ETA** — not "weather now".
6. **Risk.** Each factor is rated; the checkpoint takes the **maximum** level.

### 5.2 Risk rules (from the assessment)

Lower bounds are inclusive. Sustained wind is used, not gusts.

| Factor | Moderate | High | Severe | No Travel |
|---|---|---|---|---|
| Wind (mph) | ≥ 25 | ≥ 35 | ≥ 45 | ≥ 55 |
| Rain (in/hr) | ≥ 0.10 | ≥ 0.25 | ≥ 0.50 | > 1.00 |
| Snow (in/hr) | ≥ 0.5 | ≥ 1.0 | ≥ 2.0 | > 3.0 |

Load escalations:

| Load | Wind | Becomes |
|---|---|---|
| > 30,000 lb | 45 – < 55 mph | **No Travel** |
| > 40,000 lb | 35 – < 45 mph | **Severe** |

Rules live as data in `trips/domain/risk/config.py` and can be overridden with `RISK_RULES_JSON`.

### 5.3 Ranking

Routes are compared criterion by criterion; the first one that separates them wins **and** produces the explanation shown in the UI:

1. fewer **No Travel** miles
2. fewer **Severe** miles
3. fewer **High** miles
4. lower **average risk**
5. shorter **travel time** (tie-breaker only)

Example reasons: "12.0 fewer Severe miles than Route B", "53 min faster than Route B".

### 5.4 48-hour corridor heatmap

- A grid around the route corridor: points every 25 mi along the route, offset ±30 km and ±60 km sideways, snapped to 0.25°, **capped at 300 points** (Open-Meteo returned HTTP 429 at ~680).
- Each point gets `h0 … h48`: a heat value per hour after departure.
- Heat value = max(continuous weather intensity, risk level ÷ 4), where intensity = max(wind ÷ 55, rain ÷ 1.0, snow ÷ 3.0) capped at 1. Calm weather fades out; dangerous weather is never under-drawn.

### 5.5 Departure window

Re-plans the same trip for later departures and reports whether leaving later avoids risk.

---

## 6. Frontend architecture

Feature-sliced layout; dependencies point one way: `app → features → entities / stores → shared`.

```
frontend/src/
├── app/         App shell, URL ⇄ state sync, plan lifecycle, keyboard shortcuts
├── features/
│   ├── trip-form/         search, map-click picking, departure, interval, load, sticky CTA
│   ├── route-list/        ranked route cards with risk bars and reasons
│   ├── map/               MapView + one component per layer (routes, checkpoints, heatmap, trucks, endpoints)
│   ├── timeline/          48 h scrubber, playback, weather gradient track, legend
│   ├── checkpoint-details/ drawer with ETA, conditions and the rule that fired
│   ├── departure-window/  leave-now vs leave-later card
│   ├── toolbar/           layer toggles, Map/Satellite, share, theme
│   └── warnings/, map-status/
├── entities/    domain helpers: risk colour & heat scale, route timeline/insights, trip queries
├── stores/      Zustand slices: trip draft, timeline, selection, layers, basemap
└── shared/      API client + generated types, UI primitives, geometry/format utils, map styles, theme
```

| Concern | Choice | Reason |
|---|---|---|
| Server state | **TanStack Query** | Caching, retries, loading/error states in one place |
| UI state | **Zustand** slices with selectors | No prop drilling; components re-render only on what they read |
| Form | Draft store + **zod** | Map clicks, sample chips, shared URLs and the departure card all write the same draft; same validation rules as the backend |
| API types | **Generated** from the backend OpenAPI schema (`npm run generate:api`) | Frontend and backend contracts cannot drift |
| Map | **MapLibre GL directly**, thin hooks (`useGeoJsonLayers`) | Full control over when paint/data change; per-frame work stays outside React |
| Styling | Tailwind + CSS-variable design tokens | One source for colours in both themes |
| Motion | CSS only, honours `prefers-reduced-motion` | Polish with zero JS animation cost |

### 6.1 Smooth heatmap scrubbing

The slider is the hot path, so nothing on it goes through React rendering:

- Heatmap data (`h0 … h48`) is uploaded **once**.
- Two heatmap layers exist: one shows an **even** hour, one an **odd** hour. Scrubbing between hours only **cross-fades their opacity** — a cheap paint change. The weight expression changes only when a whole hour is crossed. (A per-frame data-driven weight change forced a worker re-layout and stuttered — that was the first version.)
- Trucks are DOM markers moved with CSS transforms, not a GeoJSON source re-uploaded every frame.
- Timeline subscribers use `useTimelineHourEffect`, a store subscription that bypasses React state.
- The dark basemap is recoloured to the app's navy palette so the map reads well with the heatmap off.

---

## 7. Frontend practices

- **TypeScript strict** with `noUncheckedIndexedAccess`; no `any`.
- **Self-explanatory names, no comments**, small single-purpose modules (same rule in the backend).
- **Accessibility:** keyboard-operable everything, ARIA slider with readable value text, focus rings, skip link, axe scan in E2E.
- **Keyboard:** `Space` play/pause · `←` / `→` step one hour · `Esc` close details.
- **Responsive:** desktop control-room layout; panels become bottom sheets under 960 px.
- **Shareable state:** the whole trip is encoded in the URL.
- **Resilience:** safe `localStorage` wrapper, error toasts, skeleton loading, lazy-loaded map chunk.
- **Themes:** dark & light, follows OS preference, manual toggle persisted; map style follows the theme.

---

## 8. API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness |
| GET | `/api/geocode?query=denver&limit=5` | Place search |
| POST | `/api/trips/plan` | Routes, checkpoints, risk, recommendation |
| POST | `/api/trips/departure-window` | Compare later departure times |
| POST | `/api/trips/heatmap` | Corridor heat grid for hours 0–48 (GeoJSON) |
| GET | `/api/schema` · `/api/docs` | OpenAPI schema · Swagger UI |

Example:

```bash
curl -X POST http://127.0.0.1:8000/api/trips/plan \
  -H "Content-Type: application/json" \
  -d '{
        "origin":      {"latitude": 41.8781, "longitude": -87.6298},
        "destination": {"latitude": 38.6270, "longitude": -90.1994},
        "departure": "2026-11-12T14:00:00Z",
        "load_pounds": 42000,
        "interval_miles": 25
      }'
```

See Swagger UI for the exact request and response schemas.

---

## 9. Testing & quality gates

### Backend

```bash
cd backend
ruff check . && ruff format --check .
mypy
pytest --cov
```

- **179 tests**: domain unit tests, property-based tests (Hypothesis), adapter tests with mocked HTTP (respx), API tests.
- **Golden scenarios** prove every risk boundary and load escalation.
- Load test: `locust -f loadtest/locustfile.py` — every response is checked against invariants (`loadtest/plan_invariants.py`).

### Frontend

```bash
cd frontend
npm run lint && npm run format:check && npm run typecheck
npm run test:coverage      # Vitest + Testing Library + MSW, coverage thresholds enforced
npm run test:e2e           # Playwright on the stub backend: desktop-dark + mobile-light + axe
```

- **106 unit tests**, ~90 % coverage (thresholds at 80 %).
- **12 E2E tests**: plan, share-URL restore, scrub & play, theme toggle, validation, accessibility.

### CI

GitHub Actions workflows (`.github/workflows/`) run lint, type checks and tests for each app on push and pull request when its files change.

---

## 10. Trade-offs & known limits

- **Truck routing:** only ORS has a true truck profile. OSRM routes use an estimated truck speed and are labelled as such.
- **Public APIs:** Open-Meteo, OSRM and ORS have rate limits. Responses are cached and the heatmap grid is capped at 300 points.
- **Forecast horizon:** 48 hours from departure for the heatmap; departure can be up to 14 days ahead.
- **Not included by design:** user accounts, persistence of trips, background jobs.

---

## 11. Further reading

- [`docs/BACKEND_ARCHITECTURE.md`](docs/BACKEND_ARCHITECTURE.md) — decisions D1–D18, API contract, golden scenarios, load-test plan
- [`docs/FRONTEND_ARCHITECTURE.md`](docs/FRONTEND_ARCHITECTURE.md) — decisions F1–F13, layout, performance strategy, implementation notes
- [`docs/design/mockup.html`](docs/design/mockup.html) — original "Night Dispatch" design mockup
- [`backend/README.md`](backend/README.md) · [`frontend/README.md`](frontend/README.md)
