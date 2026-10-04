# Configuration

Zero config required: with no config file the app runs on `127.0.0.1:8787`
with auto-discovered engines. Everything below is override.

## Files

| File                  | Committed? | Purpose                                              |
|-----------------------|------------|------------------------------------------------------|
| `village.example.json`| ✅ yes     | Documented mirror of every supported key + defaults |
| `village.json`        | ❌ never   | Your local overrides (in `.gitignore`)              |

Copy the example to start: `cp village.example.json village.json`, then edit.
Precedence: **CLI flags > `village.json` > built-in defaults**.
`sh start.sh --print-config` prints the resolved, non-sensitive config.

## Schema (version 1)

`version` is mandatory when the file exists. A file declaring a *newer*
version than the code understands is rejected with an error instead of being
half-applied; an older version is rejected with a pointer to this doc.
Bump `config.py:CONFIG_VERSION` only with a migration note in the changelog.

| Key | Default | Meaning |
|-----|---------|---------|
| `host` | `"127.0.0.1"` | Bind address. Only `127.0.0.1` is supported — the server has no auth because it never leaves localhost. |
| `port` | `8787` | Port. `--port` flag wins. |
| `defaults.engine` | `"opencode"` | Pre-selected engine (`opencode`/`hermes`/`llm`). |
| `defaults.model` | `""` | Pre-selected model id; empty = engine default. UI note: currently the model field restores the per-engine last-used value from the browser; the config default applies on first use. |
| `defaults.role` | `"CODER"` | Pre-selected role (`ARCHITECT`/`CODER`/`TESTER`/`MANAGER`/`TEAM`). |
| `defaults.repo` | `""` | Default project folder on first use (an absolute path; added to the folder list). After that the browser remembers your last folder. |
| `project_roots` | `["~/Documents/GitHub"]` | Folders scanned for the project-folder suggestions list. |
| `run_timeout_s` | `1800` | Hard ceiling per run; the run is stopped at the limit. |
| `max_message_chars` | `30000` | Task length limit (server-enforced). |
| `engines.opencode.command` | `""` | Explicit binary path. Empty = auto-discover (config → PATH → known locations). |
| `engines.opencode.extra_args` | `[]` | Extra argv inserted after the binary for every invocation. |
| `engines.hermes.*` | | Same shape as opencode. |
| `paths.hermes_home` | `""` | Override for `~/.hermes` (memories + provider cache). Empty = default. |
| `paths.opencode_db` | `""` | Override for the OpenCode history database path. Empty = default. |

## Secrets policy

**Never put secrets in `village.json`.** There is no key for them on purpose:
engine credentials live in your shell/engine login, LLM keys live in server
environment variables referenced by name. `village.json` is git-ignored so
local paths in it can't leak either — but prefer keeping even paths generic.
