// Plasma mode metadata, palettes, and pixel generators.
// This module contains no DOM or application state, so it can be tested independently.

function defineMode(id, name, note, generatePixel, preparePixel, animationSampleBudget = 180_000) {
  const prepare = preparePixel
    ? ({ width, height, seed, palette }) => preparePixel(width, height, seed, palette)
    : ({ width, height, seed, palette }) => (x, y, pixelIndex) => generatePixel(x, y, width, height, seed, pixelIndex, palette);
  return { id, name, note, generatePixel, preparePixel, prepare, animationSampleBudget };
}

export const MODES = [
  defineMode("drift",          "Drift",          "Cloudy color pushed sideways by a slow current",      drift,          undefined,            75_000),
  defineMode("diagonal-bands", "Diagonal Bands", "Crossed waves with a bright, shifting seam",          diagonalBands),
  defineMode("scanline-sweep", "Scanline Sweep", "Bent scanlines sliding through bands of color",       scanlineSweep),
  defineMode("gradient",       "Gradient",       "A soft aurora folded into a diagonal wash",           gradient),
  defineMode("radial-fade",    "Radial Fade",    "Offset rings rolling out from a wandering center",    radialFade),
  defineMode("radial-glow",    "Radial Glow",    "Three loose lights orbiting through haze",            radialGlow),
  defineMode("rgb-quadrants",  "RGB Quadrants",  "Separate red, green, and blue waves crossing over",   rgbQuadrants),
  defineMode("lobe",           "Lobe",           "A rotating four-leaf field with rippled edges",       lobe),
  defineMode("sky-noise",      "Sky / Noise",    "Cloud bands gathering over a bright horizon",         skyNoise,       undefined,            75_000),
  defineMode("twilight",       "Twilight",       "Warm woven light after the sun drops",                twilight),
  defineMode("classic-plasma", "Classic Plasma", "The familiar stack of rolling sine waves",            classicPlasma,  prepareClassicPlasma),
  defineMode("interference",   "Interference",   "Concentric waves colliding across the frame",         interference,   prepareInterference),
  defineMode("fractal-noise",  "Fractal Noise",  "Large, slow clouds built from layered noise",         fractalClouds,  prepareFractalClouds, 75_000),
  defineMode("metaballs",      "Metaballs",      "Soft lights that pool together when they meet",       metaballs,      prepareMetaballs),
  defineMode("turbulence",     "Turbulence",     "Twisted waves with small currents inside them",       turbulence,     prepareTurbulence),
  defineMode("voronoi-glow",   "Voronoi Glow",   "A shifting cell map with lit edges",                  voronoiGlow,    prepareVoronoiGlow,    75_000),
  defineMode("julia-field",    "Julia Field",    "A Julia set passing in and out of focus",             juliaField,     prepareJuliaField),
  defineMode("polar-ribbons",  "Polar Ribbons",  "Ribbons wound around the center of the frame",        polarRibbons,   preparePolarRibbons),
  defineMode("rgb-oscillator", "RGB Oscillator", "Three color waves moving on their own clocks",        rgbOscillator,  prepareRgbOscillator),
  defineMode("marble",         "Marble",         "Long stone-like veins disturbed by noise",            marble,         prepareMarble,         75_000),
];

export const PALETTES = [
  { name: "Prism", map: h => (h + 0.56) % 1 },
  { name: "Ember", map: h => (0.015 + h * 0.20) % 1 },
  { name: "Ocean", map: h => (0.50 + h * 0.18) % 1 },
  { name: "Acid",  map: h => (0.22 + h * 0.16) % 1 },
  { name: "Sunset", map: h => (0.94 + h * 0.22) % 1 },
];

// ---------------- pixel functions ----------------
// The first ten began as small pixel experiments. They keep the same basic
// ideas, but use normalized coordinates and a little more structure now.
// Generators return packed 0xBBGGRR colors so the renderer can write one pixel
// at a time without allocating a three-element array for every sample.
const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;
const packRgb = (r, g, b) => clamp(r) | (clamp(g) << 8) | (clamp(b) << 16);
const TAU = Math.PI * 2;

