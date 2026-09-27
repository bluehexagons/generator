import { MODES, PALETTES } from "./algorithms.ts";
import {
  DEFAULT_CYCLE_MS,
  advanceFrame,
  createInitialState,
  effectivePixelSize,
  isPlaybackActive,
  resizeCycle,
  withCycle,
  withMode,
  withMotion,
  withPalette,
  withPixelSize,
  withRunning,
  withSeed,
} from "./app-state.ts";
import type { AppState } from "./app-state.ts";
import { renderTo } from "./renderer.ts";
import {
  ANIMATION_FRAME_MS,
  consumeRenderTime,
  createClock,
  resetClock,
  tickClock,
} from "./playback.ts";
import {
  CYCLE_SECONDS_MAX,
  CYCLE_SECONDS_MIN,
  MOTION_MAX,
  MOTION_MIN,
  normalizeSeed,
  PIXEL_SIZE_MAX,
  PIXEL_SIZE_MIN,
  readHash,
  writeHash,
} from "./url-state.ts";
import { createUi } from "./ui.ts";

const MAX_DEVICE_PIXEL_RATIO = 1.5;
const MODE_IDS = MODES.map((mode) => mode.id);
const HIDE_UI_STORAGE_KEY = "plasma-generator:hide-ui";
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const compactControls = window.matchMedia("(max-width: 980px)");

let state: AppState;
let ui: ReturnType<typeof createUi>;
let clock = createClock();
let animationFrameId = 0;
let renderScheduled = false;
let transitionRenderScheduled = false;
let cyclePreferenceMs = DEFAULT_CYCLE_MS;
let showcaseActive = false;
let recentShowcaseModes: number[] = [];
let hideUiWhenIdle = false;
let idleUiTimer = 0;

function writeCurrentHash() {
  writeHash(window, state, MODE_IDS);
}

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

function scheduleRender(fade = false) {
  transitionRenderScheduled ||= fade;
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    const { main } = ui.elements;
    if (transitionRenderScheduled && main.width > 0 && main.height > 0) {
      const { transition } = ui.elements;
      transition.width = main.width;
      transition.height = main.height;
      ui.transitionContext.clearRect(0, 0, transition.width, transition.height);
      ui.transitionContext.drawImage(main, 0, 0);
      transition.classList.remove("fade");
      transition.classList.add("covering");
    }
    const fadeTransition = transitionRenderScheduled;
    transitionRenderScheduled = false;
    const mode = MODES[state.mode];
    const pixelSize = effectivePixelSize({
      width: main.width,
      height: main.height,
      state,
      sampleBudget: mode.animationSampleBudget,
    });
    renderTo(ui.mainContext, main.width, main.height, mode, state.seed, pixelSize, state.palette);
    ui.syncHud(state);
    if (fadeTransition) {
      const { transition } = ui.elements;
      requestAnimationFrame(() => {
        transition.classList.remove("covering");
        transition.classList.add("fade");
      });
    }
  });
}

function chooseShowcaseMode(currentMode: number) {
  const recent = new Set(recentShowcaseModes.slice(-7));
  recent.add(currentMode);
  let candidates = MODES.map((_, index) => index).filter((index) => !recent.has(index));
  if (candidates.length === 0)
    candidates = MODES.map((_, index) => index).filter((index) => index !== currentMode);
  const selected =
    candidates[Math.floor(Math.random() * candidates.length)] ?? (currentMode + 1) % MODES.length;
  recentShowcaseModes.push(selected);
  recentShowcaseModes = recentShowcaseModes.slice(-8);
  return selected;
}

function setShowcase(active: boolean) {
  showcaseActive = active;
  if (active) {
    recentShowcaseModes = [state.mode];
    state = withCycle(state, cyclePreferenceMs);
    state = withRunning(state, true);
  } else if (showcaseActive === false && state.cycleMs > 0) {
    state = withCycle(state, 0);
  }
  ui.syncPlaybackControls(state, showcaseActive);
  writeCurrentHash();
  ensureAnimationLoop(true);
}

function armIdleUiTimer() {
  window.clearTimeout(idleUiTimer);
  document.body.classList.remove("ui-hidden");
  if (!hideUiWhenIdle) return;
  idleUiTimer = window.setTimeout(() => {
    const activeElement = document.activeElement;
    const focusIsInUi =
      activeElement instanceof HTMLElement && activeElement.closest(".top-bar, .bottom-deck");
    if (!focusIsInUi) document.body.classList.add("ui-hidden");
  }, 4200);
}

