"use strict";

import { renderTo } from "./renderer.js";
import { readHash, writeHash } from "./url-state.js";

const MODES = [
  { name: "Drift",            note: "noise mixed with a seeded color, left to right" },
  { name: "Diagonal Bands",   note: "two coordinate sweeps modulated by seed" },
  { name: "Scanline Sweep",   note: "position-counter modulated, fast cycles" },
  { name: "Gradient",         note: "smooth diagonal gradient tinted by seed" },
  { name: "Radial Fade",      note: "single-channel radial falloff" },
  { name: "Radial Glow",      note: "seeded color attenuated by radius" },
  { name: "RGB Quadrants",    note: "x→red, y→blue, midpoint→green" },
  { name: "Lobe",             note: "radial × x·y product, soft lobes" },
  { name: "Sky/Noise",        note: "seeded color up top, random noise below" },
  { name: "Twilight",         note: "position + seed crossfade, warm tones" },
  { name: "Classic Plasma",   note: "layered sine waves, the demoscene staple" },
  { name: "Interference",     note: "concentric waves from several seeded sources" },
  { name: "Fractal Noise",    note: "smooth multi-scale value noise, plasma-like clouds" },
  { name: "Metaballs",         note: "soft glowing fields from moving circular sources" },
  { name: "Turbulence",        note: "domain-warped waves with swirling detail" },
  { name: "Voronoi Glow",      note: "cellular distance fields with luminous borders" },
  { name: "Julia Field",       note: "escape-time fractal rendered as shifting plasma" },
  { name: "Polar Ribbons",     note: "angular waves wrapped around a radial flow" },
  { name: "RGB Oscillator",    note: "three independent waves for liquid color bands" },
  { name: "Marble",            note: "veined stone from warped sine and noise" },
];

const PALETTES = [
  { name: "Prism", map: h => (h + 0.56) % 1 },
  { name: "Ember", map: h => (0.015 + h * 0.20) % 1 },
  { name: "Ocean", map: h => (0.50 + h * 0.18) % 1 },
  { name: "Acid",  map: h => (0.22 + h * 0.16) % 1 },
  { name: "Sunset", map: h => (0.94 + h * 0.22) % 1 },
];

// ---------------- pixel functions ----------------
// Faithful ports of the original pixelN() string-returning functions,
// rewritten to write three bytes directly. Their structure is preserved;
// the old random noise calls now use the shared seed for reproducibility.
const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;
const TAU = Math.PI * 2;

// A tiny deterministic hash keeps renders, thumbnails, and shared links stable.
function hash2(x, y, seed) {
  let n = Math.sin(x * 127.1 + y * 311.7 + seed * 951.3) * 43758.5453;
  return n - Math.floor(n);
}

function hue(h, palette = 0) {
  h = ((h % 1) + 1) % 1;
  h = PALETTES[palette]?.map(h) ?? h;
  const r = Math.abs(h * 6 - 3) - 1;
  const g = 2 - Math.abs(h * 6 - 2);
  const b = 2 - Math.abs(h * 6 - 4);
  return [clamp(Math.max(0, Math.min(1, r)) * 255), clamp(Math.max(0, Math.min(1, g)) * 255), clamp(Math.max(0, Math.min(1, b)) * 255)];
}

