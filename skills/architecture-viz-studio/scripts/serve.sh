#!/usr/bin/env bash
# ============================================================================
# serve.sh — start BOTH the page server and the edit-mode feedback bridge.
#
# WHY
# A viz page needs two local servers: an HTTP server for the page (ES modules
# can't load from file://), and the feedback-bridge so "Copy for AI" can write
# snip images to disk for the AI to read. Starting them separately is easy to
# forget — which is why "Copy for AI" sometimes falls back to "Bridge offline".
# This starts both together and shuts both down on Ctrl-C, so the bridge is
# always up whenever the page is served.
#
# USAGE
#   ./serve.sh [pageDir] [--port 8800] [--bridge-port 8910] [--dir /tmp/viz-edit]
#   pageDir defaults to "." (run it from your page directory).
#
# Then init edit-mode with the matching bridge URL:
#   EditMode.init({ bridge: 'http://localhost:8910' });
# Open http://localhost:8800/ and use "Copy for AI" — it now also saves to /tmp/viz-edit.
# ============================================================================
set -euo pipefail

PAGE_DIR="."
PORT=8800
BRIDGE_PORT=8910
EDIT_DIR="/tmp/viz-edit"

# parse args (first non-flag = pageDir)
while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift 2;;
    --bridge-port) BRIDGE_PORT="$2"; shift 2;;
    --dir) EDIT_DIR="$2"; shift 2;;
    --*) echo "unknown flag: $1" >&2; exit 2;;
    *) PAGE_DIR="$1"; shift;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PAGE_DIR"

# free the ports if a previous run left something behind
for p in "$PORT" "$BRIDGE_PORT"; do
  pid="$(lsof -ti tcp:"$p" 2>/dev/null || true)"
  [ -n "$pid" ] && { echo "freeing port $p (pid $pid)"; kill "$pid" 2>/dev/null || true; }
done

# start the feedback bridge (writes snip images to $EDIT_DIR)
node "$SCRIPT_DIR/feedback-bridge.mjs" --port "$BRIDGE_PORT" --dir "$EDIT_DIR" &
BRIDGE_PID=$!

# start the page server
python3 -m http.server "$PORT" >/dev/null 2>&1 &
HTTP_PID=$!

# shut both down together on exit / Ctrl-C
cleanup() { echo; echo "stopping (page $HTTP_PID, bridge $BRIDGE_PID)…"; kill "$HTTP_PID" "$BRIDGE_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "────────────────────────────────────────────────────────"
echo "  page    →  http://localhost:$PORT/"
echo "  bridge  →  http://localhost:$BRIDGE_PORT/  (writes to $EDIT_DIR)"
echo "  init edit-mode with:  EditMode.init({ bridge: 'http://localhost:$BRIDGE_PORT' })"
echo "  Ctrl-C to stop both."
echo "────────────────────────────────────────────────────────"

# keep running until either child exits (portable; macOS Bash 3.2 has no `wait -n`).
# Poll both PIDs; when one dies, the EXIT trap cleans up the other.
while kill -0 "$HTTP_PID" 2>/dev/null && kill -0 "$BRIDGE_PID" 2>/dev/null; do
  sleep 1
done
