from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "concept"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SCALE = 4
FRAME = 64
PAD = 10
LABEL_H = 12
COLS = 4
ROWS = 2
SHEET_W = 380
SHEET_H = 26 + ROWS * (FRAME + LABEL_H + PAD) + PAD

INK = "#07080f"
INK2 = "#1b1d2a"
SKIN = "#ffc08c"
SKIN_SHADOW = "#e69a62"
HAIR = "#ef2d3d"
HAIR_DARK = "#bd1328"
TANK = "#fff7dc"
TANK_SHADOW = "#d8d2b8"
SHORTS = "#1f8f52"
SHORTS_SHADOW = "#176c41"
SHOE = "#f5f7ff"
SOLE = "#8b95aa"
GOLD = "#ffd35a"
CYAN = "#24d8ff"
PINK = "#ef2d58"
BG = "#243143"
PANEL = "#303d52"
GRID = "#47556c"
TEXT = "#f7f1d2"


def rect(d, xy, fill, outline=None):
    x0, y0, x1, y1 = (int(v) for v in xy)
    d.rectangle((min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)), fill=fill, outline=outline)


def line(d, pts, fill, width=1):
    d.line([(int(x), int(y)) for x, y in pts], fill=fill, width=width)


def poly(d, pts, fill, outline=None):
    d.polygon([(int(x), int(y)) for x, y in pts], fill=fill)
    if outline:
        d.line([(int(x), int(y)) for x, y in pts] + [(int(pts[0][0]), int(pts[0][1]))], fill=outline, width=1)


def draw_limb(d, pts, color, outline=INK, width=4):
    line(d, pts, outline, width + 2)
    line(d, pts, color, width)


def draw_shoe(d, x, y, direction=1):
    rect(d, (x - 1, y - 2, x + 7 * direction, y + 1), INK)
    if direction > 0:
        rect(d, (x, y - 3, x + 6, y), SHOE)
        rect(d, (x + 1, y + 1, x + 7, y + 1), SOLE)
    else:
        rect(d, (x - 6, y - 3, x, y), SHOE)
        rect(d, (x - 7, y + 1, x - 1, y + 1), SOLE)


def draw_head(d, cx, cy, view="side", fearless=False):
    rect(d, (cx - 4, cy - 5, cx + 4, cy + 3), INK)
    rect(d, (cx - 3, cy - 4, cx + 4, cy + 2), SKIN)
    rect(d, (cx + 1, cy + 1, cx + 4, cy + 2), SKIN_SHADOW)
    if view == "front":
        rect(d, (cx - 5, cy - 7, cx + 5, cy - 2), INK)
        rect(d, (cx - 5, cy - 8, cx + 4, cy - 4), HAIR)
        rect(d, (cx - 6, cy - 5, cx - 3, cy + 1), HAIR_DARK)
        rect(d, (cx + 2, cy - 5, cx + 5, cy - 1), HAIR_DARK)
        rect(d, (cx - 2, cy - 1, cx - 1, cy), INK)
        rect(d, (cx + 2, cy - 1, cx + 3, cy), INK)
        rect(d, (cx - 1, cy + 2, cx + 2, cy + 2), INK2)
    else:
        rect(d, (cx - 5, cy - 8, cx + 4, cy - 3), INK)
        rect(d, (cx - 5, cy - 8, cx + 2, cy - 4), HAIR)
        rect(d, (cx - 7, cy - 6, cx - 4, cy - 1), HAIR_DARK)
        if fearless:
            rect(d, (cx - 13, cy - 8, cx - 7, cy - 4), GOLD)
            rect(d, (cx - 17, cy - 7, cx - 13, cy - 5), HAIR)
        else:
            rect(d, (cx - 10, cy - 7, cx - 6, cy - 4), HAIR)
        rect(d, (cx + 2, cy - 1, cx + 3, cy), INK)
        rect(d, (cx + 1, cy + 2, cx + 4, cy + 2), INK2)


def draw_body(d, hip, shoulder, mode="side"):
    hx, hy = hip
    sx, sy = shoulder
    poly(d, [(sx - 6, sy - 1), (sx + 5, sy - 3), (hx + 5, hy + 8), (hx - 6, hy + 7)], TANK, INK)
    poly(d, [(hx - 7, hy + 6), (hx + 7, hy + 7), (hx + 5, hy + 15), (hx - 6, hy + 14)], SHORTS, INK)
    rect(d, (sx - 4, sy + 1, sx + 3, sy + 2), TANK_SHADOW)
    rect(d, (hx + 1, hy + 8, hx + 6, hy + 14), SHORTS_SHADOW)


