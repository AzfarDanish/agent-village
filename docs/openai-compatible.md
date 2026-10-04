# OpenAI-compatible endpoints ("Other LLM")

The third engine option talks to any OpenAI-compatible `/chat/completions`
server — Ollama, LM Studio, vLLM, LiteLLM, OpenRouter, or your own gateway.

## What you supply

- **API base URL**, e.g. `http://localhost:11434/v1` (no username/password
  in the URL — those are rejected).
- **Exact model ID** as the server advertises it (e.g. `llama3.2`).
- **API key environment variable** (optional): the *name* of a variable, not
  the key itself — e.g. `OPENAI_API_KEY`. The server process reads it from
  its own environment at request time. Keys are never written to disk,
  never logged, and never sent to the browser beyond the variable name.

## What it can and cannot do

- ✅ Chat: questions, plans, reviews, explanations, drafts.
- ❌ No filesystem tools, no terminal, no file edits. The endpoint receives
  text and returns text; nothing executes. The village labels this mode
  "chat only" in the UI.
- Stopping a run marks it cancelled locally, but an already-submitted HTTP
  request may still complete at the provider.

Use this mode for thinking, not doing. For doing, use OpenCode or Hermes.
