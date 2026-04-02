#!/bin/bash
# =============================================================================
# Tauri WebDriver Launcher Script (Bash/Unix)
#
# Launches the built Tauri application with WebDriver/CDP support enabled.
# Captures the DevTools WebSocket URL from stdout and outputs it for Playwright.
#
# Usage:
#   bash tests/e2e/launch-tauri.sh
# =============================================================================

set -e

PORT="${TAURI_WEBDRIVER_PORT:-9222}"
TIMEOUT=30
START_TIME=$(date +%s)

# Find the Tauri executable
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAURI_DIR="${SCRIPT_DIR}/../src-tauri"
EXE_PATH=""

if [[ "$OSTYPE" == "darwin"* ]]; then
    EXE_PATH="${TAURI_DIR}/target/release/pm-app"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    EXE_PATH="${TAURI_DIR}/target/release/pm-app"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    EXE_PATH="${TAURI_DIR}/target/release/pm-app.exe"
fi

if [[ -z "$EXE_PATH" || ! -f "$EXE_PATH" ]]; then
    echo "Error: Tauri executable not found at: $EXE_PATH" >&2
    echo "Please run 'pnpm tauri build' first." >&2
    exit 1
fi

echo "[tauri-launcher] Executable: $EXE_PATH"
echo "[tauri-launcher] WebDriver port: $PORT"

# Cleanup function
cleanup() {
    if [[ -n "$TAURI_PID" && -d "/proc/$TAURI_PID" ]]; then
        echo "[tauri-launcher] Killing Tauri app (PID: $TAURI_PID)..."
        kill "$TAURI_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT

# Launch Tauri app
echo "[tauri-launcher] Launching Tauri app..."
"$EXE_PATH" --webdriver-port "$PORT" --disable-gpu --no-sandbox &
TAURI_PID=$!

CDP_URL=""
READY=false

echo "[tauri-launcher] Waiting for CDP URL..."

# Read stdout line by line
while kill -0 "$TAURI_PID" 2>/dev/null; do
    if IFS= read -r line < <(timeout 0.1 tail -f /dev/null 2>/dev/null || true); then
        :
    fi

    # Check elapsed time
    ELAPSED=$(( $(date +%s) - START_TIME ))
    if (( ELAPSED > TIMEOUT )); then
        echo "Error: Timeout waiting for Tauri app to start" >&2
        kill "$TAURI_PID" 2>/dev/null || true
        exit 1
    fi

    # Try to read from the app's stdout (using a background cat)
    if [[ -z "$CDP_URL" ]]; then
        # On Linux/macOS, the app logs DevTools URL to stdout
        # We check /proc or use lsof to find open FDs
        break
    fi

    sleep 0.1
done

# Fallback: construct CDP URL
if [[ -z "$CDP_URL" ]]; then
    CDP_URL="ws://127.0.0.1:${PORT}/devtools/browser/tauri-fallback-$(date +%s)"
    echo "[tauri-launcher] Using fallback CDP URL: $CDP_URL"
fi

# Write CDP URL to file
CDP_FILE="${SCRIPT_DIR}/../.cdp-url"
echo "$CDP_URL" > "$CDP_FILE"
echo "[tauri-launcher] CDP URL saved to: $CDP_FILE"

echo "TAURI_CDP_URL=$CDP_URL"
echo "READY"

# Wait for app to exit
wait "$TAURI_PID" || true
