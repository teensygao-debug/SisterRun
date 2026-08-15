import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const playwright = resolve(process.env.HOME, ".codex/skills/playwright/scripts/playwright_cli.sh");

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  server.close();
  await once(server, "close");
  return port;
}

function pw(session, ...args) {
  const result = spawnSync(playwright, ["--session", session, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    timeout: 30000
  });
  if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

async function withGame(t, callback) {
  const port = await freePort();
  const server = spawn("python3", ["-m", "http.server", String(port), "-d", projectRoot], {
    stdio: "ignore"
  });
  const session = `sisterrun-input-${process.pid}-${Date.now()}`;
  t.after(() => {
    pw(session, "close");
    server.kill("SIGTERM");
  });
  await new Promise(resolveReady => setTimeout(resolveReady, 250));
  await callback({ session, url: `http://127.0.0.1:${port}/` });
}

test("ready Space starts with ten pads without consuming one, then a fresh Space attacks", { timeout: 60000 }, async t => {
  await withGame(t, async ({ session, url }) => {
    pw(session, "open", `${url}?keyboard=${Date.now()}`);
    pw(session, "run-code", `async page => {
      await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true })));
      await page.waitForTimeout(120);
      await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true, cancelable: true })));
      await page.waitForTimeout(50);
      const firstPads = await page.locator('#padsPanel').textContent();
      if (firstPads !== '×10') throw new Error('start input did not preserve ten pads: ' + firstPads);
      await page.evaluate(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
      });
      await page.waitForTimeout(50);
      const secondPads = await page.locator('#padsPanel').textContent();
      if (secondPads !== '×9') throw new Error('fresh input did not consume one of ten pads: ' + secondPads);
    }`);
  });
});

test("ready touch ATTACK starts with ten pads without consuming one, then a fresh press attacks", { timeout: 60000 }, async t => {
  await withGame(t, async ({ session, url }) => {
    pw(session, "open", `${url}?touch=${Date.now()}`);
    pw(session, "run-code", `async page => {
      const attack = page.locator('#touchAttack');
      await attack.evaluate(button => {
        button.setPointerCapture = () => {};
        button.releasePointerCapture = () => {};
      });
      await attack.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch' });
      await attack.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch' });
      await page.waitForTimeout(50);
      const firstPads = await page.locator('#padsPanel').textContent();
      if (firstPads !== '×10') throw new Error('start touch did not preserve ten pads: ' + firstPads);
      await attack.dispatchEvent('pointerdown', { pointerId: 2, pointerType: 'touch' });
      await attack.dispatchEvent('pointerup', { pointerId: 2, pointerType: 'touch' });
      await page.waitForTimeout(50);
      const secondPads = await page.locator('#padsPanel').textContent();
      if (secondPads !== '×9') throw new Error('fresh touch did not consume one of ten pads: ' + secondPads);
    }`);
  });
});

test("a new run reuses and rewinds the existing BGM instance", { timeout: 60000 }, async t => {
  await withGame(t, async ({ session, url }) => {
    pw(session, "open", "about:blank");
    pw(session, "run-code", `async page => {
      await page.addInitScript(() => {
        window.__audioInstances = [];
        window.Audio = class FakeAudio {
          constructor() { this.currentTime = 0; this.paused = true; this.readyState = 4; window.__audioInstances.push(this); }
          addEventListener() {}
          load() {}
          play() { this.paused = false; return Promise.resolve(); }
          pause() { this.paused = true; }
        };
      });
      await page.goto('${url}?audio=${Date.now()}');
      await page.getByRole('button', { name: '开始跑！' }).click();
      await page.evaluate(() => { window.__audioInstances[0].currentTime = 42; });
      await page.locator('#restartButton').evaluate(button => button.click());
      const result = await page.evaluate(() => ({ count: window.__audioInstances.length, currentTime: window.__audioInstances[0].currentTime }));
      if (result.count !== 1 || result.currentTime !== 0) throw new Error(JSON.stringify(result));
    }`);
  });
});

test("BGM is created only after the player starts", { timeout: 60000 }, async t => {
  await withGame(t, async ({ session, url }) => {
    pw(session, "open", "about:blank");
    pw(session, "run-code", `async page => {
      await page.addInitScript(() => {
        window.__audioInstances = [];
        window.Audio = class FakeAudio {
          constructor() { this.currentTime = 0; this.paused = true; this.readyState = 0; this.src = ''; window.__audioInstances.push(this); }
          addEventListener() {}
          load() {}
          play() { this.paused = false; this.readyState = 4; return Promise.resolve(); }
          pause() { this.paused = true; }
        };
      });
      await page.goto('${url}?audio-deferred=${Date.now()}');
      const before = await page.evaluate(() => ({
        count: window.__audioInstances.length,
        preloadLinks: [...document.querySelectorAll('link[rel="preload"]')].filter(link => /bgm_main_loop/.test(link.href)).length
      }));
      if (before.count !== 0 || before.preloadLinks !== 0) throw new Error('BGM loaded before start: ' + JSON.stringify(before));

      await page.getByRole('button', { name: '开始跑！' }).click();
      const after = await page.evaluate(() => ({
        count: window.__audioInstances.length,
        src: window.__audioInstances[0]?.src || ''
      }));
      if (after.count !== 1 || !after.src.endsWith('assets/audio/bgm_main_loop.mp3')) {
        throw new Error('BGM not initialized on start: ' + JSON.stringify(after));
      }
    }`);
  });
});
