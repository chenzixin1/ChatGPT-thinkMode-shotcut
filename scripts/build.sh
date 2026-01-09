#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
BUILD_DIR="$DIST_DIR/build"
ZIP_NAME="chatgpt-mode-switcher.zip"

rm -rf "$DIST_DIR"
mkdir -p "$BUILD_DIR"

rsync -a --exclude '.DS_Store' "$ROOT_DIR/manifest.json" "$ROOT_DIR/src" "$BUILD_DIR/"

(
  cd "$BUILD_DIR"
  zip -r "$DIST_DIR/$ZIP_NAME" manifest.json src >/dev/null
)

rm -rf "$BUILD_DIR"

echo "Built $DIST_DIR/$ZIP_NAME"
