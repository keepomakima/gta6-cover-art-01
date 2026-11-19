# gta6-cover-art-01

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/keepomakima/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/keepomakima/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Heatwave Cover Studio — an offline web app that turns your photos and a caption into GTA 6-style cover art: multi-panel poster layouts, Vice City sunset and neon colour grades, bold Bebas Neue lettering (including a halftone style), and one-click PNG export in the three common post sizes.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — pick a layout, a grade and a caption, drag any panel to pan it, scroll to zoom, drop in your own photos, and export the cover as a PNG (1080 × 1080, 1080 × 1350, or 1920 × 1080, plus an export-all-3 button). Everything runs from local files; no photo ever leaves your machine.

## What is inside

- `app/index.html` — the editor shell: top bar, control panels, live preview stage.
- `app/style.css` — the dark Vice City theme (pink-to-orange top bar, dark panels, pill chips).
- `app/src/state.js` — state plus the 7 layouts, 8 grades, 4 caption styles, 4 title positions and 3 post sizes, with `layoutPanels()` geometry.
- `app/src/cover.js` — the canvas pipeline: sky, skyline, palms, per-panel cover-fit with a coverage clamp, gradient-map grades (Heatwave, Ultraviolet), halftone titles, title band, vignette.
- `app/src/main.js` — UI wiring, sample-photo loading (5 distinct scenes), drag-to-pan, wheel zoom, uploads, export, and the `window.__coverApp` test API.
- `app/fonts/` — Bebas Neue under the SIL Open Font License (`OFL.txt`).
- `main.ts` — copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with the kit's `buildDossier`.

---

Entered on [make.fun](https://make.fun/?ref=dy7a168m&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards
