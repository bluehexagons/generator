import { normalizeSeed } from "./url-state.js";

export const DEFAULT_CYCLE_MS = 6000;
export const DEFAULT_MOTION = 24;

export function createInitialState({ seed = Math.random(), reducedMotion = false } = {}) {
  return {
    mode: 3,
    seed: normalizeSeed(seed),
    palette: 0,
    pixelSize: 2,
    motion: DEFAULT_MOTION,
    cycleMs: 0,
    cycleElapsed: 0,
    running: !reducedMotion,
    scrubbing: false,
  };
}

export function motionDelta(value) {
  const sign = Math.sign(value);
  const magnitude = Math.abs(value) / 100;
  return sign * magnitude * magnitude * 0.02;
}

export function formatMotion(value) {
  if (value === 0) return "still";
  const speed = Math.abs(motionDelta(value) / motionDelta(DEFAULT_MOTION));
  const prefix = value < 0 ? "−" : "";
  return `${prefix}${speed < 10 ? speed.toFixed(1) : Math.round(speed)}×`;
}

export function wrapMode(mode, modeCount) {
  return ((mode % modeCount) + modeCount) % modeCount;
}

export function withMode(state, mode, modeCount) {
  return { ...state, mode: wrapMode(mode, modeCount), cycleElapsed: 0 };
}

export function withSeed(state, seed) {
  return { ...state, seed: normalizeSeed(seed), cycleElapsed: 0 };
}

export function withPalette(state, palette, paletteCount) {
  return { ...state, palette: Math.max(0, Math.min(paletteCount - 1, palette | 0)) };
}

export function withPixelSize(state, pixelSize, min, max) {
  return { ...state, pixelSize: Math.max(min, Math.min(max, pixelSize | 0)) };
}

export function withMotion(state, motion, min, max) {
  return { ...state, motion: Math.max(min, Math.min(max, motion | 0)) };
}

export function withRunning(state, running) {
  return { ...state, running: Boolean(running) };
}

export function withCycle(state, cycleMs) {
  return { ...state, cycleMs: Math.max(0, cycleMs | 0), cycleElapsed: 0 };
}

export function resizeCycle(state, cycleMs) {
  const previousDuration = state.cycleMs;
  const elapsed = previousDuration
    ? state.cycleElapsed / previousDuration * cycleMs
    : 0;
  return { ...state, cycleMs, cycleElapsed: elapsed };
}

/**
 * Advance playback state without touching the DOM or a clock. `motionElapsedMs`
 * is zero until the caller decides that another image should be rendered.
 */
export function advancePlayback(state, elapsedMs, motionElapsedMs, modeCount, random = Math.random) {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const motionElapsed = Number.isFinite(motionElapsedMs) ? Math.max(0, motionElapsedMs) : 0;
  let next = { ...state };
  let sceneChanged = false;

  if (!next.running) return { state: next, sceneChanged };

  if (next.cycleMs > 0) {
    next.cycleElapsed += elapsed;
    if (next.cycleElapsed >= next.cycleMs) {
      const scenesPassed = Math.floor(next.cycleElapsed / next.cycleMs);
      next.mode = (next.mode + scenesPassed) % modeCount;
      next.seed = normalizeSeed(random());
      next.cycleElapsed %= next.cycleMs;
      sceneChanged = true;
    }
  }

  if (next.motion !== 0 && !next.scrubbing && motionElapsed > 0) {
    next.seed = normalizeSeed(next.seed + motionDelta(next.motion) * (motionElapsed / 16));
  }

  return { state: next, sceneChanged };
}

export function isPlaybackActive(state) {
  return state.running && (state.motion !== 0 || state.cycleMs > 0);
}

export function effectivePixelSize({ width, height, state, sampleBudget = 180000 }) {
  const isAnimating = (state.running && state.motion !== 0) || state.scrubbing;
  if (!isAnimating) return state.pixelSize;
  const animationFloor = Math.max(1, Math.ceil(Math.sqrt(width * height / sampleBudget)));
  return Math.max(animationFloor, state.pixelSize);
}
