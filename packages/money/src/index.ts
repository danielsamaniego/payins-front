/**
 * @payins/money — money + percentage helpers shared by the frontends, mirroring the
 * backend's conventions so display logic never diverges from the domain.
 *
 * Money is integer minor units; percentages are basis points (0–10000); rounding is
 * half-even (banker's). These operate on `number` (the API boundary shape `amount_minor`);
 * the backend keeps `BigInt` internally.
 */
import type { AmountMinor, BasisPoints } from "@payins/types";

/** Half-even integer division: round(numerator / denominator) toward even on a tie. */
function halfEvenDivide(numerator: number, denominator: number): number {
  const q = Math.floor(numerator / denominator);
  const remainder = numerator - q * denominator;
  const twiceRemainder = remainder * 2;
  if (twiceRemainder < denominator) return q;
  if (twiceRemainder > denominator) return q + 1;
  return q % 2 === 0 ? q : q + 1;
}

/** Apply basis points to an integer minor amount, rounding half-even. e.g. (10000, 250) → 250. */
export function applyBasisPoints(amount: AmountMinor, bps: BasisPoints): AmountMinor {
  return halfEvenDivide(amount * bps, 10_000);
}

/** Format an integer minor amount as a decimal string given the currency's minor-unit exponent. */
export function formatMinor(amount: AmountMinor, minorUnits: number): string {
  if (minorUnits <= 0) return String(amount);
  const sign = amount < 0 ? "-" : "";
  const digits = Math.abs(amount)
    .toString()
    .padStart(minorUnits + 1, "0");
  const integerPart = digits.slice(0, digits.length - minorUnits);
  const fractionPart = digits.slice(digits.length - minorUnits);
  return `${sign}${integerPart}.${fractionPart}`;
}
