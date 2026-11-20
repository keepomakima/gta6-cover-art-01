// app/src/state.js — Key Art Studio: the data behind the cover maker.
// Layouts, gradient-map grades, title styles, role tags and the default
// state. No DOM here: cover.js renders from this, main.js wires the UI.

// The five sample scenes, rendered procedurally in-session (tools/make-samples.mjs).
export const SAMPLE_SCENES = [
  { id: 'skyline-sunset', label: 'Skyline Sunset', src: 'samples/skyline-sunset.png' },
  { id: 'beach-day', label: 'Beach Day', src: 'samples/beach-day.png' },
  { id: 'neon-strip', label: 'Neon Strip', src: 'samples/neon-strip.png' },
  { id: 'ocean-pier', label: 'Ocean Pier', src: 'samples/ocean-pier.png' },
  { id: 'palm-boulevard', label: 'Palm Boulevard', src: 'samples/palm-boulevard.png' },
];

// Export sizes: the three common post sizes, plus export-all.
export const EXPORT_SIZES = [
  { id: 'square', label: '1080 × 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: '1080 × 1350', w: 1080, h: 1350 },
  { id: 'wide', label: '1920 × 1080', w: 1920, h: 1080 },
];

// A panel is { x, y, w, h } in fractions of the cover, plus an optional
// `skew` (the top edge's horizontal shift, in fractions of cover height)
// for the Slanted layout's diagonal panels.
export const LAYOUTS = [
  {
    id: 'keyart', name: 'Key Art', blurb: 'Hero skyline + 3 panels',
    panels: () => ([
      { x: 0, y: 0, w: 1, h: 0.60 },
      { x: 0, y: 0.60, w: 1 / 3, h: 0.40 },
      { x: 1 / 3, y: 0.60, w: 1 / 3, h: 0.40 },
      { x: 2 / 3, y: 0.60, w: 1 / 3, h: 0.40 },
    ]),
    title: { fx: 0.045, fy: 0.40, fw: 0.91, align: 'left' },
    seal: { fx: 0.885, fy: 0.475 }, callouts: 'hero-top', frame: true,
  },
  {
    id: 'mosaic', name: 'Mosaic', blurb: '9-panel poster grid',
    panels: () => {
      const out = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        out.push({ x: c / 3, y: r / 3, w: 1 / 3, h: 1 / 3 });
      }
      return out;
    },
    title: { fx: 0.05, fy: 0.70, fw: 0.90, align: 'center' },
    seal: { fx: 0.885, fy: 0.10 }, callouts: 'hero-top', frame: false,
  },
  {
    id: 'covergrid', name: 'Cover Grid', blurb: 'Hero + 4 panels',
    panels: () => ([
      { x: 0, y: 0, w: 0.64, h: 0.58 },
      { x: 0.64, y: 0, w: 0.36, h: 0.58 },
      { x: 0, y: 0.58, w: 1 / 3, h: 0.42 },
      { x: 1 / 3, y: 0.58, w: 1 / 3, h: 0.42 },
      { x: 2 / 3, y: 0.58, w: 1 / 3, h: 0.42 },
    ]),
    title: { fx: 0.045, fy: 0.38, fw: 0.58, align: 'left' },
    seal: { fx: 0.885, fy: 0.10 }, callouts: 'hero-top', frame: true,
  },
  {
    id: 'fivepanel', name: 'Five Panel', blurb: 'Hero + 4 below',
    panels: () => ([
      { x: 0, y: 0, w: 1, h: 0.46 },
      { x: 0, y: 0.46, w: 0.25, h: 0.54 },
      { x: 0.25, y: 0.46, w: 0.25, h: 0.54 },
      { x: 0.50, y: 0.46, w: 0.25, h: 0.54 },
      { x: 0.75, y: 0.46, w: 0.25, h: 0.54 },
    ]),
    title: { fx: 0.05, fy: 0.28, fw: 0.90, align: 'center' },
    seal: { fx: 0.885, fy: 0.10 }, callouts: 'hero-top', frame: false,
  },
  {
    id: 'triptych', name: 'Triptych', blurb: 'Three tall panels',
    panels: () => ([
      { x: 0, y: 0, w: 1 / 3, h: 1 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
    ]),
    title: { fx: 0.05, fy: 0.70, fw: 0.90, align: 'center' },
    seal: { fx: 0.885, fy: 0.08 }, callouts: 'hero-top', frame: false,
  },
  {
    id: 'single', name: 'Single Hero', blurb: 'One full-bleed photo',
    panels: () => ([{ x: 0, y: 0, w: 1, h: 1 }]),
    title: { fx: 0.05, fy: 0.68, fw: 0.90, align: 'center' },
    seal: { fx: 0.885, fy: 0.09 }, callouts: 'hero-top', frame: true,
  },
  {
    id: 'split', name: 'Split Diptych', blurb: 'Two halves',
    panels: () => ([
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ]),
    title: { fx: 0.05, fy: 0.70, fw: 0.90, align: 'center' },
    seal: { fx: 0.885, fy: 0.08 }, callouts: 'hero-top', frame: false,
  },
  {
    id: 'slanted', name: 'Slanted', blurb: 'Diagonal poster panels',
    panels: () => ([
      { x: -0.02, y: 0, w: 0.38, h: 1, skew: 0.10 },
      { x: 0.33, y: 0, w: 0.38, h: 1, skew: 0.10 },
      { x: 0.68, y: 0, w: 0.38, h: 1, skew: 0.10 },
    ]),
    title: { fx: 0.05, fy: 0.70, fw: 0.90, align: 'center' },
    seal: { fx: 0.885, fy: 0.08 }, callouts: 'hero-top', frame: false,
  },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];
}

