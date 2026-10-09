#!/usr/bin/env bash
#
# build.sh — Cross-platform build script for the Typo Tauri v2 desktop app.
#
# Maps a chosen OS + CPU architecture to the matching Rust target triple and runs
# `cargo tauri build` (via the project's local @tauri-apps/cli). The frontend is
# built automatically by Tauri's `beforeBuildCommand` (npm run build).
#
# Usage:
#   ./scripts/build.sh [--os <win|mac|linux>] [--arch <amd64|arm64>]
#                      [--debug] [--bundles <csv>] [--allow-cross] [--help]
#
# Defaults: auto-detect the host OS/arch and build natively.
#
# Cross-compilation caveats (important!):
#   * macOS targets (x86_64/aarch64-apple-darwin) require the macOS SDK and can
#     ONLY be built on macOS. Cross-building to macOS from Linux/Windows is NOT
#     supported here (would need osxcross + a macOS SDK).
#   * Windows targets from Linux require the MinGW-w64 toolchain (for the `-gnu`
#     target) or MSVC (for `-msvc`, Windows host only).
#   * Linux arm64 (aarch64-unknown-linux-gnu) from Linux x64 requires the aarch64
#     cross toolchain plus aarch64 webkit2gtk dev packages.
#   Pass --allow-cross to attempt a cross build anyway (best-effort).
#
set -euo pipefail

# Ensure the Cargo/Rust toolchain is reachable (rustup default install dir may not
# be exported by a non-login shell). Safe no-op if already on PATH.
for d in "$HOME/.cargo/bin" "/usr/local/cargo/bin" "/root/.cargo/bin"; do
  if [[ -d "$d" ]] && [[ ":$PATH:" != *":$d:"* ]]; then
    PATH="$d:$PATH"
  fi
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

OS=""
ARCH=""
PROFILE="--release"
BUNDLES=""
ALLOW_CROSS=0

usage() {
  grep '^#' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --os)        OS="$2"; shift 2 ;;
    --arch)      ARCH="$2"; shift 2 ;;
    --debug)     PROFILE=""; shift ;;
    --bundles)   BUNDLES="$2"; shift 2 ;;
    --allow-cross) ALLOW_CROSS=1; shift ;;
    --help|-h)   usage 0 ;;
    *) echo "Unknown argument: $1" >&2; usage 1 ;;
  esac
done

host_triple() { rustc -vV 2>/dev/null | sed -n 's/^host: //p'; }

detect_os() {
  case "$1" in
    *-windows-*) echo win ;;
    *-apple-*)   echo mac ;;
    *-linux-*)   echo linux ;;
    *) echo unknown ;;
  esac
}

detect_arch() {
  case "$1" in
    x86_64-*)        echo amd64 ;;
    aarch64-*|arm64-*) echo arm64 ;;
    *) echo unknown ;;
  esac
}

HOST="$(host_triple)"
[[ -z "$HOST" ]] && { echo "error: rustc not found; install the Rust toolchain first." >&2; exit 1; }

HOST_OS="$(detect_os "$HOST")"
HOST_ARCH="$(detect_arch "$HOST")"

OS="${OS:-$HOST_OS}"
ARCH="${ARCH:-$HOST_ARCH}"

triple_for() {
  case "$1-$2" in
    win-amd64)   echo "x86_64-pc-windows-msvc" ;;
    win-arm64)   echo "aarch64-pc-windows-msvc" ;;
    mac-amd64)   echo "x86_64-apple-darwin" ;;
    mac-arm64)   echo "aarch64-apple-darwin" ;;
    linux-amd64) echo "x86_64-unknown-linux-gnu" ;;
    linux-arm64) echo "aarch64-unknown-linux-gnu" ;;
    *) echo "" ;;
  esac
}

TARGET="$(triple_for "$OS" "$ARCH")"
[[ -z "$TARGET" ]] && { echo "error: unsupported OS/arch combination: $OS/$ARCH" >&2; exit 1; }

echo "Host:    $HOST ($HOST_OS/$HOST_ARCH)"
echo "Target:  $TARGET ($OS/$ARCH)"

if [[ "$TARGET" != "$HOST" ]]; then
  echo
  echo "NOTE: cross-compilation requested."
  if [[ "$OS" == "mac" ]]; then
    echo "error: macOS targets can only be built on macOS (require the macOS SDK)." >&2
    echo "       Build macOS artifacts on a Mac instead." >&2
    [[ "$ALLOW_CROSS" == 1 ]] || exit 1
  fi
  if [[ "$OS" == "win" && "$HOST_OS" != "win" ]]; then
    echo "warning: building Windows from $HOST_OS requires MinGW-w64 (for -gnu) or MSVC (Windows host)."
    [[ "$ALLOW_CROSS" == 1 ]] || { echo "error: pass --allow-cross to attempt." >&2; exit 1; }
  fi
  echo "Attempting cross build (best-effort)..."
fi

if command -v rustup >/dev/null 2>&1; then
  if ! rustup target list --installed 2>/dev/null | grep -qx "$TARGET"; then
    echo "Installing Rust target: $TARGET"
    rustup target add "$TARGET"
  fi
else
  echo "warning: rustup not found; assuming target $TARGET is already installed."
fi

CMD=(npm run tauri -- build --target "$TARGET")
[[ -n "$PROFILE" ]] && CMD+=("$PROFILE")
[[ -n "$BUNDLES" ]] && CMD+=(--bundles "$BUNDLES")

echo
echo "Running: ${CMD[*]}"
echo

"${CMD[@]}"

OUT="${PROFILE:+release}${PROFILE:-debug}"
echo
echo "Build finished. Artifacts are in: src-tauri/target/$TARGET/$OUT/"
