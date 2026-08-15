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
    dt: 1 / 60, distance: 412.499, time: 80, fearlessRemaining: 0, unresolvedCount: 0
  }), null);
  const next = director.advance(state, {
    dt: 1 / 60, distance: 0.001, time: 80, fearlessRemaining: 0, unresolvedCount: 0
  });
  assert.equal(next.isCombo, false);
  assert.equal(next.unitStart, true);
});

test("damage recovery preserves the interrupted combination in anti-repeat history", () => {
  const director = loadDirector();
  const state = director.create(director.createSeededRandom(10));
  let interrupted;
  do {
    interrupted = director.advance(state, {
      dt: 1 / 60, distance: 1000, time: 80, fearlessRemaining: 0, unresolvedCount: 0
    });
  } while (!interrupted?.isCombo);

  director.onPlayerHurt(state, 80);
  const recovery = director.advance(state, {
    dt: 1 / 60, distance: 1000, time: 80, fearlessRemaining: 0, unresolvedCount: 0
  });
  assert.equal(recovery.isCombo, false);

  let nextCombo;
  do {
    nextCombo = director.advance(state, {
      dt: 1 / 60, distance: 1000, time: 80, fearlessRemaining: 0, unresolvedCount: 0
    });
  } while (!nextCombo?.isCombo);
  assert.notEqual(nextCombo.unitId, interrupted.unitId);
});

test("late Fearless extension resumes dense obstacles without resetting an active dense run", () => {
  const director = loadDirector();
  const state = director.create(director.createSeededRandom(21));
  director.enterFearless(state);

  director.advance(state, {
    dt: 0.6, distance: 0, time: 30, fearlessRemaining: 5, unresolvedCount: 0
  });
  assert.equal(state.mode, "fearless-dense");
  state.distanceRemaining = 123;
  director.extendFearless(state);
  assert.equal(state.mode, "fearless-dense");
  assert.equal(state.distanceRemaining, 123);

  director.advance(state, {
    dt: 1 / 60, distance: 0, time: 30, fearlessRemaining: 0.5, unresolvedCount: 0
  });
  assert.equal(state.mode, "fearless-exit");
  director.extendFearless(state);
  assert.equal(state.mode, "fearless-dense");
  assert.equal(state.distanceRemaining, 0);
});

test("stage transitions discard a partially consumed old-stage deck", () => {
  const director = loadDirector();
  const state = director.create(director.createSeededRandom(23));
  do {
    director.advance(state, {
      dt: 1 / 60, distance: 1000, time: 44, fearlessRemaining: 0, unresolvedCount: 0
    });
  } while (state.currentUnit);

  assert.equal(state.stageId, "groove");
  assert.ok(state.deck.length > 0);
  assert.ok(state.deck.every(unit => unit.restGap === 400 || unit.restGap === 450));

  director.advance(state, {
    dt: 1 / 60, distance: 1000, time: 45, fearlessRemaining: 0, unresolvedCount: 0
  });
  assert.equal(state.stageId, "switch");
  assert.ok(state.deck.length > 0);
  assert.ok(state.deck.every(unit => unit.restGap === 360 || unit.restGap === 420));
});

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
