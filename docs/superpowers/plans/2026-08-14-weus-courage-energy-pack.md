# WeUs Courage Energy Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ordinary map pad refills with a jump-collected WeUs courage energy pack that grants 5 seconds of Fearless while keeping ten ordinary pads as distinct projectile ammo.

**Architecture:** Keep `index.html` as the canonical Canvas game source and add one pure `CouragePackDirector` section for deterministic spacing and safe spawn deferral. Route both Combo and pack rewards through one capped Fearless grant function, while adding a narrow obstacle-director resume hook for late extensions. Keep release copies generated from the canonical source.

**Tech Stack:** Static HTML, Canvas 2D, vanilla JavaScript, Node.js built-in test runner, existing static build script, Playwright CLI for browser verification.

## Global Constraints

- Ordinary pads remain projectile ammo and use `assets/items/pad.png`.
- Starting ordinary pad ammo is exactly 10.
- The map only drops `assets/items/sanitary-pad-energy-pack.png`.
- A pack grants exactly 5 seconds of Fearless and never increases ordinary pad inventory.
- Fearless time is capped at exactly 15 seconds.
- Existing three-hit Combo Fearless remains exactly 10 seconds.
- No title, Logo, ending-screen, obstacle-hitbox, Combo-rule, or difficulty-stage changes.
- `index.html` is the only hand-edited runtime source; release copies are generated.
- The pre-change rollback archive is `/Users/teensygao/Desktop/FemAI共学/SisterRun-snapshots/2026-08-14-before-weus-energy-pack.zip`.

---

### Task 1: Deterministic pack rhythm and Fearless state tests

**Files:**
- Create: `tests/courage-energy-pack.test.cjs`
- Modify: `tests/obstacle-director.test.cjs`
- Modify: `index.html`

**Interfaces:**
- Produces: `CouragePackDirector.create(rng, initialSpeed)` and `CouragePackDirector.advance(state, frame) -> boolean`.
- Produces: `ObstacleDirector.extendFearless(state)` for resuming a late Fearless extension.

- [x] **Step 1: Write failing extraction tests**

Add tests that extract `/* COURAGE_PACK_DIRECTOR_START */` through `/* COURAGE_PACK_DIRECTOR_END */`, then verify the 12-second lock, deterministic interval bounds, unsafe deferral, and single safe release. Extend the obstacle-director tests so `extendFearless()` moves `fearless-exit` back to `fearless-dense` without resetting an already dense run.

- [x] **Step 2: Run the focused tests and verify failure**

Run: `node --test tests/courage-energy-pack.test.cjs tests/obstacle-director.test.cjs`  
Expected: FAIL because `CouragePackDirector` and `ObstacleDirector.extendFearless` do not exist.

- [x] **Step 3: Add the minimal pure directors**

Implement these exact frame inputs:

```js
CouragePackDirector.advance(state, {
  time: game.time,
  distance: move * dt,
  speed: move,
  safeToSpawn: unresolvedCount < 2 && p.invuln <= 0 && p.cough <= 0 && game.slow <= 0,
  hasPack: game.couragePacks.length > 0
});
```

The pack director schedules 18–28 effective running seconds, updates them from actual distance divided by actual speed, and returns `true` only once when due and safe. This prevents acceleration from moving the first drop before 18 seconds. `extendFearless()` resumes `fearless-dense` only from exit or recovery states.

- [x] **Step 4: Run focused tests**

Run: `node --test tests/courage-energy-pack.test.cjs tests/obstacle-director.test.cjs`  
Expected: PASS.

### Task 2: Asset registration and distinct item runtime

**Files:**
- Modify: `assets/assets.json`
- Modify: `index.html`
- Test: `tests/courage-energy-pack.test.cjs`

**Interfaces:**
- Consumes: `CouragePackDirector` from Task 1.
- Produces: `spawnCouragePack()`, `drawCouragePacks()`, `grantFearless(seconds, source)`.

- [x] **Step 1: Add failing reward and initial-ammo behavior tests**

Exercise the pure Fearless reward rules for 5-second start, 5-second extension, 15-second cap, and unchanged 10-second Combo reward. Update the existing real-browser keyboard and touch tests to require `×10` at start and `×9` after one ordinary throw. Check removed refill markers separately during final scope inspection rather than treating source text as gameplay behavior.

