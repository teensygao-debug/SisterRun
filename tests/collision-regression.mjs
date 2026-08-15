import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = await readFile(resolve(projectRoot, "index.html"), "utf8");

test("player and obstacle hitbox geometry remains unchanged", () => {
  assert.match(source, /return \{ x: p\.x \+ 7, y: p\.y \+ 8, w: p\.w - 12 \+ \(p\.dash > 0 \? 30 : 0\), h: p\.h - 10 \};/);
  assert.match(source, /if \(o\.type === "smoke"\) return \{ x: o\.x \+ 8, y: o\.y \+ 10, w: o\.w - 18, h: o\.h - 8 \};/);
  assert.match(source, /if \(o\.type === "harasser"\) return \{ x: o\.x \+ 4, y: o\.y \+ 4, w: o\.w - 5, h: o\.h - 3 \};/);
  assert.match(source, /return \{ x: o\.x \+ 5, y: o\.y \+ 5, w: o\.w - 9, h: o\.h - 4 \};/);
});

test("collision update reuses one player box per frame and one obstacle box per obstacle", () => {
  const updateBody = source.match(/function update\(dt\) \{([\s\S]*?)\n      function updateParticles\(dt\)/)?.[1];
  assert.ok(updateBody, "update function not found");
  assert.equal((updateBody.match(/playerHitbox\(\)/g) || []).length, 1);
  assert.equal((updateBody.match(/obstacleHitbox\(o\)/g) || []).length, 1);
  assert.match(updateBody, /const playerBox = playerHitbox\(\);/);
  assert.match(updateBody, /for \(const o of game\.obstacles\)[\s\S]*?const obstacleBox = obstacleHitbox\(o\);/);
  assert.match(updateBody, /rectsHit\(playerBox, box\)/);
  assert.match(updateBody, /rectsHit\(pr, obstacleBox\)/);
  assert.match(updateBody, /rectsHit\(playerBox, obstacleBox\)/);
});
