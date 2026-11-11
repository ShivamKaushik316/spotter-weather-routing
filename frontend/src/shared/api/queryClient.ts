import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./client";

const MAXIMUM_RETRIES = 2;

export function shouldRetryRequest(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.isClientError) return false;
  return failureCount < MAXIMUM_RETRIES;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryRequest,
        refetchOnWindowFocus: false,
        staleTime: 10 * 60 * 1000,
      },
    },
  });
}
