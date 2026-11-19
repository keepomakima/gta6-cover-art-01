// Wires the editor: photo library, layout/grade/caption controls, per-panel crop
// by dragging on the preview, and PNG export in the three post sizes. Exposes
// window.__coverApp so a headless driver can exercise the real app end to end.
import { SIZES, LAYOUTS, GRADES, defaultState, layoutPanels } from './state.js';
import { drawCover, renderCover } from './cover.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const state = defaultState();
let selectedPanel = 0;
let fontsReady = false;

const $ = (id) => document.getElementById(id);

function setStatus(text) { statusEl.textContent = text; }

/** Redraws the preview canvas at the current post size, scaled by CSS. */
export function redraw() {
  const size = SIZES[state.size];
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, state);
  $('stageLabel').textContent = `Live preview · ${size.label}`;
  $('stageMeta').textContent = `${LAYOUTS[state.layout].label} · ${GRADES[state.grade].label}`;
}

/** Loads an image from a URL and resolves once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function addPhoto(img, name) {
  state.photos.push({ img, name, url: img.src || '' });
  renderPhotoStrip();
  renderPanelList();
  redraw();
}

async function loadSamples() {
  const samples = [
    ['./samples/boulevard.jpg', 'Boulevard'],
    ['./samples/pier.jpg', 'Pier'],
  ];
  for (const [url, name] of samples) {
    if (state.photos.some((p) => p.name === name)) continue;
    try { addPhoto(await loadImage(url), name); } catch (e) { setStatus(`Sample ${name} failed to load.`); }
  }
  setStatus('Sample photos loaded — pick a layout and export.');
}

function renderPhotoStrip() {
  const strip = $('photoStrip');
  strip.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'photo-thumb';
    btn.title = `Use ${photo.name} for the selected panel`;
    const img = document.createElement('img');
    img.src = photo.url || photo.img.src;
    img.alt = photo.name;
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = photo.name;
    btn.append(img, tag);
    btn.addEventListener('click', () => {
      state.panels[selectedPanel] = { ...state.panels[selectedPanel], photo: i };
      renderPanelList();
      redraw();
      setStatus(`${photo.name} placed in panel ${selectedPanel + 1}.`);
    });
    strip.appendChild(btn);
  });
}

function renderChips() {
  const layoutRow = $('layoutRow');
  layoutRow.innerHTML = '';
  for (const [key, def] of Object.entries(LAYOUTS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (state.layout === key ? ' active' : '');
    b.textContent = def.label;
    b.addEventListener('click', () => {
      state.layout = key;
      selectedPanel = 0;
      while (state.panels.length < layoutPanels(state, 100, 100).length) {
        state.panels.push({ photo: state.panels.length % 2, zoom: 1.15, ox: 0, oy: 0 });
      }
      renderChips();
      renderPanelList();
      redraw();
    });
    layoutRow.appendChild(b);
  }
  const gradeRow = $('gradeRow');
  gradeRow.innerHTML = '';
  for (const [key, def] of Object.entries(GRADES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (state.grade === key ? ' active' : '');
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = def.swatch;
    b.append(sw, document.createTextNode(def.label));
    b.addEventListener('click', () => {
      state.grade = key;
      renderChips();
      redraw();
    });
    gradeRow.appendChild(b);
  }
}

function renderPanelList() {
  const list = $('panelList');
  list.innerHTML = '';
  const panels = layoutPanels(state, canvas.width || 1080, canvas.height || 1350);
  panels.forEach((panel, i) => {
    const row = document.createElement('div');
    row.className = 'panel-row' + (selectedPanel === i ? ' selected' : '');
    const name = document.createElement('span');
    name.className = 'pname';
    name.textContent = `${i + 1} · ${panel.name}`;
    const sel = document.createElement('select');
    sel.setAttribute('aria-label', `Photo for panel ${i + 1}`);
    state.photos.forEach((photo, pi) => {
      const opt = document.createElement('option');
      opt.value = String(pi);
      opt.textContent = photo.name;
      if (panel.photo === pi) opt.selected = true;
      sel.appendChild(opt);
    });
    const none = document.createElement('option');
    none.value = '-1';
    none.textContent = 'Empty';
    if (panel.photo == null || panel.photo < 0) none.selected = true;
    sel.appendChild(none);
    sel.addEventListener('change', () => {
      const v = Number(sel.value);
      state.panels[i] = { ...state.panels[i], photo: v < 0 ? null : v };
      redraw();
    });
    const zoom = document.createElement('input');
    zoom.type = 'range';
    zoom.min = '100';
    zoom.max = '250';
    zoom.value = String(Math.round((panel.zoom || 1) * 100));
    zoom.setAttribute('aria-label', `Zoom for panel ${i + 1}`);
    zoom.addEventListener('input', () => {
      state.panels[i] = { ...state.panels[i], zoom: Number(zoom.value) / 100 };
      redraw();
    });
    row.append(name, sel, zoom);
    row.addEventListener('click', (e) => {
      if (e.target === sel || e.target === zoom) return;
      selectedPanel = i;
      renderPanelList();
    });
    list.appendChild(row);
  });
}

/** Which panel (if any) sits under preview point (px, py) in CSS pixels. */
function panelAt(px, py) {
  const rect = canvas.getBoundingClientRect();
  const fx = (px - rect.left) / rect.width;
  const fy = (py - rect.top) / rect.height;
  const panels = layoutPanels(state, 1, 1);
  for (let i = panels.length - 1; i >= 0; i--) {
    const r = panels[i].rect;
    if (fx >= r[0] && fx <= r[0] + r[2] && fy >= r[1] && fy <= r[1] + r[3]) return i;
  }
  return -1;
}

