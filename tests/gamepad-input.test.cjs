"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SOURCE_PATH = path.resolve(__dirname, "..", "index.html");
const START = "/* GAMEPAD_INPUT_START */";
const END = "/* GAMEPAD_INPUT_END */";

function loadGamepadInput() {
  const html = fs.readFileSync(SOURCE_PATH, "utf8");
  const start = html.indexOf(START);
  const end = html.indexOf(END);
  assert.notEqual(start, -1, `index.html is missing ${START}`);
  assert.notEqual(end, -1, `index.html is missing ${END}`);
  assert.ok(end > start, `${START} and ${END} are reversed`);
  const source = html.slice(start + START.length, end).trim();
  const sandbox = {};
  vm.runInNewContext(`${source}\nglobalThis.__gamepadInput = GamepadInput;`, sandbox, {
    filename: SOURCE_PATH
  });
  return sandbox.__gamepadInput;
}

function pad({ pressed = [], axes = [0, 0, 0, 0], mapping = "standard", connected = true, index = 0 } = {}) {
  return {
    id: "Xbox Wireless Controller",
    index,
    connected,
    mapping,
    timestamp: 1,
    axes,
    buttons: Array.from({ length: 17 }, (_, buttonIndex) => ({
      pressed: pressed.includes(buttonIndex),
      touched: pressed.includes(buttonIndex),
      value: pressed.includes(buttonIndex) ? 1 : 0
    }))
  };
}

test("A and D-pad Up emit one jump only on their rising edge", () => {
  const input = loadGamepadInput();
  const state = input.create();

  assert.equal(input.sample(state, [pad({ pressed: [0] })]).jump, true);
  assert.equal(input.sample(state, [pad({ pressed: [0] })]).jump, false);
  assert.equal(input.sample(state, [pad()]).jump, false);
  assert.equal(input.sample(state, [pad({ pressed: [12] })]).jump, true);
  assert.equal(input.sample(state, [pad({ pressed: [0, 12] })]).jump, true);
});

test("left-stick Up uses separate trigger and release thresholds", () => {
  const input = loadGamepadInput();
  const state = input.create();

  assert.equal(input.sample(state, [pad({ axes: [0, -0.65, 0, 0] })]).jump, true);
  assert.equal(input.sample(state, [pad({ axes: [0, -0.5, 0, 0] })]).jump, false);
  assert.equal(input.sample(state, [pad({ axes: [0, -0.2, 0, 0] })]).jump, false);
  assert.equal(input.sample(state, [pad({ axes: [0, -0.65, 0, 0] })]).jump, true);
});

test("X emits one press edge and one release edge", () => {
  const input = loadGamepadInput();
  const state = input.create();

  const pressed = input.sample(state, [pad({ pressed: [2] })]);
  assert.equal(pressed.attackPressed, true);
  assert.equal(pressed.attackReleased, false);
  assert.equal(input.sample(state, [pad({ pressed: [2] })]).attackPressed, false);
  const released = input.sample(state, [pad()]);
  assert.equal(released.attackPressed, false);
  assert.equal(released.attackReleased, true);
});

test("Menu emits once while held", () => {
  const input = loadGamepadInput();
  const state = input.create();

  assert.equal(input.sample(state, [pad({ pressed: [9] })]).menu, true);
  assert.equal(input.sample(state, [pad({ pressed: [9] })]).menu, false);
});

test("disconnecting the active controller requests charge cancellation", () => {
  const input = loadGamepadInput();
  const state = input.create();

  input.sample(state, [pad({ pressed: [2] })]);
  const disconnected = input.sample(state, []);
  assert.equal(disconnected.cancelCharge, true);
  assert.equal(disconnected.connected, false);
  assert.equal(disconnected.attackReleased, false);
});

test("a non-standard controller is reported but cannot emit game actions", () => {
  const input = loadGamepadInput();
  const action = input.sample(input.create(), [pad({ mapping: "", pressed: [0, 2, 9, 12] })]);

  assert.equal(action.unsupported, true);
  assert.equal(action.connected, false);
  assert.equal(action.jump, false);
  assert.equal(action.attackPressed, false);
  assert.equal(action.menu, false);
});
