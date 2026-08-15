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

test("unchanged frames do not rebuild HUD children, while throw and restart still update", { timeout: 60000 }, async t => {
  const port = await freePort();
  const server = spawn("python3", ["-m", "http.server", String(port), "-d", projectRoot], { stdio: "ignore" });
  const session = `sisterrun-hud-${process.pid}-${Date.now()}`;
  t.after(() => {
    try { pw(session, "close"); } catch {}
    server.kill("SIGTERM");
  });

  await new Promise(resolveReady => setTimeout(resolveReady, 250));
  pw(session, "open", `http://127.0.0.1:${port}/?hud=${Date.now()}`);
  pw(session, "run-code", `async page => {
    await page.getByRole('button', { name: '开始跑！' }).click();
    const baseline = await page.evaluate(async () => {
      const counts = { lives: 0, pads: 0 };
      const livesObserver = new MutationObserver(records => { counts.lives += records.length; });
      const padsObserver = new MutationObserver(records => { counts.pads += records.length; });
      livesObserver.observe(document.querySelector('#lives'), { childList: true, subtree: true });
      padsObserver.observe(document.querySelector('#padsPanel'), { childList: true, subtree: true });
      await new Promise(resolve => setTimeout(resolve, 250));
      livesObserver.disconnect();
      padsObserver.disconnect();
      return counts;
    });
    if (baseline.lives !== 0 || baseline.pads !== 0) throw new Error('unchanged HUD mutated: ' + JSON.stringify(baseline));

    const beforeThrow = await page.locator('#padsPanel').textContent();
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(50);
    const afterThrow = await page.locator('#padsPanel').textContent();
    if (beforeThrow !== '×10' || afterThrow !== '×9') throw new Error('throw HUD stale: ' + beforeThrow + ' -> ' + afterThrow);

    await page.locator('#restartButton').evaluate(button => button.click());
    await page.waitForTimeout(50);
    const afterRestart = await page.locator('#padsPanel').textContent();
    if (afterRestart !== '×10') throw new Error('restart HUD stale: ' + afterRestart);
  }`);
});
