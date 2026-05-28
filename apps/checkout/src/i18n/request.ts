import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale } from "@/shared/lib/i18n";

/**
 * next-intl server configuration. For each request, picks a locale (with a
 * fallback to DEFAULT_LOCALE) and loads the matching messages bundle from
 * `messages/<locale>.json`. Routing strategy (subpath / domain) can be added
 * later via middleware — today the locale is resolved per-request only.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
