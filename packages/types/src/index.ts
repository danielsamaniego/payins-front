/**
 * @payins/types — shared DTO/contract types between the Hono backend (`back/`) and the
 * Next.js frontends (`front/*`). Keep this in sync with the backend's public API shapes.
 *
 * Conventions (same as backend): amounts are integer minor units; percentages are basis
 * points (0–10000); timestamps are Unix milliseconds; country = ISO-3166-1 alpha-2,
 * currency = ISO-4217.
 */

/** ISO-3166-1 alpha-2 uppercase country code, e.g. "PE", "BR". */
export type CountryCode = string;

/** ISO-4217 uppercase currency code, e.g. "USD", "EUR", "PEN". */
export type CurrencyCode = string;

/** Integer amount in the currency's minor units (e.g. 199 = 1.99 with 2 minor units). */
export type AmountMinor = number;

/** Basis points: integer 0–10000, where 10000 = 100%. */
export type BasisPoints = number;

/** Unix timestamp in milliseconds. */
export type UnixMs = number;

/**
 * Provider-flow taxonomy. Mirrors the backend `FlowType` catalog. The
 * checkout app renders a different UI per `FlowType` (REDIRECT punts to the
 * provider's hosted page; ONSITE_TOKEN mounts the provider SDK in-page).
 */
export type FlowType =
  | "REDIRECT"
  | "ONSITE_TOKEN"
  | "REDIRECT_ASYNC"
  | "DISPLAY"
  | "ENROLLMENT"
  | "PUSH_TO_APP";

/** PaymentSession lifecycle states the checkout cares about. */
export type CheckoutSessionStatus = "OPEN" | "COMPLETED" | "EXPIRED" | "CANCELED";

/**
 * Public view of a PaymentSession exposed at `GET /c/:sessionId`. The shape
 * is intentionally narrower than the integrator-facing DTO:
 *   - NO `platform_id`, `account_id`, `metadata` (those are the integrator's
 *     private context).
 *   - NO `success_url` / `cancel_url` either — the checkout never displays
 *     them; they're used post-confirm by the integrator's redirect.
 */
export interface PublicCheckoutSession {
  readonly id: string;
  readonly status: CheckoutSessionStatus;
  readonly amount_minor: AmountMinor;
  readonly currency: CurrencyCode;
  readonly country: CountryCode | null;
  readonly expires_at: UnixMs;
  readonly created_at: UnixMs;
  /**
   * Display label the integrator set at create time (e.g. "Premium plan ×1").
   * Optional — when null the checkout shows the amount alone.
   */
  readonly display_name: string | null;
}

/**
 * One (method, flow) combination the buyer can pick. The same `method_slug`
 * with multiple `flow_type` values produces multiple entries (e.g. `card` +
 * REDIRECT and `card` + ONSITE_TOKEN). Required + optional buyer field
 * names let the checkout render the right form.
 */
export interface AvailablePaymentMethod {
  readonly method_slug: string;
  readonly flow_type: FlowType;
  readonly required_buyer_fields: readonly string[];
  readonly optional_buyer_fields: readonly string[];
}

/**
 * Result of `POST /c/:sessionId/confirm`. Discriminated by `kind` so the
 * caller can switch on it without narrowing helpers.
 */
export type ConfirmCheckoutResult =
  | {
      readonly kind: "redirect";
      readonly redirect_url: string;
      readonly payment_id: string;
      readonly provider_payment_id: string;
    }
  | {
      readonly kind: "onsite_token_prepared";
      readonly payment_id: string;
      readonly provider_payment_id: string;
      readonly client_hints: Readonly<Record<string, string>>;
    };

/** Body shape for `POST /c/:sessionId/confirm` (public, payer-driven). */
export interface ConfirmCheckoutBody {
  readonly payment_method_slug: string;
  readonly flow_type: FlowType;
  /** Canonical buyer fields (uppercase keys). Validated against the chosen method. */
  readonly buyer: Readonly<Record<string, string>>;
}
