# Little Works — 3D Agent Village

Open **http://127.0.0.1:8787**. Start with:

```sh
sh ~/.hermes/village/start.sh
```

## Use

1. Select a project, or **Choose folder** to browse any local folder (no TEAM directory required).
2. Choose **OpenCode**, **Hermes**, or **Other LLM**. Histories and runs are isolated by engine and project.
3. Pick/type a model. An empty model uses the engine default. The catalog combines OpenCode's installed CLI catalog and Hermes's cached provider catalog, filtered by the selected engine. Catalog presence does not guarantee credentials, credit or endpoint access.
4. Assign a task to one role or **Full team**. The full team executes Architect → Coder → Tester → Manager sequentially and passes reports forward. This is one four-stage pass; it does not automatically iterate until approval.
5. Send a task. Live public text and tool summaries appear in the conversation. **Stop run** terminates the CLI process group. Follow-ups include the last run's conversation in a fresh one-shot invocation.

**Other LLM** supports OpenAI-compatible `/chat/completions` servers, including local servers. Enter a base URL such as `http://localhost:11434/v1` and exact model ID. API credentials are read from the named server environment variable, not entered into the browser. This mode is chat-only and has no local filesystem tools. Stopping it marks the local run cancelled; an already submitted HTTP request may finish at the provider.

## World

Click a house to enter its office; **Exit house** (or Escape) returns to your saved village camera. A short, reversible camera move and a soft transition connect the exterior and interior. Each office has a square tiled floor and only north/west walls, plus a desk, laptop, desktop computer, printer, picture, pencil, lamp and books. Architect is bright blue/paper, Coder dark amber/terminal, Tester plum/cool light, and Manager warm sage/oak. Furniture placement also varies.

Active agents walk around the houses via the side paths, open a hinged door, cross the threshold and work inside. They leave through the door when finished. Open the office to see the worker at the desk. Pausing freezes world movement; reduced-motion mode directly presents the correct inside/outside state. Only one office is displayed at a time; all exterior hover behavior is disabled while it is open. Chunky hover frames use precise structure-only bounds, excluding plinths, flags and yard props.

`web/offices.js` owns the office scenes and furnishings; `web/hover-frame.js` builds the thick geometry-based frames. `office-check.js` exercises all four rooms, furniture, door entry/exit, occupant visibility, reversible navigation and reduced-motion behavior.

Model selection now has a provider filter and an alphabetically grouped model dropdown, with a custom ID field. OpenCode free-tier 403 responses are explained with provider-switch guidance rather than raw response headers. This is a provider restriction, not a successfully repaired free-tier entitlement.

Hovering buildings or characters shows a wireframe bounding box and name label. Characters acknowledge a hover with a brief camera-facing glance, then resume their previous activity. Holding the pointer does not continuously retrigger the glance. Paused/reduced-motion worlds keep labels and outlines without the turn animation.

Three.js 0.180.0 loads from the pinned jsDelivr CDN. Internet and WebGL are needed for the scene. The mission-control interface remains available if rendering fails.

Four distinct low-poly workshops, segmented characters, tiled island, cobbled paths, trees, flowers, a pond and bridge, windmill and a meeting table. Orbit, zoom, reset, pause and evening controls are provided. Reduced-motion preference pauses ambient animation by default.

Only new public run output creates speech bubbles. Two visible at most; collision-aware screen placement with leader lines, expiry and deduplication. The full conversation stays in the side panel. Idle movement is ambient; role working and meeting states are driven by village-launched tasks. Imported TEAM records are historical, not proof that a process is currently active.

## Local architecture

The GUI uses a balanced desktop split: village on the left, independently scrolling session on the right, with a compact composer below it. A 52px header contains project selection and engine indication; engine/role/model settings live in Mission Control. Provider filters, model overrides and connection configuration are under a disclosure. Artifacts and memories are in **Context & files**. Narrow screens stack the square village above the session. `web/layout.css` owns this presentation layer; 3D scene rendering is unchanged.

Conversation messages are updated by event ID rather than rebuilding the entire stream, preserving expanded tool records and the reader’s scroll position. **Latest output** resumes following the stream. Tool results are captured separately and rendered as collapsible records. `layout-check.js` checks the split, aspect ratio, disclosures, responsive widths and long-stream scrolling.

- `server.py`: same-origin localhost HTTP API, folder browser, engine-scoped history.
- `runtime.py`: model discovery, subprocess dispatch, sequential roles, cancellation, run persistence.
- `web/world.js`: procedural 3D models, animation, raycasting and projected character anchors.
- `web/ui.js`: project/engine/model selection, task form, conversation, bubble layout.
- `runs/*.json`: persisted run metadata and public output, recoverable after reload. Restarted unfinished runs are marked interrupted.
- `legacy.py`: preserved previous implementation; reused read-only TEAM/artifact/memory readers.

OpenCode runs with `--pure` to avoid the earlier experimental global village plugin. Hermes uses `chat --format stream-json --in <project>`. Existing engine authentication is inherited; restart the village from a shell with the required environment after changing credentials. No shell interpolation or automatic permission-bypass flag is added. Tool approval requests requiring an interactive terminal may need the normal engine UI.

The old `HERMES_EMBED.md` remains an optional embedding recipe. The village is a standalone web app compatible with both engines, not an installed native tab in either application.

## Verification

```sh
python3 -m unittest -v test_runtime
npx --no-install playwright cli open http://127.0.0.1:8787
npx --no-install playwright cli run-code --filename=browser-check.js
```

Tests cover real subprocess output/failure/cancellation, exclusive project execution, role order, argument handling, engine scoping, a real local compatible HTTP endpoint, and stale TEAM state. Browser checks cover WebGL model counts, folder selection, engine-specific model catalogs, role selection, non-overlapping bubble rectangles and narrow-screen overflow.

## Conversation decisions retained — 2026-10-04

The user requested an isometric low-poly village for Architect/Coder/Tester/Manager, usable with Hermes and OpenCode. They selected pinned CDN Three.js, one-shot task execution, and a union model catalog. Current implementation supports project browsing, exclusive engine selection, tasks and follow-ups, optional compatible LLM chat, clickable buildings/characters, and animated world behavior.
