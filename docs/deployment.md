# Deployment — Frontend

How to deploy this repo on **Vercel** and how to run it **locally with Docker**.
This is the **frontend** of the Payins platform — an internal pnpm workspace with
two Next.js apps (`apps/checkout`, `apps/dashboard`) plus the private workspace
packages they share. The Hono backend is a separate, independent project and is
out of scope here; refer to the umbrella [`../../README.md`](../../README.md) for
the cross-repo overview.

---

## Vercel — two projects from this repo

Create **two Vercel projects** pointing at this same repo, one per Next.js app.
Each project sets its own **Root Directory**; Vercel detects the internal pnpm
workspace and installs at the repo root.

| Vercel project | Root Directory | Framework | Build | Output |
|---|---|---|---|---|
| **payins-checkout** | `apps/checkout` | Next.js (auto-detected) | `next build` (or override: `pnpm --filter @payins/checkout build`) | `.next/` |
| **payins-dashboard** | `apps/dashboard` | Next.js (auto-detected) | `next build` (or override: `pnpm --filter @payins/dashboard build`) | `.next/` |

> If Vercel's auto build command for a Next project fails to run `pnpm build` from
> the workspace root, set the override above to force the workspace-aware build.

### Environment variables

| Project | Key vars |
|---|---|
| `apps/checkout` | `NEXT_PUBLIC_PAYINS_API_URL` — public base URL of the backend. |
| `apps/dashboard` | `NEXT_PUBLIC_PAYINS_API_URL`, `PAYINS_API_INTERNAL_URL` (BFF — RSC / server actions), `SESSION_SECRET`. |

Typical domain mapping:

| Project | Domain |
|---|---|
| payins-checkout | `checkout.payins.example` |
| payins-dashboard | `admin.payins.example` |

---

## Docker — local development

One compose file at this repo's root. The front compose does NOT bring up Postgres
or the back — bring those up from the backend repo first (native or dockerized).
Both apps reach the back at `host.docker.internal:1464` server-side and
`localhost:1464` browser-side (the `host-gateway` mapping in the compose file
makes it work on Linux too).

| File | Project name | Scope | Ports |
|---|---|---|---|
| `docker-compose.dev.yml` | `payins-front-dev` | checkout + dashboard with hot reload | checkout `:1466`, dashboard `:1467` |

### Full front stack with hot reload

```bash
# Bring the backend up first, in its own project (refer to its own scripts).
# Then, in this repo:
pnpm docker:dev          # build + up both apps
pnpm docker:dev:logs
pnpm docker:dev:down
pnpm docker:dev:reset    # down -v + docker:dev
```

> The compose file expects the backend to be reachable at
> `host.docker.internal:1464`. Start it however the backend project's docs say
> (see the umbrella [`README.md`](../../README.md) for the cross-repo overview).

### Production images (one per app)

```bash
docker build -f apps/checkout/Dockerfile  -t payins/checkout  .
docker build -f apps/dashboard/Dockerfile -t payins/dashboard .
```

Both Dockerfiles use `context: .` (this repo's root) because the lockfile +
workspace manifest + sibling workspace packages live here.

### Image build internals (for reference)

Each app has its own `Dockerfile` (production, multi-stage) and `Dockerfile.dev`
(single-stage, hot reload). The deps stage:

1. `COPY` the workspace skeleton: `pnpm-workspace.yaml`, `pnpm-lock.yaml`, root
   `package.json`, `.npmrc`, `tsconfig.base.json`, every package's `package.json`
   (apps + packages) so pnpm can resolve the workspace graph.
2. `pnpm install --frozen-lockfile --filter '@payins/<app>...'` — installs only the
   target app and its transitive workspace deps.
3. (production) Copy `packages/` + `apps/<app>/` and `pnpm --filter @payins/<app>
   build`. The final stage carries only `.next/`, `public/`, and the production
   `node_modules`.

`.dockerignore` excludes `node_modules`, `.next`, `.turbo`, `dist`, etc.

---

## Sanity checks (without a Docker daemon)

```bash
docker compose -f docker-compose.dev.yml config --quiet

pnpm install
pnpm type-check                                  # turbo: tsc --noEmit per package
pnpm --filter @payins/checkout  build
pnpm --filter @payins/dashboard build
```

---

## What's pre-verified vs what needs an actual deploy/run

**Verified locally** (without Docker daemon running, without Vercel deploy):

- `pnpm install` resolves all 6 workspace projects (2 apps + 3 packages + root).
- `pnpm type-check` passes across the workspace.
- `next build` for both apps produces Vercel-ready output.
- `docker compose -f docker-compose.dev.yml config` parses and resolves contexts.

**Needs a real run to confirm** (because they hit external systems):

- Building any Docker image (needs the Docker daemon).
- Vercel deployment — the per-project Root Directory + env vars must be set in the
  Vercel UI for each of the two projects.
- Cross-repo wiring: the front expects the back to be reachable at
  `NEXT_PUBLIC_PAYINS_API_URL` (browser) and `PAYINS_API_INTERNAL_URL` (server).

---

## See also

- [`../AGENTS.md`](../AGENTS.md) § Docker — the canonical compose/scripts reference.
- [`frontend-architecture.md`](frontend-architecture.md) § 13 — deployment from the
  architecture's point of view.
- Umbrella overview (cross-repo orientation):
  [`../../README.md`](../../README.md), [`../../AGENTS.md`](../../AGENTS.md).
- Umbrella roadmap: [`../../PAYINS_SERVICE_PLAN.md`](../../PAYINS_SERVICE_PLAN.md).
