# Public checkout endpoints (backend follow-up)

The checkout app talks to three endpoints that **must be exposed on the
backend without API-key auth**. They don't exist yet — they're a known
follow-up for the `Kunfupay-Payins-Back` repo. This document captures the
contract the frontend is built against so the backend team has a single
reference to implement against.

## Why a separate public surface

`POST /v1/payment-sessions` and friends are integrator-facing: they require
`X-API-Key` because they expose tenant-private context (metadata,
success/cancel URLs, internal ids).

The buyer-facing checkout cannot use the integrator's API key — it would
leak across every payer's browser. Instead, the integrator hands the buyer
a URL like `https://checkout.payins.example/c/<sessionId>`, and the
checkout uses the **session id itself as the capability token**. The
endpoints below accept only that id and return a narrowed view safe to
expose.

Treat the session id as a bearer-style capability: opaque, short-lived,
not enumerable. The backend already generates them as UUID v7.

## Endpoints

### `GET /c/:sessionId`

Public read of the session. Response body matches
`@payins/types#PublicCheckoutSession`:

```json
{
  "id": "0195a0...",
  "status": "OPEN",
  "amount_minor": 10000,
  "currency": "EUR",
  "country": "ES",
  "expires_at": 1700000600000,
  "created_at": 1700000000000,
  "display_name": "Premium plan ×1"
}
```

Status codes:

- `200` — found, any lifecycle state (`OPEN` / `COMPLETED` / `EXPIRED` /
  `CANCELED`). The checkout renders a different panel per status.
- `404` — unknown session id.

Fields the integrator-facing DTO has that are **omitted here**:
`platform_id`, `account_id`, `metadata`, `success_url`, `cancel_url`,
`save_instrument`, `allowed_payment_methods` (use `/available-methods`),
`reference`, `resolved_capability_id`, `payment_id`.

### `GET /c/:sessionId/available-methods`

Same shape as the integrator-facing `/v1/payment-sessions/:id/available-methods`
— no fields are sensitive at this layer. Returns:

```json
{
  "methods": [
    {
      "method_slug": "card",
      "flow_type": "REDIRECT",
      "required_buyer_fields": ["EMAIL"],
      "optional_buyer_fields": []
    }
  ]
}
```

Status codes:

- `200` — list (possibly empty).
- `404` — session not found.
- `410` — session is not OPEN (mirror the integrator endpoint).

### `POST /c/:sessionId/confirm`

The payer-driven equivalent of `POST /v1/payment-sessions/:id/confirm`.
Same request body shape (`@payins/types#ConfirmCheckoutBody`); same
discriminated response (`ConfirmCheckoutResult`).

Backend should:

1. Look up the session by id.
2. Require `Idempotency-Key` header (the api-client auto-generates a UUID v7).
3. Validate the buyer payload against the chosen capability's
   `buyerFieldRequirements`.
4. Resolve the contract term + create the Payment as it does today.
5. Call the adapter (`REDIRECT` returns a URL; `ONSITE_TOKEN` returns
   client hints).

Status codes follow the integrator endpoint: `200` / `400` / `404` / `409`
/ `422`.

## What about abuse?

A capability-style endpoint with no auth needs cheap rate-limit defences.
v1.x can add per-session-id throttling on `confirm` (e.g. 5 attempts per
minute) — out of scope for this contract.

## Frontend consumers

Already wired:

- `packages/api-client/src/index.ts` → `client.checkout.getPublicSession`,
  `getAvailableMethods`, `confirmPublicSession`.
- `apps/checkout/src/entities/payment-session/loadCheckoutView.ts` calls
  the first two in parallel from the server component.
- `apps/checkout/src/features/checkout-flow-redirect/actions.ts` is the
  Server Action that calls `confirmPublicSession`.

When the backend ships these endpoints, no changes are needed in the
checkout app.
