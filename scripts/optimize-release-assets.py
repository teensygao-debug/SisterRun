#!/usr/bin/env python3
"""Generate compact transparent runtime art while preserving source artwork."""

from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

SPECS = {
    "items/pad.png": ("release/items/pad.png", (256, 256)),
    "items/heart_full.png": ("release/items/heart.png", (128, 128)),
    "fx/stars_01.png": ("release/fx/stars.png", (256, 256)),
    "fx/speedline.png": ("release/fx/speedline.png", (512, 171)),
    "fx/boom_01.png": ("release/fx/boom.png", (384, 288)),
    "fx/bang.png": ("release/fx/bang.png", (384, 288)),
    "fx/ko.png": ("release/fx/ko.png", (384, 288)),
    "fx/dust.png": ("release/fx/dust.png", (384, 288)),
}


def edge_background_to_alpha(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def is_background(x: int, y: int) -> bool:
        red, green, blue, alpha = pixels[x, y]
        return alpha == 0 or (max(red, green, blue) > 226 and max(red, green, blue) - min(red, green, blue) < 34)

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if not visited[index] and is_background(x, y):
            visited[index] = 1
            queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        red, green, blue, _ = pixels[x, y]
        pixels[x, y] = (red, green, blue, 0)
        if x > 0:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y > 0:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    return rgba


def main() -> None:
    for source_name, (target_name, size) in SPECS.items():
        source = ASSETS / source_name
        target = ASSETS / target_name
        target.parent.mkdir(parents=True, exist_ok=True)
        image = edge_background_to_alpha(Image.open(source))
        image = image.resize(size, Image.Resampling.LANCZOS)
        image.save(target, format="PNG", optimize=True)
        print(f"{source_name} -> {target_name} ({size[0]}x{size[1]})")


if __name__ == "__main__":
    main()
