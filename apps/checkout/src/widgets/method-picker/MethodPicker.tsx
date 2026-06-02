"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { AvailablePaymentMethod } from "@payins/types";
import { RedirectFlowForm } from "@/features/checkout-flow-redirect";
import { Card, CardTitle } from "@/shared/ui";

/**
 * Renders a tab strip with one button per (method, flow) the buyer can pick,
 * then mounts the matching flow feature. Each flow is its OWN feature
 * (`checkout-flow-redirect` here; ONSITE_TOKEN, DISPLAY, ENROLLMENT come as
 * their own features as we wire them) — never a parametrised shared
 * orchestrator, per the FSD convention in AGENTS.md § Per-app specifics.
 *
 * Why a client island for the picker itself: the buyer needs to flip between
 * methods without a server round-trip. The per-method forms are also client
 * islands because they capture buyer input + submit a server action.
 */
export function MethodPicker({
  sessionId,
  methods,
}: {
  sessionId: string;
  methods: readonly AvailablePaymentMethod[];
}) {
  const t = useTranslations("checkout.methods");
  const [selectedKey, setSelectedKey] = useState<string | null>(() =>
    methods.length > 0 ? buildKey(methods[0]!) : null,
  );

  if (methods.length === 0) {
    return (
      <Card>
        <CardTitle>{t("title")}</CardTitle>
        <p className="mt-3 text-sm text-slate-600">{t("noneAvailable")}</p>
      </Card>
    );
  }

  const selected = methods.find((m) => buildKey(m) === selectedKey) ?? methods[0]!;

  return (
    <Card>
      <CardTitle>{t("title")}</CardTitle>

      <div
        role="tablist"
        aria-label={t("title")}
        className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {methods.map((m) => {
          const key = buildKey(m);
          const isSelected = key === buildKey(selected);
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setSelectedKey(key)}
              className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                isSelected
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
              }`}
            >
              <span className="font-medium">{t.has(`slug.${m.method_slug}`) ? t(`slug.${m.method_slug}`) : m.method_slug}</span>
              <span
                className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide ${
                  isSelected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {m.flow_type}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {selected.flow_type === "REDIRECT" ? (
          <RedirectFlowForm sessionId={sessionId} method={selected} />
        ) : (
          <UnsupportedFlowNotice flow={selected.flow_type} />
        )}
      </div>
    </Card>
  );
}

function UnsupportedFlowNotice({ flow }: { flow: string }) {
  const t = useTranslations("checkout.methods");
  return (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      {t("flowNotImplemented", { flow })}
    </p>
  );
}

function buildKey(m: AvailablePaymentMethod): string {
  return `${m.method_slug}__${m.flow_type}`;
}
