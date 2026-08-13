"use strict";

import { MODES, PALETTES } from "./algorithms.js";
import {
  DEFAULT_CYCLE_MS,
  advancePlayback,
  createInitialState,
  effectivePixelSize,
  formatMotion,
  isPlaybackActive,
  resizeCycle,
  withCycle,
  withMode,
  withMotion,
  withPalette,
  withPixelSize,
  withRunning,
  withSeed,
} from "./app-state.js";
import { renderTo } from "./renderer.js";
import {
  consumeRenderTime,
  createClock,
  resetClock,
  shouldRender,
  tickClock,
} from "./playback.js";
import { normalizeSeed, PIXEL_SIZE_MAX, PIXEL_SIZE_MIN, readHash, writeHash } from "./url-state.js";
import { createUi } from "./ui.js";

const MAX_DEVICE_PIXEL_RATIO = 1.5;
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const compactControls = window.matchMedia("(max-width: 980px)");

let state;
let ui;
let clock = createClock();
let animationFrameId = 0;
let renderScheduled = false;
let cyclePreferenceMs = DEFAULT_CYCLE_MS;

function fitMain() {
  const { main } = ui.elements;
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
  const cssWidth = Math.max(1, Math.round(window.innerWidth));
  const cssHeight = Math.max(1, Math.round(window.innerHeight));
  main.width = Math.max(1, Math.floor(cssWidth * dpr));
  main.height = Math.max(1, Math.floor(cssHeight * dpr));
  main.style.width = `${cssWidth}px`;
  main.style.height = `${cssHeight}px`;
  scheduleRender();
}

function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    const { main } = ui.elements;
    const mode = MODES[state.mode];
    const pixelSize = effectivePixelSize({
      width: main.width,
      height: main.height,
      state,
      sampleBudget: mode.animationSampleBudget,
    });
    renderTo(ui.mainContext, main.width, main.height, mode, state.seed, pixelSize, state.palette);
    ui.syncHud(state);
  });
}

function hasActivePlayback() {
  return isPlaybackActive(state);
}

function ensureAnimationLoop(reset = false) {
  if (reset) clock = resetClock();
  if (!animationFrameId && hasActivePlayback()) animationFrameId = requestAnimationFrame(loop);
}

function loop(timestamp) {
  animationFrameId = 0;
  if (!hasActivePlayback()) return;

  const tick = tickClock(clock, timestamp);
  clock = tick.clock;

  const playback = advancePlayback(state, tick.elapsedMs, 0, MODES.length);
  state = playback.state;
  ui.setCycleProgress(state.cycleMs ? state.cycleElapsed / state.cycleMs : 0);

  if (playback.sceneChanged) {
    ui.updateGallerySelection(state.mode, true);
    ui.setCycleProgress(state.cycleMs ? state.cycleElapsed / state.cycleMs : 0);
    writeHash(window, state);
  }

  if (shouldRender(clock, playback.sceneChanged)) {
    const consumed = consumeRenderTime(clock);
    clock = consumed.clock;
    state = advancePlayback(state, 0, consumed.elapsedMs, MODES.length).state;
    scheduleRender();
  }

  ensureAnimationLoop();
}

function setMode(mode, { announce = true, scroll = true } = {}) {
  state = withMode(state, mode, MODES.length);
  ui.setCycleProgress(0);
  ui.updateGallerySelection(state.mode, scroll);
  writeHash(window, state);
  scheduleRender();
  if (announce) ui.showToast(MODES[state.mode].name);
}

function setPalette(palette) {
  state = withPalette(state, palette, PALETTES.length);
  ui.elements.paletteSelect.value = state.palette;
  ui.renderGallery(state.palette);
  writeHash(window, state);
  scheduleRender();
  ui.showToast(`${PALETTES[state.palette].name} palette`);
}

function setSeed(seed, announce = false) {
  state = withSeed(state, seed);
  ui.setCycleProgress(0);
  writeHash(window, state);
  scheduleRender();
  if (announce) ui.showToast(`Seed ${state.seed.toFixed(4)}`);
}

function randomizeSeed() {
  setSeed(Math.random(), true);
}

