"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_PATH = path.join(ROOT, "index.html");
const DIRECTOR_START = "/* COURAGE_PACK_DIRECTOR_START */";
const DIRECTOR_END = "/* COURAGE_PACK_DIRECTOR_END */";
const REWARD_START = "/* FEARLESS_REWARD_RULES_START */";
const REWARD_END = "/* FEARLESS_REWARD_RULES_END */";

function extractBlock(startMarker, endMarker) {
  const html = fs.readFileSync(SOURCE_PATH, "utf8");
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  assert.notEqual(start, -1, `index.html is missing ${startMarker}`);
  assert.notEqual(end, -1, `index.html is missing ${endMarker}`);
  assert.ok(end > start, `${startMarker} and ${endMarker} are reversed`);
  return html.slice(start + startMarker.length, end).trim();
}

function loadPackDirector() {
  const source = extractBlock(DIRECTOR_START, DIRECTOR_END);
  const sandbox = {};
  vm.runInNewContext(`${source}\nglobalThis.__packDirector = CouragePackDirector;`, sandbox, {
    filename: SOURCE_PATH
  });
  return sandbox.__packDirector;
}

function loadRewardRules() {
  const source = extractBlock(REWARD_START, REWARD_END);
  const sandbox = {};
  vm.runInNewContext(`${source}\nglobalThis.__rewardRules = FearlessRewardRules;`, sandbox, {
    filename: SOURCE_PATH
  });
  return sandbox.__rewardRules;
}

test("initial pack distance uses an 8 to 15 second run at the supplied speed", () => {
  const director = loadPackDirector();
  assert.equal(director.create(() => 0, 250).distanceRemaining, 2000);
  assert.equal(director.create(() => 0.999999, 250).distanceRemaining, 3749.99825);
});

test("a due pack remains locked until 12 seconds", () => {
  const director = loadPackDirector();
  const state = director.create(() => 0, 250);

  assert.equal(director.advance(state, {
    time: 11.999,
    distance: 4500,
    speed: 250,
    safeToSpawn: true,
    hasPack: false
  }), false);
  assert.equal(director.advance(state, {
    time: 12,
    distance: 0,
    speed: 250,
    safeToSpawn: true,
    hasPack: false
  }), true);
});

test("an unsafe due pack waits and releases exactly once on the next safe frame", () => {
  const director = loadPackDirector();
  const state = director.create(() => 0, 250);

  assert.equal(director.advance(state, {
    time: 20,
    distance: 4500,
    speed: 250,
    safeToSpawn: false,
    hasPack: false
  }), false);
  assert.equal(director.advance(state, {
    time: 20.1,
    distance: 10,
    speed: 250,
    safeToSpawn: true,
    hasPack: true
  }), false);
  assert.equal(director.advance(state, {
    time: 20.2,
    distance: 10,
    speed: 250,
    safeToSpawn: true,
    hasPack: false
  }), true);
  assert.equal(director.advance(state, {
    time: 20.3,
    distance: 0,
    speed: 250,
    safeToSpawn: true,
    hasPack: false
  }), false);
  assert.equal(state.distanceRemaining, 2000);
});

test("non-positive speed still schedules a positive interval", () => {
  const director = loadPackDirector();
  const state = director.create(() => 0, 0);
  assert.ok(state.distanceRemaining > 0);
});

test("the opening lock delays an 8-second schedule until 12 running seconds", () => {
  const director = loadPackDirector();
  const state = director.create(() => 0, 250);
  for (let second = 1; second < 12; second++) {
    assert.equal(director.advance(state, {
      time: second,
      distance: 470,
      speed: 470,
      safeToSpawn: true,
      hasPack: false
    }), false, `pack spawned at ${second} seconds`);
  }
  assert.equal(director.advance(state, {
    time: 12,
    distance: 470,
    speed: 470,
    safeToSpawn: true,
    hasPack: false
  }), true);
});

test("a courage pack starts five seconds of Fearless", () => {
  const rules = loadRewardRules();
  assert.equal(rules.nextDuration(0, rules.COURAGE_PACK_SECONDS), 5);
});

test("a courage pack adds five seconds while Fearless is active", () => {
  const rules = loadRewardRules();
  assert.equal(rules.nextDuration(4.25, rules.COURAGE_PACK_SECONDS), 9.25);
});

test("Fearless rewards cannot raise the remaining time above 15 seconds", () => {
  const rules = loadRewardRules();
  assert.equal(rules.nextDuration(14, rules.COURAGE_PACK_SECONDS), 15);
  assert.equal(rules.nextDuration(15, rules.COURAGE_PACK_SECONDS), 15);
});

test("the existing Combo reward remains ten seconds", () => {
  const rules = loadRewardRules();
  assert.equal(rules.nextDuration(0, rules.COMBO_SECONDS), 10);
});
