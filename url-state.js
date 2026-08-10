export function writeHash(location, state) {
  const hash = `#mode=${state.mode}&seed=${state.seed.toFixed(6)}&size=${state.pixelSize}&palette=${state.palette}`;
  if (location.hash !== hash) history.replaceState(null, "", hash);
}

export function readHash(location, state, modeCount, paletteCount) {
  const hash = location.hash.replace(/^#/, "");
  if (!hash) return;

  const params = Object.fromEntries(hash.split("&").map(part => part.split("=")));
  if (params.mode != null && Number.isFinite(+params.mode)) {
    state.mode = Math.max(0, Math.min(modeCount - 1, +params.mode | 0));
  }
  if (params.seed != null) {
    const seed = parseFloat(params.seed);
    if (Number.isFinite(seed)) state.seed = ((seed % 1) + 1) % 1;
  }
  if (params.size != null && Number.isFinite(+params.size)) {
    state.pixelSize = Math.max(1, Math.min(40, +params.size | 0));
  }
  if (params.palette != null && Number.isFinite(+params.palette)) {
    state.palette = Math.max(0, Math.min(paletteCount - 1, +params.palette | 0));
  }
}
