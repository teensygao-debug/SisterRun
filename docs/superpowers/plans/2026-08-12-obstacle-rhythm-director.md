# SisterRun Obstacle Rhythm Director Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace independent random obstacle spawning with a testable rhythm director that reaches clear combination pressure at 60–90 seconds, provides safe recovery after damage, and turns Fearless into a dense obstacle-smashing reward.

**Architecture:** Keep SisterRun's current no-build, single-HTML runtime. Add a pure `ObstacleDirector` module inside each HTML file between stable source markers; the game loop consumes director events but keeps obstacle rendering, collision, scoring, and input unchanged. Test the pure module with Node's built-in `node:test` by extracting and evaluating the marked source from `index.html`, then assert that the same marked module is present in the two deployable HTML copies.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Canvas 2D, Node.js 24 built-in `node:test`, Python static HTTP server, browser playtesting.

## Global Constraints

- Ordinary difficulty is combination-led; speed is supporting pressure only.
- Speed targets are 250 at 0 seconds, approximately 330 at 45 seconds, approximately 410 at 90 seconds, and capped at 470 from 180 seconds onward.
- Ordinary combination slots per 12-unit deck are 0 before 20 seconds, 3 from 20–45 seconds, 6 from 45–75 seconds, and 8 from 75 seconds onward.
- The ordinary director emits at most one obstacle per animation frame and never allows more than two unresolved ordinary obstacles on screen.
- The same obstacle type may appear at most twice consecutively; the same double-obstacle combination may not repeat consecutively.
- Damage cancels the unspawned remainder of the current combination; the next rhythm unit is a single obstacle after a 25% longer gap.
- Fearless lasts 10 seconds: 0.6-second lead-in, dense rotation until the final 1 second, no new spawn in the final second, then 1.2 seconds of recovery.
- Do not add controls, obstacles, UI, dependencies, build tooling, or adaptive player modeling.
- Do not implement `BUG_LIST.md` performance items P1–P4 in this change.
- Preserve the existing resource-path and visual-setting differences in `dist/index.html` and `sisterrun-sandbox-iframe/index.html`; never replace either file wholesale.
- The directory is not currently a Git repository. Do not initialize Git as part of this work. Replace each commit checkpoint below with a concise record of changed files and passing verification commands. If the user makes the directory a repository before execution, use the listed commit message at that checkpoint.

## File Map

- Modify: `index.html` — canonical `ObstacleDirector` source and game-loop integration.
- Modify: `dist/index.html` — deployable copy of only the director and integration changes.
- Modify: `sisterrun-sandbox-iframe/index.html` — iframe copy of only the director and integration changes.
- Create: `tests/obstacle-director.test.cjs` — pure director, integration, copy-consistency, and syntax tests using Node built-ins only.
- Reference: `docs/superpowers/specs/2026-08-12-obstacle-rhythm-director-design.md` — approved behavior and scope.

## Preflight and Recovery Snapshot

Before Task 1, run these read-only checks and make recoverable temporary copies outside the project:

```bash
cd /Users/teensygao/Desktop/FemAI共学/SisterRun
git status --short 2>/dev/null || true
node --version
SISTERRUN_SNAPSHOT_DIR=$(mktemp -d)
cp index.html "$SISTERRUN_SNAPSHOT_DIR/index.html"
cp dist/index.html "$SISTERRUN_SNAPSHOT_DIR/dist-index.html"
cp sisterrun-sandbox-iframe/index.html "$SISTERRUN_SNAPSHOT_DIR/iframe-index.html"
echo "$SISTERRUN_SNAPSHOT_DIR"
```

Expected: Node 24 or another version supporting `node:test`; the snapshot directory contains three files. Keep the printed directory path until all tasks pass. Do not restore entire files automatically because they contain intentional differences; use the snapshots only for targeted comparison or recovery.

---

### Task 1: Add the test harness, stage boundaries, and continuous speed curve

**Files:**

- Create: `tests/obstacle-director.test.cjs`
- Modify: `index.html:915-918` — insert the pure module after shared helpers and before mutable game state.

**Interfaces:**

- Produces: `ObstacleDirector.stageAt(seconds: number): StageConfig`
- Produces: `ObstacleDirector.speedAt(seconds: number): number`
- `StageConfig` has `{ id: string, comboSlots: number, singleGap: number, comboRest: number }`.
- Later tasks extend the same `ObstacleDirector` return object without renaming these functions.

- [ ] **Step 1: Create a failing extraction and speed/stage test**

Create `tests/obstacle-director.test.cjs` with Node built-ins and the canonical HTML extractor:

