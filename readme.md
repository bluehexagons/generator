# Plasma Generator

A browser toy for making animated plasma, noise, and interference patterns. It has twenty scenes, five palettes, a seed you can share, and no runtime dependencies.

The first ten scenes grew out of pixel functions I wrote on an iPhone 3GS between classes. By then I had already been programming for years, mostly in other areas. This was a fun constraint: make something visual one pixel and one small formula at a time. Those formulas have been loosened up for this version while keeping their original ideas intact.

The other ten scenes go further into familiar procedural territory: sine-wave plasma, value noise, metaballs, domain warping, Voronoi cells, a Julia set, polar ribbons, RGB oscillators, and marble veins.

## Run it

Install the development tools and start Vite:

```sh
npm install
npm run dev
```

Open the local URL shown by Vite. The app uses TypeScript modules and the Canvas 2D API, with no runtime dependencies. Node 20.19 or newer is required for the development tools.

To create a deployable static site, run `npm run build` and serve the `dist/` directory. You can inspect that build locally with `npm run preview`.

To run the type check, Oxlint, Oxfmt check, tests, and production build:

```sh
npm run check
```

Run `npm run format` to apply Oxfmt, or use `npm run typecheck`, `npm run lint`, and `npm test` separately.

## Controls

- Tap the artwork for a new seed.
- Drag left or right to scrub through seeds.
- Swipe on a touch screen, use the arrow keys, or choose a thumbnail to change scenes.
- In the scene gallery, use the arrow keys to move between scenes and Home/End to jump to the first or last scene. Number keys `1`–`9` and `0` select scenes 1–10.
- Use the transport to pause, move through scenes in order, or start a procedural showcase that avoids recently shown scenes.
- Adjust motion speed in either direction, scene duration, pixel size, and palette in the controls panel.
- Press `R` for a new seed, `Space` to play or pause, `C` to toggle auto-play, `S` to save, `F` to open the controls, or `G` to toggle fullscreen.
- Enable “Hide UI when idle” in the controls to fade the interface after a few seconds without pointer or keyboard activity. The choice is remembered in this browser.
- Share copies a link containing the scene, seed, palette, pixel size, and playback settings.

Animation renders at a slightly coarser resolution when a high-density display would make full-resolution frames too expensive. Pausing returns to the requested pixel size, and PNG exports always use that requested size.

## Files

- `algorithms.ts` contains scene metadata, palettes, noise helpers, and pixel functions.
- `renderer.ts` writes pixels through the shared scene-preparation contract into a reusable `ImageData` buffer.
- `app-state.ts` contains pure state transitions and playback calculations.
- `playback.ts` contains request-animation-frame clock math.
- `url-state.ts` parses and serializes the shareable hash, with browser history kept at the edge.
- `ui.ts` owns DOM projection for the HUD, controls, panel, toast, and gallery.
- `script.ts` bootstraps the browser event wiring and coordinates those modules.
