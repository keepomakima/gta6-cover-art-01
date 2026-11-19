// Heatwave Cover Studio — editor wiring: chips, photo rows, drag-to-pan,
// wheel zoom, uploads, live preview, PNG export and the test API.
// The renderer lives in cover.js; this file only moves state into the
// DOM and the DOM back into state.

import {
  LAYOUTS, GRADES, CAPTION_STYLES, TITLE_POSITIONS, POST_SIZES,
  SAMPLE_SCENES, defaultState, layoutPanels, sizeById,
} from './state.js';
import { paintCoverBase } from './cover.js';

const $ = (id) => document.getElementById(id);

const state = defaultState();
const photos = [null, null, null, null, null];
const uploads = new Map();
let uploadSeq = 0;
let ready = false;
let lastCover = { width: 1920, height: 1080, panels: [], band: null };
let renderQueued = false;
let drag = null;

// Load the five sample scenes, one per panel slot, and check they are
// five different files — no scene may repeat on the default cover.
export async function loadDistinctSamplePhotos() {
  const seen = new Set();
  for (let i = 0; i < SAMPLE_SCENES.length; i++) {
    const img = new Image();
    img.src = 'samples/' + SAMPLE_SCENES[i].file;
    await img.decode();
    photos[i] = img;
    seen.add(img.src);
  }
  if (seen.size !== SAMPLE_SCENES.length) {
    throw new Error('sample scenes are not distinct: ' + seen.size + ' unique of ' + SAMPLE_SCENES.length);
  }
  return photos;
}

function currentSize() {
  return sizeById(state.size);
}

function previewScale(size) {
  return Math.min(1, 1100 / Math.max(size.width, size.height));
}

function renderPreview() {
  const size = currentSize();
  const scale = previewScale(size);
  const W = Math.round(size.width * scale);
  const H = Math.round(size.height * scale);
  const stage = $('stage');
  stage.width = W;
  stage.height = H;
  const cover = paintCoverBase(state, photos, W, H);
  const ctx = stage.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(cover, 0, 0);
  lastCover = { width: W, height: H, ...layoutPanels(state.layout, W, H) };
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderPreview();
  });
}

function setStatus(text) {
  $('status').textContent = text;
}

function buildChips(containerId, items, currentId, onPick) {
  const box = $(containerId);
  box.innerHTML = '';
  for (const item of items) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (item.id === currentId ? ' active' : '');
    chip.textContent = item.name || item.label;
    chip.title = item.blurb || item.name || item.label;
    chip.addEventListener('click', () => {
      onPick(item.id);
      for (const c of box.children) c.classList.remove('active');
      chip.classList.add('active');
    });
    box.appendChild(chip);
  }
}

function buildPhotoRows() {
  const box = $('photoRows');
  box.innerHTML = '';
  state.panels.forEach((panel, i) => {
    const row = document.createElement('div');
    row.className = 'photo-row';
    row.dataset.slot = String(i);

    const tag = document.createElement('span');
    tag.className = 'photo-tag';
    tag.textContent = 'Panel ' + (i + 1);

    const name = document.createElement('span');
    name.className = 'photo-name';
    name.id = 'photoName' + i;
    name.textContent = panel.label;

    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.id = 'photoFile' + i;
    file.setAttribute('aria-label', 'Upload a photo for panel ' + (i + 1));
    file.addEventListener('change', () => {
      if (file.files && file.files[0]) loadUpload(i, file.files[0]);
    });

    const zoom = document.createElement('input');
    zoom.type = 'range';
    zoom.min = '100';
    zoom.max = '400';
    zoom.value = String(Math.round(panel.zoom * 100));
    zoom.id = 'photoZoom' + i;
    zoom.setAttribute('aria-label', 'Zoom panel ' + (i + 1));
    zoom.addEventListener('input', () => {
      state.panels[i].zoom = Number(zoom.value) / 100;
      queueRender();
    });

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'mini-btn';
    reset.textContent = 'Reset';
    reset.addEventListener('click', () => {
      state.panels[i].zoom = 1;
      state.panels[i].panX = 0;
      state.panels[i].panY = 0;
      zoom.value = '100';
      queueRender();
    });

    row.append(tag, name, file, zoom, reset);
    box.appendChild(row);
  });
}

