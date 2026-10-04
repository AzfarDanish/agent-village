# Engine adapter contract

Engines are pluggable. OpenCode, Hermes, and the OpenAI-compatible fallback
are three implementations of one contract. To add a fourth (e.g. Claude
Code, Aider, a custom runner), implement the five duties below —
`runtime.py:command`, `stream_event`, `run_cli`/`direct_llm`, error mapping,
and completion — without touching anything else.

## 1. Invocation: argv, one-shot, project-scoped

- Build an **argv list** (never a shell string): binary + fixed flags +
  `--dir`/`--in <repo>` + optional `--model` + the prompt.
- One-shot per role: each role invocation is a fresh process that prints its
  result and exits. No daemons, no PTY, no interactive session reuse.
- Working directory is the selected project folder. Environment is inherited
  from the server process (that's how auth flows in).
- Binary resolution goes through `config.resolve_engine(name)` so custom
  paths and missing-CLI errors behave identically across engines.

## 2. Stream parsing: public text only

- Consume **newline-delimited JSON** (or whatever the CLI emits) line by
  line in `stream_event`.
- Keep: assistant text, final results, tool-use *summaries*
  (tool name, not inputs), tool outputs (stored as separate `tool_result`
  events).
- Drop: chain-of-thought / reasoning blocks, raw tool inputs, token-usage
  frames. If a new event type appears, the default is **drop** until someone
  explicitly classifies it — leaking reasoning or secrets into a persisted
  log is worse than losing a status line.
- Return the extracted public text (or `''`); the runner accumulates it as
  the role's report for the next role.

## 3. Tool calls surfaced, never executed by the village

The village never runs tools itself. When the engine reports tool use,
record a `tool` event (`"Using <name>"`) and, when output arrives, a
`tool_result` event. The conversation UI renders these as collapsible
records distinct from chat text.

## 4. Errors propagate verbatim (plus known-issue translation)

- Non-zero exit → `RuntimeError` carrying the last 3k of stderr (already
  redacted). The job becomes `failed` with that text visible.
- Provider-shaped errors (dicts with `data.message`, `statusCode`) get a
  friendlier wrapper in `provider_error` — e.g. the OpenCode free-tier 403 —
  but the original facts (status code, provider message) must survive in the
  text. Never swallow an error into "something went wrong".
- Empty output with exit 0 is a `status` event, not success theater:
  "finished without a public text response" plus stderr tail.

## 5. Completion = process exit + output

A role is done when its process exits 0 **and** produced public text.
`TEAM` chains roles by feeding each role's accumulated report into the next
role's prompt (`run()`), capped so prompts stay bounded. Cancellation and
the wall-clock timer kill the whole process group; a cancelled role
produces no report and the chain stops.

## Reference implementations

- **OpenCode** (`command` → `opencode run --pure --format json`): JSON
  event stream; `text`/`result` kinds carry output. `--pure` avoids loading
  the user's global village plugin from the earlier experiment. Session
  attach: `--session <id>`; creation title: `--title`. Browse/delete via
  `session list|delete`; the session id is captured from result lines into
  `job.engine_session`.
- **Hermes** (`command` → `hermes chat --format stream-json`): `text`,
  `tool_use`/`tool_result`, and terminal `result` records
  (`hermes_cli/stream_json.py` shapes these). Session attach: `--resume
  <id>` (with `--in <repo>` so cwd stays put). Creation titles are applied
  post-run via `sessions rename` (best-effort). Browse/rename/delete via
  `sessions list|rename|delete`; `--resume` output carries `session_id`.
- **OpenAI-compatible** (`direct_llm`): single non-streaming
  `/chat/completions` POST. Chat-only by construction — no tools to parse,
  no filesystem to touch.
