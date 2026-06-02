/**
 * Public checkout route — `/c/:sessionId`.
 *
 * The route file is intentionally trivial: it forwards the param to the
 * `pages/` layer composition. Per FSD, Next route files belong to `app/`,
 * not `pages/` — `pages/` here is the FSD layer that holds the actual
 * composition. See `docs/frontend-architecture.md` § 5.4.
 */
import { CheckoutPage } from "@/pages/checkout-page";

export default async function CheckoutRoute({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <CheckoutPage sessionId={sessionId} />;
}