```js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const DIRECTOR_START = "/* OBSTACLE_DIRECTOR_START */";
const DIRECTOR_END = "/* OBSTACLE_DIRECTOR_END */";

function extractDirectorSource(file) {
  const html = fs.readFileSync(file, "utf8");
  const start = html.indexOf(DIRECTOR_START);
  const end = html.indexOf(DIRECTOR_END);
  assert.notEqual(start, -1, `${file} is missing ${DIRECTOR_START}`);
  assert.notEqual(end, -1, `${file} is missing ${DIRECTOR_END}`);
  assert.ok(end > start, `${file} has reversed director markers`);
  return html.slice(start + DIRECTOR_START.length, end).trim();
}

function loadDirector(file = path.join(ROOT, "index.html")) {
  const source = extractDirectorSource(file);
  const sandbox = {};
  vm.runInNewContext(`${source}\nglobalThis.__director = ObstacleDirector;`, sandbox, {
    filename: file
  });
  return sandbox.__director;
}

function closeTo(actual, expected, tolerance = 0.01) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}

test("speed curve reaches the approved targets without boundary jumps", () => {
  const director = loadDirector();
  closeTo(director.speedAt(0), 250);
  closeTo(director.speedAt(45), 330);
  closeTo(director.speedAt(90), 410);
  closeTo(director.speedAt(180), 470);
  closeTo(director.speedAt(240), 470);
  for (const boundary of [45, 90, 180]) {
    assert.ok(Math.abs(director.speedAt(boundary + 0.001) - director.speedAt(boundary - 0.001)) < 0.01);
  }
});

test("stage boundaries use the approved 12-card combination counts", () => {
  const director = loadDirector();
  assert.deepEqual(
    [0, 19.999, 20, 44.999, 45, 74.999, 75, 89.999, 90].map(time => {
      const stage = director.stageAt(time);
      return [stage.id, stage.comboSlots];
    }),
    [
      ["warmup", 0], ["warmup", 0],
      ["groove", 3], ["groove", 3],
      ["switch", 6], ["switch", 6],
      ["pressure", 8], ["pressure", 8],
      ["endurance", 8]
    ]
  );
});
```

- [ ] **Step 2: Run the test and verify the marker is missing**

Run:

```bash
node --test tests/obstacle-director.test.cjs
```

Expected: FAIL containing `index.html is missing /* OBSTACLE_DIRECTOR_START */`.

- [ ] **Step 3: Add the marked pure module with exact stage and speed data**

Immediately after the existing `rand`, `pick`, `clamp`, and `rectsHit` helpers in `index.html`, add:

```js
      /* OBSTACLE_DIRECTOR_START */
      const ObstacleDirector = (() => {
        const STAGES = [
          { id: "warmup", start: 0, comboSlots: 0, singleGap: 420, comboRest: 460 },
          { id: "groove", start: 20, comboSlots: 3, singleGap: 400, comboRest: 450 },
          { id: "switch", start: 45, comboSlots: 6, singleGap: 360, comboRest: 420 },
          { id: "pressure", start: 75, comboSlots: 8, singleGap: 330, comboRest: 390 },
          { id: "endurance", start: 90, comboSlots: 8, singleGap: 320, comboRest: 380 }
        ];
        const SPEED_POINTS = [
          [0, 250],
          [45, 330],
          [90, 410],
          [180, 470]
        ];

        function stageAt(seconds) {
          for (let index = STAGES.length - 1; index >= 0; index--) {
            if (seconds >= STAGES[index].start) return STAGES[index];
          }
          return STAGES[0];
        }

        function speedAt(seconds) {
          const time = Math.max(0, seconds);
          for (let index = 1; index < SPEED_POINTS.length; index++) {
            const [nextTime, nextSpeed] = SPEED_POINTS[index];
            if (time <= nextTime) {
              const [previousTime, previousSpeed] = SPEED_POINTS[index - 1];
              const progress = (time - previousTime) / (nextTime - previousTime);
              return previousSpeed + (nextSpeed - previousSpeed) * progress;
            }
          }
          return SPEED_POINTS[SPEED_POINTS.length - 1][1];
        }

        return { stageAt, speedAt };
      })();
      /* OBSTACLE_DIRECTOR_END */
```

- [ ] **Step 4: Run the focused tests**

Run:

```bash
node --test tests/obstacle-director.test.cjs
```

Expected: 2 tests pass, 0 fail.

- [ ] **Step 5: Record the checkpoint**

Record: created `tests/obstacle-director.test.cjs`, modified only the marked module area of `index.html`, and `node --test tests/obstacle-director.test.cjs` passes.

If Git is available at execution time:

```bash
git add index.html tests/obstacle-director.test.cjs
git commit -m "test: define obstacle difficulty curve"
```

---

### Task 2: Build deterministic 12-unit decks and enforce selection constraints

**Files:**

- Modify: `index.html` — only inside the director markers created in Task 1.
- Modify: `tests/obstacle-director.test.cjs`

**Interfaces:**

- Consumes: `stageAt(seconds)` from Task 1.
- Produces: `ObstacleDirector.buildDeck(stageId: string, rng: () => number): RhythmUnit[]`
- Produces: `ObstacleDirector.createSeededRandom(seed: number): () => number` for deterministic tests and developer simulation only.
- `RhythmUnit` has `{ id: string, types: string[], internalGap: number, restGap: number, isCombo: boolean }`.
- Ordinary type names remain exactly `smoke`, `harasser`, and `drunk`.

- [ ] **Step 1: Add failing deck composition tests**

Append these tests:

