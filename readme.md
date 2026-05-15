# generator

Generates plasma-style images in a `<canvas>`. Ten render modes, each a different bit of pixel math.

Originally written on an iPhone 3GS between classes — one of my first projects. The ten `pixelN()` formulas are preserved verbatim; the surrounding scaffold has been rebuilt for demo use: full-viewport canvas, fast `ImageData` renderer, live thumbnail gallery, seed animation, PNG export, and a deep-linkable URL (`#mode=4&seed=0.1234&size=1`).

## Run

Open `index.html` in a browser. No build step.

## Controls

- Click the canvas — new seed
- `←` / `→` — cycle modes (or click a thumbnail, or `0`–`9`)
- `R` — randomize seed
- `Space` — pause/play animation
- `C` — auto-cycle modes every few seconds
- `S` — save the current frame as PNG
- "Pixel size" slider — chunky-pixel mode
- "Animate seed" slider — drift the seed each frame (positive or negative)
- "Copy link" — shareable URL encoding the current mode/seed/size
