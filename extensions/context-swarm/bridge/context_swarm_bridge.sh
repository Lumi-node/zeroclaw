#!/usr/bin/env bash
# ContextSwarm Native Messaging Bridge
# Reads Firefox native messaging protocol (4-byte LE length prefix + JSON),
# pipes to zeroclaw ingest, writes response back in native messaging format.

set -euo pipefail

# Write native messaging response (4-byte LE length prefix + JSON)
write_response() {
  local msg="$1"
  local len=${#msg}
  printf "\\x$(printf '%02x' $((len & 0xFF)))"
  printf "\\x$(printf '%02x' $(((len >> 8) & 0xFF)))"
  printf "\\x$(printf '%02x' $(((len >> 16) & 0xFF)))"
  printf "\\x$(printf '%02x' $(((len >> 24) & 0xFF)))"
  printf '%s' "$msg"
}

send_error() {
  local error_msg="$1"
  write_response "{\"status\":\"error\",\"error\":\"${error_msg}\"}"
}

# Dependency checks
if ! command -v jq &>/dev/null; then
  send_error "jq not found in PATH"
  exit 1
fi

if ! command -v zeroclaw &>/dev/null; then
  send_error "zeroclaw not found in PATH"
  exit 1
fi

# Read 4-byte little-endian message length
read_length() {
  local bytes
  bytes=$(dd bs=4 count=1 2>/dev/null | od -An -tu4 -N4 --endian=little | tr -d ' ')
  echo "${bytes:-0}"
}

# Read message length
msg_len=$(read_length)
if [ "$msg_len" -eq 0 ] || [ "$msg_len" -gt 10485760 ]; then
  send_error "invalid message length"
  exit 1
fi

# Read the JSON message (single read with correct block size)
msg=$(dd bs="$msg_len" count=1 2>/dev/null)

# Parse all fields in a single jq invocation
parsed=$(echo "$msg" | jq -r '[.action // "", .category // "", .key_prefix // ""] | @tsv' 2>/dev/null) || {
  send_error "invalid JSON"
  exit 1
}
IFS=$'\t' read -r action category key_prefix <<< "$parsed"

# Handle ping
if [ "$action" = "ping" ]; then
  write_response '{"status":"ok","version":"0.1.0"}'
  exit 0
fi

# Validate action
if [ "$action" != "ingest" ]; then
  send_error "unknown action: ${action}"
  exit 1
fi

# Build zeroclaw ingest command (array prevents shell injection)
cmd=(zeroclaw ingest --stdin)
[ -n "$category" ] && cmd+=(--category "$category")
[ -n "$key_prefix" ] && cmd+=(--key-prefix "$key_prefix")

# Pipe the JSON to zeroclaw ingest and capture output
result=$(echo "$msg" | "${cmd[@]}" 2>&1) || {
  send_error "zeroclaw ingest failed: ${result}"
  exit 1
}

# Send the response back
write_response "$result"
