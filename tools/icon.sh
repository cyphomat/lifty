#!/bin/sh
# Macht aus einem Bild alle App-Icons.
#
#   sh tools/icon.sh ~/Downloads/ork.png            # ganzes Bild
#   sh tools/icon.sh ~/Downloads/ork.png kopf       # oberer Bildteil, quadratisch
#
# Nutzt sips, das in macOS steckt — keine Installation noetig.
# Kleine Icons verlieren Details: bei einem vollen Bildmotiv lohnt sich
# fast immer der Ausschnitt auf das Gesicht.
set -e
[ -z "$1" ] && { echo "Aufruf: sh tools/icon.sh <bilddatei> [kopf]"; exit 1; }
[ -f "$1" ] || { echo "Datei nicht gefunden: $1"; exit 1; }
cd "$(dirname "$0")/.."
QUELLE="$1"
MODUS="${2:-voll}"
TMP=$(mktemp -d)

B=$(sips -g pixelWidth  "$QUELLE" | awk '/pixelWidth/{print $2}')
H=$(sips -g pixelHeight "$QUELLE" | awk '/pixelHeight/{print $2}')
echo "Quelle: ${B}x${H}, Modus: $MODUS"

if [ "$MODUS" = "kopf" ]; then
  # Oberer Bildteil, quadratisch — dort sitzt bei Portraets das Gesicht.
  KANTE=$(awk -v b="$B" -v h="$H" 'BEGIN{k=(b<h?b:h)*0.66; printf "%d", k}')
  sips -c "$KANTE" "$KANTE" --cropOffset 0 0 "$QUELLE" --out "$TMP/quadrat.png" >/dev/null 2>&1 \
    || sips -c "$KANTE" "$KANTE" "$QUELLE" --out "$TMP/quadrat.png" >/dev/null
else
  KANTE=$(awk -v b="$B" -v h="$H" 'BEGIN{print (b<h?b:h)}')
  sips -c "$KANTE" "$KANTE" "$QUELLE" --out "$TMP/quadrat.png" >/dev/null
fi

for S in 1024 512 192 180; do
  sips -z "$S" "$S" "$TMP/quadrat.png" --out "icons/icon-$S.png" >/dev/null
  printf "  icon-%s.png  %s\n" "$S" "$(du -h "icons/icon-$S.png" | cut -f1)"
done
rm -rf "$TMP"
echo
echo "Fertig. Danach:  sh tools/release.sh <version> && git add -A && git commit && git push"
