from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Callable, Iterable

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
FRAME = 64
BASELINE = 58

Palette = dict[str, tuple[int, int, int, int]]

P: Palette = {
    "outline": (28, 22, 28, 255),
    "deep": (45, 32, 48, 255),
    "hair_dark": (128, 16, 22, 255),
    "hair": (220, 35, 31, 255),
    "hair_hi": (255, 87, 48, 255),
    "skin_dark": (151, 82, 49, 255),
    "skin": (224, 137, 82, 255),
    "skin_hi": (255, 184, 120, 255),
    "shirt_shadow": (192, 209, 213, 255),
    "shirt": (247, 248, 236, 255),
    "shorts_dark": (42, 94, 51, 255),
    "shorts": (76, 151, 63, 255),
    "shoe": (248, 246, 236, 255),
    "shoe_red": (230, 37, 50, 255),
    "gold": (255, 206, 39, 255),
    "orange": (245, 122, 31, 255),
    "pink": (255, 72, 158, 255),
    "purple": (115, 55, 190, 255),
    "cyan": (58, 212, 245, 255),
    "smoke1": (76, 86, 95, 180),
    "smoke2": (131, 140, 145, 135),
    "smoke3": (197, 203, 204, 92),
    "brown": (116, 65, 38, 255),
    "bottle": (54, 153, 71, 255),
}


def px(draw: ImageDraw.ImageDraw, xy: tuple[int, int, int, int], fill):
    draw.rectangle(xy, fill=fill)


def poly(draw: ImageDraw.ImageDraw, pts: Iterable[tuple[int, int]], fill):
    draw.polygon(list(pts), fill=fill)


def line(draw: ImageDraw.ImageDraw, pts: Iterable[tuple[int, int]], fill, width=1):
    draw.line(list(pts), fill=fill, width=width)


def ellipse(draw: ImageDraw.ImageDraw, xy: tuple[int, int, int, int], fill, outline=None):
    draw.ellipse(xy, fill=fill, outline=outline)


def rect(draw: ImageDraw.ImageDraw, xy: tuple[int, int, int, int], fill, outline=None):
    draw.rectangle(xy, fill=fill, outline=outline)


def paste_pixel_text(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, fill):
    glyphs = {
        "B": ["1110", "1001", "1110", "1001", "1110"],
        "O": ["0110", "1001", "1001", "1001", "0110"],
        "M": ["10001", "11011", "10101", "10001", "10001"],
        "A": ["0110", "1001", "1111", "1001", "1001"],
        "N": ["1001", "1101", "1011", "1001", "1001"],
        "G": ["0111", "1000", "1011", "1001", "0111"],
        "K": ["1001", "1010", "1100", "1010", "1001"],
        "C": ["0111", "1000", "1000", "1000", "0111"],
        "P": ["1110", "1001", "1110", "1000", "1000"],
        " ": ["0", "0", "0", "0", "0"],
    }
    cursor = x
    for ch in text:
        pat = glyphs.get(ch, glyphs[" "])
        for yy, row in enumerate(pat):
            for xx, bit in enumerate(row):
                if bit == "1":
                    rect(draw, (cursor + xx * 2, y + yy * 2, cursor + xx * 2 + 1, y + yy * 2 + 1), fill)
        cursor += len(pat[0]) * 2 + 2


