// app/src/cover.js — Key Art Studio's cover renderer.
// Draws the whole poster on a 2D canvas at any size: graded photos in
// layout panels, sky glow, retro-chrome / halftone / flat title, role tags,
// callouts, seal, billing block, gold frame, grain and vignette.
// Pure canvas, no libraries. Everything here is the app's own drawing.

import { layoutById, gradeById } from './state.js';

function hexRgb(s) {
  return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
}

// --- gradient-map grades ----------------------------------------------------
const LUT_CACHE = new Map();
function gradeLut(grade) {
  let lut = LUT_CACHE.get(grade.id);
  if (lut) return lut;
  lut = new Uint8Array(256 * 3);
  const stops = grade.stops.map(([t, s]) => [t, hexRgb(s)]);
  for (let l = 0; l < 256; l++) {
    const t = l / 255;
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i][0] && t <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
    }
    const f = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
    lut[l * 3] = a[1][0] + (b[1][0] - a[1][0]) * f;
    lut[l * 3 + 1] = a[1][1] + (b[1][1] - a[1][1]) * f;
    lut[l * 3 + 2] = a[1][2] + (b[1][2] - a[1][2]) * f;
  }
  LUT_CACHE.set(grade.id, lut);
  return lut;
}

// The source rectangle a crop reads: cover-fit, zoomed around (cx, cy),
// clamped so the photo always covers the panel (no gaps).
function cropRect(img, crop, pw, ph) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const s = Math.max(pw / iw, ph / ih) * crop.zoom;
  const sw = pw / s, sh = ph / s;
  const sx = Math.max(0, Math.min(iw - sw, crop.cx * iw - sw / 2));
  const sy = Math.max(0, Math.min(ih - sh, crop.cy * ih - sh / 2));
  return { sx, sy, sw, sh };
}

const GRADE_CACHE = new Map();
function gradedPhoto(img, grade, crop, pw, ph) {
  const key = `${img.currentSrc || img.src}|${grade.id}|${pw}x${ph}|${crop.zoom.toFixed(3)}|${crop.cx.toFixed(3)}|${crop.cy.toFixed(3)}`;
  const hit = GRADE_CACHE.get(key);
  if (hit) return hit;
  const off = document.createElement('canvas');
  off.width = Math.max(2, pw | 0);
  off.height = Math.max(2, ph | 0);
  const octx = off.getContext('2d');
  const { sx, sy, sw, sh } = cropRect(img, crop, pw, ph);
  octx.drawImage(img, sx, sy, sw, sh, 0, 0, off.width, off.height);
  const lut = gradeLut(grade);
  const id = octx.getImageData(0, 0, off.width, off.height);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
    const li = lum * 3;
    d[i] = d[i] * 0.10 + lut[li] * 0.90;
    d[i + 1] = d[i + 1] * 0.10 + lut[li + 1] * 0.90;
    d[i + 2] = d[i + 2] * 0.10 + lut[li + 2] * 0.90;
  }
  octx.putImageData(id, 0, 0);
  if (GRADE_CACHE.size > 32) GRADE_CACHE.delete(GRADE_CACHE.keys().next().value);
  GRADE_CACHE.set(key, off);
  return off;
}

// --- panel geometry ---------------------------------------------------------
function panelRect(panel, W, H, gutter) {
  const x = panel.x * W + gutter / 2, y = panel.y * H + gutter / 2;
  const w = panel.w * W - gutter, h = panel.h * H - gutter;
  return { x, y, w, h, skew: (panel.skew || 0) * H };
}

function clipPanel(ctx, r) {
  ctx.beginPath();
  if (r.skew) {
    ctx.moveTo(r.x + r.skew, r.y);
    ctx.lineTo(r.x + r.w + r.skew, r.y);
    ctx.lineTo(r.x + r.w, r.y + r.h);
    ctx.lineTo(r.x, r.y + r.h);
  } else {
    ctx.rect(r.x, r.y, r.w, r.h);
  }
  ctx.closePath();
  ctx.clip();
}

