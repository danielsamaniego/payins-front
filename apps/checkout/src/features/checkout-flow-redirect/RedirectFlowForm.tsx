"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type { AvailablePaymentMethod } from "@payins/types";
import {
  confirmRedirectAction,
  type ConfirmRedirectActionResult,
  simulateCaptureAction,
  type SimulateCaptureResult,
} from "./actions";

/**
 * DEV-ONLY affordance. When NEXT_PUBLIC_PAYINS_DEV_TOOLS=true (local + stripe-mock),
 * we don't bounce the buyer to the dead mock checkout URL — we surface a panel
 * with a "Simulate payment" button that fires the capture webhook stripe-mock
 * would never send. Off in production: the form redirects as normal.
 */
const DEV_TOOLS = process.env.NEXT_PUBLIC_PAYINS_DEV_TOOLS === "true";

/**
 * Client island that collects the canonical buyer fields the chosen method
 * declared and dispatches the server action. On success it punts the buyer
 * to the provider's hosted page (Stripe Checkout / Ebanx hosted). Any error
 * surfaces inline; the form stays mounted so the buyer can correct + retry.
 *
 * What this is NOT: a per-provider form. The shape is provider-agnostic; the
 * `required_buyer_fields` array from the backend tells us which inputs to
 * render. Stripe redirect needs only EMAIL; Ebanx redirect (PE) needs EMAIL
 * + GIVEN_NAME + FAMILY_NAME + DOCUMENT_NUMBER. Both work without code
 * changes here.
 */
export function RedirectFlowForm({
  sessionId,
  method,
}: {
  sessionId: string;
  method: AvailablePaymentMethod;
}) {
  const t = useTranslations("checkout.redirect");
  const tFields = useTranslations("checkout.buyerFields");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [email, setEmail] = useState("");
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  // DEV-ONLY: holds the confirmed redirect result so we can show the simulate panel.
  const [confirmed, setConfirmed] = useState<
    Extract<ConfirmRedirectActionResult, { kind: "redirect" }> | null
  >(null);
  const [sim, setSim] = useState<SimulateCaptureResult | null>(null);
  const [simPending, startSim] = useTransition();

  const requires = (field: string): boolean => method.required_buyer_fields.includes(field);
  const accepts = (field: string): boolean =>
    requires(field) || method.optional_buyer_fields.includes(field);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await confirmRedirectAction({
        sessionId,
        methodSlug: method.method_slug,
        email,
        givenName,
        familyName,
        documentNumber: documentNumber || undefined,
      });
      if (result.kind === "redirect") {
        // DEV: stay on-page and offer the simulate button instead of bouncing
        // to the dead stripe-mock URL. PROD: redirect to the real hosted page.
        if (DEV_TOOLS) {
          setConfirmed(result);
          return;
        }
        window.location.assign(result.redirectUrl);
        return;
      }
      setError({ code: result.code, message: result.message });
    });
  };

  const onSimulate = () => {
    if (!confirmed) return;
    setSim(null);
    startSim(async () => {
      setSim(await simulateCaptureAction(confirmed.providerPaymentId));
    });
  };

  // DEV-ONLY panel shown after a successful confirm.
  if (DEV_TOOLS && confirmed) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <strong>Modo local (stripe-mock).</strong> El enlace real no abre nada y Stripe no
          envía webhooks. Usa el botón para simular el cobro.
        </div>
        <dl className="space-y-1 text-xs text-slate-600">
          <div>
            <span className="font-medium">payment_id:</span>{" "}
            <span className="font-mono">{confirmed.paymentId}</span>
          </div>
          <div>
            <span className="font-medium">provider_payment_id:</span>{" "}
            <span className="font-mono">{confirmed.providerPaymentId}</span>
          </div>
        </dl>
        <a
          href={confirmed.redirectUrl}
          target="_blank"
          rel="noreferrer"
          className="block text-center text-xs text-slate-500 underline"
        >
          Ver redirect_url (mock, no abre)
        </a>
        <button
          type="button"
          onClick={onSimulate}
          disabled={simPending || sim?.kind === "ok"}
          className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sim?.kind === "ok"
            ? "✅ Pago simulado (CAPTURED)"
            : simPending
              ? "Simulando…"
              : "🧪 Simular pago"}
        </button>
        {sim?.kind === "error" && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
          >
            {sim.message}
          </p>
        )}
        {sim?.kind === "ok" && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Webhook procesado → <span className="font-mono">{sim.normalizedType}</span>. El pago
            quedó <strong>CAPTURED</strong>.
          </p>
        )}
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <Field label={tFields("EMAIL")} required={requires("EMAIL")}>
        <input
          type="email"
          autoComplete="email"
          required={requires("EMAIL")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
        />
      </Field>

      {accepts("GIVEN_NAME") && (
        <Field label={tFields("GIVEN_NAME")} required={requires("GIVEN_NAME")}>
          <input
            type="text"
            autoComplete="given-name"
            required={requires("GIVEN_NAME")}
            value={givenName}
            onChange={(e) => setGivenName(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </Field>
      )}

      {accepts("FAMILY_NAME") && (
        <Field label={tFields("FAMILY_NAME")} required={requires("FAMILY_NAME")}>
          <input
            type="text"
            autoComplete="family-name"
            required={requires("FAMILY_NAME")}
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </Field>
      )}

      {accepts("DOCUMENT_NUMBER") && (
        <Field label={tFields("DOCUMENT_NUMBER")} required={requires("DOCUMENT_NUMBER")}>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            required={requires("DOCUMENT_NUMBER")}
            value={documentNumber}
            onChange={(e) => setDocumentNumber(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono shadow-sm transition focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </Field>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
        >
          <span className="font-mono text-xs uppercase tracking-wide text-red-700">
            {error.code}
          </span>
          <br />
          {error.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? t("submitting") : t("submit")}
      </button>
      <p className="text-center text-xs text-slate-500">{t("redirectHint")}</p>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}
