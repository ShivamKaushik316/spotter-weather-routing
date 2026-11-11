# Backend — Weather-Aware Truck Routing

Django + DRF API that plans three truck routes, samples weather at each checkpoint's ETA,
rates risk with the spec's wind/rain/snow + load rules, and recommends the safest route.

Architecture and decisions: [`../docs/BACKEND_ARCHITECTURE.md`](../docs/BACKEND_ARCHITECTURE.md).

## Run locally

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env               # add OPENROUTESERVICE_API_KEY
python manage.py runserver
```

- API docs (Swagger): http://localhost:8000/api/docs
- Offline mode with deterministic stub providers: set `PROVIDER_MODE=stub` in `.env`.

With Docker (backend + Redis):

```bash
docker compose up --build
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness |
| GET | `/api/geocode?query=denver&limit=5` | Place search |
| POST | `/api/trips/plan` | 3 routes, checkpoints, risk, recommendation |
| POST | `/api/trips/departure-window` | Best departure time in the next N hours |
| POST | `/api/trips/heatmap` | Corridor risk grid, hours 0–48 |
| GET | `/api/docs` | Swagger UI |

## Quality gates

```bash
ruff check .
ruff format --check .
mypy
pytest --cov
```

## Load test

```bash
PROVIDER_MODE=stub gunicorn config.wsgi:application --workers 4
locust -f loadtest/locustfile.py --host http://localhost:8000 \
       --headless --users 50 --spawn-rate 10 --run-time 2m \
       --csv loadtest/reports/stub
```

Every plan response is checked against invariants (`loadtest/plan_invariants.py`); a violation
counts as a failure in the Locust report.
