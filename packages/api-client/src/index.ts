/**
 * @payins/api-client — the single seam between the frontends (`front/*`) and the Hono
 * backend (`back/`). The typed surface is GENERATED from the backend's OpenAPI 3.1 spec
 * (`/openapi`); see the `generate` script. Frontends import this client and never touch
 * the backend's domain code.
 *
 * This is a minimal hand-written wrapper to bootstrap; once `pnpm --filter @payins/api-client
 * generate` produces `src/schema.gen.ts`, the request/response shapes become fully typed.
 */
import type { UnixMs } from "@payins/types";

export interface PayinsClientOptions {
  /** Base URL of the Hono backend, e.g. https://api.payins.example or http://localhost:1464 */
  baseUrl: string;
  /** Platform API key: `pk_live_…` / `pk_test_…` (omit for public link routes). */
  apiKey?: string;
  /** Override fetch (e.g. for SSR / tests). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  /** Required on all mutations. */
  idempotencyKey?: string;
}

export interface PayinsError {
  error: string;
  message: string;
}

export function createPayinsClient(options: PayinsClientOptions) {
  const doFetch = options.fetchImpl ?? fetch;

  async function request<T>(opts: RequestOptions): Promise<T> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (options.apiKey) headers.authorization = `Bearer ${options.apiKey}`;
    if (opts.idempotencyKey) headers["idempotency-key"] = opts.idempotencyKey;

    const response = await doFetch(`${options.baseUrl}${opts.path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });

    const payload = (await response.json().catch(() => null)) as T | PayinsError | null;
    if (!response.ok) {
      throw payload ?? { error: "REQUEST_FAILED", message: `HTTP ${response.status}` };
    }
    return payload as T;
  }

  return { request };
}

export type PayinsClient = ReturnType<typeof createPayinsClient>;

/** Re-exported convenience: timestamps from the API are Unix ms. */
export type { UnixMs };
