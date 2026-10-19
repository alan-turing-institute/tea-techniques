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

The server fetches the TEA Techniques knowledge graph and its published vectors (`embeddings.json`) from GitHub Pages on first run and caches them locally for 24 hours (`~/.cache/tea-techniques-mcp/`). Semantic search compares a question vector with the catalogue vectors and fuses the result with keyword matching by reciprocal rank fusion. The loader rejects a vectors file made by another model, revision, precision, or prompt format, which degrades to keyword retrieval.

Two models make vectors, because the better one is too large to run on a typical machine:

| | Stdio server | HTTP service |
|---|---|---|
| Vectors file | `public/data/ld/embeddings.json`, made by the website build and published with the graph | `vectors/embeddings.qwen3.json`, copied into the image |
| Model | `Xenova/all-MiniLM-L12-v2`, 384 dimensions | `Qwen/Qwen3-Embedding-4B`, 2560 dimensions |
| Embeds questions | in-process, when the caller sends no vector | never; the caller sends the vector |

Where the question vector comes from depends on how the server runs:

- **Caller-supplied (any transport).** `suggest_techniques_for_claim` accepts `queryEmbedding: { model, vector }`. The server checks it against the loaded catalogue vectors and uses it instead of any model of its own. See [Question vectors](#question-vectors).
- **In-process model (stdio only).** Without a supplied vector, the stdio server embeds the claim with MiniLM-L12 (mean pooling, normalized, 384 dimensions) through Transformers.js and ONNX Runtime, when `@huggingface/transformers` and `onnxruntime-node` are installed. Both are optional dependencies; without them the server still starts and uses keyword retrieval. The model (about 130 MB) is downloaded from Hugging Face on first use, at a pinned revision, and cached in `EMBEDDING_CACHE_DIR` (default `mcp-server/.cache/huggingface`). With `TEA_OFFLINE=1` it is never downloaded.
- **Neither.** The HTTP service never loads a model. Without a supplied vector it uses keyword retrieval.

Clef-Flash can re-rank the top 4 candidates (configurable, 1-20) through a local Ollama daemon when the stdio server or the HTTP service is started with ranking enabled (`RANKING_ENABLED` not `false`).

### Question vectors

`suggest_techniques_for_claim` takes an optional `queryEmbedding`:

```json
{ "claim": "...", "queryEmbedding": { "model": "<model id>", "vector": [0.01, -0.02, "..."] } }
```

The vector must be the claim embedded as a query: the catalogue's query prefix followed directly by the claim, by the model the catalogue was built with. For the HTTP service's catalogue that is `Qwen/Qwen3-Embedding-4B` and the prefix is the instruction line `Instruct: Given an AI assurance claim, retrieve the assurance techniques that can produce evidence to support or test the claim`, a newline, and `Query:` with no space before the claim. `GET /embedding-spec` returns the exact prefix. The server uses the vector only if all of these hold:

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

A clone holds the graph but not the stdio server's vectors file, which the website build makes. For semantic search with `--local`, make the file first with the MiniLM command under [Regenerating the vectors](#regenerating-the-vectors). Without it the server logs that embeddings are unavailable and uses keyword retrieval.

## License

[MIT](./LICENSE)

## Offline HTTP image

The image serves stateless MCP Streamable HTTP at `POST /mcp`, health metadata at `GET /healthz` and the catalogue's embedding description at `GET /embedding-spec`. There is **no authentication**; use it on a laptop or private network. Compose publishes port 3100 on loopback only. The existing stdio entry point and all ten MCP tool names remain; `suggest_techniques_for_claim` gains the optional `queryEmbedding` input. The TypeScript method `suggestForClaim` is exposed by the tool named `suggest_techniques_for_claim`.

`POST /mcp` reads at most 256 KB of request body (a call with a 2,560-number vector is 35 to 55 KB, and about 57 KB with a 2,000-character claim). A larger body, whether it declares its length or arrives chunked, gets `413` and the connection is closed. A body that is not JSON gets `400`, and so does a JSON-RPC batch (an array of messages); send one call per request.

The service runs no model. It holds the catalogue and its vectors, and answers with keyword search plus, when the caller supplies a question vector, semantic search over the vectors. Ranking is off in the image (`RANKING_ENABLED=false`), so results keep the fused retrieval order, `/healthz.rankingAvailable` is false and `/healthz` contacts no other service. Whatever calls the service does the embedding and any ranking itself.

```sh
docker compose build
docker compose up -d --pull never --no-build
curl --fail http://localhost:3100/healthz
curl --fail http://localhost:3100/embedding-spec
```

`GET /healthz` reports the model id of the loaded vectors as `embeddingModel` (null when none are loaded), `rankingModel`, `rankingAvailable`, `lastRankingSucceeded` and `dataVersion`.

`GET /embedding-spec` returns `{ modelId, dimensions, queryPrefix, documentFormat, dataVersion, probes }`, all read from the vectors file. `queryPrefix` is prepended to a claim before it is embedded as a question; `documentFormat` is the format the catalogue entries were embedded with. `probes` holds four sentences (three short assurance claims and one of about 2,000 characters) with the vectors the generation step produced for them as queries (prefix plus sentence), so a client can embed the same sentences with the same prefix and confirm that its vectors agree before relying on it. The endpoint answers 404 when the loaded vectors carry no probes.

**Hosts that pass the check.** The check (every probe, including the long one, at cosine 0.999 or better against the served vector) is `scripts/check-embedding-host.ts`:

```sh
pnpm exec tsx scripts/check-embedding-host.ts --embeddings=vectors/embeddings.qwen3.json --host=ollama --model=qwen3-embedding:4b-fp16
pnpm exec tsx scripts/check-embedding-host.ts --embeddings=vectors/embeddings.qwen3.json --host=openrouter --model=qwen/qwen3-embedding-4b
```

| Host and model | Lowest probe cosine | Check |
|---|---|---|
| OpenRouter `qwen/qwen3-embedding-4b` | 0.99993 | pass |
| Ollama `qwen3-embedding:4b-fp16` (F16) | 0.9999996 | pass |
| Ollama `qwen3-embedding:4b` (Q4_K_M) | 0.9831 | fail |

Use the F16 Ollama tag. The Q4_K_M quantisation changes the vectors too much to match the catalogue.

**Vectors and data cuts.** The vectors are not generated in the image build. `vectors/embeddings.qwen3.json` is committed and copied into the image as `ld/embeddings.json`; the build fetches only `graph.jsonld` for `DATA_REF` and runs the service's start-up checks (`node dist/http.js --check`). Both the build and the running service refuse vectors whose corpus hash (a SHA-256 over the ordered slug and text of every catalogue entry) differs from the graph's, so a data cut with different technique texts fails with a message instead of serving misaligned vectors. To move to a new data cut, regenerate the file (see [Regenerating the vectors](#regenerating-the-vectors)) and commit it.

Rebuild against another data cut with one command (replace the ref with a full commit SHA, or a tag or branch name):

```sh
DATA_REF=<data-tag-or-commit> docker compose build mcp
```

The default data cut is `d07d92fa9ed0b19c9289a3b6220a4aa6b893cb6e`, the cut the committed vectors were made from. A full 40-character SHA is used as given; a tag, branch or short SHA is resolved through the unauthenticated GitHub API, which allows 60 requests an hour per address. `/healthz.dataVersion` reports the commit. The claim-to-tag map used for keyword narrowing (`CONCEPT_TAGS`) names the consolidated tags `system-implementation` and `model-testing-and-validation`.

The runtime stage installs production dependencies without optional packages (`pnpm install --prod --no-optional`). `@huggingface/transformers` and `onnxruntime-node` are optional dependencies, so the image holds neither, nor any model files. The container starts with `TEA_OFFLINE=1`, which requires the vectors and graph to be present locally, makes no downloads and contacts no other service. `PORT` (default 3100) sets the listening port, and the image's health check reads it.

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
  "embeddingModel": "Qwen/Qwen3-Embedding-4B",
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

`semanticUsed` is true when the semantic search returned results that were fused with the keyword results, and false when the result is keyword-only (no `queryEmbedding`, one that failed its checks, or no loaded vectors). `summary` is the first sentence of the technique's description, at most 200 characters. `tags` lists the technique's tag ids, in the same form as `goals`. `embeddingModel` is the model id of the loaded vectors, or `null` when none are loaded.

The optional ranker is separate from retrieval. It runs only where `RANKING_ENABLED` is not `false` and a local Ollama daemon serves `clef-flash`; the image turns it off. `ranked` is true for a result whose `score` is the Noul probability from Clef-Flash, and false when `score` is the retrieval score. When `rankingAvailable` is true, the first `RANKING_CANDIDATES` retrieved candidates (default 4, bounds 1-20) are ranked in one `/v1/systemone` request carrying one question per candidate, and those results carry `ranked: true`. Any remaining retrieved candidates follow them in retrieval order with `ranked: false` and `score` equal to `retrievalScore`, which is on a different scale from the probabilities; compare `score` values only between results that have `ranked: true`. When `rankingAvailable` is false, every result has `ranked: false`, `score` equals `retrievalScore` (a normalized RRF rank score), and the original retrieval order is preserved. Missing/unreachable Ollama, absent models, invalid responses, or any candidate failure cause the whole ranking step to fall back. The request is aborted at `RANKING_DEADLINE_MS` (default 60000). The server does not cancel the ranking request when the MCP caller disconnects: it runs to completion or to its deadline. Concurrent calls each send their own request with their own deadline, and the server does not queue or limit them, so on a host that cannot serve them at once (typically a CPU-only host) a later caller's request may reach its deadline before it is answered, and that caller receives retrieval order with `rankingAvailable` false. No `reason` field is returned. The tool defaults to ten results; direct TypeScript callers can use `suggestForClaim(claim, { limit, context })` (up to twenty). MCP retains its existing flat context arguments.

### Model and resource requirements

**The HTTP image.** It holds Node.js, the production dependencies without optional packages, the compiled service, the graph and the committed vectors. It holds no embedding model, no ONNX Runtime and no model cache, and it starts with `TEA_OFFLINE=1`: start-up needs the vectors but no model files. Serving a request is a similarity search over the loaded vectors plus keyword matching, which takes milliseconds and no inference. The image needs no GPU and little memory: 813 entries of 2560 float32 values come to about 8 MB once loaded.

Measured on an x86-64 Linux host with the default data cut:

| Measure | Value |
|---|---|
| Image layers (sum of `docker history`) | about 282 MB: base `node:22-bookworm-slim` 244 MB, production dependencies 24.9 MB, data 13.2 MB, compiled code 0.4 MB |
| `docker image ls` disk usage / content size | 374 MB / 91.5 MB |
| Resident memory of the Node process after start-up | about 165 MiB when `/healthz` first answers, settling to about 92 MiB within seconds (`docker stats` reports 45 MiB) |
| Resident memory after 50 `tools/call` requests with a supplied vector | about 137 MiB (`docker stats` reports 91 MiB) |
| One `curl` `tools/call` with a supplied vector (a 57 KB request body) | median 39 ms over 50 calls; the first call after start-up took about 80 ms |

Re-measure after a data cut or model change with:

```sh
time docker compose build mcp
docker image inspect tea-techniques-mcp:local --format '{{.Size}}'
docker stats --no-stream
```

**The HTTP service's vectors.** `vectors/embeddings.qwen3.json` (about 11 MB) holds 813 catalogue entries and 4 probe vectors made by `Qwen/Qwen3-Embedding-4B`: the `onnx-community/Qwen3-Embedding-4B-ONNX` export at revision `7d046e08591811ddd93dfe815b1d3bfccb16c041`, fp32 (16 GB of weights), through onnxruntime-node, taking the exported `sentence_embedding` output and scaling it to unit length. Each input ends with the end-of-text token. Technique descriptions and sample claims are embedded as `title: {technique name} | text: {content}` with no prefix; questions with the instruction prefix described under [Question vectors](#question-vectors). Vectors are stored as base64 little-endian float32, which is exact. The file records the model, repository, revision, dtype, dimensions, both formats, the data commit and the corpus hash, and the loader checks them against `CATALOGUE_MODEL` in `src/embedding/specs.ts`.

Generating it needs about 14 GB of free memory and took about 8 minutes for the 813 entries on 16 threads, so it runs on a build host and not in the image build.

**The stdio server's vectors.** `public/data/ld/embeddings.json` (about 6.5 MB) is made by `Xenova/all-MiniLM-L12-v2` at revision `beeb2e4b69e95f188a15cc2e90d09fd035dac229`, fp32, mean pooling, normalized, 384 dimensions, over the published graph. Questions carry no prefix. It stores plain number arrays, so earlier releases of this package can read it.

The website build makes the file and git does not hold it. On every push and pull request to `main`, the Build job in `.github/workflows/ci-cd.yml` regenerates the graph from `techniques.json` (`pnpm generate-data`), generates the file from that graph, and records the commit being built as the data commit. After the site build it runs `tests/vectors-files.test.ts`, which checks that the loader accepts the file and that the file's corpus hash equals the hash of the graph that build wrote. A failure at any of these steps fails the job before the site is uploaded or deployed. The job caches the model download, keyed on the pinned revision. Where the file does not exist, as in the pull request test workflow, the tests of the published file skip and say so.

### Regenerating the vectors

```sh
# The HTTP service's file. --model-dir holds the Qwen3 ONNX snapshot at the pinned revision.
pnpm generate-embeddings --model=qwen3 --model-dir=<snapshot dir> \
  --data-dir=<dir with ld/graph.jsonld and data-version> --output=vectors/embeddings.qwen3.json

# The stdio server's file, from the published graph. The website build runs this
# command, with the commit being built as --data-commit; run it from a clone to use --local.
pnpm generate-embeddings --model=minilm --data-dir=../public/data \
  --data-commit=$(git log -1 --format=%H -- ../public/data/ld/graph.jsonld) \
  --output=../public/data/ld/embeddings.json
```

`--data-dir/data-version` (written by `scripts/fetch-build-data.mjs`) or `--data-commit` is recorded as the data commit. The Qwen3 generator refuses a model directory that is not the pinned snapshot: `model.onnx` must have the snapshot's SHA-256 and `model.onnx_data` its exact size (`CATALOGUE_SNAPSHOT` in `scripts/qwen3-onnx.ts`, from the repository's LFS records).

**Ranking.** The optional ranker needs a local Ollama daemon (0.35.1 or newer) with `clef-flash`, whose initial download is about 11–12 GB. [Ollama Clef-Flash model page](https://ollama.com/library/clef-flash). It is off in the image. To use it with the HTTP service run from source, leave `RANKING_ENABLED` unset (or `true`) and set `OLLAMA_URL` to a local daemon (`localhost`, `127.0.0.1`, `[::1]` or `host.docker.internal`); `/healthz.rankingAvailable` then checks whether the daemon lists Clef-Flash, and `/healthz.lastRankingSucceeded` reports the outcome of the most recent ranking call (null before the first). Each tool response records whether ranking actually succeeded.

### Local development and evaluation

Run the HTTP service from source against the committed Qwen3 vectors (the directory needs the graph and the vectors file under `ld/`):

```sh
BUILD_DATA_DIR=generated/data DATA_REF=d07d92fa9ed0b19c9289a3b6220a4aa6b893cb6e node scripts/fetch-build-data.mjs
cp vectors/embeddings.qwen3.json generated/data/ld/embeddings.json
pnpm build
DATA_DIR=generated/data TEA_OFFLINE=1 RANKING_ENABLED=false pnpm start:http
pnpm test
```

The service refuses to start if the graph's corpus differs from the one the vectors were made from, so use the graph at the vectors' data commit (`dataCommit` in the file). Evaluate the 5 cardiac digital twin claims the way a caller of the HTTP service does, with query vectors from OpenRouter (the key is read from `~/.config/openrouter/api-key` and used only as a bearer token):

```sh
RANKING_ENABLED=false pnpm evaluate --case=cardiac-dt --model=qwen3 --queries=openrouter \
  --data-dir=generated/data --output=generated/cardiac-qwen3.json
```

Without those options it evaluates the stdio server: the claims are embedded in-process with MiniLM and searched against the published MiniLM vectors (`--data-dir` must hold the published graph and `embeddings.json`; for the default `public/data`, make the file first with the MiniLM command under [Regenerating the vectors](#regenerating-the-vectors)):

```sh
RANKING_ENABLED=false pnpm evaluate --case=cardiac-dt --output=generated/cardiac-minilm.json
OLLAMA_URL=http://127.0.0.1:11434 pnpm evaluate --case=cardiac-dt --output=generated/ranked.json   # with Clef-Flash ranking
```

Case files live in `evaluation/cases/<id>.rubric.json` (tracked in git). Each file has this shape:

```json
{
  "schema": 1,
  "id": "example",
  "title": "Example case",
  "system": "The system being assured",
  "goal": "Optional assurance goal",
  "claims": [
    {
      "id": "C1",
      "text": "A claim to evaluate",
      "good": ["cross-validation"],
      "acceptable": ["bootstrapping"],
      "bad": [],
      "notes": {"cross-validation": "Optional label explanation"},
      "votes": {"cross-validation": ["good", "acceptable", "good"]}
    }
  ]
}
```

`goal`, `notes` and `votes` are optional. Votes retain labels in a fixed labeller order and do not affect scoring. Unknown fields are ignored. Case ids must match filenames (without `.rubric.json`); claim ids must be unique within a case and claim text nonempty. Duplicate slugs within a label list are merged; conflicting labels and invalid votes stop the run with the filename and reason. Unknown graph slugs produce warnings on screen and in each case's `unknownSlugs` report field.

From `mcp-server/`, run all cases, select cases, or compare two reports:

```sh
pnpm evaluate
pnpm evaluate --cases-dir=evaluation/cases --case=cardiac-dt,example --output=generated/run.json
pnpm evaluate compare generated/cardiac-minilm.json generated/ranked.json --output=generated/comparison.json
```

The default report is `generated/evaluation.json`. It records schema version 1, retrieval configuration, per-claim results with labels and counts, case averages and unknown slugs, and both the average across all claims and the average of case averages. Comparison prints A, B and B minus A for shared claims, their case averages and both overall averages; aggregates use **shared claims only**. Claims found in just one report are listed separately; no shared claims is an error. The optional compare output stores this comparison as JSON. Claim identity is the pair of case id and claim id.

`pnpm evaluate-cardiac-dt` remains an alias for `pnpm evaluate --case=cardiac-dt`. Scoring remains +1 good, −1 bad, 0 acceptable or unlisted, with the original grade bands.

The rubric is unchanged. Check each evaluation's `rankingAvailable` fields before treating the run as a Clef-Flash comparison. `PORT` defaults to 3100, `HOST` to loopback outside Docker, `DATA_DIR` selects the local graph/vectors directory, and `EMBEDDING_CACHE_DIR` selects the in-process model cache (default `mcp-server/.cache/huggingface`). `pnpm start:http` never loads a model, so its semantic search needs a supplied `queryEmbedding`.

`pnpm evaluate --case=cardiac-dt` without `--queries` runs the in-process model, downloading it on first use unless `TEA_OFFLINE=1`.

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
