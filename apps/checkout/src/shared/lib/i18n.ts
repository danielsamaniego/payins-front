/**
 * Locale metadata shared across the app's i18n. The actual message bundles
 * live in `messages/<locale>.json` and are loaded by `src/i18n/request.ts`
 * (next-intl). Per-feature namespaces inside each bundle: `checkout.yape.*`,
 * `common.*`, etc.
 */

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "es";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
