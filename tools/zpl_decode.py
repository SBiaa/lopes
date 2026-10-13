"""Decodifica um arquivo ZPL de etiquetas (gráfico ~DGR com Z64) em PNGs, um por etiqueta.

Uso: python zpl_decode.py <arquivo.txt> <pasta_saida>
"""
import base64
import re
import sys
import zlib
from pathlib import Path

from PIL import Image, ImageOps

PATTERN = re.compile(r"~DG[RE]:[^,]+,(\d+),(\d+),:Z64:([A-Za-z0-9+/=]+):([0-9A-Fa-f]{4})")


def decode_line(line):
    m = PATTERN.match(line)
    if not m:
        return None
    total, bytes_per_row, b64 = int(m[1]), int(m[2]), m[3]
    data = zlib.decompress(base64.b64decode(b64))
    if len(data) >= total and not data[:64].isalnum():
        raw = data[:total]  # bytes brutos (formato visto nas etiquetas da Shopee)
    else:
        hex_text = "".join(data.decode("ascii").split())
        raw = bytes.fromhex(hex_text[: total * 2])
    width, height = bytes_per_row * 8, len(raw) // bytes_per_row
    img = Image.frombytes("1", (width, height), raw)
    # ZPL: bit 1 = ponto preto
    return ImageOps.invert(img.convert("L")).convert("1")


def main():
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    for i, line in enumerate(src.read_text(encoding="latin-1").splitlines(), 1):
        img = decode_line(line)
        if img is None:
            print(f"linha {i}: sem gráfico reconhecido")
            continue
        img.save(out / f"p{i:02d}.png")
        if i <= 2:
            print(f"linha {i}: {img.size[0]}x{img.size[1]} px")


if __name__ == "__main__":
    main()
