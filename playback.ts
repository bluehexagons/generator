export const ANIMATION_FRAME_MS = 1000 / 30;
export const MAX_FRAME_DELTA_MS = 80;

export type Clock = { lastTimestamp: number | null; timeSinceRender: number };

export function createClock(): Clock {
  return { lastTimestamp: null, timeSinceRender: 0 };
}

export function resetClock() {
  return createClock();
}

export function tickClock(clock: Clock, timestamp: number) {
  const elapsedMs = clock.lastTimestamp === null ? 0 : Math.max(0, timestamp - clock.lastTimestamp);
  return {
    elapsedMs,
    clock: {
      lastTimestamp: timestamp,
      timeSinceRender: clock.timeSinceRender + Math.min(MAX_FRAME_DELTA_MS, elapsedMs),
    },
  };
}

export function shouldRender(clock: Clock, sceneChanged = false) {
  return sceneChanged || clock.timeSinceRender >= ANIMATION_FRAME_MS;
}

export function consumeRenderTime(clock: Clock) {
  return { elapsedMs: clock.timeSinceRender, clock: { ...clock, timeSinceRender: 0 } };
}
