// Shared cover state: the five layouts, six colour grades, three post sizes and the
// default cover (two Vice City sample photos, bold outlined VICE CITY caption).
// Nothing here touches the network; photos are local files or bundled samples.

export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square 1080 x 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait 1080 x 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Landscape 1920 x 1080' },
};

// A panel rect is fractions of the cover: [x, y, w, h]. `photo` picks the panel's
// photo by index into state.photos; `hero` marks the panel the title can sit over.
export const LAYOUTS = {
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

// filter: canvas filter applied to each photo. sky: [top, mid, bottom] gradient stops.
// sun: sun-disc colour. accent: grade's headline colour. overlay: [colour, alpha] wash.
export const GRADES = {
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

/** The default cover state: Cover Grid, Vice Sunset, portrait, two sample photos. */
export function defaultState() {
  return {
    layout: 'grid',
    grade: 'sunset',
    gradeStrength: 0.7,
    size: '1080x1350',
    title: 'VICE CITY',
    subtitle: 'NEON HEIST · LEONIDA 2026',
    titleSize: 1.0,
    titlePos: 'bottom',
    titleStyle: 'outline',
    outlineColor: '#ff2e88',
    // Per-panel crop: zoom 1 = cover-fit, ox/oy = pan in fractions of panel size.
    // The sample photos have faces near the top, so the pans favour the top
    // of each photo (positive oy shifts the photo down into the frame).
    panels: [
      { photo: 0, zoom: 1.05, ox: 0, oy: 0.2 },
      { photo: 1, zoom: 1.0, ox: 0, oy: 0.15 },
      { photo: 1, zoom: 1.05, ox: 0, oy: 0.15 },
      { photo: 0, zoom: 1.1, ox: -0.04, oy: 0.12 },
      { photo: 1, zoom: 1.05, ox: 0, oy: 0.15 },
    ],
    photos: [], // filled by the app: {img, name, url}
  };
}

/** Panel slots for the current layout, each merged with its stored crop settings. */
export function layoutPanels(state, w, h) {
  const defs = LAYOUTS[state.layout].panels(w, h);
  return defs.map((def, i) => ({
    ...def,
    ...(state.panels[i] || { photo: i % 2, zoom: 1.1, ox: 0, oy: 0 }),
  }));
}