def draw_front(frame):
    d = ImageDraw.Draw(frame)
    draw_head(d, 32, 13, "front")
    draw_body(d, (32, 31), (32, 20), "front")
    draw_limb(d, [(25, 21), (22, 34), (20, 41)], SKIN, width=3)
    draw_limb(d, [(39, 21), (42, 34), (44, 41)], SKIN, width=3)
    rect(d, (18, 40, 21, 43), SKIN_SHADOW, INK)
    rect(d, (43, 40, 46, 43), SKIN_SHADOW, INK)
    draw_limb(d, [(28, 45), (27, 57)], SKIN, width=4)
    draw_limb(d, [(36, 45), (37, 57)], SKIN, width=4)
    draw_shoe(d, 25, 58, -1)
    draw_shoe(d, 36, 58, 1)


def draw_side(frame):
    d = ImageDraw.Draw(frame)
    draw_head(d, 34, 12, "side")
    draw_body(d, (31, 31), (32, 20), "side")
    draw_limb(d, [(29, 22), (22, 29), (18, 38)], SKIN, width=3)
    draw_limb(d, [(38, 22), (44, 30), (48, 38)], SKIN, width=3)
    rect(d, (16, 37, 19, 40), SKIN_SHADOW, INK)
    rect(d, (47, 37, 50, 40), SKIN_SHADOW, INK)
    draw_limb(d, [(29, 44), (22, 51), (17, 57)], SKIN, width=4)
    draw_limb(d, [(37, 44), (44, 50), (50, 56)], SKIN, width=4)
    draw_shoe(d, 17, 58, -1)
    draw_shoe(d, 50, 57, 1)


def draw_three_quarter(frame):
    d = ImageDraw.Draw(frame)
    draw_head(d, 35, 12, "side")
    draw_body(d, (32, 31), (33, 20), "side")
    draw_limb(d, [(28, 22), (21, 31), (18, 40)], SKIN, width=3)
    draw_limb(d, [(39, 22), (45, 28), (51, 32)], SKIN, width=3)
    rect(d, (17, 39, 20, 42), SKIN_SHADOW, INK)
    rect(d, (50, 31, 53, 34), SKIN_SHADOW, INK)
    draw_limb(d, [(30, 44), (24, 52), (17, 57)], SKIN, width=4)
    draw_limb(d, [(38, 44), (41, 52), (47, 57)], SKIN, width=4)
    draw_shoe(d, 17, 58, -1)
    draw_shoe(d, 47, 58, 1)


def draw_run(frame):
    d = ImageDraw.Draw(frame)
    rect(d, (6, 55, 13, 56), "#7d6f5a")
    rect(d, (12, 57, 18, 58), "#7d6f5a")
    draw_head(d, 37, 13, "side")
    draw_body(d, (33, 33), (34, 21), "side")
    draw_limb(d, [(31, 23), (22, 30), (17, 36)], SKIN, width=3)
    draw_limb(d, [(39, 23), (48, 28), (52, 35)], SKIN, width=3)
    rect(d, (16, 35, 19, 38), SKIN_SHADOW, INK)
    rect(d, (51, 34, 54, 37), SKIN_SHADOW, INK)
    draw_limb(d, [(31, 46), (23, 45), (17, 53)], SKIN, width=4)
    draw_limb(d, [(39, 45), (47, 50), (54, 57)], SKIN, width=4)
    draw_shoe(d, 17, 54, -1)
    draw_shoe(d, 54, 58, 1)


def draw_jump(frame):
    d = ImageDraw.Draw(frame)
    draw_head(d, 36, 10, "side")
    draw_body(d, (32, 29), (33, 18), "side")
    draw_limb(d, [(30, 20), (23, 24), (19, 31)], SKIN, width=3)
    draw_limb(d, [(38, 20), (45, 24), (49, 31)], SKIN, width=3)
    rect(d, (18, 30, 21, 33), SKIN_SHADOW, INK)
    rect(d, (48, 30, 51, 33), SKIN_SHADOW, INK)
    draw_limb(d, [(31, 42), (22, 38), (16, 33)], SKIN, width=4)
    draw_limb(d, [(38, 42), (42, 51), (50, 53)], SKIN, width=4)
    draw_shoe(d, 16, 34, -1)
    draw_shoe(d, 50, 54, 1)


def draw_throw(frame):
    d = ImageDraw.Draw(frame)
    draw_head(d, 36, 13, "side")
    draw_body(d, (32, 32), (33, 21), "side")
    draw_limb(d, [(30, 23), (22, 30), (17, 38)], SKIN, width=3)
    draw_limb(d, [(39, 23), (49, 23), (57, 21)], SKIN, width=3)
    rect(d, (16, 37, 19, 40), SKIN_SHADOW, INK)
    rect(d, (56, 20, 59, 23), SKIN_SHADOW, INK)
    rect(d, (51, 17, 55, 20), PINK, INK)
    draw_limb(d, [(31, 45), (25, 52), (17, 57)], SKIN, width=4)
    draw_limb(d, [(38, 45), (45, 50), (52, 56)], SKIN, width=4)
    draw_shoe(d, 17, 58, -1)
    draw_shoe(d, 52, 57, 1)


