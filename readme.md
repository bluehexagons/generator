# generator

Generates plasma-style images in a `<canvas>`. Twenty render modes, each a different bit of pixel math.

Originally written on an iPhone 3GS between classes — one of my first projects. The original ten `pixelN()` formulas are preserved; the surrounding scaffold has been rebuilt for demo use: full-viewport high-DPI canvas, deterministic seeded rendering, live thumbnail gallery, seed animation, PNG export, and a deep-linkable URL (`#mode=10&seed=0.1234&size=1`).

The expanded collection includes several familiar plasma approaches: layered sine waves (the classic demoscene formula), radial wave interference, smooth fractal/value noise, metaball-style inverse-distance fields, domain warping, Voronoi cells, Julia escape-time fields, polar ribbons, RGB oscillators, and marble-like turbulence. The palette selector adds Prism, Ember, Ocean, Acid, and Sunset variations. The original modes remain useful as a small history of pixel-level experiments, while the newer modes are stable enough to share and export.

## Run

Serve the directory with any static server and open `index.html` (for example, `python3 -m http.server`). There is no build step; the small ES modules are loaded directly by the browser.

## Controls

- Click the canvas — new seed
- `←` / `→` — cycle modes (or click a thumbnail, or `0`–`9` for the first ten)
- `R` — randomize seed
- `Space` — pause/play animation
- `C` — auto-cycle modes every few seconds
- `S` — save the current frame as PNG
- "Pixel size" slider — chunky-pixel mode
- "Animate seed" slider — drift the seed each frame (positive or negative)
- "Palette" — recolor the newer procedural generators
- "Copy link" — shareable URL encoding the current mode/seed/size