```js
test("each stage builds a 12-unit deck with the exact combination count", () => {
  const director = loadDirector();
  for (const [stageId, comboCount] of [
    ["warmup", 0],
    ["groove", 3],
    ["switch", 6],
    ["pressure", 8],
    ["endurance", 8]
  ]) {
    const deck = director.buildDeck(stageId, director.createSeededRandom(42));
    assert.equal(deck.length, 12);
    assert.equal(deck.filter(unit => unit.isCombo).length, comboCount);
  }
});

test("the harder smoke-to-drunk combination does not appear before 45 seconds", () => {
  const director = loadDirector();
  for (let seed = 1; seed <= 100; seed++) {
    const groove = director.buildDeck("groove", director.createSeededRandom(seed));
    assert.equal(groove.some(unit => unit.id === "smoke-drunk"), false);
  }
  const laterIds = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    for (const unit of director.buildDeck("switch", director.createSeededRandom(seed))) laterIds.add(unit.id);
  }
  assert.equal(laterIds.has("smoke-drunk"), true);
});

test("seeded deck generation is repeatable and does not share mutable arrays", () => {
  const director = loadDirector();
  const first = director.buildDeck("pressure", director.createSeededRandom(7));
  const second = director.buildDeck("pressure", director.createSeededRandom(7));
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  first[0].types.push("mutation");
  assert.notEqual(JSON.stringify(first), JSON.stringify(second));
});
```

- [ ] **Step 2: Run tests and verify the new API is absent**

Run:

```bash
node --test tests/obstacle-director.test.cjs
```

Expected: the Task 1 tests pass; new tests fail because `buildDeck` or `createSeededRandom` is not a function.

- [ ] **Step 3: Add exact ordinary rhythm definitions**

Inside the module, after `SPEED_POINTS`, add these immutable definitions:

```js
        const TYPES = ["smoke", "harasser", "drunk"];
        const COMBOS = [
          { id: "smoke-harasser", types: ["smoke", "harasser"], internalGap: 330, minStage: 1, weight: 3 },
          { id: "harasser-smoke", types: ["harasser", "smoke"], internalGap: 360, minStage: 1, weight: 3 },
          { id: "drunk-smoke", types: ["drunk", "smoke"], internalGap: 380, minStage: 1, weight: 3 },
          { id: "smoke-drunk", types: ["smoke", "drunk"], internalGap: 380, minStage: 2, weight: 1 },
          { id: "harasser-drunk", types: ["harasser", "drunk"], internalGap: 270, minStage: 1, weight: 1 }
        ];
```

Use the approved internal distances directly. In particular, keep smoke-following transitions at 360–380 pixels so the player can land after the approximately 0.73-second full jump arc at later speeds.

- [ ] **Step 4: Implement deterministic shuffle and deck construction**

Add these module functions:

```js
        function createSeededRandom(seed) {
          let value = seed >>> 0;
          return () => {
            value = (value * 1664525 + 1013904223) >>> 0;
            return value / 4294967296;
          };
        }

        function shuffled(list, rng) {
          const copy = list.slice();
          for (let index = copy.length - 1; index > 0; index--) {
            const swapIndex = Math.floor(rng() * (index + 1));
            [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
          }
          return copy;
        }

        function cloneUnit(unit, restGap) {
          return {
            id: unit.id,
            types: unit.types.slice(),
            internalGap: unit.internalGap,
            restGap,
            isCombo: unit.types.length > 1
          };
        }

        function buildDeck(stageId, rng = Math.random) {
          const stageIndex = STAGES.findIndex(stage => stage.id === stageId);
          if (stageIndex < 0) throw new Error(`Unknown obstacle stage: ${stageId}`);
          const stage = STAGES[stageIndex];
          const weightedCombos = COMBOS
            .filter(combo => combo.minStage <= stageIndex)
            .flatMap(combo => Array.from({ length: combo.weight }, () => combo));
          const comboUnits = [];
          while (comboUnits.length < stage.comboSlots) {
            const candidates = weightedCombos.filter(combo => combo.id !== comboUnits.at(-1)?.id);
            const source = candidates.length ? candidates : weightedCombos;
            comboUnits.push(cloneUnit(source[Math.floor(rng() * source.length)], stage.comboRest));
          }
          const singleCount = 12 - comboUnits.length;
          const singleTypes = [];
          const typeOrder = shuffled(TYPES, rng);
          for (let index = 0; index < singleCount; index++) singleTypes.push(typeOrder[index % typeOrder.length]);
          const singles = singleTypes.map(type => ({
            id: `single-${type}`,
            types: [type],
            internalGap: 0,
            restGap: stage.singleGap,
            isCombo: false
          }));
          return shuffled(comboUnits.concat(singles), rng);
        }
```

Extend the module return object exactly to:

```js
        return { stageAt, speedAt, buildDeck, createSeededRandom };
```

- [ ] **Step 5: Run all director tests**

Run:

```bash
node --test tests/obstacle-director.test.cjs
```

Expected: 5 tests pass, 0 fail.

- [ ] **Step 6: Record the checkpoint**

Record the exact deck sizes, combo counts, and passing command. If Git is available:

```bash
git add index.html tests/obstacle-director.test.cjs
git commit -m "feat: add obstacle rhythm decks"
```

---

### Task 3: Implement ordinary emission, anti-repeat rules, screen cap, and damage recovery

**Files:**

- Modify: `index.html` — only inside the director markers.
- Modify: `tests/obstacle-director.test.cjs`

**Interfaces:**

- Consumes: `stageAt`, `buildDeck`, and the `RhythmUnit` shape from Tasks 1–2.
- Produces: `ObstacleDirector.create(rng?: () => number): DirectorState`
- Produces: `ObstacleDirector.advance(state: DirectorState, frame: DirectorFrame): SpawnEvent | null`
- Produces: `ObstacleDirector.onPlayerHurt(state: DirectorState, time: number): void`
- `DirectorFrame` has `{ dt: number, distance: number, time: number, fearlessRemaining: number, unresolvedCount: number }`.
- `SpawnEvent` has `{ type: string, unitId: string, unitStart: boolean, isCombo: boolean }`.

