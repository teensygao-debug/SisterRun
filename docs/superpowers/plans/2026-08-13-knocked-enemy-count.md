# Knocked Enemy Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track every obstacle actually knocked into flight during one run and show that count in the fixed game-over title `恭喜你撞飞了 XX 个老登`.

**Architecture:** Keep the counter in the existing per-run `game` state and increment it at the single `knockObstacle()` transition used by projectile, dash, and FEARLESS knockbacks. Render the counter from `endGame()`, then use the existing static builder to regenerate `dist/` and `sisterrun-sandbox-iframe/` from canonical `index.html`.

**Tech Stack:** Static HTML, browser JavaScript, Node.js built-in test runner, Playwright CLI, existing static build script.

## Global Constraints

- Drunk, harasser, and smoke obstacles each count once when actually knocked into flight.
- Projectile, charged dash, and FEARLESS knockbacks all count.
- Jumping over smoke does not count.
- The same obstacle cannot count twice.
- Restarting the game resets the count to zero.
- Score and highest combo output remain unchanged.
- Do not modify scoring, combo, obstacle generation, collision feel, dialog layout, or unrelated copy.

---

### Task 1: Track and display knocked obstacles

**Files:**
- Create: `tests/end-summary-regression.mjs`
- Modify: `index.html:1829-1918`
- Generated: `dist/index.html`
- Generated: `sisterrun-sandbox-iframe/index.html`

**Interfaces:**
- Consumes: existing `game` run state, `knockObstacle(o, power, method)`, `endGame()`, and `node scripts/build-static.mjs`.
- Produces: numeric `game.knockedCount`; visible end title `恭喜你撞飞了 ${game.knockedCount} 个老登`.

- [ ] **Step 1: Write the failing browser behavior test**

Create a Playwright-backed Node test that loads the real page, starts a run, causes one actual obstacle to enter `knockObstacle()`, ends the run, and asserts that `#endTitle` reads `恭喜你撞飞了 1 个老登`. Restart, end the new run without a knockback, and assert `恭喜你撞飞了 0 个老登`. The test must also verify that merely jumping over smoke does not increase the count.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/end-summary-regression.mjs`

Expected: FAIL because the current game-over title is selected from `endTexts` and no per-run knocked count exists.

- [ ] **Step 3: Add the minimal counter and fixed title**

In `resetGame()` add:

```js
knockedCount: 0,
```

At the start of the valid knockback transition in `knockObstacle()` add:

```js
game.knockedCount++;
```

In `endGame()` replace the random title assignment with:

```js
hud.endTitle.textContent = `恭喜你撞飞了 ${game.knockedCount} 个老登`;
```

Do not increment from `successfulObstacle()`, because that function also handles jumping over smoke.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/end-summary-regression.mjs`

Expected: PASS with one knockback counted, a jumped smoke excluded, and restart reset confirmed.

- [ ] **Step 5: Regenerate release copies**

Run: `node scripts/build-static.mjs`

Expected: exit code `0`; `dist/index.html` and `sisterrun-sandbox-iframe/index.html` contain the canonical gameplay behavior with their respective asset paths.

- [ ] **Step 6: Run full verification**

Run: `node --test tests/*.mjs tests/*.cjs`

Expected: all tests pass with zero failures.

Run: `node scripts/build-static.mjs`

Expected: exit code `0` and no missing-asset or basename-collision errors.

- [ ] **Step 7: Review the resulting scope**

Confirm that the authored code change is limited to `index.html`, the new test is limited to end-summary behavior, and generated differences are limited to `dist/` and `sisterrun-sandbox-iframe/`. No commit command is included because this workspace is not a Git repository.
