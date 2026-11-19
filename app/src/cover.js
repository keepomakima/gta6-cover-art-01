// Heatwave Cover Studio — canvas rendering pipeline.
// Paints a cover in one deterministic pass: sky, panels, gradient-map
// grade, palms and frames, caption, vignette. Nothing here touches the
// DOM except for creating offscreen canvases; every random-looking
// detail comes from a seeded generator so the same state always paints
// the same bytes.

import { gradeById, layoutPanels } from './state.js';

// Small deterministic generator: the same seed always yields the same
// skyline, clouds and palms, so exports are reproducible.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// A 256-entry lookup table for a gradient-map grade: each stop is
// [position 0..1, '#rrggbb']; luminance 0..255 indexes into it.
export function buildGradientMapLookup(stops) {
  const table = new Uint8Array(256 * 3);
  const points = stops.map(([at, hex]) => ({ at, rgb: hexToRgb(hex) }));
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = points[0];
    let b = points[points.length - 1];
    for (let k = 0; k < points.length - 1; k++) {
      if (t >= points[k].at && t <= points[k + 1].at) { a = points[k]; b = points[k + 1]; break; }
    }
    const span = Math.max(1e-6, b.at - a.at);
    const f = Math.min(1, Math.max(0, (t - a.at) / span));
    table[i * 3] = Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * f);
    table[i * 3 + 1] = Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * f);
    table[i * 3 + 2] = Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * f);
  }
  return table;
}

// Remap every pixel of the whole canvas through the grade's gradient:
// dark stays dark, bright stays bright, the hue comes from the stops.
export function applyGradientMapGrade(ctx, W, H, stops) {
  const lookup = buildGradientMapLookup(stops);
  const image = ctx.getImageData(0, 0, W, H);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
    const base = lum * 3;
    data[i] = lookup[base];
    data[i + 1] = lookup[base + 1];
    data[i + 2] = lookup[base + 2];
  }
  ctx.putImageData(image, 0, 0);
}

// The Vice City sky: a three-stop vertical gradient, a glowing sun and
// a few soft drifting clouds. Drawn over the full cover first so it
// shows through the gaps between panels.
export function drawSky(ctx, W, H, grade) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, grade.sky[0]);
  sky.addColorStop(0.55, grade.sky[1]);
  sky.addColorStop(1, grade.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const sunX = W * 0.72;
  const sunY = H * 0.3;
  const sunR = H * 0.17;
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.1, sunX, sunY, sunR * 2.4);
  glow.addColorStop(0, grade.sun);
  glow.addColorStop(0.35, grade.sun + '55');
  glow.addColorStop(1, grade.sun + '00');
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - sunR * 2.4, sunY - sunR * 2.4, sunR * 4.8, sunR * 4.8);
  ctx.globalAlpha = 1;
  ctx.fillStyle = grade.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  const rand = mulberry32(20261119);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i++) {
    const cx = rand() * W;
    const cy = rand() * H * 0.45;
    const cw = W * (0.09 + rand() * 0.12);
    const ch = H * (0.015 + rand() * 0.02);
    ctx.globalAlpha = 0.08 + rand() * 0.09;
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw, ch, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// A dark building skyline with lit windows, fitted into (x, y, w, h).
// The seed picks the building widths and which windows are lit.
export function drawSkyline(ctx, x, y, w, h, seed) {
  const rand = mulberry32(seed);
  ctx.fillStyle = '#150829';
  let bx = x;
  while (bx < x + w) {
    const bw = w * (0.05 + rand() * 0.09);
    const bh = h * (0.35 + rand() * 0.6);
    ctx.fillRect(bx, y + h - bh, bw, bh);
    if (rand() < 0.4) {
      ctx.fillRect(bx + bw * 0.3, y + h - bh - h * 0.08, bw * 0.4, h * 0.08);
    }
    const cols = Math.max(1, Math.floor(bw / (w * 0.018)));
    const rows = Math.max(1, Math.floor(bh / (h * 0.09)));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rand() < 0.34) {
          ctx.fillStyle = rand() < 0.75 ? '#ffd76a' : '#19c3e6';
          ctx.globalAlpha = 0.55 + rand() * 0.4;
          ctx.fillRect(
            bx + (c + 0.25) * (bw / cols),
            y + h - bh + (r + 0.25) * (bh / rows),
            bw / cols * 0.5, bh / rows * 0.45,
          );
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#150829';
        }
      }
    }
    bx += bw + w * 0.008;
  }
}

