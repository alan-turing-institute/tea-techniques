# @chrisdburr/tea-techniques-mcp

MCP server for the [TEA Techniques](https://alan-turing-institute.github.io/tea-techniques/) knowledge graph — discover AI assurance techniques through natural language.

[![npm version](https://img.shields.io/npm/v/@chrisdburr/tea-techniques-mcp)](https://www.npmjs.com/package/@chrisdburr/tea-techniques-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

## Quick Start

No installation needed — run directly with `npx`:

```bash
npx @chrisdburr/tea-techniques-mcp
```

### Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "tea-techniques": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@chrisdburr/tea-techniques-mcp"]
    }
  }
}
```

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "tea-techniques": {
      "command": "npx",
      "args": ["-y", "@chrisdburr/tea-techniques-mcp"]
    }
  }
}
```

After configuring, restart Claude. You should see tools prefixed with `mcp__tea-techniques__`.

## Features

- **10 tools** for searching, filtering, comparing, and exploring AI assurance techniques
- **Semantic search** — embedding-based claim matching with hybrid RRF ranking
- **Knowledge graph** with technique, goal, taxonomy, and academic resource counts determined by the data cut
- **Stdio data loading** — fetches data remotely from GitHub Pages with 24h caching

## How It Works

The server fetches the TEA Techniques knowledge graph from GitHub Pages on first run and caches it locally for 24 hours (`~/.cache/tea-techniques-mcp/`). Semantic search uses the text encoder of EmbeddingGemma 2 through ONNX Runtime, with a normalized 768-dimensional sentence embedding and hybrid reciprocal rank fusion. The loader rejects embeddings from another model, revision, precision, or prompt format; the published MiniLM embeddings therefore degrade to keyword retrieval. Generate compatible local embeddings for semantic retrieval. Clef-Flash can re-rank the top 8 candidates (configurable, 1-20) through a local Ollama daemon.

## Tool Reference

| Tool | Description |
|------|-------------|
| `find_techniques` | Search and filter techniques by query, goals, tags, complexity |
| `get_technique` | Get full details of a specific technique by slug |
| `compare_techniques` | Side-by-side comparison of 2-5 techniques |
| `find_related` | Find related techniques via links, shared goals, or tags |
| `suggest_techniques_for_claim` | Match assurance claims to relevant techniques using semantic search |
| `find_evidence_types` | Explore what evidence types techniques can produce |
| `explore_taxonomy` | Navigate the hierarchical tag taxonomy |
| `coverage_statistics` | Analyse dataset coverage across dimensions |
| `search_resources` | Search academic papers, software, and documentation |
| `get_knowledge_graph_summary` | High-level statistics about the knowledge graph |

## Development

