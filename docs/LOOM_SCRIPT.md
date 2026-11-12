# Loom Walkthrough Script

Target length: **~9 minutes** (the brief asks for 5–10). About 1,250 spoken words at a relaxed pace.
Each scene has **Do** (what to show) and **Say** (word-for-word narration). Pause 2–3 seconds after each action so the screen catches up.

---

## Before you hit record

- [ ] Hosted app open: <https://spotter-weather-routing-coral.vercel.app>
- [ ] GitHub repo open in a second tab: <https://github.com/ShivamKaushik316/spotter-weather-routing>
- [ ] Plan 2–3 trips beforehand and pick the one where the heatmap shows **Moderate or worse** weather. Use that trip in Scene 3.
- [ ] VS Code open with these tabs, zoomed to ~130%:
  - `backend/trips/domain/risk/config.py`
  - `backend/trips/domain/ranking.py`
  - `backend/trips/container.py`
  - `frontend/src/features/map/layers/HeatmapLayer.tsx`
- [ ] **Never open `backend/.env` on screen** — it contains the API key.
- [ ] Browser zoom 100%, notifications off, extra tabs closed.

---

## Scene 1 · Hook — 0:00 to 0:25

**Do:** App home page, dark theme. Hover the URL bar for a second.

**Say:**
> Hi, I'm Shivam, and this is my submission for the Spotter full-stack assessment.
> It's called Night Dispatch. It helps a truck driver pick the safest route — not using the weather right now, but the weather the truck will actually hit, at the exact time it reaches each point on the road.
> It's built with React and Django, and it's live on Vercel.

---

## Scene 2 · Inputs — 0:25 to 1:10

**Do:** Type a city in the origin box and show the suggestions. Then click on the map to drop the destination.

**Say:**
> Let's plan a trip. I can search for a place — the autocomplete goes through my own backend — or I can just click on the map to drop the origin and the destination.

**Do:** Point at the departure time, then click 10, 25 and 50 miles.

**Say:**
> Next is the departure time, and how often to sample the weather: every 10, 25 or 50 miles, exactly as the brief asks.

**Do:** Drag the load slider from about 25,000 to 42,000 lb. Pause on the heavy-load message.

**Say:**
> And this is the load weight. Notice the colors on the slider. Above 30,000 pounds and above 40,000 pounds, the wind rules get stricter — and the panel tells me which heavy-load rules are now active. So the form doesn't just collect input, it explains the rules.

---

## Scene 3 · Routes and recommendation — 1:10 to 2:50

**Do:** Click **Find safest route**. Wait for the three route cards.

**Say:**
> Within a few seconds I get three route options.
> Route A comes from OpenRouteService using a real heavy-goods-vehicle profile. Routes B and C come from OSRM, which only has a car profile — so I scale their driving times to typical truck speeds, and the card says that openly instead of pretending.

**Do:** Point at the **Recommended** badge and read the reason line under it.

**Say:**
> The app recommends one route and tells me why, in plain English.
> The ranking follows the brief's order: fewest Severe miles first, then fewest High miles, then the lowest average risk, and travel time only as the final tie-breaker. I added one extra rule in front — fewest No Travel miles — because a No Travel stretch is worse than a Severe one, and the brief's list doesn't mention it.

**Do:** Point at the miles, drive time, severe-miles and average-risk numbers, then the colored risk bar.

**Say:**
> Each card shows distance, driving time, Severe-plus miles, average risk, and this bar shows how many miles fall into each risk level.

**Do:** Click a checkpoint dot on the map. The details drawer opens.

**Say:**
> Every dot on the map is a checkpoint, colored by its risk. When I open one, I see its ETA, the forecast wind, rain and snow at that exact hour, and the exact rule that fired. The forecast is hourly, so I interpolate between the two nearest hours to match the ETA.

**Do:** Go back to the load slider, raise it above 40,000 lb, click **Update routes**, and show a checkpoint or card that changed.

**Say:**
> And here's the load rule in action. Same route, same weather — but with more than 40,000 pounds, wind between 35 and 44 miles per hour becomes Severe, and with more than 30,000 pounds, 45 to 54 becomes No Travel. The recommendation updates on its own.

---

## Scene 4 · Heatmap and timeline — 2:50 to 4:20

**Do:** Slowly drag the timeline slider from 0 to about 30 hours.

**Say:**
> Now the part I enjoyed building most: the 48-hour corridor heatmap.
> The timeline at the bottom covers 48 hours from departure. The track itself is a weather gradient, so before I even touch it, I can see when the bad weather arrives.
> As I scrub, the heatmap along the corridor updates, and the truck markers move to where each truck would be at that hour.

**Do:** Press **Play**. Switch the speed 1×, 4×, 8×. Then pause with **Space** and step with the arrow keys.

**Say:**
> I can play it as an animation, change the speed, and control it from the keyboard — space to play or pause, arrow keys to step one hour.

