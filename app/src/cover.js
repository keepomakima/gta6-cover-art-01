// Renders the cover onto a canvas: painted sunset sky with sun glow and palm
// silhouettes, the multi-panel photo grid with per-panel crop, gradient-map
// colour grades, a halftone title in a title band, and a vignette + frame.
// Pure canvas 2D, no network, no library.
import { GRADES, layoutPanels } from './state.js';

/** Draws one palm silhouette: a leaning trunk and seven drooping fronds. */
export function drawPalm(ctx, x, y, size, lean, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  // Trunk, leaning by `lean` radians, thicker at the base.
  ctx.lineWidth = size * 0.055;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(lean * size * 0.4, -size * 0.55, lean * size, -size);
  ctx.stroke();
  const tx = lean * size;
  const ty = -size;
  // Fronds fan out from the crown and droop: each arc rises from the crown
  // then falls, so the silhouette reads as a palm, not a starburst.
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const theta = -Math.PI + t * Math.PI; // -180..0 degrees, upper half
    const len = size * (0.34 + (i % 2) * 0.08 + (i === 3 ? 0.08 : 0));
    const ex = tx + Math.cos(theta) * len;
    const ey = ty + Math.sin(theta) * len * 0.55 + len * 0.42;
    const cx = tx + Math.cos(theta) * len * 0.6;
    const cy = ty + Math.sin(theta) * len * 0.6 - len * 0.16;
    ctx.lineWidth = size * 0.032;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.stroke();
  }
  // Coconuts.
  ctx.beginPath();
  ctx.arc(tx - size * 0.02, ty + size * 0.03, size * 0.03, 0, Math.PI * 2);
  ctx.arc(tx + size * 0.04, ty + size * 0.04, size * 0.025, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A jagged downtown skyline silhouette along the given baseline. */
export function drawSkyline(ctx, w, baseY, height, color) {
  ctx.fillStyle = color;
  let x = 0;
  let seed = 7;
  const next = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  while (x < w) {
    const bw = w * (0.04 + next() * 0.05);
    const bh = height * (0.35 + next() * 0.65);
    ctx.fillRect(x, baseY - bh, bw, bh);
    if (next() > 0.6) ctx.fillRect(x + bw * 0.3, baseY - bh - height * 0.18, bw * 0.12, height * 0.18);
    x += bw + w * 0.004;
  }
}

/** Paints the sky: vertical gradient, glowing sun disc, skyline, palms at the edges. */
export function drawSky(ctx, grade, w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, grade.sky[0]);
  sky.addColorStop(0.55, grade.sky[1]);
  sky.addColorStop(1, grade.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // Sun with a soft halo, upper third.
  const sx = w * 0.72;
  const sy = h * 0.26;
  const sr = Math.min(w, h) * 0.11;
  const halo = ctx.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 3.2);
  halo.addColorStop(0, grade.sun);
  halo.addColorStop(0.35, grade.sun + '55');
  halo.addColorStop(1, grade.sun + '00');
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.fillStyle = grade.sun;
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fill();
  drawSkyline(ctx, w, h * 0.98, h * 0.1, 'rgba(10, 2, 20, 0.55)');
}

function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

/**
 * Builds the 256-entry lookup for a gradient-map grade: each input luminance
 * (0..255) maps to the colour on the gradient through `stops`.
 */
export function buildGradientMapLookup(stops) {
  const rgb = stops.map(hexToRgb);
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (rgb.length - 1);
    const k = Math.min(rgb.length - 2, Math.floor(t));
    const f = t - k;
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = rgb[k][c] + (rgb[k + 1][c] - rgb[k][c]) * f;
  }
  return lut;
}

/**
 * Gradient-map grade: remaps every pixel's luminance through the grade's
 * gradient stops, blended with the original by `strength`. Applied to the
 * whole cover after the panels are drawn (and before the caption), so the
 * sky, the photos and the frames all share one poster grade.
 */
export function applyGradientMapGrade(ctx, w, h, stops, strength) {
  if (!stops || strength <= 0) return;
  const lut = buildGradientMapLookup(stops);
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  const s = Math.max(0, Math.min(1, strength));
  for (let i = 0; i < d.length; i += 4) {
    const lum = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
    const j = lum * 3;
    d[i] = d[i] + (lut[j] - d[i]) * s;
    d[i + 1] = d[i + 1] + (lut[j + 1] - d[i + 1]) * s;
    d[i + 2] = d[i + 2] + (lut[j + 2] - d[i + 2]) * s;
  }
  ctx.putImageData(image, 0, 0);
}