// A tiny deterministic hash keeps renders, thumbnails, and shared links stable.
function hash2(x, y, seed) {
  let n = Math.sin(x * 127.1 + y * 311.7 + seed * 951.3) * 43758.5453;
  return n - Math.floor(n);
}

function hue(h, palette = 0) {
  h = ((h % 1) + 1) % 1;
  h = PALETTES[palette]?.map(h) ?? h;
  const r = Math.abs(h * 6 - 3) - 1;
  const g = 2 - Math.abs(h * 6 - 2);
  const b = 2 - Math.abs(h * 6 - 4);
  return packRgb(Math.max(0, Math.min(1, r)) * 255, Math.max(0, Math.min(1, g)) * 255, Math.max(0, Math.min(1, b)) * 255);
}

function smoothNoise(x, y, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

function fractalNoise(x, y, seed) {
  let total = smoothNoise(x, y, seed) * 0.5;
  total += smoothNoise(x * 2, y * 2, seed + 17.3) * 0.25;
  total += smoothNoise(x * 4, y * 4, seed + 34.6) * 0.125;
  total += smoothNoise(x * 8, y * 8, seed + 51.9) * 0.0625;
  return total / 0.9375;
}

function drift(x, y, w, h, seed, _p, palette) {
  const nx = x / w, ny = y / h, phase = seed * TAU;
  const current = smoothNoise(nx * 4.8 + Math.cos(phase) * 0.7, ny * 4.8 + Math.sin(phase) * 0.45, 4.7);
  const fold = Math.sin((nx * 2.2 + ny * 1.4) * TAU + phase) * 0.5;
  return hue(seed * 0.72 + current * 0.3 + fold * 0.075 + nx * 0.08, palette);
}

function diagonalBands(x, y, w, h, seed, _p, palette) {
  const nx = x / w, ny = y / h, phase = seed * TAU;
  const crossed = Math.sin((nx * 3.8 + ny * 2.7) * TAU + phase) + Math.sin((nx * 6.1 - ny * 4.3) * TAU - phase * 1.35);
  const seam = Math.cos(Math.hypot(nx - 0.5, ny - 0.5) * 22 - phase * 0.7);
  return hue(seed * 0.63 + crossed * 0.055 + seam * 0.035, palette);
}

function scanlineSweep(x, y, w, h, seed, _p, palette) {
  const nx = x / w, ny = y / h, phase = seed * TAU;
  const bend = Math.sin(nx * TAU * 2.4 + phase) * 0.055;
  const broad = Math.sin((ny + bend) * TAU * 7 - phase * 1.6);
  const fine = Math.sin((ny + bend * 0.4) * h * 0.48 + phase * 3);
  return hue(seed * 0.82 + nx * 0.12 + broad * 0.075 + fine * 0.018, palette);
}

function gradient(x, y, w, h, seed, _p, palette) {
  const nx = x / w, ny = y / h, phase = seed * TAU;
  const curtain = Math.sin(nx * 8 + Math.sin(ny * 5 - phase) * 1.6 + phase) * (1 - ny) * 0.16;
  const wash = nx * 0.16 + ny * 0.24 + Math.sin((nx + ny) * Math.PI + phase) * 0.045;
  return hue(seed * 0.58 + wash + curtain, palette);
}

function radialFade(x, y, w, h, seed, _p, palette) {
  const phase = seed * TAU;
  const cx = 0.5 + Math.cos(phase) * 0.18, cy = 0.5 + Math.sin(phase * 1.3) * 0.15;
  const dx = (x / w - cx) * (w / h), dy = y / h - cy;
  const radius = Math.hypot(dx, dy);
  const rings = Math.sin(radius * 34 - phase * 2) * Math.exp(-radius * 1.7);
  return hue(seed * 0.75 + radius * 0.2 + rings * 0.12, palette);
}

function radialGlow(x, y, w, h, seed, _p, palette) {
  const nx = x / w, ny = y / h, phase = seed * TAU;
  let field = 0;
  for (let i = 0; i < 3; i++) {
    const angle = phase * (0.45 + i * 0.22) + i * TAU / 3;
    const cx = 0.5 + Math.cos(angle) * (0.18 + i * 0.025);
    const cy = 0.5 + Math.sin(angle * 1.2) * (0.16 + i * 0.018);
    const dx = nx - cx, dy = ny - cy;
    field += 0.018 / (dx * dx + dy * dy + 0.012);
  }
  return hue(seed * 0.68 + Math.tanh(field) * 0.34, palette);
}

function rgbQuadrants(x, y, w, h, seed) {
  const nx = x / w, ny = y / h, phase = seed * TAU;
  const dx = nx - 0.5, dy = ny - 0.5;
  const pulse = Math.sin(Math.hypot(dx, dy) * 18 - phase * 1.8);
  const r = (Math.sin(nx * TAU * 2 + phase + pulse) + 1) * 127.5;
  const g = (Math.sin((nx + ny) * TAU * 1.35 - phase * 0.7) + 1) * 127.5;
  const b = (Math.sin(ny * TAU * 2.3 + phase * 1.2 - pulse) + 1) * 127.5;
  return packRgb(r, g, b);
}

function lobe(x, y, w, h, seed, _p, palette) {
  const dx = (x / w - 0.5) * (w / h), dy = y / h - 0.5;
  const angle = Math.atan2(dy, dx), radius = Math.hypot(dx, dy), phase = seed * TAU;
  const petals = Math.cos(angle * 4 + phase) * Math.exp(-radius * 2.6);
  const edge = Math.sin((radius + petals * 0.12) * 30 - phase * 1.4);
  return hue(seed * 0.7 + petals * 0.15 + edge * 0.055, palette);
}

function skyNoise(x, y, w, h, seed) {
  const nx = x / w, ny = y / h, phase = seed * TAU;
  const clouds = fractalNoise(nx * 5 + seed * 1.8, ny * 8 - seed * 0.7, 18.2);
  const horizon = Math.exp(-Math.pow((ny - 0.64) * 7, 2));
  const grain = hash2(x, y, 2.4) - 0.5;
  const r = 18 + ny * 48 + horizon * 150 + clouds * 35 + grain * 9;
  const g = 28 + ny * 34 + horizon * 72 + clouds * 48 + grain * 7;
  const b = 58 + (1 - ny) * 80 + horizon * 35 + clouds * 72 + Math.sin(nx * 5 + phase) * 8;
  return packRgb(r, g, b);
}

function twilight(x, y, w, h, seed) {
  const nx = x / w, ny = y / h, phase = seed * TAU;
  const weave = Math.sin(nx * 18 + Math.sin(ny * 7 - phase) * 2.2 + phase) * 0.5 + 0.5;
  const horizon = Math.exp(-Math.pow((ny - 0.57) * 5.5, 2));
  const r = 32 + horizon * 190 + weave * 72 + ny * 30;
  const g = 18 + horizon * 62 + weave * 32 + nx * 24;
  const b = 52 + (1 - ny) * 90 + (1 - weave) * 58 + Math.sin(phase + nx * 3) * 12;
  return packRgb(r, g, b);
}

// The classic layered sine-wave plasma.
function classicPlasma(x, y, w, h, seed, _pixelIndex, palette) {
  const phase = seed * TAU;
  const nx = x / Math.max(w, h) * 12;
  const ny = y / Math.max(w, h) * 12;
  const value = (Math.sin(nx + phase) + Math.sin(ny * 1.35 - phase) + Math.sin((nx + ny) * 0.72 + phase) + Math.sin(Math.hypot(nx - 6, ny - 6) * 1.8 - phase)) / 4;
  return hue(seed + value * 0.22, palette);
}

function prepareClassicPlasma(w, h, seed, palette) {
  const phase = seed * TAU;
  const scale = 12 / Math.max(w, h);
  return (x, y) => {
    const nx = x * scale;
    const ny = y * scale;
    const value = (Math.sin(nx + phase) + Math.sin(ny * 1.35 - phase) + Math.sin((nx + ny) * 0.72 + phase) + Math.sin(Math.hypot(nx - 6, ny - 6) * 1.8 - phase)) / 4;
    return hue(seed + value * 0.22, palette);
  };
}

// Radial wave interference, a common classic-plasma variant.
function interference(x, y, w, h, seed, _pixelIndex, palette) {
  const scale = Math.max(w, h);
  const sources = [[0.25, 0.34], [0.75, 0.66], [0.48, 0.82]];
  let value = 0;
  for (let i = 0; i < sources.length; i++) {
    const sx = (sources[i][0] + seed * (i + 1) * 0.08) % 1;
    const sy = (sources[i][1] + seed * (i + 2) * 0.05) % 1;
    value += Math.sin(Math.hypot(x / scale - sx, y / scale - sy) * 42 - seed * TAU * (i + 1));
  }
  return hue(seed * 0.7 + value / 18, palette);
}

function prepareInterference(w, h, seed, palette) {
  const scale = 1 / Math.max(w, h);
  const sources = [[0.25, 0.34], [0.75, 0.66], [0.48, 0.82]];
  const sourceX = sources.map((source, i) => (source[0] + seed * (i + 1) * 0.08) % 1);
  const sourceY = sources.map((source, i) => (source[1] + seed * (i + 2) * 0.05) % 1);
  const phase = seed * TAU;
  return (x, y) => {
    let value = 0;
    for (let i = 0; i < sources.length; i++) {
      value += Math.sin(Math.hypot(x * scale - sourceX[i], y * scale - sourceY[i]) * 42 - phase * (i + 1));
    }
    return hue(seed * 0.7 + value / 18, palette);
  };
}

// Octave noise gives the familiar cloudy, organic plasma texture.
function fractalClouds(x, y, w, h, seed, _pixelIndex, palette) {
  const scale = 7 / Math.max(w, h) * 320;
  return hue(seed * 0.8 + fractalNoise(x * scale, y * scale, seed) * 0.65, palette);
}

function prepareFractalClouds(w, h, seed, palette) {
  const scale = 7 / Math.max(w, h) * 320;
  const hueSeed = seed * 0.8;
  return (x, y) => hue(hueSeed + fractalNoise(x * scale, y * scale, seed) * 0.65, palette);
}

// A field of soft circular emitters (metaball-style plasma).
function metaballs(x, y, w, h, seed, _pixelIndex, palette) {
  let field = 0;
  for (let i = 0; i < 4; i++) {
    const angle = seed * TAU * (i + 1) + i * 1.7;
    const cx = 0.5 + Math.cos(angle) * (0.18 + i * 0.025);
    const cy = 0.5 + Math.sin(angle * 1.13) * (0.18 + i * 0.02);
    const dx = x / w - cx, dy = y / h - cy;
    field += (0.012 + i * 0.002) / (dx * dx + dy * dy + 0.006);
  }
  return hue(seed + Math.min(1, field / 3) * 0.42, palette);
}

function prepareMetaballs(w, h, seed, palette) {
  const centers = [];
  for (let i = 0; i < 4; i++) {
    const angle = seed * TAU * (i + 1) + i * 1.7;
    centers.push(
      0.5 + Math.cos(angle) * (0.18 + i * 0.025),
      0.5 + Math.sin(angle * 1.13) * (0.18 + i * 0.02),
      0.012 + i * 0.002,
    );
  }
  const invW = 1 / w;
  const invH = 1 / h;
  return (x, y) => {
    const nx = x * invW;
    const ny = y * invH;
    let field = 0;
    for (let i = 0; i < centers.length; i += 3) {
      const dx = nx - centers[i], dy = ny - centers[i + 1];
      field += centers[i + 2] / (dx * dx + dy * dy + 0.006);
    }
    return hue(seed + Math.min(1, field / 3) * 0.42, palette);
  };
}

// Domain warping adds movement and detail to otherwise simple waves.
function turbulence(x, y, w, h, seed, _pixelIndex, palette) {
  const scale = Math.max(w, h);
  const nx = x / scale * 10, ny = y / scale * 10;
  const warpX = Math.sin(ny * 1.7 + seed * TAU) * 0.9 + Math.sin(nx * 0.7 - ny) * 0.35;
  const warpY = Math.cos(nx * 1.35 - seed * TAU) * 0.8 + Math.sin(ny * 0.8 + nx) * 0.35;
  const value = Math.sin(nx + warpX + seed * TAU) + Math.sin(ny + warpY) + Math.sin((nx + ny + warpX - warpY) * 0.7);
  return hue(seed + value / 18, palette);
}

function prepareTurbulence(w, h, seed, palette) {
  const scale = 10 / Math.max(w, h);
  const phase = seed * TAU;
  return (x, y) => {
    const nx = x * scale;
    const ny = y * scale;
    const warpX = Math.sin(ny * 1.7 + phase) * 0.9 + Math.sin(nx * 0.7 - ny) * 0.35;
    const warpY = Math.cos(nx * 1.35 - phase) * 0.8 + Math.sin(ny * 0.8 + nx) * 0.35;
    const value = Math.sin(nx + warpX + phase) + Math.sin(ny + warpY) + Math.sin((nx + ny + warpX - warpY) * 0.7);
    return hue(seed + value / 18, palette);
  };
}

// Nearest-cell distance and edge distance from a small Voronoi lattice.
function voronoiGlow(x, y, w, h, seed, _pixelIndex, palette) {
  const scale = Math.max(w, h) / 90;
  const px = x / scale, py = y / scale;
  const ix = Math.floor(px), iy = Math.floor(py);
  let nearest = 10, second = 10;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const cx = ix + ox + hash2(ix + ox, iy + oy, seed);
    const cy = iy + oy + hash2(ix + ox, iy + oy, seed + 31.7);
    const d = Math.hypot(px - cx, py - cy);
    if (d < nearest) { second = nearest; nearest = d; } else if (d < second) second = d;
  }
  return hue(seed * 0.8 + nearest * 0.16 + (second - nearest) * 0.55, palette);
}

