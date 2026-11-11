const configuredApiBaseUrl: unknown = import.meta.env.VITE_API_BASE_URL;

export const env = {
  apiBaseUrl:
    typeof configuredApiBaseUrl === "string" ? configuredApiBaseUrl.replace(/\/$/, "") : "",
} as const;
