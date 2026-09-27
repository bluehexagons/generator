export const PIXEL_SIZE_MIN = 1;
export const PIXEL_SIZE_MAX = 40;
export const MOTION_MIN = -100;
export const MOTION_MAX = 100;
export const CYCLE_SECONDS_MIN = 3;
export const CYCLE_SECONDS_MAX = 15;

function clampInteger(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

export function serializeHash(state: ShareState, modeIds: string[] = []) {
  const motion = clampInteger(state.motion ?? 0, MOTION_MIN, MOTION_MAX);
  const cycleSeconds = state.cycleMs
    ? clampInteger(state.cycleMs / 1000, CYCLE_SECONDS_MIN, CYCLE_SECONDS_MAX)
    : 0;
  const mode = modeIds[state.mode] ?? state.mode;
  return `#mode=${encodeURIComponent(mode)}&seed=${state.seed.toFixed(6)}&size=${state.pixelSize}&palette=${state.palette}&motion=${motion}&cycle=${cycleSeconds}`;
}

export function writeHash(
  {
    location,
    history,
  }: { location: Pick<Location, "hash">; history: Pick<History, "replaceState"> },
  state: ShareState,
  modeIds: string[] = [],
) {
  const hash = serializeHash(state, modeIds);
  if (location.hash !== hash) history.replaceState(null, "", hash);
}

function readNumber(params: URLSearchParams, name: string) {
  if (!params.has(name)) return null;
  const raw = params.get(name);
  if (raw?.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function normalizeSeed(value: number) {
  return ((value % 1) + 1) % 1;
}

export function parseHash(
  hash: string,
  modeCount: number,
  paletteCount: number,
  modeIds: string[] = [],
): Partial<ShareState> {
  const value = String(hash ?? "").replace(/^#/, "");
  if (!value) return {};

  const params = new URLSearchParams(value);
  const modeValue = params.get("mode")?.trim() ?? "";
  const numericMode = modeValue === "" ? null : Number(modeValue);
  const mode =
    numericMode !== null && Number.isFinite(numericMode)
      ? clampInteger(numericMode, 0, modeCount - 1)
      : modeIds.indexOf(modeValue);
  const seed = readNumber(params, "seed");
  const size = readNumber(params, "size");
  const palette = readNumber(params, "palette");
  const motion = readNumber(params, "motion");
  const cycle = readNumber(params, "cycle");

  return {
    ...(mode >= 0 && { mode }),
    ...(seed !== null && { seed: normalizeSeed(seed) }),
    ...(size !== null && { pixelSize: clampInteger(size, PIXEL_SIZE_MIN, PIXEL_SIZE_MAX) }),
    ...(palette !== null && { palette: clampInteger(palette, 0, paletteCount - 1) }),
    ...(motion !== null && { motion: clampInteger(motion, MOTION_MIN, MOTION_MAX) }),
    ...(cycle !== null && {
      cycleMs: cycle <= 0 ? 0 : clampInteger(cycle, CYCLE_SECONDS_MIN, CYCLE_SECONDS_MAX) * 1000,
    }),
  };
}

export function readHash(
  location: Pick<Location, "hash">,
  state: Partial<ShareState>,
  modeCount: number,
  paletteCount: number,
  modeIds: string[] = [],
) {
  Object.assign(state, parseHash(location.hash, modeCount, paletteCount, modeIds));
}
import type { AppState } from "./app-state.ts";

type ShareState = Pick<AppState, "mode" | "seed" | "pixelSize" | "palette" | "motion" | "cycleMs">;
