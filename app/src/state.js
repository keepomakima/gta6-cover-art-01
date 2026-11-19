// Heatwave Cover Studio — state, layouts, grades, caption styles, post sizes.
// Every value here is the single source of truth for the editor and the
// canvas renderer: the UI builds its chips from these tables, and cover.js
// reads them when it paints a cover.

export const LAYOUTS = [
  { id: 'cover-grid', name: 'Cover Grid', blurb: 'Three up top, two below' },
  { id: 'five-panel', name: 'Five Panel', blurb: 'Five tall strips' },
  { id: 'triptych', name: 'Triptych', blurb: 'Wide hero, two wings' },
  { id: 'single-hero', name: 'Single Hero', blurb: 'One photo, full bleed' },
  { id: 'split-diptych', name: 'Split Diptych', blurb: 'Two halves' },
  { id: 'key-art', name: 'Key Art', blurb: 'Hero left, stack right' },
  { id: 'mosaic', name: 'Mosaic', blurb: 'Nine tiles, one accent' },
];

export const GRADES = [
  {
    id: 'vice-sunset', name: 'Vice Sunset', kind: 'overlay',
    filter: 'saturate(1.3) contrast(1.06) brightness(1.02)',
    sky: ['#2a0e4d', '#c22a72', '#ff7a3c'],
    sun: '#ffd76a', tint: ['#ff7a3c', '#ff2e88'], tintAlpha: 0.16, tintMode: 'soft-light',
  },
  {
    id: 'neon-night', name: 'Neon Night', kind: 'overlay',
    filter: 'saturate(1.35) contrast(1.14) brightness(0.94)',
    sky: ['#070b2a', '#1c2a6b', '#7b2ff7'],
    sun: '#19c3e6', tint: ['#19c3e6', '#7b2ff7'], tintAlpha: 0.18, tintMode: 'soft-light',
  },
  {
    id: 'palm-dusk', name: 'Palm Dusk', kind: 'overlay',
    filter: 'saturate(1.22) contrast(1.05) brightness(0.98)',
    sky: ['#1d0b33', '#7a2a8c', '#e85d75'],
    sun: '#ff9d5c', tint: ['#e85d75', '#7a2a8c'], tintAlpha: 0.15, tintMode: 'soft-light',
  },
  {
    id: 'golden-hour', name: 'Golden Hour', kind: 'overlay',
    filter: 'saturate(1.32) contrast(1.04) brightness(1.06)',
    sky: ['#3d1a05', '#c96a1e', '#ffcf5c'],
    sun: '#fff3b0', tint: ['#ffcf5c', '#ff7a3c'], tintAlpha: 0.15, tintMode: 'soft-light',
  },
  {
    id: 'monochrome-noir', name: 'Monochrome Noir', kind: 'overlay',
    filter: 'grayscale(1) contrast(1.28) brightness(1.02)',
    sky: ['#0a0a12', '#2a2a38', '#6a6a7a'],
    sun: '#f2f2f2', tint: ['#ffffff', '#8a8a9a'], tintAlpha: 0.08, tintMode: 'overlay',
  },
  {
    id: 'miami-pop', name: 'Miami Pop', kind: 'overlay',
    filter: 'saturate(1.7) contrast(1.1) brightness(1.03)',
    sky: ['#12082e', '#ff2e88', '#19e6d6'],
    sun: '#ffe95e', tint: ['#ff2e88', '#19e6d6'], tintAlpha: 0.14, tintMode: 'soft-light',
  },
  {
    id: 'heatwave', name: 'Heatwave', kind: 'gradient-map',
    filter: '',
    sky: ['#2b0a4a', '#ff2e88', '#ff7a3c'],
    sun: '#ffe95e', tint: null, tintAlpha: 0, tintMode: 'soft-light',
    stops: [[0, '#23083f'], [0.32, '#8c1e7d'], [0.55, '#ff2e88'], [0.78, '#ff7a3c'], [1, '#ffe95e']],
  },
  {
    id: 'ultraviolet', name: 'Ultraviolet', kind: 'gradient-map',
    filter: '',
    sky: ['#0d1033', '#4a1d8f', '#19c3e6'],
    sun: '#f4feff', tint: null, tintAlpha: 0, tintMode: 'soft-light',
    stops: [[0, '#0d1033'], [0.38, '#5b21b6'], [0.68, '#19c3e6'], [1, '#f4feff']],
  },
];

export const CAPTION_STYLES = [
  { id: 'outline', name: 'Outline' },
  { id: 'solid', name: 'Solid' },
  { id: 'shadow', name: 'Shadow' },
  { id: 'halftone', name: 'Halftone' },
];

export const TITLE_POSITIONS = [
  { id: 'top', name: 'Top' },
  { id: 'center', name: 'Center' },
  { id: 'bottom', name: 'Bottom' },
  { id: 'band', name: 'Title Band' },
];

export const POST_SIZES = [
  { id: 'square', label: '1080 × 1080', width: 1080, height: 1080 },
  { id: 'portrait', label: '1080 × 1350', width: 1080, height: 1350 },
  { id: 'wide', label: '1920 × 1080', width: 1920, height: 1080 },
];

export const SAMPLE_SCENES = [
  { file: 'skyline-sunset.png', label: 'Skyline Sunset' },
  { file: 'beach-day.png', label: 'Beach Day' },
  { file: 'palm-boulevard.png', label: 'Palm Boulevard' },
  { file: 'neon-strip.png', label: 'Neon Strip' },
  { file: 'ocean-pier.png', label: 'Ocean Pier' },
];

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) || GRADES[6];
}

