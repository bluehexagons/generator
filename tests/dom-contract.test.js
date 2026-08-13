import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const requiredIds = [
  "main", "mode-name", "mode-note", "seed-readout", "mode-count", "playback-state",
  "gallery", "cycle-progress", "toast", "btn-random", "btn-save", "btn-share",
  "btn-settings", "btn-close-settings", "panel-scrim", "panel-right", "btn-prev",
  "btn-pause", "btn-next", "btn-cycle", "pixel-size", "pixel-size-out", "drift",
  "drift-out", "cycle-rate", "cycle-rate-out", "palette", "seed-input",
];

test("index markup contains every UI element required by the controller", () => {
  for (const id of requiredIds) {
    assert.match(html, new RegExp(`\\bid=["']${id}["']`), `index.html should contain #${id}`);
  }
});
