# Contributing to Agent Village

## Setup (5 minutes)

```sh
git clone https://github.com/azfardanish/agent-village.git
cd agent-village
python3 --version   # need 3.10+
sh start.sh         # open the printed URL
```

No virtualenv, no `pip install` — the backend is stdlib-only and must stay
that way. For browser checks you'll want Playwright's CLI
(`npx playwright cli`) and whatever engine you intend to test with.

## Running and testing changes

- Backend: `python3 -m unittest -v test_runtime` — real subprocesses,
  cancellation, role order, config guards. All green before pushing.
- Frontend: start the server, then against it:
  `npx playwright cli run-code --filename=layout-check.js` (also
  `browser-check.js`, `hover-check.js`, `office-check.js`). These assert
  DOM + WebGL `diagnostics()`, not screenshots.
- Frontend syntax: `node --check web/<file>.js`.

## Conventions

- **Stdlib-only backend.** Need a dependency? You almost certainly don't —
  reframe the change. `config.py`, `server.py`, `runtime.py`, `legacy.py`
  import nothing outside the standard library. CI would reject more.
- **No build step.** `web/` is served as-is. No bundler, no TypeScript, no
  framework. Three.js stays a pinned CDN importmap.
- **Argv lists, never shell strings.** Subprocess calls interpolate nothing.
- **Redact before persist.** Anything stored in `runs/` or shown in the UI
  goes through `redact()`. Extend its patterns rather than working around it.
- **Extend `diagnostics()`, don't bypass it.** Scene changes come with
  WebGL-measurable assertions in a `*-check.js` script.
- **Docs with behavior.** Behavior, config, or contract changes update
  `docs/` + `CHANGELOG.md` in the same PR.

## What PRs are welcome

- New **agent roles** (role + prompt + house + office + UI wiring),
  **house designs**, **office interiors**, **engine adapters**
  (see [docs/adapters.md](docs/adapters.md)).
- Bug fixes with a failing-then-passing test or check.
- Docs that shorten a newcomer's path to a running village.

## Scope: what belongs here

In: local-only operation, stdlib-only backend, procedural low-poly scene,
engine subprocess dispatch, run records, onboarding docs.

Out: user accounts, telemetry, hosted backends, non-localhost networking,
bundled AI providers or credentials, dependency-heavy frontend, anything
that phones home. PRs in the "out" column will be closed with a pointer to
this section — it's the design, not the quality.

## Issues and PRs

Use the templates (`.github/`). Bug reports need: OS + Python version,
engine + version (`--print-config` output helps), and the redacted server
log tail. PRs need: what changed, which tests/checks ran, changelog entry.
