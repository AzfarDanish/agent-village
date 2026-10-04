# Sessions

Sessions belong to the engines. The village browses, selects, creates
(through use), renames (Hermes), and deletes them — always through the
engine's own CLI. It keeps no session store: `runs/*.json` records runs,
not sessions. The engine is authoritative; the village caches display
metadata only.

## Model

- **One list per engine, never mixed.** Switching engines swaps the list
  and the active session. Sessions don't cross engines.
- **Scoped to the project folder**: OpenCode by `directory`, Hermes by
  workspace (`git_repo_root` or `cwd`). Subagent runs, archived/hidden/tool
  sessions are excluded — the list shows sessions a human would resume.
- **Active session** = where your next task attaches. Shown in the
  `Ready · …` / run status line and remembered per engine+folder.

## Behaviors

| Action | OpenCode | Hermes |
|--------|----------|--------|
| Browse | `session list` + read-only DB enrich | read-only `state.db` query |
| Select | remember id; dispatch adds `--session <id>` | remember id; dispatch adds `--resume <id>` |
| New | **+ New** arms creation; first dispatch runs with `--title` (or engine default) and the UI adopts the created session | **+ New** arms creation; first dispatch creates on the engine, then applies your title via `sessions rename` (best-effort, noted if it fails) |
| Rename | Not supported (needs `opencode serve`; documented gap) | Inline rename via `sessions rename`; duplicate titles rejected by the engine |
| Delete | Two-click confirm → `session delete`; blocked while fork children exist | Two-click confirm → `sessions delete --yes`; blocked while subagent children would cascade |

**No selection** = engine default: dispatch creates a fresh session and the
UI adopts it (`engine_session` captured from engine output).

**Guards**: session controls lock while a run is live (stop it first);
deleting a missing session errors plainly instead of failing silently;
unreadable stores/engines produce an actionable warning, never an empty list
masquerading as "no sessions".

**TEAM runs** append all four role turns to the selected session, in order.

## API

- `GET /api/village/sessions?repo=&engine=` → `{sessions:[{id,title,ago,updated,model,agent,cost,tokens,parent_id,…}], warning}`
- `POST /api/village/sessions/delete` `{engine,id}` → `{ok}` (409-style 400 on children)
- `POST /api/village/sessions/rename` `{engine:'hermes',id,title}` → `{ok}`

Dispatch accepts `session_id`, `new_session`, `new_title`; jobs persist
`session_id` and the captured `engine_session` (see [runs format](runs-format.md)).
