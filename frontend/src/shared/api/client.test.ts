import { http, HttpResponse } from "msw";
import { API_BASE_URL, server } from "@/test/server";
import { ApiError, requestJson } from "./client";
import { shouldRetryRequest } from "./queryClient";

describe("requestJson", () => {
  it("maps the backend error envelope to ApiError with the request id", async () => {
    server.use(
      http.post(`${API_BASE_URL}/api/trips/plan`, () =>
        HttpResponse.json(
          { error: { code: "no_route_found", message: "No drivable route." } },
          { status: 422, headers: { "X-Request-ID": "abc123" } },
        ),
      ),
    );

    const failure = requestJson("/api/trips/plan", { method: "POST", body: {} });

    await expect(failure).rejects.toMatchObject({
      name: "ApiError",
      status: 422,
      code: "no_route_found",
      message: "No drivable route.",
      requestId: "abc123",
    });
  });

  it("reports unexpected error bodies generically", async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/health`, () => new HttpResponse("oops", { status: 500 })),
    );

    await expect(requestJson("/api/health")).rejects.toMatchObject({
      code: "unexpected_error",
      status: 500,
    });
  });

  it("reports network failures as network_error", async () => {
    server.use(http.get(`${API_BASE_URL}/api/health`, () => HttpResponse.error()));

    await expect(requestJson("/api/health")).rejects.toMatchObject({ code: "network_error" });
  });

  it("serialises query parameters", async () => {
    let receivedUrl = "";
    server.use(
      http.get(`${API_BASE_URL}/api/geocode`, ({ request }) => {
        receivedUrl = request.url;
        return HttpResponse.json({ results: [] });
      }),
    );

    await requestJson("/api/geocode", { query: { query: "den ver", limit: 5 } });

    expect(receivedUrl).toBe(`${API_BASE_URL}/api/geocode?query=den+ver&limit=5`);
  });
});

describe("shouldRetryRequest", () => {
  it("does not retry client errors", () => {
    expect(shouldRetryRequest(0, new ApiError(422, "no_route_found", "x", null))).toBe(false);
  });

  it("retries server and network errors a limited number of times", () => {
    const serverError = new ApiError(502, "upstream_service_error", "x", null);

    expect(shouldRetryRequest(0, serverError)).toBe(true);
    expect(shouldRetryRequest(2, serverError)).toBe(false);
  });
});
