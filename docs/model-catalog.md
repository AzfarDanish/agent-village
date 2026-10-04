# Model catalog: union behavior and limits

`GET /api/village/models` returns `{models: [...], warnings: [...]}`.
Results are cached 120 seconds.

## Sources (in order)

1. **Live `opencode models`** output (one `provider/model` per line),
   labeled `OpenCode catalog`. Requires the resolved OpenCode binary.
2. **Hermes provider cache** (`<hermes_home>/provider_models_cache.json`),
   labeled `Hermes cached catalog`, entries qualified as
   `provider/model`. This file is a cache Hermes itself maintains — it can
   be stale, and the village never refreshes it.

The UI filters the union by selected engine and groups by provider
alphabetically. You can also type any `provider/model` id by hand; unknown
ids are passed through to the engine, which is the final judge.

## Hard limits (read before debugging "model not working")

- **Advertised ≠ usable.** The catalog answers "what exists", never "what
  you can afford". Missing login, expired tokens, and empty credit all fail
  at *run* time with the provider's own error, shown in the conversation.
- **Free-tier 403.** OpenCode free-tier models reject non-OpenCode clients
  (HTTP 403). Listed, but unusable here — pick a funded provider. See
  [Engines](engines.md#known-issue-opencode-free-tier-403).
- **No availability probing.** The village does not pre-flight models
  (that would spend your money to answer a UI question). The only probe is
  at dispatch, on the task you actually sent.
