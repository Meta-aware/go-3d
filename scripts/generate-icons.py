#!/usr/bin/env python3
"""Generate simple Go PWA icons as PNG without external deps."""
from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)


def write_png(path: Path, w: int, h: int, rgba: bytes) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + rgba[y * w * 4 : (y + 1) * w * 4] for y in range(h))
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def clamp(v: float) -> int:
    return max(0, min(255, int(v)))


def draw_icon(size: int, maskable: bool = False) -> bytes:
    px = bytearray(size * size * 4)
    cx = cy = size / 2
    board_r = size * (0.38 if maskable else 0.42)
    for y in range(size):
        for x in range(size):
            i = (y * size + x) * 4
            dx = x - cx + 0.5
            dy = y - cy + 0.5
            dist = math.hypot(dx, dy)
            if maskable:
                r, g, b = 26, 20, 16
            else:
                t = dist / (size * 0.72)
                r = clamp(32 - t * 10)
                g = clamp(24 - t * 8)
                b = clamp(18 - t * 6)

            half = board_r
            if abs(dx) < half and abs(dy) < half:
                grain = 0.5 + 0.5 * math.sin((dy + math.sin(dx * 0.08) * 4) * 0.35)
                r = clamp(170 + grain * 40)
                g = clamp(120 + grain * 28)
                b = clamp(70 + grain * 14)
                local_x = (dx + half) / (2 * half)
                local_y = (dy + half) / (2 * half)
                gx = abs((local_x * 8) % 1 - 0.5)
                gy = abs((local_y * 8) % 1 - 0.5)
                if gx < 0.035 or gy < 0.035:
                    r, g, b = 40, 28, 16

            sx, sy = -size * 0.12, -size * 0.08
            sd = math.hypot(dx - sx, dy - sy)
            if sd < size * 0.14:
                shade = 1 - sd / (size * 0.14)
                hl = max(0, 1 - math.hypot(dx - sx + size * 0.04, dy - sy + size * 0.04) / (size * 0.08))
                v = 18 + shade * 30 + hl * 90
                r = g = b = clamp(v)

            sx2, sy2 = size * 0.12, size * 0.1
            sd2 = math.hypot(dx - sx2, dy - sy2)
            if sd2 < size * 0.14:
                shade = 1 - sd2 / (size * 0.14)
                hl = max(0, 1 - math.hypot(dx - sx2 + size * 0.04, dy - sy2 + size * 0.04) / (size * 0.08))
                v = 200 + shade * 30 + hl * 25
                r = g = b = clamp(v)
                g = clamp(v - 4)
                b = clamp(v - 10)

            alpha = 255
            if not maskable:
                corner = size * 0.18
                ax, ay = abs(dx), abs(dy)
                edge = size * 0.48
                if ax > edge - corner and ay > edge - corner:
                    cd = math.hypot(ax - (edge - corner), ay - (edge - corner))
                    if cd > corner:
                        alpha = 0
                elif ax > edge or ay > edge:
                    alpha = 0

            px[i : i + 4] = bytes((r, g, b, alpha))
    return bytes(px)


def main() -> None:
    for name, size, maskable in [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-512-maskable.png", 512, True),
        ("apple-touch-icon.png", 180, False),
    ]:
        write_png(OUT / name, size, size, draw_icon(size, maskable))
        print("wrote", name)

    (ROOT / "public" / "favicon.svg").write_text(
        """<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\">
  <rect width=\"64\" height=\"64\" rx=\"14\" fill=\"#1a1410\"/>
  <rect x=\"10\" y=\"10\" width=\"44\" height=\"44\" rx=\"4\" fill=\"#c4a36a\"/>
  <g stroke=\"#2a1c10\" stroke-width=\"1.2\">
    <path d=\"M18 18h28M18 26h28M18 32h28M18 38h28M18 46h28\"/>
    <path d=\"M18 18v28M26 18v28M32 18v28M38 18v28M46 18v28\"/>
  </g>
  <circle cx=\"26\" cy=\"28\" r=\"7\" fill=\"#151515\"/>
  <circle cx=\"40\" cy=\"38\" r=\"7\" fill=\"#f3efe6\"/>
</svg>
"""
    )
    print("wrote favicon.svg")


if __name__ == "__main__":
    main()
