# Xbox Gamepad and TV Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Xbox controller support to the locally served SisterRun game and change courage-pack drops to 15–22 effective running seconds without regressing keyboard or touch controls.

**Architecture:** Keep `index.html` as the canonical single-file runtime. Add a pure, marker-delimited `GamepadInput` state machine for standard Gamepad API samples, then translate its edge-triggered actions into the existing `startGame`, `jump`, `beginCharge`, and `releaseAttack` functions once per animation frame. Rebuild both release entry points with the existing static build script.

**Tech Stack:** HTML/CSS, vanilla JavaScript, browser Gamepad API, Node.js built-in test runner, Playwright CLI, Python static HTTP server.

## Global Constraints

- Xbox controller is connected to the Mac; the TV only displays the Mac output.
- Keep keyboard and touch controls unchanged.
- A, D-pad Up, and left-stick Up jump; X throws or charges; Menu starts or restarts.
- Starting with X must preserve all 10 initial pads and must not attack on the matching release.
- Use only one standard-mapping controller; no multiplayer, remapping, or vibration.
- Courage packs appear every 15–22 effective running seconds and retain the 12-second opening lock and safety checks.
- Courage packs still grant five Fearless seconds, capped at fifteen seconds.
- The rollback artifact is `/Users/teensygao/Desktop/FemAI共学/SisterRun-snapshots/2026-08-14-before-xbox-gamepad.zip` with SHA-256 `0fb11c94a83862ea04a63307fa5142ece72813b5c036a671222114ef3bc0f83b`.
- This workspace has no Git metadata, so the ZIP snapshot replaces worktree and commit checkpoints.

---

### Task 1: Courage-pack timing

**Files:**
- Modify: `tests/courage-energy-pack.test.cjs`
- Modify: `index.html`
- Modify: `docs/superpowers/specs/2026-08-14-weus-courage-energy-pack-design.md`

**Interfaces:**
- Consumes: `CouragePackDirector.create(rng, speed)` and `CouragePackDirector.advance(state, frame)`.
- Produces: a director that samples 15–22 seconds and cannot emit before 15 effective running seconds.

- [x] **Step 1: Change the timing expectations before production code**

Update the boundary test to expect `3750` pixels at 250 px/s for RNG `0`, and `5499.99825` pixels for RNG `0.999999`. Change the acceleration test loop and assertion boundary from 18 to 15 seconds.

- [x] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/courage-energy-pack.test.cjs`

Expected: the two edited tests fail because the runtime still schedules 18–28 seconds.

- [x] **Step 3: Implement the minimum timing change**

In the marker-delimited courage-pack director, set:

```js
const INTERVAL_SECONDS_MIN = 15;
const INTERVAL_SECONDS_MAX = 22;
```

Update the existing WeUs design document so its timing statements match 15–22 seconds.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/courage-energy-pack.test.cjs`

Expected: all courage-pack tests pass.

### Task 2: Pure Xbox input state machine

**Files:**
- Create: `tests/gamepad-input.test.cjs`
- Modify: `index.html`

**Interfaces:**
- Produces: `GamepadInput.create() -> state`, `GamepadInput.sample(state, gamepads) -> action`, and `GamepadInput.reset(state) -> void`.
- `action` contains booleans `jump`, `attackPressed`, `attackReleased`, and `menu`, plus `cancelCharge`, `connected`, and `controllerName`.

- [x] **Step 1: Write failing unit tests against a marker-delimited source block**

Create tests that extract `/* GAMEPAD_INPUT_START */ ... /* GAMEPAD_INPUT_END */` from `index.html`, evaluate it in `vm`, and use complete standard-pad fixtures. Cover these observable behaviors:

```js
assert.equal(sampleWithButton(0).jump, true);       // A rising edge
assert.equal(sampleHeldButton(0).jump, false);      // held A does not repeat
assert.equal(sampleWithButton(12).jump, true);      // D-pad Up
assert.equal(sampleWithAxis1(-0.65).jump, true);    // stick crossing threshold
assert.equal(sampleWithAxis1(-0.5).jump, false);    // hysteresis keeps latch
assert.equal(sampleWithAxis1(-0.2).jump, false);    // release latch
assert.equal(sampleWithButton(2).attackPressed, true);
assert.equal(sampleAfterButtonRelease(2).attackReleased, true);
assert.equal(sampleWithButton(9).menu, true);
assert.equal(sampleAfterDisconnect().cancelCharge, true);
```

