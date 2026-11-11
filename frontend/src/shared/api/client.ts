import { z } from "zod";
import { env } from "@/shared/config/env";

const NETWORK_ERROR_STATUS = 0;

const errorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId: string | null,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  query?: Record<string, string | number>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query: RequestOptions["query"]): string {
  const url = `${env.apiBaseUrl}${path}`;
  if (!query) return url;
  const searchParams = new URLSearchParams(
    Object.entries(query).map(([name, value]) => [name, String(value)]),
  );
  return `${url}?${searchParams.toString()}`;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function toApiError(status: number, body: unknown, requestId: string | null): ApiError {
  const parsedError = errorBodySchema.safeParse(body);
  if (!parsedError.success) {
    return new ApiError(
      status,
      "unexpected_error",
      `Request failed with status ${status}.`,
      requestId,
    );
  }
  const { code, message, details } = parsedError.data.error;
  return new ApiError(status, code, message, requestId, details);
}

export async function requestJson<ResponseBody>(
  path: string,
  { method = "GET", body, query, signal }: RequestOptions = {},
): Promise<ResponseBody> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      signal,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(
      NETWORK_ERROR_STATUS,
      "network_error",
      "Could not reach the routing service. Check your connection and try again.",
      null,
    );
  }
  const requestId = response.headers.get("X-Request-ID");
  const responseBody = await readJson(response);
  if (!response.ok) throw toApiError(response.status, responseBody, requestId);
  return responseBody as ResponseBody;
}