async function loadUpload(slot, file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const id = ++uploadSeq;
    uploads.set(id, img);
    photos[slot] = img;
    state.panels[slot].sample = null;
    state.panels[slot].upload = id;
    state.panels[slot].zoom = 1;
    state.panels[slot].panX = 0;
    state.panels[slot].panY = 0;
    state.panels[slot].label = file.name;
    const nameEl = $('photoName' + slot);
    if (nameEl) nameEl.textContent = file.name;
    const zoomEl = $('photoZoom' + slot);
    if (zoomEl) zoomEl.value = '100';
    queueRender();
    setStatus('Panel ' + (slot + 1) + ' now shows your photo: ' + file.name);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function panelAt(clientX, clientY) {
  const stage = $('stage');
  const rect = stage.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * lastCover.width;
  const y = ((clientY - rect.top) / rect.height) * lastCover.height;
  for (const p of lastCover.panels) {
    if (p.kind !== 'photo') continue;
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) {
      return { panel: p, x, y };
    }
  }
  return null;
}

function bindStage() {
  const stage = $('stage');
  stage.addEventListener('pointerdown', (e) => {
    const hit = panelAt(e.clientX, e.clientY);
    if (!hit) return;
    stage.setPointerCapture(e.pointerId);
    drag = {
      slot: hit.panel.slot,
      startX: e.clientX,
      startY: e.clientY,
      panX: state.panels[hit.panel.slot].panX,
      panY: state.panels[hit.panel.slot].panY,
    };
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const rect = stage.getBoundingClientRect();
    const kx = lastCover.width / rect.width;
    const ky = lastCover.height / rect.height;
    state.panels[drag.slot].panX = drag.panX + (e.clientX - drag.startX) * kx;
    state.panels[drag.slot].panY = drag.panY + (e.clientY - drag.startY) * ky;
    queueRender();
  });
  const endDrag = () => { drag = null; };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('wheel', (e) => {
    const hit = panelAt(e.clientX, e.clientY);
    if (!hit) return;
    e.preventDefault();
    const panel = state.panels[hit.panel.slot];
    panel.zoom = Math.min(4, Math.max(1, panel.zoom * Math.exp(-e.deltaY * 0.0012)));
    const zoomEl = $('photoZoom' + hit.panel.slot);
    if (zoomEl) zoomEl.value = String(Math.round(panel.zoom * 100));
    queueRender();
  }, { passive: false });

  const wrap = $('stageWrap');
  wrap.addEventListener('dragover', (e) => { e.preventDefault(); });
  wrap.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const hit = panelAt(e.clientX, e.clientY);
    loadUpload(hit ? hit.panel.slot : 0, file);
  });
}

// Render a full-resolution cover and return its canvas. An optional
// width/height override renders the same cover smaller (used by tests).
export function renderCover(sizeId, width, height) {
  const size = sizeById(sizeId || state.size);
  const W = width || size.width;
  const H = height || size.height;
  return paintCoverBase(state, photos, W, H);
}

