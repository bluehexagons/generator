import { renderTo } from "./renderer.js";
import { formatMotion } from "./app-state.js";

const THUMB_WIDTH = 96;
const THUMB_HEIGHT = 64;

function required(document, id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element #${id}`);
  return element;
}

export function createUi(document, { modes, palettes, prefersReducedMotion, compactControls }) {
  const elements = {
    main: required(document, "main"),
    modeName: required(document, "mode-name"),
    modeNote: required(document, "mode-note"),
    seedReadout: required(document, "seed-readout"),
    modeCount: required(document, "mode-count"),
    playbackState: required(document, "playback-state"),
    gallery: required(document, "gallery"),
    cycleProgress: required(document, "cycle-progress"),
    toast: required(document, "toast"),
    randomButton: required(document, "btn-random"),
    saveButton: required(document, "btn-save"),
    shareButton: required(document, "btn-share"),
    settingsButton: required(document, "btn-settings"),
    closeSettingsButton: required(document, "btn-close-settings"),
    panelScrim: required(document, "panel-scrim"),
    panel: required(document, "panel-right"),
    previousButton: required(document, "btn-prev"),
    pauseButton: required(document, "btn-pause"),
    nextButton: required(document, "btn-next"),
    cycleButton: required(document, "btn-cycle"),
    sizeSlider: required(document, "pixel-size"),
    sizeOutput: required(document, "pixel-size-out"),
    motionSlider: required(document, "drift"),
    motionOutput: required(document, "drift-out"),
    cycleRateSlider: required(document, "cycle-rate"),
    cycleRateOutput: required(document, "cycle-rate-out"),
    paletteSelect: required(document, "palette"),
    seedInput: required(document, "seed-input"),
  };
  const mainContext = elements.main.getContext("2d", { alpha: false });
  const galleryContexts = [];
  let toastTimer = 0;

  for (const [index, palette] of palettes.entries()) {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = palette.name;
    elements.paletteSelect.appendChild(option);
  }

  function setCycleProgress(progress) {
    elements.cycleProgress.style.transform = `scaleX(${Math.max(0, Math.min(1, progress))})`;
  }

  function syncHud(state) {
    const mode = modes[state.mode];
    elements.modeName.textContent = mode.name;
    elements.modeNote.textContent = mode.note;
    elements.seedReadout.textContent = state.seed.toFixed(6);
    elements.modeCount.textContent = `${String(state.mode + 1).padStart(2, "0")} / ${String(modes.length).padStart(2, "0")}`;
  }

  function syncPlaybackControls(state) {
    const paused = !state.running;
    const cycling = state.cycleMs > 0;
    const pauseLabel = elements.pauseButton.querySelector(".button-label");
    const pauseIcon = elements.pauseButton.querySelector(".button-icon");
    pauseLabel.textContent = paused ? "Play" : "Pause";
    pauseIcon.textContent = paused ? "▶" : "Ⅱ";
    elements.pauseButton.setAttribute("aria-label", paused ? "Play animation" : "Pause animation");
    elements.pauseButton.setAttribute("aria-pressed", String(paused));
    elements.pauseButton.title = paused ? "Play animation (Space)" : "Pause animation (Space)";
    elements.cycleButton.classList.toggle("on", cycling);
    elements.cycleButton.setAttribute("aria-pressed", String(cycling));
    elements.cycleButton.setAttribute("aria-label", cycling ? "Stop auto-play" : "Auto-play scenes");
    elements.cycleButton.title = cycling ? "Stop auto-play (C)" : "Auto-play scenes (C)";
    elements.playbackState.classList.toggle("paused", paused);
    elements.playbackState.lastChild.textContent = paused
      ? " paused"
      : cycling
        ? " auto-playing"
        : state.motion === 0
          ? " still"
          : " playing";
    if (!cycling) setCycleProgress(0);
  }

  function applyStateToControls(state, cyclePreferenceMs) {
    elements.paletteSelect.value = state.palette;
    elements.sizeSlider.value = state.pixelSize;
    elements.sizeOutput.textContent = state.pixelSize;
    elements.motionSlider.value = state.motion;
    elements.motionOutput.textContent = formatMotion(state.motion);
    elements.cycleRateSlider.value = cyclePreferenceMs / 1000;
    elements.cycleRateOutput.textContent = `${cyclePreferenceMs / 1000} sec`;
    syncPlaybackControls(state);
  }

  function showToast(message) {
    const view = document.defaultView;
    view?.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    toastTimer = view?.setTimeout(() => elements.toast.classList.remove("show"), 1200) ?? 0;
  }

  function renderGallery(palette) {
    galleryContexts.forEach((context, index) => {
      renderTo(context, THUMB_WIDTH, THUMB_HEIGHT, modes[index], 0.37 + index * 0.041, 1, palette);
    });
  }

  function buildGallery(onModeSelect) {
    modes.forEach((mode, index) => {
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
      button.addEventListener("click", () => onModeSelect(index));
      elements.gallery.appendChild(button);
    });
  }

  function updateGallerySelection(mode, scroll = false) {
    let active;
    for (const element of elements.gallery.children) {
      const selected = Number(element.dataset.idx) === mode;
      element.classList.toggle("active", selected);
      element.setAttribute("aria-pressed", String(selected));
      if (selected) active = element;
    }
    if (scroll && active) {
      active.scrollIntoView({
        behavior: prefersReducedMotion.matches ? "auto" : "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }

  function setPanelOpen(open) {
    const modal = compactControls.matches;
    const background = document.querySelectorAll("#main, .top-bar, .bottom-deck");

    if (!open) {
      for (const element of background) element.inert = false;
      if (elements.panel.contains(document.activeElement)) {
        elements.settingsButton.focus({ preventScroll: true });
      }
    }

    elements.panel.classList.toggle("open", open);
    elements.panel.setAttribute("aria-hidden", String(!open));
    if (modal) {
      elements.panel.setAttribute("role", "dialog");
      elements.panel.setAttribute("aria-modal", String(open));
    } else {
      elements.panel.removeAttribute("role");
      elements.panel.removeAttribute("aria-modal");
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
    buildGallery,
    renderGallery,
    updateGallerySelection,
    syncHud,
    syncPlaybackControls,
    applyStateToControls,
    setCycleProgress,
    setPanelOpen,
    showToast,
  };
}