def player_frame(state: str, i: int, total: int) -> Image.Image:
    im = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    phase = i / max(total, 1)
    fearless = state.startswith("fearless")
    gold = P["gold"] if fearless else None

    cx = 30
    bob = 0
    lean = 0
    arm_a = -1
    arm_b = 1
    leg_a = 1
    leg_b = -1

    if "run" in state:
        lean = 4
        bob = [0, -1, -2, -1, 0, -1, -2, -1][i % 8]
        leg_a = [1, 2, 1, 0, -1, -2, -1, 0][i % 8]
        leg_b = [-1, -2, -1, 0, 1, 2, 1, 0][i % 8]
        arm_a = -leg_a
        arm_b = -leg_b
    elif state == "idle" or state == "fearless_idle":
        bob = -1 if i % 2 else 0
        arm_a, arm_b, leg_a, leg_b = 0, 0, 0, 0
    elif state == "jump":
        lean = 3
        bob = -8 - i
        arm_a, arm_b, leg_a, leg_b = -2, 2, 2, -1
    elif state == "fall":
        lean = 1
        bob = -5 + i
        arm_a, arm_b, leg_a, leg_b = 2, -2, -1, 2
    elif state == "throw":
        lean = 2
        bob = -1
        arm_a = [0, -1, -3, -4][i % 4]
        arm_b = [1, 2, 3, 4][i % 4]
        leg_a, leg_b = 1, -1
    elif state == "charge":
        lean = 2
        bob = -1 if i % 2 else 0
        arm_a, arm_b, leg_a, leg_b = 2, 2, 0, -1
    elif state == "dash":
        lean = 7
        bob = -2
        arm_a, arm_b = -2, 3
        leg_a, leg_b = 3, -2
    elif state == "hurt":
        lean = -3
        bob = -1
        arm_a, arm_b, leg_a, leg_b = -3, -2, -1, 1
    elif state == "victory":
        lean = 0
        bob = [-1, -2, -1, 0][i % 4]
        arm_a, arm_b, leg_a, leg_b = -5, -1, 0, 0

    hip = (cx - lean // 2, BASELINE - 21 + bob)
    chest = (cx + lean, BASELINE - 37 + bob)
    neck = (cx + lean + 3, BASELINE - 47 + bob)
    head = (cx + lean + 5, BASELINE - 52 + bob)

    if fearless:
        for off in (12, 8, 4):
            line(d, [(cx - off, 18 + bob), (cx + 3 - off, 45 + bob)], (255, 214, 36, 42), 2)
        ellipse(d, (cx - 13, 7 + bob, cx + 20, 58 + bob), (255, 205, 35, 42))

    if state == "dash":
        for k in range(4):
            line(d, [(6 - k * 3, 18 + k * 8), (22 - k * 2, 18 + k * 8)], P["pink"], 1)
            line(d, [(1 - k * 2, 21 + k * 8), (17 - k * 2, 21 + k * 8)], P["cyan"], 1)

    # Hair behind head, exaggerated red Lola-like silhouette.
    hair_pts = [
        (head[0] - 15 - (2 if "run" in state else 0), head[1] + 1),
        (head[0] - 2, head[1] - 9 - (5 if fearless else 0)),
        (head[0] + 8, head[1] - 6),
        (head[0] + 4, head[1] + 6),
        (head[0] - 8 - (4 if "run" in state else 0), head[1] + 11),
    ]
    poly(d, [(x + 1, y + 1) for x, y in hair_pts], P["outline"])
    poly(d, hair_pts, P["hair"])
    line(d, [(head[0] - 10, head[1] + 1), (head[0] + 2, head[1] - 5)], P["hair_hi"], 1)
    if fearless:
        line(d, [(head[0] - 12, head[1] - 3), (head[0] + 3, head[1] - 11)], P["gold"], 1)

    # Legs.
    knee1 = (hip[0] + 7 + leg_a * 3, hip[1] + 12)
    foot1 = (hip[0] + 14 + leg_a * 6, BASELINE + bob // 2)
    knee2 = (hip[0] - 3 + leg_b * 3, hip[1] + 13)
    foot2 = (hip[0] - 9 + leg_b * 6, BASELINE + bob // 2)
    for knee, foot in ((knee2, foot2), (knee1, foot1)):
        line(d, [hip, knee, foot], P["outline"], 5)
        line(d, [hip, knee, foot], P["skin_dark"], 3)
        rect(d, (foot[0] - 2, foot[1] - 2, foot[0] + 7, foot[1] + 1), P["outline"])
        rect(d, (foot[0] - 1, foot[1] - 3, foot[0] + 6, foot[1]), P["shoe"])
        px(d, (foot[0] + 3, foot[1] - 2, foot[0] + 6, foot[1] - 1), P["shoe_red"])

    # Shorts and torso.
    poly(d, [(hip[0] - 7, hip[1] - 6), (hip[0] + 8, hip[1] - 7), (hip[0] + 10, hip[1] + 4), (hip[0] - 6, hip[1] + 5)], P["outline"])
    poly(d, [(hip[0] - 6, hip[1] - 7), (hip[0] + 7, hip[1] - 7), (hip[0] + 8, hip[1] + 3), (hip[0] - 5, hip[1] + 4)], P["shorts"])
    px(d, (hip[0] - 5, hip[1] - 6, hip[0] + 1, hip[1] + 3), P["shorts_dark"])

    body = [(chest[0] - 7, chest[1]), (chest[0] + 6, chest[1] + 1), (hip[0] + 7, hip[1] - 6), (hip[0] - 6, hip[1] - 6)]
    poly(d, [(x + 1, y + 1) for x, y in body], P["outline"])
    poly(d, body, P["shirt"])
    line(d, [(chest[0] - 4, chest[1] + 3), (hip[0] - 3, hip[1] - 7)], P["shirt_shadow"], 1)

    # Arms.
    shoulder1 = (chest[0] + 4, chest[1] + 3)
    hand1 = (chest[0] + 13 + arm_a * 3, chest[1] + 11 + arm_a)
    shoulder2 = (chest[0] - 5, chest[1] + 4)
    hand2 = (chest[0] - 13 + arm_b * 3, chest[1] + 13 - arm_b)
    for shoulder, hand in ((shoulder2, hand2), (shoulder1, hand1)):
        line(d, [shoulder, ((shoulder[0] + hand[0]) // 2, shoulder[1] + 7), hand], P["outline"], 4)
        line(d, [shoulder, ((shoulder[0] + hand[0]) // 2, shoulder[1] + 7), hand], P["skin"], 2)
        ellipse(d, (hand[0] - 2, hand[1] - 2, hand[0] + 2, hand[1] + 2), P["skin_hi"], P["outline"])

    if state == "throw" and i >= 2:
        rect(d, (50, 34 + (i % 2), 60, 39 + (i % 2)), P["outline"])
        ellipse(d, (51, 32 + (i % 2), 59, 40 + (i % 2)), (255, 211, 252, 255))
        line(d, [(45, 36), (49, 36)], P["pink"], 1)
    if state == "charge":
        for k in range(i + 1):
            line(d, [(45 + k * 3, 42 - k), (50 + k * 3, 42 - k)], P["gold"], 1)

    # Head and face.
    ellipse(d, (neck[0] - 5, neck[1] - 4, neck[0] + 7, neck[1] + 8), P["outline"])
    ellipse(d, (neck[0] - 4, neck[1] - 5, neck[0] + 6, neck[1] + 7), P["skin"])
    px(d, (neck[0] + 4, neck[1] - 1, neck[0] + 5, neck[1]), P["outline"])
    px(d, (neck[0] + 6, neck[1] + 2, neck[0] + 8, neck[1] + 2), P["skin_dark"])

    if state == "hurt":
        line(d, [(neck[0] + 3, neck[1] - 1), (neck[0] + 5, neck[1] + 1)], P["outline"], 1)
    elif state == "victory":
        line(d, [(neck[0] + 2, neck[1] + 2), (neck[0] + 6, neck[1] + 2)], P["outline"], 1)

    # Dust.
    if "run" in state or state == "dash":
        ellipse(d, (7, BASELINE - 1, 15, BASELINE + 2), (220, 196, 140, 145))
        ellipse(d, (15, BASELINE - 3, 20, BASELINE), (255, 235, 170, 120))

    return im


def smoker_frame(state: str, i: int, total: int) -> Image.Image:
    im = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    bob = -1 if i % 2 else 0
    if state == "smoke_loop":
        for k in range(5):
            x = 14 + k * 8 + (i * 3 + k) % 5
            y = 30 - ((i + k) % 4) * 2
            ellipse(d, (x - 6, y - 5, x + 7, y + 6), [P["smoke1"], P["smoke2"], P["smoke3"]][k % 3])
        return im
    rect(d, (20, 31 + bob, 33, 53 + bob), P["outline"])
    rect(d, (22, 32 + bob, 32, 52 + bob), (69, 75, 83, 255))
    ellipse(d, (22, 16 + bob, 34, 29 + bob), P["skin"], P["outline"])
    px(d, (28, 21 + bob, 29, 22 + bob), P["outline"])
    line(d, [(30, 28 + bob), (42, 34 + bob)], P["outline"], 4)
    line(d, [(30, 28 + bob), (42, 34 + bob)], P["skin"], 2)
    rect(d, (41, 33 + bob, 49, 35 + bob), P["outline"])
    rect(d, (42, 33 + bob, 48, 34 + bob), (240, 232, 178, 255))
    px(d, (48, 33 + bob, 49, 34 + bob), P["orange"])
    line(d, [(24, 52 + bob), (20, 58)], P["outline"], 4)
    line(d, [(31, 52 + bob), (35, 58)], P["outline"], 4)
    if state == "exhale":
        for k in range(i + 2):
            x = 47 + k * 5
            y = 31 - k - i
            ellipse(d, (x - 4, y - 3, x + 5, y + 4), P["smoke2"])
    else:
        ellipse(d, (47 + i, 28 - i, 55 + i, 36 - i), P["smoke3"])
    return im


def harasser_frame(state: str, i: int, total: int) -> Image.Image:
    im = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    fly = state == "knockback"
    dx = i * 4 if fly else 0
    dy = -i * 2 if fly else 0
    angle = i % 2 if fly else 0
    cx = 30 + dx
    bob = -1 if i % 2 else 0
    if fly:
        for k in range(3):
            line(d, [(8 + k * 4, 44 - k * 4), (22 + k * 4, 38 - k * 4)], P["gold"], 1)
            ellipse(d, (12 + k * 4, 20 + k * 3, 15 + k * 4, 23 + k * 3), P["pink"])
    torso = [(cx - 6, 31 + dy + bob), (cx + 7, 32 + dy + bob), (cx + 5, 51 + dy), (cx - 8, 51 + dy)]
    poly(d, [(x + angle, y) for x, y in torso], P["outline"])
    poly(d, [(torso[0][0] + 1, torso[0][1]), (torso[1][0], torso[1][1]), (torso[2][0] - 1, torso[2][1]), (torso[3][0] + 1, torso[3][1])], (237, 240, 236, 255))
    ellipse(d, (cx - 5, 17 + dy + bob, cx + 7, 30 + dy + bob), P["skin"], P["outline"])
    px(d, (cx + 3, 22 + dy + bob, cx + 4, 23 + dy + bob), P["outline"])
    line(d, [(cx + 1, 27 + dy + bob), (cx + 6, 26 + dy + bob)], P["outline"], 1)
    reach = i * 3 if state == "reach" else 3
    line(d, [(cx + 6, 35 + dy), (cx + 18 + reach, 36 + dy), (cx + 22 + reach, 39 + dy)], P["outline"], 4)
    line(d, [(cx + 6, 35 + dy), (cx + 18 + reach, 36 + dy), (cx + 22 + reach, 39 + dy)], P["skin"], 2)
    line(d, [(cx - 7, 36 + dy), (cx - 13, 43 + dy)], P["outline"], 4)
    line(d, [(cx - 4, 51 + dy), (cx - 9, 58 + dy)], P["outline"], 4)
    line(d, [(cx + 4, 51 + dy), (cx + 9, 58 + dy)], P["outline"], 4)
    return im


def drunk_frame(state: str, i: int, total: int) -> Image.Image:
    im = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    fly = state == "tumble"
    tilt = [-4, -2, 0, 2, 4, 2, 0, -2][i % 8 if fly else i % 6]
    cx = 28 + (i * 4 if fly else 0)
    cy = 34 - (i * 2 if fly else 0)
    if fly:
        for k in range(5):
            paste_star(d, 8 + k * 8, 20 + (k % 2) * 6, P["gold"])
    body = [(cx - 8 + tilt, cy - 5), (cx + 6 + tilt, cy - 4), (cx + 8 - tilt, cy + 16), (cx - 7 - tilt, cy + 17)]
    poly(d, [(x, y) for x, y in body], P["outline"])
    poly(d, [(body[0][0] + 1, body[0][1] + 1), (body[1][0] - 1, body[1][1] + 1), (body[2][0] - 1, body[2][1] - 1), (body[3][0] + 1, body[3][1] - 1)], P["brown"])
    ellipse(d, (cx - 6 + tilt, cy - 18, cx + 7 + tilt, cy - 5), P["skin"], P["outline"])
    px(d, (cx - 2 + tilt, cy - 13, cx - 1 + tilt, cy - 12), P["outline"])
    px(d, (cx + 4 + tilt, cy - 13, cx + 5 + tilt, cy - 12), P["outline"])
    line(d, [(cx + 7 - tilt, cy + 1), (cx + 16 - tilt, cy + 10)], P["outline"], 4)
    line(d, [(cx + 7 - tilt, cy + 1), (cx + 16 - tilt, cy + 10)], P["skin"], 2)
    rect(d, (cx + 15 - tilt, cy + 8, cx + 20 - tilt, cy + 18), P["outline"])
    rect(d, (cx + 16 - tilt, cy + 9, cx + 19 - tilt, cy + 17), P["bottle"])
    line(d, [(cx - 5, cy + 16), (cx - 12, BASELINE)], P["outline"], 4)
    line(d, [(cx + 5, cy + 16), (cx + 12, BASELINE)], P["outline"], 4)
    return im


def paste_star(d: ImageDraw.ImageDraw, x: int, y: int, fill):
    pts = [(x, y - 5), (x + 2, y - 1), (x + 6, y), (x + 2, y + 2), (x, y + 6), (x - 2, y + 2), (x - 6, y), (x - 2, y - 1)]
    poly(d, pts, P["outline"])
    pts2 = [(x, y - 4), (x + 1, y - 1), (x + 5, y), (x + 1, y + 1), (x, y + 5), (x - 1, y + 1), (x - 5, y), (x - 1, y - 1)]
    poly(d, pts2, fill)


def fx_frame(kind: str, i: int, total: int) -> Image.Image:
    im = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    t = (i + 1) / total
    cx, cy = 32, 32
    if kind in {"boom", "bang", "ko", "comic_pop"}:
        r = 10 + i * 3
        pts = []
        for n in range(18):
            a = n / 18 * math.tau
            rr = r + (7 if n % 2 == 0 else -3)
            pts.append((int(cx + math.cos(a) * rr), int(cy + math.sin(a) * rr)))
        poly(d, pts, P["outline"])
        inner = [(int(cx + (x - cx) * 0.9), int(cy + (y - cy) * 0.9)) for x, y in pts]
        poly(d, inner, P["gold"] if kind != "ko" else P["pink"])
        label = {"boom": "BOOM", "bang": "BANG", "ko": "KO", "comic_pop": "POP"}[kind]
        paste_pixel_text(d, 10 if len(label) > 2 else 20, 27, label, P["outline"])
        paste_pixel_text(d, 9 if len(label) > 2 else 19, 26, label, (255, 246, 225, 255))
    elif kind == "spark":
        for n in range(12):
            a = n / 12 * math.tau
            line(d, [(cx, cy), (int(cx + math.cos(a) * (8 + i * 4)), int(cy + math.sin(a) * (8 + i * 4)))], P["orange"] if n % 2 else P["gold"], 2)
        ellipse(d, (cx - 5, cy - 5, cx + 5, cy + 5), (255, 255, 245, 230))
    elif kind == "speed_line":
        for k in range(7):
            y = 10 + k * 7 + (i % 2)
            line(d, [(0, y), (50 - k * 2, y - 4)], P["pink"] if k % 2 else P["cyan"], 2)
            line(d, [(14, y + 3), (63, y)], P["gold"], 1)
    elif kind == "fearless_glow":
        ellipse(d, (20 - i, 8 - i, 46 + i, 58 + i), (255, 208, 39, max(40, 150 - i * 18)))
        for k in range(6):
            paste_star(d, 20 + k * 5, 16 + (k % 3) * 9, P["gold"])
    elif kind == "star_hit":
        for k in range(5):
            paste_star(d, 20 + k * 6, 20 + ((i + k) % 3) * 7, P["gold"] if k % 2 else P["pink"])
    elif kind in {"dust", "landing_dust"}:
        for k in range(6):
            x = 12 + k * 8
            y = 48 - int(i * 1.2) + (k % 2) * 2
            ellipse(d, (x - 5 - i, y - 3, x + 5 + i, y + 4), (221, 197, 145, max(35, 170 - i * 18)))
    return im


def pad_frame(i: int, total: int) -> Image.Image:
    im = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy = 32, 32
    w = [18, 14, 8, 14, 18, 14, 8, 14][i % 8]
    h = [8, 12, 18, 12, 8, 12, 18, 12][i % 8]
    ellipse(d, (cx - w, cy - h, cx + w, cy + h), P["outline"])
    ellipse(d, (cx - w + 2, cy - h + 2, cx + w - 2, cy + h - 2), (255, 229, 252, 255))
    ellipse(d, (cx - max(3, w // 3), cy - max(3, h // 3), cx + max(3, w // 3), cy + max(3, h // 3)), (255, 255, 255, 255))
    line(d, [(cx - w - 5, cy), (cx - w - 1, cy)], P["pink"], 1)
    line(d, [(cx + w + 1, cy), (cx + w + 5, cy)], P["pink"], 1)
    return im


def item_frame(kind: str, i: int, total: int) -> Image.Image:
    im = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if kind == "heart":
        fill = P["pink"] if i == 0 else (75, 65, 76, 255)
        pts = [(32, 47), (16, 32), (18, 21), (27, 20), (32, 26), (37, 20), (46, 21), (48, 32)]
        poly(d, pts, P["outline"])
        poly(d, [(32, 44), (18, 31), (20, 23), (27, 23), (32, 29), (37, 23), (44, 23), (46, 31)], fill)
        px(d, (24, 25, 27, 27), (255, 159, 200, 255))
    elif kind in {"courage_bar", "fearless_bar"}:
        rect(d, (8, 25, 56, 38), P["outline"])
        rect(d, (10, 27, 54, 36), (41, 34, 45, 255))
        fill = P["gold"] if kind == "fearless_bar" else P["shorts"]
        width = 10 + i * 10
        rect(d, (11, 28, min(53, 11 + width), 35), fill)
        if kind == "fearless_bar":
            for k in range(3):
                paste_star(d, 17 + k * 12, 18, P["gold"])
    return im


def make_sheet(path: Path, frames: list[Image.Image]):
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet = Image.new("RGBA", (FRAME * len(frames), FRAME), (0, 0, 0, 0))
    for idx, frame in enumerate(frames):
        sheet.alpha_composite(frame, (idx * FRAME, 0))
    sheet.save(path)


def generate():
    player_states = {
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
    for state, count in player_states.items():
        frames = [player_frame(state, i, count) for i in range(count)]
        make_sheet(ASSETS / "sprites/player" / f"player_{state}.png", frames)

    obstacle_specs: dict[str, tuple[Callable[[str, int, int], Image.Image], dict[str, int]]] = {
        "smoke": (smoker_frame, {"idle": 4, "exhale": 4, "smoke_loop": 6}),
        "harasser": (harasser_frame, {"idle": 4, "reach": 4, "knockback": 6}),
        "drunk_man": (drunk_frame, {"sway": 6, "tumble": 8}),
    }
    for name, (fn, states) in obstacle_specs.items():
        for state, count in states.items():
            frames = [fn(state, i, count) for i in range(count)]
            make_sheet(ASSETS / "sprites/obstacles" / f"obstacle_{name}_{state}.png", frames)

    for kind in ["boom", "bang", "ko", "spark", "speed_line", "fearless_glow", "comic_pop", "star_hit", "dust", "landing_dust"]:
        frames = [fx_frame(kind, i, 6) for i in range(6)]
        make_sheet(ASSETS / "fx" / f"fx_{kind}.png", frames)

    make_sheet(ASSETS / "sprites/items" / "item_pad_spin.png", [pad_frame(i, 8) for i in range(8)])
    make_sheet(ASSETS / "sprites/items" / "item_heart.png", [item_frame("heart", i, 2) for i in range(2)])
    make_sheet(ASSETS / "sprites/items" / "ui_courage_bar.png", [item_frame("courage_bar", i, 4) for i in range(4)])
    make_sheet(ASSETS / "sprites/items" / "ui_fearless_bar.png", [item_frame("fearless_bar", i, 4) for i in range(4)])

    manifest = json.loads((ASSETS / "assets.json").read_text())
    manifest["sprites"]["player"]["states"] = {
        "idle": {"frames": 2, "file": "player_idle.png"},
        "run": {"frames": 8, "file": "player_run.png"},
        "jump": {"frames": 2, "file": "player_jump.png"},
        "fall": {"frames": 2, "file": "player_fall.png"},
        "throw": {"frames": 4, "file": "player_throw.png"},
        "charge": {"frames": 4, "file": "player_charge.png"},
        "dash": {"frames": 4, "file": "player_dash.png"},
        "hurt": {"frames": 2, "file": "player_hurt.png"},
        "fearlessIdle": {"frames": 2, "file": "player_fearless_idle.png"},
        "fearlessRun": {"frames": 8, "file": "player_fearless_run.png"},
        "victory": {"frames": 4, "file": "player_victory.png"},
    }
    manifest["sprites"]["obstacles"]["states"] = {
        "smokeIdle": {"frames": 4, "file": "obstacle_smoke_idle.png"},
        "smokeExhale": {"frames": 4, "file": "obstacle_smoke_exhale.png"},
        "smokeLoop": {"frames": 6, "file": "obstacle_smoke_smoke_loop.png"},
        "harasserIdle": {"frames": 4, "file": "obstacle_harasser_idle.png"},
        "harasserReach": {"frames": 4, "file": "obstacle_harasser_reach.png"},
        "harasserKnockback": {"frames": 6, "file": "obstacle_harasser_knockback.png"},
        "drunkManSway": {"frames": 6, "file": "obstacle_drunk_man_sway.png"},
        "drunkManTumble": {"frames": 8, "file": "obstacle_drunk_man_tumble.png"},
    }
    manifest["sprites"]["items"]["states"] = {
        "padSpin": {"frames": 8, "file": "item_pad_spin.png"},
        "heart": {"frames": 2, "file": "item_heart.png"},
        "courageBar": {"frames": 4, "file": "ui_courage_bar.png"},
        "fearlessBar": {"frames": 4, "file": "ui_fearless_bar.png"},
    }
    manifest["sprites"]["fx"]["states"] = {
        "boom": {"frames": 6, "file": "fx_boom.png"},
        "bang": {"frames": 6, "file": "fx_bang.png"},
        "ko": {"frames": 6, "file": "fx_ko.png"},
        "spark": {"frames": 6, "file": "fx_spark.png"},
        "speedLine": {"frames": 6, "file": "fx_speed_line.png"},
        "fearlessGlow": {"frames": 6, "file": "fx_fearless_glow.png"},
        "comicPop": {"frames": 6, "file": "fx_comic_pop.png"},
        "starHit": {"frames": 6, "file": "fx_star_hit.png"},
        "dust": {"frames": 6, "file": "fx_dust.png"},
        "landingDust": {"frames": 6, "file": "fx_landing_dust.png"},
    }
    (ASSETS / "assets.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    generate()