/** Draws one photo panel, cover-fit with the panel's zoom and pan, grade-filtered. */
export function drawPanel(ctx, panel, photo, grade, strength, x, y, pw, ph) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, pw, ph);
  ctx.clip();
  if (photo && photo.img) {
    const img = photo.img;
    const base = Math.max(pw / img.naturalWidth, ph / img.naturalHeight);
    const scale = base * (panel.zoom || 1);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    let dx = x + (pw - dw) / 2 + (panel.ox || 0) * pw;
    let dy = y + (ph - dh) / 2 + (panel.oy || 0) * ph;
    // Clamp the pan so the photo always covers the whole panel (zoom >= 1
    // guarantees dw >= pw and dh >= ph, so the clamp range is valid).
    dx = Math.min(x, Math.max(x + pw - dw, dx));
    dy = Math.min(y, Math.max(y + ph - dh, dy));
    ctx.filter = grade.filter;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.filter = 'none';
  } else {
    const g = ctx.createLinearGradient(x, y, x + pw, y + ph);
    g.addColorStop(0, '#3a1c5c');
    g.addColorStop(1, '#12081c');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, pw, ph);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `bold ${Math.max(14, pw * 0.07)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+ ADD PHOTO', x + pw / 2, y + ph / 2);
  }
  // Warm wash inside the panel so the grade reads on every photo.
  ctx.globalAlpha = grade.overlay[1] * strength;
  ctx.fillStyle = grade.overlay[0];
  ctx.fillRect(x, y, pw, ph);
  ctx.globalAlpha = 1;
  ctx.restore();
  // Crisp white frame and a soft drop shadow edge.
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = Math.max(2, pw * 0.008);
  ctx.strokeRect(x, y, pw, ph);
}

/**
 * Halftone title: the Bebas Neue title filled white with a thick accent
 * outline, then a dot grid in the accent colour clipped inside the glyphs
 * (dots grow towards the bottom of each letter, like a printed poster).
 * Drawn on an offscreen canvas so the dots never spill outside the letters.
 */
export function renderHalftoneTitle(ctx, title, cx, cy, size, outlineColor, accent) {
  const off = document.createElement('canvas');
  const pad = Math.ceil(size * 0.35);
  off.width = Math.ceil(ctx.measureText(title).width) + pad * 2;
  off.height = Math.ceil(size * 1.5);
  const o = off.getContext('2d');
  o.font = `${size}px "Bebas Neue", sans-serif`;
  try { o.letterSpacing = `${size * 0.05}px`; } catch (e) { /* older canvas */ }
  o.textAlign = 'center';
  o.textBaseline = 'middle';
  o.lineJoin = 'round';
  o.lineWidth = Math.max(2, size * 0.1);
  o.strokeStyle = outlineColor;
  o.strokeText(title, off.width / 2, off.height / 2);
  o.fillStyle = '#ffffff';
  o.fillText(title, off.width / 2, off.height / 2);
  // Dots only where the letters are (source-atop), denser and bigger low.
  o.globalCompositeOperation = 'source-atop';
  const step = Math.max(5, size * 0.085);
  for (let y = off.height * 0.42; y < off.height; y += step) {
    const depth = (y - off.height * 0.42) / (off.height * 0.58);
    for (let x = step / 2; x < off.width; x += step) {
      const r = step * (0.12 + depth * 0.38);
      o.fillStyle = depth > 0.55 ? accent : outlineColor;
      o.beginPath();
      o.arc(x, y, r, 0, Math.PI * 2);
      o.fill();
    }
  }
  ctx.drawImage(off, cx - off.width / 2, cy - off.height / 2);
}

/** The dark band the Key Art title sits in, with an accent stripe on top. */
export function drawTitleBand(ctx, w, h, accent) {
  const bandH = h * 0.17;
  const y = h - bandH;
  const band = ctx.createLinearGradient(0, y, 0, h);
  band.addColorStop(0, 'rgba(10, 2, 20, 0.72)');
  band.addColorStop(1, 'rgba(10, 2, 20, 0.92)');
  ctx.fillStyle = band;
  ctx.fillRect(0, y, w, bandH);
  ctx.fillStyle = accent;
  ctx.fillRect(0, y, w, Math.max(3, h * 0.006));
  return { x: 0, y, w, h: bandH };
}

/** The bold caption: Bebas Neue capitals, in one of four styles, with subtitle beneath. */
export function drawCaption(ctx, state, grade, w, h, heroRect) {
  const title = (state.title || '').trim().toUpperCase();
  const sub = (state.subtitle || '').trim().toUpperCase();
  if (!title && !sub) return;
  const bandH = h * 0.2;
  let cy;
  let band = null;
  if (state.titlePos === 'top') cy = h * 0.06 + bandH * 0.45;
  else if (state.titlePos === 'hero' && heroRect) cy = heroRect.y + heroRect.h * 0.82;
  else if (state.titlePos === 'band') {
    band = drawTitleBand(ctx, w, h, state.outlineColor || grade.accent);
    cy = band.y + band.h * 0.46;
  } else cy = h - bandH * 0.42;

  if (state.titlePos !== 'band') {
    // Darken behind the lettering so it reads over any photo.
    const scrim = ctx.createLinearGradient(0, cy - bandH * 0.55, 0, cy + bandH * 0.6);
    scrim.addColorStop(0, 'rgba(8,2,16,0)');
    scrim.addColorStop(0.5, 'rgba(8,2,16,0.42)');
    scrim.addColorStop(1, 'rgba(8,2,16,0)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, cy - bandH * 0.55, w, bandH * 1.15);
  }

  if (title) {
    let size = Math.min(w, h) * 0.135 * (state.titleSize || 1);
    if (band) size = Math.min(size, band.h * 0.62);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const setFont = () => { ctx.font = `${size}px "Bebas Neue", sans-serif`; try { ctx.letterSpacing = `${size * 0.05}px`; } catch (e) { /* older canvas */ } };
    setFont();
    while (ctx.measureText(title).width > w * 0.92 && size > 10) { size -= 2; setFont(); }
    const ty = cy - (sub ? size * 0.32 : 0);
    const accent = state.outlineColor || grade.accent;
    if (state.titleStyle === 'halftone') {
      renderHalftoneTitle(ctx, title, w / 2, ty, size, accent, grade.accent);
    } else {
      if (state.titleStyle === 'shadow') {
        ctx.shadowColor = 'rgba(0,0,0,0.75)';
        ctx.shadowBlur = size * 0.18;
        ctx.shadowOffsetY = size * 0.06;
      }
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, size * 0.09);
      ctx.strokeStyle = accent;
      ctx.strokeText(title, w / 2, ty);
      ctx.fillStyle = state.titleStyle === 'solid' ? accent : '#ffffff';
      ctx.fillText(title, w / 2, ty);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
    if (sub) {
      const ss = Math.max(12, size * 0.22);
      ctx.font = `bold ${ss}px sans-serif`;
      try { ctx.letterSpacing = `${ss * 0.32}px`; } catch (e) { /* older canvas */ }
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = ss * 0.3;
      ctx.fillText(sub, w / 2, ty + size * 0.62);
      ctx.shadowBlur = 0;
    }
  } else if (sub) {
    const ss = Math.max(14, Math.min(w, h) * 0.03);
    ctx.font = `bold ${ss}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sub, w / 2, cy);
  }
}

