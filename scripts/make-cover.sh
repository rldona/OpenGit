#!/usr/bin/env bash
# Regenerates assets/cover.png (the repository cover / GitHub social preview, 1280x640)
# from assets/cover.html, which lays out the logo, name and assets/opengit-screenshot.png.
#
#   scripts/make-cover.sh
#
# Needs Google Chrome (or set CHROME to any Chromium binary).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

"$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1280,640 --screenshot="$root/assets/cover.png" "file://$root/assets/cover.html"
echo "wrote assets/cover.png"
