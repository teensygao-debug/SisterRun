local outDir = app.params["outDir"] or "/Users/teensygao/Desktop/FemAI共学/SisterRun/assets/concept"
local sourcePath = outDir .. "/heroine_model_sheet_v2.aseprite"
local pngPath = outDir .. "/heroine_model_sheet_v2.png"

local function C(hex)
  hex = hex:gsub("#", "")
  return Color {
    r = tonumber(hex:sub(1, 2), 16),
    g = tonumber(hex:sub(3, 4), 16),
    b = tonumber(hex:sub(5, 6), 16),
    a = 255
  }
end

local P = {
  transparent = Color { r = 0, g = 0, b = 0, a = 0 },
  bg = C("#1f2b3c"),
  panel = C("#29384d"),
  grid = C("#3a4a63"),
  baseline = C("#d6b36a"),
  ink = C("#07080f"),
  ink2 = C("#1b1d2a"),
  skin = C("#ffc08c"),
  skinShadow = C("#e69a62"),
  hair = C("#ef2d3d"),
  hairDark = C("#bd1328"),
  hairHi = C("#ff6470"),
  tank = C("#fff7dc"),
  tankShadow = C("#d8d2b8"),
  shorts = C("#1f8f52"),
  shortsShadow = C("#176c41"),
  shoe = C("#f5f7ff"),
  sole = C("#8b95aa"),
  gold = C("#ffd35a"),
  cyan = C("#24d8ff"),
  pink = C("#ef2d58"),
  text = C("#f7f1d2"),
  textBlue = C("#a8d8ff"),
}

local W, H = 384, 208
local sprite = Sprite(W, H, ColorMode.RGB)
sprite.filename = sourcePath
local layer = sprite.layers[1]
layer.name = "heroine_model_sheet_v2"
local cel = sprite.cels[1]
local img = cel.image

local function pix(x, y, color)
  x = math.floor(x)
  y = math.floor(y)
  if x >= 0 and y >= 0 and x < W and y < H then
    img:drawPixel(x, y, color)
  end
end

local function rect(x0, y0, x1, y1, color)
  if x0 > x1 then x0, x1 = x1, x0 end
  if y0 > y1 then y0, y1 = y1, y0 end
  for y = math.floor(y0), math.floor(y1) do
    for x = math.floor(x0), math.floor(x1) do
      pix(x, y, color)
    end
  end
end

local function line(x0, y0, x1, y1, color, thick)
  thick = thick or 1
  local dx = math.abs(x1 - x0)
  local sx = x0 < x1 and 1 or -1
  local dy = -math.abs(y1 - y0)
  local sy = y0 < y1 and 1 or -1
  local err = dx + dy
  while true do
    local r = math.floor(thick / 2)
    rect(x0 - r, y0 - r, x0 + r, y0 + r, color)
    if x0 == x1 and y0 == y1 then break end
    local e2 = 2 * err
    if e2 >= dy then err = err + dy; x0 = x0 + sx end
    if e2 <= dx then err = err + dx; y0 = y0 + sy end
  end
end

