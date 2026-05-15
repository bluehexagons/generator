"use strict";

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
];

// ---------------- pixel functions ----------------
// Faithful ports of the original pixelN() string-returning functions,
// rewritten to write three bytes directly. Math is identical.
const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;

const pixelFns = [
  // 0
  function (x, y, w, h, seed) {
    const c = Math.random() * 16777216 * (1 - x / w) + seed * 16777216 * (x / w);
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
    r = r * (1 - t) + Math.random() * 256 * t;
    g = g * (1 - t) + Math.random() * 256 * t;
    b = b * (1 - t) + Math.random() * 256 * t;
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
];

// ---------------- renderer ----------------
function renderTo(ctx, w, h, mode, seed, pixelSize) {
  const fn = pixelFns[mode];
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const s = Math.max(1, pixelSize | 0);

  for (let y = 0; y < h; y += s) {
    for (let x = 0; x < w; x += s) {
      const p = y * w + x;
      const [r, g, b] = fn(x, y, w, h, seed, p);
      const ymax = Math.min(h, y + s);
      const xmax = Math.min(w, x + s);
      for (let yy = y; yy < ymax; yy++) {
        let idx = (yy * w + x) * 4;
        for (let xx = x; xx < xmax; xx++) {
          data[idx]     = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
          idx += 4;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------- state ----------------
const state = {
  mode: 3,
  seed: Math.random(),
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
  // render at logical resolution; pixel-size already does the chunkiness.
  main.width = Math.floor(cssW);
  main.height = Math.floor(cssH);
  main.style.width = cssW + "px";
  main.style.height = cssH + "px";
  void dpr;
  scheduleRender();
}

let renderScheduled = false;
function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    renderTo(mainCtx, main.width, main.height, state.mode, state.seed, state.pixelSize);
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
  // modes 0 and 8 use Math.random per pixel — they animate even when static.
  if (state.mode === 0 || state.mode === 8) dirty = true;

  if (state.cycleMs > 0) {
    if (!state.lastCycle) state.lastCycle = t;
    if (t - state.lastCycle >= state.cycleMs) {
      state.mode = (state.mode + 1) % MODES.length;
      state.seed = Math.random();
      state.lastCycle = t;
      dirty = true;
      writeHash();
      updateGallerySelection();
    }
  }
  if (dirty) scheduleRender();
}

// ---------------- HUD / controls ----------------
const modeNameEl = document.getElementById("mode-name");
const modeNoteEl = document.getElementById("mode-note");
const seedEl = document.getElementById("seed-readout");

function syncHud() {
  modeNameEl.textContent = `${state.mode}. ${MODES[state.mode].name}`;
  modeNoteEl.textContent = MODES[state.mode].note;
  seedEl.textContent = state.seed.toFixed(6);
}

function setMode(m) {
  state.mode = ((m % MODES.length) + MODES.length) % MODES.length;
  updateGallerySelection();
  writeHash();
  scheduleRender();
}
function setSeed(s) { state.seed = s; writeHash(); scheduleRender(); }
function randomizeSeed() { setSeed(Math.random()); }

// ---------------- gallery ----------------
const gallery = document.getElementById("gallery");
function buildGallery() {
  const tw = 96, th = 64;
  MODES.forEach((m, idx) => {
    const wrap = document.createElement("button");
    wrap.className = "thumb";
    wrap.dataset.idx = idx;
    wrap.title = `${idx}. ${m.name} — ${m.note}`;
    const c = document.createElement("canvas");
    c.width = tw;
    c.height = th;
    const tctx = c.getContext("2d", { alpha: false });
    renderTo(tctx, tw, th, idx, 0.42 + idx * 0.05, 1);
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
  }
}

// ---------------- URL hash sync ----------------
function writeHash() {
  const h = `#mode=${state.mode}&seed=${state.seed.toFixed(6)}&size=${state.pixelSize}`;
  if (location.hash !== h) history.replaceState(null, "", h);
}
function readHash() {
  const h = location.hash.replace(/^#/, "");
  if (!h) return;
  const params = Object.fromEntries(h.split("&").map(s => s.split("=")));
  if (params.mode != null) state.mode = Math.max(0, Math.min(MODES.length - 1, +params.mode | 0));
  if (params.seed != null) {
    const f = parseFloat(params.seed);
    if (Number.isFinite(f)) state.seed = f;
  }
  if (params.size != null) state.pixelSize = Math.max(1, Math.min(40, +params.size | 0));
}

// ---------------- wiring ----------------
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
  shareBtn.addEventListener("click", async () => {
    writeHash();
    try {
      await navigator.clipboard.writeText(location.href);
      shareBtn.textContent = "Copied!";
      setTimeout(() => shareBtn.textContent = "Copy link", 1200);
    } catch {
      shareBtn.textContent = "—";
    }
  });

  const pauseBtn = document.getElementById("btn-pause");
  pauseBtn.addEventListener("click", () => {
    state.running = !state.running;
    pauseBtn.textContent = state.running ? "Pause" : "Play";
  });

  const cycleBtn = document.getElementById("btn-cycle");
  cycleBtn.addEventListener("click", () => {
    state.cycleMs = state.cycleMs > 0 ? 0 : 4000;
    state.lastCycle = 0;
    cycleBtn.classList.toggle("on", state.cycleMs > 0);
  });

  const sizeSlider = document.getElementById("pixel-size");
  const sizeOut = document.getElementById("pixel-size-out");
  sizeSlider.value = state.pixelSize;
  sizeOut.textContent = state.pixelSize;
  sizeSlider.addEventListener("input", () => {
    state.pixelSize = +sizeSlider.value;
    sizeOut.textContent = state.pixelSize;
    writeHash();
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

  const seedInput = document.getElementById("seed-input");
  seedInput.addEventListener("change", () => {
    const v = parseFloat(seedInput.value);
    if (Number.isFinite(v)) setSeed(((v % 1) + 1) % 1);
    seedInput.value = "";
  });

  main.addEventListener("click", randomizeSeed);

  window.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT") return;
    if (e.key === " ") { e.preventDefault(); pauseBtn.click(); }
    else if (e.key === "ArrowRight") setMode(state.mode + 1);
    else if (e.key === "ArrowLeft") setMode(state.mode - 1);
    else if (e.key === "r") randomizeSeed();
    else if (e.key === "s") saveBtn.click();
    else if (e.key === "c") cycleBtn.click();
    else if (e.key >= "0" && e.key <= "9") setMode(+e.key);
  });

  window.addEventListener("resize", fitMain);
  window.addEventListener("hashchange", () => { readHash(); scheduleRender(); updateGallerySelection(); });
}

// ---------------- boot ----------------
window.addEventListener("DOMContentLoaded", () => {
  readHash();
  wireUi();
  buildGallery();
  fitMain();
  requestAnimationFrame(loop);
});
