# Kunfupay-Payins-Front — Agent Instructions

Canonical instructions for AI coding agents (Cursor, Codex, Claude Code, …) and humans
working in this frontend repo. **This is the single canonical file for everything
frontend-side.** It is the standalone equivalent of the umbrella's `AGENTS.md` for
this repo's scope.

## Canonical Source

- **`AGENTS.md` (this file) is the single canonical instruction file for this repo.**
- `CLAUDE.md` is a thin wrapper that imports this file (`@AGENTS.md`).
- **Language:** code and comments in English; docs in English. **Responses to the user
  are always in Spanish.**
- This repo is **independent** of the backend repo
  ([`../Kunfupay-Payins-Back`](../Kunfupay-Payins-Back)); see the umbrella
  [`../AGENTS.md`](../AGENTS.md) for cross-repo rules.
- For the deep-dive frontend reference (FSD strict, the six layers, the `entities/`
  disambiguation, the CheckoutShell + flow registry pattern, polling / SSE / forms /
  auth standards), the canonical reference is
  [`docs/frontend-architecture.md`](docs/frontend-architecture.md). This file
  summarises the conventions and routes to that doc.

## Repo Snapshot

Two Next.js apps in an **internal pnpm workspace**, consuming the Payins backend
(`../Kunfupay-Payins-Back`) over HTTP. They never import backend source code; the only
seam is a typed client generated from the backend's OpenAPI 3.1 spec.

| App | Path | Port | Purpose |
|---|---|---|---|
| **checkout** | [`apps/checkout/`](apps/checkout/) | `1466` | Public, payer-facing. Renders hosted/embedded UI per `FlowType` (Pix QR, Boleto, Yape/Nequi, card). |
| **dashboard** | [`apps/dashboard/`](apps/dashboard/) | `1467` | Authenticated superadmin console (methods, commissions, platforms, observability). Auth owned by the backend `iam` behind a swappable port. |

Workspace packages (private, internal — not published):

| Package | Path | Purpose |
|---|---|---|
| `@payins/api-client` | [`packages/api-client/`](packages/api-client/) | Typed HTTP client generated from the backend's `/openapi`. |
| `@payins/types` | [`packages/types/`](packages/types/) | Shared DTO / contract types. |
| `@payins/money` | [`packages/money/`](packages/money/) | Minor-units, basis-points, ISO helpers (frontend-shaped — `number` not `BigInt`). |

- **Stack:** Next.js 15 (App Router) · React 19 · TypeScript 5 · Tailwind v3 · TanStack
  Query · next-intl · Biome · pnpm 10 · Turborepo.
- **Local development:** native (`pnpm dev`) or fully dockerized (`pnpm docker:dev`).
  Both expect the backend to be reachable at `http://localhost:1464` (native) or
  `http://host.docker.internal:1464` (dockerized) — bring it up from the back repo first.
- **Production:** Vercel (two projects: checkout, dashboard). Both auto-detected as
  Next.js; their **Root Directory** points at `apps/checkout` / `apps/dashboard`.

## Layout

```
.
├── apps/
│   ├── checkout/             Next.js — public, payer-facing checkout (per-FlowType UIs).
│   │   ├── src/              FSD layers: app, pages, widgets, features, entities, shared.
│   │   ├── messages/         next-intl locale bundles.
│   │   ├── public/
│   │   ├── Dockerfile, Dockerfile.dev
│   │   ├── next.config.mjs, tailwind.config.ts, postcss.config.mjs
│   │   └── package.json, tsconfig.json
│   └── dashboard/            Next.js — superadmin console (auth via backend iam).
│       └── (same layout as checkout, port 1467)
├── packages/                 Internal workspace packages (private, not published).
│   ├── api-client/           Typed client generated from back's OpenAPI.
│   ├── types/                Shared DTO / contract types.
│   └── money/                Minor-units / basis-points / ISO helpers (front-shaped).
├── docs/
│   └── frontend-architecture.md     Canonical deep dive (FSD, CheckoutShell, …).
├── scripts/
│   └── check-feature-imports.cjs    FSD enforcement (pre-commit).
├── docker-compose.dev.yml    Both apps with hot reload; back on host.docker.internal:1464.
├── package.json · pnpm-lock.yaml · pnpm-workspace.yaml · turbo.json
├── tsconfig.base.json · biome.json · .npmrc · .nvmrc · .husky/
└── README.md · CLAUDE.md · AGENTS.md
```

