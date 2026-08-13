import assert from "node:assert/strict";
import test from "node:test";

import {
  advancePlayback,
  createInitialState,
  effectivePixelSize,
  formatMotion,
  motionDelta,
  withMode,
} from "../app-state.js";

test("initial state is deterministic when given a seed and reduced-motion preference", () => {
  assert.deepEqual(createInitialState({ seed: -0.25, reducedMotion: true }), {
    mode: 3,
    seed: 0.75,
    palette: 0,
    pixelSize: 2,
    motion: 24,
    cycleMs: 0,
    cycleElapsed: 0,
    running: false,
    scrubbing: false,
  });
});

test("state transitions do not mutate the previous state", () => {
  const state = createInitialState({ seed: 0.25 });
  const next = withMode(state, -1, 20);

  assert.equal(state.mode, 3);
  assert.equal(next.mode, 19);
  assert.equal(next.cycleElapsed, 0);
});

test("playback advances multiple scenes and wraps its seed", () => {
  const state = { ...createInitialState({ seed: 0.25 }), cycleMs: 1000, motion: 0 };
  const result = advancePlayback(state, 2500, 0, 20, () => 1.25);

  assert.equal(result.sceneChanged, true);
  assert.equal(result.state.mode, 5);
  assert.equal(result.state.seed, 0.25);
  assert.equal(result.state.cycleElapsed, 500);
  assert.equal(state.mode, 3);
});

test("playback applies motion only for a render interval and not while scrubbing", () => {
  const state = { ...createInitialState({ seed: 0.25 }), motion: 24 };
  const moved = advancePlayback(state, 0, 32, 20).state;
  const scrubbed = advancePlayback({ ...state, scrubbing: true }, 0, 32, 20).state;

  assert.ok(Math.abs(moved.seed - (0.25 + motionDelta(24) * 2)) < Number.EPSILON);
  assert.equal(scrubbed.seed, state.seed);
  assert.equal(formatMotion(0), "still");
});

test("paused playback does not consume elapsed time", () => {
  const state = { ...createInitialState({ seed: 0.25, reducedMotion: true }), cycleMs: 1000 };
  const result = advancePlayback(state, 2000, 32, 20, () => 0.9);

  assert.deepEqual(result, { state, sceneChanged: false });
});

test("effective animation pixel size honors the scene budget", () => {
  const state = { ...createInitialState({ seed: 0.25 }), pixelSize: 1 };
  assert.equal(effectivePixelSize({ width: 1000, height: 1000, state, sampleBudget: 10000 }), 10);
  assert.equal(effectivePixelSize({ width: 1000, height: 1000, state: { ...state, running: false }, sampleBudget: 10000 }), 1);
});