function smoothNoise(x, y, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

function fractalNoise(x, y, seed) {
  let total = 0, amplitude = 0.5, frequency = 1;
  for (let octave = 0; octave < 4; octave++) {
    total += smoothNoise(x * frequency, y * frequency, seed + octave * 17.3) * amplitude;
    frequency *= 2;
    amplitude *= 0.5;
  }
  return total / 0.9375;
}

const pixelFns = [
  // 0
  function (x, y, w, h, seed) {
    const c = hash2(x, y, seed) * 16777216 * (1 - x / w) + seed * 16777216 * (x / w);
    return [clamp(c % 256), clamp((c / 256) % 256), clamp(c / 65536)];
  },
  // 1
  function (x, y, w, h, seed) {
    const tx = seed * 65536 + x;
    const ty = seed * 65536 + y;
    return [clamp(tx % 256), clamp(ty % 256), clamp((tx + ty) % 256)];
  },
  // 2
  function (x, y, w, h, seed, p) {
    const tp = seed * 65536 + p;
    return [clamp(tp % 256), clamp((tp / 128) % 256), clamp((tp / 256) % 256)];
  },
  // 3
  function (x, y, w, h, seed) {
    const tp = seed * 65536;
    const pix = ((y / h) * 256 + (x / w) * 256) % 256;
    return [clamp((pix + tp / 65536) % 256), clamp((pix + tp / 256) % 256), clamp((pix + tp) % 256)];
  },
  // 4
  function (x, y, w, h, seed) {
    const scale = Math.hypot(x - w, y - h) / Math.hypot(w, h);
    const c = seed * 16777216 * scale;
    return [clamp(c % 256), clamp((c / 256) % 256), clamp(c / 65536)];
  },
  // 5
  function (x, y, w, h, seed) {
    const scale = Math.hypot(x - w, y - h) / Math.hypot(w, h);
    const c = seed * 16777216;
    return [clamp((c % 256) * scale), clamp(((c / 256) % 256) * scale), clamp((c / 65536) * scale)];
  },
  // 6
  function (x, y, w, h, seed) {
    const r = (x / w) * 256;
    const g = ((x / w + y / h) / 2) * 256;
    const b = (y / h) * 256;
    const c = (r + g * 256 + b * 65536) * seed;
    return [clamp(c % 256), clamp((c / 256) % 256), clamp(c / 65536)];
  },
  // 7
  function (x, y, w, h, seed) {
    const scale = Math.hypot(x - w, y - h) / Math.hypot(w, h);
    const c = ((seed / 2) * 16777216 * scale * 2 * ((x / w) * (y / h))) / 256;
    return [clamp(c % 256), clamp((c / 256) % 256), clamp(c / 65536)];
  },
  // 8
  function (x, y, w, h, seed) {
    const c = seed * 16777216;
    let r = c % 256;
    let g = (c / 256) % 256;
    let b = c / 65536;
    const t = y / h;
    const noise = hash2(x, y, seed) * 256;
    r = r * (1 - t) + noise * t;
    g = g * (1 - t) + noise * t;
    b = b * (1 - t) + noise * t;
    return [clamp(r), clamp(g), clamp(b)];
  },
  // 9
  function (x, y, w, h, seed, p) {
    const tseed = seed / 2 + 0.5;
    let r = ((p + x + y) / 3 / ((w * h + w + h) / 3)) * 256;
    const g = tseed * (x / w) * 256;
    const b = tseed * 256;
    r += (r / 2) * (tseed * 2 - 1);
    return [clamp(r), clamp(g), clamp(b)];
  },
  // 10 — the classic layered sine-wave plasma.
  function (x, y, w, h, seed) {
    const phase = seed * TAU;
    const nx = x / Math.max(w, h) * 12;
    const ny = y / Math.max(w, h) * 12;
    const value = (Math.sin(nx + phase) + Math.sin(ny * 1.35 - phase) + Math.sin((nx + ny) * 0.72 + phase) + Math.sin(Math.hypot(nx - 6, ny - 6) * 1.8 - phase)) / 4;
    return hue(seed + value * 0.22);
  },
  // 11 — radial wave interference, a common classic-plasma variant.
  function (x, y, w, h, seed) {
    const scale = Math.max(w, h);
    const sources = [[0.25, 0.34], [0.75, 0.66], [0.48, 0.82]];
    let value = 0;
    for (let i = 0; i < sources.length; i++) {
      const sx = (sources[i][0] + seed * (i + 1) * 0.08) % 1;
      const sy = (sources[i][1] + seed * (i + 2) * 0.05) % 1;
      value += Math.sin(Math.hypot(x / scale - sx, y / scale - sy) * 42 - seed * TAU * (i + 1));
    }
    return hue(seed * 0.7 + value / 18);
  },
  // 12 — octave noise gives the familiar cloudy, organic plasma texture.
  function (x, y, w, h, seed) {
    const scale = 7 / Math.max(w, h) * 320;
    return hue(seed * 0.8 + fractalNoise(x * scale, y * scale, seed) * 0.65);
  },
  // 13 — a field of soft circular emitters (metaball-style plasma).
  function (x, y, w, h, seed) {
    let field = 0;
    for (let i = 0; i < 4; i++) {
      const angle = seed * TAU * (i + 1) + i * 1.7;
      const cx = 0.5 + Math.cos(angle) * (0.18 + i * 0.025);
      const cy = 0.5 + Math.sin(angle * 1.13) * (0.18 + i * 0.02);
      const dx = x / w - cx, dy = y / h - cy;
      field += (0.012 + i * 0.002) / (dx * dx + dy * dy + 0.006);
    }
    return hue(seed + Math.min(1, field / 3) * 0.42);
  },
  // 14 — domain warping adds movement and detail to otherwise simple waves.
  function (x, y, w, h, seed, p, palette) {
    const scale = Math.max(w, h);
    const nx = x / scale * 10, ny = y / scale * 10;
    const warpX = Math.sin(ny * 1.7 + seed * TAU) * 0.9 + Math.sin(nx * 0.7 - ny) * 0.35;
    const warpY = Math.cos(nx * 1.35 - seed * TAU) * 0.8 + Math.sin(ny * 0.8 + nx) * 0.35;
    const value = Math.sin(nx + warpX + seed * TAU) + Math.sin(ny + warpY) + Math.sin((nx + ny + warpX - warpY) * 0.7);
    return hue(seed + value / 18, palette);
  },
  // 15 — nearest-cell distance and edge distance from a small Voronoi lattice.
  function (x, y, w, h, seed, p, palette) {
    const scale = Math.max(w, h) / 90;
    const px = x / scale, py = y / scale;
    const ix = Math.floor(px), iy = Math.floor(py);
    let nearest = 10, second = 10;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const cx = ix + ox + hash2(ix + ox, iy + oy, seed);
      const cy = iy + oy + hash2(ix + ox, iy + oy, seed + 31.7);
      const d = Math.hypot(px - cx, py - cy);
      if (d < nearest) { second = nearest; nearest = d; } else if (d < second) second = d;
    }
    return hue(seed * 0.8 + nearest * 0.16 + (second - nearest) * 0.55, palette);
  },
  // 16 — bounded Julia iterations produce a fractal field without a texture map.
  function (x, y, w, h, seed, p, palette) {
    let zx = (x / w - 0.5) * 3.1, zy = (y / h - 0.5) * 3.1;
    const cx = -0.72 + Math.cos(seed * TAU) * 0.08;
    const cy = 0.16 + Math.sin(seed * TAU * 1.7) * 0.08;
    let i = 0, radius = 0;
    for (; i < 24; i++) {
      const nextX = zx * zx - zy * zy + cx;
      zy = 2 * zx * zy + cy;
      zx = nextX;
      radius = zx * zx + zy * zy;
      if (radius > 16) break;
    }
    const smooth = i === 24 ? 0 : i + 1 - Math.log2(Math.log2(Math.max(radius, 1.001)));
    return hue(seed + smooth / 14, palette);
  },
  // 17 — angle/radius coordinates make a set of rotating concentric ribbons.
  function (x, y, w, h, seed, p, palette) {
    const dx = x / w - 0.5, dy = y / h - 0.5;
    const angle = Math.atan2(dy, dx), radius = Math.hypot(dx, dy);
    const value = Math.sin(angle * 9 + radius * 38 - seed * TAU) + Math.sin(radius * 24 + angle * 3);
    return hue(seed * 0.7 + value / 18, palette);
  },
  // 18 — independent RGB oscillators make a deliberately direct RGB plasma.
  function (x, y, w, h, seed) {
    const nx = x / w * TAU * 3, ny = y / h * TAU * 3, phase = seed * TAU;
    const r = (Math.sin(nx + Math.sin(ny + phase) * 2) + 1) * 127.5;
    const g = (Math.sin(ny * 1.2 + Math.cos(nx - phase) * 2) + 1) * 127.5;
    const b = (Math.sin((nx + ny) * 0.7 + phase * 2) + 1) * 127.5;
    return [clamp(r), clamp(g), clamp(b)];
  },
  // 19 — classic marble: a long sine vein disturbed by layered noise.
  function (x, y, w, h, seed, p, palette) {
    const nx = x / Math.max(w, h) * 8, ny = y / Math.max(w, h) * 8;
    const vein = Math.sin((nx + fractalNoise(nx * 0.7, ny * 0.7, seed) * 4 + ny * 0.35) * 2.4);
    return hue(seed * 0.55 + vein * 0.18, palette);
  },
];