- [ ] **Step 1: Add a reusable simulation helper and failing safety tests**

Append:

```js
function collectOrdinaryEvents(director, state, count, time = 90) {
  const events = [];
  while (events.length < count) {
    const event = director.advance(state, {
      dt: 1 / 60,
      distance: 1000,
      time,
      fearlessRemaining: 0,
      unresolvedCount: 0
    });
    if (event) events.push(event);
  }
  return events;
}

test("ordinary emission never repeats one type more than twice", () => {
  const director = loadDirector();
  for (let seed = 1; seed <= 40; seed++) {
    const state = director.create(director.createSeededRandom(seed));
    const types = collectOrdinaryEvents(director, state, 500).map(event => event.type);
    assert.equal(types.some((type, index) => type === types[index - 1] && type === types[index - 2]), false);
  }
});

test("ordinary emission never starts the same combination twice in a row", () => {
  const director = loadDirector();
  for (let seed = 1; seed <= 40; seed++) {
    const state = director.create(director.createSeededRandom(seed));
    const combos = collectOrdinaryEvents(director, state, 500)
      .filter(event => event.unitStart && event.isCombo)
      .map(event => event.unitId);
    assert.equal(combos.some((id, index) => id === combos[index - 1]), false);
  }
});

test("long simulations stay near each stage's approved combination share", () => {
  const director = loadDirector();
  for (const [time, expectedShare] of [[30, 3 / 12], [60, 6 / 12], [90, 8 / 12]]) {
    const state = director.create(director.createSeededRandom(99 + time));
    const units = collectOrdinaryEvents(director, state, 4000, time).filter(event => event.unitStart);
    const sample = units.slice(0, 1200);
    const actualShare = sample.filter(event => event.isCombo).length / sample.length;
    assert.ok(Math.abs(actualShare - expectedShare) <= 0.04, `${time}s share was ${actualShare}`);
  }
});

test("ordinary mode holds a due spawn while two obstacles are unresolved", () => {
  const director = loadDirector();
  const state = director.create(director.createSeededRandom(3));
  assert.equal(director.advance(state, {
    dt: 1, distance: 1000, time: 50, fearlessRemaining: 0, unresolvedCount: 2
  }), null);
  assert.notEqual(director.advance(state, {
    dt: 1 / 60, distance: 0, time: 50, fearlessRemaining: 0, unresolvedCount: 1
  }), null);
});

test("damage cancels the queued combination and forces a delayed single unit", () => {
  const director = loadDirector();
  const state = director.create(director.createSeededRandom(11));
  let first;
  do {
    first = director.advance(state, {
      dt: 1 / 60, distance: 1000, time: 80, fearlessRemaining: 0, unresolvedCount: 0
    });
  } while (!first?.isCombo);
  director.onPlayerHurt(state, 80);
  assert.equal(director.advance(state, {
    dt: 1 / 60, distance: 1, time: 80, fearlessRemaining: 0, unresolvedCount: 0
  }), null);
  const next = director.advance(state, {
    dt: 1 / 60, distance: 1000, time: 80, fearlessRemaining: 0, unresolvedCount: 0
  });
  assert.equal(next.isCombo, false);
  assert.equal(next.unitStart, true);
});
```

- [ ] **Step 2: Run tests and verify the runtime API is absent**

Run:

```bash
node --test tests/obstacle-director.test.cjs
```

Expected: earlier tests pass; new tests fail because `create`, `advance`, or `onPlayerHurt` is missing.

- [ ] **Step 3: Add the exact director state**

Inside the module add:

```js
        function create(rng = Math.random) {
          return {
            rng,
            mode: "normal",
            modeTime: 0,
            stageId: null,
            deck: [],
            currentUnit: null,
            unitIndex: 0,
            distanceRemaining: STAGES[0].singleGap,
            lastType: null,
            sameTypeCount: 0,
            lastComboId: null,
            forceSingle: false,
            fearlessIndex: 0
          };
        }
```

Keep all state per game instance; do not put mutable deck or history arrays at module scope.

- [ ] **Step 4: Implement legal unit selection and ordinary advance**

Add helpers with these responsibilities and exact behavior:

```js
        function unitIsLegal(state, unit) {
          if (unit.isCombo && unit.id === state.lastComboId) return false;
          if (state.sameTypeCount >= 2 && unit.types[0] === state.lastType) return false;
          return true;
        }

        function safeSingle(state, stage) {
          const candidates = TYPES.filter(type => !(state.sameTypeCount >= 2 && type === state.lastType));
          const type = candidates[Math.floor(state.rng() * candidates.length)];
          return { id: `single-${type}`, types: [type], internalGap: 0, restGap: stage.singleGap, isCombo: false };
        }

        function takeNextUnit(state, time) {
          const stage = stageAt(time);
          if (state.stageId !== stage.id) {
            state.stageId = stage.id;
            state.deck = [];
          }
          if (state.forceSingle) {
            state.forceSingle = false;
            return safeSingle(state, stage);
          }
          if (!state.deck.length) state.deck = buildDeck(stage.id, state.rng);
          const legalIndex = state.deck.findIndex(unit => unitIsLegal(state, unit));
          if (legalIndex < 0) {
            state.deck.shift();
            return safeSingle(state, stage);
          }
          return state.deck.splice(legalIndex, 1)[0];
        }

        function rememberType(state, type) {
          if (type === state.lastType) state.sameTypeCount++;
          else {
            state.lastType = type;
            state.sameTypeCount = 1;
          }
        }
```

