# Backend Architecture — Weather-Aware Truck Routing

> Status: **Design approved, implementation not started.**
> This document records the backend design and every decision taken so far.

---

## 1. Assignment Summary (source: `fs-assessment-spotter.pdf`)

Build a **React + Django** app that helps a truck driver pick the safest route based on **weather, load weight, and travel time**.

**User inputs:** origin & destination, departure date/time, load weight.

**App must:**
- Generate **3 route options** using a routing API.
- Sample weather every **10 / 25 / 50 miles**, using the truck's **estimated arrival time** at each checkpoint.
- Calculate weather risk using the risk/load rules below.
- Recommend the best route, balancing weather risk and travel time.
- Show all routes, checkpoints, risk levels, ETAs, and route summaries on a map.
- Show a **weather heatmap along the trip corridor** with a **0–48 hour forecast slider**.

### Risk thresholds

| Condition | Low | Moderate | High | Severe | No Travel |
|---|---|---|---|---|---|
| Wind | <25 mph | 25–34 | 35–44 | 45–54 | ≥55 mph |
| Rain | <0.10 in/hr | 0.10–0.25 | 0.25–0.50 | 0.50–1.00 | >1.00 |
| Snow | <0.5 in/hr | 0.5–1.0 | 1.0–2.0 | 2.0–3.0 | >3.0 |

### Load rules
- ≥55 mph → **No Travel** for any load
- 45–54 mph + >30,000 lb → **No Travel**
- 35–44 mph + >40,000 lb → **Severe**

### Recommendation order (from spec)
1. Fewest Severe miles
2. Fewest High miles
3. Lowest average risk
4. Shortest travel time

### Deliverables & grading
- GitHub repo, hosted app, 5–10 min Loom walkthrough.
- 40% routes/weather/risk/recommendation logic · 40% UI, map & heatmap smoothness/performance · 15% code quality · 5% docs & walkthrough.
- **"Prioritize correctness and clarity over extra features."**

---

## 2. Decisions & Assumptions

| # | Topic | Decision | Reason |
|---|---|---|---|
| D1 | Wind metric | Risk uses **sustained wind** (`wind_speed_10m`). Gusts are returned for display only. | Threshold tables are normally defined on sustained wind; gust-based rating would mark most routes red. |
| D2 | No Travel in ranking | **No-Travel miles are ranked first**, before Severe miles. | Spec omits No Travel; a route with 0 Severe but 20 No-Travel miles must never win. |
| D3 | Heatmap slider origin | Slider hour **0 = departure time**; label shows the real timestamp. | Weather during the trip is what matters to the driver. |
| D4 | Range boundaries | Lower bound **inclusive** (0.25 in/hr rain → High). No Travel: wind `≥55`, rain `>1.00`, snow `>3.0`. | Spec ranges overlap at edges; this matches the spec's explicit `≥` / `>` symbols. |
| D5 | Combining factors | Checkpoint level = **max** of wind, rain, snow levels (after load rules). | Worst condition governs safety. |
| D6 | Sampling interval | `interval_miles` is a **user input**, restricted to `10 / 25 / 50`. | Spec lists three values; user picks granularity. |
| D7 | Miles per checkpoint | Each checkpoint represents half the interval before and after it (clipped at route ends). | Converts point samples into "Severe/High miles". |
| D8 | Average risk | **Distance-weighted** mean of level scores (Low=0 … No Travel=4). | Short and long segments should not count equally. |
| D9 | Unavailable forecast | Checkpoint level = **Unknown**; request does not fail; warning returned. | Graceful degradation. |
| D10 | Routing provider | OpenRouteService `driving-hgv` (truck profile) first; fallback chain to OSRM, then via-point detours, until 3 distinct routes exist. | ORS public API may refuse alternative routes for long trips (~100 km limit) — **verify before implementation**. |
| D11 | Weather provider | Open-Meteo (free, hourly, no key, multi-location batch). Units: `wind_speed_unit=mph`, `precipitation_unit=inch` — rain **and snowfall** both return inches (verified). | Fits all requirements at zero cost. |
| D12 | Map library (frontend) | MapLibre GL (WebGL heatmap). | Spec doesn't mandate one; WebGL gives smooth heatmap slider (40% of grade). |
| D13 | Persistence | **No database.** Stateless API + cache only. | Nothing to persist; simpler to host. |
| D14 | Hosting | Deferred until features are done. | — |
| D15 | Weather at ETA | **Linear interpolation** between the two forecast hours around the ETA (e.g. ETA 6:44 → blend 6:00 and 7:00). Not rounded to nearest hour. | Rounding can shift weather by up to 59 min. |
| D16 | Time handling | All internal times in **UTC**; departure must carry a timezone; Open-Meteo called with `timezone=GMT`. | Avoids DST / local-time bugs. |
| D17 | Distinct routes | Two routes sharing >~80% of geometry are treated as duplicates and dropped. | "3 routes" must be genuinely different. |
| D18 | Rain/snow rate | Open-Meteo hourly `rain` / `snowfall` = total over the preceding hour → used directly as in/hr. | Matches spec unit without conversion. |

