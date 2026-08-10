// Plasma mode metadata, palettes, and pixel generators.
// This module contains no DOM or application state, so it can be tested independently.

export const MODES = [
  { name: "Drift",          note: "noise mixed with a seeded color, left to right",       generatePixel: drift },
  { name: "Diagonal Bands", note: "two coordinate sweeps modulated by seed",             generatePixel: diagonalBands },
  { name: "Scanline Sweep", note: "position-counter modulated, fast cycles",             generatePixel: scanlineSweep },
  { name: "Gradient",       note: "smooth diagonal gradient tinted by seed",             generatePixel: gradient },
  { name: "Radial Fade",    note: "single-channel radial falloff",                       generatePixel: radialFade },
  { name: "Radial Glow",    note: "seeded color attenuated by radius",                   generatePixel: radialGlow },
  { name: "RGB Quadrants",  note: "x→red, y→blue, midpoint→green",                       generatePixel: rgbQuadrants },
  { name: "Lobe",           note: "radial × x·y product, soft lobes",                    generatePixel: lobe },
  { name: "Sky/Noise",      note: "seeded color up top, random noise below",             generatePixel: skyNoise },
  { name: "Twilight",       note: "position + seed crossfade, warm tones",               generatePixel: twilight },
  { name: "Classic Plasma", note: "layered sine waves, the demoscene staple",            generatePixel: classicPlasma },
  { name: "Interference",   note: "concentric waves from several seeded sources",        generatePixel: interference },
  { name: "Fractal Noise",  note: "smooth multi-scale value noise, plasma-like clouds", generatePixel: fractalClouds },
  { name: "Metaballs",      note: "soft glowing fields from moving circular sources",    generatePixel: metaballs },
  { name: "Turbulence",     note: "domain-warped waves with swirling detail",            generatePixel: turbulence },
  { name: "Voronoi Glow",   note: "cellular distance fields with luminous borders",      generatePixel: voronoiGlow },
  { name: "Julia Field",    note: "escape-time fractal rendered as shifting plasma",     generatePixel: juliaField },
  { name: "Polar Ribbons",  note: "angular waves wrapped around a radial flow",          generatePixel: polarRibbons },
  { name: "RGB Oscillator", note: "three independent waves for liquid color bands",      generatePixel: rgbOscillator },
  { name: "Marble",         note: "veined stone from warped sine and noise",             generatePixel: marble },
];

export const PALETTES = [
  { name: "Prism", map: h => (h + 0.56) % 1 },
  { name: "Ember", map: h => (0.015 + h * 0.20) % 1 },
  { name: "Ocean", map: h => (0.50 + h * 0.18) % 1 },
  { name: "Acid",  map: h => (0.22 + h * 0.16) % 1 },
  { name: "Sunset", map: h => (0.94 + h * 0.22) % 1 },
];

// ---------------- pixel functions ----------------
// Faithful ports of the original pixelN() string-returning functions,
// rewritten to write three bytes directly. Their structure is preserved;
// the old random noise calls now use the shared seed for reproducibility.
const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;
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
  return [clamp(Math.max(0, Math.min(1, r)) * 255), clamp(Math.max(0, Math.min(1, g)) * 255), clamp(Math.max(0, Math.min(1, b)) * 255)];
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
  let total = 0, amplitude = 0.5, frequency = 1;
  for (let octave = 0; octave < 4; octave++) {
    total += smoothNoise(x * frequency, y * frequency, seed + octave * 17.3) * amplitude;
    frequency *= 2;
    amplitude *= 0.5;
  }
  return total / 0.9375;
}

function drift(x, y, w, h, seed) {
  const c = hash2(x, y, seed) * 16777216 * (1 - x / w) + seed * 16777216 * (x / w);
  return [clamp(c % 256), clamp((c / 256) % 256), clamp(c / 65536)];
}

function diagonalBands(x, y, w, h, seed) {
  const tx = seed * 65536 + x;
  const ty = seed * 65536 + y;
  return [clamp(tx % 256), clamp(ty % 256), clamp((tx + ty) % 256)];
}

function scanlineSweep(x, y, w, h, seed, p) {
  const tp = seed * 65536 + p;
  return [clamp(tp % 256), clamp((tp / 128) % 256), clamp((tp / 256) % 256)];
}

function gradient(x, y, w, h, seed) {
  const tp = seed * 65536;
  const pix = ((y / h) * 256 + (x / w) * 256) % 256;
  return [clamp((pix + tp / 65536) % 256), clamp((pix + tp / 256) % 256), clamp((pix + tp) % 256)];
}

function radialFade(x, y, w, h, seed) {
  const scale = Math.hypot(x - w, y - h) / Math.hypot(w, h);
  const c = seed * 16777216 * scale;
  return [clamp(c % 256), clamp((c / 256) % 256), clamp(c / 65536)];
}

