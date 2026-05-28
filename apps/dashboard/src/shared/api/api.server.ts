import "server-only";
import { createPayinsClient, type PayinsClient } from "@payins/api-client";
import { env } from "@/shared/lib/env";

let _client: PayinsClient | null = null;

/**
 * Server-only Payins API client. Uses the internal base URL
 * (`PAYINS_API_INTERNAL_URL`), which may bypass the public CDN/edge and is
 * shaped for backend-to-backend traffic from server components, route
 * handlers, and server actions.
 *
 * The `server-only` import causes a build error if this module is ever
 * imported (transitively) from a client component — that's the boundary
 * guard. When `iam` is wired up, this client will also forward the admin
 * session token from the request's cookies.
 */
export function getServerApiClient(): PayinsClient {
  if (!_client) {
    _client = createPayinsClient({ baseUrl: env.internalApiUrl });
  }
  return _client;
}
