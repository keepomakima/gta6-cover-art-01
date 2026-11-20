// app/src/main.js — Key Art Studio's editor: wires the controls to the
// cover renderer, loads photos (samples, upload, drag-drop), crops panels
// per panel (drag + wheel + sliders) and exports PNGs in the post sizes.
// Also serves the ?shot=cover mode the screenshots are taken in.
import { SAMPLE_SCENES, EXPORT_SIZES, LAYOUTS, GRADES, TITLE_STYLES, defaultState, layoutById } from './state.js';
import { renderCover } from './cover.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') === 'cover';

const state = defaultState();
let photos = []; // [{ img, name, kind: 'sample' | 'upload' }]
let selectedPanel = 0;
let previewSize = EXPORT_SIZES.find((s) => s.id === state.size);
let renderQueued = false;

const preview = $('preview');
const pctx = preview.getContext('2d');

// --- photo loading -----------------------------------------------------------
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`cannot load ${src}`));
    img.src = src;
  });
}

async function loadSamples() {
  const loaded = [];
  for (const s of SAMPLE_SCENES) {
    try {
      const img = await loadImage(s.src);
      loaded.push({ img, name: s.label, kind: 'sample' });
    } catch (e) {
      console.warn('sample failed:', s.src);
    }
  }
  return loaded;
}

function addUpload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        photos.push({ img, name: file.name.replace(/\.[^.]+$/, ''), kind: 'upload' });
        resolve(photos.length - 1);
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// --- rendering ---------------------------------------------------------------
function previewDims() {
  // Fit the preview box while keeping the export aspect.
  const box = $('preview-box');
  const bw = Math.max(320, box.clientWidth - 8);
  const bh = Math.max(320, box.clientHeight - 8);
  const scale = Math.min(bw / previewSize.w, bh / previewSize.h, 1);
  return { w: Math.max(2, Math.round(previewSize.w * scale)), h: Math.max(2, Math.round(previewSize.h * scale)) };
}

function renderNow() {
  const { w, h } = previewDims();
  renderCover(preview, state, photos, w, h);
  $('preview').style.aspectRatio = `${previewSize.w} / ${previewSize.h}`;
  updatePanelReadout();
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; renderNow(); });
}

// --- export ------------------------------------------------------------------
function exportCanvas(sizeId) {
  const size = EXPORT_SIZES.find((s) => s.id === sizeId) || EXPORT_SIZES[0];
  const off = document.createElement('canvas');
  renderCover(off, state, photos, size.w, size.h);
  return new Promise((resolve) => off.toBlob((b) => resolve(b), 'image/png'));
}

