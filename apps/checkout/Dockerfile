# Production image for the Payins checkout (Next.js).
# Build context = the front repo root (Kunfupay-Payins-Front/). Build from this repo:
#   `docker build -f apps/checkout/Dockerfile -t payins/checkout .`
# The repo-root `docker-compose*.yml` files set `context: .` and
# `dockerfile: apps/checkout/Dockerfile`.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /workspace

# ── deps: install only what `@payins/checkout` needs (incl. workspace deps) ──
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/types/package.json      ./packages/types/
COPY packages/money/package.json      ./packages/money/
COPY apps/checkout/package.json       ./apps/checkout/
COPY apps/dashboard/package.json      ./apps/dashboard/
RUN pnpm install --frozen-lockfile --filter '@payins/checkout...'

# ── build: compile Next ──
FROM base AS build
COPY --from=deps /workspace ./
COPY packages      ./packages
COPY apps/checkout ./apps/checkout
RUN pnpm --filter @payins/checkout build

# ── production: minimal runtime ──
FROM base AS production
ENV NODE_ENV=production
COPY --from=build /workspace/node_modules                  ./node_modules
COPY --from=build /workspace/packages                      ./packages
COPY --from=build /workspace/apps/checkout/.next           ./apps/checkout/.next
COPY --from=build /workspace/apps/checkout/public          ./apps/checkout/public
COPY --from=build /workspace/apps/checkout/package.json    ./apps/checkout/
COPY --from=build /workspace/apps/checkout/next.config.mjs ./apps/checkout/
COPY --from=build /workspace/apps/checkout/next-env.d.ts   ./apps/checkout/
WORKDIR /workspace/apps/checkout
EXPOSE 1466
CMD ["pnpm", "start"]