function prepareVoronoiGlow(w, h, seed, palette) {
  const scale = Math.max(w, h) / 90;
  const minX = -1;
  const minY = -1;
  const maxX = Math.floor((w - 1) / scale) + 1;
  const maxY = Math.floor((h - 1) / scale) + 1;
  const width = maxX - minX + 1;
  const pointsX = new Float64Array(width * (maxY - minY + 1));
  const pointsY = new Float64Array(pointsX.length);

  for (let iy = minY; iy <= maxY; iy++) {
    for (let ix = minX; ix <= maxX; ix++) {
      const index = (iy - minY) * width + ix - minX;
      pointsX[index] = ix + hash2(ix, iy, seed);
      pointsY[index] = iy + hash2(ix, iy, seed + 31.7);
    }
  }

  return (x, y) => {
    const px = x / scale;
    const py = y / scale;
    const ix = Math.floor(px);
    const iy = Math.floor(py);
    let nearest = 10, second = 10;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const point = (iy + oy - minY) * width + ix + ox - minX;
        const d = Math.hypot(px - pointsX[point], py - pointsY[point]);
        if (d < nearest) { second = nearest; nearest = d; } else if (d < second) second = d;
      }
    }
    return hue(seed * 0.8 + nearest * 0.16 + (second - nearest) * 0.55, palette);
  };
}

