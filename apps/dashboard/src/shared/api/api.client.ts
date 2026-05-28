import { createPayinsClient, type PayinsClient } from "@payins/api-client";
import { env } from "@/shared/lib/env";

let _client: PayinsClient | null = null;

/**
 * Browser-side Payins API client (lazy singleton). Uses the public base URL
 * (`NEXT_PUBLIC_PAYINS_API_URL`). Safe to call from client components, server
 * components, and server actions — for server-only flows that need the
 * internal URL or to forward an admin session, use `api.server.ts` instead.
 */
export function getApiClient(): PayinsClient {
  if (!_client) {
    _client = createPayinsClient({ baseUrl: env.publicApiUrl });
  }
  return _client;
}
