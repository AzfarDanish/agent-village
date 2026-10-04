# runs/*.json format

Every run persists as one JSON file in `runs/` (git-ignored), named
`<job-id>.json`, written atomically. The UI polls it via
`/api/village/state`; contributors can read it directly for tooling.

```jsonc
{
  "id": "cea65a3832de456eaae00c506522de2e",
  "repo": "/home/you/projects/myapp",   // absolute project folder
  "engine": "opencode",                  // opencode | hermes | llm
  "model": "rapidscreen/gpt-5.4-mini",   // "" = engine default
  "role": "TEAM",                        // ARCHITECT|CODER|TESTER|MANAGER|TEAM
  "current_agent": "CODER",              // role currently executing
  "message": "…user task…",
  "session_id": "ses_…",                 // selected engine session, "" = engine default
  "new_title": "",                       // requested title for an engine-created session
  "engine_session": "ses_…",             // engine session id captured from engine output
  "status": "completed",                 // queued|running|completed|failed|cancelled|interrupted
  "error": null,                         // redacted failure text, if any
  "created_at": 1791085821.9,
  "finished_at": 1791085901.2,           // absent until terminal
  "base_url": "", "key_env": "",         // llm mode only: endpoint + key *name*
  "events": [
    {"id": "…", "ts": 1791085822.1, "author": "CODER",
     "kind": "message", "text": "…public output…"}
  ]
}
```

Event `kind` is one of `message` (public model text), `tool` (tool-use
summary), `tool_result` (tool output, stored separately), `status`
(lifecycle notes), `error`, `history` (imported past records, never live).
All `text` is redacted (ANSI + key patterns) and capped (24k per event,
200 events per run).

`status: interrupted` is written at startup for any record left
`queued`/`running` — the process is gone, only the record remains.
`context` (prior-run text for follow-ups) is consumed at dispatch and never
persisted.

These records describe runs, not engine sessions. The engine session is the
conversation; the run record is the receipt. See [Sessions](sessions.md).
