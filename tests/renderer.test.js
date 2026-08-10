import assert from "node:assert/strict";
import test from "node:test";

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
