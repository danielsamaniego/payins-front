import "server-only";
import { getServerApiClient } from "@/shared/api/api.server";
import type { CheckoutView } from "./types";

/**
 * Fetches both the session DTO and the available methods in parallel. Server-
 * only — the api-client this calls hits the internal base URL and never
 * forwards a session cookie (the checkout has none).
 *
 * Returns `null` when the session is unknown (404) so the caller can render
 * a friendly "not found" without catching errors.
 */
export async function loadCheckoutView(sessionId: string): Promise<CheckoutView | null> {
  const api = getServerApiClient();
  try {
    const [session, methods] = await Promise.all([
      api.checkout.getPublicSession(sessionId),
      api.checkout.getAvailableMethods(sessionId),
    ]);
    return { session, methods };
  } catch (err) {
    if (isHttpStatus(err, 404)) return null;
    throw err;
  }
}

function isHttpStatus(err: unknown, status: number): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    (err as { status: unknown }).status === status
  );
}
