# Architecture

Three layers, one rule: **the backend is Python standard library only**
(`http.server`, `sqlite3`, `subprocess`, `threading`, `json`). No pip
packages, no framework. The frontend is vanilla JS plus Three.js 0.180.0
from CDN (pinned importmap, no build step).

```
browser (web/)  ←→  server.py (HTTP + adapters)  ←→  runtime.py (runs)
                        ↕                              ↕
                   engine CLIs                   runs/*.json
                   (subprocesses)
```

## `server.py` — HTTP boundary

`ThreadingHTTPServer` on `127.0.0.1` (configurable port). Same-origin
enforced: non-local `Host`/`Origin` gets 403. No auth by design — see
[Limitations](limitations.md#localhost-only-by-design).

Endpoints (all JSON):

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/village/config` | Resolved config: defaults, engine availability (`command`, `source`, `version`), limits |
| GET | `/api/village/repos` | Suggested project folders from `project_roots` |
| GET | `/api/village/folders?path=` | Folder browser (500 entries max, dotfiles skipped) |
| GET | `/api/village/state?repo=&engine=` | Engine-scoped view: jobs, history/memories, status |
| GET | `/api/village/artifacts?repo=` | TEAM brief/plan/report/test/review/history excerpts |
| GET | `/api/village/models` | Union model catalog (see [Model catalog](model-catalog.md)) |
| POST | `/api/village/dispatch` | Submit a task (validates, then queues) |
| POST | `/api/village/stop` | Cancel a run by id |
| GET | `/*` | Static files from `web/` (allowlisted suffixes only) |

`state` is engine-scoped on purpose: Hermes shows `TEAM/` history +
memories; OpenCode shows its SQLite session history. Jobs never cross
engines or repos.

## `runtime.py` — runs

- `submit(body)` validates (folder exists, engine known, role known,
  message length, engine binary resolvable) and enforces **one running task
  per project folder**. Returns the queued job (HTTP 202 semantics).
- `run(job)` executes roles sequentially in a background thread:
  `TEAM` = ARCHITECT → CODER → TESTER → MANAGER with reports passed
  forward; a single role runs just that role. Each role gets a purpose-built
  prompt (`ROLE_PROMPTS`) plus the user task and optional prior context.
- Engine CLIs are spawned with **argv lists, never shell strings**
  (`_spawn`), process-group isolated (`start_new_session` on POSIX,
  `CREATE_NEW_PROCESS_GROUP` on Windows), with a configurable wall-clock
  ceiling (`run_timeout_s`) and user cancellation (`terminate` → SIGTERM,
  then SIGKILL / `terminate()` then `kill()`).
- `stream_event` keeps public text and tool summaries only — model reasoning
  and raw tool inputs are deliberately dropped. All stored text passes
  through `redact()` (ANSI stripping + API-key patterns).
- `persist` writes each job atomically (`*.tmp` + rename) to `runs/`.
  Restarted servers mark unfinished runs `interrupted`.
- `catalog()` unions live `opencode models` output with the Hermes provider
  cache; missing CLIs become warnings, not crashes.

## `config.py` — versioned config + discovery

Schema version `1` (`CONFIG_VERSION`). Loads `village.json` (ignored) over
built-in defaults; `village.example.json` is the committed mirror.
Newer-than-code versions are rejected loudly. Engine resolution order:
explicit `command` → `PATH` → per-platform known locations. Details:
[Configuration](configuration.md).

## `legacy.py` — preserved readers

Read-only parsers carried over from v1: `TEAM/state.json`, `TEAM/*.md`
artifacts, `history.md` talk lines, `~/.hermes/memories`. Kept separate so
the Hermes-history behavior stays untouched while the new code grows
elsewhere. `web/app.js` is the matching preserved 2D renderer (superseded
by the `web/*.js` modules, kept for reference).

## Frontend (`web/`)

| File | Owns |
|------|------|
| `ui.js` | Controls, polling (1.8s), conversation rendering by event id, speech-bubble layout, folder browser, config defaults |
| `world.js` | Village scene graph, villagers, work/meeting movement, door entry/exit, office transitions, picking, hover |
| `offices.js` | Four two-wall office interiors + furnishings + palettes |
| `hover-frame.js` | Chunky geometry edge frames, camera-facing side only |
| `layout.css` / `style.css` | Layout shell vs. base theme |
| `index.html` | Shell: header, main view toggle, sheet, sidebar, dialogs |

`world.js` exposes a small `diagnostics()` surface (view state, office
contents, house bounds, hover counts) that the `*-check.js` Playwright
scripts assert against. Keep it accurate when changing the scene.

## Test layers

- `test_runtime.py` — real subprocesses (output, failure, cancellation),
  role order, engine scoping, config guards, compatible-endpoint round trip.
  Run: `python3 -m unittest -v test_runtime`.
- `browser-check.js`, `hover-check.js`, `layout-check.js`, `office-check.js`
  — Playwright scripts run via `npx playwright cli run-code --filename=…`
  against a live server. They assert DOM + WebGL diagnostics, not pixels.
