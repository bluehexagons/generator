import { normalizeSeed } from "./url-state.ts";

export type AppState = {
  mode: number;
  seed: number;
  palette: number;
  pixelSize: number;
  motion: number;
  cycleMs: number;
  cycleElapsed: number;
  running: boolean;
  scrubbing: boolean;
};

export const DEFAULT_CYCLE_MS = 6000;
export const DEFAULT_MOTION = 24;

export function createInitialState({
  seed = Math.random(),
  reducedMotion = false,
}: { seed?: number; reducedMotion?: boolean } = {}): AppState {
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

export function motionDelta(value: number) {
  const sign = Math.sign(value);
  const magnitude = Math.abs(value) / 100;
  return sign * magnitude * magnitude * 0.02;
}

export function formatMotion(value: number, scale = 1) {
  if (value === 0) return "still";
  const speed = Math.abs((motionDelta(value) * scale) / motionDelta(DEFAULT_MOTION));
  const prefix = value < 0 ? "−" : "";
  return `${prefix}${speed < 10 ? speed.toFixed(1) : Math.round(speed)}×`;
}

export function wrapMode(mode: number, modeCount: number) {
  return ((mode % modeCount) + modeCount) % modeCount;
}

export function withMode(state: AppState, mode: number, modeCount: number) {
  return { ...state, mode: wrapMode(mode, modeCount), cycleElapsed: 0 };
}

export function withSeed(state: AppState, seed: number) {
  return { ...state, seed: normalizeSeed(seed), cycleElapsed: 0 };
}

export function withPalette(state: AppState, palette: number, paletteCount: number) {
  return { ...state, palette: Math.max(0, Math.min(paletteCount - 1, palette | 0)) };
}

export function withPixelSize(state: AppState, pixelSize: number, min: number, max: number) {
  return { ...state, pixelSize: Math.max(min, Math.min(max, pixelSize | 0)) };
}

export function withMotion(state: AppState, motion: number, min: number, max: number) {
  return { ...state, motion: Math.max(min, Math.min(max, motion | 0)) };
}

export function withRunning(state: AppState, running: boolean) {
  return { ...state, running: Boolean(running) };
}

export function withCycle(state: AppState, cycleMs: number) {
  return { ...state, cycleMs: Math.max(0, cycleMs | 0), cycleElapsed: 0 };
}

export function resizeCycle(state: AppState, cycleMs: number) {
  const previousDuration = state.cycleMs;
  const elapsed = previousDuration ? (state.cycleElapsed / previousDuration) * cycleMs : 0;
  return { ...state, cycleMs, cycleElapsed: elapsed };
}

/**
 * Advance one animation frame without touching the DOM. Cycling always uses
 * the elapsed frame time; motion advances only when this frame is renderable.
 */
export function advanceFrame(
  state: AppState,
  elapsedMs: number,
  accumulatedRenderMs: number,
  renderIntervalMs: number,
  modeCount: number,
  random = Math.random,
  motionScale = 1,
  selectMode?: (currentMode: number) => number,
) {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const renderElapsed = Number.isFinite(accumulatedRenderMs) ? Math.max(0, accumulatedRenderMs) : 0;
  const renderInterval = Number.isFinite(renderIntervalMs) ? Math.max(0, renderIntervalMs) : 0;
  let next = { ...state };
  let sceneChanged = false;

  if (!next.running) return { state: next, sceneChanged, renderRequested: false };

  if (next.cycleMs > 0) {
    next.cycleElapsed += elapsed;
    if (next.cycleElapsed >= next.cycleMs) {
      const scenesPassed = Math.floor(next.cycleElapsed / next.cycleMs);
      for (let scene = 0; scene < scenesPassed; scene += 1) {
        next.mode = selectMode
          ? wrapMode(selectMode(next.mode), modeCount)
          : (next.mode + 1) % modeCount;
      }
      next.seed = normalizeSeed(random());
      next.cycleElapsed %= next.cycleMs;
      sceneChanged = true;
    }
  }

  const renderRequested = sceneChanged || renderElapsed >= renderInterval;
  if (renderRequested && next.motion !== 0 && !next.scrubbing && renderElapsed > 0) {
    next.seed = normalizeSeed(
      next.seed + motionDelta(next.motion) * motionScale * (renderElapsed / 16),
    );
  }

  return { state: next, sceneChanged, renderRequested };
}

/**
 * Compatibility helper for callers that already decide when motion time is
 * consumed. New animation loops should use `advanceFrame`.
 */
export function advancePlayback(
  state: AppState,
  elapsedMs: number,
  motionElapsedMs: number,
  modeCount: number,
  random = Math.random,
) {
  const result = advanceFrame(state, elapsedMs, motionElapsedMs, 0, modeCount, random);
  return { state: result.state, sceneChanged: result.sceneChanged };
}

export function isPlaybackActive(state: AppState) {
  return state.running && (state.motion !== 0 || state.cycleMs > 0);
}

export function effectivePixelSize({
  width,
  height,
  state,
  sampleBudget = 180000,
}: {
  width: number;
  height: number;
  state: AppState;
  sampleBudget?: number;
}) {
  const isAnimating = (state.running && state.motion !== 0) || state.scrubbing;
  if (!isAnimating) return state.pixelSize;
  const animationFloor = Math.max(1, Math.ceil(Math.sqrt((width * height) / sampleBudget)));
  return Math.max(animationFloor, state.pixelSize);
}