## Load Relevant Context First

Before any task, read the relevant files below. Do not implement before loading the
applicable context.

| Task area | Read first |
|-----------|------------|
| Anything in either app | [`docs/frontend-architecture.md`](docs/frontend-architecture.md) (canonical) |
| FSD layers / slice rules / public-API enforcement | [`docs/frontend-architecture.md`](docs/frontend-architecture.md) §§ 5–7, [`scripts/check-feature-imports.cjs`](scripts/check-feature-imports.cjs) |
| A new checkout method (Yape, Nequi, …) | [`docs/frontend-architecture.md`](docs/frontend-architecture.md) § "CheckoutShell + flow registry" |
| API client / types / money helpers | [`packages/api-client/src/`](packages/api-client/), [`packages/types/src/`](packages/types/), [`packages/money/src/`](packages/money/) |
| Backend API surface (this repo's only seam) | The backend OpenAPI spec at `http://localhost:1464/openapi` (live) and the contract types in [`packages/api-client/`](packages/api-client/) + [`packages/types/`](packages/types/). For cross-repo coordination, see [`../AGENTS.md`](../AGENTS.md). |
| Deployment | [`docs/deployment.md`](docs/deployment.md) |
| Roadmap / phases | [`../PAYINS_SERVICE_PLAN.md`](../PAYINS_SERVICE_PLAN.md) |
| Cross-repo rules | [`../AGENTS.md`](../AGENTS.md) |

## Core Rules (re-stated from the umbrella; this repo enforces them)

- **Tenancy** is owned by the backend. The dashboard surfaces it (Platform → Account
  hierarchy) but never bypasses it; every read/mutate goes through the api-client and
  carries the admin session.
- **Amounts:** `number` representing **integer minor units** everywhere in the front
  (`amount_minor: number`). Never floats, never decimals. `$1.99 = 199`. The
  `@payins/money` helpers convert to/from human-readable strings; never roll your own
  formatter.
- **Percentages:** basis points integer (0–10000). Never float.
- **Timestamps:** Unix milliseconds as `number` everywhere (from the API, in props,
  in state). Never convert to `Date` or ISO strings except at the very last
  rendering step (`Intl.DateTimeFormat` / a small formatter helper). Keep one
  representation end-to-end; no conversions in transit.
- **IDs:** UUID v7. The api-client generates `Idempotency-Key` as UUID v7 per
  mutation. Never UUID v4.
- **Country:** ISO-3166-1 alpha-2 uppercase. **Currency:** ISO-4217 uppercase.
- **PCI:** Payins **never** sees PAN/CVV. Provider browser SDKs (Stripe.js, Ebanx
  fields) tokenize in the user's browser; only the resulting token hits the backend.
  Do not introduce any code path that captures PAN or CVV. CI gate:
  `rg -iE "pan|cvv|card.?number"` under `apps/*/src/` and `packages/*/src/` must be
  empty.
- **Consumer isolation:** No file references "kunfupay", "sale", "order", or
  "product". CI gate: `rg -i "kunfupay|sale|order|product"` under `apps/*/src/` and
  `packages/*/src/` must be empty.
- **Never import from the backend repo.** Cross-repo traffic is HTTP only, mediated
  by `@payins/api-client`.

## Architecture (Strict FSD)

- **Strict Feature-Sliced Design, 6 layers**, in both apps:

  ```
  app → pages → widgets → features → entities → shared
  ```

  Import direction is **strictly downward** (each layer may import only from layers
  below it). Same-layer slices may not import each other; cross-feature reuse goes
  through `entities/` or `shared/`. Imports targeting a slice must hit its `index.ts`
  (public API); deep imports are forbidden. **Enforced by
  [`scripts/check-feature-imports.cjs`](scripts/check-feature-imports.cjs).**
- `entities/` keeps the standard FSD name **but is NOT a DDD entity**. The DDD
  entities of this product are owned by the backend (separate, independent project).
  The frontend has no domain layer. Full disambiguation in
  [`docs/frontend-architecture.md`](docs/frontend-architecture.md) § 5.2.
- **`app/` is Next's App Router**; FSD's `pages/` layer lives in `src/pages/` and
  holds page-level *compositions* that the Next route files import. See
  [`docs/frontend-architecture.md`](docs/frontend-architecture.md) § 5.4.

## Conventions

- **Next.js App Router**, React 19, TypeScript, Tailwind. Server Components by
  default; client islands only where interactivity demands it (e.g. provider SDKs in
  checkout).
- **`transpilePackages`** lists the `@payins/*` workspace packages (they export TS
  source).
- **API calls — always via `@payins/api-client`.** Two factories per app:
  - `src/shared/api/api.client.ts` — browser (`NEXT_PUBLIC_PAYINS_API_URL`).
  - `src/shared/api/api.server.ts` — `import "server-only";` +
    `PAYINS_API_INTERNAL_URL` + forwards admin session token (dashboard).
  Never raw `fetch`.
- **Mutations:** Server Actions (`'use server'`) by default, calling the server-only
  api-client. Client mutations only when server actions aren't viable.
- **Idempotency-Key:** auto-generated as UUID v7 by the api-client per mutation;
  override when needed.
- **Errors:** backend returns `{error: CODE, message}`; api-client throws typed
  `PayinsError`; a single `mapError(error)` helper in `src/shared/lib/errors.ts` maps
  `code → i18n key → toast severity`.
- **Polling:** avoid by default. If needed, `refetchInterval` 5–30 s with
  `refetchIntervalInBackground: false` and backoff on error. Documented per query.
- **Real-time = SSE, not WebSockets.** HTTP-native, Vercel-compatible, one-way push
  fits status updates and webhook deliveries. When needed, backend exposes
  `GET /v1/events/stream` and the api-client wraps `EventSource`. WebSockets would
  require non-serverless infra; deferred.
- **Forms:** React Hook Form + Zod resolver. Schemas shared via `@payins/types` /
  `@payins/api-client` where possible.
- **State:** server state = TanStack Query; UI state = local `useState`/`useReducer`;
  rare global UI state = Zustand (~1 KB) — not Redux.
- **i18n (next-intl) in BOTH apps from day 1**, per-feature namespaces
  (`checkout.yape.*`, `dashboard.payments.*`). Default locale `es`. Bundles in
  `messages/<locale>.json`. Server-side config in `src/i18n/request.ts`.

## Per-app specifics

- **`apps/checkout` (public, payer-facing).** Routes `/l/:slug`, `/c/:token`. Renders
  per-`FlowType` UI (card, Pix QR, Boleto voucher, Yape/Nequi enrollment, redirect) —
  the flows Payins renders natively. PCI: provider SDK tokenizes in the browser;
  Payins never sees PAN. Embeddable via `payins.js` mounting an iframe
  (`frame-ancestors` restricted per platform). i18n: `es` + `en`. Dev port `1466`.
  **Each method integrated by us has its OWN feature file**
  (`features/checkout-flow-yape/`, `features/checkout-flow-nequi/`, …). Same shell
  contract `CheckoutFlowProps`, fully independent internals (own state machine, own
  server actions). Reuse via primitives in `shared/` (`PhoneStep`, `OtpStep`,
  `QRStep`, `WaitingStep`, `usePollCheckout`, `useProviderSdk`). Do NOT parametrize a
  single shared "WalletEnrollmentFlow".
- **`apps/dashboard` (superadmin, authenticated).** Configure methods, capabilities,
  commission contracts; view platforms; observability of payments / subscriptions /
  disputes; webhook deliveries with replay. Auth owned by the backend `iam` feature
  behind the swappable `IAdminAuthenticator` port (native argon2id adapter today;
  swappable to Auth0/Clerk/Firebase later). Session in HttpOnly + Secure +
  SameSite=Strict cookie. `src/middleware.ts` gates protected routes. Phase 2 adds
  reduced platform-scoped self-service. Dev port `1467`.

## Frontend testing

- **Vitest + Testing Library + MSW** for unit / component tests.
- **Playwright** for E2E (especially the checkout flow).
- Coverage: meaningful coverage; **not a strict 100% gate** (front pragmatic vs
  backend mandatory 100%). See [`docs/frontend-architecture.md`](docs/frontend-architecture.md)
  § 10.

## Workspace tooling (internal)

This repo is an **internal pnpm workspace** (apps + private packages). The umbrella
is NOT a workspace.

- **pnpm 10 + Turborepo.** Run repo-wide tasks via `pnpm <task>` at root (delegates
  to `turbo run`). Workspace globs: `apps/*`, `packages/*`.
- **Node 22** (`.nvmrc`).
- **Biome** is the single linter / formatter (`biome.json` at root). Run
  `pnpm lint` / `pnpm lint:fix`.
- **TypeScript:** apps and packages extend `tsconfig.base.json` at the repo root.
- **Enforcement script (`scripts/check-feature-imports.cjs`):** front FSD rules
  (layer direction, slice isolation, public-API enforcement). Run as a lint-staged
  step on `apps/*/src/**/*.{ts,tsx}`.
- **husky `pre-commit`** runs `pnpm exec lint-staged`. Config in the root
  `package.json`:
  - `apps/*/src/**/*.{ts,tsx}` → `biome check` + `check-feature-imports.cjs`.
  - `packages/**/*.ts` → `biome check`.

## Docker

One compose file at the **root of this repo**. Bringing up the front does NOT bring
up Postgres or the back — bring them up from the backend repo first
(`cd ../Kunfupay-Payins-Back && pnpm docker:up && pnpm dev` is typical).

| File | Project name | Scope | Ports |
|---|---|---|---|
| `docker-compose.dev.yml` | `payins-front-dev` | checkout + dashboard with hot reload | checkout `:1466`, dashboard `:1467` |

The compose file points both apps at the backend via
`PAYINS_API_INTERNAL_URL=http://host.docker.internal:1464` for server-side calls and
`NEXT_PUBLIC_PAYINS_API_URL=http://localhost:1464` for the browser. Linux users:
`extra_hosts: host.docker.internal:host-gateway` is set in the compose file so it
works on Linux too.

```bash
pnpm docker:dev          # build + up both apps
pnpm docker:dev:logs
pnpm docker:dev:down
pnpm docker:dev:reset    # down -v + docker:dev
```

For production images (one per app), use the app's own `Dockerfile`:

```bash
docker build -f apps/checkout/Dockerfile  -t payins/checkout  .
docker build -f apps/dashboard/Dockerfile -t payins/dashboard .
```

Both Dockerfiles use `context: .` (the repo root) because the lockfile + workspace
manifest + sibling workspace packages live here.

## Workflow

1. Run `pnpm lint` (Biome) and `pnpm type-check` before committing.
2. Husky hooks are mandatory. Never bypass with `--no-verify`.
3. New slice → respect FSD layer rules
   ([`scripts/check-feature-imports.cjs`](scripts/check-feature-imports.cjs) enforces).
4. Any new visible string → must go through `t('key')`; no hardcoded copy. Add the
   keys to `messages/<locale>.json` per app.
5. New method to integrate → ONE new feature file under
   `features/checkout-flow-<method>/` with its own state machine + server actions.
   Don't share orchestrators across methods; only primitives in `shared/`.
6. Component reused by 3+ features → extract upward to `entities/<noun>/` (rule of
   three).
7. **API contract changed in the backend?** Regenerate `@payins/api-client` from the
   updated OpenAPI:
   - Run the backend locally (`cd ../Kunfupay-Payins-Back && pnpm dev`).
   - From this repo: `pnpm --filter @payins/api-client generate` (script currently
     scaffolded — fill in the codegen command as the integration matures).
   - Commit the regenerated client + the consumers updated to match.
   - Coordinate the change per the umbrella `../AGENTS.md` § "Cross-repo workflow".

## Workspace tasks (root scripts)

```bash
pnpm dev          # turbo: both apps in dev mode
pnpm build        # turbo: production builds (both apps + packages)
pnpm lint        / pnpm lint:fix      # Biome
pnpm format
pnpm type-check  # turbo: tsc --noEmit per package
pnpm test        # turbo: tests per package
pnpm clean       # turbo clean + nuke node_modules
```

Run a single workspace:

```bash
pnpm --filter @payins/checkout dev
pnpm --filter @payins/dashboard dev
pnpm --filter @payins/api-client type-check
```