---

## 3. Architecture

Layered / hexagonal-lite. Dependencies point **inward** only.

```
┌──────────────┐     ┌───────────────────┐     ┌────────────────────┐
│ api (DRF)    │ ──▶ │ application       │ ──▶ │ domain (pure)      │
│ views,       │     │ use-cases /       │     │ models, geo, risk, │
│ serializers  │     │ services          │     │ sampling, ranking  │
└──────────────┘     └─────────┬─────────┘     └────────────────────┘
                               │ depends on
                               ▼
                     ┌───────────────────┐     ┌────────────────────┐
                     │ ports (Protocols) │ ◀── │ adapters           │
                     │ Geocoder, Routing,│     │ ORS, OSRM, Open-   │
                     │ Weather           │     │ Meteo, cache, chain│
                     └───────────────────┘     └────────────────────┘
                               ▲
                     container.py (composition root wires everything)
```

- **domain** — pure Python + frozen dataclasses. No Django, no HTTP. 100% unit-testable.
- **ports** — `typing.Protocol` interfaces. Application knows only these.
- **adapters** — concrete API clients. New provider = new class, nothing else changes.
- **application** — orchestrates domain + ports (use-cases).
- **api** — thin views: validate input → call use-case → serialize output. No business logic.
- **container.py** — the only place that knows concrete classes.

---

## 4. Folder Structure

```
backend/
  config/                       settings (env-driven), urls, wsgi/asgi
  core/
    http.py                     HttpClient (sync+async httpx, timeout, retry/backoff on 5xx/429)
    exceptions.py               domain errors + DRF exception handler
    middleware.py               RequestIdMiddleware
    logging.py                  structured JSON logging config
    timing.py                   Timer/Stopwatch for meta.timings_ms
  trips/
    domain/
      models.py                 LatLng, RouteGeometry, Step, Route, Checkpoint,
                                WeatherSample, RiskLevel(IntEnum), RiskResult,
                                RouteSummary, TripPlan, DepartureOption
      geo.py                    haversine, polyline walk, interpolate, perpendicular offset
      sampling.py               EtaEstimator, CheckpointSampler
      risk/
        thresholds.py           Thresholds value object
        rules.py                RiskRule protocol, ThresholdRule, LoadWindRule
        evaluator.py            RiskEvaluator
        config.py               builds rules from settings (config-driven)
      ranking.py                RankingCriterion strategies, RouteRanker, explanation
      corridor.py               heatmap grid generator
      departure.py              DepartureWindowOptimizer (Tier 3)
    ports.py                    Geocoder, RoutingProvider, WeatherProvider
    adapters/
      ors.py                    OrsGeocoder, OrsRoutingProvider
      osrm.py                   OsrmRoutingProvider
      open_meteo.py             OpenMeteoWeatherProvider (async batch)
      cached_weather.py         CachedWeatherProvider (Decorator)
      routing_chain.py          FallbackRoutingProvider (Chain of Responsibility)
      detour.py                 DetourRouteGenerator
    application/
      plan_trip.py              PlanTripService
      heatmap.py                CorridorHeatmapService
      geocode.py                GeocodeService
      departure_window.py       DepartureWindowService
    api/
      serializers.py
      views.py
      urls.py
    container.py                composition root + provider registry
    tests/
      unit/                     risk, sampling, ranking, geo, corridor, departure
      property/                 hypothesis tests
      adapters/                 recorded JSON fixtures + `responses`/`respx` mocks
      application/              use-cases with fakes
      api/                      endpoint tests
      fakes.py                  FakeGeocoder, FakeRouting, FakeWeather
      fixtures/                 recorded provider responses
docs/
  BACKEND_ARCHITECTURE.md       this file
  adr/                          Architecture Decision Records
Dockerfile
docker-compose.yml              backend + redis
.github/workflows/ci.yml
```

---

## 5. SOLID Mapping

