// Palmline — the cover renderer. Draws a GTA-style multi-panel poster cover onto
// any canvas: photorealistic portrait panels, a pop-out hero, retro-chrome title
// and the full poster furniture (press quote, VOL number, role tags, tagline band,
// billing block, seal and barcode). No libraries, no network, canvas only.

export const SAMPLES = [
  { id: 'neon', file: 'samples/neon.jpg', name: 'LUCIA', role: 'GETAWAY DRIVER', place: 'NEON ROW', time: '11 PM', hook: 'THE LAST JOB', focus: { x: 0.52, y: 0.36 } },
  { id: 'sunset', file: 'samples/sunset.jpg', name: 'MARA', role: 'BEACH RUNNER', place: 'OCEAN DR', time: '6 PM', hook: 'GOLDEN HOUR', focus: { x: 0.5, y: 0.3 } },
  { id: 'night', file: 'samples/night.jpg', name: 'DANTE', role: 'FIXER', place: 'THE DOCKS', time: '2 AM', hook: 'NO QUESTIONS', focus: { x: 0.5, y: 0.32 } },
  { id: 'boulevard', file: 'samples/boulevard.jpg', name: 'RICO', role: 'WHEELMAN', place: 'PALM BLVD', time: '9 PM', hook: 'FULL THROTTLE', focus: { x: 0.52, y: 0.3 } },
  { id: 'golden', file: 'samples/golden.jpg', name: 'SOFIA', role: 'SMUGGLER', place: 'SUNSET PIER', time: '7 PM', hook: 'CARGO OF GOLD', focus: { x: 0.55, y: 0.38 } },
  { id: 'ultraviolet', file: 'samples/ultraviolet.jpg', name: 'NOVA', role: 'HACKER', place: 'VICE TOWER', time: 'MIDNIGHT', hook: 'GHOST IN THE GRID', focus: { x: 0.5, y: 0.38 } },
];

export const GRADES = {
  heatwave: { label: 'Heatwave', stops: [[0, '#160a24'], [0.25, '#5b1a4d'], [0.5, '#c2432f'], [0.75, '#ff8a3d'], [1, '#ffe9a8']] },
  ultraviolet: { label: 'Ultraviolet', stops: [[0, '#070312'], [0.25, '#2a0a5e'], [0.5, '#7b2ff7'], [0.75, '#c86bfa'], [1, '#f5d0ff']] },
  golden: { label: 'Golden Hour', stops: [[0, '#1c0f02'], [0.25, '#5e2c05'], [0.5, '#b96a12'], [0.75, '#f5a623'], [1, '#ffedbe']] },
  neon: { label: 'Neon Night', stops: [[0, '#020a12'], [0.25, '#0a2e4d'], [0.5, '#0e7c86'], [0.75, '#ff2e88'], [1, '#b8fff1']] },
  vice: { label: 'Vice Sunset', stops: [[0, '#12041f'], [0.25, '#4d0f54'], [0.5, '#a4136e'], [0.75, '#ff5e78'], [1, '#ffc46b']] },
  dusk: { label: 'Palm Dusk', stops: [[0, '#0b1026'], [0.25, '#27355e'], [0.5, '#7a5a8c'], [0.75, '#e08a6d'], [1, '#ffe3c2']] },
  noir: { label: 'Monochrome Noir', stops: [[0, '#000000'], [0.25, '#2b2b2b'], [0.5, '#7d7d7d'], [0.75, '#c9c9c9'], [1, '#ffffff']] },
  miami: { label: 'Miami Pop', stops: [[0, '#0d0221'], [0.25, '#541388'], [0.5, '#ff2e88'], [0.75, '#ffb703'], [1, '#8affff']] },
};

export const LAYOUTS = {
  keyart: { label: 'Key Art', popout: true, panels: 5 },
  mosaic: { label: 'Mosaic 9', popout: false, panels: 9 },
  grid: { label: 'Cover Grid', popout: false, panels: 6 },
  five: { label: 'Five Panel', popout: false, panels: 5 },
  triptych: { label: 'Triptych', popout: false, panels: 3 },
  single: { label: 'Single Hero', popout: true, panels: 1 },
  diptych: { label: 'Split Diptych', popout: false, panels: 2 },
  slanted: { label: 'Slanted', popout: false, panels: 5 },
};

export const TITLE_STYLES = { chrome: 'Chrome 3D', halftone: 'Halftone', flat: 'Flat' };