function wireCanvasGestures() {
  const { main } = ui.elements;
  let gesture = null;

  main.addEventListener("pointerdown", event => {
    if (event.button !== 0 || gesture) return;
    gesture = {
      id: event.pointerId,
      type: event.pointerType,
      x: event.clientX,
      y: event.clientY,
      seed: state.seed,
      moved: false,
    };
    state = { ...state, scrubbing: event.pointerType !== "touch" };
    main.classList.toggle("is-scrubbing", state.scrubbing);
    main.setPointerCapture(event.pointerId);
  });

  main.addEventListener("pointermove", event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    gesture.moved ||= Math.hypot(dx, dy) > (gesture.type === "touch" ? 14 : 7);
    if (gesture.type !== "touch" && gesture.moved) {
      state = { ...state, seed: normalizeSeed(gesture.seed + dx / Math.max(240, main.clientWidth)) };
      scheduleRender();
    }
  });

  const finishGesture = event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    const wasTouch = gesture.type === "touch";
    const isSwipe = wasTouch && Math.abs(dx) > Math.max(52, main.clientWidth * 0.12) && Math.abs(dx) > Math.abs(dy) * 1.25;
    const isTap = Math.hypot(dx, dy) <= (wasTouch ? 18 : 7);

    state = { ...state, scrubbing: false };
    main.classList.remove("is-scrubbing");
    if (isSwipe) setMode(state.mode + (dx < 0 ? 1 : -1));
    else if (isTap) randomizeSeed();
    else if (!wasTouch) {
      writeHash(window, state);
      ui.showToast(`Seed ${state.seed.toFixed(4)}`);
    }
    gesture = null;
    scheduleRender();
    ensureAnimationLoop(true);
  };

  main.addEventListener("pointerup", finishGesture);
  main.addEventListener("pointercancel", event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    state = { ...state, scrubbing: false };
    main.classList.remove("is-scrubbing");
    if (gesture.type !== "touch" && gesture.moved) writeHash(window, state);
    gesture = null;
    scheduleRender();
    ensureAnimationLoop(true);
  });
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through for HTTP hosts and browsers with restricted clipboard access.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard unavailable");
}

