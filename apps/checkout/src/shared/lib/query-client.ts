import { QueryClient } from "@tanstack/react-query";

/**
 * Single source of TanStack Query defaults for the app. Create one per
 * request on the server and one per app load in the browser (Next handles
 * the wiring via a client provider mounted from the root layout).
 *
 * Conventions:
 *   - `staleTime`: 30s default; bump per-query when data is stable.
 *   - `refetchOnWindowFocus`: off (we don't want surprise refetches).
 *   - `refetchIntervalInBackground`: off (polling pauses when tab is hidden).
 *   - mutations: no retry (use idempotency + manual retry instead).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchIntervalInBackground: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