Implement the complete ordinary `advance(state, frame)` function:

```js
        function advance(state, frame) {
          state.distanceRemaining -= Math.max(0, frame.distance);
          if (state.distanceRemaining > 0) return null;
          if (frame.unresolvedCount >= 2) return null;

          if (!state.currentUnit) {
            state.currentUnit = takeNextUnit(state, frame.time);
            state.unitIndex = 0;
          }

          const unit = state.currentUnit;
          const type = unit.types[state.unitIndex];
          const event = {
            type,
            unitId: unit.id,
            unitStart: state.unitIndex === 0,
            isCombo: unit.isCombo
          };

          rememberType(state, type);
          state.unitIndex++;
          if (state.unitIndex < unit.types.length) {
            state.distanceRemaining = Math.max(1, unit.internalGap);
          } else {
            state.distanceRemaining = Math.max(1, unit.restGap);
            if (unit.isCombo) state.lastComboId = unit.id;
            state.currentUnit = null;
            state.unitIndex = 0;
          }
          return event;
        }
```

Implement damage recovery exactly:

```js
        function onPlayerHurt(state, time) {
          const stage = stageAt(time);
          state.mode = "normal";
          state.modeTime = 0;
          state.currentUnit = null;
          state.unitIndex = 0;
          state.forceSingle = true;
          state.distanceRemaining = stage.singleGap * 1.25;
        }
```

Do not clear `lastType`, `sameTypeCount`, or `lastComboId`; the recovery single must still respect anti-repeat history.

Extend the module return object to include `create`, `advance`, and `onPlayerHurt`.

- [ ] **Step 5: Run ordinary safety simulations**

Run:

```bash
node --test tests/obstacle-director.test.cjs
```

Expected: 10 tests pass, 0 fail. The 40-seed, 500-event safety simulations and 1,200-unit ratio samples complete without hanging.

- [ ] **Step 6: Record the checkpoint**

Record the 40-seed safety result and passing command. If Git is available:

```bash
git add index.html tests/obstacle-director.test.cjs
git commit -m "feat: enforce safe obstacle sequences"
```

---

### Task 4: Add the Fearless lead-in, dense rotation, exit, and recovery state machine

**Files:**

- Modify: `index.html` — only inside the director markers.
- Modify: `tests/obstacle-director.test.cjs`

**Interfaces:**

- Consumes: `create` and `advance` from Task 3.
- Produces: `ObstacleDirector.enterFearless(state: DirectorState): void`
- Extends `advance` to handle `fearless-lead`, `fearless-dense`, `fearless-exit`, and `recovery` modes.
- Fearless dense events use the same `SpawnEvent` shape, with `unitId: "fearless-rotation"` and `isCombo: true`.

- [ ] **Step 1: Add failing phase-transition tests**

Append:

```js
test("Fearless waits 0.6 seconds before dense spawning", () => {
  const director = loadDirector();
  const state = director.create(director.createSeededRandom(1));
  director.enterFearless(state);
  assert.equal(director.advance(state, {
    dt: 0.59, distance: 1000, time: 50, fearlessRemaining: 9.41, unresolvedCount: 4
  }), null);
  const first = director.advance(state, {
    dt: 0.02, distance: 1000, time: 50.61, fearlessRemaining: 9.39, unresolvedCount: 4
  });
  assert.notEqual(first, null);
});

test("Fearless dense mode rotates all three obstacle types", () => {
  const director = loadDirector();
  const state = director.create(director.createSeededRandom(2));
  director.enterFearless(state);
  director.advance(state, {
    dt: 0.61, distance: 1000, time: 50.61, fearlessRemaining: 9.39, unresolvedCount: 8
  });
  const types = [];
  for (let index = 0; index < 9; index++) {
    const event = director.advance(state, {
      dt: 1 / 60, distance: 1000, time: 51 + index, fearlessRemaining: 8 - index * 0.5, unresolvedCount: 8
    });
    if (event) types.push(event.type);
  }
  assert.deepEqual(new Set(types), new Set(["smoke", "harasser", "drunk"]));
});

test("Fearless emits nothing in its final second and for 1.2 seconds afterward", () => {
  const director = loadDirector();
  const state = director.create(director.createSeededRandom(5));
  director.enterFearless(state);
  director.advance(state, {
    dt: 0.61, distance: 1000, time: 60, fearlessRemaining: 9.39, unresolvedCount: 0
  });
  assert.equal(director.advance(state, {
    dt: 0.1, distance: 1000, time: 68.95, fearlessRemaining: 0.95, unresolvedCount: 0
  }), null);
  assert.equal(director.advance(state, {
    dt: 0.01, distance: 1000, time: 70, fearlessRemaining: 0, unresolvedCount: 0
  }), null);
  assert.equal(director.advance(state, {
    dt: 1.18, distance: 1000, time: 71.18, fearlessRemaining: 0, unresolvedCount: 0
  }), null);
  assert.notEqual(director.advance(state, {
    dt: 0.03, distance: 1000, time: 71.21, fearlessRemaining: 0, unresolvedCount: 0
  }), null);
});
```

- [ ] **Step 2: Run tests and verify `enterFearless` is missing**

