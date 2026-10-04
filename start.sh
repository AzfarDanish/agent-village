#!/bin/sh
# Start the village from anywhere inside a clone. Open the printed URL.
# Usage: sh start.sh [--port 8787] [--config /path/to/village.json]
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
exec python3 "$ROOT/server.py" "$@"
