# Production image for the Payins dashboard (Next.js).
# Build context = the front repo root (Kunfupay-Payins-Front/). Build from this repo:
#   `docker build -f apps/dashboard/Dockerfile -t payins/dashboard .`
# The repo-root `docker-compose*.yml` files set `context: .` and
# `dockerfile: apps/dashboard/Dockerfile`.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /workspace

# ── deps: install only what `@payins/dashboard` needs (incl. workspace deps) ──
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/types/package.json      ./packages/types/
COPY packages/money/package.json      ./packages/money/
COPY apps/checkout/package.json       ./apps/checkout/
COPY apps/dashboard/package.json      ./apps/dashboard/
RUN pnpm install --frozen-lockfile --filter '@payins/dashboard...'

# ── build: compile Next ──
FROM base AS build
COPY --from=deps /workspace ./
COPY packages       ./packages
COPY apps/dashboard ./apps/dashboard
RUN pnpm --filter @payins/dashboard build

# ── production: minimal runtime ──
FROM base AS production
ENV NODE_ENV=production
COPY --from=build /workspace/node_modules                   ./node_modules
COPY --from=build /workspace/packages                       ./packages
COPY --from=build /workspace/apps/dashboard/.next           ./apps/dashboard/.next
COPY --from=build /workspace/apps/dashboard/public          ./apps/dashboard/public
COPY --from=build /workspace/apps/dashboard/package.json    ./apps/dashboard/
COPY --from=build /workspace/apps/dashboard/next.config.mjs ./apps/dashboard/
COPY --from=build /workspace/apps/dashboard/next-env.d.ts   ./apps/dashboard/
WORKDIR /workspace/apps/dashboard
EXPOSE 1467
CMD ["pnpm", "start"]
