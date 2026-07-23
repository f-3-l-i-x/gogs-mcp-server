#!/bin/sh
set -eu

# Basic curl smoke test for the running MCP server.
# Usage: scripts/smoke-test.sh [host] [port]

HOST="${1:-localhost}"
PORT="${2:-8080}"
BASE="http://${HOST}:${PORT}"

echo "== GET /healthz =="
curl -sf "${BASE}/healthz"
echo
echo

echo "== POST /mcp initialize =="
curl -s -X POST "${BASE}/mcp" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke-test","version":"0.0.1"}}}'
echo
echo

echo "== POST /mcp tools/list =="
curl -s -X POST "${BASE}/mcp" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
echo
echo

echo "== POST /mcp tools/call gogs_get_current_user =="
curl -s -X POST "${BASE}/mcp" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"gogs_get_current_user","arguments":{}}}'
echo