export const SIZES = {
  square: { label: '1080 × 1080', w: 1080, h: 1080 },
  tall: { label: '1080 × 1350', w: 1080, h: 1350 },
  wide: { label: '1920 × 1080', w: 1920, h: 1080 },
};

/** Fresh default state: five different faces, hero is the neon portrait. */
export function defaultState() {
  return {
    layout: 'keyart',
    grade: 'heatwave',
    titleStyle: 'chrome',
    caption: 'PALMLINE',
    subtitle: 'VICE CITY · LEONIDA',
    quote: '“The most electric poster maker on the strip.”',
    quoteSource: 'VICE CITY WEEKLY',
    vol: 'VOL. 06',
    tagline: 'SIX FACES. ONE CITY. NO WAY OUT.',
    frame: true,
    captionScale: 1,
    captionY: 0,
    captionColor: '#ffffff',
    outline: true,
    size: 'tall',
    slots: ['neon', 'sunset', 'night', 'boulevard', 'golden', 'ultraviolet', 'neon', 'sunset', 'night'].map((id) => ({ sample: id, zoom: 1, dx: 0, dy: 0 })),
  };
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function gradeColor(stops, t) {
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const f = (t - t0) / Math.max(0.0001, t1 - t0);
      const a = hexRgb(c0);
      const b = hexRgb(c1);
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    }
  }
  return hexRgb(stops[stops.length - 1][1]);
}

/** Gradient-map a panel: luminance through the grade stops, with a contrast lift. */
function applyGradeToCanvas(src, gradeKey) {
  const stops = GRADES[gradeKey].stops;
  const ctx = src.getContext('2d');
  const img = ctx.getImageData(0, 0, src.width, src.height);
  const d = img.data;
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = Math.min(1, Math.max(0, ((i / 255) - 0.5) * 1.18 + 0.5));
    const c = gradeColor(stops, t);
    lut[i * 3] = c[0];
    lut[i * 3 + 1] = c[1];
    lut[i * 3 + 2] = c[2];
  }
  for (let i = 0; i < d.length; i += 4) {
    const lum = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
    d[i] = lut[lum * 3];
    d[i + 1] = lut[lum * 3 + 1];
    d[i + 2] = lut[lum * 3 + 2];
  }
  ctx.putImageData(img, 0, 0);
  return src;
}

/** Face-aware cover fit: the sample focus point lands near the panel centre. */
function focusDrawArgs(img, rect, slot, sample) {
  const focus = slot.focusOverride || sample.focus;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const zoom = slot.zoom || 1;
  const scale = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  let ox = rect.x + rect.w / 2 - focus.x * dw + (slot.dx || 0) * rect.w;
  let oy = rect.y + rect.h / 2 - focus.y * dh + (slot.dy || 0) * rect.h;
  ox = Math.min(rect.x, Math.max(rect.x + rect.w - dw, ox));
  oy = Math.min(rect.y, Math.max(rect.y + rect.h - dh, oy));
  return { ox, oy, dw, dh };
}