// Bounded Julia iterations produce a fractal field without a texture map.
function juliaField(x, y, w, h, seed, _pixelIndex, palette) {
  let zx = (x / w - 0.5) * 3.1, zy = (y / h - 0.5) * 3.1;
  const cx = -0.72 + Math.cos(seed * TAU) * 0.08;
  const cy = 0.16 + Math.sin(seed * TAU * 1.7) * 0.08;
  let i = 0, radius = 0;
  for (; i < 24; i++) {
    const nextX = zx * zx - zy * zy + cx;
    zy = 2 * zx * zy + cy;
    zx = nextX;
    radius = zx * zx + zy * zy;
    if (radius > 16) break;
  }
  const smooth = i === 24 ? 0 : i + 1 - Math.log2(Math.log2(Math.max(radius, 1.001)));
  return hue(seed + smooth / 14, palette);
}

function prepareJuliaField(w, h, seed, palette) {
  const scaleX = 3.1 / w;
  const scaleY = 3.1 / h;
  const cx = -0.72 + Math.cos(seed * TAU) * 0.08;
  const cy = 0.16 + Math.sin(seed * TAU * 1.7) * 0.08;
  return (x, y) => {
    let zx = (x * scaleX - 0.5 * 3.1), zy = (y * scaleY - 0.5 * 3.1);
    let i = 0, radius = 0;
    for (; i < 24; i++) {
      const nextX = zx * zx - zy * zy + cx;
      zy = 2 * zx * zy + cy;
      zx = nextX;
      radius = zx * zx + zy * zy;
      if (radius > 16) break;
    }
    const smooth = i === 24 ? 0 : i + 1 - Math.log2(Math.log2(Math.max(radius, 1.001)));
    return hue(seed + smooth / 14, palette);
  };
}

