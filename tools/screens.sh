#!/bin/sh
# Nimmt die Screenshots fuer das README auf.
#
#   python3 -m http.server 8765 &
#   sh tools/screens.sh
#
# Chrome laedt tools/shot.html, das die App mit Beispieldaten in einem
# Rahmen startet und bedient — echte Bildschirme, keine Mockups.
set -e
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT="${PORT:-8765}"
mkdir -p assets/screens

schuss () {
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --window-size=390,844 --force-device-scale-factor=2 \
    --virtual-time-budget=9000 \
    --screenshot="assets/screens/$1.png" \
    "http://localhost:$PORT/tools/shot.html?szene=$2&thema=$3" >/dev/null 2>&1
  echo "  $1.png"
}

schuss home-dunkel    home    dunkel
schuss session-dunkel session dunkel
schuss verlauf-dunkel verlauf dunkel
schuss rad-dunkel     rad     dunkel
schuss wod-dunkel     wod     dunkel
schuss warmup-dunkel  warmup  dunkel
schuss maxout-dunkel  maxout  dunkel
schuss home-hell      home    hell
schuss session-hell   session hell
