# SisterRun Game Loop Runtime Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the current SisterRun gameplay while eliminating release-version drift, first-input attack misfires, unnecessary HUD writes, and avoidable collision-loop allocations.

**Architecture:** Treat the root `index.html` as the only authored game source. A deterministic Node build script generates the layered `dist/` package and flattened sandbox iframe package, then verifies that gameplay code and referenced resources match the source. Runtime changes are made only in the root source and propagated by that build.

**Tech Stack:** Static HTML, Canvas 2D, browser JavaScript, Node.js built-in modules and `node:test`, Playwright CLI, Python static HTTP server.

## Global Constraints

- Do not change scoring values, Courage values, collision geometry, controls after the game has started, obstacle sequencing, FEARLESS trigger rules, or FEARLESS duration.
- Keep `SisterRun/index.html` as the canonical authored source.
- Generate `dist/index.html` and `sisterrun-sandbox-iframe/index.html`; do not hand-maintain gameplay logic in those files.
- Preserve the layered `assets/` paths in `dist` and flattened relative paths in the sandbox iframe package.
- A new run starts BGM from the beginning, uses the existing single `Audio` instance, and never layers duplicate BGM playback.
- The input that starts a ready game must not also charge, throw, dash, or consume a pad.
- Runtime optimizations must preserve visible HUD values and collision outcomes.
- The project is not a Git repository. Use test output, file hashes, and review reports as checkpoints; do not initialize Git.

---

### Task 1: Canonical Build And Release Consistency

**Files:**
- Create: `scripts/build-static.mjs`
- Create: `tests/build-static.test.mjs`
- Modify: `README.md`
- Generate: `dist/index.html`
- Generate: `sisterrun-sandbox-iframe/index.html`

**Interfaces:**
- Consumes: canonical `index.html` and files under `assets/`.
- Produces: `node scripts/build-static.mjs`, which deterministically generates both release entry points and validates every emitted local asset reference.

- [x] Write Node tests that run the build in a temporary directory and assert: root gameplay code is present in both outputs; `dist` uses `assets/...`; iframe uses flattened relative files; every local reference exists; `stars_01.png` has no leading-space dependency.
- [x] Run `node --test tests/build-static.test.mjs` and confirm failure because the build script does not exist.
- [x] Implement the minimum deterministic build script using Node built-ins and structured path maps. Refuse basename collisions in the flattened iframe package.
- [x] Generate both release packages from the root source and update README preview/build commands.
- [x] Run the Node test, JavaScript syntax checks for all three entry points, and resource-existence validation.
- [x] Record hashes for the three generated HTML files and changed-file list in the task report.

### Task 2: Start-Input Isolation And BGM New-Run Semantics

**Files:**
- Modify: `index.html`
- Create: `tests/input-audio-regression.mjs`
- Generate: `dist/index.html`
- Generate: `sisterrun-sandbox-iframe/index.html`

**Interfaces:**
- Consumes: Task 1 build command.
- Produces: ready-state input handlers that return after `startGame()`, plus an audio new-run operation that rewinds the existing BGM instance before playback.

- [x] Write browser-level regression assertions for ready-state Space and touch ATTACK: game starts, pad count is unchanged, and release does not attack. Add an assertion that a subsequent fresh press still attacks normally.
- [x] Add an audio-focused test proving Restart rewinds the existing BGM element without creating a second one.
- [x] Run the regression and confirm the existing implementation fails the start-input and rewind assertions.
- [x] Make the minimum source changes: consume the first ready-state attack input without entering charge, and rewind BGM for a new run through the existing audio controller.
- [x] Rebuild release outputs and run all tests.
- [x] Browser-smoke keyboard, pointer, Start, Game Over, Restart, and BGM behavior.

### Task 3: Dirty-Value HUD Updates

**Files:**
- Modify: `index.html`
- Create: `tests/hud-regression.mjs`
- Generate: `dist/index.html`
- Generate: `sisterrun-sandbox-iframe/index.html`

**Interfaces:**
- Consumes: existing `updateHud()` call sites.
- Produces: a HUD cache invalidated by `resetGame()`; unchanged frame values do not rewrite lives or pad DOM, while dynamic FEARLESS text and reward pulse remain current.

- [x] Write a browser test with `MutationObserver` counters proving repeated unchanged frames currently rewrite `#lives` and `#padsPanel`.
- [x] Confirm the test fails against the existing source.
- [x] Add the smallest HUD cache needed for lives, score, pads, Courage width, reward text, FEARLESS text/visibility, and Combo text/visibility. Preserve current CSS classes and animations.
- [x] Rebuild and run tests; verify unchanged frames stop rebuilding DOM while throw and Restart still update immediately. Existing obstacle/Fearless regressions remain green.

### Task 4: Collision-Loop Allocation Reduction

**Files:**
- Modify: `index.html`
- Create: `tests/collision-regression.mjs`
- Generate: `dist/index.html`
- Generate: `sisterrun-sandbox-iframe/index.html`

**Interfaces:**
- Consumes: `rectsHit`, current player and obstacle collision geometry.
- Produces: one player hitbox per frame and one obstacle hitbox per obstacle iteration, without changing their numeric bounds.

- [x] Lock the existing player and obstacle hitbox geometry in a regression test.
- [x] Assert the collision update contains only one player hitbox calculation and one obstacle hitbox calculation per obstacle iteration; confirm the old loop fails.
- [x] Cache the player box once per update and each obstacle box once per obstacle loop. Replace only redundant calls; do not introduce object pools or alter coordinates.
- [x] Defer array compaction because current evidence only justifies hitbox reuse.
- [x] Rebuild and run collision tests plus a natural Game Over/Restart browser smoke run.

### Task 5: Final Integration Review And QA

**Files:**
- Review: all files changed by Tasks 1-4
- Reference: `doc/QA_CHECKLIST_DEMO.md`

**Interfaces:**
- Consumes: all task reports and generated packages.
- Produces: final verification evidence and a concise remaining-risk list.

- [x] Review source/output boundaries and confirm generated files contain no independent gameplay edits.
- [x] Run all Node tests and syntax checks from a clean build.
- [x] Serve `dist` over HTTP; verify Start, Jump, Throw, Charge, Game Over, Restart, keyboard, and touch controls. ObstacleDirector tests cover hit/Fearless sequencing.
- [x] Capture desktop and mobile screenshots and inspect HUD/playfield overlap.
- [x] Confirm requested local assets return without HTTP errors and browser console has no red errors.
- [x] Report exact modified files, verification results, and deferred gameplay-design decisions. Courage/FEARLESS semantics were not changed.