| Principle | Where |
|---|---|
| **S** — Single Responsibility | Sampler only samples; evaluator only rates risk; ranker only sorts; adapter only calls an API and maps its response. |
| **O** — Open/Closed | New weather factor (ice, visibility) = new `RiskRule` registered in config. New provider = new adapter registered in container. Existing code untouched. |
| **L** — Liskov Substitution | Every adapter fully honours its port contract (same types, same error semantics). Fakes and real adapters are interchangeable — proven by tests. |
| **I** — Interface Segregation | Three small ports (`Geocoder`, `RoutingProvider`, `WeatherProvider`). ORS implements two, Open-Meteo one. No god-interface. |
| **D** — Dependency Inversion | Services receive Protocols via constructor. Only `container.py` constructs concrete classes. |

---

## 6. Design Patterns (only where they earn their place)

| Pattern | Where | Benefit |
|---|---|---|
| **Strategy** | `RiskRule`, `RankingCriterion` | Ranking order is a list: `[NoTravelMiles, SevereMiles, HighMiles, AvgRisk, Duration]`. Change order = change list. |
| **Decorator** | `CachedWeatherProvider(inner)` | Caching (and retry/logging) without touching the real client. |
| **Chain of Responsibility** | `FallbackRoutingProvider([ors, osrm, detour])` | Collects routes until 3 distinct ones exist; dedupes by geometry overlap. |
| **Factory / Registry** | `container.py` | `ROUTING_CHAIN=ors,osrm,detour` env var selects providers by name. |
| **Facade / Use-case** | `PlanTripService.execute()` | Views call one method. |
| **Value Object** | frozen dataclasses | Immutability prevents accidental mutation bugs. |

Deliberately **not** used: microservices, Celery/queues, GraphQL, auth/user accounts — over-engineering for this scope.

---

## 7. Core Logic

### 7.1 Risk engine
Thresholds are **data**, not if/else chains:

```python
WIND = Thresholds(unit="mph",   bounds=(25, 35, 45, 55),          no_travel_inclusive=True)
RAIN = Thresholds(unit="in/hr", bounds=(0.10, 0.25, 0.50, 1.00),  no_travel_inclusive=False)
SNOW = Thresholds(unit="in/hr", bounds=(0.5, 1.0, 2.0, 3.0),      no_travel_inclusive=False)
```

- `ThresholdRule(field, thresholds)` → level for one factor. Boundary handling lives in one place (D4).
- `LoadWindRule` — escalates the wind level by load (>30k lb: 45–54 mph → No Travel; >40k lb: 35–44 mph → Severe). **Only escalates, never lowers.**
- `RiskEvaluator(rules)` → runs all rules, takes the max, returns `RiskResult(level, reasons: list[str])`, e.g. `"Wind 38 mph + 42,000 lb load → Severe"`.
- Rules and thresholds are built from settings (`risk/config.py`) — editable without code changes.

### 7.2 Sampling & ETA
- Adapters normalise provider output into a common `RouteGeometry` (coordinates + steps with distance/duration).
- `EtaEstimator` builds a piecewise distance→time map from step durations, so ETAs reflect highway vs city speeds (not a flat average).
- `CheckpointSampler(interval_miles)` emits checkpoints at start, every N miles, and end. Each has `distance_mi`, `eta`, `represented_miles` (D7).

### 7.3 Weather
- All checkpoints across all routes are **deduped** by `(round(lat,1), round(lng,1), hour)`.
- Batched to Open-Meteo, ~100 locations per call; chunks fetched **concurrently** (`httpx` + `asyncio.gather`).
- Fields: `wind_speed_10m`, `wind_gusts_10m`, `rain`, `snowfall`, `precipitation`.
- Each checkpoint uses the forecast **linearly interpolated** between the two hours around its ETA (D15).
- `CachedWeatherProvider` caches per grid cell + hour (TTL ~30 min).
- Missing data → `Unknown` level + warning (D9).

### 7.4 Route summary & ranking
- `RouteSummary`: total miles, duration, `miles_by_level`, distance-weighted avg risk (D8), max level, `has_no_travel`.
- `RouteRanker` builds a tuple key from the criteria list and sorts. First = recommended.
- `explanation`: which criterion made the winner beat the runner-up (e.g. *"12 fewer Severe miles than Route B"*).

### 7.5 Corridor heatmap
- `corridor.py` builds a grid along all routes: every 25 mi, perpendicular offsets 0, ±30, ±60 km, snapped to a 0.25° grid, capped at 300 points. Sized to stay inside Open-Meteo's free quota (~600 location-calls/min): a denser grid (681 points) hit `HTTP 429` during live testing.
- One weather fetch per point gives hours 0–48 relative to departure (D3).
- Output: compact GeoJSON FeatureCollection; each point has properties `h0..h48` (risk score). Frontend switches hours by changing the heatmap-weight expression only — no data re-upload.