// Angle/radius coordinates make a set of rotating concentric ribbons.
function polarRibbons(x, y, w, h, seed, _pixelIndex, palette) {
  const dx = x / w - 0.5, dy = y / h - 0.5;
  const angle = Math.atan2(dy, dx), radius = Math.hypot(dx, dy);
  const value = Math.sin(angle * 9 + radius * 38 - seed * TAU) + Math.sin(radius * 24 + angle * 3);
  return hue(seed * 0.7 + value / 18, palette);
}

function preparePolarRibbons(w, h, seed, palette) {
  const scaleX = 1 / w;
  const scaleY = 1 / h;
  const phase = seed * TAU;
  return (x, y) => {
    const dx = x * scaleX - 0.5, dy = y * scaleY - 0.5;
    const angle = Math.atan2(dy, dx), radius = Math.hypot(dx, dy);
    const value = Math.sin(angle * 9 + radius * 38 - phase) + Math.sin(radius * 24 + angle * 3);
    return hue(seed * 0.7 + value / 18, palette);
  };
}

// Independent RGB oscillators make a deliberately direct RGB plasma.
function rgbOscillator(x, y, w, h, seed) {
  const nx = x / w * TAU * 3, ny = y / h * TAU * 3, phase = seed * TAU;
  const r = (Math.sin(nx + Math.sin(ny + phase) * 2) + 1) * 127.5;
  const g = (Math.sin(ny * 1.2 + Math.cos(nx - phase) * 2) + 1) * 127.5;
  const b = (Math.sin((nx + ny) * 0.7 + phase * 2) + 1) * 127.5;
  return packRgb(r, g, b);
}

