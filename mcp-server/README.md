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
- **Knowledge graph** with 115 techniques, 8 assurance goals, and 440+ resources
- **Zero configuration** — fetches data remotely from GitHub Pages with 24h caching

## How It Works

The server fetches the TEA Techniques knowledge graph from GitHub Pages on first run and caches it locally for 24 hours (`~/.cache/tea-techniques-mcp/`). Semantic search uses a lightweight ONNX model (~30MB, downloaded on first use) to match natural-language claims against technique embeddings.

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

This package is part of the [TEA Techniques monorepo](https://github.com/alan-turing-institute/tea-techniques). For local development:

```bash
git clone https://github.com/alan-turing-institute/tea-techniques.git
cd tea-techniques/mcp-server
pnpm install
pnpm dev          # Run from source with tsx
pnpm dev --local  # Load data from local project files
```

## License

[MIT](./LICENSE)
