#!/bin/sh
# Setzt Version und Service-Worker-Cachenamen gemeinsam. Beides muss sich
# aendern, sonst merkt weder die App noch der Service Worker, dass es
# etwas Neues gibt.
#
#   sh tools/release.sh 2026-09-14.1
set -e
if [ -z "$1" ]; then
  echo "Aufruf: sh tools/release.sh <version>"
  exit 1
fi
cd "$(dirname "$0")/.."
printf '{ "version": "%s", "hinweis": "Wird bei jedem Start geprueft. Aendert sich der Wert, laedt die App sich einmalig neu." }\n' "$1" > version.json
sed -i '' -E "s/const CACHE = .setlist-[^']*./const CACHE = 'setlist-$1'/" sw.js
echo "Version gesetzt: $1"
grep -m1 'const CACHE' sw.js
