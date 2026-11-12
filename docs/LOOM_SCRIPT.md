# Loom Walkthrough Script

Target length: **8–9 minutes** (assessment asks for 5–10).
Format: each section has **On screen** (what to show) and **Say** (what to speak). Speak naturally; the lines are a guide, not a teleprompter.

---

## Before you hit record

- [ ] Demo on the hosted app: <https://spotter-weather-routing-coral.vercel.app>
- [ ] Plan **Chicago → St. Louis** and **Denver → Dallas** once before recording so the first request is not a cold start.
- [ ] Keep the GitHub repo open in a second tab: <https://github.com/ShivamKaushik316/spotter-weather-routing>
- [ ] **Never open `backend/.env` on screen** — it contains the OpenRouteService API key.
- [ ] Close extra tabs, turn on Do Not Disturb, set browser zoom to 100%.
- [ ] Keep VS Code open with these files ready in tabs:
  - `backend/trips/domain/risk/config.py`
  - `backend/trips/domain/ranking.py`
  - `backend/trips/container.py`
  - `frontend/src/features/map/layers/HeatmapLayer.tsx`
  - `docs/BACKEND_ARCHITECTURE.md`

---

## 0:00 – 0:30 · Intro

**On screen:** Hosted app home page, dark theme, empty map. Show the URL bar briefly.

**Say:**
> Hi, I'm Shivam. This is my submission for the Spotter full-stack assessment — a weather-aware truck routing app. You give it an origin, a destination, a departure time and the load weight. It builds three candidate routes, forecasts the weather each truck will actually hit at the time it gets there, scores every stretch with the assessment's risk rules, and recommends the safest route. Stack is React with TypeScript on the front, Django REST on the back.

---

## 0:30 – 2:30 · Product demo (the happy path)

**On screen:** Left panel.

**Say:**
> Let me plan a trip. I can type a city — this autocomplete goes through our own backend geocode endpoint — or click straight on the map to drop the origin and destination.

**Do:** Click the **Chicago → St. Louis** sample chip.

**Say:**
> Departure time defaults to the next hour. I can choose to sample the weather every 10, 25 or 50 miles. And here's the load weight slider — notice the colours: above 30,000 pounds and above 40,000 pounds the wind rules get stricter, and the panel tells you which heavy-load rules are active.

**Do:** Click **Find safest route**. Wait for results.

**Say:**
> We get three routes. Route A is ranked first and recommended, and the app explains *why* in plain language — for example "fewer Severe miles than Route B", or if risk is tied, "53 minutes faster". Each route card shows distance, duration, and a risk bar showing how many miles fall in each risk level.

**Do:** Hover/click a route card, then click a checkpoint dot on the map.

**Say:**
> On the map, every checkpoint is coloured by its risk. Clicking one shows the ETA at that point, the forecast wind, rain and snow at *that* hour, and exactly which rule fired — for example "Wind 38 mph with 42,000 lb load → Severe".

**Do:** Toggle **Alternates**, **Checkpoints**, **Heatmap** in the toolbar. Switch **Map / Satellite**. Toggle the theme button.

**Say:**
> Layers can be toggled, there's a satellite basemap, and both dark and light themes are fully supported.

**Do:** Click **Share**, then paste the URL in a new tab.

**Say:**
> The whole trip lives in the URL, so a dispatcher can share a link and the other person sees the exact same plan.

---

## 2:30 – 3:45 · The 48-hour heatmap and timeline

**On screen:** Bottom timeline dock + map.

**Say:**
> This is the part I spent the most time on. The bottom timeline covers 48 hours from departure. The track itself is a gradient of the corridor's weather over time, so you can see at a glance when the bad weather arrives.

**Do:** Drag the slider slowly from 0 to ~30 h. Then press **Play**, switch speed 1× / 4× / 8×.

**Say:**
> As I scrub, the heatmap over the route corridor updates live, and the truck markers move along each route to where the truck would be at that hour. Play animates it.
>
> Making this smooth was the tricky bit. My first version changed a data-driven heatmap weight on every frame, which forces MapLibre to re-process the data on a worker thread — it stuttered. Now I keep two heatmap layers, one for even hours and one for odd hours, and the slider only cross-fades their opacity between whole hours. Opacity is a cheap paint change, so scrubbing stays smooth. The trucks are plain DOM markers moved with CSS transforms instead of re-uploading GeoJSON each frame.

**Do (optional):** Open the departure-window card on the right.

**Say:**
> There's also a departure-window card, which compares leaving now against leaving a few hours later.

---

## 3:45 – 6:15 · Backend: logic and architecture

**On screen:** VS Code → `docs/BACKEND_ARCHITECTURE.md`, then the code files.

