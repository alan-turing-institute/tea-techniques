# syntax=docker/dockerfile:1
# The image holds no embedding model and generates no vectors. The catalogue vectors
# are committed in vectors/ (made by scripts/generate-embeddings.ts) and copied in;
# the build fetches only the graph for DATA_REF, then refuses to continue unless the
# vectors were made from that graph's corpus.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

FROM build AS data
ARG DATA_REF=777cf5e752775b20537e1a499c3998eadc2bc184
ENV DATA_REF=${DATA_REF}
COPY scripts/fetch-build-data.mjs ./scripts/fetch-build-data.mjs
RUN node scripts/fetch-build-data.mjs
COPY vectors/embeddings.qwen3.json /data/ld/embeddings.json
RUN DATA_DIR=/data TEA_OFFLINE=1 node dist/http.js --check

FROM node:22-bookworm-slim AS production-dependencies
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --no-optional --ignore-scripts

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3100 HOST=0.0.0.0 DATA_DIR=/app/data TEA_OFFLINE=1 RANKING_ENABLED=false
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=data --chown=node:node /data ./data
USER node
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3100)+'/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/http.js"]
