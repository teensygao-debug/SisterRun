from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
REFS = ASSETS / "player" / "player" / "rotations"
FRAME = 64
BASELINE = 60

COLORS = {
    "outline": (23, 18, 22, 255),
    "skin": (245, 171, 104, 255),
    "skin_shadow": (178, 86, 53, 255),
    "white": (242, 246, 235, 255),
    "white_shadow": (170, 190, 190, 255),
    "green": (54, 103, 45, 255),
    "green_hi": (88, 145, 67, 255),
    "red": (196, 39, 43, 255),
    "red_hi": (246, 75, 54, 255),
    "gold": (255, 214, 43, 255),
    "orange": (244, 119, 30, 255),
    "pink": (255, 88, 176, 255),
    "cyan": (122, 230, 235, 255),
    "smoke_dark": (52, 59, 65, 190),
    "smoke_mid": (113, 124, 131, 150),
    "smoke_light": (214, 223, 221, 105),
}


def remove_black_background(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    pix = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            if a == 0 or (r <= 2 and g <= 2 and b <= 2):
                pix[x, y] = (0, 0, 0, 0)
    return im


def content_bbox(im: Image.Image):
    alpha = im.getchannel("A")
    return alpha.getbbox()


def load_refs() -> dict[str, Image.Image]:
    refs = {}
    for path in REFS.glob("*.png"):
        refs[path.stem] = remove_black_background(Image.open(path))
    missing = {"east", "north-east", "north-west", "north", "south-east", "south-west", "south", "west"} - set(refs)
    if missing:
        raise FileNotFoundError(f"missing player reference images: {sorted(missing)}")
    return refs


REF_IMAGES = load_refs()
REF_BBOXES = {name: content_bbox(img) for name, img in REF_IMAGES.items()}
MAX_W = max(box[2] - box[0] for box in REF_BBOXES.values() if box)
MAX_H = max(box[3] - box[1] for box in REF_BBOXES.values() if box)
REF_SCALE = min(52 / MAX_W, 57 / MAX_H)


def normalize_ref(name: str, *, mirror: bool = False, dx: int = 0, dy: int = 0, scale_mul: float = 1.0) -> Image.Image:
    source = REF_IMAGES[name]
    if mirror:
        source = ImageOps.mirror(source)
    box = content_bbox(source)
    if not box:
        return Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    crop = source.crop(box)
    scale = REF_SCALE * scale_mul
    size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
    crop = crop.resize(size, Image.Resampling.NEAREST)
    out = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    x = (FRAME - crop.width) // 2 + dx
    y = BASELINE - crop.height + dy
    out.alpha_composite(crop, (x, y))
    return out


def alpha_outline(im: Image.Image, color=COLORS["outline"], radius=1) -> Image.Image:
    alpha = im.getchannel("A")
    grown = alpha.filter(ImageFilter.MaxFilter(radius * 2 + 1))
    border = ImageChops.subtract(grown, alpha)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(Image.new("RGBA", im.size, color), mask=border)
    out.alpha_composite(im)
    return out


def tint_character(im: Image.Image, mode: str) -> Image.Image:
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    src = im.load()
    dst = out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = src[x, y]
            if not a:
                continue
            nr, ng, nb = r, g, b
            is_hair = r > 95 and g < 90 and b < 85
            is_shirt = r > 175 and g > 175 and b > 160
            is_green = g > r + 10 and g > b + 5 and g > 55
            if mode == "smoker":
                if is_hair:
                    nr, ng, nb = (38, 31, 32) if r < 170 else (74, 54, 44)
                elif is_shirt:
                    nr, ng, nb = (76, 82, 88)
                elif is_green:
                    nr, ng, nb = (42, 48, 55)
            elif mode == "harasser":
                if is_hair:
                    nr, ng, nb = (42, 29, 22) if r < 170 else (89, 58, 36)
                elif is_shirt:
                    nr, ng, nb = (225, 230, 222)
                elif is_green:
                    nr, ng, nb = (36, 56, 70)
            elif mode == "drunk":
                if is_hair:
                    nr, ng, nb = (70, 38, 25) if r < 170 else (136, 78, 39)
                elif is_shirt:
                    nr, ng, nb = (126, 68, 39)
                elif is_green:
                    nr, ng, nb = (60, 74, 54)
            dst[x, y] = (nr, ng, nb, a)
    return out


def draw_pad(draw: ImageDraw.ImageDraw, cx: int, cy: int, frame: int = 0, scale: int = 1):
    wobble = [0, 1, 2, 1, 0, -1, -2, -1][frame % 8]
    w = 14 - abs(wobble) * 2
    h = 7 + abs(wobble) * 2
    draw.ellipse((cx - w, cy - h, cx + w, cy + h), fill=COLORS["outline"])
    draw.ellipse((cx - w + 2, cy - h + 2, cx + w - 2, cy + h - 2), fill=(255, 226, 250, 255))
    draw.ellipse((cx - 6, cy - 3, cx + 6, cy + 3), fill=(255, 255, 252, 255))
    draw.line((cx - w - 5, cy, cx - w, cy), fill=COLORS["pink"])
    draw.line((cx + w, cy, cx + w + 5, cy), fill=COLORS["pink"])


def add_fearless(im: Image.Image, frame: int) -> Image.Image:
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    d.ellipse((16, 3, 49, 63), fill=(255, 208, 35, 42))
    for i in range(4):
        x = 7 + i * 5 - frame % 3
        d.line((x, 16 + i * 8, x + 18, 10 + i * 8), fill=(255, 215, 43, 95), width=2)
    out.alpha_composite(alpha_outline(im, (255, 209, 38, 170), 1))
    return out


def player_frame(state: str, idx: int, total: int) -> Image.Image:
    if state == "idle":
        return normalize_ref("south-west", dy=-idx)
    if state == "run":
        seq = [
            ("south-east", False, -1, 0),
            ("south", False, 0, -1),
            ("north", False, 1, -2),
            ("east", False, 0, -1),
            ("south-east", False, 1, 0),
            ("south", False, 0, -1),
            ("north-west", True, -1, -2),
            ("west", True, 0, -1),
        ]
        name, mir, dx, dy = seq[idx % len(seq)]
        return normalize_ref(name, mirror=mir, dx=dx, dy=dy)
    if state == "jump":
        seq = [("north-west", True, 1, -9), ("south", False, 1, -12)]
        name, mir, dx, dy = seq[idx % 2]
        return normalize_ref(name, mirror=mir, dx=dx, dy=dy)
    if state == "fall":
        seq = [("east", False, 0, -7), ("north", False, -1, -4)]
        name, mir, dx, dy = seq[idx % 2]
        return normalize_ref(name, mirror=mir, dx=dx, dy=dy)
    if state == "throw":
        base = normalize_ref(["south-east", "south", "south", "south-east"][idx % 4], dx=-1, dy=-1)
        d = ImageDraw.Draw(base)
        draw_pad(d, 45 + idx * 4, 36 - idx, idx)
        d.line((38, 36, 45 + idx * 4, 36 - idx), fill=COLORS["pink"], width=1)
        return base
    if state == "charge":
        base = normalize_ref("south", dx=-1, dy=-1)
        d = ImageDraw.Draw(base)
        for k in range(idx + 1):
            draw_pad(d, 45 + k * 3, 44 - k * 3, k)
            d.line((42, 41, 51 + k * 3, 43 - k * 3), fill=COLORS["gold"], width=1)
        return base
    if state == "dash":
        base = normalize_ref(["south", "south-east", "north", "south"][idx % 4], dx=4, dy=-2)
        out = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
        d = ImageDraw.Draw(out)
        for k in range(5):
            y = 13 + k * 9
            d.line((0, y, 25, y - 4), fill=COLORS["pink"] if k % 2 else COLORS["cyan"], width=2)
        ghost = Image.new("RGBA", base.size, (0, 0, 0, 0))
        ghost.alpha_composite(base)
        a = ghost.getchannel("A").point(lambda v: v // 4)
        ghost.putalpha(a)
        out.alpha_composite(ghost, (-8, 0))
        out.alpha_composite(base)
        return out
    if state == "hurt":
        return normalize_ref(["east", "north-east"][idx % 2], dx=-2 - idx * 2, dy=-1)
    if state == "fearless_idle":
        return add_fearless(normalize_ref("south-west", dy=-idx), idx)
    if state == "fearless_run":
        return add_fearless(player_frame("run", idx, total), idx)
    if state == "victory":
        base = normalize_ref("south-west", dy=[0, -2, -1, 0][idx % 4])
        d = ImageDraw.Draw(base)
        for k in range(4):
            star(d, 12 + k * 11, 12 + ((idx + k) % 2) * 8, COLORS["gold"])
        return base
    raise ValueError(state)


def star(d: ImageDraw.ImageDraw, x: int, y: int, fill):
    pts = [(x, y - 5), (x + 2, y - 1), (x + 6, y), (x + 2, y + 2), (x, y + 6), (x - 2, y + 2), (x - 6, y), (x - 2, y - 1)]
    d.polygon(pts, fill=COLORS["outline"])
    pts2 = [(x, y - 4), (x + 1, y - 1), (x + 5, y), (x + 1, y + 1), (x, y + 5), (x - 1, y + 1), (x - 5, y), (x - 1, y - 1)]
    d.polygon(pts2, fill=fill)


def smoke_cloud(d: ImageDraw.ImageDraw, frame: int, start=(36, 31), count=5):
    for k in range(count):
        x = start[0] + k * 6 + (frame + k) % 3
        y = start[1] - k * 2 - frame % 2
        c = [COLORS["smoke_dark"], COLORS["smoke_mid"], COLORS["smoke_light"]][k % 3]
        d.ellipse((x - 6, y - 5, x + 8, y + 7), fill=c)


def obstacle_frame(kind: str, state: str, idx: int, total: int) -> Image.Image:
    out = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    if kind == "smoke":
        if state == "smoke_loop":
            smoke_cloud(d, idx, (15, 42), 7)
            return out
        body = tint_character(normalize_ref("south-west" if idx % 2 == 0 else "east", dx=-6, dy=-1), "smoker")
        out.alpha_composite(body)
        d.rectangle((41, 34, 50, 36), fill=COLORS["outline"])
        d.rectangle((42, 34, 49, 35), fill=(238, 226, 178, 255))
        d.point((50, 34), fill=COLORS["orange"])
        smoke_cloud(d, idx, (45, 31), 4 if state == "exhale" else 2)
        return out
    if kind == "harasser":
        body = tint_character(normalize_ref("south-east", dx=-5 + (idx if state == "knockback" else 0), dy=-1 - (idx if state == "knockback" else 0)), "harasser")
        if state == "knockback":
            for k in range(3):
                d.line((8 + k * 5, 45 - k * 6, 23 + k * 4, 38 - k * 6), fill=COLORS["gold"], width=2)
                star(d, 18 + k * 9, 17 + k * 5, COLORS["pink"] if k % 2 else COLORS["gold"])
        out.alpha_composite(body)
        if state == "reach":
            reach = idx * 4
            d.line((38, 35, 49 + reach, 35, 55 + reach, 38), fill=COLORS["outline"], width=4)
            d.line((38, 35, 49 + reach, 35, 55 + reach, 38), fill=COLORS["skin"], width=2)
        return out
    if kind == "drunk_man":
        ref = "west" if idx % 2 else "south-west"
        body = tint_character(normalize_ref(ref, mirror=(ref == "west"), dx=(-3 + (idx * 3 if state == "tumble" else (-2 if idx % 2 else 2))), dy=-1 - (idx if state == "tumble" else 0)), "drunk")
        if state == "tumble":
            for k in range(5):
                star(d, 10 + k * 9, 19 + (k % 2) * 7, COLORS["gold"])
        out.alpha_composite(body)
        d.rectangle((45, 37, 51, 48), fill=COLORS["outline"])
        d.rectangle((46, 38, 50, 47), fill=(44, 142, 67, 255))
        d.rectangle((47, 35, 49, 38), fill=COLORS["outline"])
        return out
    raise ValueError(kind)


def pixel_text(d: ImageDraw.ImageDraw, x: int, y: int, text: str, fill):
    glyphs = {
        "B": ["1110", "1001", "1110", "1001", "1110"],
        "O": ["0110", "1001", "1001", "1001", "0110"],
        "M": ["10001", "11011", "10101", "10001", "10001"],
        "A": ["0110", "1001", "1111", "1001", "1001"],
        "N": ["1001", "1101", "1011", "1001", "1001"],
        "G": ["0111", "1000", "1011", "1001", "0111"],
        "K": ["1001", "1010", "1100", "1010", "1001"],
        "P": ["1110", "1001", "1110", "1000", "1000"],
        "C": ["0111", "1000", "1000", "1000", "0111"],
    }
    cx = x
    for ch in text:
        pat = glyphs.get(ch, ["0"])
        for yy, row in enumerate(pat):
            for xx, bit in enumerate(row):
                if bit == "1":
                    d.rectangle((cx + xx * 2, y + yy * 2, cx + xx * 2 + 1, y + yy * 2 + 1), fill=fill)
        cx += len(pat[0]) * 2 + 2


def fx_frame(kind: str, idx: int, total: int) -> Image.Image:
    out = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    cx, cy = 32, 32
    if kind in {"boom", "bang", "ko", "comic_pop"}:
        r = 12 + idx * 3
        pts = []
        for n in range(20):
            a = math.tau * n / 20
            rr = r + (8 if n % 2 == 0 else -4)
            pts.append((round(cx + math.cos(a) * rr), round(cy + math.sin(a) * rr)))
        d.polygon(pts, fill=COLORS["outline"])
        inner = [(round(cx + (x - cx) * 0.88), round(cy + (y - cy) * 0.88)) for x, y in pts]
        d.polygon(inner, fill=COLORS["gold"] if kind != "ko" else COLORS["pink"])
        flash = [(round(cx + (x - cx) * 0.55), round(cy + (y - cy) * 0.55)) for x, y in pts]
        d.polygon(flash, fill=(255, 245, 220, 255))
        text = {"boom": "BOOM", "bang": "BANG", "ko": "KO", "comic_pop": "POP"}[kind]
        tx = 8 if len(text) >= 4 else 21
        pixel_text(d, tx + 1, 27 + 1, text, COLORS["outline"])
        pixel_text(d, tx, 27, text, COLORS["red"] if kind != "ko" else COLORS["outline"])
    elif kind == "spark":
        for n in range(14):
            a = math.tau * n / 14
            d.line((cx, cy, cx + math.cos(a) * (10 + idx * 4), cy + math.sin(a) * (10 + idx * 4)), fill=COLORS["orange"] if n % 2 else COLORS["gold"], width=2)
        d.ellipse((cx - 4, cy - 4, cx + 4, cy + 4), fill=(255, 255, 240, 245))
    elif kind == "speed_line":
        for k in range(8):
            y = 8 + k * 7 + idx % 3
            d.line((0, y, 50 - k, y - 4), fill=COLORS["pink"] if k % 2 else COLORS["cyan"], width=2)
            d.line((18, y + 3, 64, y), fill=COLORS["gold"], width=1)
    elif kind == "fearless_glow":
        d.ellipse((16 - idx, 3 - idx, 49 + idx, 64 + idx), fill=(255, 210, 38, max(40, 150 - idx * 16)))
        for k in range(6):
            star(d, 15 + k * 7, 16 + (k % 3) * 11, COLORS["gold"])
    elif kind == "star_hit":
        for k in range(6):
            star(d, 15 + k * 7, 19 + ((idx + k) % 3) * 8, COLORS["gold"] if k % 2 else COLORS["pink"])
    elif kind in {"dust", "landing_dust"}:
        for k in range(7):
            x = 10 + k * 8
            y = 49 - idx + (k % 2) * 2
            d.ellipse((x - 5 - idx, y - 3, x + 6 + idx, y + 4), fill=(220, 198, 145, max(35, 175 - idx * 20)))
    return out


def item_frame(kind: str, idx: int, total: int) -> Image.Image:
    out = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    if kind == "pad":
        draw_pad(d, 32, 32, idx)
    elif kind == "heart":
        fill = COLORS["pink"] if idx == 0 else (62, 55, 65, 255)
        pts = [(32, 48), (16, 32), (18, 22), (27, 20), (32, 26), (37, 20), (46, 22), (48, 32)]
        d.polygon(pts, fill=COLORS["outline"])
        d.polygon([(32, 45), (19, 31), (21, 24), (27, 23), (32, 30), (37, 23), (43, 24), (45, 31)], fill=fill)
    elif kind in {"courage_bar", "fearless_bar"}:
        d.rectangle((8, 25, 56, 38), fill=COLORS["outline"])
        d.rectangle((10, 27, 54, 36), fill=(37, 32, 38, 255))
        fill = COLORS["gold"] if kind == "fearless_bar" else COLORS["green_hi"]
        d.rectangle((11, 28, 11 + idx * 11 + 9, 35), fill=fill)
    return out


def make_sheet(path: Path, frames: list[Image.Image]):
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet = Image.new("RGBA", (FRAME * len(frames), FRAME), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.alpha_composite(frame, (i * FRAME, 0))
    sheet.save(path)


def generate():
    player_counts = {
        "idle": 2,
        "run": 8,
        "jump": 2,
        "fall": 2,
        "throw": 4,
        "charge": 4,
        "dash": 4,
        "hurt": 2,
        "fearless_idle": 2,
        "fearless_run": 8,
        "victory": 4,
    }
    for state, count in player_counts.items():
        make_sheet(ASSETS / "sprites/player" / f"player_{state}.png", [player_frame(state, i, count) for i in range(count)])

    obstacle_counts = {
        "smoke": {"idle": 4, "exhale": 4, "smoke_loop": 6},
        "harasser": {"idle": 4, "reach": 4, "knockback": 6},
        "drunk_man": {"sway": 6, "tumble": 8},
    }
    for kind, states in obstacle_counts.items():
        for state, count in states.items():
            make_sheet(ASSETS / "sprites/obstacles" / f"obstacle_{kind}_{state}.png", [obstacle_frame(kind, state, i, count) for i in range(count)])

    for kind in ["boom", "bang", "ko", "spark", "speed_line", "fearless_glow", "comic_pop", "star_hit", "dust", "landing_dust"]:
        make_sheet(ASSETS / "fx" / f"fx_{kind}.png", [fx_frame(kind, i, 6) for i in range(6)])

    make_sheet(ASSETS / "sprites/items" / "item_pad_spin.png", [item_frame("pad", i, 8) for i in range(8)])
    make_sheet(ASSETS / "sprites/items" / "item_heart.png", [item_frame("heart", i, 2) for i in range(2)])
    make_sheet(ASSETS / "sprites/items" / "ui_courage_bar.png", [item_frame("courage_bar", i, 4) for i in range(4)])
    make_sheet(ASSETS / "sprites/items" / "ui_fearless_bar.png", [item_frame("fearless_bar", i, 4) for i in range(4)])

    manifest_path = ASSETS / "assets.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["rules"]["generatedFrom"] = "assets/player/player/rotations/*.png"
    manifest["rules"]["referenceLocked"] = True
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    generate()
