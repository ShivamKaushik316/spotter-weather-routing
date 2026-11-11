import { defineConfig, devices } from "@playwright/test";

const FRONTEND_URL = "http://localhost:5173";
const BACKEND_HEALTH_URL = "http://127.0.0.1:8000/api/health";
const backendPython = process.env.BACKEND_PYTHON ?? "python";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: FRONTEND_URL,
    trace: "retain-on-failure",
    launchOptions: { args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] },
  },
  projects: [
    {
      name: "desktop-dark",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1600, height: 960 },
        colorScheme: "dark",
      },
    },
    { name: "mobile-light", use: { ...devices["Pixel 7"], colorScheme: "light" } },
  ],
  webServer: [
    {
      command: `${backendPython} manage.py runserver 127.0.0.1:8000 --noreload`,
      cwd: "../backend",
      url: BACKEND_HEALTH_URL,
      env: { PROVIDER_MODE: "stub", DJANGO_DEBUG: "true" },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "npm run dev -- --port 5173 --strictPort",
      url: FRONTEND_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
