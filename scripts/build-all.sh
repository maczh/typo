#!/usr/bin/env bash
#
# build-all.sh — Build every supported OS/arch combination for the Typo app.
#
# Iterates the full matrix (win/mac/linux x amd64/arm64) and invokes build.sh for
# each. Targets that cannot be built on this host are skipped with a clear reason
# (macOS requires a Mac; other cross-OS builds require --allow-cross).
#
# Usage:
#   ./scripts/build-all.sh [--allow-cross]
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="$(rustc -vV 2>/dev/null | sed -n 's/^host: //p')"
HOST_OS="$(case "$HOST" in *-windows-*) echo win;; *-apple-*) echo mac;; *-linux-*) echo linux;; *) echo unknown;; esac)"

ALLOW_CROSS=0
[[ "${1:-}" == "--allow-cross" ]] && ALLOW_CROSS=1

MATRIX=(win:amd64 win:arm64 mac:amd64 mac:arm64 linux:amd64 linux:arm64)

PASS=()
FAIL=()
SKIP=()

for combo in "${MATRIX[@]}"; do
  os="${combo%%:*}"; arch="${combo##*:}"
  echo "==================== $os/$arch ===================="
  if [[ "$os" == "mac" && "$HOST_OS" != "mac" ]]; then
    echo "SKIP: macOS targets require a Mac host."
    SKIP+=("$combo"); continue
  fi
  if [[ "$ALLOW_CROSS" == 0 && "$os" != "$HOST_OS" ]]; then
    echo "SKIP: cross-OS build ($os) without --allow-cross."
    SKIP+=("$combo"); continue
  fi
  if "$SCRIPT_DIR/build.sh" --os "$os" --arch "$arch" ${ALLOW_CROSS:+"--allow-cross"}; then
    PASS+=("$combo")
  else
    echo "FAILED: $combo"
    FAIL+=("$combo")
  fi
done

echo
echo "==================== summary ===================="
echo "passed: ${PASS[*]:-none}"
echo "failed: ${FAIL[*]:-none}"
echo "skipped: ${SKIP[*]:-none}"
[[ ${#FAIL[@]} -eq 0 ]]
