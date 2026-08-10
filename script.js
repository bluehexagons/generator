"use strict";

import { renderTo } from "./renderer.js";
import { readHash, writeHash } from "./url-state.js";
import { MODES, PALETTES } from "./algorithms.js";

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
    renderTo(mainCtx, main.width, main.height, MODES[state.mode], state.seed, state.pixelSize, state.palette);
    syncHud();
  });
}

// ---------------- animation loop ----------------
let animationFrameId = 0;
let lastFrame = 0;

function ensureAnimationLoop(resetClock = false) {
  if (!animationFrameId && state.running && (state.drift !== 0 || state.cycleMs > 0)) {
    if (resetClock) lastFrame = 0;
    animationFrameId = requestAnimationFrame(loop);
  }
}

function loop(t) {
  animationFrameId = 0;
  if (!state.running) return;
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
      writeHash(window, state);
      updateGallerySelection();
    }
  }
  if (dirty) scheduleRender();
  ensureAnimationLoop();
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
  writeHash(window, state);
  scheduleRender();
}
function setPalette(p) {
  state.palette = Math.max(0, Math.min(PALETTES.length - 1, p | 0));
  paletteSelect.value = state.palette;
  renderGallery();
  writeHash(window, state);
  scheduleRender();
}
function setSeed(s) {
  state.seed = ((s % 1) + 1) % 1;
  writeHash(window, state);
  scheduleRender();
}
function randomizeSeed() { setSeed(Math.random()); }

// ---------------- gallery ----------------
const gallery = document.getElementById("gallery");
const galleryCanvases = [];
const THUMB_WIDTH = 96;
const THUMB_HEIGHT = 64;

function renderGallery() {
  galleryCanvases.forEach((canvas, index) => {
    const context = canvas.getContext("2d", { alpha: false });
    const seed = 0.42 + index * 0.05;
    renderTo(context, THUMB_WIDTH, THUMB_HEIGHT, MODES[index], seed, 1, state.palette);
  });
}

function buildGallery() {
  MODES.forEach((m, idx) => {
    const wrap = document.createElement("button");
    wrap.className = "thumb";
    wrap.type = "button";
    wrap.setAttribute("aria-label", `Select ${idx}. ${m.name}`);
    wrap.setAttribute("aria-pressed", "false");
    wrap.dataset.idx = idx;
    wrap.title = `${idx}. ${m.name} — ${m.note}`;
    const c = document.createElement("canvas");
    c.width = THUMB_WIDTH;
    c.height = THUMB_HEIGHT;
    galleryCanvases.push(c);
    const lbl = document.createElement("span");
    lbl.textContent = `${idx}. ${m.name}`;
    wrap.appendChild(c);
    wrap.appendChild(lbl);
    wrap.addEventListener("click", () => setMode(idx));
    gallery.appendChild(wrap);
  });
  renderGallery();
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
    main.toBlob(blob => {
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.download = `plasma-mode${state.mode}-seed${state.seed.toFixed(4)}.png`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }, "image/png");
  });

  const shareBtn = document.getElementById("btn-share");
  const shareLabel = shareBtn.querySelector(".button-label");
  shareBtn.addEventListener("click", async () => {
    writeHash(window, state);
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
    lastFrame = 0;
    state.lastCycle = 0;
    pauseBtn.querySelector(".button-label").textContent = state.running ? "Pause" : "Play";
    pauseBtn.setAttribute("aria-pressed", String(!state.running));
    pauseBtn.querySelector(".button-icon").textContent = state.running ? "Ⅱ" : "▶";
    ensureAnimationLoop(true);
  });

  const cycleBtn = document.getElementById("btn-cycle");
  cycleBtn.setAttribute("aria-pressed", "false");
  cycleBtn.addEventListener("click", () => {
    state.cycleMs = state.cycleMs > 0 ? 0 : 4000;
    state.lastCycle = 0;
    cycleBtn.classList.toggle("on", state.cycleMs > 0);
    cycleBtn.setAttribute("aria-pressed", String(state.cycleMs > 0));
    ensureAnimationLoop(true);
  });

  const sizeSlider = document.getElementById("pixel-size");
  const sizeOut = document.getElementById("pixel-size-out");
  sizeSlider.value = state.pixelSize;
  sizeOut.textContent = state.pixelSize;
  sizeSlider.addEventListener("input", () => {
    state.pixelSize = +sizeSlider.value;
    sizeOut.textContent = state.pixelSize;
    writeHash(window, state);
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
    ensureAnimationLoop(true);
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

  const settingsBtn = document.getElementById("btn-settings");
  const settingsPanel = document.getElementById("panel-right");
  settingsBtn.addEventListener("click", () => {
    const isOpen = settingsPanel.classList.toggle("open");
    settingsBtn.setAttribute("aria-expanded", String(isOpen));
  });

  main.addEventListener("click", randomizeSeed);

  window.addEventListener("keydown", e => {
    if (e.target.closest?.("input, select, button, [contenteditable]")) return;
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
    renderGallery();
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
});
