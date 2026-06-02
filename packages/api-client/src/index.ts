/**
 * @payins/api-client — the single seam between the frontends (`front/*`) and
 * the Hono backend (`back/`). The typed surface is GENERATED from the
 * backend's OpenAPI 3.1 spec (`/openapi`); see the `generate` script. Until
 * codegen lands we hand-roll the few endpoint wrappers the checkout +
 * dashboard actually need.
 */
import type {
  AvailablePaymentMethod,
  ConfirmCheckoutBody,
  ConfirmCheckoutResult,
  PublicCheckoutSession,
  UnixMs,
} from "@payins/types";

export interface PayinsClientOptions {
  /** Base URL of the Hono backend, e.g. https://api.payins.example or http://localhost:1464 */
  baseUrl: string;
  /**
   * Platform API key: `pk_live_…` / `pk_test_…`. Required for integrator-
   * facing endpoints; MUST be omitted on the public checkout app (the public
   * `/c/:sessionId` routes use the session id as the capability token).
   */
  apiKey?: string;
  /** Override fetch (e.g. for SSR / tests). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  /** Required on all mutations. Auto-generated as UUID v7 if not supplied. */
  idempotencyKey?: string;
  /** Per-call header overrides (rare). */
  headers?: Readonly<Record<string, string>>;
}

export interface PayinsError {
  error: string;
  message: string;
  /** HTTP status — populated by the client wrapper, not on the wire. */
  status?: number;
}

/** Type guard for catch blocks that need to disambiguate from `unknown`. */
export function isPayinsError(value: unknown): value is PayinsError {
  return (
    value !== null &&
    typeof value === "object" &&
    "error" in value &&
    typeof (value as { error: unknown }).error === "string"
  );
}

/**
 * Public checkout endpoints — payer-facing, no API key required. Backed by
 * routes the integrator hands off via the session URL. The backend exposes
 * these under `/c/:sessionId` (a follow-up: today the integrator-facing
 * `/v1/payment-sessions/:id` requires API key and is not safe to call from
 * the payer's browser).
 */
export interface CheckoutClient {
  /** `GET /c/:sessionId` — narrow PaymentSession DTO safe to expose to a payer. */
  getPublicSession(sessionId: string): Promise<PublicCheckoutSession>;
  /** `GET /c/:sessionId/available-methods` — methods the buyer can pick. */
  getAvailableMethods(sessionId: string): Promise<readonly AvailablePaymentMethod[]>;
  /** `POST /c/:sessionId/confirm` — payer-driven confirmation. */
  confirmPublicSession(
    sessionId: string,
    body: ConfirmCheckoutBody,
    opts?: { idempotencyKey?: string },
  ): Promise<ConfirmCheckoutResult>;
}

export function createPayinsClient(options: PayinsClientOptions) {
  const doFetch = options.fetchImpl ?? fetch;

  async function request<T>(opts: RequestOptions): Promise<T> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(opts.headers ?? {}),
    };
    if (options.apiKey) headers["x-api-key"] = options.apiKey;

    const isMutation = (opts.method ?? "GET") !== "GET";
    if (isMutation) {
      headers["idempotency-key"] = opts.idempotencyKey ?? newUuidV7();
    }

    const response = await doFetch(`${options.baseUrl}${opts.path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });

    const payload = (await response.json().catch(() => null)) as T | PayinsError | null;
    if (!response.ok) {
      const err =
        payload && typeof payload === "object" && "error" in payload
          ? { ...(payload as PayinsError), status: response.status }
          : {
              error: "REQUEST_FAILED",
              message: `HTTP ${response.status}`,
              status: response.status,
            };
      throw err;
    }
    return payload as T;
  }

  const checkout: CheckoutClient = {
    getPublicSession: (sessionId) =>
      request<PublicCheckoutSession>({ path: `/c/${encodeURIComponent(sessionId)}` }),
    getAvailableMethods: async (sessionId) => {
      const out = await request<{ methods: AvailablePaymentMethod[] }>({
        path: `/c/${encodeURIComponent(sessionId)}/available-methods`,
      });
      return out.methods;
    },
    confirmPublicSession: (sessionId, body, opts) =>
      request<ConfirmCheckoutResult>({
        method: "POST",
        path: `/c/${encodeURIComponent(sessionId)}/confirm`,
        body,
        idempotencyKey: opts?.idempotencyKey,
      }),
  };

  return { request, checkout };
}

export type PayinsClient = ReturnType<typeof createPayinsClient>;

/** Re-exported convenience: timestamps from the API are Unix ms. */
export type { UnixMs };

/**
 * UUID v7 generator (RFC 9562 §5.7). Crypto-random tail; millisecond
 * timestamp in the leading 48 bits. Sortable + safe to expose externally.
 * Identical scheme the backend uses for entity IDs.
 */
function newUuidV7(): string {
  const ms = Date.now();
  const bytes = new Uint8Array(16);
  bytes[0] = (ms >>> 40) & 0xff;
  bytes[1] = (ms >>> 32) & 0xff;
  bytes[2] = (ms >>> 24) & 0xff;
  bytes[3] = (ms >>> 16) & 0xff;
  bytes[4] = (ms >>> 8) & 0xff;
  bytes[5] = ms & 0xff;
  const rand = new Uint8Array(10);
  cryptoRandom(rand);
  for (let i = 0; i < 10; i += 1) bytes[6 + i] = rand[i] as number;
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;
  return (
    `${hex(bytes, 0, 4)}-${hex(bytes, 4, 6)}-${hex(bytes, 6, 8)}-` +
    `${hex(bytes, 8, 10)}-${hex(bytes, 10, 16)}`
  );
}

function cryptoRandom(into: Uint8Array): void {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => void } }).crypto;
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(into);
    return;
  }
  for (let i = 0; i < into.length; i += 1) into[i] = Math.floor(Math.random() * 256);
}

function hex(bytes: Uint8Array, start: number, end: number): string {
  let out = "";
  for (let i = start; i < end; i += 1) {
    out += (bytes[i] as number).toString(16).padStart(2, "0");
  }
  return out;
}
