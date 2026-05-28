# Payins — Frontend Architecture

Canonical reference for the **frontend layer** of the Payins platform — the two Next.js
apps (`apps/checkout`, `apps/dashboard`) and the private workspace packages
(`@payins/api-client`, `@payins/types`, `@payins/money`) that live in this repo.
**This is the frontend repo's canonical architecture doc.** The backend is a
separate, independent project; this doc only references it as an HTTP service the
frontend consumes.

Companion to (and never contradicting):

- [../AGENTS.md](../AGENTS.md) — this repo's canonical agent guidance (frontend).
- [../../AGENTS.md](../../AGENTS.md) — umbrella agent guidance (cross-repo rules).
- [../../PAYINS_SERVICE_PLAN.md](../../PAYINS_SERVICE_PLAN.md) — scope and phases (shared
  between back and front).
- [deployment.md](deployment.md) — Vercel + Docker deployment for **this repo**.

The backend is the canonical home of the domain. The frontend is presentation + actions.

---

## 1. Purpose & boundaries

Payins is a payment-in orchestration platform. The **backend is the source of truth**;
everything else consumes it.

- **The backend (separate, independent project) is the only home of payment domain
  logic.** REST API, inbound/outbound webhooks, crons, and all business rules
  (payments, capabilities, contracts, commissions, subscriptions, checkouts, disputes,
  `iam`) live there, under full Wallet-parity conventions (DDD + Hexagonal + CQRS,
  UUID v7, Unix-ms `BigInt` timestamps, integer minor-unit money, basis-point
  percentages, 100% coverage).
- **The frontends are pure API consumers.** They render UI and orchestrate user
  interactions, but hold no business logic and own no canonical state.
- **Next.js is not a backend.** The Next server side is a **thin BFF** only:
  Server-Side Rendering (SSR), Server Actions that proxy mutations to the Hono API,
  and dashboard session handling. It never reaches into the database, never
  re-implements domain rules, and never imports backend source.
- **The only frontend↔backend seam is `@payins/api-client`** — a typed HTTP client
  *generated* from the backend's OpenAPI 3.1 spec. Frontends talk to the backend
  exclusively through it.

This keeps the architecture honest: the backend can be developed, tested, and deployed
independently, and any drift between the API and its consumers is caught at compile
time.

---

## 2. Repo layout (frontend)

**The Payins frontend is its own repo.** It is an internal pnpm 10 + Turborepo
workspace (Node 22) holding both Next.js apps + the private workspace packages they
share. The backend is a separate, independent project (out of scope here — see the
umbrella overview); each repo deploys independently.

```
Kunfupay-Payins-Front/                       # THIS repo (internal workspace).
├── apps/
│   ├── checkout/                            # Next.js — PUBLIC, payer-facing checkout.
│   └── dashboard/                           # Next.js — AUTHENTICATED superadmin console.
├── packages/
│   ├── api-client/                          # @payins/api-client — typed client GENERATED from the backend's OpenAPI.
│   ├── types/                               # @payins/types — shared DTO/contract types.
│   └── money/                               # @payins/money — minor-units / basis-points / ISO helpers.
├── docs/
│   ├── frontend-architecture.md             # this file.
│   └── deployment.md                        # this repo's deploy notes (Vercel + Docker).
├── scripts/
│   └── check-feature-imports.cjs            # FSD layer/slice import linter for apps/* (see §5).
├── AGENTS.md · CLAUDE.md · README.md        # frontend repo agent guidance.
├── docker-compose.dev.yml                   # both apps with hot reload.
├── biome.json                               # single linter/formatter for this repo.
├── turbo.json                               # task pipeline (this repo).
├── tsconfig.base.json                       # shared TS config (apps/packages extend it).
├── pnpm-workspace.yaml                      # workspace globs: apps/*, packages/*.
└── package.json · pnpm-lock.yaml · .npmrc · .nvmrc · .husky/
```

**Hard boundaries:**

1. The backend is the single source of truth. `apps/*` never imports from the
   backend; the backend is reached only over HTTP.
2. Frontends consume the API only through `@payins/api-client`.
3. The frontend is an additive layer; it does not impose anything on backend
   conventions.
4. `packages/` is conservative — share only what cannot diverge (§11).
5. This repo is self-contained: own lockfile, own Docker, own Vercel projects, own
   pre-commit hooks.

---

## 3. The OpenAPI → api-client seam

The single integration point between the frontends and the backend.

### How it's generated

1. The backend describes every endpoint with `hono-openapi` + Zod (`describeRoute`,
   `resolver(ResponseSchema)`), exactly as mandated by `AGENTS.md`. API docs are
   **never written by hand**.
2. The backend serves the **OpenAPI 3.1 JSON** at `/openapi` (and an interactive Scalar
   UI at `/docs`).
3. `@payins/api-client` is **generated from that spec** — request/response types, path
   params, query params, and typed methods all derive from `/openapi`. The package is
   the only thing the frontends import to call the backend.
4. When the API changes, the client is regenerated; consumers that drifted **fail at
   compile time**.

### Why this gives end-to-end type safety

```
Zod schemas (back) ──hono-openapi──▶ /openapi (3.1) ──generator──▶ @payins/api-client (typed)
        ▲                                                                     │
        └──────────────── single source of contract truth ───────────────────┘
                                       consumed by apps/checkout + apps/dashboard
```

