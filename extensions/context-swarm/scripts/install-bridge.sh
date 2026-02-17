#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

BRIDGE_DIR="$(pwd)/bridge"
MANIFEST_SRC="${BRIDGE_DIR}/context_swarm.json"
MANIFEST_DST="$HOME/.mozilla/native-messaging-hosts/context_swarm.json"

if [ ! -f "$MANIFEST_SRC" ]; then
  echo "Error: Bridge manifest not found at $MANIFEST_SRC"
  exit 1
fi

mkdir -p "$HOME/.mozilla/native-messaging-hosts"

# Update the path in the manifest to point to the actual bridge script location
BRIDGE_SCRIPT="${BRIDGE_DIR}/context_swarm_bridge.sh"
sed "s|BRIDGE_PATH_PLACEHOLDER|${BRIDGE_SCRIPT}|" "$MANIFEST_SRC" > "$MANIFEST_DST"

chmod +x "$BRIDGE_SCRIPT"

echo "Native messaging bridge installed:"
echo "  Manifest: $MANIFEST_DST"
echo "  Bridge:   $BRIDGE_SCRIPT"
