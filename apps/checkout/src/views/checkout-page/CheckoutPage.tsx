import { getTranslations } from "next-intl/server";
import { loadCheckoutView } from "@/entities/payment-session";
import { CheckoutSummary } from "@/widgets/checkout-summary";
import { MethodPicker } from "@/widgets/method-picker";
import { Card, CardTitle } from "@/shared/ui";

/**
 * Page-level composition (FSD `pages/` layer). Server Component: orchestrates
 * data fetch + branches between rendering the live checkout, a closed-state
 * notice, and a not-found notice. The Next App Router file just imports
 * this — the route is a thin shell.
 */
export async function CheckoutPage({ sessionId }: { sessionId: string }) {
  const view = await loadCheckoutView(sessionId);
  const t = await getTranslations("checkout.page");

  if (!view) {
    return <NoticePanel kind="not-found" title={t("notFoundTitle")} body={t("notFoundBody")} />;
  }
  if (view.session.status !== "OPEN") {
    return (
      <NoticePanel
        kind={view.session.status === "COMPLETED" ? "ok" : "warn"}
        title={t(`status.${view.session.status}.title`)}
        body={t(`status.${view.session.status}.body`)}
      />
    );
  }
  if (view.session.expires_at <= Date.now()) {
    return (
      <NoticePanel
        kind="warn"
        title={t("expiredTitle")}
        body={t("expiredBody")}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:py-16">
      <header className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
          {view.session.id.slice(0, 8)}…
        </span>
      </header>

      <CheckoutSummary session={view.session} />
      <MethodPicker sessionId={view.session.id} methods={view.methods} />

      <footer className="mt-2 text-center text-xs text-slate-400">
        {t("poweredBy")}
      </footer>
    </div>
  );
}

function NoticePanel({
  kind,
  title,
  body,
}: {
  kind: "ok" | "warn" | "not-found";
  title: string;
  body: string;
}) {
  const tone =
    kind === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : kind === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-slate-200 bg-white text-slate-800";
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-16">
      <Card className={tone}>
        <CardTitle>{title}</CardTitle>
        <p className="mt-3 text-sm leading-6">{body}</p>
      </Card>
    </div>
  );
}