Run:

```bash
node --test tests/obstacle-director.test.cjs
```

Expected: Task 1–3 tests pass; three new tests fail because `enterFearless` is missing.

- [ ] **Step 3: Implement explicit Fearless entry**

Add constants:

```js
        const FEARLESS_ORDER = ["smoke", "harasser", "drunk"];
        const FEARLESS_LEAD_SECONDS = 0.6;
        const FEARLESS_EXIT_SECONDS = 1;
        const FEARLESS_RECOVERY_SECONDS = 1.2;
        const FEARLESS_GAP_MIN = 180;
        const FEARLESS_GAP_MAX = 205;
```

Add:

```js
        function enterFearless(state) {
          state.mode = "fearless-lead";
          state.modeTime = FEARLESS_LEAD_SECONDS;
          state.currentUnit = null;
          state.unitIndex = 0;
          state.deck = [];
          state.distanceRemaining = 0;
          state.fearlessIndex = Math.floor(state.rng() * FEARLESS_ORDER.length);
        }
```

- [ ] **Step 4: Extend `advance` with Fearless and recovery branches before the ordinary branch**

Replace the Task 3 `advance` function with this complete implementation, which retains its ordinary branch after the state-machine branches:

```js
        function advance(state, frame) {
          if (state.mode === "fearless-lead") {
            state.modeTime -= Math.max(0, frame.dt);
            if (frame.fearlessRemaining <= FEARLESS_EXIT_SECONDS) state.mode = "fearless-exit";
            else if (state.modeTime > 0) return null;
            else state.mode = "fearless-dense";
          }

          if (state.mode === "fearless-dense") {
            if (frame.fearlessRemaining <= FEARLESS_EXIT_SECONDS) {
              state.mode = "fearless-exit";
              return null;
            }
            state.distanceRemaining -= Math.max(0, frame.distance);
            if (state.distanceRemaining > 0) return null;
            const type = FEARLESS_ORDER[state.fearlessIndex % FEARLESS_ORDER.length];
            state.fearlessIndex++;
            state.distanceRemaining = FEARLESS_GAP_MIN + state.rng() * (FEARLESS_GAP_MAX - FEARLESS_GAP_MIN);
            rememberType(state, type);
            return { type, unitId: "fearless-rotation", unitStart: true, isCombo: true };
          }

          if (state.mode === "fearless-exit") {
            if (frame.fearlessRemaining > 0) return null;
            state.mode = "recovery";
            state.modeTime = FEARLESS_RECOVERY_SECONDS;
            return null;
          }

          if (state.mode === "recovery") {
            state.modeTime -= Math.max(0, frame.dt);
            if (state.modeTime > 0) return null;
            state.mode = "normal";
            state.forceSingle = true;
            state.distanceRemaining = 0;
          }

          state.distanceRemaining -= Math.max(0, frame.distance);
          if (state.distanceRemaining > 0) return null;
          if (frame.unresolvedCount >= 2) return null;

          if (!state.currentUnit) {
            state.currentUnit = takeNextUnit(state, frame.time);
            state.unitIndex = 0;
          }

          const unit = state.currentUnit;
          const type = unit.types[state.unitIndex];
          const event = {
            type,
            unitId: unit.id,
            unitStart: state.unitIndex === 0,
            isCombo: unit.isCombo
          };

          rememberType(state, type);
          state.unitIndex++;
          if (state.unitIndex < unit.types.length) {
            state.distanceRemaining = Math.max(1, unit.internalGap);
          } else {
            state.distanceRemaining = Math.max(1, unit.restGap);
            if (unit.isCombo) state.lastComboId = unit.id;
            state.currentUnit = null;
            state.unitIndex = 0;
          }
          return event;
        }
```

Extend the module return object with `enterFearless`.

- [ ] **Step 5: Run the full pure-logic suite**

Run:

```bash
node --test tests/obstacle-director.test.cjs
```

Expected: 13 tests pass, 0 fail.

- [ ] **Step 6: Record the checkpoint**

Record all four observed mode transitions and the passing command. If Git is available:

```bash
git add index.html tests/obstacle-director.test.cjs
git commit -m "feat: direct Fearless obstacle rush"
```

---

### Task 5: Integrate the director into the canonical game loop

**Files:**

- Modify: `index.html:1572-1618` — reset director state.
- Modify: `index.html:1968-1989` — make obstacle construction accept an explicit type.
- Modify: `index.html:2002-2014` — enter Fearless director mode once.
- Modify: `index.html:2058-2071` — notify the director on damage.
- Modify: `index.html:2081-2133` — use the approved speed curve and director event.
- Modify: `tests/obstacle-director.test.cjs`

**Interfaces:**

- Consumes: all `ObstacleDirector` APIs from Tasks 1–4.
- `game.director` stores one `DirectorState` per run.
- `spawnObstacle(type: "smoke" | "harasser" | "drunk"): void` creates the existing obstacle object without choosing its type.

- [ ] **Step 1: Add failing static integration tests**

Append:

