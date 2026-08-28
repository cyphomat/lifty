#!/usr/bin/env python3
"""
Erzeugt die App-Icons: die Hantel in der Backline-Palette.

Bernstein auf fast Schwarz, wie die App. Kein Verlauf, kein Leuchten —
bei 128 px im Dock zaehlt nur die Silhouette.

Reines Python, keine Bibliotheken — der PNG-Schreiber steht unten.

    python3 tools/icon-gen.py
"""
import zlib, struct, pathlib

BG = (23, 22, 27, 255)        # --panel, hebt sich im Dock vom Schwarz ab
FG = (232, 162, 61, 255)      # --akzent

MITTE = 0.5
STANGE_H = 0.026
STANGE_VON, STANGE_BIS = 0.175, 0.825
SCHEIBEN = [                  # (von, bis, halbe Hoehe)
    (0.280, 0.358, 0.217), (0.642, 0.720, 0.217),
    (0.195, 0.260, 0.145), (0.740, 0.805, 0.145),
]


def farbe(nx, ny):
    dy = abs(ny - MITTE)
    if STANGE_VON <= nx <= STANGE_BIS and dy <= STANGE_H:
        return FG
    for x0, x1, h in SCHEIBEN:
        if x0 <= nx <= x1 and dy <= h:
            return FG
    return BG


def schreibe(pfad, groesse):
    zeilen = bytearray()
    for y in range(groesse):
        zeilen.append(0)
        ny = (y + 0.5) / groesse
        for x in range(groesse):
            zeilen += bytes(farbe((x + 0.5) / groesse, ny))
    roh = zlib.compress(bytes(zeilen), 9)

    def block(tag, daten):
        c = tag + daten
        return struct.pack('>I', len(daten)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    pathlib.Path(pfad).write_bytes(
        b'\x89PNG\r\n\x1a\n'
        + block(b'IHDR', struct.pack('>IIBBBBB', groesse, groesse, 8, 6, 0, 0, 0))
        + block(b'IDAT', roh) + block(b'IEND', b''))
    return pathlib.Path(pfad).stat().st_size


if __name__ == '__main__':
    wurzel = pathlib.Path(__file__).resolve().parent.parent
    for s in (1024, 512, 192, 180):
        n = schreibe(wurzel / 'icons' / f'icon-{s}.png', s)
        print(f'  icon-{s}.png{"":>4} {n:>7} Bytes')
