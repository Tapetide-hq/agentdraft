#!/usr/bin/env bash
# Regenerate every brand icon from the two SVG sources of truth.
#
#   dashboard/static/favicon.svg  -> tab icon; geometry is pixel-aligned for 16px
#   dashboard/static/icon.svg     -> app/maskable icon; artwork inset for OS cropping
#
# Everything else in dashboard/static/ and content-worker/src/icons.ts is DERIVED.
# Never hand-edit a derived file: run this instead, then commit the result.
#
# Requires: rsvg-convert (librsvg), ImageMagick `convert`, python3 (+Pillow for verify).
set -euo pipefail

cd "$(dirname "$0")/.."
STATIC="dashboard/static"
BG="#0a0a0a"   # must match --bg in dashboard/src/lib/styles.css

command -v rsvg-convert >/dev/null || { echo "need rsvg-convert (apt install librsvg2-bin)"; exit 1; }
command -v convert      >/dev/null || { echo "need ImageMagick convert"; exit 1; }

echo "==> PNG app icons (opaque: iOS composites a transparent icon onto WHITE)"
rsvg-convert -w 180 -h 180 -b "$BG" "$STATIC/icon.svg" -o "$STATIC/apple-touch-icon.png"
rsvg-convert -w 192 -h 192 -b "$BG" "$STATIC/icon.svg" -o "$STATIC/icon-192.png"
rsvg-convert -w 512 -h 512 -b "$BG" "$STATIC/icon.svg" -o "$STATIC/icon-512.png"

echo "==> multi-resolution favicon.ico (16/32/48)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
for s in 16 32 48; do rsvg-convert -w $s -h $s "$STATIC/favicon.svg" -o "$tmp/i-$s.png"; done
convert "$tmp/i-16.png" "$tmp/i-32.png" "$tmp/i-48.png" "$STATIC/favicon.ico"

echo "==> README/docs logo (transparent corners so it reads on GitHub light AND dark)"
mkdir -p docs/assets
rsvg-convert -w 120 -h 120 "$STATIC/logo-readme.svg" -o docs/assets/logo.png

echo "==> content-worker embedded icons (16/32 only — keeps the worker bundle small)"
for s in 16 32; do rsvg-convert -w $s -h $s "$STATIC/favicon.svg" -o "$tmp/c-$s.png"; done
convert "$tmp/c-16.png" "$tmp/c-32.png" "$tmp/content.ico"
python3 scripts/gen_content_icons.py "$tmp/content.ico" "$STATIC/favicon.svg" \
  content-worker/src/icons.ts

chmod 644 "$STATIC"/favicon.svg "$STATIC"/icon.svg "$STATIC"/*.png "$STATIC"/favicon.ico

echo "==> verify"
python3 scripts/verify_icons.py
echo "OK"
