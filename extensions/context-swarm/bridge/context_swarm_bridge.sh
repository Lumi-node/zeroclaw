#!/usr/bin/env bash
# ContextSwarm Native Messaging Bridge
# Reads Firefox native messaging protocol (4-byte LE length prefix + JSON),
# pipes to zeroclaw ingest, writes response back in native messaging format.

set -euo pipefail

# Read 4-byte little-endian message length
read_length() {
  local bytes
  bytes=$(dd bs=1 count=4 2>/dev/null | od -An -tu4 -N4 --endian=little | tr -d ' ')
  echo "${bytes:-0}"
}

# Write native messaging response (4-byte LE length prefix + JSON)
write_response() {
  local msg="$1"
  local len=${#msg}
  # Write 4-byte little-endian length
  printf "\\x$(printf '%02x' $((len & 0xFF)))"
  printf "\\x$(printf '%02x' $(((len >> 8) & 0xFF)))"
  printf "\\x$(printf '%02x' $(((len >> 16) & 0xFF)))"
  printf "\\x$(printf '%02x' $(((len >> 24) & 0xFF)))"
  printf '%s' "$msg"
}

send_error() {
  local error_msg="$1"
  local response
  response=$(printf '{"status":"error","error":"%s"}' "$error_msg")
  write_response "$response"
}

# Check if zeroclaw is available
if ! command -v zeroclaw &>/dev/null; then
  send_error "zeroclaw not found in PATH"
  exit 1
fi

# Read message length
msg_len=$(read_length)
if [ "$msg_len" -eq 0 ] || [ "$msg_len" -gt 10485760 ]; then
  send_error "invalid message length"
  exit 1
fi

# Read the JSON message
msg=$(dd bs=1 count="$msg_len" 2>/dev/null)

# Check if this is a ping
action=$(echo "$msg" | python3 -c "import sys,json; print(json.load(sys.stdin).get('action',''))" 2>/dev/null || echo "")
if [ "$action" = "ping" ]; then
  write_response '{"status":"ok","version":"0.1.0"}'
  exit 0
fi

# Extract optional parameters
category=$(echo "$msg" | python3 -c "import sys,json; print(json.load(sys.stdin).get('category',''))" 2>/dev/null || echo "")
key_prefix=$(echo "$msg" | python3 -c "import sys,json; print(json.load(sys.stdin).get('key_prefix',''))" 2>/dev/null || echo "")

# Build zeroclaw ingest command
cmd="zeroclaw ingest --stdin"
[ -n "$category" ] && cmd="$cmd --category $category"
[ -n "$key_prefix" ] && cmd="$cmd --key-prefix $key_prefix"

# Pipe the JSON to zeroclaw ingest and capture output
result=$(echo "$msg" | $cmd 2>&1) || {
  send_error "zeroclaw ingest failed: $result"
  exit 1
}

# Send the response back
write_response "$result"