function toggleFullscreen() {
  const change = document.fullscreenElement
    ? document.exitFullscreen()
    : document.documentElement.requestFullscreen();
  void change.catch(() => ui.showToast("Fullscreen unavailable"));
}

function readHideUiPreference() {
  try {
    return window.localStorage.getItem(HIDE_UI_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function hasActivePlayback() {
  return isPlaybackActive(state);
}

function ensureAnimationLoop(reset = false) {
  if (reset) clock = resetClock();
  if (!animationFrameId && hasActivePlayback()) animationFrameId = requestAnimationFrame(loop);
}

function loop(timestamp: number) {
  animationFrameId = 0;
  if (!hasActivePlayback()) return;

  const tick = tickClock(clock, timestamp);
  clock = tick.clock;

  const playback = advanceFrame(
    state,
    tick.elapsedMs,
    clock.timeSinceRender,
    ANIMATION_FRAME_MS,
    MODES.length,
    Math.random,
    MODES[state.mode].motionScale,
    showcaseActive ? chooseShowcaseMode : undefined,
  );
  state = playback.state;

  if (playback.sceneChanged) {
    ui.updateGallerySelection(state.mode, true);
    writeCurrentHash();
  }

  if (state.cycleMs > 0) {
    ui.setCycleProgress(state.cycleElapsed / state.cycleMs);
  }

  if (playback.renderRequested) {
    const consumed = consumeRenderTime(clock);
    clock = consumed.clock;
    scheduleRender(playback.sceneChanged);
  }

  ensureAnimationLoop();
}

function setMode(
  mode: number,
  { announce = true, scroll = true }: { announce?: boolean; scroll?: boolean } = {},
) {
  state = withMode(state, mode, MODES.length);
  if (showcaseActive) recentShowcaseModes = [state.mode];
  ui.setCycleProgress(0);
  ui.updateGallerySelection(state.mode, scroll);
  writeCurrentHash();
  scheduleRender(true);
  if (announce) ui.showToast(MODES[state.mode].name);
}

function setPalette(palette: number) {
  state = withPalette(state, palette, PALETTES.length);
  ui.setPaletteValue(state.palette);
  ui.renderGallery(state.palette);
  writeCurrentHash();
  scheduleRender();
  ui.showToast(`${PALETTES[state.palette].name} palette`);
}

function setSeed(seed: number, announce = false) {
  state = withSeed(state, seed);
  ui.setCycleProgress(0);
  writeCurrentHash();
  scheduleRender();
  if (announce) ui.showToast(`Seed ${state.seed.toFixed(4)}`);
}

function randomizeSeed() {
  setSeed(Math.random(), true);
}

function wireCanvasGestures() {
  const { main } = ui.elements;
  let gesture: {
    id: number;
    type: string;
    x: number;
    y: number;
    seed: number;
    moved: boolean;
  } | null = null;

  main.addEventListener("pointerdown", (event) => {
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

  main.addEventListener("pointermove", (event) => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    gesture.moved ||= Math.hypot(dx, dy) > (gesture.type === "touch" ? 14 : 7);
    if (gesture.type !== "touch" && gesture.moved) {
      state = {
        ...state,
        seed: normalizeSeed(gesture.seed + dx / Math.max(240, main.clientWidth)),
      };
      scheduleRender();
    }
  });

  const finishGesture = (event: PointerEvent) => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    const wasTouch = gesture.type === "touch";
    const isSwipe =
      wasTouch &&
      Math.abs(dx) > Math.max(52, main.clientWidth * 0.12) &&
      Math.abs(dx) > Math.abs(dy) * 1.25;
    const isTap = Math.hypot(dx, dy) <= (wasTouch ? 18 : 7);

    state = { ...state, scrubbing: false };
    main.classList.remove("is-scrubbing");
    if (isSwipe) setMode(state.mode + (dx < 0 ? 1 : -1));
    else if (isTap) randomizeSeed();
    else if (!wasTouch) {
      writeCurrentHash();
      ui.showToast(`Seed ${state.seed.toFixed(4)}`);
    }
    gesture = null;
    scheduleRender();
    ensureAnimationLoop(true);
  };

  main.addEventListener("pointerup", finishGesture);
  main.addEventListener("pointercancel", (event) => {
    if (!gesture || gesture.id !== event.pointerId) return;
    state = { ...state, scrubbing: false };
    main.classList.remove("is-scrubbing");
    if (gesture.type !== "touch" && gesture.moved) writeCurrentHash();
    gesture = null;
    scheduleRender();
    ensureAnimationLoop(true);
  });
}

async function copyText(text: string) {
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
  if (!exportContext) throw new Error("Canvas 2D is unavailable");
  renderTo(
    exportContext,
    exportCanvas.width,
    exportCanvas.height,
    MODES[state.mode],
    state.seed,
    state.pixelSize,
    state.palette,
  );
  exportCanvas.toBlob((blob) => {
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
    randomButton,
    saveButton,
    shareButton,
    fullscreenButton,
    settingsButton,
    closeSettingsButton,
    panelScrim,
    panel,
    previousButton,
    pauseButton,
    nextButton,
    cycleButton,
    showcaseButton,
    hideUiInput,
    sizeSlider,
    motionSlider,
    cycleRateSlider,
    paletteSelect,
    seedInput,
    gallery,
  } = ui.elements;

  randomButton.addEventListener("click", randomizeSeed);
  fullscreenButton.addEventListener("click", toggleFullscreen);
  showcaseButton.addEventListener("click", () => setShowcase(!showcaseActive));
  hideUiWhenIdle = readHideUiPreference();
  hideUiInput.checked = hideUiWhenIdle;
  hideUiInput.addEventListener("change", () => {
    hideUiWhenIdle = hideUiInput.checked;
    try {
      window.localStorage.setItem(HIDE_UI_STORAGE_KEY, String(hideUiWhenIdle));
    } catch {
      // Keep the toggle usable when browser storage is unavailable.
    }
    armIdleUiTimer();
  });
  previousButton.addEventListener("click", () => setMode(state.mode - 1));
  nextButton.addEventListener("click", () => setMode(state.mode + 1));
  saveButton.addEventListener("click", savePng);

  shareButton.addEventListener("click", async () => {
    writeCurrentHash();
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        try {
          await navigator.share({
            title: `Plasma Generator — ${MODES[state.mode].name}`,
            url: location.href,
          });
          ui.showToast("Shared");
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
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
    ui.syncPlaybackControls(state, showcaseActive);
    scheduleRender();
    ensureAnimationLoop();
  });

  cycleButton.addEventListener("click", () => {
    showcaseActive = false;
    state = withCycle(state, state.cycleMs > 0 ? 0 : cyclePreferenceMs);
    ui.syncPlaybackControls(state, showcaseActive);
    writeCurrentHash();
    ensureAnimationLoop(true);
  });

  sizeSlider.min = String(PIXEL_SIZE_MIN);
  sizeSlider.max = String(PIXEL_SIZE_MAX);
  motionSlider.min = String(MOTION_MIN);
  motionSlider.max = String(MOTION_MAX);
  cycleRateSlider.min = String(CYCLE_SECONDS_MIN);
  cycleRateSlider.max = String(CYCLE_SECONDS_MAX);
  sizeSlider.addEventListener("input", () => {
    state = withPixelSize(state, Number(sizeSlider.value), PIXEL_SIZE_MIN, PIXEL_SIZE_MAX);
    ui.setPixelSizeValue(state.pixelSize);
    writeCurrentHash();
    scheduleRender();
  });

  motionSlider.addEventListener("input", () => {
    state = withMotion(state, Number(motionSlider.value), MOTION_MIN, MOTION_MAX);
    ui.setMotionValue(state.motion);
    ui.syncPlaybackControls(state, showcaseActive);
    writeCurrentHash();
    scheduleRender();
    ensureAnimationLoop(true);
  });

  cycleRateSlider.addEventListener("input", () => {
    cyclePreferenceMs = Number(cycleRateSlider.value) * 1000;
    ui.setCycleRateValue(cyclePreferenceMs);
    if (state.cycleMs > 0) {
      state = resizeCycle(state, cyclePreferenceMs);
      writeCurrentHash();
    }
  });

  paletteSelect.addEventListener("change", () => setPalette(Number(paletteSelect.value)));
  seedInput.addEventListener("change", () => {
    const value = Number.parseFloat(seedInput.value);
    if (Number.isFinite(value)) setSeed(value, true);
    seedInput.value = "";
  });

  settingsButton.addEventListener("click", () =>
    setPanelOpen(settingsButton.getAttribute("aria-expanded") !== "true"),
  );
  closeSettingsButton.addEventListener("click", () => setPanelOpen(false));
  panelScrim.addEventListener("click", () => setPanelOpen(false));
  compactControls.addEventListener("change", (event) => setPanelOpen(!event.matches));
  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || !compactControls.matches) return;
    const controls = [
      ...panel.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>(
        "button, input, select",
      ),
    ].filter((element) => !element.disabled);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });

  gallery.addEventListener(
    "wheel",
    (event) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      gallery.scrollLeft += event.deltaY;
      event.preventDefault();
    },
    { passive: false },
  );

  wireCanvasGestures();

  gallery.addEventListener("keydown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches(".thumb")) return;

    const currentMode = Number(target.dataset.idx);
    const nextMode =
      event.key === "ArrowRight"
        ? currentMode + 1
        : event.key === "ArrowLeft"
          ? currentMode - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? MODES.length - 1
              : null;
    if (nextMode === null) return;

    event.preventDefault();
    setMode(nextMode);
    ui.focusGalleryMode(state.mode);
  });

  window.addEventListener("pointermove", armIdleUiTimer, { passive: true });
  window.addEventListener("pointerdown", armIdleUiTimer, { passive: true });
  window.addEventListener("keydown", armIdleUiTimer);
  document.addEventListener("fullscreenchange", ui.syncFullscreen);
  ui.syncFullscreen();

  window.addEventListener("keydown", (event) => {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    if (event.key === "Escape") {
      setPanelOpen(false);
      return;
    }
    const target = event.target;
    if (target instanceof Element && target.closest("input, select, textarea, [contenteditable]"))
      return;
    if (target instanceof Element && target.closest("button") && [" ", "Enter"].includes(event.key))
      return;
    if (event.key === " ") {
      event.preventDefault();
      pauseButton.click();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setMode(state.mode + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setMode(state.mode - 1);
    } else if (event.key.toLowerCase() === "r") randomizeSeed();
    else if (event.key.toLowerCase() === "s") saveButton.click();
    else if (event.key.toLowerCase() === "c") cycleButton.click();
    else if (event.key.toLowerCase() === "f") settingsButton.click();
    else if (event.key.toLowerCase() === "g") fullscreenButton.click();
    else if (event.key >= "0" && event.key <= "9") {
      const digit = Number(event.key);
      setMode(digit === 0 ? 9 : digit - 1);
    }
  });

  window.addEventListener("resize", fitMain);
  window.visualViewport?.addEventListener("resize", fitMain);
  document.addEventListener("visibilitychange", () => {
    clock = resetClock();
    if (!document.hidden) ensureAnimationLoop();
  });
  prefersReducedMotion.addEventListener("change", (event) => {
    if (!event.matches || !state.running) return;
    state = withRunning(state, false);
    clock = resetClock();
    ui.syncPlaybackControls(state, showcaseActive);
    scheduleRender();
    ui.showToast("Motion paused");
  });

  window.addEventListener("hashchange", () => {
    const previousPalette = state.palette;
    readHash(location, state, MODES.length, PALETTES.length, MODE_IDS);
    if (state.cycleMs > 0) cyclePreferenceMs = state.cycleMs;
    showcaseActive = false;
    ui.applyStateToControls(state, cyclePreferenceMs, showcaseActive);
    if (state.palette !== previousPalette) ui.renderGallery(state.palette);
    state = { ...state, cycleElapsed: 0 };
    ui.setCycleProgress(0);
    ui.updateGallerySelection(state.mode, true);
    scheduleRender();
    ensureAnimationLoop(true);
  });

  ui.applyStateToControls(state, cyclePreferenceMs);
  setPanelOpen(!compactControls.matches);
  armIdleUiTimer();
}

function setPanelOpen(open: boolean) {
  ui.setPanelOpen(open);
}

window.addEventListener("DOMContentLoaded", () => {
  state = createInitialState({ reducedMotion: prefersReducedMotion.matches });
  readHash(location, state, MODES.length, PALETTES.length, MODE_IDS);
  if (state.cycleMs > 0) cyclePreferenceMs = state.cycleMs;
  ui = createUi(document, {
    modes: MODES,
    palettes: PALETTES,
    prefersReducedMotion,
    compactControls,
  });
  wireUi();
  ui.buildGallery((index) => setMode(index, { scroll: false }));
  ui.renderGallery(state.palette);
  ui.updateGallerySelection(state.mode);
  fitMain();
  ensureAnimationLoop(true);
});
