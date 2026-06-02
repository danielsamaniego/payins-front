"use server";

import crypto from "node:crypto";
import { getServerApiClient } from "@/shared/api/api.server";
import { env } from "@/shared/lib/env";
import type { ConfirmCheckoutBody } from "@payins/types";

export interface ConfirmRedirectInput {
  readonly sessionId: string;
  readonly methodSlug: string;
  readonly email: string;
  readonly givenName: string;
  readonly familyName: string;
  readonly documentNumber?: string;
}

/**
 * Server Action invoked by the client form. Validates the canonical buyer
 * dict here (on the server) and returns the discriminated result the client
 * uses to decide between `window.location.assign(redirectUrl)` and showing
 * an inline error.
 *
 * We do NOT throw: the client expects a structured result. Errors bubble as
 * `{ kind: "error", code, message }` so the form can map them to i18n
 * messages without try/catch noise.
 */
export type ConfirmRedirectActionResult =
  | {
      readonly kind: "redirect";
      readonly redirectUrl: string;
      readonly paymentId: string;
      readonly providerPaymentId: string;
    }
  | { readonly kind: "error"; readonly code: string; readonly message: string };

export async function confirmRedirectAction(
  input: ConfirmRedirectInput,
): Promise<ConfirmRedirectActionResult> {
  // Only send canonical buyer fields the buyer actually filled. The method's
  // form renders only the fields it `accepts(...)`, so unrendered fields arrive
  // empty here — the backend rejects empty strings ("must be a non-empty
  // string"). Card REDIRECT, for instance, accepts only EMAIL.
  const buyer: Record<string, string> = {};
  const addField = (key: string, value: string | undefined): void => {
    const trimmed = (value ?? "").trim();
    if (trimmed.length > 0) buyer[key] = trimmed;
  };
  addField("EMAIL", input.email);
  addField("GIVEN_NAME", input.givenName);
  addField("FAMILY_NAME", input.familyName);
  addField("DOCUMENT_NUMBER", input.documentNumber);

  const body: ConfirmCheckoutBody = {
    payment_method_slug: input.methodSlug,
    flow_type: "REDIRECT",
    buyer,
  };

  const api = getServerApiClient();
  try {
    const result = await api.checkout.confirmPublicSession(input.sessionId, body);
    if (result.kind === "redirect") {
      return {
        kind: "redirect",
        redirectUrl: result.redirect_url,
        paymentId: result.payment_id,
        providerPaymentId: result.provider_payment_id,
      };
    }
    // The buyer picked REDIRECT but the backend returned `onsite_token_prepared`.
    // That's a routing/server bug, not a buyer mistake. Surface a clean error.
    return {
      kind: "error",
      code: "UNEXPECTED_FLOW",
      message: "Server returned an unexpected confirmation shape.",
    };
  } catch (err) {
    const e = err as { error?: string; message?: string };
    return {
      kind: "error",
      code: e.error ?? "CONFIRM_FAILED",
      message: e.message ?? "Could not confirm the payment.",
    };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// DEV-ONLY: simulate the provider capture webhook.
//
// Against stripe-mock there is no hosted checkout page and Stripe never POSTs a
// webhook back to us, so a payment confirmed in REDIRECT flow stays in
// REQUIRES_ACTION forever. This action fakes the `payment_intent.succeeded`
// event that real Stripe would send — signed with the same secret the seeded
// connection uses — to drive the payment to CAPTURED with one click. It refuses
// to run in production.
// ───────────────────────────────────────────────────────────────────────────

const DEV_WEBHOOK_SECRET = (process.env.PAYINS_DEV_WEBHOOK_SECRET ?? "whsec_placeholder").trim();

export type SimulateCaptureResult =
  | { readonly kind: "ok"; readonly normalizedType: string }
  | { readonly kind: "error"; readonly message: string };

export async function simulateCaptureAction(
  providerPaymentId: string,
): Promise<SimulateCaptureResult> {
  if (process.env.NODE_ENV === "production") {
    return { kind: "error", message: "Payment simulation is disabled in production." };
  }

  const event = JSON.stringify({
    id: `evt_${crypto.randomBytes(10).toString("hex")}`,
    object: "event",
    type: "payment_intent.succeeded",
    data: {
      object: { id: providerPaymentId, object: "payment_intent", status: "succeeded" },
    },
  });
  const ts = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac("sha256", DEV_WEBHOOK_SECRET)
    .update(`${ts}.${event}`)
    .digest("hex");

  try {
    const res = await fetch(`${env.internalApiUrl}/v1/webhooks/stripe`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": `t=${ts},v1=${signature}`,
      },
      body: event,
    });
    const body = (await res.json().catch(() => ({}))) as {
      status?: string;
      normalized_type?: string;
      error?: string;
      message?: string;
    };
    if (res.ok && body.status === "processed") {
      return { kind: "ok", normalizedType: body.normalized_type ?? "PAYMENT_CAPTURED" };
    }
    return {
      kind: "error",
      message: body.message ?? body.error ?? `Webhook returned HTTP ${res.status}`,
    };
  } catch (err) {
    return { kind: "error", message: (err as Error).message };
  }
}