```js
test("canonical game loop delegates spawning and speed to the director", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /director:\s*ObstacleDirector\.create\(Math\.random\)/);
  assert.match(html, /const targetSpeed = ObstacleDirector\.speedAt\(game\.time\) \+ \(fearlessOn \? 150 : 0\)/);
  assert.match(html, /ObstacleDirector\.advance\(game\.director,/);
  assert.match(html, /spawnObstacle\(spawnEvent\.type\)/);
  assert.match(html, /ObstacleDirector\.enterFearless\(game\.director\)/);
  assert.match(html, /ObstacleDirector\.onPlayerHurt\(game\.director, game\.time\)/);
  assert.doesNotMatch(html, /spawnTimer:/);
  assert.doesNotMatch(html, /game\.spawnTimer/);
});

test("spawnObstacle receives a type and no longer draws a random type", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const match = html.match(/function spawnObstacle\(type\) \{([\s\S]*?)\n      \}/);
  assert.ok(match, "spawnObstacle(type) not found");
  assert.doesNotMatch(match[1], /Math\.random|const r =/);
});
```

- [ ] **Step 2: Run tests and verify only integration tests fail**

Run:

```bash
node --test tests/obstacle-director.test.cjs
```

Expected: 13 pure tests pass; 2 integration tests fail.

- [ ] **Step 3: Replace `spawnTimer` with per-run director state**

In `resetGame()`, replace:

```js
          spawnTimer: 1.1,
```

with:

```js
          director: ObstacleDirector.create(Math.random),
```

This ensures restart clears the deck, type history, combination history, Fearless state, and recovery state.

- [ ] **Step 4: Make obstacle construction deterministic from the event**

Change:

```js
      function spawnObstacle() {
        const r = Math.random();
        const type = r < .36 ? "smoke" : r < .71 ? "harasser" : "drunk";
```

to:

```js
      function spawnObstacle(type) {
```

Keep the remainder of the existing obstacle object unchanged.

- [ ] **Step 5: Wire state transitions into existing game events**

At the start of `activateFearless()`, immediately after `game.fearless = 10;`, add:

```js
        ObstacleDirector.enterFearless(game.director);
```

In `hurtBy(o)`, after resetting combo and streak, add:

```js
        ObstacleDirector.onPlayerHurt(game.director, game.time);
```

This call remains harmless on the final hit; no additional obstacle can spawn after `endGame()` because `update()` exits on the next frame.

- [ ] **Step 6: Replace the speed expression and random spawn timer**

Replace:

```js
        const targetSpeed = 250 + Math.min(210, game.time * 2.2) + (fearlessOn ? 150 : 0);
```

with:

```js
        const targetSpeed = ObstacleDirector.speedAt(game.time) + (fearlessOn ? 150 : 0);
```

Replace the entire `game.spawnTimer` / `gap` block with:

```js
        const unresolvedCount = game.obstacles.reduce((count, obstacle) =>
          count + (!obstacle.hit && !obstacle.fly ? 1 : 0), 0
        );
        const spawnEvent = ObstacleDirector.advance(game.director, {
          dt,
          distance: move * dt,
          time: game.time,
          fearlessRemaining: game.fearless,
          unresolvedCount
        });
        if (spawnEvent) spawnObstacle(spawnEvent.type);
```

Leave pickup timing unchanged.

- [ ] **Step 7: Run logic, integration, and HTML syntax checks**

Run:

```bash
node --test tests/obstacle-director.test.cjs
node - <<'NODE'
const fs = require("node:fs");
const html = fs.readFileSync("index.html", "utf8");
for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  if (match[1].trim()) new Function(match[1]);
}
console.log("index.html inline scripts parse");
NODE
```

Expected: 15 tests pass; syntax command prints `index.html inline scripts parse`.

- [ ] **Step 8: Record the checkpoint**

Record: root integration complete, old timer removed, 15 tests and syntax check pass. If Git is available:

```bash
git add index.html tests/obstacle-director.test.cjs
git commit -m "feat: integrate obstacle rhythm director"
```

---

### Task 6: Synchronize deployable copies, verify preservation, and playtest

**Files:**

- Modify: `dist/index.html` — apply only the marked module and five integration edits from Task 5.
- Modify: `sisterrun-sandbox-iframe/index.html` — apply only the marked module and five integration edits from Task 5.
- Modify: `tests/obstacle-director.test.cjs`

**Interfaces:**

- Consumes: canonical marked source and integration signatures from `index.html`.
- Produces: three runtime copies with byte-identical source between the director markers.
- Preserves: each copy's existing `BGM_SRC`, asset paths, reduced-effects behavior, and unrelated visual differences.

- [ ] **Step 1: Add failing copy-consistency and syntax tests**

Append:

```js
const HTML_COPIES = [
  "index.html",
  "dist/index.html",
  "sisterrun-sandbox-iframe/index.html"
];

test("all runtime copies contain the same obstacle director source", () => {
  const canonical = extractDirectorSource(path.join(ROOT, HTML_COPIES[0]));
  for (const relative of HTML_COPIES.slice(1)) {
    assert.equal(extractDirectorSource(path.join(ROOT, relative)), canonical, `${relative} director differs`);
  }
});

test("all runtime copies use the director integration points and parse", () => {
  for (const relative of HTML_COPIES) {
    const html = fs.readFileSync(path.join(ROOT, relative), "utf8");
    assert.match(html, /director:\s*ObstacleDirector\.create\(Math\.random\)/);
    assert.match(html, /ObstacleDirector\.advance\(game\.director,/);
    assert.match(html, /spawnObstacle\(spawnEvent\.type\)/);
    assert.doesNotMatch(html, /game\.spawnTimer/);
    for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
      if (match[1].trim()) new Function(match[1]);
    }
  }
});
```

