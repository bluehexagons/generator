// Canvas rendering is isolated from application state and DOM concerns.
const imageBuffers = new WeakMap();
// Browser targets are normally little-endian; retain a portable fallback for other runtimes.
const littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

function getImageBuffer(ctx, w, h) {
  const cached = imageBuffers.get(ctx);
  if (cached?.width === w && cached.height === h) return cached;

  const image = ctx.createImageData(w, h);
  const pixels = new Uint32Array(image.data.buffer, image.data.byteOffset, image.data.byteLength / 4);
  const buffer = { width: w, height: h, image, pixels };
  imageBuffers.set(ctx, buffer);
  return buffer;
}

export function renderTo(ctx, w, h, mode, seed, pixelSize, palette) {
  const generatePixel = mode.preparePixel?.(w, h, seed, palette) ?? mode.generatePixel;
  const { image: img, pixels } = getImageBuffer(ctx, w, h);
  const size = Math.max(1, pixelSize | 0);

  if (size === 1) {
    let pixelIndex = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const color = generatePixel(x, y, w, h, seed, pixelIndex, palette);
        pixels[pixelIndex++] = littleEndian
          ? color | 0xff000000
          : ((color & 255) << 24) | (color & 0xff00) << 8 | (color >>> 16) << 8 | 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return;
  }

  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      const p = y * w + x;
      const color = generatePixel(x, y, w, h, seed, p, palette);
      const packedColor = littleEndian
        ? color | 0xff000000
        : ((color & 255) << 24) | (color & 0xff00) << 8 | (color >>> 16) << 8 | 255;
      const ymax = Math.min(h, y + size);
      const xmax = Math.min(w, x + size);
      for (let yy = y; yy < ymax; yy++) {
        let index = yy * w + x;
        const rowEnd = index + xmax - x;
        for (; index < rowEnd; index++) {
          pixels[index] = packedColor;
        }
      }
    }
  }

  ctx.putImageData(img, 0, 0);
}
