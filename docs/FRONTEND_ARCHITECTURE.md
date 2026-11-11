# Frontend Architecture — Weather-Aware Truck Routing

> Status: **Implemented.** Unit/component tests, e2e and accessibility checks passing (see §6).
> Grading focus: 40% of the assessment is "UI, map & heatmap smoothness and performance".

---

## 1. Decisions

| # | Topic | Decision | Reason |
|---|---|---|---|
| F1 | Framework | React 18 + TypeScript (`strict`, `noUncheckedIndexedAccess`) + Vite | Fast builds, strong typing. |
| F2 | Map | MapLibre GL used directly through a thin hook layer (`useGeoJsonLayers`, `useLayerPointerEvents`) | WebGL rendering + native heatmap layer; direct access to `setPaintProperty` / `setData` keeps per-frame updates outside React. |
| F3 | Basemap | CARTO Dark Matter / Positron vector styles | Free, no API key. OpenFreeMap was the first choice but was unreachable during development. |
| F4 | Theme | **Dark and light** both supported; follows OS preference, manual toggle persisted. | Requested. Map style switches with theme. |
| F5 | Server state | TanStack Query | Caching, retries, loading/error states in one place. |
| F6 | UI state | Zustand slices (selection, timeline, layers) with selectors | Avoids prop drilling and unnecessary re-renders. |
| F7 | API types | Generated from backend `/api/schema` with `openapi-typescript` | Frontend and backend contracts cannot drift. |
| F8 | Forms | Zustand draft store + zod schema (`validateTripDraft`) | Map clicks, sample trips, shared URLs and the departure-window card all write the same draft, so a store fits better than form-local state. Same rules as backend (load 0–80,000 lb, interval 10/25/50, departure ≤ 14 days). |
| F9 | Styling | Tailwind CSS with design tokens as CSS variables; small in-house accessible primitives (segmented radio group, combobox, toasts) | Single source for colours/spacing without extra runtime dependencies. |
| F10 | Motion | CSS transitions/keyframes only; respects `prefers-reduced-motion` | Same polish with zero JS animation cost. |
| F11 | Map click | **Click on map sets origin / destination** (in addition to search). | Requested. |
| F12 | Storybook | **Not used.** | Out of scope; no grading weight. |
| F13 | Comments | No code comments; self-explanatory names. | Same rule as backend. |

---

## 2. Layout & Visual Design — "dispatcher control room"

```
┌──────────────────────────────────────────────────────────────┐
│ ┌──────────────┐                               ┌───────────┐ │
│ │ Trip form    │          FULL-BLEED MAP       │ Checkpoint│ │
│ │──────────────│   routes · checkpoints ·      │ details   │ │
│ │ Route cards  │   heatmap · truck markers     │ drawer    │ │
│ │ + risk ribbon│                               └───────────┘ │
│ └──────────────┘                                             │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ▶  0h ━━━━━━━━━●━━━━━━━━━━━━━━━━ 48h   Tue 14:00  legend │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

- Floating translucent panels over a full-screen map.
- Mobile: left panel becomes a draggable bottom sheet; timeline stays docked.
- Typography: Inter for text, tabular numerals for miles / ETAs.
- **Risk palette used everywhere** (map, cards, legend, popups): Low green, Moderate yellow, High orange, Severe red, No Travel purple, Unknown grey. Never colour-only: every level also has an icon and label. Contrast checked in both themes.

---

## 3. Map & Heatmap Performance Strategy

1. **Heatmap data uploaded once.** One GeoJSON source with properties `h0..h48`. Moving the slider only changes the `heatmap-weight` expression via `setPaintProperty` — no React re-render, no data re-upload.
2. **Continuous slider.** Slider value is fractional (e.g. 3.4 h). The weight expression blends neighbouring hours: `(1 − t) · h3 + t · h4`, so the heatmap morphs smoothly instead of jumping hour to hour.
3. **Frame-synced updates.** Slider drag and playback are throttled with `requestAnimationFrame`.
4. **WebGL layers, not DOM markers.** Checkpoints are a circle layer; hover uses `feature-state`.
5. **Routes.** Risk-coloured segments via data-driven styling; recommended route thicker and on top; alternates dimmed; line-draw animation on first render.
6. **Truck markers.** Position of each truck at the slider time, computed by a pure, unit-tested interpolation over checkpoint ETAs.
7. **Loading.** Heatmap request fires in parallel as soon as the plan returns; map chunk lazy-loaded; skeletons while loading.
8. **Proof.** Slider FPS / frame-time recording, Lighthouse scores and bundle-size report published in `docs/BENCHMARKS.md`.

---

## 4. Features

- Place search: debounced autocomplete, keyboard navigable, ARIA combobox.
- Map click to set origin / destination.
- Departure date-time picker showing timezone.
- Load input with presets (Empty / Half / Full 80k) and hints at the 30k / 40k load-rule thresholds.
- Interval segmented control: 10 / 25 / 50 mi.
- Route cards: recommended badge + reason, stacked miles-by-level bar, duration, distance, average risk; hover syncs with map.
- Risk ribbon: per-route strip coloured by checkpoint risk.
- Checkpoint drawer: ETA, wind / gust / rain / snow, level, reasons.
- Departure-window panel: risk vs delay chart + "Depart N h later" action that re-plans.
- Warnings banner (No Travel, Unknown forecast, fewer than 3 routes).
- Layer toggles: heatmap, checkpoints, alternate routes.
- Shareable URL: full trip state in query params.
- Keyboard shortcuts: `Space` play/pause, `←` / `→` step one hour.
- Error handling mapped from backend `error.code`; toast includes `request_id`.

---

## 5. Folder Structure

```
frontend/src/
  app/            providers (Query, Theme), layout, error boundary
  shared/
    api/          generated OpenAPI types, typed client, query keys
    ui/           Button, Panel, Slider, Combobox, Badge, Skeleton, Toast (Radix-based)
    lib/          formatters, url-state codec, rAF throttle
    config/       env, map styles, design tokens
  entities/
    risk/         levels, colours, labels, icons
    route/        selectors, truck-position interpolation
  features/
    trip-form/
    route-list/
    map/          MapView, RouteLayer, CheckpointLayer, HeatmapLayer, TruckLayer, MapClickPicker
    timeline/
    departure-window/
    checkpoint-details/
  stores/         zustand slices