- [ ] **Step 2: Run tests and verify the two copies lack the module**

Run:

```bash
node --test tests/obstacle-director.test.cjs
```

Expected: canonical tests pass; copy tests fail because the two copies do not yet have the markers and integration.

- [ ] **Step 3: Apply the canonical director block to each copy**

In each deployable copy, insert the complete text from `/* OBSTACLE_DIRECTOR_START */` through `/* OBSTACLE_DIRECTOR_END */` immediately after that file's `rectsHit` helper. Copy the block byte-for-byte from `index.html`.

Do not copy surrounding constants: `BGM_SRC`, `DEV_WARNING_TEXT`, resource paths, and visual options must remain specific to each file.

- [ ] **Step 4: Apply the five integration edits to each copy**

Repeat exactly these localized edits from Task 5 in both files:

1. Replace `spawnTimer: 1.1` with `director: ObstacleDirector.create(Math.random)`.
2. Change `spawnObstacle()` plus its random type selection to `spawnObstacle(type)`.
3. Add `ObstacleDirector.enterFearless(game.director)` after `game.fearless = 10`.
4. Add `ObstacleDirector.onPlayerHurt(game.director, game.time)` after combo/streak reset.
5. Replace the speed expression and random timer block with the `speedAt` and `advance` integration shown in Task 5.

Do not copy the whole canonical HTML file over either target.

- [ ] **Step 5: Compare against preflight snapshots for unrelated changes**

Using the snapshot path printed during preflight, inspect diffs separately:

```bash
diff -u "$SISTERRUN_SNAPSHOT_DIR/dist-index.html" dist/index.html
diff -u "$SISTERRUN_SNAPSHOT_DIR/iframe-index.html" sisterrun-sandbox-iframe/index.html
```

Expected diff categories only:

- insertion of the marked director module;
- reset state replacement;
- explicit `spawnObstacle(type)`;
- Fearless entry call;
- damage recovery call;
- new speed and director update block.

If CSS, UI copy, asset paths, audio paths, reduced-effects code, drawing code, or collision code appears in either diff, stop and revert only that unrelated hunk using the snapshot as reference.

- [ ] **Step 6: Run the complete automated suite**

Run:

```bash
node --test tests/obstacle-director.test.cjs
```

Expected: 17 tests pass, 0 fail; all three inline scripts parse.

- [ ] **Step 7: Serve the deployable version and check asset responses**

Start the existing static server in one terminal:

```bash
python3 -m http.server 8000 -d dist
```

In another terminal run:

```bash
curl -I http://127.0.0.1:8000/
curl -I http://127.0.0.1:8000/assets/assets.json
curl -I http://127.0.0.1:8000/assets/audio/bgm_main_loop.mp3
```

Expected: all three requests return HTTP 200. Stop the server after browser verification.

- [ ] **Step 8: Perform desktop keyboard playtests**

Open `http://127.0.0.1:8000/` in a browser and complete three runs using Arrow Up and Space. In each run verify:

- 0–20 seconds contains only single obstacles.
- 20–45 seconds introduces occasional pairs.
- 45–75 seconds repeatedly asks for attack-to-jump or jump-to-attack transitions.
- 75–90 seconds is clearly harder without an unavoidable hit.
- no type appears more than twice in a row;
- taking damage cancels the pending second obstacle and creates a visibly longer pause;
- Fearless produces a repeating mix of all three obstacles, stops spawning near its final second, and returns through a calm single obstacle;
- restart begins from warmup instead of inheriting the old deck;
- the browser console has no new error.

If a combination is consistently unfair, adjust only its `internalGap` in `COMBOS` by increments of 20 pixels, rerun all 17 tests, and repeat this step. Do not lower a smoke-following gap below 340 pixels without updating the approved design and adding a jump-arc justification.

- [ ] **Step 9: Perform mobile-width touch playtests**

Use browser responsive mode at 390 × 844 CSS pixels. Complete three runs with the on-screen JUMP and ATTACK controls and verify the same phase behavior. Pay special attention to `harasser-smoke`, `drunk-smoke`, and `smoke-drunk`; touch input must leave enough time for the next action.

If touch consistently needs more recovery, increase only the relevant combination's `internalGap` in 20-pixel increments for all platforms; do not fork desktop and touch difficulty in this iteration.

- [ ] **Step 10: Final verification and checkpoint**

Run once more after any tuning:

```bash
node --test tests/obstacle-director.test.cjs
rg -n "spawnTimer|game\.spawnTimer" index.html dist/index.html sisterrun-sandbox-iframe/index.html
```

Expected: 17 tests pass; `rg` prints no matches and exits with status 1 because the old timer is absent.

Record the final internal gaps, test count, six completed runs, console result, and the three modified HTML files. If Git is available:

```bash
git add index.html dist/index.html sisterrun-sandbox-iframe/index.html tests/obstacle-director.test.cjs
git commit -m "feat: ship paced obstacle combinations"
```

## Completion Criteria

Implementation is complete only when all of the following are true:

- all 17 Node tests pass;
- the old `spawnTimer` implementation is absent from all three runtime copies;
- the marked director source is byte-identical across the three copies;
- snapshot diffs contain no unrelated changes;
- asset requests return HTTP 200;
- three keyboard runs and three touch runs satisfy the phase, safety, damage recovery, and Fearless checks;
- browser console shows no new error;
- actual tuning values and verification results are reported to the user.