export function sizeById(id) {
  return POST_SIZES.find((s) => s.id === id) || POST_SIZES[2];
}

export function defaultState() {
  return {
    layout: 'key-art',
    grade: 'heatwave',
    captionStyle: 'halftone',
    titlePosition: 'band',
    size: 'wide',
    title: 'VICE CITY',
    subtitle: 'NEON HEIST · LEONIDA 2026',
    panels: SAMPLE_SCENES.map((scene, i) => ({
      sample: i,
      upload: null,
      zoom: 1,
      panX: 0,
      panY: 0,
      label: scene.label,
    })),
  };
}

// Panel geometry for one layout at a cover of W by H pixels.
// Returns { panels, band }: panels is an array of rects
// { x, y, w, h, slot, kind, role }; band is the title-band rect or null.
// kind 'photo' rects take panels[slot]; kind 'art' rects are drawn from
// the sky, the skyline and the palms instead of a photo.
export function layoutPanels(layoutId, W, H) {
  const g = Math.max(4, Math.round(Math.min(W, H) * 0.016));
  const rect = (x, y, w, h, slot, kind, role) => ({
    x: Math.round(x), y: Math.round(y),
    w: Math.round(w), h: Math.round(h),
    slot, kind: kind || 'photo', role: role || '',
  });

  if (layoutId === 'cover-grid') {
    const rowH = (H - g) / 2;
    const colW = (W - 2 * g) / 3;
    const bottomW = (W - g) / 2;
    return {
      panels: [
        rect(0, 0, colW, rowH, 0, 'photo', 'top-left'),
        rect(colW + g, 0, colW, rowH, 1, 'photo', 'top-middle'),
        rect(2 * (colW + g), 0, colW, rowH, 2, 'photo', 'top-right'),
        rect(0, rowH + g, bottomW, rowH, 3, 'photo', 'bottom-left'),
        rect(bottomW + g, rowH + g, bottomW, rowH, 4, 'photo', 'bottom-right'),
      ],
      band: null,
    };
  }

  if (layoutId === 'five-panel') {
    const colW = (W - 4 * g) / 5;
    return {
      panels: [0, 1, 2, 3, 4].map((i) =>
        rect(i * (colW + g), 0, colW, H, i, 'photo', 'strip-' + (i + 1))),
      band: null,
    };
  }

  if (layoutId === 'triptych') {
    const sideW = (W - 2 * g) * 0.25;
    const midW = (W - 2 * g) * 0.5;
    return {
      panels: [
        rect(0, 0, sideW, H, 0, 'photo', 'wing-left'),
        rect(sideW + g, 0, midW, H, 1, 'photo', 'hero'),
        rect(sideW + g + midW + g, 0, sideW, H, 2, 'photo', 'wing-right'),
      ],
      band: null,
    };
  }

  if (layoutId === 'single-hero') {
    return { panels: [rect(0, 0, W, H, 0, 'photo', 'hero')], band: null };
  }

  if (layoutId === 'split-diptych') {
    const halfW = (W - g) / 2;
    return {
      panels: [
        rect(0, 0, halfW, H, 0, 'photo', 'left'),
        rect(halfW + g, 0, halfW, H, 1, 'photo', 'right'),
      ],
      band: null,
    };
  }

  if (layoutId === 'key-art') {
    const bandH = Math.round(H * 0.15);
    const bodyH = H - bandH - g;
    const heroW = Math.round((W - g) * 0.6);
    const rightX = heroW + g;
    const rightW = W - rightX;
    const stackH = (bodyH - 2 * g) / 3;
    return {
      panels: [
        rect(0, 0, heroW, bodyH, 0, 'photo', 'hero'),
        rect(rightX, 0, rightW, stackH, 1, 'photo', 'stack-top'),
        rect(rightX, stackH + g, rightW, stackH, 2, 'photo', 'stack-middle'),
        rect(rightX, 2 * (stackH + g), rightW, stackH, 3, 'photo', 'stack-bottom'),
      ],
      band: { x: 0, y: bodyH + g, w: W, h: bandH },
    };
  }

  // Mosaic: a 3 by 3 grid. Five photo tiles (the corners plus the top
  // middle) each take one sample scene exactly once; the two middle side
  // tiles and the bottom middle tile are sky-and-palm art; the centre
  // tile is the accent tile.
  const cellW = (W - 2 * g) / 3;
  const cellH = (H - 2 * g) / 3;
  const cell = (col, row) => ({ x: col * (cellW + g), y: row * (cellH + g), w: cellW, h: cellH });
  const photoCells = [[0, 0], [2, 0], [1, 0], [0, 2], [2, 2]];
  const panels = photoCells.map(([col, row], i) => {
    const c = cell(col, row);
    return rect(c.x, c.y, c.w, c.h, i, 'photo', 'tile-' + col + '-' + row);
  });
  const artCells = [
    { col: 0, row: 1, art: 'palms' },
    { col: 2, row: 1, art: 'palms' },
    { col: 1, row: 1, art: 'accent' },
    { col: 1, row: 2, art: 'palms' },
  ];
  for (const a of artCells) {
    const c = cell(a.col, a.row);
    panels.push(rect(c.x, c.y, c.w, c.h, -1, 'art', a.art));
  }
  return { panels, band: null };
}