function savePng() {
  const { main } = ui.elements;
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = main.width;
  exportCanvas.height = main.height;
  const exportContext = exportCanvas.getContext("2d", { alpha: false });
  renderTo(exportContext, exportCanvas.width, exportCanvas.height, MODES[state.mode], state.seed, state.pixelSize, state.palette);
  exportCanvas.toBlob(blob => {
    if (!blob) {
      ui.showToast("Couldn’t create the PNG");
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.download = `plasma-${MODES[state.mode].id}-${state.seed.toFixed(4)}.png`;
    anchor.href = url;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    ui.showToast("PNG saved");
  }, "image/png");
}

function wireUi() {
  const {
    main,
    randomButton,
    saveButton,
    shareButton,
    settingsButton,
    closeSettingsButton,
    panelScrim,
    panel,
    previousButton,
    pauseButton,
    nextButton,
    cycleButton,
    sizeSlider,
    sizeOutput,
    motionSlider,
    motionOutput,
    cycleRateSlider,
    cycleRateOutput,
    paletteSelect,
    seedInput,
    gallery,
  } = ui.elements;

  randomButton.addEventListener("click", randomizeSeed);
  previousButton.addEventListener("click", () => setMode(state.mode - 1));
  nextButton.addEventListener("click", () => setMode(state.mode + 1));
  saveButton.addEventListener("click", savePng);

  shareButton.addEventListener("click", async () => {
    writeHash(window, state);
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        try {
          await navigator.share({ title: `Plasma Generator — ${MODES[state.mode].name}`, url: location.href });
          ui.showToast("Shared");
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
        }
      }
      await copyText(location.href);
      ui.showToast("Link copied");
    } catch {
      ui.showToast("Couldn’t share the link");
    }
  });

  pauseButton.addEventListener("click", () => {
    state = withRunning(state, !state.running);
    clock = resetClock();
    ui.syncPlaybackControls(state);
    scheduleRender();
    ensureAnimationLoop();
  });

  cycleButton.addEventListener("click", () => {
    state = withCycle(state, state.cycleMs > 0 ? 0 : cyclePreferenceMs);
    ui.syncPlaybackControls(state);
    writeHash(window, state);
    ensureAnimationLoop(true);
  });

  sizeSlider.min = PIXEL_SIZE_MIN;
  sizeSlider.max = PIXEL_SIZE_MAX;
  sizeSlider.addEventListener("input", () => {
    state = withPixelSize(state, Number(sizeSlider.value), PIXEL_SIZE_MIN, PIXEL_SIZE_MAX);
    sizeOutput.textContent = state.pixelSize;
    writeHash(window, state);
    scheduleRender();
  });

  motionSlider.addEventListener("input", () => {
    state = withMotion(state, Number(motionSlider.value), -100, 100);
    motionOutput.textContent = formatMotion(state.motion);
    ui.syncPlaybackControls(state);
    writeHash(window, state);
    scheduleRender();
    ensureAnimationLoop(true);
  });

  cycleRateSlider.addEventListener("input", () => {
    cyclePreferenceMs = Number(cycleRateSlider.value) * 1000;
    cycleRateOutput.textContent = `${cyclePreferenceMs / 1000} sec`;
    if (state.cycleMs > 0) {
      state = resizeCycle(state, cyclePreferenceMs);
      writeHash(window, state);
    }
  });

  paletteSelect.addEventListener("change", () => setPalette(Number(paletteSelect.value)));
  seedInput.addEventListener("change", () => {
    const value = Number.parseFloat(seedInput.value);
    if (Number.isFinite(value)) setSeed(value, true);
    seedInput.value = "";
  });

  settingsButton.addEventListener("click", () => setPanelOpen(settingsButton.getAttribute("aria-expanded") !== "true"));
  closeSettingsButton.addEventListener("click", () => setPanelOpen(false));
  panelScrim.addEventListener("click", () => setPanelOpen(false));
  compactControls.addEventListener("change", event => setPanelOpen(!event.matches));
  panel.addEventListener("keydown", event => {
    if (event.key !== "Tab" || !compactControls.matches) return;
    const controls = [...event.currentTarget.querySelectorAll("button, input, select")].filter(element => !element.disabled);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  gallery.addEventListener("wheel", event => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    gallery.scrollLeft += event.deltaY;
    event.preventDefault();
  }, { passive: false });

  wireCanvasGestures();

  window.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      setPanelOpen(false);
      return;
    }
    if (event.target.closest?.("input, select, button, [contenteditable]")) return;
    if (event.key === " ") { event.preventDefault(); pauseButton.click(); }
    else if (event.key === "ArrowRight") setMode(state.mode + 1);
    else if (event.key === "ArrowLeft") setMode(state.mode - 1);
    else if (event.key.toLowerCase() === "r") randomizeSeed();
    else if (event.key.toLowerCase() === "s") saveButton.click();
    else if (event.key.toLowerCase() === "c") cycleButton.click();
    else if (event.key.toLowerCase() === "f") settingsButton.click();
    else if (event.key >= "0" && event.key <= "9") setMode(Number(event.key));
  });

  window.addEventListener("resize", fitMain);
  window.visualViewport?.addEventListener("resize", fitMain);
  document.addEventListener("visibilitychange", () => {
    clock = resetClock();
    if (!document.hidden) ensureAnimationLoop();
  });
  prefersReducedMotion.addEventListener("change", event => {
    if (!event.matches || !state.running) return;
    state = withRunning(state, false);
    clock = resetClock();
    ui.syncPlaybackControls(state);
    scheduleRender();
    ui.showToast("Motion paused");
  });

  window.addEventListener("hashchange", () => {
    const previousPalette = state.palette;
    readHash(location, state, MODES.length, PALETTES.length);
    if (state.cycleMs > 0) cyclePreferenceMs = state.cycleMs;
    ui.applyStateToControls(state, cyclePreferenceMs);
    if (state.palette !== previousPalette) ui.renderGallery(state.palette);
    state = { ...state, cycleElapsed: 0 };
    ui.setCycleProgress(0);
    ui.updateGallerySelection(state.mode, true);
    scheduleRender();
    ensureAnimationLoop(true);
  });

  ui.applyStateToControls(state, cyclePreferenceMs);
  setPanelOpen(!compactControls.matches);
}

function setPanelOpen(open) {
  ui.setPanelOpen(open);
}

window.addEventListener("DOMContentLoaded", () => {
  state = createInitialState({ reducedMotion: prefersReducedMotion.matches });
  readHash(location, state, MODES.length, PALETTES.length);
  if (state.cycleMs > 0) cyclePreferenceMs = state.cycleMs;
  ui = createUi(document, { modes: MODES, palettes: PALETTES, prefersReducedMotion, compactControls });
  wireUi();
  ui.buildGallery(index => setMode(index, { scroll: false }));
  ui.renderGallery(state.palette);
  ui.updateGallerySelection(state.mode);
  fitMain();
  ensureAnimationLoop(true);
});
