# Palmline — GTA 6 Cover Art Studio

[![gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?ref=dy7a168m)
[![rank](https://make.fun/badge/gta6-cover-art-01/keepomakima/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01?ref=dy7a168m)
[![reward](https://make.fun/badge/gta6-cover-art-01/keepomakima/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?ref=dy7a168m)

Turn your photos into a GTA 6-style poster cover: six photorealistic sample
faces, a pop-out Key Art hero, eight layouts, eight gradient-map colour grades,
retro-chrome title lettering and the full poster furniture — press quote with
five stars, VOL. number, role tags, tagline band, billing block, seal and
barcode. Exports PNG in 1080 × 1080, 1080 × 1350 and 1920 × 1080.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

Pick a layout, pick a grade, click a panel and pick a face (or drop in your own
photo). Drag inside a panel to move its photo, scroll to zoom it, and use the
Face X / Face Y sliders to move the face-aware focus point. Export one size or
all three.

## What is inside

- `app/index.html` — the studio page
- `app/src/cover.js` — the cover renderer: layouts, gradient-map grades,
  pop-out hero, title styles, poster furniture, face-aware crop
- `app/src/main.js` — studio wiring: panels, uploads, drag-drop, export
- `app/src/shots.js` — fixed scenes for screenshots and the layout × grade
  self-test (`?shot=test`)
- `app/samples/` — six free-to-use portraits from Unsplash (Unsplash License):
  `neon.jpg`, `sunset.jpg`, `night.jpg`, `boulevard.jpg`, `golden.jpg`,
  `ultraviolet.jpg`
- `app/fonts/` — Bebas Neue and Oswald, SIL Open Font License 1.1

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and writes
`dossier.json` with the vendored make.fun library.

## License

SPDX-License-Identifier: MIT — see [LICENSE](LICENSE). A fan-made poster tool,
not affiliated with Rockstar Games; no Rockstar logo, artwork or font is used.

Built for [Make GTA 6 Cover Art on make.fun](https://make.fun/bounty/gta6-cover-art-01?ref=dy7a168m).