def draw_charge(frame):
    d = ImageDraw.Draw(frame)
    rect(d, (8, 51, 16, 52), CYAN)
    rect(d, (10, 55, 21, 56), GOLD)
    draw_head(d, 37, 18, "side")
    draw_body(d, (32, 37), (34, 26), "side")
    draw_limb(d, [(31, 28), (23, 34), (20, 42)], SKIN, width=3)
    draw_limb(d, [(39, 28), (46, 34), (49, 42)], SKIN, width=3)
    rect(d, (19, 41, 22, 44), SKIN_SHADOW, INK)
    rect(d, (48, 41, 51, 44), SKIN_SHADOW, INK)
    draw_limb(d, [(30, 50), (22, 55), (15, 58)], SKIN, width=4)
    draw_limb(d, [(39, 50), (48, 53), (55, 56)], SKIN, width=4)
    draw_shoe(d, 15, 59, -1)
    draw_shoe(d, 55, 57, 1)


def draw_fearless(frame):
    d = ImageDraw.Draw(frame)
    for off, color in [(-5, CYAN), (-3, GOLD)]:
        rect(d, (11 + off, 14, 17 + off, 18), color)
        rect(d, (8 + off, 27, 15 + off, 31), color)
        rect(d, (9 + off, 44, 16 + off, 48), color)
    rect(d, (12, 11, 55, 58), GOLD)
    rect(d, (13, 12, 54, 57), BG)
    draw_head(d, 38, 12, "side", fearless=True)
    draw_body(d, (33, 32), (34, 20), "side")
    draw_limb(d, [(31, 22), (21, 27), (16, 34)], SKIN, width=3)
    draw_limb(d, [(40, 22), (50, 27), (55, 34)], SKIN, width=3)
    rect(d, (15, 33, 18, 36), SKIN_SHADOW, INK)
    rect(d, (54, 33, 57, 36), SKIN_SHADOW, INK)
    draw_limb(d, [(31, 45), (22, 43), (15, 50)], SKIN, width=4)
    draw_limb(d, [(39, 44), (48, 48), (56, 54)], SKIN, width=4)
    draw_shoe(d, 15, 51, -1)
    draw_shoe(d, 56, 55, 1)


PANELS = [
    ("FRONT", draw_front),
    ("SIDE", draw_side),
    ("3/4", draw_three_quarter),
    ("RUN", draw_run),
    ("JUMP", draw_jump),
    ("THROW", draw_throw),
    ("CHARGE", draw_charge),
    ("FEARLESS", draw_fearless),
]


def draw_sheet():
    sheet = Image.new("RGB", (SHEET_W, SHEET_H), BG)
    d = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    d.text((PAD, 8), "HEROINE MODEL SHEET V1", fill=TEXT, font=font)
    d.text((SHEET_W - 126, 8), "64x64 / y=58", fill="#a8d8ff", font=font)

    for index, (label, drawer) in enumerate(PANELS):
        col = index % COLS
        row = index // COLS
        x = PAD + col * (FRAME + PAD)
        y = 26 + row * (FRAME + LABEL_H + PAD)
        rect(d, (x - 1, y - 1, x + FRAME, y + FRAME), PANEL, GRID)
        for gy in range(0, FRAME, 8):
            line(d, [(x, y + gy), (x + FRAME - 1, y + gy)], "#38465d")
        line(d, [(x, y + 58), (x + FRAME - 1, y + 58)], "#d6b36a")
        frame = Image.new("RGB", (FRAME, FRAME), BG)
        fd = ImageDraw.Draw(frame)
        for gy in range(0, FRAME, 8):
            line(fd, [(0, gy), (FRAME - 1, gy)], "#38465d")
        line(fd, [(0, 58), (FRAME - 1, 58)], "#d6b36a")
        drawer(frame)
        sheet.paste(frame, (x, y))
        d.text((x + 2, y + FRAME + 3), label, fill=TEXT, font=font)

    # Palette chips.
    chips = [
        ("ink", INK),
        ("skin", SKIN),
        ("hair", HAIR),
        ("tank", TANK),
        ("shorts", SHORTS),
        ("shoe", SHOE),
        ("fear", GOLD),
        ("speed", CYAN),
    ]
    chip_x = PAD
    chip_y = SHEET_H - 13
    for name, color in chips:
        rect(d, (chip_x, chip_y, chip_x + 6, chip_y + 6), color, INK)
        d.text((chip_x + 8, chip_y - 1), name, fill=TEXT, font=font)
        chip_x += 44

    big = sheet.resize((SHEET_W * SCALE, SHEET_H * SCALE), Image.Resampling.NEAREST)
    out = OUT_DIR / "heroine_model_sheet_v1.png"
    big.save(out)
    return out


if __name__ == "__main__":
    print(draw_sheet())