// ---------------- state ----------------
const state = {
  mode: 3,
  seed: Math.random(),
  palette: 0,
  pixelSize: 1,
  drift: 0,         // per-frame seed delta; 0 = static
  cycleMs: 0,       // 0 = off, otherwise switch mode every N ms
  running: true,
  lastCycle: 0,
};

const main = document.getElementById("main");
const mainCtx = main.getContext("2d", { alpha: false });

function fitMain() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  // Render at device resolution; pixel-size still controls visible chunkiness.
  main.width = Math.floor(cssW * dpr);
  main.height = Math.floor(cssH * dpr);
  main.style.width = cssW + "px";
  main.style.height = cssH + "px";
  scheduleRender();
}

let renderScheduled = false;
function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    renderTo(mainCtx, main.width, main.height, state.mode, state.seed, state.pixelSize, state.palette, pixelFns);
    syncHud();
  });
}

// ---------------- animation loop ----------------
let lastFrame = 0;
function loop(t) {
  requestAnimationFrame(loop);
  if (!state.running) { lastFrame = t; return; }
  const dt = lastFrame ? (t - lastFrame) : 16;
  lastFrame = t;

  let dirty = false;
  if (state.drift !== 0) {
    state.seed += state.drift * (dt / 16);
    // wrap [0,1)
    state.seed -= Math.floor(state.seed);
    dirty = true;
  }
  if (state.cycleMs > 0) {
    if (!state.lastCycle) state.lastCycle = t;
    if (t - state.lastCycle >= state.cycleMs) {
      state.mode = (state.mode + 1) % MODES.length;
      state.seed = Math.random();
      state.lastCycle = t;
      dirty = true;
      writeHash(location, state);
      updateGallerySelection();
    }
  }
  if (dirty) scheduleRender();
}

