import assert from "node:assert/strict";
import test from "node:test";

import { MODES, PALETTES } from "../algorithms.js";

const samples = [
  [0, 0, 96, 64, 0.1, 0],
  [47, 31, 96, 64, 0.42, 1487],
  [95, 63, 96, 64, 0.99, 6047],
];

test("all render modes return deterministic RGB bytes", () => {
  assert.equal(MODES.length, 20);

  for (const mode of MODES) {
    for (const [x, y, width, height, seed, pixelIndex] of samples) {
      const first = mode.generatePixel(x, y, width, height, seed, pixelIndex, 0);
      const second = mode.generatePixel(x, y, width, height, seed, pixelIndex, 0);

      assert.deepEqual(first, second, `${mode.name} should be deterministic`);
      assert.equal(first.length, 3, `${mode.name} should return RGB`);
      for (const channel of first) {
        assert.equal(Number.isInteger(channel), true, `${mode.name} should return integer channels`);
        assert.ok(channel >= 0 && channel <= 255, `${mode.name} returned an invalid channel`);
      }
    }
  }
});

test("palette definitions have stable, unique names", () => {
  const names = PALETTES.map(palette => palette.name);
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.length > 0);
});
