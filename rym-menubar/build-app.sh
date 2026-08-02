#!/usr/bin/env bash
# Build RYMMenuBar and assemble a clickable .app bundle.
set -euo pipefail

cd "$(dirname "$0")"

APP_NAME="RYM MenuBar"
BIN_NAME="RYMMenuBar"
APP_DIR="build/${APP_NAME}.app"

# UNIVERSAL=1 builds a universal2 (arm64 + x86_64) binary so the .app runs
# natively on both Apple Silicon and Intel Macs. Default is a fast host-arch build.
# NOTE: UNIVERSAL=1 needs full Xcode (the cross-arch build uses xcbuild); the
# Command Line Tools alone can't do it. CI (GitHub's macOS runners) has Xcode.
if [ "${UNIVERSAL:-0}" = "1" ]; then
  echo "==> Building universal (arm64 + x86_64) release binary…"
  swift build -c release --arch arm64 --arch x86_64
  BIN_PATH=".build/apple/Products/Release/${BIN_NAME}"
else
  echo "==> Building release binary…"
  swift build -c release
  BIN_PATH=".build/release/${BIN_NAME}"
fi

echo "==> Assembling ${APP_DIR}…"
rm -rf "${APP_DIR}"
mkdir -p "${APP_DIR}/Contents/MacOS"
mkdir -p "${APP_DIR}/Contents/Resources"

cp "${BIN_PATH}" "${APP_DIR}/Contents/MacOS/${BIN_NAME}"
cp "Resources/Info.plist" "${APP_DIR}/Contents/Info.plist"
cp "Resources/genres-tree.json" "${APP_DIR}/Contents/Resources/genres-tree.json"

# Ad-hoc sign so macOS lets it run locally without Gatekeeper friction.
codesign --force --deep --sign - "${APP_DIR}" >/dev/null 2>&1 || true

echo "==> Done: ${APP_DIR}"
echo "    Launch with:  open \"${APP_DIR}\""