- [x] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/courage-energy-pack.test.cjs`  
Expected: FAIL on the old starting ammo and refill markers.

- [x] **Step 3: Implement distinct asset, spawn, collision, and rendering paths**

Register this sprite state in both manifests:

```json
"courageEnergyPack": {
  "frames": 1,
  "frameSize": [64, 64],
  "baselineY": 64,
  "file": "items/sanitary-pad-energy-pack.png"
}
```

Replace `pickups` with `couragePacks`, use a square collision box matching the visible item, draw with `smooth: false`, and preserve the existing ordinary pad sprite exclusively in projectile rendering and HUD ammo display.

- [x] **Step 4: Implement shared Fearless grants**

Use these exact durations and cap:

```js
const COMBO_FEARLESS_SECONDS = 10;
const COURAGE_PACK_FEARLESS_SECONDS = 5;
const MAX_FEARLESS_SECONDS = 15;
```

`grantFearless(5, "courage-pack")` starts at 5 seconds when inactive or adds 5 seconds when active, clamps at 15, resumes the obstacle director when extending late, leaves `game.pads` unchanged, and emits “勇气能量 +5秒”. `activateFearless()` delegates to `grantFearless(10, "combo")`.

- [x] **Step 5: Run the focused tests**

Run: `node --test tests/courage-energy-pack.test.cjs tests/obstacle-director.test.cjs`  
Expected: PASS.

### Task 3: Release build and regression verification

**Files:**
- Modify: `tests/build-static.test.mjs`
- Generate: `dist/index.html`
- Generate: `dist/assets/items/sanitary-pad-energy-pack.png`
- Generate: `sisterrun-sandbox-iframe/index.html`
- Generate: `sisterrun-sandbox-iframe/sanitary-pad-energy-pack.png`

**Interfaces:**
- Consumes: canonical `index.html` and its embedded manifest.
- Produces: deployable layered and flattened static builds.

- [x] **Step 1: Add failing build assertions**

Require `const CouragePackDirector`, `courageEnergyPack`, and `COURAGE_PACK_FEARLESS_SECONDS` in canonical, dist, and iframe HTML. Require the new asset in both output layouts.

- [x] **Step 2: Generate release outputs**

Run: `node scripts/build-static.mjs`  
Expected: `Built dist and sandbox iframe` with no missing or colliding asset error.

- [x] **Step 3: Run all automated tests**

Run: `node --test tests/*.cjs tests/*.mjs`  
Expected: all tests pass.

- [x] **Step 4: Inspect change scope**

Compare source contracts and generated artifacts. Confirm that ordinary projectile rendering still calls `getSprite("items", "padSpin")`, while map rendering only calls `getSprite("items", "courageEnergyPack")`.

### Task 4: Browser playtest and visual evidence

**Files:**
- Create: `output/playwright/weus-energy-pack.png`

**Interfaces:**
- Consumes: generated `dist/` build.
- Produces: visual proof and browser-state checks for the integrated feature.

- [x] **Step 1: Start a local static server and open the game**

Run: `python3 -m http.server <free-port> -d dist` and open the URL with the existing Playwright CLI.

- [x] **Step 2: Verify ordinary ammo behavior**

Start the game, assert the HUD begins at `×10`, throw once and assert `×9`, then force a pack collision through page evaluation and assert the HUD reads `×∞` while `game.fearless` is near 5.

- [x] **Step 3: Verify extension, cap, and inventory restoration**

Collect while active, assert the remaining time increases by about 5; set it near 14 and collect again, assert it does not exceed 15; let Fearless end and assert the HUD returns to `×9`.

- [x] **Step 4: Capture and inspect visual evidence**

Capture the pack during active gameplay at desktop size. Check that the WeUs graphic is crisp, the pack is visibly airborne, the HUD is readable, and no ordinary pad refill appears on the map.

- [x] **Step 5: Check console and reduced-effects behavior**

Confirm no new console errors and verify the pack remains visible without rotation or excessive animation when reduced effects are enabled.

## Plan self-review

- Spec coverage: item distinction, ammo count, drop rhythm, Fearless timing, late extension, feedback, build outputs, rollback, automated tests, and playtest are each assigned to a task.
- Placeholder scan: no deferred requirements or unspecified implementation steps remain.
- Interface consistency: runtime uses `CouragePackDirector`, `couragePacks`, `spawnCouragePack()`, `drawCouragePacks()`, `grantFearless(seconds, source)`, and `ObstacleDirector.extendFearless(state)` consistently.
- Repository constraint: Git commits are omitted because the current directory is not a Git repository; the verified ZIP snapshot is the rollback checkpoint.