function drawPanelImage(ctx, img, rect, slot, sample, gradeKey, clipPath, hero) {
  if (hero) {
    // Pop-out hero: the full face must stay visible even in a wide panel, so
    // the panel is filled with a darkened stretched copy of the photo and the
    // face-fit portrait is drawn over it, centred on the focus point.
    const pw = Math.max(2, Math.min(640, Math.round(rect.w)));
    const ph = Math.max(2, Math.round(pw * rect.h / rect.w));
    const bg = document.createElement('canvas');
    bg.width = pw;
    bg.height = ph;
    const bctx = bg.getContext('2d');
    bctx.drawImage(img, 0, 0, pw, ph);
    applyGradeToCanvas(bg, gradeKey);
    ctx.save();
    if (clipPath) clipPath(ctx);
    else { ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip(); }
    ctx.globalAlpha = 0.45;
    ctx.drawImage(bg, rect.x, rect.y, rect.w, rect.h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(12,4,26,0.5)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const zoom = slot.zoom || 1;
    const scale = Math.min(rect.w / iw, rect.h / ih) * zoom;
    const dw = iw * scale;
    const dh = ih * scale;
    const focus = slot.focusOverride || sample.focus;
    let ox = rect.x + rect.w / 2 - focus.x * dw + (slot.dx || 0) * rect.w;
    let oy = rect.y + rect.h / 2 - focus.y * dh + (slot.dy || 0) * rect.h;
    ox = Math.min(rect.x + rect.w - dw, Math.max(rect.x, ox));
    oy = Math.min(rect.y + rect.h - dh, Math.max(rect.y, oy));
    const fg = document.createElement('canvas');
    fg.width = Math.max(2, Math.round(dw * (pw / rect.w)));
    fg.height = Math.max(2, Math.round(dh * (ph / rect.h)));
    const fctx = fg.getContext('2d');
    fctx.drawImage(img, 0, 0, fg.width, fg.height);
    applyGradeToCanvas(fg, gradeKey);
    ctx.drawImage(fg, ox, oy, dw, dh);
    ctx.restore();
    return;
  }
  const args = focusDrawArgs(img, rect, slot, sample);
  const pw = Math.max(2, Math.min(640, Math.round(rect.w)));
  const ph = Math.max(2, Math.round(pw * rect.h / rect.w));
  const off = document.createElement('canvas');
  off.width = pw;
  off.height = ph;
  const octx = off.getContext('2d');
  const sx = (args.ox - rect.x) * (pw / rect.w);
  const sy = (args.oy - rect.y) * (ph / rect.h);
  octx.drawImage(img, sx, sy, args.dw * (pw / rect.w), args.dh * (ph / rect.h));
  applyGradeToCanvas(off, gradeKey);
  ctx.save();
  if (clipPath) clipPath(ctx);
  else { ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip(); }
  ctx.drawImage(off, rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** Panel rectangles for every layout, in fractions of the cover. */
export function layoutPanels(layout, W, H) {
  const zone = { x: 0.04 * W, y: 0.215 * H, w: 0.92 * W, h: 0.565 * H };
  const g = 0.014 * W;
  switch (layout) {
    case 'keyart': {
      if (W > H * 1.3) {
        // Landscape cover: hero on the left, a 2x2 grid of faces on the right.
        const heroW = zone.w * 0.55;
        const gridX = zone.x + heroW + g;
        const gridW = zone.w - heroW - g;
        const cw = (gridW - g) / 2;
        const ch = (zone.h - g) / 2;
        const panels = [{ x: zone.x, y: zone.y, w: heroW, h: zone.h, hero: true }];
        for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) panels.push({ x: gridX + c * (cw + g), y: zone.y + r * (ch + g), w: cw, h: ch });
        return panels;
      }
      const heroH = zone.h * 0.66;
      const rowY = zone.y + heroH + g;
      const rowH = zone.h - heroH - g;
      const rw = (zone.w - 3 * g) / 4;
      const panels = [{ x: zone.x, y: zone.y, w: zone.w, h: heroH, hero: true }];
      for (let i = 0; i < 4; i++) panels.push({ x: zone.x + i * (rw + g), y: rowY, w: rw, h: rowH });
      return panels;
    }
    case 'mosaic': {
      const cw = (zone.w - 2 * g) / 3;
      const ch = (zone.h - 2 * g) / 3;
      const out = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out.push({ x: zone.x + c * (cw + g), y: zone.y + r * (ch + g), w: cw, h: ch });
      return out;
    }
    case 'grid': {
      const cw = (zone.w - 2 * g) / 3;
      const ch = (zone.h - g) / 2;
      const out = [];
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) out.push({ x: zone.x + c * (cw + g), y: zone.y + r * (ch + g), w: cw, h: ch });
      return out;
    }
    case 'five': {
      const cw = (zone.w - 4 * g) / 5;
      return Array.from({ length: 5 }, (_, i) => ({ x: zone.x + i * (cw + g), y: zone.y, w: cw, h: zone.h }));
    }
    case 'triptych': {
      const side = zone.w * 0.26;
      const mid = zone.w - 2 * side - 2 * g;
      return [
        { x: zone.x, y: zone.y, w: side, h: zone.h },
        { x: zone.x + side + g, y: zone.y, w: mid, h: zone.h },
        { x: zone.x + side + mid + 2 * g, y: zone.y, w: side, h: zone.h },
      ];
    }
    case 'single':
      return [{ x: zone.x, y: zone.y, w: zone.w, h: zone.h, hero: true }];
    case 'diptych': {
      const cw = (zone.w - g) / 2;
      return [
        { x: zone.x, y: zone.y, w: cw, h: zone.h },
        { x: zone.x + cw + g, y: zone.y, w: cw, h: zone.h },
      ];
    }
    case 'slanted': {
      const cw = (zone.w - 4 * g) / 5;
      const slant = zone.h * 0.09;
      return Array.from({ length: 5 }, (_, i) => ({ x: zone.x + i * (cw + g), y: zone.y, w: cw, h: zone.h, slant: i % 2 === 0 ? slant : -slant }));
    }
    default:
      return [{ x: zone.x, y: zone.y, w: zone.w, h: zone.h }];
  }
}

function panelClip(ctx, p) {
  ctx.beginPath();
  if (p.slant) {
    ctx.moveTo(p.x, p.y + Math.max(0, p.slant));
    ctx.lineTo(p.x + p.w, p.y + Math.max(0, -p.slant));
    ctx.lineTo(p.x + p.w, p.y + p.h + Math.min(0, -p.slant));
    ctx.lineTo(p.x, p.y + p.h + Math.min(0, p.slant));
    ctx.closePath();
  } else {
    ctx.rect(p.x, p.y, p.w, p.h);
  }
  ctx.clip();
}

function panelStroke(ctx, p, color, width) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  if (p.slant) {
    ctx.moveTo(p.x, p.y + Math.max(0, p.slant));
    ctx.lineTo(p.x + p.w, p.y + Math.max(0, -p.slant));
    ctx.lineTo(p.x + p.w, p.y + p.h + Math.min(0, -p.slant));
    ctx.lineTo(p.x, p.y + p.h + Math.min(0, p.slant));
    ctx.closePath();
  } else {
    ctx.rect(p.x, p.y, p.w, p.h);
  }
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitFont(ctx, text, maxW, startPx, family, weight) {
  let px = startPx;
  ctx.font = `${weight} ${px}px ${family}`;
  while (px > 10 && ctx.measureText(text).width > maxW) {
    px -= 2;
    ctx.font = `${weight} ${px}px ${family}`;
  }
  return px;
}

function drawTitle(ctx, state, W, H) {
  const text = (state.caption || 'PALMLINE').toUpperCase();
  const cy = H * 0.115 + state.captionY * H * 0.02;
  const maxW = W * 0.94;
  const px = fitFont(ctx, text, maxW, H * 0.115 * state.captionScale, '"Bebas Neue", sans-serif', 400);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const grad = ctx.createLinearGradient(0, cy - px * 0.55, 0, cy + px * 0.55);
  grad.addColorStop(0, '#fff7d6');
  grad.addColorStop(0.45, '#f5d76e');
  grad.addColorStop(0.55, '#c98a1b');
  grad.addColorStop(1, '#fff2b0');
  const draw = (fill, stroke, dy) => {
    ctx.font = `400 ${px}px "Bebas Neue", sans-serif`;
    if (stroke) { ctx.lineWidth = Math.max(2, px * 0.06); ctx.strokeStyle = stroke; ctx.strokeText(text, W / 2, cy + dy); }
    ctx.fillStyle = fill;
    ctx.fillText(text, W / 2, cy + dy);
  };
  if (state.titleStyle === 'chrome') {
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = px * 0.12;
    ctx.shadowOffsetY = px * 0.05;
    draw('#3a0a4d', null, px * 0.06);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    draw(grad, '#1c0630', 0);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `400 ${px * 0.92}px "Bebas Neue", sans-serif`;
    ctx.fillText(text, W / 2, cy - px * 0.04);
  } else if (state.titleStyle === 'halftone') {
    const off = document.createElement('canvas');
    off.width = W;
    off.height = Math.ceil(px * 1.6);
    const o = off.getContext('2d');
    o.font = `400 ${px}px "Bebas Neue", sans-serif`;
    o.textAlign = 'center';
    o.textBaseline = 'middle';
    o.fillStyle = grad;
    o.fillText(text, W / 2, off.height / 2);
    o.globalCompositeOperation = 'destination-in';
    const dot = document.createElement('canvas');
    dot.width = 7;
    dot.height = 7;
    const d = dot.getContext('2d');
    d.fillStyle = '#000';
    d.beginPath();
    d.arc(3.5, 3.5, 2.6, 0, Math.PI * 2);
    d.fill();
    o.fillStyle = o.createPattern(dot, 'repeat');
    o.fillRect(0, 0, off.width, off.height);
    if (state.outline) { ctx.lineWidth = Math.max(2, px * 0.05); ctx.strokeStyle = '#1c0630'; ctx.strokeText(text, W / 2, cy); }
    ctx.drawImage(off, 0, cy - off.height / 2);
  } else {
    draw(state.captionColor, state.outline ? '#14042a' : null, 0);
  }
  ctx.restore();
  // Subtitle script line under the title.
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const subPx = fitFont(ctx, state.subtitle, W * 0.8, H * 0.024, '"Oswald", sans-serif', 600);
  ctx.font = `600 ${subPx}px "Oswald", sans-serif`;
  ctx.fillStyle = '#ffe9a8';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 4;
  ctx.fillText('★  ' + state.subtitle + '  ★', W / 2, H * 0.185);
  ctx.restore();
}

function drawSeal(ctx, cx, cy, r, text) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20,4,42,0.82)';
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.strokeStyle = '#f5d76e';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.strokeStyle = 'rgba(245,215,110,0.8)';
  ctx.stroke();
  ctx.fillStyle = '#f5d76e';
  ctx.font = `700 ${r * 0.42}px "Oswald", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', 0, -r * 0.04);
  ctx.font = `600 ${r * 0.19}px "Oswald", sans-serif`;
  const label = text + ' • ';
  const step = (Math.PI * 2) / label.length;
  for (let i = 0; i < label.length; i++) {
    ctx.save();
    ctx.rotate(-Math.PI / 2 + i * step);
    ctx.translate(0, -r * 0.88);
    ctx.fillText(label[i], 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function drawBarcode(ctx, x, y, w, h, seedText) {
  let seed = 7;
  for (const ch of seedText) seed = (seed * 31 + ch.charCodeAt(0)) % 9973;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 14);
  ctx.fillStyle = '#111111';
  let bx = x;
  let n = seed;
  while (bx < x + w - 2) {
    n = (n * 1103515245 + 12345) % 2147483648;
    const bw = 1 + (n % 4) * (w / 220);
    if (n % 3 !== 0) ctx.fillRect(bx, y, bw, h);
    bx += bw + (w / 220);
  }
  ctx.font = `400 ${Math.max(8, h * 0.16)}px "Oswald", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('8 90210 2026 11', x + w / 2, y + h + 10);
  ctx.restore();
}

