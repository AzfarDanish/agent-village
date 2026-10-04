#!/bin/sh
# Start shared village (Hermes + OpenCode). Open http://127.0.0.1:8787
exec python3 "$HOME/.hermes/village/server.py" --port 8787 --host 127.0.0.1
