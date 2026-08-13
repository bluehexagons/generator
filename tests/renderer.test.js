import assert from "node:assert/strict";
import test from "node:test";

import { MODES, PALETTES } from "../algorithms.js";
import { renderTo } from "../renderer.js";

test("renderTo fills every pixel, including partial pixel blocks", () => {
  let rendered;
  let imageAllocations = 0;
  const ctx = {
    createImageData(width, height) {
      imageAllocations++;
      return { data: new Uint8ClampedArray(width * height * 4) };
    },
    putImageData(image) {
      rendered = image.data;
    },
  };

  renderTo(ctx, 3, 3, {
    generatePixel(x, y) {
      return x | (y << 8) | ((x + y) << 16);
    },
  }, 0, 2, 0);

  const pixel = (x, y) => Array.from(rendered.slice((y * 3 + x) * 4, (y * 3 + x + 1) * 4));
  assert.deepEqual(pixel(0, 0), [0, 0, 0, 255]);
  assert.deepEqual(pixel(1, 0), [0, 0, 0, 255]);
  assert.deepEqual(pixel(2, 0), [2, 0, 2, 255]);
  assert.deepEqual(pixel(0, 1), [0, 0, 0, 255]);
  assert.deepEqual(pixel(1, 1), [0, 0, 0, 255]);
  assert.deepEqual(pixel(2, 1), [2, 0, 2, 255]);
  assert.deepEqual(pixel(0, 2), [0, 2, 2, 255]);
  assert.deepEqual(pixel(1, 2), [0, 2, 2, 255]);
  assert.deepEqual(pixel(2, 2), [2, 2, 4, 255]);

  renderTo(ctx, 3, 3, {
    generatePixel: () => 0x010203,
  }, 0, 1, 0);
  assert.equal(imageAllocations, 1, "same-sized renders should reuse ImageData");

  renderTo(ctx, 2, 2, {
    generatePixel: () => 0x010203,
  }, 0, 1, 0);
  assert.equal(imageAllocations, 2, "resizing should allocate a new ImageData buffer");
});

test("renderTo prepares a generator once per frame", () => {
  let prepareCalls = 0;
  let pixelCalls = 0;
  const ctx = {
    createImageData(width, height) {
      return { data: new Uint8ClampedArray(width * height * 4) };
    },
    putImageData() {},
  };

  renderTo(ctx, 4, 3, {
    generatePixel: () => { throw new Error("unprepared generator should not run"); },
    preparePixel(width, height, seed, palette) {
      prepareCalls++;
      assert.deepEqual([width, height, seed, palette], [4, 3, 0.25, 2]);
      return (x, y) => {
        pixelCalls++;
        return x | (y << 8);
      };
    },
  }, 0.25, 1, 2);

  assert.equal(prepareCalls, 1);
  assert.equal(pixelCalls, 12);
});

test("renderTo accepts the standardized scene preparation contract", () => {
  let preparedWith;
  let pixelCalls = 0;
  const ctx = {
    createImageData(width, height) {
      return { data: new Uint8ClampedArray(width * height * 4) };
    },
    putImageData() {},
  };

  renderTo(ctx, 2, 2, {
    prepare(options) {
      preparedWith = options;
      return (x, y) => {
        pixelCalls++;
        return x | (y << 8);
      };
    },
  }, 0.75, 1, 3);

  assert.deepEqual(preparedWith, { width: 2, height: 2, seed: 0.75, palette: 3 });
  assert.equal(pixelCalls, 4);
});

test("renderTo can render every mode and palette", () => {
  let renderedFrames = 0;
  const ctx = {
    createImageData(width, height) {
      return { data: new Uint8ClampedArray(width * height * 4) };
    },
    putImageData(image) {
      assert.equal(image.data.length, 17 * 11 * 4);
      renderedFrames++;
    },
  };

  for (let palette = 0; palette < PALETTES.length; palette++) {
    for (const mode of MODES) {
      renderTo(ctx, 17, 11, mode, 0.42, 3, palette);
    }
  }

  assert.equal(renderedFrames, MODES.length * PALETTES.length);
});
