FROM node:22-alpine AS base

RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json turbo.json ./

COPY apps/api/package.json apps/api/tsconfig.json apps/api/
COPY apps/worker/package.json apps/worker/tsconfig.json apps/worker/
COPY apps/web/package.json apps/web/

COPY packages/audit/package.json packages/audit/tsconfig.json packages/audit/
COPY packages/auth/package.json packages/auth/tsconfig.json packages/auth/
COPY packages/config/package.json packages/config/tsconfig.json packages/config/
COPY packages/contracts/package.json packages/contracts/tsconfig.json packages/contracts/
COPY packages/db/package.json packages/db/tsconfig.json packages/db/
COPY packages/domain/package.json packages/domain/tsconfig.json packages/domain/
COPY packages/jobs/package.json packages/jobs/tsconfig.json packages/jobs/
COPY packages/knowledge/package.json packages/knowledge/tsconfig.json packages/knowledge/
COPY packages/observability/package.json packages/observability/tsconfig.json packages/observability/
COPY packages/storage/package.json packages/storage/tsconfig.json packages/storage/
COPY packages/ai/package.json packages/ai/tsconfig.json packages/ai/
COPY packages/memory/package.json packages/memory/tsconfig.json packages/memory/
COPY packages/tools/package.json packages/tools/tsconfig.json packages/tools/
COPY packages/evals/package.json packages/evals/tsconfig.json packages/evals/

FROM base AS deps
RUN pnpm install --frozen-lockfile --prod

FROM base AS builder
RUN pnpm install --frozen-lockfile

COPY apps/api/src apps/api/src/
COPY apps/worker/src apps/worker/src/
COPY packages/audit/src packages/audit/src/
COPY packages/auth/src packages/auth/src/
COPY packages/config/src packages/config/src/
COPY packages/contracts/src packages/contracts/src/
COPY packages/db/src packages/db/src/
COPY packages/domain/src packages/domain/src/
COPY packages/jobs/src packages/jobs/src/
COPY packages/knowledge/src packages/knowledge/src/
COPY packages/observability/src packages/observability/src/
COPY packages/storage/src packages/storage/src/
COPY packages/ai/src packages/ai/src/
COPY packages/memory/src packages/memory/src/
COPY packages/tools/src packages/tools/src/
COPY packages/evals/src packages/evals/src/

RUN pnpm run build

FROM node:22-alpine AS runner
WORKDIR /app

RUN addgroup -S pia && adduser -S pia -G pia

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/jobs/dist ./packages/jobs/dist
COPY --from=builder /app/packages/knowledge/dist ./packages/knowledge/dist
COPY --from=builder /app/packages/observability/dist ./packages/observability/dist
COPY --from=builder /app/packages/storage/dist ./packages/storage/dist

USER pia

CMD ["node", "apps/worker/dist/index.js"]