There is exactly **one** definition of the contract (the backend's Zod schemas), so the
types the frontends see are provably the types the backend emits. A renamed field, a
changed enum, or a removed endpoint becomes a TypeScript error in the consuming app
rather than a runtime 500. `@payins/types` carries any shared DTO/contract types that
are useful outside the generated surface; both layers stay in lockstep with the
backend.

---

## 4. The two apps

| App | Audience | Auth | Rendering | Deploy root |
|---|---|---|---|---|
| `apps/checkout` | Public / payer-facing | None (opaque link slug / checkout claim token) | Mostly Server Components, minimal client islands | `apps/checkout/` |
| `apps/dashboard` | Internal superadmin (Phase 2: platform-scoped integrators) | Backend-owned `iam` session cookie | SSR shell + TanStack Query client islands | `apps/dashboard/` |

Both are **Next.js (App Router) + React + TypeScript + Tailwind**.
`transpilePackages` lists the `@payins/*` workspace packages (they export TS source).

---

## 5. Architecture: Feature-Sliced Design (strict, from day 1)

Both `apps/checkout` and `apps/dashboard` follow **Feature-Sliced Design (FSD) in its
strict form, from day 1**. There is no "FSD-lite" or migration period: every slice from
the first commit lives inside the six standard layers, behind a `index.ts` public API,
and the layer-import linter is wired into CI.

### 5.1 The six layers and import direction

```
app  ──▶  pages  ──▶  widgets  ──▶  features  ──▶  entities  ──▶  shared
                                  (each layer can import only from layers strictly BELOW)
```

| Layer | Purpose | Examples |
|---|---|---|
| `app/` | Cross-cutting application setup: providers, global styles, root error boundary. **Not Next's `src/app/` route folder** — see §5.4. | `app/providers/` (`<QueryClientProvider/>`, `<NextIntlClientProvider/>`), `app/styles/globals.css`. |
| `pages/` | Page-level **composition** of widgets/features for a route. **FSD pages ≠ Next Pages Router**; see §5.4. | `pages/payment-link/`, `pages/payments/`. |
| `widgets/` | Self-contained UI blocks that compose multiple features/entities. | `widgets/checkout-shell/`, `widgets/dashboard-sidebar/`. |
| `features/` | User interactions / use cases (FSD "feature" = an action the user performs). Each integrated **payment method** is its own feature file (Yape, Nequi, Pix, etc.). | `features/checkout-flow-yape/`, `features/refund-payment/`, `features/login-admin/`. |
| `entities/` | **Noun-scoped read-side bundles** (types + read-only API + presentation). Not DDD entities — see §5.2. | `entities/payment/`, `entities/payment-link/`, `entities/subscription/`. |
| `shared/` | Anything reusable that knows nothing about the business: UI primitives, hooks, utils, the api-client factories, env, i18n config, error mapping. | `shared/ui/`, `shared/lib/hooks/`, `shared/api/`, `shared/lib/errors.ts`. |

**Rules (enforced by `scripts/check-feature-imports.cjs`):**

1. A layer may import only from layers **strictly below** it. No upward imports
   (`shared` cannot import from `entities`, `features` cannot import from `widgets`,
   etc.).
2. **Same-layer slices may not import each other.** `features/checkout-flow-yape/` may
   not import `features/checkout-flow-nequi/`. Cross-feature reuse goes through a lower
   layer (usually `entities/` or `shared/`).
3. **Public API only.** Cross-slice imports go through the slice's `index.ts`:
   `import { PaymentRow } from "@/entities/payment"` is allowed; reaching into
   `@/entities/payment/ui/PaymentRow.tsx` is not.
4. Inside a slice, files may import each other freely (`ui/` → `model/` → `api/`).
5. The `app/` Next-router files (`src/app/<route>/page.tsx`) are thin and may import
   from `pages/<route>/`; nothing else.

The linter (`scripts/check-feature-imports.cjs`) is the front-end analogue of the
backend's `scripts/check-layer-violations.cjs` (in the sibling backend repo). It is a
custom Node script — no plugin dependency — and runs on `pre-commit` (`lint-staged`)
for every file under `apps/*/src/`.

### 5.2 A note on the term `entities/` (FSD vs DDD)

The `entities/` layer follows the **Feature-Sliced Design** convention. It is **not** the
Domain-Driven Design concept of an *Entity* (an object with identity, lifecycle, and
invariants). DDD entities of this product (`Payment`, `Subscription`, `Checkout`,
`Invoice`, `Instrument`, `Contract`, `AdminUser`, …) live **exclusively in the
backend's domain layer** (separate repo, out of scope here). The frontend does not
have a domain layer.

In FSD's vocabulary, an *entity* is a **noun-scoped bundle** of presentation + read-side
data:

| Segment | What it holds | Example |
|---|---|---|
| `model/types.ts` | DTOs/types for the noun (often re-exported from `@payins/types`) | `Payment`, `Subscription` |
| `api/<readOnly>.ts` | Read-side data access | `getPayment.ts`, `listSubscriptions.ts` |
| `ui/<X>Card.tsx` etc. | Presentation components tied to the noun | `PaymentRow`, `SubscriptionBadge`, `MoneyAmount` |
| `index.ts` | The slice's public API | re-exports of the above |

Implications and rules:

1. **No domain logic in `entities/`.** No invariants, no business rules, no mutations,
   no state machines. Pure presentation + reads. Anything that mutates state lives in a
   `features/` slice (which calls server actions backed by the Hono API).
2. **Reusable across features.** `features/refund-payment/` and
   `features/dispute-payment/` may both import `entities/payment/` (via its public API);
   they may **not** import each other.
3. **Cross-feature reuse goes through entities, never feature-to-feature.** Apply the
   rule of three before extracting a component from a feature up into an entity.
4. **Public API only.** Import via `@/entities/payment` (the slice's `index.ts`); never
   reach into `@/entities/payment/ui/PaymentRow` directly. Enforced by
   `scripts/check-feature-imports.cjs`.
5. **Naming caveat.** If you are reading this code with a DDD lens, mentally read
   `entities/<noun>/` as **"view-bucket for <noun>"** — the folder name keeps the
   standard FSD vocabulary for tooling and external readability, but the meaning here is
   read-side UI + data, not DDD.

The same caveat applies to FSD's other repurposed terms (e.g., "features" in FSD =
user interactions / use cases, not "product features"). Where confusing, this file calls
them out.

### 5.3 Slice anatomy

Every slice (any folder directly inside a layer) has the same internal shape, with only
the relevant segments present:

```
features/checkout-flow-yape/
├── index.ts            # public API (the ONLY entry point)
├── ui/                 # React components
│   ├── YapeFlow.tsx
│   ├── PhoneStep.tsx
│   └── OtpStep.tsx
├── model/              # state, types, machine, hooks local to this feature
│   ├── machine.ts      # XState-style reducer or RHF state
│   ├── types.ts
│   └── useYapeFlow.ts
├── api/                # server-side I/O (server actions or query factories)
│   ├── startYape.ts        # 'use server'  → apiServer.checkouts.startYape(...)
│   └── confirmYape.ts      # 'use server'  → apiServer.checkouts.confirmYape(...)
└── i18n/               # optional: feature-local message keys (or use messages/<locale>/checkout/yape.json)
```

Segments are **not all mandatory**. A pure `entities/` slice may have no `model/`
beyond `types.ts`. A pure `shared/ui/` primitive has no `model/` or `api/` at all.

### 5.4 FSD + Next.js App Router — the `app/` clash

Next.js (App Router) puts routes in `src/app/<route>/page.tsx`. FSD's `pages/` layer is
**page-level composition** — distinct from Next's deprecated **Pages Router**. The two
overlap by name, not by purpose. Our adaptation (the standard one used across the FSD +
App Router community):

- `src/app/<route>/page.tsx` is a **thin Next route file**. It is wired to a URL by the
  Next router. It does nothing but render the matching FSD page composition.
- `src/pages/<route>/` is the **FSD page slice**. It composes widgets, features, and
  entities for that route; it owns the page-level layout, metadata, and SSR data
  fetching.

Concretely:

```tsx
// src/app/l/[slug]/page.tsx           ← Next route (thin)
import { PaymentLinkPage } from "@/pages/payment-link";

export default function Page({ params }: { params: { slug: string } }) {
  return <PaymentLinkPage slug={params.slug} />;
}
```

```tsx
// src/pages/payment-link/ui/PaymentLinkPage.tsx   ← FSD composition
import { LinkHeader } from "@/entities/payment-link";
import { CheckoutShell } from "@/widgets/checkout-shell";

export async function PaymentLinkPage({ slug }: { slug: string }) {
  const link = await getPaymentLinkBySlug(slug); // server-side, via apiServer
  return (
    <main>
      <LinkHeader link={link} />
      <CheckoutShell linkSlug={slug} />
    </main>
  );
}
```

The same pattern applies to Next layouts (`src/app/<...>/layout.tsx`) and route groups:
they remain thin and delegate to FSD compositions.

`src/app/` also keeps the App-Router-specific files Next requires (`layout.tsx`,
`error.tsx`, `loading.tsx`, `not-found.tsx`, `globals.css` import, `middleware.ts`
sibling). FSD's `app/` layer (with the same name, by accident of vocabulary) is for
**cross-cutting providers** and lives in `src/app/providers/` only if it does not clash
with Next's special files — in practice we name the FSD provider folder
`src/app/_providers/` or import providers directly inside `src/app/layout.tsx` from
`src/shared/providers/`. Where this doc says "FSD `app/` layer", read it as the set of
providers/styles/root error boundary the app needs, regardless of where they
physically live.

---

## 6. `apps/checkout` — public hosted/embedded checkout

The payer-facing surface. It renders the flows **Payins renders natively**, driven by
the backend's `FlowType`.

### 6.1 Audience & routes

| Route | Purpose |
|---|---|
| `/l/:slug` | Payment-link landing — renders the link's public metadata; creates a `Checkout` on submit. |
| `/c/:token` | Checkout page — resolves a checkout claim token and renders the right flow UI. |

### 6.2 Rendering strategy per FlowType

| FlowType | Rendered UI |
|---|---|
| Card (`ONSITE_TOKEN`) | Provider SDK fields — **Stripe Elements / Ebanx fields** (tokenize in browser). |
| `REDIRECT` (generic) | Redirect to the provider-hosted page, return via `successUrl`/`cancelUrl`. |
| Pix (`DISPLAY`) | Pix QR artifact rendered in-page. |
| Boleto (`DISPLAY`/`REDIRECT_ASYNC`) | Boleto voucher (number + PDF link). |
| Yape / Nequi (`ENROLLMENT`) | Wallet enrollment via deep-link + OTP confirmation. |

The app is **mostly Server Components with minimal client JS**: client islands appear
only where a provider SDK must run (card tokenization, QR/status polling, OTP entry).

### 6.3 PCI posture

- The **provider SDK tokenizes the PAN in the browser**. Payins (frontend and backend)
  **never sees PAN/CVV** — only provider tokens cross the wire.
- This matches the backend rule (`AGENTS.md`): Payins never accepts or stores
  PAN/CVV, only provider tokens, enforced by a CI gate.

### 6.4 Embeddability

- A small **`payins.js`** loader mounts an **iframe** so an integrator can embed the
  checkout inside their own site.
- The iframe's **`frame-ancestors`** is restricted per platform, so an embed can only be
  framed by that platform's allowed origins.
- The checkout is **themeable per platform** and **internationalized**.

### 6.5 The CheckoutShell + flow registry pattern (canonical FSD example)

The checkout is the canonical example of how the FSD layers compose. The same shell
contract — `CheckoutFlowProps` — is honored by every method-specific flow, and the
shell picks the right flow at runtime from a registry. **Each integrated method is its
own `features/` slice with fully independent internals** (own state machine, own server
actions, own i18n namespace). Reuse happens **only** through `entities/` and `shared/`,
never feature-to-feature.

```
apps/checkout/src/
├── widgets/
│   └── checkout-shell/
│       ├── ui/CheckoutShell.tsx       # picks the right feature from the registry
│       ├── model/flowRegistry.ts      # FlowType → feature component
│       ├── model/CheckoutFlowProps.ts # the shell↔feature contract
│       └── index.ts
├── features/
│   ├── checkout-flow-yape/            # ENROLLMENT — phone → OTP → wait → success
│   │   ├── ui/YapeFlow.tsx
│   │   ├── model/machine.ts
│   │   ├── api/{startYape,confirmYape}.ts   # 'use server'
│   │   └── index.ts
│   ├── checkout-flow-nequi/           # ENROLLMENT — own machine, own actions, own i18n
│   ├── checkout-flow-plin/            # ENROLLMENT
│   ├── checkout-flow-pix-display/     # DISPLAY — show QR + poll
│   ├── checkout-flow-boleto/          # DISPLAY/REDIRECT_ASYNC
│   ├── checkout-flow-card-stripe/     # ONSITE_TOKEN — Stripe Elements
│   ├── checkout-flow-card-ebanx/      # ONSITE_TOKEN — Ebanx fields
│   ├── checkout-flow-redirect/        # generic REDIRECT
│   └── checkout-flow-mercadopago/     # REDIRECT (via Ebanx)
├── entities/
│   ├── payment-link/
│   │   ├── ui/LinkHeader.tsx          # noun-UI: merchant brand, amount, description
│   │   ├── api/getPaymentLinkBySlug.ts
│   │   ├── model/types.ts             # re-exports @payins/types
│   │   └── index.ts
│   ├── checkout/                      # read-side checkout DTOs + UI
│   └── payment/                       # MoneyAmount, status badge, etc.
└── shared/
    ├── ui/
    │   ├── PhoneStep/                 # used by Yape, Nequi, PLIN
    │   ├── OtpStep/                   # used by every ENROLLMENT flow
    │   ├── QRStep/                    # used by Pix, Yape (variant), …
    │   ├── WaitingStep/               # generic poll-status step
    │   └── MoneyAmount/
    ├── lib/
    │   ├── hooks/
    │   │   ├── usePollCheckout.ts     # generic polling primitive
    │   │   └── useProviderSdk.ts      # lazy-load Stripe.js / Ebanx.js
    │   ├── errors.ts                  # mapError(error) → { i18nKey, severity }
    │   ├── env.ts
    │   └── i18n/                      # next-intl config (server + client)
    └── api/
        ├── api.client.ts              # browser ApiClient factory
        └── api.server.ts              # server-only ApiClient factory
```

**Contract example (shell ↔ feature):**

```ts
// widgets/checkout-shell/model/CheckoutFlowProps.ts
import type { Checkout } from "@payins/types";

export type CheckoutFlowProps = {
  checkout: Checkout;     // the resolved checkout DTO
  onSuccess: () => void;  // called when the flow reaches a terminal success state
  onFailure: (code: string) => void;
};
```

```ts
// widgets/checkout-shell/model/flowRegistry.ts
import { YapeFlow } from "@/features/checkout-flow-yape";
import { NequiFlow } from "@/features/checkout-flow-nequi";
import { PixDisplayFlow } from "@/features/checkout-flow-pix-display";
// …
import type { FlowType, PaymentMethodSlug } from "@payins/types";
import type { ComponentType } from "react";
import type { CheckoutFlowProps } from "./CheckoutFlowProps";

type Key = `${FlowType}:${PaymentMethodSlug}`;
export const flowRegistry: Record<Key, ComponentType<CheckoutFlowProps>> = {
  "ENROLLMENT:yape": YapeFlow,
  "ENROLLMENT:nequi": NequiFlow,
  "ENROLLMENT:plin": PlinFlow,
  "DISPLAY:pix": PixDisplayFlow,
  // …
};
```

```tsx
// widgets/checkout-shell/ui/CheckoutShell.tsx
"use client";
import { flowRegistry } from "../model/flowRegistry";

export function CheckoutShell({ checkout }: { checkout: Checkout }) {
  const Flow = flowRegistry[`${checkout.flowType}:${checkout.methodSlug}` as const];
  if (!Flow) return <UnsupportedFlow />;
  return <Flow checkout={checkout} onSuccess={…} onFailure={…} />;
}
```

Adding a method = adding **one feature slice** + registering it in `flowRegistry`. Yape
≠ Nequi ≠ PLIN ≠ MercadoPago — they share **nothing** under `features/`, only the
shell contract, the shared primitives in `shared/ui/`, the entity reads in
`entities/payment-link/`, and the api-client.

### 6.6 Folder tree (full)

```
apps/checkout/src/
├── app/                            # Next App Router (thin route files only)
│   ├── layout.tsx                  # imports providers from src/shared/providers
│   ├── globals.css                 # imports app/styles
│   ├── error.tsx
│   ├── not-found.tsx
│   ├── l/
│   │   └── [slug]/page.tsx         # → renders <PaymentLinkPage slug=… />
│   ├── c/
│   │   └── [token]/page.tsx        # → renders <CheckoutPage token=… />
│   └── _providers/                 # FSD app-layer: <QueryClientProvider/>, <NextIntlClientProvider/>
├── pages/                          # FSD pages layer (page-level composition)
│   ├── payment-link/
│   │   ├── ui/PaymentLinkPage.tsx
│   │   └── index.ts
│   └── checkout/
│       ├── ui/CheckoutPage.tsx
│       └── index.ts
├── widgets/
│   ├── checkout-shell/             # see §6.5
│   ├── checkout-header/
│   └── checkout-footer/
├── features/                       # see §6.5 — one per integrated method
│   ├── checkout-flow-yape/
│   ├── checkout-flow-nequi/
│   ├── checkout-flow-plin/
│   ├── checkout-flow-pix-display/
│   ├── checkout-flow-boleto/
│   ├── checkout-flow-card-stripe/
│   ├── checkout-flow-card-ebanx/
│   ├── checkout-flow-redirect/
│   └── checkout-flow-mercadopago/
├── entities/
│   ├── payment-link/
│   ├── checkout/
│   └── payment/
├── shared/
│   ├── ui/                         # PhoneStep, OtpStep, QRStep, WaitingStep, MoneyAmount, Button, …
│   ├── lib/
│   │   ├── hooks/                  # usePollCheckout, useProviderSdk, useCountdown
│   │   ├── errors.ts               # mapError(error)
│   │   ├── env.ts                  # typed env (NEXT_PUBLIC_PAYINS_API_URL, …)
│   │   └── i18n/                   # next-intl client/server config
│   ├── api/
│   │   ├── api.client.ts           # browser ApiClient (NEXT_PUBLIC_PAYINS_API_URL)
│   │   └── api.server.ts           # server-only ApiClient (PAYINS_API_INTERNAL_URL)
│   └── providers/                  # shared React providers (referenced from src/app/_providers)
├── messages/                       # next-intl message catalogs
│   ├── es.json                     # default (day 1)
│   └── en.json                     # phase 2
├── i18n/
│   └── request.ts                  # next-intl `getRequestConfig` (server)
└── middleware.ts                   # next-intl locale negotiation; no auth (public)
```

---

## 7. `apps/dashboard` — superadmin console

The authenticated internal console.

### 7.1 Capabilities

- Configure **payment methods**, **capabilities**, and **commission contracts**.
- View **integrator platforms** (tenants and their accounts).
- **Observability** of payments, subscriptions, and disputes (TanStack Table + Recharts).
- **Inspect and replay webhook deliveries**.
- Manage admin users and roles (`iam`).

### 7.2 Rendering & data fetching

- SSR shell for the authenticated frame; **TanStack Query** drives client-side data
  fetching/caching against `@payins/api-client`.
- The Next server side is a thin BFF: it handles the dashboard **session** and SSR,
  nothing more — no business logic, no direct DB access.

### 7.3 Auth — owned by the backend `iam` feature

Dashboard auth is **owned by the backend**, in a bounded context **`iam`**, behind a
**swappable port `IAdminAuthenticator`**:

| Port method | Responsibility |
|---|---|
| `login` | authenticate admin credentials, issue a session |
| `validateSession` | verify a session token is live |
| `resolveRole` | return the authenticated admin's role |

The dashboard BFF wraps this as follows:

1. The login page (`/login`) renders a React Hook Form + Zod form.
2. Submit calls a **server action** (`'use server'`) `loginAction(input)` in
   `features/login-admin/api/`.
3. The server action uses `apiServer` (server-only api-client factory) to call
   `POST /v1/admin/login` on the backend.
4. On success, the server action sets the session in an **HttpOnly + Secure +
   `SameSite=Strict`** cookie (name: `payins_admin_session`) and redirects to
   `/platforms`.
5. `middleware.ts` runs on every protected route, reads the cookie, and calls
   `apiServer.admin.validateSession()`. If invalid → redirect to `/login`.
6. Logout calls a server action that POSTs `/v1/admin/logout` and clears the cookie.

```ts
// shared/api/api.server.ts (excerpt)
import "server-only";
import { cookies } from "next/headers";
import { createApiClient } from "@payins/api-client";
import { env } from "@/shared/lib/env";

export function apiServer() {
  const token = cookies().get("payins_admin_session")?.value;
  return createApiClient({
    baseUrl: env.PAYINS_API_INTERNAL_URL,
    sessionToken: token, // sent as Authorization: Bearer <token>
  });
}
```

- **Native adapter now:** admin users + sessions + roles, **argon2id** password
  hashing, secure session tokens. Entities `AdminUser`, `AdminSession`, `Role` are
  owned by the backend (out of scope here).
- **Swappable later:** the adapter can be replaced with a provider (Auth0 / Clerk /
  Firebase / Supabase) **without touching domain or dashboard** — only the adapter
  behind the port changes.
- **Roles:** `superadmin` now. Phase 2 adds a platform-scoped role for integrator
  self-service.

### 7.4 Folder tree (full)

```
apps/dashboard/src/
├── app/                            # Next App Router (thin route files only)
│   ├── layout.tsx                  # imports providers
│   ├── globals.css
│   ├── error.tsx
│   ├── not-found.tsx
│   ├── login/page.tsx              # → <LoginPage/>
│   ├── platforms/page.tsx          # → <PlatformsPage/>
│   ├── platforms/[id]/page.tsx     # → <PlatformDetailPage id=…/>
│   ├── payments/page.tsx
│   ├── payments/[id]/page.tsx
│   ├── subscriptions/page.tsx
│   ├── methods/page.tsx            # payment methods + capabilities
│   ├── contracts/page.tsx          # commission contracts
│   ├── webhooks/page.tsx           # outbound deliveries
│   ├── webhooks/[id]/page.tsx      # delivery detail + replay
│   ├── observability/page.tsx      # charts (Recharts)
│   ├── iam/page.tsx                # admin users + roles
│   └── _providers/
├── pages/
│   ├── login/                      # composition
│   ├── platforms/
│   ├── payments/
│   ├── subscriptions/
│   ├── methods/
│   ├── contracts/
│   ├── webhooks/
│   ├── observability/
│   └── iam/
├── widgets/
│   ├── topbar/
│   ├── sidebar/
│   ├── data-table/                 # TanStack Table wrapper
│   ├── filters-bar/
│   └── chart-card/                 # Recharts wrapper
├── features/
│   ├── login-admin/                # server action + form
│   ├── logout-admin/
│   ├── create-platform/
│   ├── edit-platform/
│   ├── refund-payment/
│   ├── dispute-payment/
│   ├── replay-webhook-delivery/
│   ├── create-contract/
│   ├── toggle-method-capability/
│   └── invite-admin/
├── entities/
│   ├── platform/                   # PlatformRow, listing query
│   ├── account/
│   ├── payment/                    # PaymentRow, StatusBadge, listing+detail queries
│   ├── subscription/
│   ├── invoice/
│   ├── method/                     # noun-UI for payment methods + capabilities
│   ├── contract/
│   ├── webhook-delivery/
│   └── admin-user/
├── shared/
│   ├── ui/                         # Button, Input, Card, Dialog, Toast, … (shadcn/ui-aligned)
│   ├── lib/
│   │   ├── hooks/
│   │   ├── errors.ts               # mapError(error)
│   │   ├── env.ts
│   │   └── i18n/
│   ├── api/
│   │   ├── api.client.ts           # browser (NEXT_PUBLIC_PAYINS_API_URL)
│   │   └── api.server.ts           # server-only (PAYINS_API_INTERNAL_URL + session cookie)
│   └── providers/
├── messages/
│   └── es.json                     # default; additional locales later (en, pt, …)
├── i18n/
│   └── request.ts
└── middleware.ts                   # auth gate + locale negotiation
```

---

## 8. Standards (mandatory)

### 8.1 API calls — always via `@payins/api-client`

Two factories, both wrapping the generated client:

```ts
// shared/api/api.client.ts                ← browser
import { createApiClient } from "@payins/api-client";
import { env } from "@/shared/lib/env";

export const apiClient = createApiClient({
  baseUrl: env.NEXT_PUBLIC_PAYINS_API_URL,
});
```

```ts
// shared/api/api.server.ts                ← server only
import "server-only";                       // hard fail if imported into a client bundle
import { cookies } from "next/headers";
import { createApiClient } from "@payins/api-client";
import { env } from "@/shared/lib/env";

export function apiServer() {
  const token = cookies().get("payins_admin_session")?.value;
  return createApiClient({
    baseUrl: env.PAYINS_API_INTERNAL_URL,
    sessionToken: token,                    // forwarded as Authorization: Bearer <token>
  });
}
```

- **Never raw `fetch`** against the backend in app code. The api-client is the only
  seam.
- The browser factory uses `NEXT_PUBLIC_PAYINS_API_URL`. The server factory uses
  `PAYINS_API_INTERNAL_URL` (private VPC URL when applicable; falls back to the public
  URL in dev).
- The server factory always forwards the dashboard session cookie as a bearer token,
  per `iam`.

### 8.2 Mutations — Server Actions by default

```ts
// features/refund-payment/api/refundPayment.ts
"use server";
import { apiServer } from "@/shared/api/api.server";
import type { RefundInput, RefundResult } from "@payins/types";

export async function refundPaymentAction(input: RefundInput): Promise<RefundResult> {
  const api = apiServer();
  // api-client auto-attaches an Idempotency-Key (UUID v7); override available.
  return api.payments.refund(input);
}
```

- **Server Actions** (`'use server'`) are the default path for mutations. They run on
  the Node BFF and call `apiServer`.
- Returns are typed `{ ok: true, … } | { ok: false, code, message }` — or throw a typed
  `PayinsError`. Per-feature error mapping is handled by `mapError` (§8.4).
- Client-side mutations (TanStack Query `useMutation` calling the browser
  `apiClient` directly) are used **only** when a server action is not viable — e.g.
  rapid optimistic UI in the dashboard, or anonymous flows in checkout where there is
  no session to forward. Documented per feature.

### 8.3 Idempotency

- Every backend mutation requires the `Idempotency-Key` header
  (`AGENTS.md` § HTTP and API).
- `@payins/api-client` **auto-generates a UUID v7 idempotency key** per mutation call
  and sets the header.
- Callers may override via `apiClient.payments.refund(input, { idempotencyKey: "…" })`
  when a stable retry key is needed (e.g. payer-driven retries in checkout).

### 8.4 Errors

- The backend returns `{ "error": "CODE", "message": "…" }` with an HTTP status mapped
  from `AppError` Kind (`AGENTS.md` § Observability and Error Handling).
- The api-client throws a typed `PayinsError`:

  ```ts
  class PayinsError extends Error {
    readonly code: string;          // e.g. "NO_CONTRACT_TERM"
    readonly httpStatus: number;
    readonly correlationId?: string;
  }
  ```

- A single `mapError(error)` helper lives in `shared/lib/errors.ts` and maps
  `code → { i18nKey, severity }` for toast/UI display:

  ```ts
  // shared/lib/errors.ts
  import { PayinsError } from "@payins/api-client";

  export function mapError(error: unknown): { i18nKey: string; severity: "warn"|"error" } {
    if (error instanceof PayinsError) {
      return {
        i18nKey: `errors.${error.code.toLowerCase()}`,
        severity: error.httpStatus >= 500 ? "error" : "warn",
      };
    }
    return { i18nKey: "errors.unknown", severity: "error" };
  }
  ```

- `messages/<locale>.json` carries `errors.no_contract_term`, `errors.version_conflict`,
  etc. Unknown codes fall through to a generic message.

### 8.5 Polling

- **Avoid polling by default.** Most user flows reach a terminal state via a server
  action result or a webhook-driven status update (SSE, §8.6).
- When polling is unavoidable (e.g. waiting for Yape OTP confirmation), use TanStack
  Query's `refetchInterval`:

  ```ts
  useQuery({
    queryKey: ["checkout", token],
    queryFn: () => apiClient.checkouts.get(token),
    refetchInterval: 5_000,                  // 5–30 s, never tighter than 5 s
    refetchIntervalInBackground: false,      // pause when tab hidden
    retry: (n, e) => n < 3 && !(e instanceof PayinsError && e.httpStatus < 500),
  });
  ```

- Document the polling interval and stop condition **inside the slice** (a comment in
  `model/usePollCheckout.ts` is enough). Back off on error.

### 8.6 Real-time — Server-Sent Events (SSE), not WebSockets

When real-time push is needed (e.g. live webhook delivery feed, payment status
updates in the dashboard), the transport is **SSE**, not WebSockets.

**Why SSE:**

- **HTTP-native.** Works through proxies, CDNs, and corporate networks that block WS.
- **Vercel-compatible.** Serverless edge/Node functions can stream SSE responses;
  WebSockets require long-lived processes (non-serverless infra) and are out of scope
  for our current deployment target.
- **One-way fits our needs.** All real-time use cases are server → client (status
  updates, webhook deliveries). We do not need full duplex.
- **WebSockets remain an option later** if a use case demands it; reopen the ADR
  before adding the dependency.

Wire shape (when implemented):

- Backend: `GET /v1/events/stream` — authenticated and tenant-scoped, returns
  `text/event-stream` with named events (`payment.updated`, `webhook.delivered`, …).
- Frontend: `@payins/api-client` exposes `events.subscribe(opts)`, a thin wrapper
  around the native `EventSource` that handles auth headers, reconnection with
  exponential backoff, and typed event payloads.

### 8.7 Forms

- **React Hook Form + Zod**, glued by `@hookform/resolvers/zod`.
- Schemas are shared with the backend through `@payins/types` (and, where possible,
  re-exported from `@payins/api-client`). One source of truth for input shapes; the
  frontend never duplicates a Zod schema.
- Server actions accept and re-validate the same Zod schema before calling the API —
  the backend is still the final authority.

### 8.8 State

| Kind | Tool | Where |
|---|---|---|
| **Server state** (anything that lives on the backend: payments, subscriptions, …) | **TanStack Query** | `entities/<x>/api/*.ts` and `features/<y>/api/*.ts` define `queryKey` factories; components call `useQuery`/`useMutation`. |
| **Local UI state** (modal open, form steps, transient toggles) | `useState` / `useReducer` | Component-local, or in `model/` of the slice. |
| **Global UI state** (current locale switcher, theme, command palette) — *rare* | **Zustand** (~1 KB) | `shared/lib/state/` only when local-state lifting becomes painful. |

There is no Redux. There is no global server-state store. TanStack Query owns the
server cache; everything else stays local until proven otherwise.

### 8.9 Internationalization — `next-intl` in BOTH apps from day 1

- Both `apps/checkout` and `apps/dashboard` ship with **`next-intl`** wired from the
  first commit. There is no "i18n later" — adding locales should not require a
  refactor.
- **Day-1 locales:**
  - `checkout`: `es` (default). `en` added in phase 2.
  - `dashboard`: `es` (default). Additional locales added as the team needs them.
- **Per-feature namespaces.** Messages are organized by feature so a slice owns its
  copy:
  - `checkout.yape.phoneStep.title`, `checkout.yape.otpStep.cta`
  - `dashboard.payments.list.columns.amount`, `dashboard.payments.detail.refund.confirm`
- **File layout:**
  - `messages/<locale>.json` (flat, namespaced by dotted keys).
  - `i18n/request.ts` exports next-intl's `getRequestConfig` for the server side.
  - `middleware.ts` performs locale negotiation (cookie + `Accept-Language`) before
    Next routes.
- **Usage:**
  - Server Components: `import { getTranslations } from "next-intl/server";`
  - Client Components: `import { useTranslations } from "next-intl";`
- Locale switching UI is deferred to phase 2 for checkout (one locale at launch) and
  added when the dashboard needs a second locale; the plumbing is already in place.

---

## 9. Tech stack (settled, do not re-open)

| Concern | Choice |
|---|---|
| Framework | **Next.js (App Router)** + **React** + **TypeScript** |
| Styling | **Tailwind CSS** with shared tokens (no shared UI lib — see §11) |
| Server state | **TanStack Query** |
| Tables | **TanStack Table** (dashboard) |
| Charts | **Recharts** (dashboard observability) |
| Icons | **Lucide** |
| UI primitives | **shadcn/ui** — initialization deferred (we add components on demand) |
| Forms | **React Hook Form** + **Zod** (`@hookform/resolvers/zod`) |
| i18n | **next-intl** in both apps from day 1 (§8.9) |
| Real-time | **SSE** via api-client wrapper (§8.6) |
| Testing | **Vitest** (unit), **Playwright** (e2e), **MSW** (API mocks) |
| Lint / format | **Biome** (single config at this repo's root) |
| Package manager | **pnpm 10** (internal workspace: `apps/*`, `packages/*`) |

---

## 10. Testing

- **Unit / component:** Vitest + Testing Library; mock the api-client surface with
  **MSW** to assert against real request/response shapes instead of stubs. Coverage
  policy for frontends is **pragmatic, not 100%**: prioritize critical paths
  (every checkout flow's machine, every dashboard mutation server action, error
  mapping). The backend retains 100% coverage; frontends are presentation.
- **E2E:** Playwright. Two suites:
  - `apps/checkout/e2e/` — exercises every `FlowType` against a mocked api-client via
    Playwright route interception (or, in integration mode, against the back's e2e
    Docker stack).
  - `apps/dashboard/e2e/` — exercises login → list → mutate → audit for the dashboard
    happy paths.
- **MSW** lives in `test/msw/` per app and mirrors the OpenAPI surface so tests stay
  in sync with the generated client.

---

## 11. Shared packages policy (conservative)

We share **only what cannot diverge**. The rule of three applies before extracting
anything else.

| Package | What it is | Why it's shared |
|---|---|---|
| `@payins/api-client` | Typed client **generated from the backend OpenAPI** | The single frontend↔backend seam; must always match the contract. |
| `@payins/types` | Shared DTO / contract types | One definition of the wire shapes used across both apps. |
| `@payins/money` | Minor-units / basis-points / ISO helpers | Money math must be identical everywhere; integer minor units + basis points, mirror backend conventions. |

**What we explicitly do NOT share yet:**

- **No shared UI component library.** Each app has its own `shared/ui/`. Tailwind
  tokens at the repo level keep the visual language coherent. Extract a shared
  component only after the **rule of three** (a third real reuse across both apps)
  proves the abstraction.
- A premature shared UI package couples two apps with very different audiences
  (public payer flow vs. authenticated admin console) and would slow both down.

---

## 12. Tooling

| Concern | Choice | Notes |
|---|---|---|
| Package manager | **pnpm 10** | Internal workspaces: `apps/*`, `packages/*`. |
| Task runner | **Turborepo** | Repo-wide tasks via `pnpm <task>` → `turbo run`. |
| Lint / format | **Biome** | Single linter/formatter for the **whole repo** (`biome.json` at root). |
| Layer linter | `scripts/check-feature-imports.cjs` | Enforces FSD strict (§5). Runs on `pre-commit` (lint-staged) for `apps/*/src/**`. |
| Node | **22** | Pinned via `.nvmrc`. |
| TypeScript | `tsconfig.base.json` | Apps/packages extend it. |
| Node linker | default (isolated) | This repo doesn't need hoisted; Prisma lives in the sibling backend repo only. |

---

## 13. Deployment

Full reference: [deployment.md](deployment.md).

### Vercel — two projects from this repo

This repo ships two Vercel projects; the backend has its own Vercel project in the
sibling backend repo. Each project sets its own **Root Directory**; Vercel detects
the internal pnpm workspace and installs at this repo's root.

| Vercel project | Root Directory | Notes |
|---|---|---|
| Checkout | `apps/checkout/` | Next.js, auto-detected. |
| Dashboard | `apps/dashboard/` | Next.js, auto-detected. |

### Env vars (frontend)

| Project | Key vars |
|---|---|
| `apps/checkout` | `NEXT_PUBLIC_PAYINS_API_URL` (public base URL of the back). |
| `apps/dashboard` | `NEXT_PUBLIC_PAYINS_API_URL`, `PAYINS_API_INTERNAL_URL` (BFF), `SESSION_SECRET`. |

### Docker-local

This repo's `docker-compose.dev.yml` brings up both apps with hot reload; the back
must already be running (in the sibling backend repo, native or dockerized). See
[deployment.md](deployment.md) for this repo's full Docker / Vercel reference, and
[../AGENTS.md](../AGENTS.md) § Docker for the canonical scripts.

---

## 14. Decisions log

Resolved choices, written as settled. (D1–D8 carry forward from the prior version;
D9–D14 are added for the FSD-strict-from-day-1 adoption.)

| # | Decision | Resolution |
|---|---|---|
| D1 | Repo structure & naming | **This repo is `Kunfupay-Payins-Front`** — an internal pnpm + Turborepo workspace with `apps/checkout`, `apps/dashboard`, and `packages/` (`@payins/api-client`, `@payins/types`, `@payins/money`). The backend is a separate, independent project. |
| D2 | Backend location ("A") | Backend is a separate, independent project; it deploys independently. The frontend only sees the backend as an HTTP endpoint. |
| D3 | Frontend framework | **Next.js (App Router) + React + TS + Tailwind** for **both** apps. |
| D4 | Linter / formatter | **Biome** for the whole repo. |
| D5 | Frontend↔backend seam | A single **typed `@payins/api-client` generated from the backend OpenAPI 3.1 spec**; frontends never import backend domain. |
| D6 | Dashboard auth | **Owned by the backend** in a new `iam` BC behind the swappable **`IAdminAuthenticator`** port — native adapter now (argon2id + sessions + roles), provider-swappable later, without touching domain or dashboard. |
| D7 | Shared packages | **Conservative**: share only `api-client`, `types`, `money`. **No shared UI library** — Tailwind tokens + rule of three. |
| D8 | Module resolution | This repo carries no Prisma; the default pnpm linker works. |
| D9 | Frontend architecture | **Feature-Sliced Design, strict, from day 1** in both apps. Six layers `app · pages · widgets · features · entities · shared`. Public-API only. Enforced by `scripts/check-feature-imports.cjs`. |
| D10 | `entities/` naming | Keep the standard FSD name. Disambiguation block (§5.2) is canonical: FSD entity ≠ DDD entity; DDD entities are owned by the backend (separate repo). |
| D11 | FSD `pages/` + Next App Router | Next's `src/app/<route>/page.tsx` stays thin and renders the FSD page composition in `src/pages/<route>/`. Standard FSD+App-Router adaptation (§5.4). |
| D12 | Internationalization | **`next-intl` wired in both apps from day 1.** `es` is the default; `en` added to checkout in phase 2; dashboard adds locales as needed. Per-feature namespaces. |
| D13 | Mutations | **Server Actions by default** (`'use server'`), using `apiServer` (server-only api-client factory). Client mutations only when server actions are not viable. |
| D14 | Real-time transport | **SSE** (`text/event-stream`) via api-client's `events.subscribe()`. WebSockets deferred; not Vercel-friendly under our current deployment model. |

---

## 15. References

- [../AGENTS.md](../AGENTS.md) — this repo's canonical agent guidance (frontend).
- [../../AGENTS.md](../../AGENTS.md) — umbrella agent guidance (cross-repo rules,
  including where the backend project is and how to coordinate cross-repo changes).
- [../../PAYINS_SERVICE_PLAN.md](../../PAYINS_SERVICE_PLAN.md) — roadmap, phases, scope.
- [deployment.md](deployment.md) — Vercel + Docker deployment for this repo.
- [`../scripts/check-feature-imports.cjs`](../scripts/check-feature-imports.cjs) — FSD
  strict layer/slice linter.