// One palm silhouette: a leaning trunk and seven fronds that rise from
// the crown and then droop. (x, y) is the base of the trunk, s its
// height in pixels, lean bends it left (negative) or right.
export function drawPalm(ctx, x, y, s, lean, color) {
  const ink = color || '#12061f';
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineCap = 'round';
  const topX = x + lean * s;
  const topY = y - s;
  ctx.lineWidth = Math.max(2, s * 0.045);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * s * 0.3, y - s * 0.55, topX, topY);
  ctx.stroke();
  const fronds = 7;
  for (let i = 0; i < fronds; i++) {
    const ang = (-Math.PI * 0.92) + (i / (fronds - 1)) * Math.PI * 0.84;
    const len = s * (0.5 + (i % 3) * 0.07);
    const tipX = topX + Math.cos(ang) * len;
    const tipY = topY + Math.sin(ang) * len * 0.55 + len * 0.34;
    const midX = topX + Math.cos(ang) * len * 0.55;
    const midY = topY + Math.sin(ang) * len * 0.5 - len * 0.12;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(midX, midY, tipX, tipY);
    ctx.quadraticCurveTo(midX + (tipX - midX) * 0.12, midY + s * 0.035, topX, topY);
    ctx.fill();
  }
  ctx.restore();
}

// Cover-fit one photo into a panel rect, with zoom and pan. The pan is
// clamped so the photo always covers the panel: no background can ever
// show through, however far the user drags. Returns the clamped pan so
// callers (and tests) can read back what was actually used.
export function drawPanel(ctx, panelRect, image, crop, grade) {
  const { x, y, w, h } = panelRect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (!image) {
    const fill = ctx.createLinearGradient(x, y, x + w, y + h);
    fill.addColorStop(0, grade.sky[1]);
    fill.addColorStop(1, grade.sky[2]);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    return { panX: 0, panY: 0 };
  }
  const zoom = Math.min(4, Math.max(1, crop.zoom || 1));
  const base = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const scale = base * zoom;
  const dw = image.naturalWidth * scale;
  const dh = image.naturalHeight * scale;
  const maxPanX = Math.max(0, (dw - w) / 2);
  const maxPanY = Math.max(0, (dh - h) / 2);
  const panX = Math.min(maxPanX, Math.max(-maxPanX, crop.panX || 0));
  const panY = Math.min(maxPanY, Math.max(-maxPanY, crop.panY || 0));
  if (grade.filter) ctx.filter = grade.filter;
  ctx.drawImage(image, x + (w - dw) / 2 + panX, y + (h - dh) / 2 + panY, dw, dh);
  ctx.filter = 'none';
  if (grade.tint) {
    const tint = ctx.createLinearGradient(x, y, x + w, y + h);
    tint.addColorStop(0, grade.tint[0]);
    tint.addColorStop(1, grade.tint[1]);
    ctx.globalCompositeOperation = grade.tintMode;
    ctx.globalAlpha = grade.tintAlpha;
    ctx.fillStyle = tint;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  return { panX, panY };
}

// A white poster frame around a panel, drawn after the grade so it
// stays white even under a gradient-map grade.
export function drawPanelFrame(ctx, panelRect) {
  const lw = Math.max(3, Math.round(Math.min(panelRect.w, panelRect.h) * 0.012));
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = lw;
  ctx.strokeRect(
    panelRect.x + lw / 2, panelRect.y + lw / 2,
    panelRect.w - lw, panelRect.h - lw,
  );
  ctx.strokeStyle = 'rgba(10, 4, 20, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(panelRect.x + lw, panelRect.y + lw, panelRect.w - 2 * lw, panelRect.h - 2 * lw);
  ctx.restore();
}

// The mosaic centre tile's accent frame: a double border in the grade's
// hot pink and gold.
export function drawAccentFrame(ctx, panelRect) {
  ctx.save();
  ctx.strokeStyle = '#ff2e88';
  ctx.lineWidth = Math.max(4, Math.round(panelRect.w * 0.02));
  ctx.strokeRect(panelRect.x + 6, panelRect.y + 6, panelRect.w - 12, panelRect.h - 12);
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = Math.max(2, Math.round(panelRect.w * 0.008));
  ctx.strokeRect(panelRect.x + 16, panelRect.y + 16, panelRect.w - 32, panelRect.h - 32);
  ctx.restore();
}

// Halftone title: the text is drawn solid on an offscreen canvas, then
// re-drawn as a grid of dots whose size follows the glyph's coverage.
// Big dots carry the letterforms; the gaps keep the photo visible.
// x is the centre of the title, or its left edge when align is 'left'.
export function renderHalftoneTitle(ctx, text, x, cy, maxWidth, fontPx, color, align) {
  const pad = Math.ceil(fontPx * 0.3);
  const off = document.createElement('canvas');
  off.width = Math.max(2, Math.ceil(maxWidth) + pad * 2);
  off.height = Math.ceil(fontPx * 1.5) + pad * 2;
  const octx = off.getContext('2d');
  octx.font = fontPx + 'px "Bebas Neue", "Arial Narrow", sans-serif';
  octx.textAlign = align === 'left' ? 'left' : 'center';
  octx.textBaseline = 'middle';
  octx.fillStyle = '#ffffff';
  octx.fillText(text, align === 'left' ? pad : off.width / 2, off.height / 2);
  const data = octx.getImageData(0, 0, off.width, off.height).data;
  const step = Math.max(5, Math.round(fontPx / 13));
  const ox = align === 'left' ? x : x - off.width / 2;
  const oy = cy - off.height / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 4, 20, 0.45)';
  for (let gy = step / 2; gy < off.height; gy += step) {
    for (let gx = step / 2; gx < off.width; gx += step) {
      const a = data[(Math.floor(gy) * off.width + Math.floor(gx)) * 4 + 3];
      if (a < 24) continue;
      const r = (step / 2) * Math.sqrt(a / 255);
      ctx.beginPath();
      ctx.arc(ox + gx + 2, oy + gy + 3, Math.max(0.6, r), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = color;
  for (let gy = step / 2; gy < off.height; gy += step) {
    for (let gx = step / 2; gx < off.width; gx += step) {
      const a = data[(Math.floor(gy) * off.width + Math.floor(gx)) * 4 + 3];
      if (a < 24) continue;
      const r = (step / 2) * Math.sqrt(a / 255);
      ctx.beginPath();
      ctx.arc(ox + gx, oy + gy, Math.max(0.6, r), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Pick a title size that fits maxWidth, then draw it in the given style.
// x is the centre of the title, or its left edge when align is 'left'.
export function drawTitleText(ctx, text, x, cy, maxWidth, fontPx, style, align) {
  ctx.save();
  ctx.textAlign = align === 'left' ? 'left' : 'center';
  ctx.textBaseline = 'middle';
  let px = fontPx;
  ctx.font = px + 'px "Bebas Neue", "Arial Narrow", sans-serif';
  while (px > 24 && ctx.measureText(text).width > maxWidth) {
    px = Math.floor(px * 0.94);
    ctx.font = px + 'px "Bebas Neue", "Arial Narrow", sans-serif';
  }
  if (style === 'halftone') {
    renderHalftoneTitle(ctx, text, x, cy, maxWidth, px, '#ffffff', align);
    ctx.restore();
    return px;
  }
  if (style === 'shadow') {
    ctx.fillStyle = 'rgba(10, 4, 20, 0.65)';
    ctx.fillText(text, x + px * 0.05, cy + px * 0.07);
  }
  if (style === 'outline') {
    ctx.lineWidth = Math.max(2, px * 0.09);
    ctx.strokeStyle = '#ffffff';
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, cy);
    ctx.fillStyle = '#1a0b2e';
    ctx.fillText(text, x, cy);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, cy);
  }
  ctx.restore();
  return px;
}

// The title band: a dark strip with a hot gradient top edge, the title
// on the left and the subtitle on the right.
export function drawTitleBand(ctx, band, state) {
  ctx.save();
  ctx.fillStyle = 'rgba(13, 5, 24, 0.92)';
  ctx.fillRect(band.x, band.y, band.w, band.h);
  const edge = ctx.createLinearGradient(band.x, 0, band.x + band.w, 0);
  edge.addColorStop(0, '#ff2e88');
  edge.addColorStop(0.5, '#ff7a3c');
  edge.addColorStop(1, '#ffd76a');
  ctx.fillStyle = edge;
  ctx.fillRect(band.x, band.y, band.w, Math.max(3, band.h * 0.05));
  const titlePx = Math.min(band.w * 0.2, band.h * 0.58);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const title = (state.title || 'VICE CITY').toUpperCase();
  drawTitleText(ctx, title, band.x + band.w * 0.02, band.y + band.h * 0.52, band.w * 0.55, titlePx, state.captionStyle, 'left');
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  try { ctx.letterSpacing = Math.max(1, band.h * 0.03) + 'px'; } catch (e) { /* older canvas */ }
  ctx.font = Math.max(10, band.h * 0.2) + 'px "Bebas Neue", "Arial Narrow", sans-serif';
  ctx.fillStyle = '#ffd76a';
  ctx.fillText((state.subtitle || '').toUpperCase(), band.x + band.w * 0.98, band.y + band.h * 0.55);
  try { ctx.letterSpacing = '0px'; } catch (e) { /* older canvas */ }
  ctx.restore();
}

// The caption over the cover (top, centre or bottom): title plus a
// letter-spaced subtitle beneath it, with a soft dark scrim so the
// lettering reads on any photo.
export function drawCaption(ctx, state, W, H) {
  const pos = state.titlePosition;
  const { panels, band } = layoutPanels(state.layout, W, H);
  void panels;
  if (pos === 'band') {
    const rect = band || { x: 0, y: Math.round(H * 0.84), w: W, h: Math.round(H * 0.16) };
    drawTitleBand(ctx, rect, state);
    return;
  }
  const cy = pos === 'top' ? H * 0.13 : pos === 'center' ? H * 0.5 : H * 0.87;
  const title = (state.title || 'VICE CITY').toUpperCase();
  const subtitle = (state.subtitle || '').toUpperCase();
  ctx.save();
  const scrim = ctx.createLinearGradient(0, cy - H * 0.12, 0, cy + H * 0.12);
  scrim.addColorStop(0, 'rgba(10, 4, 20, 0)');
  scrim.addColorStop(0.5, 'rgba(10, 4, 20, 0.5)');
  scrim.addColorStop(1, 'rgba(10, 4, 20, 0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, cy - H * 0.12, W, H * 0.24);
  ctx.restore();
  const titlePx = drawTitleText(ctx, title, W / 2, cy - H * 0.015, W * 0.92, W * 0.15, state.captionStyle);
  if (subtitle) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    try { ctx.letterSpacing = Math.max(2, W * 0.006) + 'px'; } catch (e) { /* older canvas */ }
    ctx.font = Math.max(12, titlePx * 0.24) + 'px "Bebas Neue", "Arial Narrow", sans-serif';
    ctx.fillStyle = '#ffd76a';
    ctx.fillText(subtitle, W / 2, cy + titlePx * 0.62);
    ctx.restore();
  }
}

// Key Art: the hero photo on the left, three stacked photos on the
// right, and the title band underneath. A skyline strip and two palms
// frame the band's top edge.
export function drawKeyArtLayout(ctx, state, photos, W, H, panels, band, grade) {
  for (const p of panels) {
    if (p.kind !== 'photo') continue;
    drawPanel(ctx, p, photos[p.slot], state.panels[p.slot], grade);
  }
  if (band) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(band.x, band.y, band.w, band.h);
    ctx.clip();
    drawSkyline(ctx, band.x, band.y + band.h * 0.45, band.w, band.h * 0.55, 77);
    ctx.restore();
  }
}

// Mosaic: photo tiles plus art tiles — sky, skyline and palms where no
// photo sits, and a sun over the accent centre tile.
export function drawMosaicLayout(ctx, state, photos, W, H, panels, grade) {
  for (const p of panels) {
    if (p.kind === 'photo') {
      drawPanel(ctx, p, photos[p.slot], state.panels[p.slot], grade);
      continue;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(p.x, p.y, p.w, p.h);
    ctx.clip();
    const tileSky = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
    tileSky.addColorStop(0, grade.sky[0]);
    tileSky.addColorStop(0.55, grade.sky[1]);
    tileSky.addColorStop(1, grade.sky[2]);
    ctx.fillStyle = tileSky;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    drawSkyline(ctx, p.x, p.y + p.h * 0.62, p.w, p.h * 0.38, 41 + p.x);
    if (p.role === 'accent') {
      ctx.fillStyle = grade.sun;
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2, p.y + p.h * 0.42, p.h * 0.2, 0, Math.PI * 2);
      ctx.fill();
      drawPalm(ctx, p.x + p.w * 0.16, p.y + p.h, p.h * 0.62, -0.12, '#12061f');
      drawPalm(ctx, p.x + p.w * 0.86, p.y + p.h, p.h * 0.55, 0.12, '#12061f');
    } else {
      drawPalm(ctx, p.x + p.w * 0.12, p.y + p.h, p.h * 0.6, -0.1, '#12061f');
    }
    ctx.restore();
  }
}

// Every layout except Key Art and Mosaic: just its photo panels.
export function drawStandardCover(ctx, state, photos, W, H, panels, grade) {
  for (const p of panels) {
    if (p.kind !== 'photo') continue;
    drawPanel(ctx, p, photos[p.slot], state.panels[p.slot], grade);
  }
}

// The whole cover, in order: sky, panels, gradient-map grade, palms
// and frames, caption, vignette. Returns the finished canvas.
export function paintCoverBase(state, photos, W, H) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const grade = gradeById(state.grade);
  const { panels, band } = layoutPanels(state.layout, W, H);

  drawSky(ctx, W, H, grade);
  if (state.layout === 'key-art') {
    drawKeyArtLayout(ctx, state, photos, W, H, panels, band, grade);
  } else if (state.layout === 'mosaic') {
    drawMosaicLayout(ctx, state, photos, W, H, panels, grade);
  } else {
    drawStandardCover(ctx, state, photos, W, H, panels, grade);
  }

  if (grade.kind === 'gradient-map') {
    applyGradientMapGrade(ctx, W, H, grade.stops);
  }

  for (const p of panels) {
    if (p.kind === 'photo') drawPanelFrame(ctx, p);
    if (p.kind === 'art' && p.role === 'accent') drawAccentFrame(ctx, p);
  }

  // Foreground palms frame the bottom corners of the cover.
  const palmH = H * 0.3;
  drawPalm(ctx, W * 0.015, H * 1.0, palmH, -0.14, '#0d0518');
  drawPalm(ctx, W * 0.985, H * 1.0, palmH * 0.86, 0.14, '#0d0518');

  drawCaption(ctx, state, W, H);

  const vignette = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.42,
    W / 2, H / 2, Math.max(W, H) * 0.75,
  );
  vignette.addColorStop(0, 'rgba(10, 4, 20, 0)');
  vignette.addColorStop(1, 'rgba(10, 4, 20, 0.42)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  return canvas;
}