// ---------------- HUD / controls ----------------
const modeNameEl = document.getElementById("mode-name");
const modeNoteEl = document.getElementById("mode-note");
const seedEl = document.getElementById("seed-readout");
const modeCountEl = document.getElementById("mode-count");

function syncHud() {
  modeNameEl.textContent = `${state.mode}. ${MODES[state.mode].name}`;
  modeNoteEl.textContent = MODES[state.mode].note;
  seedEl.textContent = state.seed.toFixed(6);
  modeCountEl.textContent = `${String(state.mode + 1).padStart(2, "0")} / ${String(MODES.length).padStart(2, "0")}`;
}

function setMode(m) {
  state.mode = ((m % MODES.length) + MODES.length) % MODES.length;
  updateGallerySelection();
  writeHash(location, state);
  scheduleRender();
}
function setPalette(p) {
  state.palette = Math.max(0, Math.min(PALETTES.length - 1, p | 0));
  if (paletteSelect) paletteSelect.value = state.palette;
  writeHash(location, state);
  scheduleRender();
}
function setSeed(s) {
  state.seed = ((s % 1) + 1) % 1;
  writeHash(location, state);
  scheduleRender();
}
function randomizeSeed() { setSeed(Math.random()); }

// ---------------- gallery ----------------
const gallery = document.getElementById("gallery");
function buildGallery() {
  const tw = 96, th = 64;
  MODES.forEach((m, idx) => {
    const wrap = document.createElement("button");
    wrap.className = "thumb";
    wrap.type = "button";
    wrap.setAttribute("aria-label", `Select ${idx}. ${m.name}`);
    wrap.setAttribute("aria-pressed", "false");
    wrap.dataset.idx = idx;
    wrap.title = `${idx}. ${m.name} — ${m.note}`;
    const c = document.createElement("canvas");
    c.width = tw;
    c.height = th;
    const tctx = c.getContext("2d", { alpha: false });
      renderTo(tctx, tw, th, idx, 0.42 + idx * 0.05, 1, state.palette, pixelFns);
    const lbl = document.createElement("span");
    lbl.textContent = `${idx}. ${m.name}`;
    wrap.appendChild(c);
    wrap.appendChild(lbl);
    wrap.addEventListener("click", () => setMode(idx));
    gallery.appendChild(wrap);
  });
  updateGallerySelection();
}
function updateGallerySelection() {
  for (const el of gallery.children) {
    el.classList.toggle("active", Number(el.dataset.idx) === state.mode);
    el.setAttribute("aria-pressed", String(Number(el.dataset.idx) === state.mode));
  }
}