// Drag to pan the photo inside its panel; wheel to zoom it.
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const i = panelAt(e.clientX, e.clientY);
  if (i < 0) return;
  selectedPanel = i;
  renderPanelList();
  drag = { x: e.clientX, y: e.clientY, i };
  canvas.classList.add('dragging');
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const rect = canvas.getBoundingClientRect();
  const p = layoutPanels(state, 1, 1)[drag.i];
  const dx = ((e.clientX - drag.x) / rect.width) / p.rect[2];
  const dy = ((e.clientY - drag.y) / rect.height) / p.rect[3];
  drag.x = e.clientX;
  drag.y = e.clientY;
  const cur = state.panels[drag.i];
  state.panels[drag.i] = {
    ...cur,
    ox: Math.max(-0.6, Math.min(0.6, (cur.ox || 0) + dx)),
    oy: Math.max(-0.6, Math.min(0.6, (cur.oy || 0) + dy)),
  };
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; canvas.classList.remove('dragging'); });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const i = panelAt(e.clientX, e.clientY);
  if (i < 0) return;
  selectedPanel = i;
  const cur = state.panels[i];
  const zoom = Math.max(1, Math.min(2.5, (cur.zoom || 1) * (e.deltaY < 0 ? 1.08 : 0.92)));
  state.panels[i] = { ...cur, zoom };
  renderPanelList();
  redraw();
}, { passive: false });

// Uploads and drag-and-drop.
$('photoInput').addEventListener('change', async (e) => {
  for (const file of e.target.files || []) {
    try { addPhoto(await loadImage(URL.createObjectURL(file)), file.name.replace(/\.[^.]+$/, '').slice(0, 14) || 'Photo'); } catch (err) { setStatus(`Could not load ${file.name}.`); }
  }
  setStatus(`${state.photos.length} photos loaded.`);
});
$('sampleBtn').addEventListener('click', loadSamples);
for (const type of ['dragenter', 'dragover']) {
  document.body.addEventListener(type, (e) => { e.preventDefault(); document.body.classList.add('dragging'); });
}
document.body.addEventListener('dragleave', (e) => { if (e.target === document.body) document.body.classList.remove('dragging'); });
document.body.addEventListener('drop', async (e) => {
  e.preventDefault();
  document.body.classList.remove('dragging');
  for (const file of e.dataTransfer.files || []) {
    if (!file.type.startsWith('image/')) continue;
    try { addPhoto(await loadImage(URL.createObjectURL(file)), file.name.replace(/\.[^.]+$/, '').slice(0, 14) || 'Photo'); } catch (err) { setStatus(`Could not load ${file.name}.`); }
  }
});

