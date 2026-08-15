# Mobile Release Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare SisterRun for mobile GitHub Pages trials with a lighter first load, correct portrait behavior, clean release outputs, and user-initiated BGM loading.

**Architecture:** Keep the single-file game architecture. Split the existing manifest loader into core and deferred phases, preserve procedural fallbacks, and make the build outputs reproducible by deleting them before copy. Use browser-level regression tests for observable loading and responsive behavior.

**Tech Stack:** HTML/CSS/Canvas JavaScript, Node.js test runner, Playwright CLI, Node.js static build script.

## Global Constraints

- Do not change game rules, initial ammunition, Fearless duration, input mappings, or energy-pack timing.
- Keep source art in `assets`; remove unused files from generated release outputs only.
- Preserve HTTP-relative asset paths for GitHub Pages project-site deployment.

---

### Task 1: Clean release outputs

**Files:**
- Modify: `scripts/build-static.mjs`
- Modify: `tests/build-static.test.mjs`

- [x] Add a test that seeds stale files in both output directories, runs the real build, and expects those stale files to be absent.
- [x] Run the focused build test and confirm it fails because output directories are not cleaned.
- [x] Remove both output directories with `rmSync(..., { recursive: true, force: true })` before recreating them.
- [x] Run the focused build test and confirm it passes.

### Task 2: Defer noncritical visuals and BGM

**Files:**
- Modify: `index.html`
- Modify: `tests/input-audio-regression.mjs`
- Create: `tests/mobile-release-regression.mjs`

- [x] Add browser tests proving that no Audio instance or BGM request exists before start and that only core images load before start.
- [x] Run the focused browser tests and confirm current eager loading fails them.
- [x] Split visual loading into core and deferred phases, remove unused speech entries, and start deferred loading after player input.
- [x] Remove the BGM preload link and boot-time Audio creation; create and source Audio from `startGame()`.
- [x] Run focused tests and confirm they pass.

### Task 3: Preserve portrait aspect ratio

**Files:**
- Modify: `index.html`
- Modify: `tests/mobile-release-regression.mjs`

- [x] Add browser tests for 16:9 portrait sizing and portrait-only rotation notice.
- [x] Run the test and confirm the current portrait layout fails.
- [x] Replace the portrait stretch rule and add an accessible rotation notice.
- [x] Run the test and confirm portrait and landscape behavior pass.

### Task 4: Rebuild and release verification

**Files:**
- Generated: `dist/**`
- Generated: `sisterrun-sandbox-iframe/**`

- [x] Run the complete serial test suite.
- [x] Run a clean build and compare emitted files with referenced files.
- [x] Measure cold mobile resource count and bytes before starting.
- [x] Play through jump, attack, energy-pack/Fearless and restart on mobile landscape, capturing screenshots and frame timing.
