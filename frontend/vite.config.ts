import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vitest/config";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === "analyze" &&
      visualizer({ filename: "dist/bundle-report.html", gzipSize: true, brotliSize: true }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: { "/api": { target: BACKEND_URL, changeOrigin: true } },
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 850,
    rollupOptions: {
      output: {
        manualChunks: {
          maplibre: ["maplibre-gl"],
          vendor: ["react", "react-dom", "@tanstack/react-query", "zustand", "zod"],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    env: { VITE_API_BASE_URL: "http://api.test" },
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/index.ts",
        "src/test/**",
        "src/shared/api/schema.d.ts",
        "src/main.tsx",
        "src/features/map/MapView.tsx",
        "src/features/map/mapContext.ts",
        "src/features/map/truckIcon.ts",
        "src/features/map/hooks/**",
        "src/features/map/layers/**",
      ],
      thresholds: { lines: 80, functions: 75, branches: 80, statements: 80 },
    },
  },
}));