function radialGlow(x, y, w, h, seed) {
  const scale = Math.hypot(x - w, y - h) / Math.hypot(w, h);
  const c = seed * 16777216;
  return [clamp((c % 256) * scale), clamp(((c / 256) % 256) * scale), clamp((c / 65536) * scale)];
}

function rgbQuadrants(x, y, w, h, seed) {
  const r = (x / w) * 256;
  const g = ((x / w + y / h) / 2) * 256;
  const b = (y / h) * 256;
  const c = (r + g * 256 + b * 65536) * seed;
  return [clamp(c % 256), clamp((c / 256) % 256), clamp(c / 65536)];
}

function lobe(x, y, w, h, seed) {
  const scale = Math.hypot(x - w, y - h) / Math.hypot(w, h);
  const c = ((seed / 2) * 16777216 * scale * 2 * ((x / w) * (y / h))) / 256;
  return [clamp(c % 256), clamp((c / 256) % 256), clamp(c / 65536)];
}

function skyNoise(x, y, w, h, seed) {
  const c = seed * 16777216;
  let r = c % 256;
  let g = (c / 256) % 256;
  let b = c / 65536;
  const t = y / h;
  const noise = hash2(x, y, seed) * 256;
  r = r * (1 - t) + noise * t;
  g = g * (1 - t) + noise * t;
  b = b * (1 - t) + noise * t;
  return [clamp(r), clamp(g), clamp(b)];
}

function twilight(x, y, w, h, seed, p) {
  const tseed = seed / 2 + 0.5;
  let r = ((p + x + y) / 3 / ((w * h + w + h) / 3)) * 256;
  const g = tseed * (x / w) * 256;
  const b = tseed * 256;
  r += (r / 2) * (tseed * 2 - 1);
  return [clamp(r), clamp(g), clamp(b)];
}

// The classic layered sine-wave plasma.
function classicPlasma(x, y, w, h, seed, _pixelIndex, palette) {
  const phase = seed * TAU;
  const nx = x / Math.max(w, h) * 12;
  const ny = y / Math.max(w, h) * 12;
  const value = (Math.sin(nx + phase) + Math.sin(ny * 1.35 - phase) + Math.sin((nx + ny) * 0.72 + phase) + Math.sin(Math.hypot(nx - 6, ny - 6) * 1.8 - phase)) / 4;
  return hue(seed + value * 0.22, palette);
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

// Octave noise gives the familiar cloudy, organic plasma texture.
function fractalClouds(x, y, w, h, seed, _pixelIndex, palette) {
  const scale = 7 / Math.max(w, h) * 320;
  return hue(seed * 0.8 + fractalNoise(x * scale, y * scale, seed) * 0.65, palette);
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

// Domain warping adds movement and detail to otherwise simple waves.
function turbulence(x, y, w, h, seed, _pixelIndex, palette) {
  const scale = Math.max(w, h);
  const nx = x / scale * 10, ny = y / scale * 10;
  const warpX = Math.sin(ny * 1.7 + seed * TAU) * 0.9 + Math.sin(nx * 0.7 - ny) * 0.35;
  const warpY = Math.cos(nx * 1.35 - seed * TAU) * 0.8 + Math.sin(ny * 0.8 + nx) * 0.35;
  const value = Math.sin(nx + warpX + seed * TAU) + Math.sin(ny + warpY) + Math.sin((nx + ny + warpX - warpY) * 0.7);
  return hue(seed + value / 18, palette);
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

// Angle/radius coordinates make a set of rotating concentric ribbons.
function polarRibbons(x, y, w, h, seed, _pixelIndex, palette) {
  const dx = x / w - 0.5, dy = y / h - 0.5;
  const angle = Math.atan2(dy, dx), radius = Math.hypot(dx, dy);
  const value = Math.sin(angle * 9 + radius * 38 - seed * TAU) + Math.sin(radius * 24 + angle * 3);
  return hue(seed * 0.7 + value / 18, palette);
}

// Independent RGB oscillators make a deliberately direct RGB plasma.
function rgbOscillator(x, y, w, h, seed) {
  const nx = x / w * TAU * 3, ny = y / h * TAU * 3, phase = seed * TAU;
  const r = (Math.sin(nx + Math.sin(ny + phase) * 2) + 1) * 127.5;
  const g = (Math.sin(ny * 1.2 + Math.cos(nx - phase) * 2) + 1) * 127.5;
  const b = (Math.sin((nx + ny) * 0.7 + phase * 2) + 1) * 127.5;
  return [clamp(r), clamp(g), clamp(b)];
}

// Classic marble: a long sine vein disturbed by layered noise.
function marble(x, y, w, h, seed, _pixelIndex, palette) {
  const nx = x / Math.max(w, h) * 8, ny = y / Math.max(w, h) * 8;
  const vein = Math.sin((nx + fractalNoise(nx * 0.7, ny * 0.7, seed) * 4 + ny * 0.35) * 2.4);
  return hue(seed * 0.55 + vein * 0.18, palette);
}
