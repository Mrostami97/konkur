FROM node:24-bookworm-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY patches patches
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
# pg_dump for the admin panel's full backup; it must match the server's
# major version (postgres:16), which Debian's own package does not.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update -y \
  && apt-get install -y --no-install-recommends postgresql-client-16 \
  && apt-get purge -y curl && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV PG_DUMP_BIN=/usr/lib/postgresql/16/bin/pg_dump
WORKDIR /app
COPY --chown=node:node --from=production /prod/api ./
COPY --chown=node:node scripts/check-production-config.mjs ./scripts/check-production-config.mjs
USER node
EXPOSE 3001
CMD ["sh", "-c", "node scripts/check-production-config.mjs --require-credentials && node_modules/.bin/prisma migrate deploy && node dist/bootstrap-admin.js && node dist/main.js"]
