// Shared cover state for Heatwave Cover Studio v2: seven layouts (Key Art and
// Mosaic are new), eight colour grades (Heatwave and Ultraviolet are new
// gradient-map grades), four caption styles (Halftone is new) and the three
// post sizes. The default cover is Key Art + Heatwave at 1920x1080, with a
// different procedural Vice City scene in every panel. Nothing here touches
// the network; photos are local files or bundled samples.

export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square 1080 x 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait 1080 x 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Landscape 1920 x 1080' },
};

// A panel rect is fractions of the cover: [x, y, w, h]. `photo` picks the
// panel's photo by index into state.photos; `hero` marks the panel the
// title band can sit over. Layouts are functions of (w, h) so the same
// layout adapts to landscape and portrait post sizes.
export const LAYOUTS = {
  keyart: {
    label: 'Key Art',
    panels: (w, h) => {
      if (w >= h) {
        return [
          { name: 'Hero', rect: [0, 0, 0.6, 1], hero: true },
          { name: 'Skyline', rect: [0.6, 0, 0.4, 1 / 3] },
          { name: 'Neon', rect: [0.6, 1 / 3, 0.4, 1 / 3] },
          { name: 'Pier', rect: [0.6, 2 / 3, 0.4, 1 / 3] },
        ];
      }
      return [
        { name: 'Hero', rect: [0, 0, 1, 0.58], hero: true },
        { name: 'Skyline', rect: [0, 0.58, 1 / 3, 0.42] },
        { name: 'Neon', rect: [1 / 3, 0.58, 1 / 3, 0.42] },
        { name: 'Pier', rect: [2 / 3, 0.58, 1 / 3, 0.42] },
      ];
    },
  },
  mosaic: {
    label: 'Mosaic',
    panels: () => {
      const out = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          out.push({
            name: `Tile ${r * 3 + c + 1}`,
            rect: [c / 3, r / 3, 1 / 3, 1 / 3],
            hero: r === 1 && c === 1,
          });
        }
      }
      return out;
    },
  },
  grid: {
    label: 'Cover Grid',
    panels: (w, h) => {
      if (w >= h) {
        return [
          { name: 'Hero', rect: [0, 0, 0.62, 1], hero: true },
          { name: 'Top right', rect: [0.62, 0, 0.38, 0.5] },
          { name: 'Bottom right', rect: [0.62, 0.5, 0.38, 0.5] },
        ];
      }
      return [
        { name: 'Hero', rect: [0, 0, 1, 0.62], hero: true },
        { name: 'Left', rect: [0, 0.62, 1 / 3, 0.38] },
        { name: 'Centre', rect: [1 / 3, 0.62, 1 / 3, 0.38] },
        { name: 'Right', rect: [2 / 3, 0.62, 1 / 3, 0.38] },
      ];
    },
  },
  five: {
    label: 'Five Panel',
    panels: (w, h) => {
      if (w >= h) {
        return [
          { name: 'Left top', rect: [0, 0, 0.26, 0.5] },
          { name: 'Left bottom', rect: [0, 0.5, 0.26, 0.5] },
          { name: 'Hero', rect: [0.26, 0, 0.48, 1], hero: true },
          { name: 'Right top', rect: [0.74, 0, 0.26, 0.5] },
          { name: 'Right bottom', rect: [0.74, 0.5, 0.26, 0.5] },
        ];
      }
      return [
        { name: 'Top left', rect: [0, 0, 0.5, 0.24] },
        { name: 'Top right', rect: [0.5, 0, 0.5, 0.24] },
        { name: 'Hero', rect: [0, 0.24, 1, 0.52], hero: true },
        { name: 'Bottom left', rect: [0, 0.76, 0.5, 0.24] },
        { name: 'Bottom right', rect: [0.5, 0.76, 0.5, 0.24] },
      ];
    },
  },
  triptych: {
    label: 'Triptych',
    panels: (w, h) => {
      if (w >= h) {
        return [
          { name: 'Left', rect: [0, 0, 1 / 3, 1] },
          { name: 'Centre', rect: [1 / 3, 0, 1 / 3, 1], hero: true },
          { name: 'Right', rect: [2 / 3, 0, 1 / 3, 1] },
        ];
      }
      return [
        { name: 'Top', rect: [0, 0, 1, 1 / 3] },
        { name: 'Centre', rect: [0, 1 / 3, 1, 1 / 3], hero: true },
        { name: 'Bottom', rect: [0, 2 / 3, 1, 1 / 3] },
      ];
    },
  },
  hero: {
    label: 'Single Hero',
    panels: () => [{ name: 'Hero', rect: [0, 0, 1, 1], hero: true }],
  },
  split: {
    label: 'Split Diptych',
    panels: (w, h) => {
      if (w >= h) {
        return [
          { name: 'Left', rect: [0, 0, 0.5, 1], hero: true },
          { name: 'Right', rect: [0.5, 0, 0.5, 1] },
        ];
      }
      return [
        { name: 'Top', rect: [0, 0, 1, 0.5], hero: true },
        { name: 'Bottom', rect: [0, 0.5, 1, 0.5] },
      ];
    },
  },
};