// Caption and grade controls.
$('titleInput').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
$('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
$('titleSize').addEventListener('input', (e) => {
  state.titleSize = Number(e.target.value) / 100;
  $('titleSizeVal').textContent = `${e.target.value}%`;
  redraw();
});
$('titlePos').addEventListener('change', (e) => { state.titlePos = e.target.value; redraw(); });
$('outlineColor').addEventListener('change', (e) => { state.outlineColor = e.target.value; redraw(); });
$('titleStyle').addEventListener('change', (e) => { state.titleStyle = e.target.value; redraw(); });
$('gradeStrength').addEventListener('input', (e) => {
  state.gradeStrength = Number(e.target.value) / 100;
  $('gradeStrengthVal').textContent = `${e.target.value}%`;
  redraw();
});
$('sizeSelect').addEventListener('change', (e) => { state.size = e.target.value; redraw(); });

/** Exports the current cover at `sizeKey` and downloads it as a PNG. */
export async function exportPNG(sizeKey) {
  const size = SIZES[sizeKey] || SIZES[state.size];
  const out = renderCover(state, size.w, size.h);
  const url = out.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `vice-cover-${size.w}x${size.h}.png`;
  a.click();
  setStatus(`Exported vice-cover-${size.w}x${size.h}.png`);
  return url;
}

$('exportBtn').addEventListener('click', () => exportPNG(state.size));
document.querySelectorAll('[data-export]').forEach((b) => {
  b.addEventListener('click', () => exportPNG(b.dataset.export));
});
$('exportAll').addEventListener('click', async () => {
  for (const key of Object.keys(SIZES)) {
    // eslint-disable-next-line no-await-in-loop
    await exportPNG(key);
  }
  setStatus('Exported all 3 sizes.');
});

// Deterministic test API for the headless driver (and for ?shot= scenes).
window.__coverApp = {
  state,
  get ready() { return fontsReady && state.photos.length >= 2; },
  async loadSample(i) {
    const urls = ['./samples/boulevard.jpg', './samples/pier.jpg'];
    const names = ['Boulevard', 'Pier'];
    if (state.photos.some((p) => p.name === names[i])) return state.photos.length;
    addPhoto(await loadImage(urls[i]), names[i]);
    return state.photos.length;
  },
  setCaption(title, subtitle) {
    if (title != null) { state.title = title; $('titleInput').value = title; }
    if (subtitle != null) { state.subtitle = subtitle; $('subtitleInput').value = subtitle; }
    redraw();
  },
  setLayout(name) { if (LAYOUTS[name]) { state.layout = name; renderChips(); renderPanelList(); redraw(); } },
  setGrade(name) { if (GRADES[name]) { state.grade = name; renderChips(); redraw(); } },
  setSize(key) { if (SIZES[key]) { state.size = key; $('sizeSelect').value = key; redraw(); } },
  setPanel(i, photo, zoom, ox, oy) {
    const cur = state.panels[i] || { photo: 0, zoom: 1.1, ox: 0, oy: 0 };
    state.panels[i] = {
      photo: photo == null ? cur.photo : photo,
      zoom: zoom == null ? cur.zoom : zoom,
      ox: ox == null ? cur.ox : ox,
      oy: oy == null ? cur.oy : oy,
    };
    renderPanelList();
    redraw();
  },
  async exportPNG(sizeKey) {
    const size = SIZES[sizeKey] || SIZES[state.size];
    return renderCover(state, size.w, size.h).toDataURL('image/png');
  },
};

// Fixed scenes for screenshots: ?shot=cover|editor&layout=..&grade=..&size=..
async function runShot() {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (!shot) return;
  await loadSamples();
  if (q.get('layout')) window.__coverApp.setLayout(q.get('layout'));
  if (q.get('grade')) window.__coverApp.setGrade(q.get('grade'));
  if (q.get('title')) window.__coverApp.setCaption(q.get('title'), q.get('subtitle') ?? state.subtitle);
  if (q.get('size')) window.__coverApp.setSize(q.get('size'));
  document.body.classList.add(`shot-${shot}`);
  if (shot === 'cover') {
    document.querySelector('.topbar').style.display = 'none';
    document.querySelector('.panel.controls').style.display = 'none';
    document.querySelector('.stage-head').style.display = 'none';
    document.querySelector('.stage-foot').style.display = 'none';
    document.querySelector('.app').style.padding = '0';
    canvas.style.height = '100vh';
    canvas.style.width = 'auto';
  }
}

renderChips();
renderPanelList();
redraw();
document.fonts.load('400 100px "Bebas Neue"').then(() => { fontsReady = true; redraw(); }).catch(() => { fontsReady = true; });
loadSamples().then(() => runShot());