function drawPanelPhoto(ctx, img, grade, panelState, r) {
  const pw = Math.max(2, Math.round(r.w + Math.abs(r.skew)));
  const ph = Math.max(2, Math.round(r.h));
  const graded = gradedPhoto(img, grade, panelState.crop, pw, ph);
  ctx.save();
  clipPanel(ctx, r);
  // Shift the graded image so a slanted panel's photo follows its lean.
  ctx.drawImage(graded, r.x - (r.skew > 0 ? r.skew : 0), r.y, r.w + Math.abs(r.skew), r.h);
  ctx.restore();
  // Panel edge: dark seam + faint top highlight, poster-print feel.
  ctx.save();
  clipPanel(ctx, r);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = Math.max(1, r.w * 0.004);
  ctx.stroke();
  ctx.restore();
}

function drawEmptyPanel(ctx, r, label) {
  ctx.save();
  clipPanel(ctx, r);
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  g.addColorStop(0, '#2a1745');
  g.addColorStop(1, '#12081f');
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `${Math.max(12, r.h * 0.09)}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
  ctx.restore();
}

// --- title lettering --------------------------------------------------------
// Titles are painted on a small offscreen canvas first, so the sheen and
// halftone effects clip to the letters themselves.
function fitTitleSize(ctx, text, start, maxW) {
  let size = start;
  ctx.font = `${size}px "Bebas Neue", "Arial Narrow", sans-serif`;
  while (size > 24 && ctx.measureText(text).width > maxW) {
    size *= 0.92;
    ctx.font = `${size}px "Bebas Neue", "Arial Narrow", sans-serif`;
  }
  return size;
}

function paintTitle(text, style, color, size, maxW) {
  const meas = document.createElement('canvas').getContext('2d');
  const px = fitTitleSize(meas, text, size, maxW);
  const tw = Math.ceil(meas.measureText(text).width);
  const th = Math.ceil(px * 1.25);
  const c = document.createElement('canvas');
  c.width = Math.max(2, tw + Math.ceil(px * 0.12));
  c.height = Math.max(2, th + Math.ceil(px * 0.12));
  const x = c.getContext('2d');
  const ox = px * 0.055, oy = px * 0.06; // shadow offset
  x.font = `${px}px "Bebas Neue", "Arial Narrow", sans-serif`;
  x.textBaseline = 'alphabetic';
  const drawAt = (dx, dy) => x.fillText(text, ox + dx, px * 0.98 + dy);
  if (style === 'chrome') {
    // Three stacked shadows, then a banded chrome gradient fill.
    x.fillStyle = '#160a2e';
    drawAt(px * 0.055, px * 0.06);
    x.fillStyle = '#5b1a5e';
    drawAt(px * 0.028, px * 0.032);
    const g = x.createLinearGradient(0, 0, 0, px * 1.1);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.42, '#eef0f7');
    g.addColorStop(0.5, '#9a9ab0');
    g.addColorStop(0.58, '#3c3c56');
    g.addColorStop(0.72, '#ffd166');
    g.addColorStop(0.86, '#fff3c4');
    g.addColorStop(1, '#d8a24a');
    x.fillStyle = g;
    drawAt(0, 0);
    // Sheen: a diagonal light band clipped to the letters.
    x.globalCompositeOperation = 'source-atop';
    const sheen = x.createLinearGradient(0, 0, c.width, c.height);
    sheen.addColorStop(0.28, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.42, 'rgba(255,255,255,0.5)');
    sheen.addColorStop(0.56, 'rgba(255,255,255,0)');
    x.fillStyle = sheen;
    x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'source-over';
  } else if (style === 'halftone') {
    x.fillStyle = '#160a2e';
    drawAt(px * 0.05, px * 0.055);
    // Dot pattern fill.
    const pat = document.createElement('canvas');
    pat.width = 9; pat.height = 9;
    const pctx = pat.getContext('2d');
    pctx.fillStyle = color;
    pctx.beginPath(); pctx.arc(4.5, 4.5, 2.6, 0, 7); pctx.fill();
    x.fillStyle = x.createPattern(pat, 'repeat');
    drawAt(0, 0);
    x.strokeStyle = 'rgba(22,10,46,0.9)';
    x.lineWidth = Math.max(1.5, px * 0.02);
    x.strokeText(text, ox, px * 0.98);
  } else {
    // Flat ink: hard shadow, solid fill, dark keyline.
    x.fillStyle = '#160a2e';
    drawAt(px * 0.045, px * 0.05);
    x.fillStyle = color;
    drawAt(0, 0);
    x.strokeStyle = 'rgba(22,10,46,0.85)';
    x.lineWidth = Math.max(1.5, px * 0.018);
    x.strokeText(text, ox, px * 0.98);
  }
  return { canvas: c, width: tw, height: th, size: px };
}

function starPath(ctx, cx, cy, outer, inner, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawSeal(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(216,180,90,0.95)';
  ctx.fillStyle = 'rgba(216,180,90,0.95)';
  ctx.lineWidth = Math.max(1.5, r * 0.05);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
  ctx.lineWidth = Math.max(1, r * 0.022);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.76, 0, 7); ctx.stroke();
  const text = 'LEONIDA • VICE CITY • 2026 • ';
  ctx.font = `${Math.max(7, r * 0.20)}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const step = (Math.PI * 2) / text.length;
  for (let i = 0; i < text.length; i++) {
    ctx.save();
    ctx.rotate(-Math.PI / 2 + i * step);
    ctx.translate(0, -r * 0.88);
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
  }
  starPath(ctx, 0, 0, r * 0.34, r * 0.15, 5);
  ctx.fill();
  ctx.restore();
}