// filter: canvas filter applied to each photo before the grade wash. sky:
// [top, mid, bottom] gradient stops for the painted backdrop. sun: sun-disc
// colour. accent: the grade's headline colour. overlay: [colour, alpha] wash.
// map: gradient-map stops — when present the whole cover's luminance is
// remapped through these stops after the panels are drawn (Heatwave and
// Ultraviolet), which is what makes the grade read as one poster, not a filter.
export const GRADES = {
  heatwave: {
    label: 'Heatwave',
    swatch: '#ff7a18',
    filter: 'saturate(1.25) contrast(1.06) brightness(1.02)',
    sky: ['#2b1055', '#ff2e88', '#ff7a18'],
    sun: '#ffd166',
    accent: '#ff2e88',
    overlay: ['#ff7a18', 0.06],
    map: ['#1a0533', '#7b2ff7', '#ff2e88', '#ff7a18', '#ffd166', '#fff3b0'],
  },
  ultraviolet: {
    label: 'Ultraviolet',
    swatch: '#7b2ff7',
    filter: 'saturate(1.4) contrast(1.1) brightness(0.98)',
    sky: ['#05001a', '#3b0f6e', '#7b2ff7'],
    sun: '#00e5ff',
    accent: '#00e5ff',
    overlay: ['#7b2ff7', 0.08],
    map: ['#05001a', '#3b0f6e', '#7b2ff7', '#ff2e88', '#00e5ff', '#ffffff'],
  },
  sunset: {
    label: 'Vice Sunset',
    swatch: '#ff7a18',
    filter: 'saturate(1.35) contrast(1.08) brightness(1.03) sepia(0.18)',
    sky: ['#2b1055', '#ff5e62', '#ff9a3d'],
    sun: '#ffd166',
    accent: '#ff2e88',
    overlay: ['#ff5e62', 0.10],
  },
  neon: {
    label: 'Neon Night',
    swatch: '#00e5ff',
    filter: 'saturate(1.55) contrast(1.14) brightness(0.96) hue-rotate(-12deg)',
    sky: ['#05001a', '#3b0f6e', '#ff2e88'],
    sun: '#00e5ff',
    accent: '#00e5ff',
    overlay: ['#7b2ff7', 0.14],
  },
  dusk: {
    label: 'Palm Dusk',
    swatch: '#b388ff',
    filter: 'saturate(1.2) contrast(1.06) brightness(0.98) hue-rotate(18deg)',
    sky: ['#1a0533', '#7b2ff7', '#ff7a9e'],
    sun: '#ff8fab',
    accent: '#ffb300',
    overlay: ['#7b2ff7', 0.12],
  },
  golden: {
    label: 'Golden Hour',
    swatch: '#ffb300',
    filter: 'saturate(1.3) contrast(1.05) brightness(1.06) sepia(0.28)',
    sky: ['#3d1a00', '#ff8c42', '#ffd166'],
    sun: '#fff3b0',
    accent: '#ff7a18',
    overlay: ['#ffb300', 0.10],
  },
  noir: {
    label: 'Monochrome Noir',
    swatch: '#9aa0a6',
    filter: 'grayscale(1) contrast(1.22) brightness(1.02)',
    sky: ['#000000', '#3a3a3a', '#8a8a8a'],
    sun: '#f5f5f5',
    accent: '#ffffff',
    overlay: ['#000000', 0.08],
  },
  miami: {
    label: 'Miami Pop',
    swatch: '#ff2e88',
    filter: 'saturate(1.7) contrast(1.1) brightness(1.04) hue-rotate(-28deg)',
    sky: ['#0d0221', '#ff2e88', '#00e5ff'],
    sun: '#ffe66d',
    accent: '#00e5ff',
    overlay: ['#ff2e88', 0.10],
  },
};

/** Caption styles: outline, solid, shadow, and the new halftone dot texture. */
export const TITLE_STYLES = ['halftone', 'outline', 'solid', 'shadow'];

/**
 * The default cover state: Key Art, Heatwave gradient-map grade, landscape,
 * halftone title in a bottom title band. The five sample scenes are all
 * different, and the first five panel slots use each scene exactly once, so
 * the default cover never repeats a photo. Crops are tuned per scene: the
 * pier pans down to its deck (negative oy shows the photo's lower half,
 * above the title band), the beach tower sits centred in its scene so narrow
 * tiles still show a subject, and the second beach slot zooms into the
 * umbrella side and pans it above the title band.
 */
export function defaultState() {
  return {
    layout: 'keyart',
    grade: 'heatwave',
    gradeStrength: 0.75,
    size: '1920x1080',
    title: 'VICE CITY',
    subtitle: 'NEON HEIST · LEONIDA 2026',
    titleSize: 1.0,
    titlePos: 'band',
    titleStyle: 'halftone',
    outlineColor: '#ff2e88',
    // Per-panel crop: zoom 1 = cover-fit, ox/oy = pan in fractions of panel size.
    // Slot order: boulevard (hero), skyline, neon, pier, beach — then the
    // cycle repeats for the 9-panel Mosaic, which is the only layout with
    // more slots than distinct scenes.
    panels: [
      { photo: 2, zoom: 1.06, ox: 0, oy: 0.06 },
      { photo: 0, zoom: 1.0, ox: 0, oy: 0 },
      { photo: 3, zoom: 1.0, ox: 0, oy: 0 },
      { photo: 4, zoom: 1.5, ox: 0, oy: -0.55 },
      { photo: 1, zoom: 1.2, ox: 0, oy: 0.1 },
      { photo: 0, zoom: 1.05, ox: 0, oy: 0 },
      { photo: 1, zoom: 1.5, ox: -0.3, oy: -0.3 },
      { photo: 2, zoom: 1.1, ox: 0, oy: 0.06 },
      { photo: 3, zoom: 1.05, ox: 0, oy: 0 },
    ],
    photos: [], // filled by the app: {img, name, url}
  };
}

/** Panel slots for the current layout, each merged with its stored crop settings. */
export function layoutPanels(state, w, h) {
  const defs = LAYOUTS[state.layout].panels(w, h);
  return defs.map((def, i) => ({
    ...def,
    ...(state.panels[i] || { photo: i % 5, zoom: 1.1, ox: 0, oy: 0 }),
  }));
}
