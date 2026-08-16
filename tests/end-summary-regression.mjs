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

test("end summary counts knockbacks, excludes jumped smoke, and resets for a new run", { timeout: 60000 }, async t => {
  const port = await freePort();
  const server = spawn("python3", ["-m", "http.server", String(port), "-d", projectRoot], { stdio: "ignore" });
  const session = `sisterrun-end-summary-${process.pid}-${Date.now()}`;
  t.after(() => {
    try { pw(session, "close"); } catch {}
    server.kill("SIGTERM");
  });

  await new Promise(resolveReady => setTimeout(resolveReady, 250));
  pw(session, "open", "about:blank");
  pw(session, "run-code", `async page => {
    await page.addInitScript(() => {
      Math.random = () => 0.9;
      let time = 0;
      let nextId = 0;
      let queued = [];
      window.requestAnimationFrame = callback => {
        queued.push({ id: ++nextId, callback });
        return nextId;
      };
      window.cancelAnimationFrame = id => {
        queued = queued.filter(frame => frame.id !== id);
      };
      window.__stepGameFrames = count => {
        for (let index = 0; index < count; index++) {
          const frames = queued;
          queued = [];
          time += 1000 / 60;
          for (const frame of frames) frame.callback(time);
        }
      };
    });
    await page.goto('http://127.0.0.1:${port}/?end-summary=' + Date.now());
    await page.getByRole('button', { name: '开始跑！' }).click();

    const step = count => page.evaluate(frames => window.__stepGameFrames(frames), count);
    await step(275);
    await page.keyboard.press('ArrowUp');
    await step(50);
    const afterSmoke = await page.locator('#comboPanel').textContent();
    if (!afterSmoke.includes('FEARLESS 1/3')) {
      throw new Error('jumped smoke was not completed through the collision loop: ' + afterSmoke);
    }

    await page.keyboard.press('Space');
    for (let index = 0; index < 50; index++) {
      await step(1);
      if ((await page.locator('#comboPanel').textContent()).includes('COMBO ×2')) break;
    }
    const afterKnockback = await page.locator('#comboPanel').textContent();
    if (!afterKnockback.includes('COMBO ×2')) {
      throw new Error('actual obstacle knockback did not complete: ' + afterKnockback);
    }

    for (let index = 0; index < 2000 && await page.locator('#endOverlay').isHidden(); index += 30) {
      await step(30);
    }
    const firstTitle = await page.locator('#endTitle').textContent();
    if (firstTitle !== '恭喜你撞飞了 1 个老登') throw new Error('first run title: ' + firstTitle);

    const powerCardsLink = page.getByRole('link', { name: '翻转卡牌' });
    if (!await powerCardsLink.isVisible()) throw new Error('flip-card link is not visible on the end screen');
    const powerCardsHref = await powerCardsLink.getAttribute('href');
    if (powerCardsHref !== '#cards') {
      throw new Error('flip-card link href: ' + powerCardsHref);
    }

    await page.getByRole('button', { name: '再跑一局' }).click();
    for (let index = 0; index < 2000 && await page.locator('#endOverlay').isHidden(); index += 30) {
      await step(30);
    }
    const secondTitle = await page.locator('#endTitle').textContent();
    if (secondTitle !== '恭喜你撞飞了 0 个老登') throw new Error('second run title: ' + secondTitle);
  }`);
});

test("a fatal collision rejects a later projectile knockback in the same frame", { timeout: 60000 }, async t => {
  const port = await freePort();
  const server = spawn("python3", ["-m", "http.server", String(port), "-d", projectRoot], { stdio: "ignore" });
  const session = `sisterrun-terminal-end-${process.pid}-${Date.now()}`;
  t.after(() => {
    try { pw(session, "close"); } catch {}
    server.kill("SIGTERM");
  });

  await new Promise(resolveReady => setTimeout(resolveReady, 250));
  pw(session, "open", "about:blank");
  pw(session, "run-code", `async page => {
    await page.addInitScript(() => {
      Math.random = () => 0.9;
      const nativePush = Array.prototype.push;
      window.__spawnedObstacles = [];
      window.__spawnedProjectiles = [];
      Array.prototype.push = function (...items) {
        for (const item of items) {
          if (item && typeof item === 'object' && 'scored' in item && 'talkLife' in item) {
            nativePush.call(window.__spawnedObstacles, item);
          } else if (item && typeof item === 'object' && 'spin' in item && 'vx' in item && 'hit' in item) {
            nativePush.call(window.__spawnedProjectiles, item);
          }
        }
        return nativePush.apply(this, items);
      };

      let time = 0;
      let nextId = 0;
      let queued = [];
      window.requestAnimationFrame = callback => {
        queued.push({ id: ++nextId, callback });
        return nextId;
      };
      window.cancelAnimationFrame = id => {
        queued = queued.filter(frame => frame.id !== id);
      };
      window.__stepGameFrames = count => {
        for (let index = 0; index < count; index++) {
          const frames = queued;
          queued = [];
          time += 1000 / 60;
          for (const frame of frames) frame.callback(time);
        }
      };
    });
    await page.goto('http://127.0.0.1:${port}/?terminal-end=' + Date.now());
    await page.getByRole('button', { name: '开始跑！' }).click();

    const result = await page.evaluate(() => {
      const used = new Set();
      const fresh = () => window.__spawnedObstacles.filter(obstacle =>
        !used.has(obstacle) && !obstacle.hit && !obstacle.fly
      );
      const parkFresh = except => {
        for (const obstacle of fresh()) {
          if (obstacle !== except) obstacle.x = 800;
        }
      };

      for (let hit = 0; hit < 4; hit++) {
        for (let frames = 0; frames < 1000 && fresh().length === 0; frames++) {
          window.__stepGameFrames(1);
        }
        const obstacle = fresh()[0];
        if (!obstacle) throw new Error('could not obtain obstacle for setup hit ' + (hit + 1));
        parkFresh(obstacle);
        obstacle.x = 172;
        window.__stepGameFrames(1);
        used.add(obstacle);
        for (let invulnerability = 0; invulnerability < 70; invulnerability++) {
          parkFresh(null);
          window.__stepGameFrames(1);
        }
      }

      for (let frames = 0; frames < 1000 && fresh().length < 2; frames++) {
        parkFresh(null);
        window.__stepGameFrames(1);
      }
      const candidates = fresh();
      const fatal = candidates[0];
      const target = candidates.find((obstacle, index) => index > 0 && obstacle.type !== 'smoke');
      if (!fatal || !target) {
        throw new Error('could not obtain ordered fatal/knockback obstacles: ' + candidates.map(o => o.type).join(','));
      }

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
      const projectile = window.__spawnedProjectiles.at(-1);
      if (!projectile) throw new Error('real keyboard attack did not create a projectile');

      for (const obstacle of fresh()) obstacle.x = 800;
      fatal.x = 172;
      target.x = 400;
      projectile.x = 400;
      window.__stepGameFrames(1);

      return {
        title: document.querySelector('#endTitle').textContent,
        targetFlew: target.fly,
        lives: document.querySelector('#lives').getAttribute('aria-label')
      };
    });

    if (result.title !== '恭喜你撞飞了 0 个老登') throw new Error('fatal-frame title: ' + result.title);
    if (result.lives !== '0 条生命') throw new Error('collision was not fatal: ' + result.lives);
    if (result.targetFlew) {
      throw new Error('obstacle entered knockback after game over while title stayed ' + result.title);
    }
  }`);
});
