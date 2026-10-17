#!/bin/sh
set -eu
# System default applies unless a user already has a personal override.
if [ -z "${TYPO_MIME_CONFIG_DIR:-}" ]; then
  command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database /usr/share/applications || true
fi
config_dir=${TYPO_MIME_CONFIG_DIR:-/etc/xdg}
mkdir -p "$config_dir"
file="$config_dir/mimeapps.list"
tmp=$(mktemp "$config_dir/mimeapps.list.XXXXXX")
trap 'rm -f "$tmp"' EXIT
[ -f "$file" ] || touch "$file"
awk '
  function defaults() {
    print "text/markdown=Typo.desktop;" old["text/markdown"]
    print "text/x-markdown=Typo.desktop;" old["text/x-markdown"]
  }
  FNR==NR {
    if (/^\[/) section=($0=="[Default Applications]")
    if (section && /^text\/(x-)?markdown=/) {
      split($0, pair, "="); value=substr($0, length(pair[1])+2)
      gsub(/Typo\.desktop;/, "", value); old[pair[1]]=value
    }
    next
  }
  /^\[/ {
    section=($0=="[Default Applications]")
    if(section) { found=1; print; defaults(); next }
  }
  section && /^text\/(x-)?markdown=/ { next }
  { print }
  END { if(!found) { print "[Default Applications]"; defaults() } }
' "$file" "$file" > "$tmp"
chmod 644 "$tmp"
mv "$tmp" "$file"
