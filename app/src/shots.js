// Fixed scenes for screenshots: ?shot=cover shows the finished cover alone,
// ?shot=editor shows the studio with a sample loaded, ?shot=test renders every
// layout x grade once and reports the count. window.__shotReady is set once painted.
import { SAMPLES, defaultState, drawCover, layoutPanels } from './cover.js';

function setReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
    document.title = 'READY';
  }));
}

function loadAll(state, photos, loadImage) {
  return Promise.all(SAMPLES.map(async (s) => { photos[s.id] = await loadImage(s.file); }));
}

export async function runShot(shot, query, state, photos, ui) {
  const loadImage = async (url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
  const canvas = document.getElementById('cover');
  const size = query.get('size') || 'tall';

  if (shot === 'test') {
    // Headless self-test: every layout x grade must render without throwing.
    let rendered = 0;
    const errors = [];
    for (const layout of Object.keys((await import('./cover.js')).LAYOUTS)) {
      for (const grade of Object.keys((await import('./cover.js')).GRADES)) {
        try {
          state.layout = layout;
          state.grade = grade;
          drawCover(canvas, state, photos);
          rendered++;
        } catch (err) { errors.push(layout + '/' + grade + ': ' + err.message); }
      }
    }
    state.layout = 'keyart';
    state.grade = 'heatwave';
    drawCover(canvas, state, photos);
    const el = document.createElement('div');
    el.id = 'test-result';
    el.textContent = 'rendered=' + rendered + ' errors=' + errors.length + (errors.length ? ' ' + errors.join(';') : '');
    document.body.appendChild(el);
    window.__testResult = el.textContent;
    setReady();
    return;
  }

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const fresh = defaultState();
    Object.assign(state, fresh);
    state.caption = query.get('caption') || 'PALMLINE';
    state.size = size;
    const dims = { tall: [1080, 1350], square: [1080, 1080], wide: [1920, 1080] }[size] || [1080, 1350];
    canvas.width = dims[0];
    canvas.height = dims[1];
    await loadAll(state, photos, loadImage);
    drawCover(canvas, state, photos);
    setReady();
    return;
  }

  // editor: the studio with five faces loaded, Key Art + Heatwave.
  ui.buildControls();
  ui.buildSampleStrip();
  ui.sizeCanvasForLayout();
  await loadAll(state, photos, loadImage);
  ui.redraw();
  ui.syncPanelTools();
  document.getElementById('status').textContent = 'Key Art · Heatwave · 5 faces loaded.';
  setReady();
}
