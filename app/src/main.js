// Palmline — wires the studio: sample strip, per-panel crop (drag + wheel +
// sliders), face-aware focus, uploads and drag-drop, and three-size PNG export.
// A `?shot=` query sets up a fixed scene for screenshots instead (./shots.js).
import { SAMPLES, GRADES, LAYOUTS, TITLE_STYLES, SIZES, defaultState, drawCover, exportCover, layoutPanels } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const state = defaultState();
const photos = {};
const customSamples = [];
let selected = 0;
let dragging = null;

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadSamples() {
  for (const s of SAMPLES) {
    try { photos[s.id] = await loadImage(s.file); } catch { /* keep the slot empty */ }
  }
  for (const s of customSamples) {
    try { photos[s.id] = await loadImage(s.file); } catch { /* ignore */ }
  }
}

function allSamples() { return [...SAMPLES, ...customSamples]; }

function sampleOf(slot) {
  return allSamples().find((s) => s.id === slot.sample) || SAMPLES[0];
}

function redraw() {
  drawCover(canvas, state, photos);
}

function sizeCanvasForLayout() {
  const size = SIZES[state.size];
  canvas.width = 540;
  canvas.height = Math.round(540 * size.h / size.w);
}

function chipRow(el, entries, current, onPick) {
  el.innerHTML = '';
  for (const [key, label] of entries) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (key === current) b.classList.add('on');
    b.addEventListener('click', () => { onPick(key); chipRow(el, entries, key, onPick); redraw(); });
    el.appendChild(b);
  }
}

function buildControls() {
  chipRow(document.getElementById('layouts'), Object.entries(LAYOUTS).map(([k, v]) => [k, v.label]), state.layout, (k) => { state.layout = k; selected = 0; syncPanelTools(); });
  chipRow(document.getElementById('grades'), Object.entries(GRADES).map(([k, v]) => [k, v.label]), state.grade, (k) => { state.grade = k; });
  chipRow(document.getElementById('titleStyles'), Object.entries(TITLE_STYLES), state.titleStyle, (k) => { state.titleStyle = k; });
  const bind = (id, key, parse = (v) => v) => {
    document.getElementById(id).addEventListener('input', (e) => { state[key] = parse(e.target.value); redraw(); });
  };
  bind('caption', 'caption');
  bind('subtitle', 'subtitle');
  bind('quote', 'quote');
  bind('quoteSource', 'quoteSource');
  bind('vol', 'vol');
  bind('tagline', 'tagline');
  bind('captionScale', 'captionScale', Number);
  bind('captionY', 'captionY', Number);
  bind('captionColor', 'captionColor');
  document.getElementById('outline').addEventListener('change', (e) => { state.outline = e.target.checked; redraw(); });
  document.getElementById('frame').addEventListener('change', (e) => { state.frame = e.target.checked; redraw(); });
  document.getElementById('zoom').addEventListener('input', (e) => { currentSlot().zoom = Number(e.target.value); redraw(); });
  document.getElementById('focusX').addEventListener('input', (e) => { setFocus(Number(e.target.value), null); redraw(); });
  document.getElementById('focusY').addEventListener('input', (e) => { setFocus(null, Number(e.target.value)); redraw(); });
  document.getElementById('centreFace').addEventListener('click', () => {
    const slot = currentSlot();
    slot.focusOverride = null;
    slot.dx = 0;
    slot.dy = 0;
    slot.zoom = 1;
    syncPanelTools();
    redraw();
  });
  document.getElementById('upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) await addCustomPhoto(file);
  });
  document.getElementById('exp-square').addEventListener('click', () => doExport('square'));
  document.getElementById('exp-tall').addEventListener('click', () => doExport('tall'));
  document.getElementById('exp-wide').addEventListener('click', () => doExport('wide'));
  document.getElementById('exp-all').addEventListener('click', async () => {
    for (const key of ['square', 'tall', 'wide']) await doExport(key);
  });
}

function currentSlot() { return state.slots[selected]; }

function setFocus(x, y) {
  const slot = currentSlot();
  const base = sampleOf(slot).focus;
  const cur = slot.focusOverride || { ...base };
  if (x !== null) cur.x = x;
  if (y !== null) cur.y = y;
  slot.focusOverride = cur;
  syncPanelTools();
}

