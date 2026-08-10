import assert from "node:assert/strict";
import test from "node:test";

import { renderTo } from "../renderer.js";

test("renderTo fills every pixel, including partial pixel blocks", () => {
  let rendered;
  const ctx = {
    createImageData(width, height) {
      return { data: new Uint8ClampedArray(width * height * 4) };
    },
    putImageData(image) {
      rendered = image.data;
    },
  };

  renderTo(ctx, 3, 3, {
    generatePixel(x, y) {
      return [x, y, x + y];
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
});
