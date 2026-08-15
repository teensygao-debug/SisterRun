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
  const server = spawn("python3", ["-m", "http.server", String(port), "-d", projectRoot], { stdio: "ignore" });
  const session = `sisterrun-mobile-release-${process.pid}-${Date.now()}`;
  t.after(() => {
    pw(session, "close");
    server.kill("SIGTERM");
  });
  await new Promise(resolveReady => setTimeout(resolveReady, 250));
  await callback({ session, url: `http://127.0.0.1:${port}/` });
}

test("before start the page requests only core visual assets and no audio", { timeout: 60000 }, async t => {
  await withGame(t, async ({ session, url }) => {
    pw(session, "open", "about:blank");
    pw(session, "run-code", `async page => {
      await page.goto('${url}?core-load=${Date.now()}');
      await page.waitForTimeout(1500);
      const assets = await page.evaluate(() => performance.getEntriesByType('resource')
        .map(entry => new URL(entry.name).pathname)
        .filter(path => path.includes('/assets/')));
      const allowed = [
        '/assets/backgrounds/daytime_v2.webp',
        '/assets/player/run/heroine_run_sheet_8frames_transparent.png',
        '/assets/items/sanitary-pad-energy-pack.png'
      ];
      const unexpected = assets.filter(path => !allowed.includes(path));
      if (unexpected.length) throw new Error('unexpected pre-start assets: ' + JSON.stringify(unexpected));
      for (const path of allowed) {
        if (!assets.includes(path)) throw new Error('missing core asset: ' + path);
      }
    }`);
  });
});

test("mobile portrait keeps 16:9 and shows a rotate notice only in portrait", { timeout: 60000 }, async t => {
  await withGame(t, async ({ session, url }) => {
    pw(session, "open", "about:blank");
    pw(session, "run-code", `async page => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('${url}?portrait=${Date.now()}');
      const portrait = await page.evaluate(() => {
        const shell = document.querySelector('#gameShell').getBoundingClientRect();
        const notice = document.querySelector('#orientationNotice');
        return {
          ratio: shell.width / shell.height,
          noticeVisible: notice && getComputedStyle(notice).display !== 'none'
        };
      });
      if (Math.abs(portrait.ratio - 16 / 9) > 0.02 || !portrait.noticeVisible) {
        throw new Error('bad portrait layout: ' + JSON.stringify(portrait));
      }

      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(100);
      const landscape = await page.evaluate(() => {
        const shell = document.querySelector('#gameShell').getBoundingClientRect();
        const notice = document.querySelector('#orientationNotice');
        return {
          ratio: shell.width / shell.height,
          noticeVisible: notice && getComputedStyle(notice).display !== 'none'
        };
      });
      if (Math.abs(landscape.ratio - 16 / 9) > 0.02 || landscape.noticeVisible) {
        throw new Error('bad landscape layout: ' + JSON.stringify(landscape));
      }
    }`);
  });
});