function syncPanelTools() {
  const slot = currentSlot();
  const focus = slot.focusOverride || sampleOf(slot).focus;
  document.getElementById('panelNo').textContent = String(selected + 1);
  document.getElementById('zoom').value = slot.zoom;
  document.getElementById('focusX').value = focus.x;
  document.getElementById('focusY').value = focus.y;
  document.querySelectorAll('#samples figure').forEach((f) => {
    f.classList.toggle('sel', f.dataset.id === slot.sample);
  });
}

function buildSampleStrip() {
  const strip = document.getElementById('samples');
  strip.innerHTML = '';
  for (const s of allSamples()) {
    const fig = document.createElement('figure');
    fig.dataset.id = s.id;
    const img = document.createElement('img');
    img.src = s.file;
    img.alt = s.name;
    const cap = document.createElement('figcaption');
    cap.textContent = s.name + ' · ' + s.role;
    fig.append(img, cap);
    fig.addEventListener('click', () => {
      currentSlot().sample = s.id;
      currentSlot().focusOverride = null;
      currentSlot().dx = 0;
      currentSlot().dy = 0;
      syncPanelTools();
      redraw();
    });
    strip.appendChild(fig);
  }
  syncPanelTools();
}

async function addCustomPhoto(file) {
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  const id = 'custom-' + Date.now();
  const sample = { id, file: url, name: file.name.replace(/\.[^.]+$/, '').toUpperCase().slice(0, 12) || 'YOU', role: 'GUEST STAR', place: 'YOUR CITY', time: 'NOW', hook: 'THE NEW FACE', focus: { x: 0.5, y: 0.4 } };
  customSamples.push(sample);
  photos[id] = img;
  currentSlot().sample = id;
  currentSlot().focusOverride = null;
  buildSampleStrip();
  status.textContent = 'Your photo is in panel ' + (selected + 1) + '.';
  redraw();
}

async function doExport(sizeKey) {
  status.textContent = 'Exporting ' + SIZES[sizeKey].label + '…';
  const blob = await exportCover(state, photos, sizeKey);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'palmline-' + sizeKey + '-' + SIZES[sizeKey].w + 'x' + SIZES[sizeKey].h + '.png';
  a.click();
  status.textContent = 'Saved ' + a.download;
}

/** Hit-test the click against the layout panels (canvas coordinates). */
function panelAt(cx, cy) {
  const panels = layoutPanels(state.layout, canvas.width, canvas.height);
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    if (cx >= p.x && cx <= p.x + p.w && cy >= p.y && cy <= p.y + p.h) return i;
  }
  return -1;
}

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
}

canvas.addEventListener('pointerdown', (e) => {
  const pt = canvasPoint(e);
  const hit = panelAt(pt.x, pt.y);
  if (hit >= 0) {
    selected = hit;
    dragging = { x: pt.x, y: pt.y, dx: currentSlot().dx, dy: currentSlot().dy };
    canvas.setPointerCapture(e.pointerId);
    syncPanelTools();
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const pt = canvasPoint(e);
  const panels = layoutPanels(state.layout, canvas.width, canvas.height);
  const p = panels[selected];
  currentSlot().dx = dragging.dx + (pt.x - dragging.x) / p.w;
  currentSlot().dy = dragging.dy + (pt.y - dragging.y) / p.h;
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const slot = currentSlot();
  slot.zoom = Math.min(2.5, Math.max(1, slot.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  syncPanelTools();
  redraw();
}, { passive: false });
canvas.addEventListener('dragover', (e) => e.preventDefault());
canvas.addEventListener('drop', async (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) await addCustomPhoto(file);
});

const params = new URLSearchParams(location.search);
if (params.get('shot')) {
  await document.fonts.ready;
  await loadSamples();
  await runShot(params.get('shot'), params, state, photos, { redraw, sizeCanvasForLayout, buildSampleStrip, buildControls, syncPanelTools });
} else {
  buildControls();
  buildSampleStrip();
  sizeCanvasForLayout();
  await document.fonts.ready;
  await loadSamples();
  redraw();
  status.textContent = 'Six sample faces loaded — pick a layout and export.';
}
