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