function drawBillingBlock(ctx, W, H) {
  const h = H * 0.052;
  ctx.fillStyle = 'rgba(8,4,18,0.62)';
  ctx.fillRect(0, H - h, W, h);
  const fs = Math.max(9, H * 0.0135);
  ctx.font = `${fs}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try { ctx.letterSpacing = `${Math.max(1, fs * 0.14)}px`; } catch (e) { /* older canvas */ }
  ctx.fillStyle = 'rgba(255,240,210,0.92)';
  ctx.fillText('LEONIDA PICTURES  •  MARISOL VEGA  •  DANTE RUIZ  •  RICO SANTOS', W / 2, H - h * 0.66);
  ctx.fillStyle = 'rgba(255,240,210,0.75)';
  ctx.fillText('A KEY ART STUDIO POSTER  •  VICE CITY  •  LEONIDA  •  2026', W / 2, H - h * 0.26);
  try { ctx.letterSpacing = '0px'; } catch (e) { /* older canvas */ }
}

function drawRoleTags(ctx, roles, cx, y, W, H) {
  const chipH = Math.max(18, H * 0.034);
  const fs = Math.max(11, chipH * 0.52);
  ctx.font = `${fs}px "Bebas Neue", sans-serif`;
  const gap = Math.max(6, W * 0.008);
  const widths = roles.map((r) => {
    const t = `${r.name}  —  ${r.role}`;
    return { text: t, w: ctx.measureText(t).width + chipH * 1.1 };
  });
  const total = widths.reduce((a, b) => a + b.w, 0) + gap * (widths.length - 1);
  let x = cx - total / 2;
  ctx.textBaseline = 'middle';
  for (const { text, w } of widths) {
    ctx.fillStyle = 'rgba(10,6,20,0.60)';
    ctx.strokeStyle = 'rgba(216,180,90,0.85)';
    ctx.lineWidth = Math.max(1, H * 0.0012);
    roundRect(ctx, x, y, w, chipH, chipH / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.fillText(text, x + w / 2, y + chipH / 2 + 1);
    x += w + gap;
  }
  return chipH;
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

// Callouts: a dot on the art, a SHORT leader line, a label that stays
// inside the hero panel and never crosses the title.
function drawCallouts(ctx, callouts, hero, W, H) {
  const fs = Math.max(11, H * 0.021);
  ctx.font = `${fs}px "Bebas Neue", sans-serif`;
  try { ctx.letterSpacing = `${Math.max(1, fs * 0.12)}px`; } catch (e) { /* older canvas */ }
  for (const c of callouts) {
    const ax = hero.x + c.ax * hero.w, ay = hero.y + c.ay * hero.h;
    const len = Math.max(18, W * 0.032);
    const dir = c.side >= 0 ? 1 : -1;
    const lx = ax + dir * len;
    const tw = ctx.measureText(c.text).width;
    let tx = dir > 0 ? lx + 6 : lx - 6 - tw;
    tx = Math.max(hero.x + 4, Math.min(hero.x + hero.w - tw - 4, tx));
    const ty = ay - fs * 0.4;
    ctx.strokeStyle = 'rgba(255,233,168,0.95)';
    ctx.lineWidth = Math.max(1, H * 0.0016);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(lx, ay);
    ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(ax, ay, Math.max(2, H * 0.003), 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(10,6,20,0.55)';
    ctx.fillRect(tx - 4, ty - fs * 0.75, tw + 8, fs * 1.5);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.text, tx, ty + 1);
  }
  try { ctx.letterSpacing = '0px'; } catch (e) { /* older canvas */ }
}

// --- grain + vignette -------------------------------------------------------
let grainPattern = null;
function getGrain(ctx) {
  if (grainPattern) return grainPattern;
  const n = document.createElement('canvas');
  n.width = 160; n.height = 160;
  const nx = n.getContext('2d');
  const id = nx.createImageData(160, 160);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = Math.random() > 0.5 ? 255 : 0;
    id.data[i] = v; id.data[i + 1] = v; id.data[i + 2] = v;
    id.data[i + 3] = 24;
  }
  nx.putImageData(id, 0, 0);
  grainPattern = ctx.createPattern(n, 'repeat');
  return grainPattern;
}

// --- the cover --------------------------------------------------------------
// photos: [{ img: HTMLImageElement | null, name }] in state.panels[].photo order.
export function renderCover(canvas, state, photos, W, H) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const layout = layoutById(state.layout);
  const grade = gradeById(state.grade);
  const gutter = Math.max(2, Math.round(W * 0.006));

  ctx.fillStyle = '#0b0616';
  ctx.fillRect(0, 0, W, H);

  // 1. Panels.
  const panels = layout.panels();
  const rects = panels.map((p) => panelRect(p, W, H, gutter));
  panels.forEach((p, i) => {
    const ps = state.panels[i] || { photo: 0, crop: { zoom: 1, cx: 0.5, cy: 0.45 } };
    const photo = photos[ps.photo];
    if (photo && photo.img && photo.img.naturalWidth > 0) {
      drawPanelPhoto(ctx, photo.img, grade, ps, rects[i]);
    } else {
      drawEmptyPanel(ctx, rects[i], photo ? photo.name : 'NO PHOTO');
    }
  });

  // 2. Sky glow: warm radial light behind the hero panel's skyline.
  if (state.showGlow) {
    const hero = rects[0];
    ctx.save();
    clipPanel(ctx, hero);
    ctx.globalCompositeOperation = 'screen';
    const gx = hero.x + hero.w * 0.5, gy = hero.y + hero.h * 0.86;
    const gr = Math.max(hero.w, hero.h) * 0.62;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    g.addColorStop(0, 'rgba(255,179,92,0.55)');
    g.addColorStop(0.5, 'rgba(255,110,90,0.22)');
    g.addColorStop(1, 'rgba(255,110,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(hero.x, hero.y, hero.w, hero.h);
    ctx.restore();
  }

  // 3. Gold frame on the layouts that carry one.
  if (state.showFrame && layout.frame) {
    const inset = Math.max(6, W * 0.012);
    ctx.strokeStyle = '#d8b45a';
    ctx.lineWidth = Math.max(2, W * 0.0035);
    ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
    ctx.strokeStyle = 'rgba(255,240,200,0.55)';
    ctx.lineWidth = Math.max(1, W * 0.0012);
    ctx.strokeRect(inset + Math.max(3, W * 0.004), inset + Math.max(3, W * 0.004),
      W - inset * 2 - Math.max(6, W * 0.008), H - inset * 2 - Math.max(6, W * 0.008));
  }

  // 4. Title + subtitle.
  const tz = layout.title;
  const titleX = tz.fx * W, titleW = tz.fw * W;
  const titleTop = tz.fy * H;
  let baseSize = W * 0.135 * state.titleScale;
  // Keep the title + subtitle clear of the billing strip: cap the size
  // by the vertical room left under the title zone.
  const billingH = state.showBilling ? H * 0.052 : 0;
  const availH = H - billingH - H * 0.015 - titleTop;
  const sizeCap = Math.max(24, (availH - 12) / 1.5);
  if (baseSize > sizeCap) baseSize = sizeCap;
  const painted = paintTitle(state.title || 'VICE CITY', state.titleStyle, state.titleColor, baseSize, titleW);
  const tx = tz.align === 'center' ? titleX + (titleW - painted.width) / 2 : titleX;
  ctx.drawImage(painted.canvas, tx, titleTop);
  const titleBottom = titleTop + painted.height;
  // Subtitle, tracked-out Bebas under the title.
  if (state.subtitle) {
    const sfs = Math.max(12, painted.size * 0.30);
    ctx.font = `${sfs}px "Bebas Neue", sans-serif`;
    try { ctx.letterSpacing = `${sfs * 0.34}px`; } catch (e) { /* older canvas */ }
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = tz.align === 'center' ? 'center' : 'left';
    const sx = tz.align === 'center' ? titleX + titleW / 2 : titleX;
    ctx.fillStyle = 'rgba(22,10,46,0.85)';
    ctx.fillText(state.subtitle, sx, titleBottom + sfs * 1.05 + 2);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(state.subtitle, sx, titleBottom + sfs * 1.05);
    try { ctx.letterSpacing = '0px'; } catch (e) { /* older canvas */ }
  }
  const subtitleBottom = titleBottom + Math.max(12, painted.size * 0.30) * 1.1;

  // 5. Role tags: below the title, or above it when the title sits low.
  if (state.showRoles && state.roles.length) {
    const chipH = Math.max(18, H * 0.034);
    const lowTitle = tz.fy > 0.65;
    const tagsY = lowTitle
      ? titleTop - chipH - H * 0.014
      : subtitleBottom + H * 0.012;
    drawRoleTags(ctx, state.roles, titleX + titleW / 2, tagsY, W, H);
  }

  // 6. Callouts in the hero panel's top corners (short leaders, on-canvas).
  if (state.showCallouts && state.callouts.length) {
    drawCallouts(ctx, state.callouts, rects[0], W, H);
  }

  // 7. Seal stamp.
  if (state.showSeal) {
    const r = Math.max(26, W * 0.052);
    drawSeal(ctx, layout.seal.fx * W, layout.seal.fy * H, r);
  }

  // 8. Billing block strip.
  if (state.showBilling) drawBillingBlock(ctx, W, H);

  // 9. Grain + vignette.
  const pat = getGrain(ctx);
  if (pat) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
  vg.addColorStop(0, 'rgba(8,4,16,0)');
  vg.addColorStop(1, 'rgba(8,4,16,0.30)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  return canvas;
}
