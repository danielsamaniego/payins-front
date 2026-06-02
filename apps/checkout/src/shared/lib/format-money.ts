import { formatMinor } from "@payins/money";
import type { AmountMinor, CurrencyCode } from "@payins/types";

/**
 * Minor-units-per-currency table. Mirrors ISO-4217 — most currencies use 2
 * fraction digits; JPY/KRW/etc. use 0. Defaults to 2 for anything unknown.
 *
 * This stays in `shared/` (not `entities/`) because it's a pure display
 * helper. Promoting it later only matters if a different layer ever needs
 * to do non-display math on currencies — unlikely.
 */
const CURRENCY_EXPONENT: Readonly<Record<string, number>> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  PYG: 0,
  ISK: 0,
  XOF: 0,
  XAF: 0,
  // 3-digit minor units (rare; tunisian dinar, bahraini dinar, …)
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
};

export function formatMoney(amount: AmountMinor, currency: CurrencyCode, locale: string): string {
  const minorUnits = CURRENCY_EXPONENT[currency.toUpperCase()] ?? 2;
  const decimal = formatMinor(amount, minorUnits);
  // Use Intl.NumberFormat so locale-specific separators (dot vs comma) work
  // without us shipping our own table. The amount is already a decimal
  // string; we re-parse via Number — safe at typical checkout magnitudes
  // (≤ 1e15 minor units = ≤ 1e13 major; well inside Number.MAX_SAFE_INTEGER).
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: minorUnits,
      maximumFractionDigits: minorUnits,
    }).format(Number(decimal));
  } catch {
    // Unknown currency code → fall back to the bare decimal string. Better
    // than crashing the page on an unsupported currency.
    return `${decimal} ${currency.toUpperCase()}`;
  }
}
