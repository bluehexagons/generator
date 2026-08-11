export const PIXEL_SIZE_MIN = 1;
export const PIXEL_SIZE_MAX = 40;

export function writeHash({ location, history }, state) {
  const hash = `#mode=${state.mode}&seed=${state.seed.toFixed(6)}&size=${state.pixelSize}&palette=${state.palette}`;
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

  if (mode !== null) state.mode = clampInteger(mode, 0, modeCount - 1);
  if (seed !== null) state.seed = normalizeSeed(seed);
  if (size !== null) state.pixelSize = clampInteger(size, PIXEL_SIZE_MIN, PIXEL_SIZE_MAX);
  if (palette !== null) state.palette = clampInteger(palette, 0, paletteCount - 1);
}
