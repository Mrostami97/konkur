FROM node:20-bookworm-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @konkurcom/web...

FROM deps AS build
COPY apps/web apps/web
ENV NEXT_OUTPUT_MODE=standalone
RUN pnpm --filter @konkurcom/web run build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

# Next's standalone output contains only the server files and traced runtime
# dependencies. Keeping static/public assets beside the generated monorepo
# server avoids shipping the full pnpm store and source tree (previously
# ~1.65 GB on the VPS).
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
