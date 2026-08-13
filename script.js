"use strict";

import { MODES, PALETTES } from "./algorithms.js";
import { renderTo } from "./renderer.js";
import { normalizeSeed, PIXEL_SIZE_MAX, PIXEL_SIZE_MIN, readHash, writeHash } from "./url-state.js";

const MAX_DEVICE_PIXEL_RATIO = 1.5;
const DEFAULT_CYCLE_MS = 6000;
const DEFAULT_MOTION = 24;
const ANIMATION_FRAME_MS = 1000 / 30;
const EXPENSIVE_MODES = new Set(["Drift", "Sky / Noise", "Fractal Noise", "Voronoi Glow", "Marble"]);
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const compactControls = window.matchMedia("(max-width: 980px)");

const state = {
  mode: 3,
  seed: Math.random(),
  palette: 0,
  pixelSize: 2,
  motion: prefersReducedMotion.matches ? 0 : DEFAULT_MOTION,
  cycleMs: 0,
  running: true,
  lastCycle: 0,
  scrubbing: false,
};

const main = document.getElementById("main");
const mainCtx = main.getContext("2d", { alpha: false });
const modeNameEl = document.getElementById("mode-name");
const modeNoteEl = document.getElementById("mode-note");
const seedEl = document.getElementById("seed-readout");
const modeCountEl = document.getElementById("mode-count");
const playbackStateEl = document.getElementById("playback-state");
const gallery = document.getElementById("gallery");
const cycleProgress = document.getElementById("cycle-progress");
const toast = document.getElementById("toast");

function motionDelta(value) {
  const sign = Math.sign(value);
  const magnitude = Math.abs(value) / 100;
  return sign * magnitude * magnitude * 0.02;
}

function formatMotion(value) {
  if (value === 0) return "still";
  const speed = Math.abs(motionDelta(value) / motionDelta(DEFAULT_MOTION));
  const prefix = value < 0 ? "−" : "";
  return `${prefix}${speed < 10 ? speed.toFixed(1) : Math.round(speed)}×`;
}

function fitMain() {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
  const cssWidth = Math.max(1, Math.round(window.innerWidth));
  const cssHeight = Math.max(1, Math.round(window.innerHeight));
  main.width = Math.max(1, Math.floor(cssWidth * dpr));
  main.height = Math.max(1, Math.floor(cssHeight * dpr));
  main.style.width = `${cssWidth}px`;
  main.style.height = `${cssHeight}px`;
  scheduleRender();
}

function effectivePixelSize() {
  const isAnimating = (state.running && state.motion !== 0) || state.scrubbing;
  if (!isAnimating) return state.pixelSize;
  const sampleBudget = EXPENSIVE_MODES.has(MODES[state.mode].name) ? 75_000 : 180_000;
  const animationFloor = Math.max(1, Math.ceil(Math.sqrt(main.width * main.height / sampleBudget)));
  return Math.max(animationFloor, state.pixelSize);
}

let renderScheduled = false;
function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    renderTo(mainCtx, main.width, main.height, MODES[state.mode], state.seed, effectivePixelSize(), state.palette);
    syncHud();
  });
}

let animationFrameId = 0;
let lastFrame = 0;
let timeSinceRender = 0;

function hasActivePlayback() {
  return state.running && (state.motion !== 0 || state.cycleMs > 0);
}

function ensureAnimationLoop(resetClock = false) {
  if (resetClock) {
    lastFrame = 0;
    timeSinceRender = ANIMATION_FRAME_MS;
  }
  if (!animationFrameId && hasActivePlayback()) animationFrameId = requestAnimationFrame(loop);
}

function loop(timestamp) {
  animationFrameId = 0;
  if (!hasActivePlayback()) return;

  const elapsed = lastFrame ? Math.min(80, timestamp - lastFrame) : 16;
  lastFrame = timestamp;
  timeSinceRender += elapsed;

  if (state.cycleMs > 0) {
    if (!state.lastCycle) state.lastCycle = timestamp;
    const cycleElapsed = timestamp - state.lastCycle;
    cycleProgress.style.transform = `scaleX(${Math.min(1, cycleElapsed / state.cycleMs)})`;

    if (cycleElapsed >= state.cycleMs) {
      state.mode = (state.mode + 1) % MODES.length;
      state.seed = Math.random();
      state.lastCycle = timestamp;
      updateGallerySelection(true);
      writeHash(window, state);
      timeSinceRender = ANIMATION_FRAME_MS;
    }
  }

  if (timeSinceRender >= ANIMATION_FRAME_MS) {
    if (state.motion !== 0 && !state.scrubbing) {
      state.seed = normalizeSeed(state.seed + motionDelta(state.motion) * (timeSinceRender / 16));
    }
    timeSinceRender = 0;
    scheduleRender();
  }

  ensureAnimationLoop();
}

