# Frontend — Night Dispatch

React + TypeScript + MapLibre GL client for the weather-aware truck routing API.
Architecture and decisions: [`../docs/FRONTEND_ARCHITECTURE.md`](../docs/FRONTEND_ARCHITECTURE.md).

## Run locally

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173, proxies /api to http://127.0.0.1:8000
```

Start the backend first (`../backend`, see its README). For an offline demo with synthetic
storms, run the backend with `PROVIDER_MODE=stub`.

Production build: set `VITE_API_BASE_URL` to the backend origin, then `npm run build`.

## Scripts

| Command                         | Purpose                                                                    |
| ------------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`                   | Dev server with API proxy                                                  |
| `npm run build`                 | Type check + production build                                              |
| `npm run lint`                  | ESLint (typescript-eslint strict, react-hooks, jsx-a11y)                   |
| `npm run format:check`          | Prettier                                                                   |
| `npm run typecheck`             | TypeScript project references                                              |
| `npm run test:coverage`         | Vitest + Testing Library + MSW, coverage thresholds enforced               |
| `npm run test:e2e`              | Playwright against the stub backend, desktop-dark + mobile-light, axe scan |
| `npm run generate:api`          | Regenerate `schema.d.ts` from the backend OpenAPI schema                   |
| `npx vite build --mode analyze` | Bundle report at `dist/bundle-report.html`                                 |

## Keyboard

| Key       | Action                    |
| --------- | ------------------------- |
| `Space`   | Play / pause the forecast |
| `←` / `→` | Step one hour             |
| `Esc`     | Close checkpoint details  |
