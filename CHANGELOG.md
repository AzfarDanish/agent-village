# Changelog

Follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/): `Added` /
`Changed` / `Fixed` under `Unreleased`, then version sections. Config schema
changes always note the `config.py:CONFIG_VERSION` implication.

## Unreleased

### Added
- Engine-backed session management (`sessions.py` + sidebar controls):
  per-engine browsable session lists scoped to the project folder, explicit
  new-session arming with optional title, Hermes rename, two-click engine-side
  delete with fork/cascade guards, attach on dispatch (`--session` /
  `--resume`), captured `engine_session` on run records. `runs/*.json`
  documented as run receipts, not sessions (see `docs/sessions.md`).
- Versioned local config (`village.json`, schema v1) with `village.example.json`
  mirror: host/port, default engine/model/role/repo, project roots, run
  timeout, message limit, per-engine binary paths + extra args, path overrides.
- Engine discovery: explicit path → PATH → per-platform known locations, with
  fail-fast install hints and `--print-config` / `GET /api/village/config`.
- Windows-safe process spawning/termination (process groups on POSIX,
  `CREATE_NEW_PROCESS_GROUP` + terminate/kill on Windows).
- Public docs set (`docs/`), CONTRIBUTING, Code of Conduct, MIT license,
  issue/PR templates.

## 0.2.0 — 2026-10-04

### Added
- Single-view main area: Live world / Conversation toggle moving the one
  conversation thread (never duplicated); fixed 320px Mission Control.
- Four distinct house silhouettes (tower, wide workshop, round lab, grand
  hall); camera-facing-only hover frames (9/12 edges).

### Changed
- `start.sh` is relocatable (uses its own directory, forwards args).

## 0.1.0 — 2026-10-04

Initial public shape: stdlib-only server + runtime, Three.js village with
four role workshops and offices, OpenCode/Hermes/LLM dispatch, run records,
model-catalog union, Playwright check scripts.

## Conversation decisions (pre-public history, retained as-is)

The user requested an isometric low-poly village for Architect/Coder/Tester/
Manager, usable with Hermes and OpenCode. They selected pinned CDN Three.js,
one-shot task execution, and a union model catalog. Later: project browsing,
exclusive engine selection, tasks and follow-ups, optional compatible LLM
chat, clickable buildings/characters, animated world behavior, provider
filtering, hover labels with glance acknowledgment, office interiors with
door entry/exit, and the single-view Mission Control layout.
