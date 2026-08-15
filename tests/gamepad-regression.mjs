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
  const session = `sisterrun-gamepad-${process.pid}-${Date.now()}`;
  t.after(() => {
    pw(session, "close");
    server.kill("SIGTERM");
  });
  await new Promise(resolveReady => setTimeout(resolveReady, 250));
  await callback({ session, url: `http://127.0.0.1:${port}/` });
}

const installGamepad = `async page => {
  await page.addInitScript(() => {
    const state = {
      connected: true,
      mapping: 'standard',
      pressed: [],
      axes: [0, 0, 0, 0]
    };
    const gamepad = {
      id: 'Xbox Wireless Controller',
      index: 0,
      connected: true,
      mapping: 'standard',
      timestamp: 1,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }))
    };
    window.__setTestGamepad = update => {
      Object.assign(state, update);
      gamepad.connected = state.connected;
      gamepad.mapping = state.mapping;
      gamepad.timestamp += 1;
      gamepad.axes = [...state.axes];
      gamepad.buttons = Array.from({ length: 17 }, (_, index) => ({
        pressed: state.pressed.includes(index),
        touched: state.pressed.includes(index),
        value: state.pressed.includes(index) ? 1 : 0
      }));
    };
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => state.connected ? [gamepad] : []
    });
    window.__setTestGamepad({});
  });
}`;

test("Xbox A, X, Menu and disconnect map into the existing game loop", { timeout: 60000 }, async t => {
  await withGame(t, async ({ session, url }) => {
    pw(session, "open", "about:blank");
    pw(session, "run-code", installGamepad);
    pw(session, "run-code", `async page => {
      await page.goto('${url}?gamepad=${Date.now()}');
      await page.locator('#gamepadStatus').waitFor();
      const status = await page.locator('#gamepadStatus').textContent();
      if (status !== 'Xbox 手柄已连接') throw new Error('unexpected status: ' + status);

      await page.evaluate(() => window.__setTestGamepad({ pressed: [0] }));
      await page.waitForTimeout(180);
      const heldCourage = await page.locator('#courageFill').evaluate(node => node.style.width);
      await page.evaluate(() => window.__setTestGamepad({ pressed: [] }));
      await page.waitForTimeout(60);
      if (heldCourage !== '1%') throw new Error('held A repeated or failed to jump: ' + heldCourage);
      if ((await page.locator('#padsPanel').textContent()) !== '×10') throw new Error('A consumed a pad');

      await page.reload();
      await page.evaluate(() => window.__setTestGamepad({ pressed: [2] }));
      await page.waitForTimeout(80);
      await page.evaluate(() => window.__setTestGamepad({ pressed: [] }));
      await page.waitForTimeout(60);
      if ((await page.locator('#padsPanel').textContent()) !== '×10') throw new Error('ready X consumed a pad');

      await page.evaluate(() => window.__setTestGamepad({ pressed: [2] }));
      await page.waitForTimeout(60);
      await page.evaluate(() => window.__setTestGamepad({ pressed: [] }));
      await page.waitForTimeout(80);
      if ((await page.locator('#padsPanel').textContent()) !== '×9') throw new Error('fresh X did not throw one pad');

      await page.evaluate(() => window.__setTestGamepad({ pressed: [2] }));
      await page.waitForTimeout(430);
      await page.evaluate(() => window.__setTestGamepad({ pressed: [] }));
      await page.waitForTimeout(80);
      if ((await page.locator('#padsPanel').textContent()) !== '×9') throw new Error('charged X consumed a pad');

      await page.evaluate(() => window.__setTestGamepad({ pressed: [2] }));
      await page.waitForTimeout(430);
      await page.evaluate(() => window.__setTestGamepad({ connected: false }));
      await page.waitForTimeout(80);
      await page.evaluate(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
      });
      await page.waitForTimeout(80);
      if ((await page.locator('#padsPanel').textContent()) !== '×8') throw new Error('disconnect did not cancel gamepad charge');

      await page.reload();
      await page.evaluate(() => window.__setTestGamepad({ pressed: [9] }));
      await page.waitForTimeout(80);
      if (!(await page.locator('#startOverlay').evaluate(node => node.hidden))) throw new Error('Menu did not start the game');
      if ((await page.locator('#padsPanel').textContent()) !== '×10') throw new Error('Menu start changed ammo');
    }`);
  });
});