function syncHud() {
  modeNameEl.textContent = MODES[state.mode].name;
  modeNoteEl.textContent = MODES[state.mode].note;
  seedEl.textContent = state.seed.toFixed(6);
  modeCountEl.textContent = `${String(state.mode + 1).padStart(2, "0")} / ${String(MODES.length).padStart(2, "0")}`;
}

function setMode(mode, { announce = true, scroll = true } = {}) {
  state.mode = ((mode % MODES.length) + MODES.length) % MODES.length;
  state.lastCycle = performance.now();
  cycleProgress.style.transform = "scaleX(0)";
  updateGallerySelection(scroll);
  writeHash(window, state);
  scheduleRender();
  if (announce) showToast(MODES[state.mode].name);
}

function setPalette(palette) {
  state.palette = Math.max(0, Math.min(PALETTES.length - 1, palette | 0));
  paletteSelect.value = state.palette;
  renderGallery();
  writeHash(window, state);
  scheduleRender();
  showToast(`${PALETTES[state.palette].name} palette`);
}

function setSeed(seed, announce = false) {
  state.seed = normalizeSeed(seed);
  state.lastCycle = performance.now();
  writeHash(window, state);
  scheduleRender();
  if (announce) showToast(`Seed ${state.seed.toFixed(4)}`);
}

function randomizeSeed() {
  setSeed(Math.random(), true);
}

const galleryContexts = [];
const THUMB_WIDTH = 96;
const THUMB_HEIGHT = 64;

function renderGallery() {
  galleryContexts.forEach((context, index) => {
    renderTo(context, THUMB_WIDTH, THUMB_HEIGHT, MODES[index], 0.37 + index * 0.041, 1, state.palette);
  });
}

function buildGallery() {
  MODES.forEach((mode, index) => {
    const button = document.createElement("button");
    button.className = "thumb";
    button.type = "button";
    button.dataset.idx = index;
    button.setAttribute("aria-label", `Select ${mode.name}`);
    button.setAttribute("aria-pressed", "false");
    button.title = `${mode.name} — ${mode.note}`;

    const canvas = document.createElement("canvas");
    canvas.width = THUMB_WIDTH;
    canvas.height = THUMB_HEIGHT;
    galleryContexts.push(canvas.getContext("2d", { alpha: false }));

    const label = document.createElement("span");
    label.textContent = mode.name;
    button.append(canvas, label);
    button.addEventListener("click", () => setMode(index, { scroll: false }));
    gallery.appendChild(button);
  });
  renderGallery();
  updateGallerySelection(false);
}

function updateGallerySelection(scroll = false) {
  let active;
  for (const element of gallery.children) {
    const selected = Number(element.dataset.idx) === state.mode;
    element.classList.toggle("active", selected);
    element.setAttribute("aria-pressed", String(selected));
    if (selected) active = element;
  }
  if (scroll && active) {
    active.scrollIntoView({ behavior: prefersReducedMotion.matches ? "auto" : "smooth", block: "nearest", inline: "center" });
  }
}

function syncPlaybackControls() {
  const paused = !state.running;
  const cycling = state.cycleMs > 0;
  pauseBtn.querySelector(".button-label").textContent = paused ? "Play" : "Pause";
  pauseBtn.querySelector(".button-icon").textContent = paused ? "▶" : "Ⅱ";
  pauseBtn.setAttribute("aria-label", paused ? "Play animation" : "Pause animation");
  pauseBtn.setAttribute("aria-pressed", String(paused));
  pauseBtn.title = paused ? "Play animation (Space)" : "Pause animation (Space)";
  cycleBtn.classList.toggle("on", cycling);
  cycleBtn.setAttribute("aria-pressed", String(cycling));
  playbackStateEl.classList.toggle("paused", paused);
  playbackStateEl.lastChild.textContent = paused ? " paused" : cycling ? " auto-playing" : state.motion === 0 ? " still" : " playing";
  if (!cycling) cycleProgress.style.transform = "scaleX(0)";
}

let toastTimer = 0;
function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 1200);
}

