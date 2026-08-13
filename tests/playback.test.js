import assert from "node:assert/strict";
import test from "node:test";

import {
  ANIMATION_FRAME_MS,
  consumeRenderTime,
  createClock,
  shouldRender,
  tickClock,
} from "../playback.js";

test("clock accumulates capped frame deltas until a render is due", () => {
  let clock = createClock();
  let tick = tickClock(clock, 100);
  clock = tick.clock;
  assert.equal(tick.elapsedMs, 0);

  tick = tickClock(clock, 120);
  clock = tick.clock;
  assert.equal(tick.elapsedMs, 20);
  assert.equal(shouldRender(clock), false);

  tick = tickClock(clock, 180);
  clock = tick.clock;
  assert.equal(tick.elapsedMs, 60);
  assert.equal(clock.timeSinceRender, 80);
  assert.equal(shouldRender(clock), true);
});

test("render consumption resets only the accumulated render time", () => {
  const clock = { lastTimestamp: 180, timeSinceRender: 45 };
  const consumed = consumeRenderTime(clock);

  assert.equal(consumed.elapsedMs, 45);
  assert.deepEqual(consumed.clock, { lastTimestamp: 180, timeSinceRender: 0 });
  assert.deepEqual(clock, { lastTimestamp: 180, timeSinceRender: 45 });
  assert.equal(shouldRender({ lastTimestamp: 180, timeSinceRender: 0 }, true), true);
});

test("clock ignores backwards timestamps", () => {
  const tick = tickClock({ lastTimestamp: 180, timeSinceRender: 10 }, 120);
  assert.equal(tick.elapsedMs, 0);
  assert.equal(tick.clock.timeSinceRender, 10);
});

test("clock handles a real zero timestamp without losing the next interval", () => {
  let clock = createClock();
  clock = tickClock(clock, 0).clock;
  const tick = tickClock(clock, 16);

  assert.equal(tick.elapsedMs, 16);
});