**Do:** Drag the slider again, slowly and steadily.

**Say:**
> Making this smooth was the hardest problem. My first version changed a data-driven heatmap expression on every frame, which made the map reprocess all its data — and it stuttered.
> So I redesigned it. The data is uploaded once. There are two heatmap layers — one shows an even hour, one an odd hour — and while I drag, I only crossfade their opacity. That's a very cheap GPU change. The trucks are moved with CSS transforms, and none of this goes through React rendering. That's why it stays smooth.

---

## Scene 5 · Product polish — 4:20 to 5:05

**Do:** Toggle Satellite, then back to Map. Toggle the light theme.

**Say:**
> There's a satellite basemap, and full dark and light themes.

**Do:** Click **Share**, paste the link in a new tab, show the same trip loading.

**Say:**
> The whole trip is stored in the URL, so a dispatcher can share a link and the other person sees exactly the same plan.

**Do:** Point at the **Best departure** card.

**Say:**
> This card checks the next few hours and tells me whether leaving later would be safer.

**Do:** Open DevTools device mode at phone size for a few seconds, then close it.

**Say:**
> It's fully responsive, keyboard accessible, and every build runs an automated accessibility check.

---

## Scene 6 · Backend architecture — 5:05 to 7:00

**Do:** GitHub tab → scroll the README to the architecture diagram.

**Say:**
> Let's look at the code. The backend follows a hexagonal architecture. The domain layer is pure Python — no Django, no HTTP — so all the business rules are easy to test. Adapters talk to the outside world, the application layer holds the use cases, and the API layer is a thin Django REST Framework layer.

**Do:** VS Code → `backend/trips/domain/risk/config.py`.

**Say:**
> The risk rules from the brief are data, not a wall of if-statements. Wind: 25 is Moderate, 35 High, 45 Severe, 55 and above No Travel. Rain and snow work the same way, and the load escalations are here too. A checkpoint takes the worst level across all factors.
> Because it's data, I can change any threshold with one environment variable, without touching code. And adding a new hazard, like ice or visibility, is just a new rule class. That's the open-closed principle.

**Do:** Open `backend/trips/domain/ranking.py`.

**Say:**
> Ranking is a list of criteria, compared in order. If you reorder the list, the recommendation logic changes. And the same criterion that decides the winner also writes the explanation you saw in the UI. That's the strategy pattern.

**Do:** Open `backend/trips/container.py`.

**Say:**
> This is the composition root — the only place that creates concrete classes. Routing is a chain of responsibility: OpenRouteService first, then OSRM, then a detour fallback, until I have three distinct routes. Routes that overlap more than 80 percent are treated as duplicates.
> Two things I learned from real testing: OpenRouteService refuses alternative routes on long trips, which is why the chain exists. And Open-Meteo rate-limited me at around 680 points, so the heatmap grid is capped at 300. Weather calls are cached, run concurrently, and retried on failure.

---

## Scene 7 · Frontend and quality — 7:00 to 8:10

**Do:** VS Code → collapse the `frontend/src` tree to show `app`, `features`, `entities`, `stores`, `shared`.

**Say:**
> The frontend uses a feature-sliced structure. TanStack Query handles server data, Zustand handles UI state, and zod validates the form before any request is sent.
> The API types are generated from the backend's OpenAPI schema, so the frontend and backend can never drift apart.

**Do:** Open `frontend/src/features/map/layers/HeatmapLayer.tsx`.

**Say:**
> I use MapLibre directly instead of a React wrapper, so I control exactly what changes on each frame. Here you can see the even-odd crossfade I talked about.

**Do:** GitHub tab → open the Actions tab or the README testing section.

**Say:**
> On quality: the backend has 179 tests, including golden scenarios that check every risk boundary and load rule. The frontend has about a hundred unit tests at roughly 90 percent coverage, plus Playwright end-to-end tests with an accessibility scan. TypeScript is strict, mypy and ruff are clean, and GitHub Actions runs all of it on every change.

**Do:** Open `/api/docs` on the hosted app.

**Say:**
> And the whole API is documented with Swagger.

---

## Scene 8 · Trade-offs and close — 8:10 to 8:50

**Do:** Back to the app, slider on an hour with visible weather.

**Say:**
> A few honest trade-offs. OSRM has no truck profile, so those routes use an estimated truck speed, and the app says so. The public routing and weather APIs have rate limits, so I cache aggressively and cap the heatmap grid. With more time, I'd add a shared Redis cache and a best-departure marker right on the timeline.
> It's deployed on Vercel as two services on one domain — the Vite frontend, and the Django API under slash API — and the README covers setup, architecture and every design decision.
> Thanks for watching. I'd be happy to go deeper into any part of it.

---

## If you run long

Cut in this order: Scene 5 (polish) → the Swagger moment in Scene 7 → the keyboard part of Scene 4.
Never cut Scene 3 or Scene 4 — together they cover 80% of the grade.
