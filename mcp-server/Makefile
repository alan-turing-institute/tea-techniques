.PHONY: pull-models
# Temporary default network permits downloads; the running stack uses an internal network.
pull-models:
	docker run --rm -v tea-techniques-mcp-models:/root/.ollama --entrypoint sh ollama/ollama:0.40.1 -c 'ollama serve >/tmp/ollama.log 2>&1 & daemon=$$!; trap "kill $$daemon" EXIT; until ollama list >/dev/null 2>&1; do sleep 1; done; ollama pull clef-flash'