/** The whole cover. `photos` maps sample id (or custom key) to a loaded image. */
export function renderCover(ctx, W, H, state, photos) {
  // Backdrop: deep violet sky with a radial sunset glow.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1b0533');
  bg.addColorStop(0.5, '#3d0f4d');
  bg.addColorStop(1, '#12041f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.5, H * 0.16, 10, W * 0.5, H * 0.16, W * 0.62);
  glow.addColorStop(0, 'rgba(255,150,60,0.5)');
  glow.addColorStop(0.5, 'rgba(255,60,140,0.22)');
  glow.addColorStop(1, 'rgba(255,60,140,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Panels.
  const panels = layoutPanels(state.layout, W, H);
  const count = LAYOUTS[state.layout].panels;
  panels.forEach((p, i) => {
    const slot = state.slots[i % state.slots.length];
    const sample = SAMPLES.find((s) => s.id === slot.sample) || SAMPLES[0];
    const img = photos[slot.sample] || photos[sample.id];
    if (!img) return;
    let rect = p;
    let shadow = false;
    if (p.hero && LAYOUTS[state.layout].popout) {
      // Pop-out hero: the photo is drawn larger than its frame, breaking out of
      // the panel and overlapping the title zone, with a drop shadow underneath.
      rect = { x: p.x - W * 0.015, y: p.y - H * 0.062, w: p.w + W * 0.03, h: p.h + H * 0.062 };
      shadow = true;
    }
    if (shadow) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = W * 0.03;
      ctx.shadowOffsetY = H * 0.008;
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, W * 0.008);
      ctx.fill();
      ctx.restore();
    }
    drawPanelImage(ctx, img, rect, slot, sample, state.grade, p.slant ? (c) => panelClip(c, rect) : null, !!p.hero);
    panelStroke(ctx, rect, '#f5d76e', Math.max(2, W * 0.004));
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(rect.x, rect.y + rect.h - H * 0.028, rect.w, H * 0.028);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.max(9, H * 0.016)}px "Oswald", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(sample.name + '  ·  ' + sample.role, rect.x + W * 0.01, rect.y + rect.h - H * 0.014);
    ctx.restore();
  });

  // Press quote + stars, top.
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const qPx = fitFont(ctx, state.quote, W * 0.86, H * 0.02, '"Oswald", sans-serif', 400);
  ctx.font = `400 ${qPx}px "Oswald", sans-serif`;
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText(state.quote, W / 2, H * 0.028);
  ctx.font = `400 ${H * 0.016}px "Oswald", sans-serif`;
  ctx.fillStyle = '#f5d76e';
  ctx.fillText('★★★★★   ' + state.quoteSource, W / 2, H * 0.052);
  // VOL number, top right.
  ctx.textAlign = 'right';
  ctx.font = `700 ${H * 0.018}px "Oswald", sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(state.vol, W * 0.97, H * 0.028);
  ctx.restore();

  drawTitle(ctx, state, W, H);

  // Role tags + sub-rows strip.
  const shown = panels.slice(0, Math.min(3, count));
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const rowY = H * 0.815;
  const colW = W * 0.3;
  shown.forEach((p, i) => {
    const slot = state.slots[i % state.slots.length];
    const sample = SAMPLES.find((s) => s.id === slot.sample) || SAMPLES[0];
    const x = W * 0.04 + i * colW;
    ctx.font = `700 ${H * 0.017}px "Oswald", sans-serif`;
    ctx.fillStyle = '#f5d76e';
    ctx.fillText(sample.name + ' — ' + sample.role, x, rowY);
    ctx.font = `400 ${H * 0.015}px "Oswald", sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sample.place + ' · ' + sample.time + ' · ' + sample.hook, x, rowY + H * 0.024);
  });
  ctx.restore();

  // Tagline band.
  ctx.save();
  const bandY = H * 0.862;
  ctx.fillStyle = 'rgba(245,215,110,0.92)';
  ctx.fillRect(0, bandY, W, H * 0.038);
  ctx.fillStyle = '#1c0630';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tPx = fitFont(ctx, state.tagline, W * 0.92, H * 0.024, '"Oswald", sans-serif', 700);
  ctx.font = `700 ${tPx}px "Oswald", sans-serif`;
  ctx.fillText(state.tagline, W / 2, bandY + H * 0.019);
  ctx.restore();

  // Billing block, seal, barcode, COMING SOON.
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `400 ${Math.max(7, H * 0.011)}px "Oswald", sans-serif`;
  const billing = [
    'PALMLINE PICTURES  PRESENTS  A LEONIDA STORY',
    'STARRING LUCIA · MARA · DANTE · RICO · SOFIA · NOVA',
    'MUSIC BY THE VICE BAND  ·  SHOT ON LOCATION IN LEONIDA',
    '© 2026 PALMLINE — A FAN-MADE POSTER. NOT AFFILIATED WITH ROCKSTAR GAMES.',
  ];
  billing.forEach((line, i) => ctx.fillText(line, W * 0.24, H * 0.918 + i * H * 0.014));
  ctx.textAlign = 'right';
  ctx.font = `700 ${H * 0.02}px "Oswald", sans-serif`;
  ctx.fillStyle = '#ffe9a8';
  const sealCx = W * 0.885;
  const sealR = Math.min(W, H) * 0.038;
  ctx.fillText('COMING SOON', sealCx - sealR - W * 0.015, H * 0.945);
  ctx.restore();
  drawSeal(ctx, sealCx, H * 0.955, sealR, 'ORIGINAL COVER ART');
  drawBarcode(ctx, W * 0.04, H * 0.918, W * 0.16, H * 0.022, state.caption);

  // Gold frame.
  if (state.frame) {
    ctx.save();
    ctx.strokeStyle = '#f5d76e';
    ctx.lineWidth = Math.max(3, W * 0.006);
    ctx.strokeRect(W * 0.012, H * 0.008, W * 0.976, H * 0.984);
    ctx.strokeStyle = 'rgba(245,215,110,0.45)';
    ctx.lineWidth = Math.max(1, W * 0.0015);
    ctx.strokeRect(W * 0.024, H * 0.016, W * 0.952, H * 0.968);
    ctx.restore();
  }
  // Vignette.
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

/** Draw the current state onto `canvas` at its own size. */
export function drawCover(canvas, state, photos) {
  const ctx = canvas.getContext('2d');
  renderCover(ctx, canvas.width, canvas.height, state, photos);
}

/** Render an export-size cover offscreen and resolve its PNG blob. */
export function exportCover(state, photos, sizeKey) {
  const size = SIZES[sizeKey];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, state, photos);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
