# Limitations (read before you're surprised)

- **Internet required** for the 3D scene (Three.js CDN). Task controls
  work offline; the world doesn't render.
- **WebGL required.** No software fallback is shipped.
- **Localhost only, by design.** The server binds `127.0.0.1` with no
  authentication. It can dispatch shell commands via your engine CLIs, so
  exposing it to a network would be remote code execution. Don't.
- **No telemetry of any kind.** Nothing phones home — not even a version
  check. The only network requests are your browser fetching Three.js and
  your engines calling their providers.
- **One run per project folder.** A second dispatch to the same folder
  while one runs is rejected; stop the first or wait.
- **No auto-approval.** Runs that hit engine approval prompts stall until
  you handle them in the engine's own UI.
- **Catalog ≠ capability.** Listed models may lack login, tokens, or credit
  ([details](model-catalog.md#hard-limits-read-before-debugging-model-not-working)).
- **OpenCode free tier is unusable here** (provider-side 403).
  [Workaround](engines.md#known-issue-opencode-free-tier-403).
- **Historical records aren't live activity.** Imported `TEAM/` files and
  OpenCode session history describe the past. Only village-launched runs
  drive characters and meeting states; idle wandering is labeled ambient.
- **Follow-ups are one-shot.** "Continue context" starts a *new* engine
  invocation carrying the last run's transcript — not a resumed session.
- **Other-LLM mode is chat-only.** No tools, no file access
  ([details](openai-compatible.md)).