### 7.6 Best departure window (Tier 3 — built after core)
- Reuses the 48 h hourly weather already fetched for checkpoints.
- Re-evaluates each route with departure shifted by +1…+N hours (ETAs shift, weather lookup changes; no new API calls).
- Returns the best few options, e.g. *"Depart 3 h later → Severe miles 40 → 0"*.

---

## 8. API Contract

| Method | Endpoint | Input | Output |
|---|---|---|---|
| GET | `/api/health` | — | `{status: "ok"}` |
| GET | `/api/geocode?query=&limit=` | query string | `results[{label, latitude, longitude}]` + `meta` |
| POST | `/api/trips/plan` | `origin{latitude,longitude}`, `destination`, `departure`, `load_pounds`, `interval_miles` | `routes[]` (geometry, summary, checkpoints), `recommended_route_id`, `recommendation_reason`, `warnings[]`, `meta` |
| POST | `/api/trips/heatmap` | `routes` (GeoJSON `[lng,lat]` lines), `departure`, `load_pounds` | GeoJSON with `h0..h48` + `hours` + `meta` |
| POST | `/api/trips/departure-window` | same as plan + `window_hours` | ranked departure options |
| GET | `/api/docs` | — | Swagger UI (drf-spectacular) |

Heatmap is a separate endpoint so routes render fast and the heatmap loads in the background.

### Validation
- `load_pounds`: 0 – 80,000.
- `departure`: not in the past, ≤ 14 days ahead (forecast horizon).
- `interval_miles` ∈ {10, 25, 50}.
- Origin ≠ destination.

### Error format
`{ "error": { "code": "...", "message": "..." } }`

| Exception | HTTP |
|---|---|
| Validation error | 400 |
| `GeocodeNotFound` | 404 |
| `NoRouteFound` | 422 |
| `ProviderError` | 502 |

### `meta` block (Tier 1)
```json
"meta": {
  "request_id": "…",
  "timings_ms": { "routing": 820, "weather": 410, "risk": 3 },
  "cache_hits": 41,
  "providers_used": ["ors", "osrm"],
  "forecast_fetched_at": "…"
}
```

---

## 9. Cross-cutting Concerns

- **HttpClient** — shared `httpx` client, 10 s timeout, retry with backoff on 5xx/429, structured logging.
- **Config** — `django-environ`; `OPENROUTESERVICE_API_KEY`, `REDIS_URL`, `ROUTING_CHAIN`, `PROVIDER_MODE`, `CORS_ALLOWED_ORIGINS`, risk thresholds. No secrets in code.
- **Cache** — locmem in dev, Redis in Docker/prod.
- **Throttling** — DRF anon rate limit to protect API quotas.
- **CORS** — `django-cors-headers`, frontend origin only.
- **Observability** — `RequestIdMiddleware` (`X-Request-ID` in/out), JSON logs carry the request id.

---

## 10. Extras (approved: Tier 1, 2 and 3)

### Tier 1 — cheap, high signal
1. OpenAPI + Swagger UI (`drf-spectacular`) at `/api/docs`.
2. ADRs in `docs/adr/` (one per decision D1–D12).
3. GitHub Actions CI: ruff, mypy, pytest + coverage; badges in README.
4. Docker + docker-compose (backend + Redis).
5. Property-based tests (`hypothesis`).
6. `meta` block in responses (timings, cache hits, providers).
7. Request ID + structured JSON logs.

### Tier 2 — improves logic & performance
8. Async concurrent weather fetching.
9. Graceful degradation (Unknown level, warnings, provider fallback).
10. Config-driven risk rules.

### Tier 3 — differentiator
11. Best departure window suggestion.

---

## 11. Testing Strategy

Tooling: `pytest`, `pytest-django`, `pytest-cov`, `hypothesis`, `respx`/`responses`.

| Layer | What is tested |
|---|---|
| **Risk (unit)** | Parametrised boundary values: wind 24.99/25/34.99/35/44.99/45/54.99/55; rain 0.0999/0.10/0.25/0.50/1.00/1.01; snow 0.49/0.5/1.0/2.0/3.0/3.01. All load-rule combos (29,999 / 30,000 / 30,001 / 40,000 / 40,001 lb). Max-of-factors. Reasons text. |
| **Risk (property)** | Monotonicity: more wind/rain/snow/load never lowers the level. Level always in valid range. Load rules never lower a level. |
| **Geo / sampling** | Haversine known distances; route shorter than interval; route an exact multiple of interval; represented miles sum to route length; ETA monotonic and equal to total duration at the end. |
| **Ranking** | Each tie-breaker in isolation; No-Travel beats Severe (D2); explanation text. |
| **Corridor** | Grid point count, offsets, dedupe. |
| **Departure window** | Shifting departure picks a lower-risk window with fake weather. |
| **Adapters** | Recorded JSON fixtures → correct domain mapping; error/timeout → `ProviderError`; cache decorator hit/miss; fallback chain reaches 3 routes and dedupes. |
| **Application** | `PlanTripService` end-to-end with fakes; Unknown-weather degradation. |
| **API** | Validation errors (400), error format, happy path, `meta` present, OpenAPI schema generates. |

