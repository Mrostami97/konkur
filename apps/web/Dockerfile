FROM node:20-bookworm-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @konkurcom/web...

FROM deps AS build
COPY apps/web apps/web
RUN pnpm --filter @konkurcom/web run build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo/apps/web
COPY --from=build /repo/node_modules /repo/node_modules
COPY --from=build /repo/apps/web ./
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