This package is part of the [TEA Techniques monorepo](https://github.com/alan-turing-institute/tea-techniques). Use Node 22 or newer. For local development:

```bash
git clone https://github.com/alan-turing-institute/tea-techniques.git
cd tea-techniques/mcp-server
pnpm install
pnpm dev          # Run from source with tsx
pnpm dev --local  # Load data from local project files
```

## License

[MIT](./LICENSE)

## Offline HTTP image

The image serves stateless MCP Streamable HTTP at `POST /mcp` and health metadata at `GET /healthz`. There is **no authentication**; use it on a laptop or private network. Compose publishes port 3100 on loopback only. The existing stdio entry point and all ten MCP tool names/input schemas remain unchanged. The TypeScript method `suggestForClaim` is exposed by the tool named `suggest_techniques_for_claim`.

The image needs an Ollama daemon with `clef-flash` for ranking; retrieval works without one. There are two shapes.

**Host Ollama (default).** The container reaches Ollama on the host at `http://host.docker.internal:11434` (Compose maps that name to the host gateway). Pull the model on the host with `ollama pull clef-flash` (Ollama 0.35.1 or newer; Metal or GPU acceleration then applies). The host daemon must accept the container's `Host` header: start it with `OLLAMA_HOST=0.0.0.0`. Otherwise Ollama answers 403 to the foreign `Host`, ranking falls back, and `/healthz.rankingAvailable` stays false.

```sh
docker compose build
docker compose up -d --pull never --no-build
curl --fail http://localhost:3100/healthz
```

**Bundled Ollama.** The `ollama` service runs inside the stack under the `bundled-ollama` profile, on CPU only:

```sh
make pull-models
OLLAMA_URL=http://ollama:11434 docker compose --profile bundled-ollama up -d --pull never
```

Rebuild against a different data cut with one command (replace the ref with the published tag or commit):

```sh
DATA_REF=<data-tag-or-commit> docker compose build mcp
```

The default data cut is `777cf5e752775b20537e1a499c3998eadc2bc184`. The build resolves `DATA_REF` to a commit, fetches **only its graph.jsonld**, and regenerates embeddings from the graph with `scripts/generate-embeddings.ts`. It never copies or reads the repository's committed embeddings. Both the generated vectors and the ONNX query model cache are copied into the runtime image. `/healthz.dataVersion` reports the resolved data commit. Tag and goal values in the ranking state come from the loaded data; `CONCEPT_TAGS` is unchanged for the separate data pass.

The `mcp` service sits on the default Compose network so it can reach the host gateway, and on an internal network shared with the bundled Ollama. The application only contacts the Ollama URL, which must be `localhost`, `127.0.0.1`, `[::1]`, `ollama` or `host.docker.internal`. The stack starts without network downloads once prepared. `make pull-models` (bundled shape only) uses a temporary container with download access and a persistent `tea-techniques-mcp-models` volume. It pulls only `clef-flash`; retrieval does not depend on Ollama. Keep that volume when moving the image to another laptop, or prepare the destination while online. The bundled Ollama runs on Linux CPU and does not expose Apple Metal; use the host shape on a Mac.

### Call the claim tool without initialization

This request requires no session or initialize exchange, and returns a plain JSON response. A small wrapper normalizes JSON-only Accept headers for the SDK, which otherwise insists on both JSON and SSE media types. The endpoint does not serve an SSE stream.

```sh
curl --fail http://localhost:3100/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"suggest_techniques_for_claim","arguments":{"claim":"The model identifies when its predictions may be unreliable."}}}'
```

The result is available as both `result.structuredContent` and JSON in `result.content[0].text`:

```json
{
  "rankingAvailable": true,
  "embeddingModel": "onnx-community/embeddinggemma-2-ONNX",
  "rankingModel": "clef-flash",
  "results": [{
    "slug": "...", "name": "...", "score": 0.91, "retrievalScore": 0.63,
    "goals": [], "url": "https://alan-turing-institute.github.io/tea-techniques/techniques/..."
  }]
}
```

`score` is the Noul probability only when `rankingAvailable` is true. Otherwise it equals `retrievalScore`, a normalized RRF rank score, and the original retrieval order is preserved. Missing/unreachable Ollama, absent models, invalid responses, or any candidate failure cause the whole ranking step to fall back. The first `RANKING_CANDIDATES` retrieved candidates (default 8, bounds 1-20) are ranked in one `/v1/systemone` request carrying one question per candidate; any remaining retrieved candidates follow them in retrieval order with `score` equal to `retrievalScore`. The request is aborted at `RANKING_DEADLINE_MS` (default 30000), which also stops generation in Ollama. No `reason` field is returned. The tool defaults to ten results; direct TypeScript callers can use `suggestForClaim(claim, { limit, context })` (up to twenty). MCP retains its existing flat context arguments.

### Model and resource requirements

Retrieval uses Transformers.js 4.3.1 with ONNX Runtime 1.30.0, the text encoder only, q8 weights, and model revision `daa72c51243991dfcaf9f9137d2c573d8f7790c0`. The adapter uses `AutoModel` and the exported `sentence_embedding` directly to preserve the model's pooling and projection. It L2-normalizes and validates 768 dimensions. Queries use `task: search result | query: {claim}`. Technique descriptions and sample claims use `title: {technique name} | text: {content}`. These formats, the model revision and precision are recorded in the generated file and checked by the loader.

The model card lists the q8 text weights at about 314 MB, plus tokenizer/configuration files. [EmbeddingGemma 2 ONNX model card](https://huggingface.co/onnx-community/embeddinggemma-2-ONNX). Clef-Flash requires Ollama 0.35.1 or newer; Compose pins 0.40.1. Its initial download is about 11–12 GB, in addition to Docker layers. [Ollama Clef-Flash model page](https://ollama.com/library/clef-flash).

Local embedding generation for the pinned graph measured **58.7 seconds**, with a warm model cache, for 676 corpus entries; the generated JSON was 11,042,847 bytes. This is a host measurement, not a Docker build time. The complete Docker build time, final image size, and successful ranker peak RAM remain unmeasured: Docker's builder metadata write is denied in the current environment, and its VM exposes about 8.32 GB RAM. An attempted Clef-Flash CPU load allocated buffers reported as 1,034.67 MiB plus 8,041.00 MiB (about 9.52 GB); its runner then exited. This exceeds the available VM memory before context and other overhead. Plan for more than that buffer footprint and measure the successful peak on the deployment laptop. Record actual figures on the deployment laptop before the offline demonstration. To measure the full build and image:

```sh
time docker compose build mcp
docker image inspect tea-techniques-mcp:local --format '{{.Size}}'
```

In offline mode (`TEA_OFFLINE=1`, enabled in the image), graph and embedding files must be local, remote model downloads are disabled, and startup fails if the compatible vectors or cached query model are missing. The only model network calls at request time go to the configured Ollama daemon. `/healthz.rankingAvailable` checks whether the Ollama daemon lists Clef-Flash; `/healthz.lastRankingSucceeded` reports the outcome of the most recent ranking call (null before the first). Each tool response records whether ranking actually succeeded.

### Local development and evaluation

Generate into `generated/` to preserve the source dataset:

```sh
mkdir -p generated/data/ld
cp ../public/data/ld/graph.jsonld generated/data/ld/graph.jsonld
pnpm generate-embeddings --data-dir=generated/data --output=generated/data/ld/embeddings.json
pnpm build
DATA_DIR=generated/data TEA_OFFLINE=1 pnpm start:http
RANKING_ENABLED=false pnpm evaluate-cardiac-dt --data-dir=generated/data --output=generated/retrieval-only.json
OLLAMA_URL=http://127.0.0.1:11434 pnpm evaluate-cardiac-dt --data-dir=generated/data --output=generated/ranked.json
pnpm test
```

The rubric is unchanged. Check each evaluation's `rankingAvailable` fields before treating the run as a Clef-Flash comparison. `PORT` defaults to 3100, `HOST` to loopback outside Docker, `DATA_DIR` selects the local graph/vectors directory, and `EMBEDDING_CACHE_DIR` selects the ONNX cache (default `mcp-server/.cache/huggingface-q8`). Model downloads are allowed only by the generation script; query requests always load cached files.

### Retrieval tuning

All variables are optional; defaults reproduce the untuned behaviour.

| Variable | Default | Effect |
|---|---|---|
| `RANKING_CANDIDATES` | 8 | Candidates sent to Clef-Flash (1-20) |
| `RANKING_DEADLINE_MS` | 30000 | Aborts the ranking request |
| `RRF_KEYWORD_WEIGHT` | 1 | Weight of the keyword leg in rank fusion |
| `RRF_SEMANTIC_WEIGHT` | 1 | Weight of the embedding leg in rank fusion |
| `WEAK_MATCH_CUTOFF` | 0.6 | Claims-index matches with a worse Fuse.js score are dropped |
| `RANKING_DEBUG` | unset | `1` logs the fused scores' min, median and max per call and what the cut-off dropped |
