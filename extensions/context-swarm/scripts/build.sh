#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist/
mkdir -p dist/
cp -r extension/* dist/

echo "Build complete: dist/"
ls -la dist/
