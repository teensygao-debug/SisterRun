import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, rmSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const buildScript = join(projectRoot, "scripts", "build-static.mjs");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "sisterrun-build-"));
  cpSync(join(projectRoot, "index.html"), join(root, "index.html"));
  cpSync(join(projectRoot, "assets"), join(root, "assets"), { recursive: true });
  return root;
}

function runBuild(root) {
  return execFileSync(process.execPath, [buildScript, "--root", root], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function referencedFiles(html, iframe = false) {
  const refs = new Set();
  for (const match of html.matchAll(/(?:href|src)=["']\.\/([^"']+)["']/g)) refs.add(match[1]);
  const bgm = html.match(/const BGM_SRC = "([^"]+)"/);
  if (bgm) refs.add(bgm[1]);
  for (const match of html.matchAll(/"file": "([^"]+)"/g)) {
    refs.add(iframe ? match[1] : `assets/${match[1]}`);
  }
  return [...refs].filter(path => !path.startsWith("data:"));
}

function directoryBytes(path) {
  return readdirSync(path, { withFileTypes: true }).reduce((total, entry) => {
    const child = join(path, entry.name);
    return total + (entry.isDirectory() ? directoryBytes(child) : statSync(child).size);
  }, 0);
}

test("build emits current canonical gameplay into both release entry points", () => {
  const root = fixture();
  runBuild(root);
  const source = readFileSync(join(root, "index.html"), "utf8");
  const dist = readFileSync(join(root, "dist", "index.html"), "utf8");
  const iframe = readFileSync(join(root, "sisterrun-sandbox-iframe", "index.html"), "utf8");

  for (const marker of ["const ObstacleDirector", "addCourage(method === \"jump\" ? 1 : 2)", "ObstacleDirector.onPlayerHurt"]) {
    assert.ok(source.includes(marker), `canonical source is missing ${marker}`);
    assert.ok(dist.includes(marker), `dist is missing ${marker}`);
    assert.ok(iframe.includes(marker), `iframe is missing ${marker}`);
  }
});

test("build preserves layered dist paths and flattens iframe paths", () => {
  const root = fixture();
  runBuild(root);
  const dist = readFileSync(join(root, "dist", "index.html"), "utf8");
  const iframe = readFileSync(join(root, "sisterrun-sandbox-iframe", "index.html"), "utf8");

  assert.match(dist, /const BGM_SRC = "assets\/audio\/bgm_main_loop\.mp3"/);
  assert.match(dist, /"file": "player\/run\/heroine_run_sheet_8frames_transparent\.png"/);
  assert.match(iframe, /const BGM_SRC = "bgm_main_loop\.mp3"/);
  assert.match(iframe, /"file": "heroine_run_sheet_8frames_transparent\.png"/);
  assert.doesNotMatch(iframe, /(?:href|src)=["']\.\/assets\//);
  assert.doesNotMatch(iframe, /return `assets\/\$\{basePath/);
  assert.doesNotMatch(dist, /fx\/ stars_01\.png/);
});

test("all emitted local references exist", () => {
  const root = fixture();
  runBuild(root);
  for (const target of ["dist", "sisterrun-sandbox-iframe"]) {
    const html = readFileSync(join(root, target, "index.html"), "utf8");
    for (const path of referencedFiles(html, target === "sisterrun-sandbox-iframe")) {
      assert.ok(existsSync(join(root, target, path)), `${target} is missing ${path}`);
    }
  }
});

test("current release outputs include the WeUs courage energy pack", () => {
  const sourceAsset = readFileSync(join(projectRoot, "assets", "items", "sanitary-pad-energy-pack.png"));
  const distAsset = readFileSync(join(projectRoot, "dist", "assets", "items", "sanitary-pad-energy-pack.png"));
  const iframeAsset = readFileSync(join(projectRoot, "sisterrun-sandbox-iframe", "sanitary-pad-energy-pack.png"));
  assert.deepEqual(distAsset, sourceAsset);
  assert.deepEqual(iframeAsset, sourceAsset);
});

test("a fresh build copies the WeUs courage energy pack into both layouts", () => {
  const root = fixture();
  runBuild(root);
  const sourceAsset = readFileSync(join(root, "assets", "items", "sanitary-pad-energy-pack.png"));
  assert.deepEqual(readFileSync(join(root, "dist", "assets", "items", "sanitary-pad-energy-pack.png")), sourceAsset);
  assert.deepEqual(readFileSync(join(root, "sisterrun-sandbox-iframe", "sanitary-pad-energy-pack.png")), sourceAsset);
});

test("build removes stale files from both release outputs", () => {
  const root = fixture();
  const staleDist = join(root, "dist", "assets", "old", "unused.png");
  const staleIframe = join(root, "sisterrun-sandbox-iframe", "unused.png");
  mkdirSync(dirname(staleDist), { recursive: true });
  mkdirSync(dirname(staleIframe), { recursive: true });
  writeFileSync(staleDist, "stale");
  writeFileSync(staleIframe, "stale");

  runBuild(root);

  assert.equal(existsSync(staleDist), false);
  assert.equal(existsSync(staleIframe), false);
});

test("clean layered release assets stay below twelve MiB", () => {
  const root = fixture();
  runBuild(root);
  const bytes = directoryBytes(join(root, "dist", "assets"));
  assert.ok(bytes < 12 * 1024 * 1024, `release assets use ${(bytes / 1024 / 1024).toFixed(2)} MiB`);
});

test("build rejects a missing referenced asset", () => {
  const root = fixture();
  rmSync(join(root, "assets", "release", "items", "pad.png"));

  assert.throws(
    () => runBuild(root),
    /missing source asset: assets\/release\/items\/pad\.png/i
  );
});

test("build rejects a missing WeUs courage energy pack", () => {
  const root = fixture();
  rmSync(join(root, "assets", "items", "sanitary-pad-energy-pack.png"));

  assert.throws(
    () => runBuild(root),
    /missing source asset: assets\/items\/sanitary-pad-energy-pack\.png/i
  );
});

test("flattened build rejects different assets with the same basename", () => {
  const fixture = mkdtempSync(join(tmpdir(), "sisterrun-build-"));
  mkdirSync(join(fixture, "assets", "a"), { recursive: true });
  mkdirSync(join(fixture, "assets", "b"), { recursive: true });
  writeFileSync(join(fixture, "assets", "a", "same.png"), "first");
  writeFileSync(join(fixture, "assets", "b", "same.png"), "second");
  writeFileSync(join(fixture, "index.html"), `
    <link rel="preload" href="./assets/a/same.png">
    <script>
      const BGM_SRC = "assets/b/same.png";
      const VISUAL_FREEZE_MANIFEST = { "sprites": {}, "background": {}, "ui": {} };
      function assetPath(basePath, file) { return \`assets/\${basePath || ""}\${file}\`; }
    </script>
  `);
  cpSync(buildScript, join(fixture, "build-static.mjs"));

  assert.throws(
    () => execFileSync(process.execPath, [join(fixture, "build-static.mjs"), "--root", fixture], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }),
    /basename collision/i
  );
});
