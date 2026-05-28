/**
 * Typed env access. All `NEXT_PUBLIC_*` vars are inlined at build time and
 * visible to the browser; non-prefixed vars are server-only. Defaults are
 * intentionally lax for local dev — production deploys must set explicit values
 * (documented in `docs/deployment.md`).
 */

const optional = (name: string, fallback = ""): string =>
  (process.env[name] ?? fallback).trim();

export const env = {
  /** Browser-visible base URL of the Hono backend. */
  publicApiUrl: optional("NEXT_PUBLIC_PAYINS_API_URL", "http://localhost:1464"),

  /** Server-side base URL (BFF → backend). Often the same as publicApiUrl in dev. */
  internalApiUrl: optional("PAYINS_API_INTERNAL_URL", "http://localhost:1464"),

  /** Secret used to sign the dashboard's session cookie. Required in prod. */
  sessionSecret: optional("SESSION_SECRET", ""),
};