let paletteSelect;
let sizeSlider;
let sizeOut;
let driftSlider;
let driftOut;
let cycleRateSlider;
let cycleRateOut;
let cyclePreferenceMs = DEFAULT_CYCLE_MS;
const pauseBtn = document.getElementById("btn-pause");
const cycleBtn = document.getElementById("btn-cycle");

function applyStateToControls() {
  paletteSelect.value = state.palette;
  sizeSlider.value = state.pixelSize;
  sizeOut.textContent = state.pixelSize;
  driftSlider.value = state.motion;
  driftOut.textContent = formatMotion(state.motion);
  if (state.cycleMs > 0) cyclePreferenceMs = state.cycleMs;
  cycleRateSlider.value = cyclePreferenceMs / 1000;
  cycleRateOut.textContent = `${cyclePreferenceMs / 1000} sec`;
  syncPlaybackControls();
}

function setPanelOpen(open) {
  const panel = document.getElementById("panel-right");
  const scrim = document.getElementById("panel-scrim");
  const settingsButton = document.getElementById("btn-settings");
  panel.classList.toggle("open", open);
  scrim.classList.toggle("open", open);
  scrim.setAttribute("aria-hidden", String(!open));
  settingsButton.setAttribute("aria-expanded", String(open));
  settingsButton.setAttribute("aria-label", open ? "Close controls" : "Open controls");
  settingsButton.title = open ? "Close controls (F)" : "Open controls (F)";
}

function wireCanvasGestures() {
  let gesture = null;

  main.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    gesture = { id: event.pointerId, type: event.pointerType, x: event.clientX, y: event.clientY, seed: state.seed, moved: false };
    state.scrubbing = event.pointerType !== "touch";
    main.classList.toggle("is-scrubbing", state.scrubbing);
    main.setPointerCapture(event.pointerId);
  });

  main.addEventListener("pointermove", event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    gesture.moved ||= Math.hypot(dx, dy) > 7;
    if (gesture.type !== "touch" && gesture.moved) {
      state.seed = normalizeSeed(gesture.seed + dx / Math.max(240, main.clientWidth));
      scheduleRender();
    }
  });

  const finishGesture = event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    const wasTouch = gesture.type === "touch";
    const isSwipe = wasTouch && Math.abs(dx) > Math.max(52, main.clientWidth * 0.12) && Math.abs(dx) > Math.abs(dy) * 1.25;

    state.scrubbing = false;
    main.classList.remove("is-scrubbing");
    if (isSwipe) setMode(state.mode + (dx < 0 ? 1 : -1));
    else if (!gesture.moved) randomizeSeed();
    else if (!wasTouch) {
      writeHash(window, state);
      showToast(`Seed ${state.seed.toFixed(4)}`);
    }
    gesture = null;
    ensureAnimationLoop(true);
  };

  main.addEventListener("pointerup", finishGesture);
  main.addEventListener("pointercancel", event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    state.scrubbing = false;
    main.classList.remove("is-scrubbing");
    gesture = null;
    ensureAnimationLoop(true);
  });
}