// Export one size as a PNG blob with its exact dimensions.
export async function exportPNG(sizeId) {
  const size = sizeById(sizeId || state.size);
  const canvas = renderCover(size.id);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return { blob, width: size.width, height: size.height, size: size.id };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function exportOne(sizeId) {
  const out = await exportPNG(sizeId);
  downloadBlob(out.blob, 'heatwave-cover-' + out.size + '-' + out.width + 'x' + out.height + '.png');
  setStatus('Exported ' + out.width + ' × ' + out.height + ' PNG.');
  return out;
}

async function exportAll() {
  for (const size of POST_SIZES) {
    await exportOne(size.id);
  }
  setStatus('Exported all 3 sizes.');
}

// Query params drive scenes: ?shot=cover|editor plus layout, grade,
// size, title, style and pos overrides.
function applySceneParams() {
  const q = new URLSearchParams(window.location.search);
  const pick = (key, values, apply) => {
    const v = q.get(key);
    if (v && values.includes(v)) apply(v);
  };
  pick('layout', LAYOUTS.map((l) => l.id), (v) => { state.layout = v; });
  pick('grade', GRADES.map((g) => g.id), (v) => { state.grade = v; });
  pick('size', POST_SIZES.map((s) => s.id), (v) => { state.size = v; });
  pick('style', CAPTION_STYLES.map((s) => s.id), (v) => { state.captionStyle = v; });
  pick('pos', TITLE_POSITIONS.map((p) => p.id), (v) => { state.titlePosition = v; });
  const title = q.get('title');
  if (title) state.title = title.slice(0, 24);
  const subtitle = q.get('subtitle');
  if (subtitle) state.subtitle = subtitle.slice(0, 48);
  if (q.get('shot') === 'cover') document.body.classList.add('shot-cover');
}

function syncInputs() {
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
}

async function init() {
  applySceneParams();
  buildChips('layoutChips', LAYOUTS, state.layout, (id) => {
    state.layout = id;
    queueRender();
    setStatus('Layout: ' + id);
  });
  buildChips('gradeChips', GRADES, state.grade, (id) => {
    state.grade = id;
    queueRender();
    setStatus('Grade: ' + id);
  });
  buildChips('styleChips', CAPTION_STYLES, state.captionStyle, (id) => {
    state.captionStyle = id;
    queueRender();
  });
  buildChips('posChips', TITLE_POSITIONS, state.titlePosition, (id) => {
    state.titlePosition = id;
    queueRender();
  });
  buildChips('sizeChips', POST_SIZES, state.size, (id) => {
    state.size = id;
    queueRender();
  });
  buildPhotoRows();
  syncInputs();
  $('titleInput').addEventListener('input', (e) => {
    state.title = e.target.value;
    queueRender();
  });
  $('subtitleInput').addEventListener('input', (e) => {
    state.subtitle = e.target.value;
    queueRender();
  });
  $('exportBtn').addEventListener('click', () => { exportOne(state.size); });
  $('exportAllBtn').addEventListener('click', () => { exportAll(); });
  bindStage();

  try {
    await document.fonts.load('100px "Bebas Neue"');
  } catch (e) { /* fall back to the system sans */ }
  await loadDistinctSamplePhotos();
  renderPreview();
  ready = true;
  setStatus('Ready — 5 sample photos loaded, one per panel.');
  document.fonts.ready.then(() => { if (ready) renderPreview(); });
  window.addEventListener('resize', queueRender);
}

// Test and automation API: the playtest drives the app through this.
window.__coverApp = {
  get ready() { return ready; },
  get state() { return state; },
  panelPhotos() { return photos.slice(); },
  photosLoaded() { return photos.filter(Boolean).length; },
  setLayout(id) { state.layout = id; queueRender(); },
  setGrade(id) { state.grade = id; queueRender(); },
  setCaptionStyle(id) { state.captionStyle = id; queueRender(); },
  setTitlePosition(id) { state.titlePosition = id; queueRender(); },
  setSize(id) { state.size = id; queueRender(); },
  setTitle(t) { state.title = t; $('titleInput').value = t; queueRender(); },
  setSubtitle(t) { state.subtitle = t; $('subtitleInput').value = t; queueRender(); },
  setPanelCrop(slot, zoom, panX, panY) {
    const p = state.panels[slot];
    if (zoom !== undefined) p.zoom = zoom;
    if (panX !== undefined) p.panX = panX;
    if (panY !== undefined) p.panY = panY;
    queueRender();
  },
  renderCover,
  exportPNG,
  renderPreview,
};

init();
