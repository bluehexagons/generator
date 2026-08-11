import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSeed, PIXEL_SIZE_MAX, PIXEL_SIZE_MIN, readHash, writeHash } from "../url-state.js";

test("normalizeSeed wraps values into the shareable unit interval", () => {
  assert.equal(normalizeSeed(0.25), 0.25);
  assert.equal(normalizeSeed(-0.25), 0.75);
  assert.equal(normalizeSeed(2.25), 0.25);
});

test("writeHash serializes the shareable state", () => {
  const location = { hash: "" };
  let replacement;
  const history = { replaceState: (_state, _title, hash) => { replacement = hash; } };

  writeHash({ location, history }, { mode: 4, seed: 0.123456789, pixelSize: 3, palette: 2 });

  assert.equal(replacement, "#mode=4&seed=0.123457&size=3&palette=2");
});

test("readHash validates and clamps values from a deep link", () => {
  const state = { mode: 0, seed: 0.5, pixelSize: 1, palette: 0 };
  readHash({ hash: "#mode=999&seed=-0.25&size=999&palette=-2" }, state, 20, 5);

  assert.deepEqual(state, { mode: 19, seed: 0.75, pixelSize: PIXEL_SIZE_MAX, palette: 0 });
});

test("readHash keeps the documented pixel-size bounds", () => {
  const state = { mode: 0, seed: 0.5, pixelSize: 8, palette: 0 };
  readHash({ hash: "#size=" + (PIXEL_SIZE_MIN - 1) }, state, 20, 5);
  assert.equal(state.pixelSize, PIXEL_SIZE_MIN);
});

test("readHash ignores malformed values", () => {
  const state = { mode: 2, seed: 0.5, pixelSize: 4, palette: 1 };
  readHash({ hash: "#mode=nope&seed=&size=Infinity&palette=NaN" }, state, 20, 5);

  assert.deepEqual(state, { mode: 2, seed: 0.5, pixelSize: 4, palette: 1 });
});
