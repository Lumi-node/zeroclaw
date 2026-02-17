#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist/
mkdir -p dist/
cp -r extension/* dist/

echo "Build complete: dist/"
ls -la dist/

# Package XPI if web-ext is available
if command -v npx &>/dev/null && [ -f package.json ]; then
  npx web-ext build --source-dir=extension/ --overwrite-dest
  echo "XPI package created in web-ext-artifacts/"
fi