function wireUi() {
  document.getElementById("btn-random").addEventListener("click", randomizeSeed);
  document.getElementById("btn-prev").addEventListener("click", () => setMode(state.mode - 1));
  document.getElementById("btn-next").addEventListener("click", () => setMode(state.mode + 1));

  const saveBtn = document.getElementById("btn-save");
  saveBtn.addEventListener("click", () => {
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = main.width;
    exportCanvas.height = main.height;
    const exportContext = exportCanvas.getContext("2d", { alpha: false });
    renderTo(exportContext, exportCanvas.width, exportCanvas.height, MODES[state.mode], state.seed, state.pixelSize, state.palette);
    exportCanvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.download = `plasma-${MODES[state.mode].name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${state.seed.toFixed(4)}.png`;
      anchor.href = url;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("PNG saved");
    }, "image/png");
  });

  const shareBtn = document.getElementById("btn-share");
  shareBtn.addEventListener("click", async () => {
    writeHash(window, state);
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: `Plasma Generator — ${MODES[state.mode].name}`, url: location.href });
        showToast("Shared");
      } else {
        await navigator.clipboard.writeText(location.href);
        showToast("Link copied");
      }
    } catch (error) {
      if (error?.name !== "AbortError") showToast("Couldn’t share the link");
    }
  });

  pauseBtn.addEventListener("click", () => {
    state.running = !state.running;
    state.lastCycle = state.running ? performance.now() : 0;
    lastFrame = 0;
    syncPlaybackControls();
    scheduleRender();
    ensureAnimationLoop(true);
  });

  cycleBtn.addEventListener("click", () => {
    state.cycleMs = state.cycleMs > 0 ? 0 : cyclePreferenceMs;
    state.lastCycle = performance.now();
    syncPlaybackControls();
    writeHash(window, state);
    ensureAnimationLoop(true);
  });

  sizeSlider = document.getElementById("pixel-size");
  sizeOut = document.getElementById("pixel-size-out");
  sizeSlider.min = PIXEL_SIZE_MIN;
  sizeSlider.max = PIXEL_SIZE_MAX;
  sizeSlider.addEventListener("input", () => {
    state.pixelSize = Number(sizeSlider.value);
    sizeOut.textContent = state.pixelSize;
    writeHash(window, state);
    scheduleRender();
  });

  driftSlider = document.getElementById("drift");
  driftOut = document.getElementById("drift-out");
  driftSlider.addEventListener("input", () => {
    state.motion = Number(driftSlider.value);
    driftOut.textContent = formatMotion(state.motion);
    syncPlaybackControls();
    writeHash(window, state);
    scheduleRender();
    ensureAnimationLoop(true);
  });

  cycleRateSlider = document.getElementById("cycle-rate");
  cycleRateOut = document.getElementById("cycle-rate-out");
  cycleRateSlider.addEventListener("input", () => {
    cyclePreferenceMs = Number(cycleRateSlider.value) * 1000;
    cycleRateOut.textContent = `${cyclePreferenceMs / 1000} sec`;
    if (state.cycleMs > 0) {
      state.cycleMs = cyclePreferenceMs;
      state.lastCycle = performance.now();
      writeHash(window, state);
    }
  });

  paletteSelect = document.getElementById("palette");
  PALETTES.forEach((palette, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = palette.name;
    paletteSelect.appendChild(option);
  });
  paletteSelect.addEventListener("change", () => setPalette(Number(paletteSelect.value)));

  const seedInput = document.getElementById("seed-input");
  seedInput.addEventListener("change", () => {
    const value = Number.parseFloat(seedInput.value);
    if (Number.isFinite(value)) setSeed(value, true);
    seedInput.value = "";
  });

  const settingsButton = document.getElementById("btn-settings");
  settingsButton.addEventListener("click", () => setPanelOpen(settingsButton.getAttribute("aria-expanded") !== "true"));
  document.getElementById("btn-close-settings").addEventListener("click", () => setPanelOpen(false));
  document.getElementById("panel-scrim").addEventListener("click", () => setPanelOpen(false));
  compactControls.addEventListener("change", event => setPanelOpen(!event.matches));

  gallery.addEventListener("wheel", event => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    gallery.scrollLeft += event.deltaY;
    event.preventDefault();
  }, { passive: false });

  wireCanvasGestures();

  window.addEventListener("keydown", event => {
    if (event.target.closest?.("input, select, button, [contenteditable]")) return;
    if (event.key === " ") { event.preventDefault(); pauseBtn.click(); }
    else if (event.key === "ArrowRight") setMode(state.mode + 1);
    else if (event.key === "ArrowLeft") setMode(state.mode - 1);
    else if (event.key.toLowerCase() === "r") randomizeSeed();
    else if (event.key.toLowerCase() === "s") saveBtn.click();
    else if (event.key.toLowerCase() === "c") cycleBtn.click();
    else if (event.key.toLowerCase() === "f") settingsButton.click();
    else if (event.key === "Escape") setPanelOpen(false);
    else if (event.key >= "0" && event.key <= "9") setMode(Number(event.key));
  });

  window.addEventListener("resize", fitMain);
  window.visualViewport?.addEventListener("resize", fitMain);
  document.addEventListener("visibilitychange", () => {
    lastFrame = 0;
    state.lastCycle = document.hidden ? 0 : performance.now();
    if (!document.hidden) ensureAnimationLoop(true);
  });

  window.addEventListener("hashchange", () => {
    const previousPalette = state.palette;
    readHash(location, state, MODES.length, PALETTES.length);
    applyStateToControls();
    if (state.palette !== previousPalette) renderGallery();
    state.lastCycle = performance.now();
    updateGallerySelection(true);
    scheduleRender();
    ensureAnimationLoop(true);
  });

  applyStateToControls();
  setPanelOpen(!compactControls.matches);
}

window.addEventListener("DOMContentLoaded", () => {
  readHash(location, state, MODES.length, PALETTES.length);
  wireUi();
  buildGallery();
  fitMain();
  ensureAnimationLoop(true);
});
