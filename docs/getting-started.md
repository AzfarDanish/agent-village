# Getting started

## 1. Check requirements

- **Python 3.10+**: `python3 --version`
- **Internet access**: the 3D scene loads Three.js 0.180.0 from the jsDelivr
  CDN on first page load. The task controls work without it, but the world
  won't render.
- **WebGL-capable browser**: any current Chrome, Edge, Firefox, or Safari.
  If the scene fails, a message appears and the controls keep working.
- **An engine CLI**: OpenCode and/or Hermes, installed and logged in
  (see [Engines](engines.md)). The village can start without them, but it
  can't run tasks until one is found.

## 2. Clone and launch

```sh
git clone https://github.com/azfardanish/agent-village.git
cd agent-village
sh start.sh
```

No install step: the backend is Python standard library only. Open the URL
it prints (default <http://127.0.0.1:8787>).

Useful flags (all optional; see [Configuration](configuration.md)):

```sh
sh start.sh --port 8888
sh start.sh --config ~/my-village.json
sh start.sh --print-config   # show resolved config and exit
```

## 3. Run your first task

1. **Choose folder** → browse to any local project folder (no special
   setup required in the folder).
2. Pick **OpenCode** or **Hermes** under Engine. If your engine isn't found,
   you'll see exactly where the app looked and how to point at it —
   [details](engines.md).
3. Pick a **model** (empty = engine default) and an **agent role**.
4. Type a task, press **Send task**. The character walks to its workshop and
   streams output into the conversation panel.

Stuck? [Troubleshooting](troubleshooting.md) covers the common first-run
failures: port in use, engine not found, no WebGL, CDN blocked.
