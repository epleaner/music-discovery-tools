#!/usr/bin/env bash
# Build RYMMenuBar and assemble a clickable .app bundle.
set -euo pipefail

cd "$(dirname "$0")"

APP_NAME="RYM MenuBar"
BIN_NAME="RYMMenuBar"
APP_DIR="build/${APP_NAME}.app"

echo "==> Building release binary…"
swift build -c release

echo "==> Assembling ${APP_DIR}…"
rm -rf "${APP_DIR}"
mkdir -p "${APP_DIR}/Contents/MacOS"
mkdir -p "${APP_DIR}/Contents/Resources"

cp ".build/release/${BIN_NAME}" "${APP_DIR}/Contents/MacOS/${BIN_NAME}"
cp "Resources/Info.plist" "${APP_DIR}/Contents/Info.plist"

# Ad-hoc sign so macOS lets it run locally without Gatekeeper friction.
codesign --force --deep --sign - "${APP_DIR}" >/dev/null 2>&1 || true

echo "==> Done: ${APP_DIR}"
echo "    Launch with:  open \"${APP_DIR}\""
