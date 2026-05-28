# Kunfupay-Payins-Front

Frontend of the Payins payment-in orchestration platform. Internal **pnpm workspace**
holding both Next.js apps and the private workspace packages they share. **This repo
is independent**: it has its own lockfile, Docker, and Vercel projects. The Payins
backend lives in a sibling repo (`../Kunfupay-Payins-Back`).

For agent instructions and full conventions, read [`AGENTS.md`](AGENTS.md). The deep
architecture reference is [`docs/frontend-architecture.md`](docs/frontend-architecture.md).

## Apps + packages

| Path | Name | Type | Port |
|---|---|---|---|
| `apps/checkout` | `@payins/checkout` | Next.js (public, payer-facing) | `1466` |
| `apps/dashboard` | `@payins/dashboard` | Next.js (superadmin, authenticated) | `1467` |
| `packages/api-client` | `@payins/api-client` | Typed HTTP client (generated from back's OpenAPI) | — |
| `packages/types` | `@payins/types` | Shared DTO / contract types | — |
| `packages/money` | `@payins/money` | Minor-units / basis-points / ISO helpers | — |

## Stack

Next.js 15 (App Router) · React 19 · TypeScript 5 · Tailwind v3 · TanStack Query ·
next-intl · Biome · pnpm 10 · Turborepo.

Strict **Feature-Sliced Design** in both apps (`app → pages → widgets → features →
entities → shared`). Layer/slice rules enforced by
[`scripts/check-feature-imports.cjs`](scripts/check-feature-imports.cjs) via Husky +
lint-staged.

## Getting started

```bash
nvm use                 # Node 22
pnpm install            # installs all workspaces

# Bring the backend up FIRST (separate terminal)
cd ../Kunfupay-Payins-Back
pnpm start:local        # Postgres in Docker → schema → seed
pnpm dev                # Hono on :1464

# Then this repo
pnpm dev                # turbo: checkout :1466 + dashboard :1467
                        # both default NEXT_PUBLIC_PAYINS_API_URL=http://localhost:1464
```

Run a single workspace:

```bash
pnpm --filter @payins/checkout dev
pnpm --filter @payins/dashboard dev
```

## Docker (full front stack with hot reload)

`docker-compose.dev.yml` brings up both apps. The back is expected to be reachable
at `host.docker.internal:1464` (Docker Desktop on macOS/Windows; Linux uses the
`host-gateway` mapping declared in the compose file).

```bash
pnpm docker:dev
pnpm docker:dev:logs
pnpm docker:dev:down
pnpm docker:dev:reset       # down -v + docker:dev (wipes nothing — no volumes)
```

Production images (build per app):

```bash
docker build -f apps/checkout/Dockerfile  -t payins/checkout  .
docker build -f apps/dashboard/Dockerfile -t payins/dashboard .
```

## Repo tasks (workspace root)

```bash
pnpm dev          # turbo run dev across all workspaces
pnpm build        # turbo run build
pnpm lint        / pnpm lint:fix    # Biome (whole repo)
pnpm format
pnpm type-check  # turbo: tsc --noEmit
pnpm test        # turbo: tests per package
pnpm clean       # turbo clean + nuke node_modules
```

## Deployment

Two Vercel projects from this one repo, each with its own **Root Directory**:

| Vercel project | Root Directory | Framework |
|---|---|---|
| payins-checkout | `apps/checkout` | Next.js (auto-detected) |
| payins-dashboard | `apps/dashboard` | Next.js (auto-detected) |

Vercel installs from the repo root (pnpm workspace detected automatically). Env vars:
see [`AGENTS.md`](AGENTS.md) and [`docs/deployment.md`](docs/deployment.md).

## Where to read more

- Agent conventions: [`AGENTS.md`](AGENTS.md).
- Frontend deep dive (FSD, CheckoutShell, polling/SSE/forms/auth):
  [`docs/frontend-architecture.md`](docs/frontend-architecture.md).
- Cross-repo (umbrella) docs: [`../AGENTS.md`](../AGENTS.md),
  [`../PAYINS_SERVICE_PLAN.md`](../PAYINS_SERVICE_PLAN.md).
- Deployment of this repo: [`docs/deployment.md`](docs/deployment.md).
- Backend API surface (this repo's only seam): the backend's OpenAPI spec served at
  `http://localhost:1464/openapi`. See the umbrella [`../AGENTS.md`](../AGENTS.md)
  for cross-repo coordination.