Also verify a non-standard pad is reported as unsupported and emits no game action.

- [x] **Step 2: Run the unit test and verify RED**

Run: `node --test tests/gamepad-input.test.cjs`

Expected: failure because the marker block and `GamepadInput` do not exist.

- [x] **Step 3: Add the minimal pure state machine**

Use Xbox standard indices `A=0`, `X=2`, `Menu=9`, `D-pad Up=12`; use axis 1 with `-0.65` trigger and `-0.35` release thresholds. Select the first active standard controller, retain it while connected, return only rising/falling edges, and return `cancelCharge` when the active controller disappears.

- [x] **Step 4: Run the unit test and verify GREEN**

Run: `node --test tests/gamepad-input.test.cjs`

Expected: all state-machine tests pass.

### Task 3: Runtime mapping and TV-readable status

**Files:**
- Create: `tests/gamepad-regression.mjs`
- Modify: `index.html`

**Interfaces:**
- Consumes: `GamepadInput.sample`, existing `startGame`, `jump`, `beginCharge`, and `releaseAttack`.
- Produces: `pollGamepad()` called before `update(dt)` in the animation loop and visible `#gamepadStatus` connection feedback.

- [x] **Step 1: Write browser regression tests before integration code**

Use `page.addInitScript` before navigation to install a controlled `navigator.getGamepads()` implementation with one complete standard Xbox fixture. Verify:

1. Status changes from “手柄未检测” to “Xbox 手柄已连接” after an active sample.
2. A starts the game and changes the player from its grounded position once, without repeating while held.
3. X pressed and released from the ready screen preserves `#padsPanel` as `×10`; a fresh X press/release changes it to `×9`.
4. Holding X long enough follows the existing charged-release path without consuming a pad.
5. Menu starts from ready and restarts from ended without an attack.
6. Disconnect while X is held clears charging and does not create a projectile.

- [x] **Step 2: Run the browser test and verify RED**

Run: `node --test tests/gamepad-regression.mjs`

Expected: failure because `#gamepadStatus` and gamepad polling do not exist.

- [x] **Step 3: Add UI and runtime translation**

Add the start-screen copy:

```html
<p class="gamepadHelp">手柄 A：跳跃 · X：投掷/蓄力 · Menu：开始</p>
<div id="gamepadStatus" aria-live="polite">手柄未检测 · 请按任意手柄键</div>
```

Add `gamepadStatus` to the cached HUD elements. Poll once per animation frame before `update(dt)`, translate edges into existing game functions, and use `gamepadStartAttackPending` to suppress the first X release after starting. On blur, disconnect, and `endGame`, clear pending state and set `game.player.charging = false` without calling `releaseAttack()`.

- [x] **Step 4: Run browser and existing input tests and verify GREEN**

Run:

```bash
node --test tests/gamepad-regression.mjs tests/input-audio-regression.mjs
```

Expected: Xbox, keyboard, touch, and audio regression tests all pass.

### Task 4: Build and full verification

**Files:**
- Modify through generator: `dist/index.html`
- Modify through generator: `sisterrun-sandbox-iframe/index.html`

**Interfaces:**
- Consumes: canonical root `index.html`.
- Produces: local-server and iframe release pages containing the same gamepad runtime and 15–22 second timing.

- [x] **Step 1: Build both release entry points**

Run: `node scripts/build-static.mjs`

Expected: build exits successfully and updates both generated pages.

- [x] **Step 2: Run all automated tests**

Run:

```bash
node --test tests/*.test.cjs tests/*.test.mjs tests/*regression.mjs
```

Expected: every test passes with zero failures.

- [x] **Step 3: Verify the active local server and refresh the game page**

Confirm `http://127.0.0.1:8000/` returns HTTP 200 and serves the new `#gamepadStatus` markup. Reload the existing local browser tab.

- [x] **Step 4: Perform visual and hardware-ready checks**

At desktop/TV viewport size, confirm the start panel remains readable, the gamepad instruction does not overlap existing controls, the canvas renders, and browser console has no new errors. The final physical-controller acceptance is to press A, X, and Menu on the already-connected Xbox controller and observe the on-screen status and actions.
