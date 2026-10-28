#!/bin/sh
set -eu
config_dir=${TYPO_MIME_CONFIG_DIR:-/etc/xdg}
file="$config_dir/mimeapps.list"
if [ -f "$file" ]; then
  tmp=$(mktemp "$config_dir/mimeapps.list.XXXXXX")
  trap 'rm -f "$tmp"' EXIT
  awk '
    /^\[/ { section=($0=="[Default Applications]") }
    section && /^text\/(x-)?markdown=/ {
      gsub(/Typo\.desktop;/, "")
      # postinstall creates this entry when it did not previously exist.
      # Remove the now-empty synthetic entry so uninstall restores the file.
      if ($0 == "text/x-markdown=") next
      if ($0 ~ /=$/) next
    }
    { print }
  ' "$file" > "$tmp"
  chmod 644 "$tmp"
  mv "$tmp" "$file"
fi
if [ -z "${TYPO_MIME_CONFIG_DIR:-}" ]; then
  command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database /usr/share/applications || true
fi