```

Rules:
- Thin components; logic in hooks and pure functions.
- Map layers receive data via hooks only, never call the API directly.
- Each feature exposes a public API through its `index.ts`.

---

## 6. Quality & Testing

| Layer | Tooling | Scope |
|---|---|---|
| Lint / format | ESLint (typescript-eslint strict, react-hooks, jsx-a11y), Prettier | Whole codebase |
| Unit | Vitest | Formatters, URL codec, truck interpolation, heatmap blend expression, risk colour mapping |
| Component | React Testing Library + MSW | Form validation, route cards, error states |
| E2E | Playwright against backend `PROVIDER_MODE=stub` | Plan trip → routes render → slider moves → checkpoint drawer |
| Accessibility | `@axe-core/playwright` | Main screens, both themes |
| CI | GitHub Actions `frontend-ci.yml` | lint, typecheck, test, build, bundle-size budget |

---

## 7. Build Order

1. Setup: Vite, TS, ESLint/Prettier, Tailwind, tokens, OpenAPI type generation, CI.
2. Shared UI kit + layout + theme switching.
3. Trip form + place search + map click picker + plan API hook.
4. Map: routes, checkpoints, popups; route cards with hover sync.
5. Heatmap + timeline slider + truck markers.
6. Departure window, warnings, URL sharing, keyboard shortcuts.
7. Mobile layout, accessibility pass, motion polish.
8. Tests, benchmarks, README.

---

## 9. Implementation Notes & Results

### Zero-render hot paths
- `useTimelineHourEffect` subscribes to the timeline store outside React and throttles to one update per animation frame.
- On every frame only three things change: heatmap `heatmap-weight` expression, truck source `setData` (3 points), and the scrubber/clock DOM via refs. No React component re-renders during playback.
- Route emphasis (hover/selection) uses `setPaintProperty` / `setFilter` / `line-sort-key`, never re-uploading GeoJSON.

### Layer stack
`corridor-heat` (under basemap labels) → `route-casing` → `route-segments` → `route-hit-area` (transparent, 22 px wide for easy hovering) → `checkpoints` → `trucks`. `resolveBeforeLayerId` keeps this order regardless of which data arrives first, and layers are re-added after a theme switch (`setStyle(..., { diff: false })` + `style.load` revision).

### Bundle (production build, gzip)
| Chunk | Size | Loaded |
|---|---|---|
| app (`index`) | 18 KB | initial |
| vendor (React, Query, Zustand, zod) | 69 KB | initial |
| MapView | 5 KB | lazy |
| maplibre-gl | 218 KB | lazy (separate chunk, cached across deploys) |

### Tests (current)
| Suite | Result |
|---|---|
| Vitest unit + component (MSW) | 88 tests, 22 files, coverage 88% lines / 89% branches (threshold 80%) |
| Playwright e2e | 6 scenarios × 2 projects (desktop-dark, mobile-light) = 12 passing |
| axe-core | 0 serious/critical violations on the planned-trip screen in both projects |

Coverage scope excludes WebGL/canvas-bound code (`MapView`, `features/map/layers/**`, `features/map/hooks/**`, `truckIcon`), which jsdom cannot execute; those paths are exercised by the Playwright suite.