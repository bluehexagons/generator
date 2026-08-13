# Plasma Generator

A browser toy for making animated plasma, noise, and interference patterns. It has twenty scenes, five palettes, a seed you can share, and no runtime dependencies.

The first ten scenes grew out of pixel functions I wrote on an iPhone 3GS between classes. By then I had already been programming for years, mostly in other areas. This was a fun constraint: make something visual one pixel and one small formula at a time. Those formulas have been loosened up for this version while keeping their original ideas intact.

The other ten scenes go further into familiar procedural territory: sine-wave plasma, value noise, metaballs, domain warping, Voronoi cells, a Julia set, polar ribbons, RGB oscillators, and marble veins.

## Run it

Serve the directory with any static file server, then open `index.html`:

```sh
python3 -m http.server
```

There is no build step. The app uses plain JavaScript modules and the Canvas 2D API.

To run the checks:

```sh
npm run check
npm test
```

Node 18.18 or newer is required for the tests.

## Controls

- Tap the artwork for a new seed.
- Drag left or right to scrub through seeds.
- Swipe on a touch screen, use the arrow keys, or choose a thumbnail to change scenes.
- Use the transport to pause the motion or automatically move through the scenes.
- Adjust motion speed in either direction, scene duration, pixel size, and palette in the controls panel.
- Press `R` for a new seed, `Space` to play or pause, `C` to toggle auto-play, `S` to save, or `F` to open the controls.
- Share copies a link containing the scene, seed, palette, pixel size, and playback settings.

Animation renders at a slightly coarser resolution when a high-density display would make full-resolution frames too expensive. Pausing returns to the requested pixel size, and PNG exports always use that requested size.

## Files

- `algorithms.js` contains the scenes, palettes, noise helpers, and pixel functions.
- `renderer.js` writes the pixels into a reusable `ImageData` buffer.
- `url-state.js` reads and writes the shareable hash.
- `script.js` owns playback, controls, gestures, and the gallery.