// ---------------- wiring ----------------
let paletteSelect;
function wireUi() {
  document.getElementById("btn-random").addEventListener("click", randomizeSeed);
  document.getElementById("btn-prev").addEventListener("click", () => setMode(state.mode - 1));
  document.getElementById("btn-next").addEventListener("click", () => setMode(state.mode + 1));

  const saveBtn = document.getElementById("btn-save");
  saveBtn.addEventListener("click", () => {
    const a = document.createElement("a");
    a.download = `plasma-mode${state.mode}-seed${state.seed.toFixed(4)}.png`;
    a.href = main.toDataURL("image/png");
    a.click();
  });

  const shareBtn = document.getElementById("btn-share");
  const shareLabel = shareBtn.querySelector(".button-label");
  shareBtn.addEventListener("click", async () => {
    writeHash(location, state);
    try {
      await navigator.clipboard.writeText(location.href);
      shareLabel.textContent = "Copied!";
      setTimeout(() => shareLabel.textContent = "Copy link", 1200);
    } catch {
      shareLabel.textContent = "Copy failed";
      setTimeout(() => shareLabel.textContent = "Copy link", 1200);
    }
  });

  const pauseBtn = document.getElementById("btn-pause");
  pauseBtn.setAttribute("aria-pressed", "false");
  pauseBtn.addEventListener("click", () => {
    state.running = !state.running;
    pauseBtn.querySelector(".button-label").textContent = state.running ? "Pause" : "Play";
    pauseBtn.setAttribute("aria-pressed", String(!state.running));
    pauseBtn.querySelector(".button-icon").textContent = state.running ? "Ⅱ" : "▶";
  });

  const cycleBtn = document.getElementById("btn-cycle");
  cycleBtn.setAttribute("aria-pressed", "false");
  cycleBtn.addEventListener("click", () => {
    state.cycleMs = state.cycleMs > 0 ? 0 : 4000;
    state.lastCycle = 0;
    cycleBtn.classList.toggle("on", state.cycleMs > 0);
    cycleBtn.setAttribute("aria-pressed", String(state.cycleMs > 0));
  });

  const sizeSlider = document.getElementById("pixel-size");
  const sizeOut = document.getElementById("pixel-size-out");
  sizeSlider.value = state.pixelSize;
  sizeOut.textContent = state.pixelSize;
  sizeSlider.addEventListener("input", () => {
    state.pixelSize = +sizeSlider.value;
    sizeOut.textContent = state.pixelSize;
    writeHash(location, state);
    scheduleRender();
  });

  const driftSlider = document.getElementById("drift");
  const driftOut = document.getElementById("drift-out");
  const fmtDrift = v => v === 0 ? "off" : (v > 0 ? "+" : "") + v.toExponential(1);
  driftSlider.value = 0;
  driftOut.textContent = fmtDrift(0);
  driftSlider.addEventListener("input", () => {
    // map [-100..100] → drift speed with a soft curve, 0 stays 0
    const raw = +driftSlider.value;
    const sign = Math.sign(raw);
    const mag = Math.abs(raw) / 100;
    state.drift = sign * mag * mag * 0.02;
    driftOut.textContent = fmtDrift(state.drift);
  });

  paletteSelect = document.getElementById("palette");
  PALETTES.forEach((palette, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = palette.name;
    paletteSelect.appendChild(option);
  });
  paletteSelect.value = state.palette;
  paletteSelect.addEventListener("change", () => setPalette(+paletteSelect.value));

  const seedInput = document.getElementById("seed-input");
  seedInput.addEventListener("change", () => {
    const v = parseFloat(seedInput.value);
    if (Number.isFinite(v)) setSeed(((v % 1) + 1) % 1);
    seedInput.value = "";
  });

  document.getElementById("btn-settings").addEventListener("click", () => {
    document.getElementById("panel-right").classList.toggle("open");
  });

  main.addEventListener("click", randomizeSeed);

  window.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT" || e.target.isContentEditable) return;
    if (e.key === " ") { e.preventDefault(); pauseBtn.click(); }
    else if (e.key === "ArrowRight") setMode(state.mode + 1);
    else if (e.key === "ArrowLeft") setMode(state.mode - 1);
    else if (e.key.toLowerCase() === "r") randomizeSeed();
    else if (e.key.toLowerCase() === "s") saveBtn.click();
    else if (e.key.toLowerCase() === "c") cycleBtn.click();
    else if (e.key >= "0" && e.key <= "9") setMode(+e.key);
  });

  window.addEventListener("resize", fitMain);
  window.addEventListener("hashchange", () => {
    readHash(location, state, MODES.length, PALETTES.length);
    paletteSelect.value = state.palette;
    sizeSlider.value = state.pixelSize;
    sizeOut.textContent = state.pixelSize;
    scheduleRender();
    updateGallerySelection();
  });
}

// ---------------- boot ----------------
window.addEventListener("DOMContentLoaded", () => {
  readHash(location, state, MODES.length, PALETTES.length);
  wireUi();
  buildGallery();
  fitMain();
  requestAnimationFrame(loop);
});
