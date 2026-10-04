# Troubleshooting

## Port already in use

`OSError: [Errno 48] Address already in use` (or `Errno 98` on Linux) means
something owns 8787 — usually an earlier village server. Fix:

```sh
lsof -nP -iTCP:8787 -sTCP:LISTEN   # find it (Linux: ss -ltnp | grep 8787)
kill <pid>                          # then restart
sh start.sh --port 8888             # or just move ports
```

## Engine CLI not found

Dispatch fails with *"opencode CLI not found…"* / *"hermes CLI not found…"*:
the binary isn't on PATH and isn't in a known location. Either install it
([Engines](engines.md)), or point at it explicitly:

```sh
sh start.sh --print-config   # see what was probed: command, source, version
```

```json
{ "version": 1, "engines": { "opencode": { "command": "/custom/path/opencode" } } }
```

## "No OpenCode history database found"

Informational, not an error: OpenCode simply hasn't run on this machine yet
(or `paths.opencode_db` points elsewhere). History appears after the first
OpenCode session.

## Blank / broken 3D scene

- **No WebGL**: the page shows an error box and the task controls keep
  working. Enable hardware acceleration or try another browser.
- **CDN blocked**: Three.js 0.180.0 loads from `cdn.jsdelivr.net`. Corporate
  proxies and offline machines break the scene (controls still work).
  Check the browser console for the failed request.
- As a last resort, `web/app.js` preserves the original 2D renderer for
  reference — it is not wired into `index.html`.

## Task fails immediately with provider/billing errors

Read the error in the conversation panel — it's the provider's own words.
Common cases: not logged in (log in with the engine CLI, restart the
village), expired tokens, empty credit (DeepSeek/OpenAI "insufficient
balance" links are included in the message), and the OpenCode free-tier 403
([workaround](engines.md#known-issue-opencode-free-tier-403)).

## Run stalls mid-task

Likely an engine approval prompt waiting in a terminal that isn't there.
The village never auto-approves. Stop the run, answer/avoid the prompt in
the engine's own UI, and re-send a narrower task.

## Platforms

- **macOS / Linux**: fully supported. Python 3.10+ from python.org,
  Homebrew, or your distro.
- **Windows**: use **WSL2** (Ubuntu) and follow the Linux path. Native
  Windows is best-effort: process groups map to Win32 job semantics and
  `~`-style paths in config resolve against the Windows home. WSL avoids
  all of it.
- **PATH matters**: GUI-launched terminals (and IDEs) often carry a
  different PATH than your shell profile. If the engine works in one
  terminal but the village can't find it, launch `sh start.sh` from the
  terminal where it works, or set an explicit `command`.