Quality gates: `ruff` (lint + format), `mypy --strict` on `domain/`, coverage target ≥ 90% on `domain/`. Enforced via pre-commit and CI.

### 11.1 Golden scenarios (correctness proof)

Hand-calculated scenarios stored as fixtures (`tests/golden/`). Each has fixed route geometry, fixed hourly weather, a load, and the **expected** checkpoints, ETAs, levels, miles-by-level, avg risk and recommended route — computed by hand and written in the fixture.

Examples:
- Light load vs heavy load on the same windy route (load rules flip the recommendation).
- All routes contain No-Travel miles (warning + departure-window suggestion).
- Tie on Severe & High miles → decided by avg risk; full tie → decided by duration.
- Exact boundary weather (25 mph, 0.25 in/hr, 3.0 in/hr).
- Route shorter than the interval; route an exact multiple of the interval.

The same scenarios are walked through in the README / Loom to show the maths.

### 11.2 Load & performance test

**Goal:** prove the API stays fast and correct under concurrent use, and publish the numbers.

- **Tool:** [Locust](https://locust.io) (Python, scripts live in `backend/loadtest/`).
- **Provider mode:** load tests run with `PROVIDER_MODE=stub` — stub adapters (registered in `container.py`) generate deterministic synthetic routes (curved lines) and moving storm weather, with optional artificial latency (`STUB_LATENCY_SECONDS`). Reason: hammering free public APIs would hit rate limits, burn quota, and measure *their* latency instead of ours. A separate small **live smoke run** (few users, real providers) reports real-world latency and cache-hit ratio.
- **Scenarios:**
  1. `POST /api/trips/plan` — mix of short (~100 mi), medium (~500 mi) and long (~1,500 mi) trips, all three intervals, random loads.
  2. `POST /api/trips/heatmap` — long corridor.
  3. Repeated identical trips — measures cache effectiveness.
- **Correctness under load:** every Locust response is validated, not just timed:
  - exactly 3 routes, one recommended, recommended == rank 1;
  - sum of `represented_miles` == route distance (±0.1 mi);
  - ETAs monotonic, last ETA == departure + duration;
  - levels match golden expectations for stubbed scenarios.
  Any violation counts as a failure.
- **Metrics reported:** RPS, p50 / p95 / p99 latency per endpoint, error rate, invariant-failure count, cache-hit ratio, per-stage timings from `meta.timings_ms` (routing / weather / risk).
- **Targets (initial, to be tuned after first run):** `plan` p95 < 500 ms on stubs, error rate 0%, invariant failures 0.
- **Output:** results, charts and the exact command used are written to `docs/BENCHMARKS.md` and linked from the README.

---

## 12. Build Order

1. Setup: project, tooling, CI, Docker, `core/` (request id, logging, HttpClient).
2. Domain + tests (incl. hypothesis).
3. Ports, fakes, `PlanTripService`.
4. Adapters: async Open-Meteo, ORS, OSRM, detour, cache decorator, fallback chain.
5. API layer, Swagger, `meta` timings, error handler.
6. Corridor heatmap service + endpoint.
7. Departure window (Tier 3).
8. Golden scenarios + load test (Locust, stub + live smoke) → `docs/BENCHMARKS.md`.
9. ADRs + README (link tests, coverage, benchmarks).

---

## 13. Open Items

- [ ] Verify ORS public API limit on `alternative_routes` for long trips (D10).
- [x] Open-Meteo `snowfall` unit with `precipitation_unit=inch` → **inch** (verified 2026-11-10 via `hourly_units`: `snowfall: "inch"`, `rain: "inch"`, `wind_speed_10m: "mp/h"`). No conversion needed.
- [ ] Get ORS API key (openrouteservice.org) → `.env`.
- [ ] Local env (checked 2026-11-10): Node v20.18.0 present. **Python not working** (`Python312` folder exists but `python.exe` missing — broken install). **Docker not installed.** Fix before setup.
- [ ] Frontend plan (MapLibre, slider, route cards) — separate document.
- [ ] Hosting choice — after features are done.