async function downloadExport(sizeId) {
  const blob = await exportCanvas(sizeId);
  const size = EXPORT_SIZES.find((s) => s.id === sizeId);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `key-art-${state.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'cover'}-${size.w}x${size.h}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return blob;
}

async function exportAll() {
  for (const s of EXPORT_SIZES) await downloadExport(s.id);
}

// --- panel selection + crop --------------------------------------------------
function panelCount() {
  return layoutById(state.layout).panels().length;
}

function updatePanelReadout() {
  const n = panelCount();
  if (selectedPanel >= n) selectedPanel = 0;
  const ps = state.panels[selectedPanel];
  const photo = photos[ps.photo];
  $('panel-label').textContent = `Panel ${selectedPanel + 1} of ${n} — ${photo ? photo.name : 'no photo'}`;
  $('zoom').value = ps.crop.zoom;
  $('zoom-val').textContent = `${ps.crop.zoom.toFixed(2)}×`;
  $('pan-x').value = ps.crop.cx;
  $('pan-y').value = ps.crop.cy;
  document.querySelectorAll('#panel-dots button').forEach((b, i) => {
    b.classList.toggle('active', i === selectedPanel);
    b.disabled = i >= n;
  });
  document.querySelectorAll('#photo-strip .thumb').forEach((t, i) => {
    t.classList.toggle('assigned', photos[ps.photo] === photos[i]);
  });
}

function buildPanelDots() {
  const dots = $('panel-dots');
  dots.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = i + 1;
    b.title = `Select panel ${i + 1}`;
    b.addEventListener('click', () => { selectedPanel = i; queueRender(); });
    dots.appendChild(b);
  }
}

function buildPhotoStrip() {
  const strip = $('photo-strip');
  strip.innerHTML = '';
  photos.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.title = p.name;
    const img = document.createElement('img');
    img.src = p.img.src;
    img.alt = p.name;
    const label = document.createElement('span');
    label.textContent = p.name;
    b.append(img, label);
    b.addEventListener('click', () => {
      state.panels[selectedPanel].photo = i;
      queueRender();
    });
    strip.appendChild(b);
  });
}

function previewPointToPanel(e) {
  const r = preview.getBoundingClientRect();
  const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
  const panels = layoutById(state.layout).panels();
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    if (fx >= p.x && fx < p.x + p.w && fy >= p.y && fy < p.y + p.h) return i;
  }
  return -1;
}

// Drag pans the selected panel's crop; wheel zooms it. Coverage is clamped
// by the renderer's cropRect, so a panel can never show a gap.
let dragging = null;
preview.addEventListener('pointerdown', (e) => {
  const hit = previewPointToPanel(e);
  if (hit >= 0) {
    selectedPanel = hit;
    dragging = { x: e.clientX, y: e.clientY };
    preview.setPointerCapture(e.pointerId);
    queueRender();
  }
});
preview.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const r = preview.getBoundingClientRect();
  const ps = state.panels[selectedPanel];
  const panels = layoutById(state.layout).panels();
  const p = panels[selectedPanel];
  // Dragging the photo moves the focal point the opposite way.
  ps.crop.cx -= ((e.clientX - dragging.x) / r.width) / (p.w * ps.crop.zoom);
  ps.crop.cy -= ((e.clientY - dragging.y) / r.height) / (p.h * ps.crop.zoom);
  ps.crop.cx = Math.max(0, Math.min(1, ps.crop.cx));
  ps.crop.cy = Math.max(0, Math.min(1, ps.crop.cy));
  dragging = { x: e.clientX, y: e.clientY };
  queueRender();
});
preview.addEventListener('pointerup', () => { dragging = null; });
preview.addEventListener('wheel', (e) => {
  e.preventDefault();
  const hit = previewPointToPanel(e);
  if (hit >= 0) selectedPanel = hit;
  const ps = state.panels[selectedPanel];
  ps.crop.zoom = Math.max(1, Math.min(4, ps.crop.zoom * (e.deltaY < 0 ? 1.12 : 0.89)));
  queueRender();
}, { passive: false });

// --- controls ----------------------------------------------------------------
function buildControls() {
  // Layouts.
  const lg = $('layout-grid');
  for (const l of LAYOUTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.layout = l.id;
    b.innerHTML = `<b>${l.name}</b><span>${l.blurb}</span>`;
    b.addEventListener('click', () => {
      state.layout = l.id;
      selectedPanel = 0;
      document.querySelectorAll('#layout-grid .chip').forEach((c) => c.classList.toggle('active', c.dataset.layout === l.id));
      queueRender();
    });
    lg.appendChild(b);
  }
  document.querySelector('#layout-grid .chip').classList.add('active');

  // Grades.
  const gg = $('grade-grid');
  for (const g of GRADES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.dataset.grade = g.id;
    b.title = g.name;
    b.style.background = `linear-gradient(135deg, ${g.swatch.join(', ')})`;
    const s = document.createElement('span');
    s.textContent = g.name;
    b.appendChild(s);
    b.addEventListener('click', () => {
      state.grade = g.id;
      document.querySelectorAll('#grade-grid .swatch').forEach((c) => c.classList.toggle('active', c.dataset.grade === g.id));
      queueRender();
    });
    gg.appendChild(b);
  }
  document.querySelector('#grade-grid .swatch').classList.add('active');

  // Title styles.
  const tg = $('style-grid');
  for (const t of TITLE_STYLES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip small';
    b.dataset.style = t.id;
    b.textContent = t.name;
    b.addEventListener('click', () => {
      state.titleStyle = t.id;
      document.querySelectorAll('#style-grid .chip').forEach((c) => c.classList.toggle('active', c.dataset.style === t.id));
      queueRender();
    });
    tg.appendChild(b);
  }
  document.querySelector('#style-grid .chip').classList.add('active');

  // Text inputs.
  $('title-input').addEventListener('input', (e) => { state.title = e.target.value.toUpperCase(); queueRender(); });
  $('subtitle-input').addEventListener('input', (e) => { state.subtitle = e.target.value.toUpperCase(); queueRender(); });
  $('title-size').addEventListener('input', (e) => { state.titleScale = parseFloat(e.target.value); queueRender(); });
  $('title-color').addEventListener('input', (e) => { state.titleColor = e.target.value; queueRender(); });

  // Poster-detail toggles.
  const toggles = [
    ['toggle-seal', 'showSeal'], ['toggle-billing', 'showBilling'],
    ['toggle-callouts', 'showCallouts'], ['toggle-roles', 'showRoles'],
    ['toggle-frame', 'showFrame'], ['toggle-glow', 'showGlow'],
  ];
  for (const [id, key] of toggles) {
    $(id).addEventListener('change', (e) => { state[key] = e.target.checked; queueRender(); });
  }

  // Role tag editors.
  state.roles.forEach((r, i) => {
    $(`role-name-${i}`).value = r.name;
    $(`role-job-${i}`).value = r.role;
    $(`role-name-${i}`).addEventListener('input', (e) => { state.roles[i].name = e.target.value.toUpperCase(); queueRender(); });
    $(`role-job-${i}`).addEventListener('input', (e) => { state.roles[i].role = e.target.value.toUpperCase(); queueRender(); });
  });

  // Crop sliders.
  $('zoom').addEventListener('input', (e) => { state.panels[selectedPanel].crop.zoom = parseFloat(e.target.value); queueRender(); });
  $('pan-x').addEventListener('input', (e) => { state.panels[selectedPanel].crop.cx = parseFloat(e.target.value); queueRender(); });
  $('pan-y').addEventListener('input', (e) => { state.panels[selectedPanel].crop.cy = parseFloat(e.target.value); queueRender(); });
  $('reset-crop').addEventListener('click', () => {
    state.panels[selectedPanel].crop = { zoom: 1, cx: 0.5, cy: 0.45 };
    queueRender();
  });
  $('fill-all').addEventListener('click', () => {
    const photo = state.panels[selectedPanel].photo;
    for (const p of state.panels) p.photo = photo;
    queueRender();
  });

  // Export size + buttons.
  const sg = $('size-grid');
  for (const s of EXPORT_SIZES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip small';
    b.dataset.size = s.id;
    b.textContent = s.label;
    b.addEventListener('click', () => {
      state.size = s.id;
      previewSize = s;
      document.querySelectorAll('#size-grid .chip').forEach((c) => c.classList.toggle('active', c.dataset.size === s.id));
      queueRender();
    });
    sg.appendChild(b);
  }
  document.querySelector('#size-grid .chip[data-size="wide"]').classList.add('active');
  $('export-one').addEventListener('click', () => downloadExport(state.size));
  $('export-all').addEventListener('click', exportAll);
  $('shuffle').addEventListener('click', () => {
    state.layout = LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)].id;
    state.grade = GRADES[Math.floor(Math.random() * GRADES.length)].id;
    document.querySelectorAll('#layout-grid .chip').forEach((c) => c.classList.toggle('active', c.dataset.layout === state.layout));
    document.querySelectorAll('#grade-grid .swatch').forEach((c) => c.classList.toggle('active', c.dataset.grade === state.grade));
    queueRender();
  });

  // Upload + drag-drop.
  $('upload').addEventListener('change', async (e) => {
    for (const f of e.target.files) {
      const idx = await addUpload(f);
      state.panels[selectedPanel].photo = idx;
    }
    buildPhotoStrip();
    queueRender();
  });
  const dz = $('dropzone');
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', async (e) => {
    e.preventDefault();
    dz.classList.remove('over');
    for (const f of e.dataTransfer.files) {
      if (!f.type.startsWith('image/')) continue;
      const idx = await addUpload(f);
      state.panels[selectedPanel].photo = idx;
    }
    buildPhotoStrip();
    queueRender();
  });
}

// --- shot mode (screenshots) --------------------------------------------------
// ?shot=cover&size=wide&layout=keyart&grade=heatwave&title=VICE%20CITY
// renders one cover full-viewport, no editor chrome.
function applyShotParams() {
  if (params.get('layout')) state.layout = params.get('layout');
  if (params.get('grade')) state.grade = params.get('grade');
  if (params.get('title')) state.title = params.get('title').toUpperCase();
  if (params.get('subtitle')) state.subtitle = params.get('subtitle').toUpperCase();
  if (params.get('titlestyle')) state.titleStyle = params.get('titlestyle');
  if (params.get('size')) {
    const s = EXPORT_SIZES.find((x) => x.id === params.get('size'));
    if (s) { state.size = s.id; previewSize = s; }
  }
  if (params.get('roles') === 'off') state.showRoles = false;
  if (params.get('seal') === 'off') state.showSeal = false;
  if (params.get('billing') === 'off') state.showBilling = false;
  if (params.get('callouts') === 'off') state.showCallouts = false;
  if (params.get('frame') === 'off') state.showFrame = false;
  if (params.get('glow') === 'off') state.showGlow = false;
}

async function bootShot() {
  document.body.classList.add('shot-mode');
  applyShotParams();
  photos = await loadSamples();
  await document.fonts.load('80px "Bebas Neue"');
  await document.fonts.ready;
  const w = window.innerWidth, h = window.innerHeight;
  renderCover(preview, state, photos, w, h);
  preview.style.width = '100vw';
  preview.style.height = '100vh';
  window.__shotReady = true;
}

// --- boot ----------------------------------------------------------------------
async function boot() {
  if (SHOT) return bootShot();
  buildControls();
  buildPanelDots();
  photos = await loadSamples();
  buildPhotoStrip();
  try {
    await document.fonts.load('80px "Bebas Neue"');
    await document.fonts.ready;
  } catch (e) { /* fall back to system sans */ }
  renderNow();
  window.addEventListener('resize', queueRender);
  window.__studioReady = true;
}

// Test / automation API (used by the headless playtest; harmless in the UI).
window.__studio = {
  state,
  get photos() { return photos; },
  render: queueRender,
  setLayout(id) { state.layout = id; queueRender(); },
  setGrade(id) { state.grade = id; queueRender(); },
  setTitle(t) { state.title = t; queueRender(); },
  selectPanel(i) { selectedPanel = i; queueRender(); },
  async exportPng(sizeId) {
    const blob = await exportCanvas(sizeId);
    const buf = await blob.arrayBuffer();
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 8192) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return `data:image/png;base64,${btoa(bin)}`;
  },
  previewSize() { return { w: preview.width, h: preview.height }; },
};

boot();
