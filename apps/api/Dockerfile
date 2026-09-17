FROM node:20-bookworm-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY contracts/package.json contracts/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @konkurcom/api...

FROM deps AS build
COPY contracts contracts
COPY apps/api apps/api
RUN pnpm --filter @konkurcom/contracts run build
RUN pnpm --filter @konkurcom/api exec prisma generate
RUN pnpm --filter @konkurcom/api run build

# Produce a portable package containing production dependencies only. The old
# runtime copied the complete workspace pnpm store plus sources/tests, yielding
# a ~1.05 GB image that was expensive and unreliable to stream to the VPS.
FROM build AS production
RUN pnpm --filter @konkurcom/api deploy --prod /prod/api \
  && cd /prod/api \
  && node_modules/.bin/prisma generate --schema=prisma/schema.prisma

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=production /prod/api ./
EXPOSE 3001
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/bootstrap-admin.js && node dist/main.js"]