// Gradient-map grades: luminance 0..1 maps through these colour stops.
// Heatwave is the default: it unifies any photo into one sunset palette.
export const GRADES = [
  { id: 'heatwave', name: 'Heatwave', swatch: ['#14082b', '#c43d6e', '#ffe9a8'],
    stops: [[0, '#14082b'], [0.25, '#5b1a5e'], [0.5, '#c43d6e'], [0.75, '#ff7a3d'], [1, '#ffe9a8']] },
  { id: 'ultraviolet', name: 'Ultraviolet', swatch: ['#0a0618', '#7b2fbe', '#fdf0ff'],
    stops: [[0, '#0a0618'], [0.3, '#2d1b69'], [0.55, '#7b2fbe'], [0.8, '#e14eca'], [1, '#fdf0ff']] },
  { id: 'golden-hour', name: 'Golden Hour', swatch: ['#1d1206', '#b26a1b', '#fff3c4'],
    stops: [[0, '#1d1206'], [0.3, '#5c2e0e'], [0.55, '#b26a1b'], [0.8, '#f2a93b'], [1, '#fff3c4']] },
  { id: 'neon-night', name: 'Neon Night', swatch: ['#0b0618', '#c2187a', '#e8fbff'],
    stops: [[0, '#0b0618'], [0.3, '#3b0f54'], [0.55, '#c2187a'], [0.8, '#22d3ee'], [1, '#f0feff']] },
  { id: 'vice-sunset', name: 'Vice Sunset', swatch: ['#160b2e', '#d94f70', '#fff1c9'],
    stops: [[0, '#160b2e'], [0.3, '#6d1e5e'], [0.55, '#d94f70'], [0.8, '#ff9e57'], [1, '#fff1c9']] },
  { id: 'palm-dusk', name: 'Palm Dusk', swatch: ['#0e1a12', '#4d8a5f', '#fff6d8'],
    stops: [[0, '#0e1a12'], [0.3, '#1e4d3a'], [0.55, '#4d8a5f'], [0.8, '#d8c26a'], [1, '#fff6d8']] },
  { id: 'noir', name: 'Monochrome Noir', swatch: ['#000000', '#8a8a8a', '#ffffff'],
    stops: [[0, '#000000'], [0.35, '#2a2a2a'], [0.65, '#8a8a8a'], [1, '#ffffff']] },
  { id: 'miami-pop', name: 'Miami Pop', swatch: ['#12041f', '#ff2e88', '#ffffff'],
    stops: [[0, '#12041f'], [0.3, '#6a1fb0'], [0.55, '#ff2e88'], [0.8, '#ffb35c'], [1, '#ffffff']] },
];

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) || GRADES[0];
}

// Title lettering styles: retro-chrome 3D, halftone dots, flat poster ink.
export const TITLE_STYLES = [
  { id: 'chrome', name: 'Retro Chrome' },
  { id: 'halftone', name: 'Halftone' },
  { id: 'flat', name: 'Flat Ink' },
];

// Invented cast for the role tags and billing block — no real GTA characters.
export const DEFAULT_ROLES = [
  { name: 'MARISOL VEGA', role: 'DRIVER' },
  { name: 'DANTE RUIZ', role: 'LOOKOUT' },
  { name: 'RICO SANTOS', role: 'FIXER' },
];

export const DEFAULT_CALLOUTS = [
  { text: 'PALM BOULEVARD', ax: 0.10, ay: 0.10, side: -1 },
  { text: 'NEON STRIP', ax: 0.90, ay: 0.10, side: 1 },
];

// One panel's photo + crop. zoom 1 = cover-fit; cx/cy = focal point (0..1).
export function defaultCrop() {
  return { zoom: 1, cx: 0.5, cy: 0.45 };
}

// The cover the app opens with: Key Art, Heatwave, four different photos.
export function defaultState() {
  return {
    layout: 'keyart',
    grade: 'heatwave',
    size: 'wide',
    title: 'VICE CITY',
    subtitle: 'A LEONIDA STORY',
    titleStyle: 'chrome',
    titleScale: 1,
    titleColor: '#ffffff',
    showSeal: true,
    showBilling: true,
    showCallouts: true,
    showRoles: true,
    showFrame: true,
    showGlow: true,
    roles: DEFAULT_ROLES.map((r) => ({ ...r })),
    callouts: DEFAULT_CALLOUTS.map((c) => ({ ...c })),
    // 9 panels (Mosaic's count); layouts with fewer simply ignore the rest.
    // The first four are four DIFFERENT sample scenes — no repeats on the
    // default cover.
    panels: [
      { photo: 0, crop: defaultCrop() },
      { photo: 1, crop: defaultCrop() },
      { photo: 2, crop: defaultCrop() },
      { photo: 3, crop: defaultCrop() },
      { photo: 4, crop: defaultCrop() },
      { photo: 0, crop: defaultCrop() },
      { photo: 1, crop: defaultCrop() },
      { photo: 2, crop: defaultCrop() },
      { photo: 3, crop: defaultCrop() },
    ],
  };
}
