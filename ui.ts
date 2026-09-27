import { renderTo } from "./renderer.ts";
import { formatMotion } from "./app-state.ts";
import type { AppState } from "./app-state.ts";
import type { RenderMode } from "./algorithms.ts";

const THUMB_WIDTH = 96;
const THUMB_HEIGHT = 64;

function required<T extends HTMLElement = HTMLElement>(document: Document, id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element #${id}`);
  return element as T;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas 2D is unavailable");
  return context;
}

export function createUi(
  document: Document,
  {
    modes,
    palettes,
    prefersReducedMotion,
    compactControls,
  }: {
    modes: RenderMode[];
    palettes: { name: string; map: (h: number) => number }[];
    prefersReducedMotion: MediaQueryList;
    compactControls: MediaQueryList;
  },
) {
  const elements = {
    main: required<HTMLCanvasElement>(document, "main"),
    transition: required<HTMLCanvasElement>(document, "transition"),
    modeName: required(document, "mode-name"),
    modeNote: required(document, "mode-note"),
    seedReadout: required(document, "seed-readout"),
    modeCount: required(document, "mode-count"),
    playbackState: required(document, "playback-state"),
    gallery: required<HTMLElement>(document, "gallery"),
    cycleProgress: required<HTMLElement>(document, "cycle-progress"),
    toast: required(document, "toast"),
    randomButton: required<HTMLButtonElement>(document, "btn-random"),
    saveButton: required<HTMLButtonElement>(document, "btn-save"),
    shareButton: required<HTMLButtonElement>(document, "btn-share"),
    fullscreenButton: required<HTMLButtonElement>(document, "btn-fullscreen"),
    settingsButton: required<HTMLButtonElement>(document, "btn-settings"),
    closeSettingsButton: required<HTMLButtonElement>(document, "btn-close-settings"),
    panelScrim: required(document, "panel-scrim"),
    panel: required(document, "panel-right"),
    previousButton: required<HTMLButtonElement>(document, "btn-prev"),
    pauseButton: required<HTMLButtonElement>(document, "btn-pause"),
    nextButton: required<HTMLButtonElement>(document, "btn-next"),
    cycleButton: required<HTMLButtonElement>(document, "btn-cycle"),
    showcaseButton: required<HTMLButtonElement>(document, "btn-showcase"),
    hideUiInput: required<HTMLInputElement>(document, "hide-ui"),
    sizeSlider: required<HTMLInputElement>(document, "pixel-size"),
    sizeOutput: required(document, "pixel-size-out"),
    motionSlider: required<HTMLInputElement>(document, "drift"),
    motionOutput: required(document, "drift-out"),
    cycleRateSlider: required<HTMLInputElement>(document, "cycle-rate"),
    cycleRateOutput: required(document, "cycle-rate-out"),
    paletteSelect: required<HTMLSelectElement>(document, "palette"),
    seedInput: required<HTMLInputElement>(document, "seed-input"),
  };
  const mainContext = context2d(elements.main);
  const galleryContexts: CanvasRenderingContext2D[] = [];
  let toastTimer = 0;

  for (const [index, palette] of palettes.entries()) {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = palette.name;
    elements.paletteSelect.appendChild(option);
  }

  function setCycleProgress(progress: number) {
    elements.cycleProgress.style.transform = `scaleX(${Math.max(0, Math.min(1, progress))})`;
  }

  function syncHud(state: AppState) {
    const mode = modes[state.mode];
    const artworkLabel = `${mode.name}: ${mode.note}`;
    if (elements.main.getAttribute("aria-label") !== artworkLabel) {
      elements.main.setAttribute("aria-label", artworkLabel);
    }
    elements.modeName.textContent = mode.name;
    elements.modeNote.textContent = mode.note;
    elements.seedReadout.textContent = state.seed.toFixed(6);
    elements.modeCount.textContent = `${String(state.mode + 1).padStart(2, "0")} / ${String(modes.length).padStart(2, "0")}`;
    setMotionValue(state.motion, mode.motionScale);
  }

  function setPaletteValue(value: number) {
    elements.paletteSelect.value = String(value);
  }

  function setPixelSizeValue(value: number) {
    elements.sizeSlider.value = String(value);
    elements.sizeOutput.textContent = String(value);
  }

  function setMotionValue(value: number, scale = 1) {
    elements.motionSlider.value = String(value);
    elements.motionOutput.textContent = formatMotion(value, scale);
  }

  function setCycleRateValue(cyclePreferenceMs: number) {
    elements.cycleRateSlider.value = String(cyclePreferenceMs / 1000);
    elements.cycleRateOutput.textContent = `${cyclePreferenceMs / 1000} sec`;
  }

  function syncPlaybackControls(state: AppState, showcase = false) {
    const paused = !state.running;
    const cycling = state.cycleMs > 0;
    const autoPlaying = cycling && !showcase;
    const pauseLabel = elements.pauseButton.querySelector(".button-label");
    const pauseIcon = elements.pauseButton.querySelector(".button-icon");
    if (pauseLabel) pauseLabel.textContent = paused ? "Play" : "Pause";
    if (pauseIcon) pauseIcon.textContent = paused ? "▶" : "Ⅱ";
    elements.pauseButton.setAttribute("aria-label", paused ? "Play animation" : "Pause animation");
    elements.pauseButton.removeAttribute("aria-pressed");
    elements.pauseButton.title = paused ? "Play animation (Space)" : "Pause animation (Space)";
    elements.cycleButton.classList.toggle("on", autoPlaying);
    elements.cycleButton.setAttribute("aria-pressed", String(autoPlaying));
    elements.cycleButton.setAttribute("aria-label", "Auto-play scenes");
    elements.cycleButton.title = autoPlaying ? "Stop auto-play (C)" : "Auto-play scenes (C)";
    elements.showcaseButton.classList.toggle("on", showcase);
    elements.showcaseButton.setAttribute("aria-pressed", String(showcase));
    elements.showcaseButton.setAttribute("aria-label", "Showcase mode");
    elements.showcaseButton.title = showcase ? "Stop showcase mode" : "Procedural showcase";
    elements.playbackState.classList.toggle("paused", paused);
    elements.playbackState.lastChild!.textContent = paused
      ? " paused"
      : showcase
        ? " showcasing"
        : cycling
          ? " auto-playing"
          : state.motion === 0
            ? " still"
            : " playing";
    if (!cycling) setCycleProgress(0);
  }

  function applyStateToControls(state: AppState, cyclePreferenceMs: number, showcase = false) {
    setPaletteValue(state.palette);
    setPixelSizeValue(state.pixelSize);
    setMotionValue(state.motion);
    setCycleRateValue(cyclePreferenceMs);
    syncPlaybackControls(state, showcase);
  }

  function syncFullscreen() {
    const active = Boolean(document.fullscreenElement);
    elements.fullscreenButton.setAttribute(
      "aria-label",
      active ? "Exit fullscreen" : "Enter fullscreen",
    );
    elements.fullscreenButton.title = active ? "Exit fullscreen (G)" : "Fullscreen (G)";
    const label = elements.fullscreenButton.querySelector(".button-label");
    if (label) label.textContent = active ? "Exit fullscreen" : "Fullscreen";
    const icon = elements.fullscreenButton.querySelector(".button-icon");
    if (icon) icon.textContent = active ? "⤢" : "⛶";
    elements.fullscreenButton.classList.toggle("on", active);
  }

  function showToast(message: string) {
    const view = document.defaultView;
    view?.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    toastTimer = view?.setTimeout(() => elements.toast.classList.remove("show"), 1200) ?? 0;
  }

  function renderGallery(palette: number) {
    galleryContexts.forEach((context, index) => {
      renderTo(context, THUMB_WIDTH, THUMB_HEIGHT, modes[index], 0.37 + index * 0.041, 1, palette);
    });
  }

  function buildGallery(onModeSelect: (index: number) => void) {
    modes.forEach((mode, index) => {
      const button = document.createElement("button");
      button.className = "thumb";
      button.type = "button";
      button.dataset.idx = String(index);
      button.tabIndex = index === 0 ? 0 : -1;
      button.setAttribute("aria-label", `Select ${mode.name}`);
      button.setAttribute("aria-pressed", "false");
      button.title = `${mode.name} — ${mode.note}`;

      const canvas = document.createElement("canvas");
      canvas.width = THUMB_WIDTH;
      canvas.height = THUMB_HEIGHT;
      galleryContexts.push(context2d(canvas));

      const label = document.createElement("span");
      label.textContent = mode.name;
      button.append(canvas, label);
      button.addEventListener("click", () => onModeSelect(index));
      elements.gallery.appendChild(button);
    });
  }

  function updateGallerySelection(mode: number, scroll = false) {
    let active: HTMLElement | undefined;
    for (const element of elements.gallery.children) {
      const selected = Number((element as HTMLElement).dataset.idx) === mode;
      element.classList.toggle("active", selected);
      element.setAttribute("aria-pressed", String(selected));
      (element as HTMLButtonElement).tabIndex = selected ? 0 : -1;
      if (selected) active = element as HTMLElement;
    }
    if (scroll && active) {
      active.scrollIntoView({
        behavior: prefersReducedMotion.matches ? "auto" : "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }

  function focusGalleryMode(mode: number) {
    const button = elements.gallery.querySelector<HTMLButtonElement>(`[data-idx="${mode}"]`);
    button?.focus({ preventScroll: true });
  }

  function setPanelOpen(open: boolean) {
    const modal = compactControls.matches;
    const wasOpen = elements.panel.classList.contains("open");
    const background = document.querySelectorAll<HTMLElement>("#main, .top-bar, .bottom-deck");

    if (!open) {
      for (const element of background) element.inert = false;
      if (wasOpen && (modal || elements.panel.contains(document.activeElement))) {
        elements.settingsButton.focus({ preventScroll: true });
      }
    }

    elements.panel.classList.toggle("open", open);
    elements.panel.setAttribute("aria-hidden", String(!open));
    if (modal) {
      elements.panel.setAttribute("role", "dialog");
      elements.panel.setAttribute("aria-modal", String(open));
      elements.panel.setAttribute("aria-labelledby", "panel-title");
    } else {
      elements.panel.removeAttribute("role");
      elements.panel.removeAttribute("aria-modal");
      elements.panel.removeAttribute("aria-labelledby");
    }
    elements.panelScrim.classList.toggle("open", open);
    elements.panelScrim.setAttribute("aria-hidden", String(!open));
    elements.settingsButton.setAttribute("aria-expanded", String(open));
    elements.settingsButton.setAttribute("aria-label", open ? "Close controls" : "Open controls");
    elements.settingsButton.title = open ? "Close controls (F)" : "Open controls (F)";

    if (open) {
      for (const element of background) element.inert = modal;
      if (modal) elements.closeSettingsButton.focus({ preventScroll: true });
    }
  }

  return {
    elements,
    mainContext,
    transitionContext: context2d(elements.transition),
    buildGallery,
    renderGallery,
    updateGallerySelection,
    focusGalleryMode,
    syncHud,
    setPaletteValue,
    setPixelSizeValue,
    setMotionValue,
    setCycleRateValue,
    syncPlaybackControls,
    applyStateToControls,
    syncFullscreen,
    setCycleProgress,
    setPanelOpen,
    showToast,
  };
}