local function poly(points, color)
  local minY, maxY = points[1][2], points[1][2]
  for _, p in ipairs(points) do
    minY = math.min(minY, p[2])
    maxY = math.max(maxY, p[2])
  end
  for y = minY, maxY do
    local xs = {}
    for i = 1, #points do
      local p1 = points[i]
      local p2 = points[(i % #points) + 1]
      if (p1[2] <= y and p2[2] > y) or (p2[2] <= y and p1[2] > y) then
        local x = p1[1] + (y - p1[2]) * (p2[1] - p1[1]) / (p2[2] - p1[2])
        table.insert(xs, x)
      end
    end
    table.sort(xs)
    for i = 1, #xs, 2 do
      if xs[i + 1] then rect(math.floor(xs[i]), y, math.ceil(xs[i + 1]), y, color) end
    end
  end
end

local function polyOutline(points, fill, outline)
  poly(points, outline)
  local inner = {}
  local cx, cy = 0, 0
  for _, p in ipairs(points) do cx = cx + p[1]; cy = cy + p[2] end
  cx = cx / #points; cy = cy / #points
  for _, p in ipairs(points) do
    table.insert(inner, { math.floor((p[1] * 5 + cx) / 6), math.floor((p[2] * 5 + cy) / 6) })
  end
  poly(inner, fill)
end

local font = {
  A={"111","101","111","101","101"}, C={"111","100","100","100","111"},
  D={"110","101","101","101","110"}, E={"111","100","110","100","111"},
  F={"111","100","110","100","100"}, G={"111","100","101","101","111"},
  H={"101","101","111","101","101"}, I={"111","010","010","010","111"},
  J={"001","001","001","101","111"}, L={"100","100","100","100","111"},
  M={"101","111","111","101","101"}, N={"101","111","111","111","101"},
  O={"111","101","101","101","111"}, P={"111","101","111","100","100"},
  R={"110","101","110","101","101"}, S={"111","100","111","001","111"},
  T={"111","010","010","010","010"}, U={"101","101","101","101","111"},
  V={"101","101","101","101","010"}, W={"101","101","111","111","101"},
  Y={"101","101","010","010","010"}, ["3"]={"111","001","111","001","111"},
  ["4"]={"101","101","111","001","001"}, ["/"]={"001","001","010","100","100"},
  [" "]={"000","000","000","000","000"}, ["-"]={"000","000","111","000","000"},
}

local function text(x, y, s, color, scale)
  scale = scale or 1
  s = s:upper()
  for i = 1, #s do
    local ch = s:sub(i, i)
    local glyph = font[ch] or font[" "]
    for gy, row in ipairs(glyph) do
      for gx = 1, #row do
        if row:sub(gx, gx) == "1" then
          rect(x + (gx - 1) * scale, y + (gy - 1) * scale,
               x + gx * scale - 1, y + gy * scale - 1, color)
        end
      end
    end
    x = x + 4 * scale
  end
end

local function limb(points, color, thick)
  for i = 1, #points - 1 do
    line(points[i][1], points[i][2], points[i + 1][1], points[i + 1][2], P.ink, thick + 2)
  end
  for i = 1, #points - 1 do
    line(points[i][1], points[i][2], points[i + 1][1], points[i + 1][2], color, thick)
  end
end

local function hand(x, y)
  rect(x - 1, y - 1, x + 2, y + 2, P.ink)
  rect(x, y, x + 1, y + 1, P.skinShadow)
end

local function shoe(x, y, dir)
  dir = dir or 1
  if dir > 0 then
    rect(x - 1, y - 3, x + 7, y + 2, P.ink)
    rect(x, y - 3, x + 5, y, P.shoe)
    rect(x + 2, y - 1, x + 8, y + 1, P.shoe)
    rect(x + 2, y + 2, x + 8, y + 2, P.sole)
  else
    rect(x - 7, y - 3, x + 1, y + 2, P.ink)
    rect(x - 5, y - 3, x, y, P.shoe)
    rect(x - 8, y - 1, x - 2, y + 1, P.shoe)
    rect(x - 8, y + 2, x - 2, y + 2, P.sole)
  end
end

local function head(cx, cy, view, fearless)
  rect(cx - 5, cy - 6, cx + 5, cy + 4, P.ink)
  rect(cx - 3, cy - 5, cx + 4, cy + 3, P.skin)
  rect(cx + 2, cy + 1, cx + 4, cy + 3, P.skinShadow)
  if view == "front" then
    rect(cx - 6, cy - 8, cx + 5, cy - 3, P.ink)
    rect(cx - 6, cy - 9, cx + 3, cy - 5, P.hair)
    rect(cx - 4, cy - 5, cx + 5, cy - 2, P.hairDark)
    rect(cx - 1, cy - 8, cx + 5, cy - 6, P.hairHi)
    pix(cx - 2, cy - 1, P.ink)
    pix(cx + 2, cy - 1, P.ink)
    line(cx - 2, cy - 3, cx, cy - 3, P.ink, 1)
    line(cx + 1, cy - 3, cx + 3, cy - 4, P.ink, 1)
  else
    rect(cx - 6, cy - 8, cx + 5, cy - 3, P.ink)
    rect(cx - 6, cy - 9, cx + 2, cy - 5, P.hair)
    rect(cx - 8, cy - 7, cx - 4, cy - 2, P.hairDark)
    rect(cx - 1, cy - 8, cx + 4, cy - 6, P.hairHi)
    if fearless then
      rect(cx - 15, cy - 8, cx - 8, cy - 5, P.gold)
      rect(cx - 20, cy - 7, cx - 14, cy - 5, P.hair)
      rect(cx - 23, cy - 6, cx - 20, cy - 5, P.hairDark)
    else
      rect(cx - 12, cy - 7, cx - 7, cy - 4, P.hair)
      rect(cx - 15, cy - 6, cx - 12, cy - 4, P.hairDark)
    end
    pix(cx + 3, cy - 1, P.ink)
    line(cx + 1, cy - 4, cx + 4, cy - 4, P.ink, 1)
    rect(cx + 2, cy + 3, cx + 4, cy + 3, P.ink2)
  end
end

local function torso(sx, sy, hx, hy)
  polyOutline({{sx - 6, sy}, {sx + 6, sy - 1}, {hx + 5, hy + 13}, {hx - 6, hy + 12}}, P.tank, P.ink)
  rect(sx - 3, sy + 3, sx + 4, sy + 4, P.tankShadow)
  polyOutline({{hx - 7, hy + 10}, {hx + 7, hy + 10}, {hx + 6, hy + 19}, {hx - 6, hy + 18}}, P.shorts, P.ink)
  rect(hx + 1, hy + 12, hx + 6, hy + 18, P.shortsShadow)
end

local function heroine(x, y, pose)
  local ox, oy = x, y
  if pose.fearless then
    rect(ox + 9, oy + 9, ox + 57, oy + 59, P.gold)
    rect(ox + 10, oy + 10, ox + 56, oy + 58, P.bg)
    rect(ox + 4, oy + 14, ox + 14, oy + 16, P.cyan)
    rect(ox + 2, oy + 27, ox + 13, oy + 30, P.gold)
    rect(ox + 3, oy + 42, ox + 13, oy + 44, P.cyan)
  end
  if pose.dust then
    rect(ox + pose.dust[1], oy + 55, ox + pose.dust[1] + 7, oy + 56, C("#8a7861"))
    rect(ox + pose.dust[1] + 8, oy + 57, ox + pose.dust[1] + 14, oy + 58, C("#8a7861"))
  end

  head(ox + pose.head[1], oy + pose.head[2], pose.view or "side", pose.fearless)
  torso(ox + pose.shoulder[1], oy + pose.shoulder[2], ox + pose.hip[1], oy + pose.hip[2])

  limb({{ox + pose.armA[1], oy + pose.armA[2]}, {ox + pose.armA[3], oy + pose.armA[4]}, {ox + pose.armA[5], oy + pose.armA[6]}}, P.skin, 3)
  limb({{ox + pose.armB[1], oy + pose.armB[2]}, {ox + pose.armB[3], oy + pose.armB[4]}, {ox + pose.armB[5], oy + pose.armB[6]}}, P.skin, 3)
  hand(ox + pose.armA[5], oy + pose.armA[6])
  hand(ox + pose.armB[5], oy + pose.armB[6])

  limb({{ox + pose.legA[1], oy + pose.legA[2]}, {ox + pose.legA[3], oy + pose.legA[4]}, {ox + pose.legA[5], oy + pose.legA[6]}}, P.skin, 4)
  limb({{ox + pose.legB[1], oy + pose.legB[2]}, {ox + pose.legB[3], oy + pose.legB[4]}, {ox + pose.legB[5], oy + pose.legB[6]}}, P.skin, 4)
  shoe(ox + pose.footA[1], oy + pose.footA[2], pose.footA[3])
  shoe(ox + pose.footB[1], oy + pose.footB[2], pose.footB[3])

  if pose.pad then
    rect(ox + pose.pad[1] - 2, oy + pose.pad[2] - 2, ox + pose.pad[1] + 3, oy + pose.pad[2] + 2, P.ink)
    rect(ox + pose.pad[1] - 1, oy + pose.pad[2] - 1, ox + pose.pad[1] + 2, oy + pose.pad[2] + 1, P.pink)
  end
end

rect(0, 0, W - 1, H - 1, P.bg)
text(12, 8, "HEROINE MODEL SHEET V2", P.text, 2)
text(296, 10, "64X64", P.textBlue, 2)
text(296, 24, "BASE Y58", P.textBlue, 1)

local poses = {
  {"FRONT", {view="front", head={32,16}, shoulder={32,24}, hip={32,34}, armA={26,25,22,36,20,44}, armB={38,25,42,36,44,44}, legA={28,50,27,56,25,59}, legB={36,50,37,56,39,59}, footA={25,59,-1}, footB={39,59,1}}},
  {"SIDE", {head={35,15}, shoulder={33,24}, hip={32,34}, armA={29,25,23,34,19,43}, armB={38,25,44,34,48,43}, legA={30,51,23,55,16,59}, legB={38,51,45,55,53,59}, footA={16,59,-1}, footB={53,59,1}}},
  {"3/4", {head={36,15}, shoulder={34,24}, hip={33,34}, armA={29,25,22,35,18,44}, armB={39,25,47,30,53,35}, legA={30,51,23,55,16,59}, legB={39,51,42,56,49,59}, footA={16,59,-1}, footB={49,59,1}}},
  {"RUN", {head={38,16}, shoulder={35,25}, hip={34,36}, armA={31,26,23,31,17,38}, armB={40,26,49,31,54,39}, legA={31,52,23,50,17,56}, legB={40,52,48,54,57,59}, footA={17,56,-1}, footB={57,59,1}, dust={6}}},
  {"JUMP", {head={37,13}, shoulder={34,22}, hip={33,32}, armA={30,23,23,28,18,35}, armB={39,23,47,29,51,37}, legA={31,49,23,45,16,38}, legB={40,49,44,56,53,57}, footA={16,38,-1}, footB={53,57,1}}},
  {"THROW", {head={37,16}, shoulder={34,25}, hip={33,35}, armA={30,26,22,35,18,43}, armB={40,26,50,25,59,23}, legA={31,52,24,56,16,59}, legB={40,52,47,55,55,59}, footA={16,59,-1}, footB={55,59,1}, pad={55,21}}},
  {"CHARGE", {head={39,22}, shoulder={35,30}, hip={33,40}, armA={31,31,24,37,20,45}, armB={40,31,47,37,51,45}, legA={31,55,22,57,15,60}, legB={41,55,50,56,58,58}, footA={15,60,-1}, footB={58,58,1}, dust={8}}},
  {"FEARLESS", {fearless=true, head={39,15}, shoulder={35,24}, hip={34,35}, armA={31,25,22,30,16,37}, armB={40,25,50,30,56,37}, legA={31,52,23,49,15,55}, legB={41,52,50,54,59,58}, footA={15,55,-1}, footB={59,58,1}}},
}

for i, item in ipairs(poses) do
  local label, pose = item[1], item[2]
  local col = (i - 1) % 4
  local row = math.floor((i - 1) / 4)
  local x = 12 + col * 92
  local y = 40 + row * 78
  rect(x - 2, y - 2, x + 65, y + 65, P.grid)
  rect(x - 1, y - 1, x + 64, y + 64, P.panel)
  for gy = 7, 63, 8 do line(x, y + gy, x + 63, y + gy, P.grid, 1) end
  line(x, y + 58, x + 63, y + 58, P.baseline, 1)
  heroine(x, y, pose)
  text(x + 1, y + 68, label, P.text, 1)
end

local chips = {
  {"INK", P.ink}, {"SKIN", P.skin}, {"HAIR", P.hair}, {"TANK", P.tank},
  {"SHORTS", P.shorts}, {"SHOE", P.shoe}, {"FEAR", P.gold}, {"SPEED", P.cyan}
}
local cx = 12
for _, chip in ipairs(chips) do
  rect(cx, 198, cx + 6, 204, chip[2])
  text(cx + 9, 198, chip[1], P.text, 1)
  cx = cx + 46
end

app.refresh()
sprite:saveAs(sourcePath)
sprite:saveAs(pngPath)
app.exit()
