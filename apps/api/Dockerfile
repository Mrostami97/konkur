FROM node:20-bookworm-slim AS base
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

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/contracts ./contracts
COPY --from=build /repo/apps/api ./apps/api
WORKDIR /repo/apps/api
EXPOSE 3001
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
