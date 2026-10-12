# syntax=docker/dockerfile:1
# Build stages install every dependency, including the optional embedding model
# packages that generate the catalogue vectors. The runtime stage installs
# production dependencies only, without optional packages, and holds no model.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN pnpm build

FROM build AS embeddings
ARG DATA_REF=777cf5e752775b20537e1a499c3998eadc2bc184
ENV DATA_REF=${DATA_REF} EMBEDDING_CACHE_DIR=/model-cache
RUN node scripts/fetch-build-data.mjs
RUN node --import tsx scripts/generate-embeddings.ts --data-dir=/data --output=/data/ld/embeddings.json

FROM node:22-bookworm-slim AS production-dependencies
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --no-optional

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3100 HOST=0.0.0.0 DATA_DIR=/app/data TEA_OFFLINE=1 RANKING_ENABLED=false
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=embeddings --chown=node:node /data ./data
USER node
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3100)+'/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/http.js"]
