# Engines: OpenCode and Hermes

The village doesn't bundle an AI. It spawns **your** installed engine CLIs
as subprocesses, in the project folder you selected, inheriting the shell
you launched the village from. If the engine works in your terminal, it
works in the village.

## Supported engines

| Engine   | Command used                                              | Known-good |
|----------|-----------------------------------------------------------|------------|
| OpenCode | `opencode run --pure --format json --dir <repo> ...`      | 1.4.x, 1.18.x |
| Hermes   | `hermes chat --format stream-json --in <repo> ...`        | 0.21.x |

"Known-good" is the newest version verified by a maintainer, not a maximum —
newer versions usually work. Report mismatches as issues.

## Discovery

Resolution order for each engine binary:

1. `engines.<name>.command` in `village.json` (explicit path wins).
2. `PATH` lookup (`shutil.which`, so `opencode` / `hermes` on PATH just work).
3. Known install locations: `/opt/homebrew/bin`, `/usr/local/bin`,
   `~/.local/bin` (see `config.py:PLATFORM_EXTRA_PATHS`).

If nothing is found, dispatch fails fast with an install hint instead of
queueing a doomed run. `sh start.sh --print-config` shows exactly what was
resolved (`command`, `source`, `version`) per engine.

To point at a custom binary:

```json
{ "version": 1, "engines": { "opencode": { "command": "/opt/custom/bin/opencode" } } }
```

## Auth is inherited, not configured

The village reads **no** API keys and stores **none**. Engine subprocesses
inherit the village server's environment, so:

- Log in before starting: `opencode auth login`, `hermes auth ...`, or
  whatever your provider setup needs — exactly as the engine docs describe.
- If you change credentials, **restart the village** from a shell that has
  them; already-running servers keep the old environment.
- The UI never asks for keys. Anything asking for one inside this repo is a
  bug — report it.

## Catalog presence ≠ working credentials

The model picker lists what the engines *advertise* (see
[Model catalog](model-catalog.md)), not what you can afford. A model can
appear and still fail at runtime for missing login, expired tokens, or empty
credit. Those failures surface verbatim in the conversation panel — that Passthrough is intentional: the village never guesses why a provider said no.

## Known issue: OpenCode free-tier 403

OpenCode's free-tier models reject requests made outside the OpenCode app:

> `OpenCode's free tier can only be used from within OpenCode` (HTTP 403)

The village surfaces this as plain guidance, not raw JSON. Workaround: pick
a model from another provider you have credentials for (e.g. RapidScreen,
OpenRouter). The village cannot and will not bypass provider restrictions.

## Interactive approvals

Neither CLI is passed an auto-approve flag. If your task triggers an engine
approval prompt that needs an interactive terminal, the run will stall —
answer it in the engine's own UI and re-send, or scope the task to avoid it.