function prepareRgbOscillator(w, h, seed) {
  const xScale = TAU * 3 / w;
  const yScale = TAU * 3 / h;
  const phase = seed * TAU;
  return (x, y) => {
    const nx = x * xScale, ny = y * yScale;
    const r = (Math.sin(nx + Math.sin(ny + phase) * 2) + 1) * 127.5;
    const g = (Math.sin(ny * 1.2 + Math.cos(nx - phase) * 2) + 1) * 127.5;
    const b = (Math.sin((nx + ny) * 0.7 + phase * 2) + 1) * 127.5;
    return packRgb(r, g, b);
  };
}

// Classic marble: a long sine vein disturbed by layered noise.
function marble(x, y, w, h, seed, _pixelIndex, palette) {
  const nx = x / Math.max(w, h) * 8, ny = y / Math.max(w, h) * 8;
  const vein = Math.sin((nx + fractalNoise(nx * 0.7, ny * 0.7, seed) * 4 + ny * 0.35) * 2.4);
  return hue(seed * 0.55 + vein * 0.18, palette);
}

function prepareMarble(w, h, seed, palette) {
  const scale = 8 / Math.max(w, h);
  const hueSeed = seed * 0.55;
  return (x, y) => {
    const nx = x * scale, ny = y * scale;
    const vein = Math.sin((nx + fractalNoise(nx * 0.7, ny * 0.7, seed) * 4 + ny * 0.35) * 2.4);
    return hue(hueSeed + vein * 0.18, palette);
  };
}
