import { getLocale, getTranslations } from "next-intl/server";
import type { PublicCheckoutSession } from "@payins/types";
import { formatMoney } from "@/shared/lib/format-money";
import { Card, CardTitle } from "@/shared/ui";

/**
 * Read-only summary of what the buyer is about to pay. Server Component —
 * no interactivity, no client JS. Locale-aware via next-intl's server API.
 */
export async function CheckoutSummary({
  session,
}: {
  session: PublicCheckoutSession;
}) {
  const t = await getTranslations("checkout.summary");
  const locale = await getLocale();
  const formatted = formatMoney(session.amount_minor, session.currency, locale);

  return (
    <Card>
      <CardTitle>{t("title")}</CardTitle>
      <dl className="mt-4 space-y-3">
        {session.display_name && (
          <div className="flex items-baseline justify-between text-sm">
            <dt className="text-slate-600">{t("itemLabel")}</dt>
            <dd className="font-medium text-slate-900">{session.display_name}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <dt className="text-sm text-slate-600">{t("amountLabel")}</dt>
          <dd className="text-2xl font-semibold tabular-nums text-slate-900">{formatted}</dd>
        </div>
        {session.country && (
          <div className="flex items-baseline justify-between text-xs text-slate-500">
            <dt>{t("countryLabel")}</dt>
            <dd className="font-mono uppercase">{session.country}</dd>
          </div>
        )}
      </dl>
    </Card>
  );
}