/**
 * Shared cover pipeline: sky, panels, gradient-map grade, palm framing,
 * caption, vignette and outer frame. `chrome` picks the layout-specific
 * extras: Key Art gets its title band via the caption position, Mosaic gets
 * hairline gutters and an accent frame on its centre tile.
 */
export function paintCoverBase(canvas, state, chrome) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const grade = GRADES[state.grade] || GRADES.heatwave;
  const strength = state.gradeStrength == null ? 0.75 : state.gradeStrength;
  drawSky(ctx, grade, w, h);

  const panels = layoutPanels(state, w, h);
  const gap = chrome === 'mosaic' ? Math.max(2, Math.min(w, h) * 0.004) : Math.max(4, Math.min(w, h) * 0.008);
  let heroRect = null;
  for (const p of panels) {
    const x = p.rect[0] * w + gap / 2;
    const y = p.rect[1] * h + gap / 2;
    const pw = p.rect[2] * w - gap;
    const ph = p.rect[3] * h - gap;
    if (p.hero) heroRect = { x, y, w: pw, h: ph };
    const photo = state.photos[p.photo] || null;
    drawPanel(ctx, p, photo, grade, strength, x, y, pw, ph);
  }

  // Gradient-map grades remap the whole painted cover at once.
  if (grade.map) applyGradientMapGrade(ctx, w, h, grade.map, strength);

  if (chrome === 'mosaic' && heroRect) {
    // Accent frame on the centre tile so the 3x3 grid has a focal point.
    ctx.strokeStyle = grade.accent;
    ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.008);
    ctx.strokeRect(heroRect.x, heroRect.y, heroRect.w, heroRect.h);
  } else {
    // Palm silhouettes framing the cover, drawn over the panels.
    const palm = Math.min(w, h) * 0.2;
    ctx.globalAlpha = 0.88;
    drawPalm(ctx, w * 0.015, h * 1.0, palm * 1.1, 0.22, '#0a0214');
    drawPalm(ctx, w * 0.985, h * 1.0, palm, -0.24, '#0a0214');
    ctx.globalAlpha = 1;
  }

  drawCaption(ctx, state, grade, w, h, heroRect);

  // Vignette + outer frame.
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.006);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  return heroRect;
}

/**
 * Key Art layout: one dominant hero panel, three stacked scenes beside it,
 * and the halftone title in a band across the bottom — the poster's key art.
 */
export function drawKeyArtLayout(canvas, state) {
  return paintCoverBase(canvas, state, 'keyart');
}

/** Mosaic layout: nine tiles in a 3x3 grid, centre tile framed in the grade accent. */
export function drawMosaicLayout(canvas, state) {
  return paintCoverBase(canvas, state, 'mosaic');
}

/** Every other layout goes through the same pipeline with standard chrome. */
export function drawStandardCover(canvas, state) {
  return paintCoverBase(canvas, state, 'standard');
}

/** Renders the whole cover for `state` onto `canvas` at its own pixel size. */
export function drawCover(canvas, state) {
  if (state.layout === 'keyart') return drawKeyArtLayout(canvas, state);
  if (state.layout === 'mosaic') return drawMosaicLayout(canvas, state);
  return drawStandardCover(canvas, state);
}

/** Renders the cover at an arbitrary size and returns the fresh canvas. */
export function renderCover(state, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawCover(canvas, state);
  return canvas;
}