**Say:**
> The backend uses a hexagonal layout. `domain` is pure Python with no Django and no HTTP. `adapters` talk to the outside world. `application` holds the use cases. `api` is the thin DRF layer, and `container.py` wires everything together.

**Do:** Open `backend/trips/domain/risk/config.py`.

**Say:**
> The risk rules from the brief are data, not if-statements. Wind: 25 mph is Moderate, 35 High, 45 Severe, 55 and above No Travel. Rain and snow follow the same pattern in inches per hour. The load rules are escalations: over 30,000 pounds, 45 to 55 mph wind becomes No Travel; over 40,000 pounds, 35 to 45 mph becomes Severe. A checkpoint's level is the maximum across all factors. Every rule implements one small `RiskRule` protocol, so a new rule — say ice or visibility — is a new class, nothing else changes. That's open–closed in practice.

**Do:** Open `backend/trips/domain/ranking.py`.

**Say:**
> Ranking is a list of criteria compared in order, exactly as the brief asks: fewest Severe miles, then fewest High miles, then lowest average risk, then shortest travel time. I added one criterion in front of those — fewest No Travel miles — because a No Travel stretch is worse than a Severe one, and the brief's list doesn't mention it. The first criterion that separates two routes also produces the human-readable reason you saw in the UI.

**Say (sampling + time):**
> The key correctness point: weather is not "now". For every checkpoint I compute the ETA from departure plus the cumulative drive time, then interpolate the hourly forecast at that exact ETA, all in UTC. Routes that overlap more than 80% are treated as duplicates and replaced, so you really get three different options.

**Do:** Open `backend/trips/container.py`.

**Say:**
> Routing is a chain of responsibility: OpenRouteService with the heavy-goods-vehicle truck profile first, then the public OSRM server, then a synthetic detour as a last resort. ORS refuses alternative routes on long trips, so the chain fills the gaps. OSRM only has a car profile, so I wrap it in a decorator that scales its durations by 1.13 to approximate truck speed, and the UI labels those routes honestly. Weather comes from Open-Meteo through a caching decorator, fetched concurrently with retries. The heatmap grid is capped at 300 points because Open-Meteo returned 429s when I tried around 680.

**Say (quality):**
> Every decision is written up in the architecture docs — decisions D1 to D18 on the backend and F1 to F13 on the frontend — together with the golden test scenarios. The backend has 179 tests, and ruff and mypy are clean. There's also request-ID middleware, structured access logs and per-request metrics for upstream calls.

---

## 6:15 – 7:45 · Frontend architecture

**On screen:** VS Code → `frontend/src` tree.

**Say:**
> The frontend uses a feature-sliced structure: `shared` for API client, UI kit and config; `entities` for domain helpers like the heat colour scale and route insights; `stores` for Zustand state; and `features` for the trip form, route list, map, timeline and so on.
>
> The API types are generated from the backend's OpenAPI schema, so the frontend and backend can't drift apart. TanStack Query handles server state and caching, Zustand handles UI state, and zod validates the form before any request goes out.

**Do:** Open `frontend/src/features/map/layers/HeatmapLayer.tsx`.

**Say:**
> I used MapLibre directly instead of a React wrapper, so I control exactly when paint properties change. Each layer is its own small component that reads from the map context. You can see the even/odd crossfade here: the weight expression only changes when we cross a whole hour, and the per-frame work is just two opacity updates.

**Say (quality):**
> TypeScript is strict. There are 104 unit tests at around 90% coverage, and Playwright end-to-end tests run on a desktop dark and a mobile light profile, including an axe accessibility scan. CI runs lint, type-check and tests for both apps. The layout is responsive, keyboard shortcuts work, and reduced-motion is respected.

---

## 7:45 – 8:30 · Trade-offs and what I'd do next

**Say:**
> A few honest trade-offs. OSRM's public server has no truck profile, so those routes use an estimated truck speed and are labelled as such. Public weather and routing APIs have rate limits, so I cache aggressively and cap the heatmap grid. With more time I'd add a best-departure marker on the timeline, a Redis cache shared across instances, and a load test with published benchmarks.

---

## 8:30 – 8:45 · Close

**On screen:** Back to the app, slider at a point with visible weather.

**Say:**
> It's deployed on Vercel as two services on one domain — the Vite frontend and the Django API under `/api` — and the code is on GitHub with full setup and architecture docs in the README.
>
> That's the project — a truck routing app whose recommendation is based on weather at the time and place the truck will actually be. Thanks for watching, and I'd love to walk through any part in more detail.

---

## Recording tips

- If a live API is slow mid-recording, keep talking about what it is doing ("it's fetching forecasts for every checkpoint concurrently").
- Zoom VS Code to ~130% so the code is readable in Loom.
- If the recording goes over 10 minutes, cut the departure-window and Share sections first.
