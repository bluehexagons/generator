// Canvas rendering is isolated from application state and DOM concerns.
export function renderTo(ctx, w, h, mode, seed, pixelSize, palette) {
  const { generatePixel } = mode;
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const size = Math.max(1, pixelSize | 0);

  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      const p = y * w + x;
      const [r, g, b] = generatePixel(x, y, w, h, seed, p, palette);
      const ymax = Math.min(h, y + size);
      const xmax = Math.min(w, x + size);
      for (let yy = y; yy < ymax; yy++) {
        let index = (yy * w + x) * 4;
        for (let xx = x; xx < xmax; xx++) {
          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
          data[index + 3] = 255;
          index += 4;
        }
      }
    }
  }

  ctx.putImageData(img, 0, 0);
}
