export const ANIMATION_FRAME_MS = 1000 / 30;
export const MAX_FRAME_DELTA_MS = 80;

export function createClock() {
  return { lastTimestamp: 0, timeSinceRender: 0 };
}

export function resetClock() {
  return createClock();
}

export function tickClock(clock, timestamp) {
  const elapsedMs = clock.lastTimestamp ? Math.max(0, timestamp - clock.lastTimestamp) : 0;
  return {
    elapsedMs,
    clock: {
      lastTimestamp: timestamp,
      timeSinceRender: clock.timeSinceRender + Math.min(MAX_FRAME_DELTA_MS, elapsedMs),
    },
  };
}

export function shouldRender(clock, sceneChanged = false) {
  return sceneChanged || clock.timeSinceRender >= ANIMATION_FRAME_MS;
}

export function consumeRenderTime(clock) {
  return { elapsedMs: clock.timeSinceRender, clock: { ...clock, timeSinceRender: 0 } };
}
