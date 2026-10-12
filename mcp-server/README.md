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
- **Semantic search** — embedding-based claim matching with hybrid RRF ranking, using either a question vector the caller supplies or, over stdio, an in-process model
- **Knowledge graph** with technique, goal, taxonomy, and academic resource counts determined by the data cut
- **Stdio data loading** — fetches data remotely from GitHub Pages with 24h caching

## How It Works

The server fetches the TEA Techniques knowledge graph from GitHub Pages on first run and caches it locally for 24 hours (`~/.cache/tea-techniques-mcp/`). Semantic search compares a question vector with the catalogue vectors and fuses the result with keyword matching by reciprocal rank fusion. The loader rejects embeddings from another model, revision, precision, or prompt format; the published MiniLM embeddings therefore degrade to keyword retrieval. Generate compatible local embeddings for semantic retrieval.

Where the question vector comes from depends on how the server runs:

- **Caller-supplied (any transport).** `suggest_techniques_for_claim` accepts `queryEmbedding: { model, vector }`. The server checks it against the loaded catalogue vectors and uses it instead of any model of its own. See [Question vectors](#question-vectors).
- **In-process model (stdio only).** Without a supplied vector, the stdio server embeds the claim with the text encoder of EmbeddingGemma 2 through ONNX Runtime (a normalized 768-dimensional sentence embedding), when `@huggingface/transformers` and `onnxruntime-node` are installed. Both are optional dependencies; without them the server still starts and uses keyword retrieval.
- **Neither.** The HTTP service never loads a model. Without a supplied vector it uses keyword retrieval.

Clef-Flash can re-rank the top 4 candidates (configurable, 1-20) through a local Ollama daemon when the stdio server or the HTTP service is started with ranking enabled (`RANKING_ENABLED` not `false`).

### Question vectors

`suggest_techniques_for_claim` takes an optional `queryEmbedding`:

```json
{ "claim": "...", "queryEmbedding": { "model": "<model id>", "vector": [0.01, -0.02, "..."] } }
```

The vector must be the claim embedded as a query: the catalogue's query prefix followed by the claim, by the model the catalogue was built with. The server uses it only if all of these hold:

- `model` equals the model id of the loaded vectors;
- the vector has exactly as many values as the vectors' dimensions, and at most 4096;
- every value is a finite number (as a 32-bit float), and the vector is not all zeros.

The server then scales it to unit length. If any check fails, the semantic search is skipped, the result is keyword-only with `semanticUsed: false`, and one line giving the reason (never the values) is written to stderr. A supplied vector is never replaced by the in-process model.

The model id, dimensions, query prefix and document format are served by `GET /embedding-spec` on the HTTP service, together with four probe sentences and their vectors. A client can embed the probe sentences with its own model and compare the results with the served vectors to confirm it is using the catalogue's model before it sends question vectors.

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

The image serves stateless MCP Streamable HTTP at `POST /mcp`, health metadata at `GET /healthz` and the catalogue's embedding description at `GET /embedding-spec`. There is **no authentication**; use it on a laptop or private network. Compose publishes port 3100 on loopback only. The existing stdio entry point and all ten MCP tool names remain; `suggest_techniques_for_claim` gains the optional `queryEmbedding` input. The TypeScript method `suggestForClaim` is exposed by the tool named `suggest_techniques_for_claim`.

The service runs no model. It holds the catalogue and its vectors, and answers with keyword search plus, when the caller supplies a question vector, semantic search over the vectors. Ranking is off in the image (`RANKING_ENABLED=false`), so results keep the fused retrieval order, `/healthz.rankingAvailable` is false and `/healthz` contacts no other service. Whatever calls the service does the embedding and any ranking itself.

```sh
docker compose build
docker compose up -d --pull never --no-build
curl --fail http://localhost:3100/healthz
curl --fail http://localhost:3100/embedding-spec
```

`GET /healthz` reports the model id of the loaded vectors as `embeddingModel` (null when none are loaded), `rankingModel`, `rankingAvailable`, `lastRankingSucceeded` and `dataVersion`.

`GET /embedding-spec` returns `{ modelId, dimensions, queryPrefix, documentFormat, dataVersion, probes }`. `queryPrefix` is prepended to a claim before it is embedded as a question; `documentFormat` is the format the catalogue entries were embedded with. `probes` holds four sentences (three short assurance claims and one of about 2,000 characters) with the vectors the build produced for them as queries, so a client can embed the same sentences with the same prefix and confirm that its vectors agree before relying on it. The endpoint answers 404 when the loaded vectors carry no probes.

Rebuild against a different data cut with one command (replace the ref with the published tag or commit):

```sh
DATA_REF=<data-tag-or-commit> docker compose build mcp
```

The default data cut is `777cf5e752775b20537e1a499c3998eadc2bc184`. The build resolves `DATA_REF` to a commit, fetches **only its graph.jsonld**, and regenerates embeddings from the graph with `scripts/generate-embeddings.ts`. It never copies or reads the repository's committed embeddings. The embedding model is used only in the build stages that generate the vectors (catalogue entries and probe sentences, in one run); the runtime image receives the generated vectors and nothing else from them. `/healthz.dataVersion` reports the resolved data commit. The claim-to-tag map used for keyword narrowing (`CONCEPT_TAGS`) names the consolidated tags `system-implementation` and `model-testing-and-validation`.

The runtime stage installs production dependencies without optional packages (`pnpm install --prod --no-optional`). `@huggingface/transformers` and `onnxruntime-node` are optional dependencies, so the image holds neither, nor any model files. The container starts with `TEA_OFFLINE=1`, which requires the generated vectors and graph to be present locally, makes no downloads and contacts no other service. `PORT` (default 3100) sets the listening port, and the image's health check reads it.

### Call the claim tool without initialization

This request requires no session or initialize exchange, and returns a plain JSON response. A small wrapper normalizes JSON-only Accept headers for the SDK, which otherwise insists on both JSON and SSE media types. The endpoint does not serve an SSE stream.

```sh
curl --fail http://localhost:3100/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"suggest_techniques_for_claim","arguments":{"claim":"The model identifies when its predictions may be unreliable."}}}'
```

Without `queryEmbedding` the HTTP service answers from keyword retrieval alone. To use the semantic search, add the claim's vector (one number per dimension reported by `/embedding-spec`):

```sh
curl --fail http://localhost:3100/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"suggest_techniques_for_claim","arguments":{"claim":"The model identifies when its predictions may be unreliable.","queryEmbedding":{"model":"<modelId from /embedding-spec>","vector":[<dimensions numbers>]}}}}'
```

The result is available as both `result.structuredContent` and JSON in `result.content[0].text`:

```json
{
  "rankingAvailable": false,
  "embeddingModel": "onnx-community/embeddinggemma-2-ONNX",
  "rankingModel": "clef-flash",
  "semanticUsed": true,
  "results": [{
    "slug": "...", "name": "...", "summary": "First sentence of the description.",
    "score": 0.63, "retrievalScore": 0.63, "ranked": false,
    "goals": ["tea:goal/..."], "tags": ["tea:tag/..."],
    "url": "https://alan-turing-institute.github.io/tea-techniques/techniques/..."
  }]
}
```

`semanticUsed` is true when the semantic search returned results that were fused with the keyword results, and false when the result is keyword-only (no `queryEmbedding`, one that failed its checks, or no loaded vectors). `summary` is the first sentence of the technique's description, at most 200 characters. `tags` lists the technique's tag ids, in the same form as `goals`.

The optional ranker is separate from retrieval. It runs only where `RANKING_ENABLED` is not `false` and a local Ollama daemon serves `clef-flash`; the image turns it off. `ranked` is true for a result whose `score` is the Noul probability from Clef-Flash, and false when `score` is the retrieval score. When `rankingAvailable` is true, the first `RANKING_CANDIDATES` retrieved candidates (default 4, bounds 1-20) are ranked in one `/v1/systemone` request carrying one question per candidate, and those results carry `ranked: true`. Any remaining retrieved candidates follow them in retrieval order with `ranked: false` and `score` equal to `retrievalScore`, which is on a different scale from the probabilities; compare `score` values only between results that have `ranked: true`. When `rankingAvailable` is false, every result has `ranked: false`, `score` equals `retrievalScore` (a normalized RRF rank score), and the original retrieval order is preserved. Missing/unreachable Ollama, absent models, invalid responses, or any candidate failure cause the whole ranking step to fall back. The request is aborted at `RANKING_DEADLINE_MS` (default 60000). The server does not cancel the ranking request when the MCP caller disconnects: it runs to completion or to its deadline. Concurrent calls each send their own request with their own deadline, and the server does not queue or limit them, so on a host that cannot serve them at once (typically a CPU-only host) a later caller's request may reach its deadline before it is answered, and that caller receives retrieval order with `rankingAvailable` false. No `reason` field is returned. The tool defaults to ten results; direct TypeScript callers can use `suggestForClaim(claim, { limit, context })` (up to twenty). MCP retains its existing flat context arguments.

### Model and resource requirements

**The HTTP image.** It holds Node.js, the production dependencies without optional packages, the compiled service, the graph and the generated vectors. It holds no embedding model, no ONNX Runtime and no model cache, and it starts with `TEA_OFFLINE=1`: start-up needs the vectors but no model files. Serving a request is a similarity search over the loaded vectors plus keyword matching, which takes milliseconds and no inference.

Measured on an x86-64 Linux host with the default data cut:

| Measure | Value |
|---|---|
| Image layers (sum of `docker history`) | about 281 MB: base `node:22-bookworm-slim` 244 MB, production dependencies 24.9 MB, data 12.3 MB, compiled code 0.4 MB |
| `docker image ls` disk usage / compressed content size | 369 MB / 87.7 MB |
| Resident memory after start-up | about 80 MiB |
| Resident memory after 50 `tools/call` requests with a supplied vector | about 116 MiB (peak 148 MiB, reached while parsing the vectors at start-up) |
| One `curl` `tools/call` with a supplied vector | about 23 ms |
| Generating the 676 catalogue vectors and 4 probe vectors in the build | about 33 s |

Memory grows with the catalogue: the vectors are held as 32-bit floats, 768 per entry. Re-measure after a data cut or model change with:

```sh
time docker compose build mcp
docker image inspect tea-techniques-mcp:local --format '{{.Size}}'
docker stats --no-stream
```

**The vectors.** Catalogue vectors and probe vectors are generated at build time by the model that `src/embedding/model.ts` names: the text encoder of EmbeddingGemma 2 through Transformers.js 4.3.1 and ONNX Runtime 1.30.0, q8 weights, model revision `daa72c51243991dfcaf9f9137d2c573d8f7790c0`. The adapter uses `AutoModel` and the exported `sentence_embedding` directly to preserve the model's pooling and projection, L2-normalizes, and validates 768 dimensions. Queries use `task: search result | query: {claim}`. Technique descriptions and sample claims use `title: {technique name} | text: {content}`. These formats, the model revision and precision are recorded in the generated file and checked by the loader. The model card lists the q8 text weights at about 314 MB, plus tokenizer and configuration files, which the build stages download. [EmbeddingGemma 2 ONNX model card](https://huggingface.co/onnx-community/embeddinggemma-2-ONNX).

**The stdio server.** With the optional packages installed (`npm` installs them by default), it loads the same model on the first semantic query and needs the cached model files; without them, or without a cache, it uses keyword retrieval and says so in its log.

**Ranking.** The optional ranker needs a local Ollama daemon (0.35.1 or newer) with `clef-flash`, whose initial download is about 11–12 GB. [Ollama Clef-Flash model page](https://ollama.com/library/clef-flash). It is off in the image. To use it with the HTTP service run from source, leave `RANKING_ENABLED` unset (or `true`) and set `OLLAMA_URL` to a local daemon (`localhost`, `127.0.0.1`, `[::1]` or `host.docker.internal`); `/healthz.rankingAvailable` then checks whether the daemon lists Clef-Flash, and `/healthz.lastRankingSucceeded` reports the outcome of the most recent ranking call (null before the first). Each tool response records whether ranking actually succeeded.

The generated vectors file for the default data cut is about 11.1 MB.

### Local development and evaluation

Generate into `generated/` to preserve the source dataset:

```sh
mkdir -p generated/data/ld
cp ../public/data/ld/graph.jsonld generated/data/ld/graph.jsonld
pnpm generate-embeddings --data-dir=generated/data --output=generated/data/ld/embeddings.json
pnpm build
DATA_DIR=generated/data TEA_OFFLINE=1 RANKING_ENABLED=false pnpm start:http
RANKING_ENABLED=false pnpm evaluate-cardiac-dt --data-dir=generated/data --output=generated/retrieval-only.json
OLLAMA_URL=http://127.0.0.1:11434 pnpm evaluate-cardiac-dt --data-dir=generated/data --output=generated/ranked.json
pnpm test
```

The rubric is unchanged. Check each evaluation's `rankingAvailable` fields before treating the run as a Clef-Flash comparison. `PORT` defaults to 3100, `HOST` to loopback outside Docker, `DATA_DIR` selects the local graph/vectors directory, and `EMBEDDING_CACHE_DIR` selects the ONNX cache (default `mcp-server/.cache/huggingface-q8`). Model downloads are allowed only by the generation script; query requests always load cached files. `pnpm start:http` never loads the model, so its semantic search needs a supplied `queryEmbedding`.

`pnpm evaluate-cardiac-dt` runs on the host, calls the in-process model, and needs a local copy of it; without one it fails with "Query model unavailable". Run the generation script (`pnpm generate-embeddings`) once with network access, and the model downloads into the default cache.

The evaluation's ranking step reads the same `RANKING_CANDIDATES` and `RANKING_DEADLINE_MS` variables as the server. On a CPU host, raise `RANKING_DEADLINE_MS` so that each claim's ranking request can finish; otherwise it aborts and the claim is evaluated in retrieval order with `rankingAvailable: false`.

### Retrieval tuning

All variables are optional; defaults reproduce the untuned behaviour.

| Variable | Default | Effect |
|---|---|---|
| `RANKING_ENABLED` | unset (`false` in the image) | `false` turns the optional ranker off: results keep retrieval order and no Ollama call is made, including by `/healthz` |
| `RANKING_CANDIDATES` | 4 | Candidates sent to Clef-Flash (1-20) |
| `RANKING_DEADLINE_MS` | 60000 | Aborts the ranking request (values above 2147483647 are capped to it) |
| `RRF_KEYWORD_WEIGHT` | 1 | Weight of the keyword leg in rank fusion |
| `RRF_SEMANTIC_WEIGHT` | 1 | Weight of the embedding leg in rank fusion |
| `WEAK_MATCH_CUTOFF` | 0.6 | Claims-index matches with a worse Fuse.js score are dropped |
| `RANKING_DEBUG` | unset | `1` logs the fused scores' min, median and max per call and what the cut-off dropped |

The ranking request grows with the candidate count. On a CPU-only host each candidate adds roughly 10 seconds to the request (measured against a host Ollama on a loaded CPU: 2 candidates took 22 seconds, and 8 candidates took 128 seconds). Choose `RANKING_CANDIDATES` so the request fits inside `RANKING_DEADLINE_MS` on the machine that serves the stand, and expect a GPU or Apple-silicon host to be several times faster. A ranking request that is aborted at the deadline returns the retrieval order with `rankingAvailable: false`, which the caller can see in the response.
