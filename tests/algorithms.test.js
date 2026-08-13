import assert from "node:assert/strict";
import test from "node:test";

import { MODES, PALETTES } from "../algorithms.js";

const samples = [
  [0, 0, 96, 64, 0.1, 0],
  [47, 31, 96, 64, 0.42, 1487],
  [95, 63, 96, 64, 0.99, 6047],
];

test("all render modes return deterministic packed RGB colors", () => {
  assert.equal(MODES.length, 20);

  for (const mode of MODES) {
    for (const [x, y, width, height, seed, pixelIndex] of samples) {
      const first = mode.generatePixel(x, y, width, height, seed, pixelIndex, 0);
      const second = mode.generatePixel(x, y, width, height, seed, pixelIndex, 0);

      assert.deepEqual(first, second, `${mode.name} should be deterministic`);
      assert.equal(Number.isInteger(first), true, `${mode.name} should return an integer color`);
      assert.ok(first >= 0 && first <= 0xffffff, `${mode.name} returned an invalid color`);
    }
  }
});

test("palette definitions have stable, unique names", () => {
  const names = PALETTES.map(palette => palette.name);
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.length > 0);
});

test("render modes expose stable identities and animation budgets", () => {
  const ids = MODES.map(mode => mode.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(id => /^[a-z0-9-]+$/.test(id)));
  assert.ok(MODES.every(mode => Number.isFinite(mode.animationSampleBudget) && mode.animationSampleBudget > 0));
  assert.ok(MODES.every(mode => typeof mode.prepare === "function"));
});

test("the original scenes vary across both the frame and the seed", () => {
  for (const mode of MODES.slice(0, 10)) {
    const firstFrame = [
      mode.generatePixel(8, 8, 96, 64, 0.21, 776, 0),
      mode.generatePixel(48, 30, 96, 64, 0.21, 2928, 0),
      mode.generatePixel(87, 55, 96, 64, 0.21, 5367, 0),
    ];
    const laterFrame = [
      mode.generatePixel(8, 8, 96, 64, 0.61, 776, 0),
      mode.generatePixel(48, 30, 96, 64, 0.61, 2928, 0),
      mode.generatePixel(87, 55, 96, 64, 0.61, 5367, 0),
    ];

    assert.ok(new Set(firstFrame).size > 1, `${mode.name} should vary across the canvas`);
    assert.notDeepEqual(laterFrame, firstFrame, `${mode.name} should change as the seed moves`);
  }
});

test("prepared generators preserve their unprepared output", () => {
  const width = 137;
  const height = 83;
  const seed = 0.42;
  const samplesToCheck = [
    [0, 0], [1, 1], [17, 9], [68, 41], [136, 82],
  ];

  for (const mode of MODES) {
    if (!mode.preparePixel) continue;
    const prepared = mode.preparePixel(width, height, seed, 2);
    for (const [x, y] of samplesToCheck) {
      assert.equal(
        prepared(x, y, width, height, seed, y * width + x, 2),
        mode.generatePixel(x, y, width, height, seed, y * width + x, 2),
        `${mode.name} prepared output should match its generator`,
      );
    }
  }
});

test("standardized scene preparation preserves generator output", () => {
  const width = 137;
  const height = 83;
  const seed = 0.42;
  const palette = 2;
  const samplesToCheck = [[0, 0], [17, 9], [68, 41], [136, 82]];

  for (const mode of MODES) {
    const prepared = mode.prepare({ width, height, seed, palette });
    for (const [x, y] of samplesToCheck) {
      const pixelIndex = y * width + x;
      assert.equal(
        prepared(x, y, pixelIndex),
        mode.generatePixel(x, y, width, height, seed, pixelIndex, palette),
        `${mode.name} standardized preparation should match its generator`,
      );
    }
  }
});
