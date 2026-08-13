export const PIXEL_SIZE_MIN = 1;
export const PIXEL_SIZE_MAX = 40;
export const MOTION_MIN = -100;
export const MOTION_MAX = 100;
export const CYCLE_SECONDS_MIN = 3;
export const CYCLE_SECONDS_MAX = 15;

export function writeHash({ location, history }, state) {
  const motion = clampInteger(state.motion ?? 0, MOTION_MIN, MOTION_MAX);
  const cycleSeconds = state.cycleMs ? clampInteger(state.cycleMs / 1000, CYCLE_SECONDS_MIN, CYCLE_SECONDS_MAX) : 0;
  const hash = `#mode=${state.mode}&seed=${state.seed.toFixed(6)}&size=${state.pixelSize}&palette=${state.palette}&motion=${motion}&cycle=${cycleSeconds}`;
  if (location.hash !== hash) history.replaceState(null, "", hash);
}

function readNumber(params, name) {
  if (!params.has(name)) return null;
  const raw = params.get(name);
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function clampInteger(value, min, max) {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

export function normalizeSeed(value) {
  return ((value % 1) + 1) % 1;
}

export function readHash(location, state, modeCount, paletteCount) {
  const hash = location.hash.replace(/^#/, "");
  if (!hash) return;

  const params = new URLSearchParams(hash);
  const mode = readNumber(params, "mode");
  const seed = readNumber(params, "seed");
  const size = readNumber(params, "size");
  const palette = readNumber(params, "palette");
  const motion = readNumber(params, "motion");
  const cycle = readNumber(params, "cycle");

  if (mode !== null) state.mode = clampInteger(mode, 0, modeCount - 1);
  if (seed !== null) state.seed = normalizeSeed(seed);
  if (size !== null) state.pixelSize = clampInteger(size, PIXEL_SIZE_MIN, PIXEL_SIZE_MAX);
  if (palette !== null) state.palette = clampInteger(palette, 0, paletteCount - 1);
  if (motion !== null) state.motion = clampInteger(motion, MOTION_MIN, MOTION_MAX);
  if (cycle !== null) state.cycleMs = cycle <= 0 ? 0 : clampInteger(cycle, CYCLE_SECONDS_MIN, CYCLE_SECONDS_MAX) * 1000;
}
