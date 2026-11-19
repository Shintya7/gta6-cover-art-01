// Wires the page: pick a layout, fill the panels with photos, write the
// caption, export the cover as a PNG. Photos are read on this machine and
// never uploaded. A `?shot=` query sets up a fixed scene for a screenshot
// instead (./shots.js).
import { drawCover, panelRects, SIZES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const captionInput = document.getElementById('caption');
const subcaptionInput = document.getElementById('subcaption');
const zoomInput = document.getElementById('zoom');
const gradeSelect = document.getElementById('grade');
const sizeSelect = document.getElementById('size');
const panelTabs = document.getElementById('panelTabs');
const zoomValue = document.getElementById('zoomValue');

/** The whole cover: layout, words, grade, size, and one photo per panel. */
export const state = {
  layout: 'poster',
  size: '1080x1080',
  caption: 'Sunset Heist',
  subcaption: 'Palms · Sunset · Neon',
  captionPosition: 'bottom',
  captionColor: 'white',
  grade: 'sunset',
  panels: [
    { img: null, zoom: 1, ox: 0, oy: 0 },
    { img: null, zoom: 1, ox: 0, oy: 0 },
    { img: null, zoom: 1, ox: 0, oy: 0 },
  ],
};

let selectedPanel = 0;
let fontReady = false;

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Resizes the preview canvas to the chosen export size and redraws. */
function resizePreview() {
  const { w, h } = SIZES[state.size];
  canvas.width = w;
  canvas.height = h;
  canvas.dataset.size = state.size;
  drawCover(canvas, state);
}

function redraw() {
  if (!fontReady) return;
  drawCover(canvas, state);
}

/** Keeps the panel tabs, zoom slider and grade select in step with state. */
function syncPanelControls() {
  for (const tab of panelTabs.querySelectorAll('button')) {
    const i = Number(tab.dataset.panel);
    tab.classList.toggle('active', i === selectedPanel);
    tab.textContent = state.panels[i].img ? `Panel ${i + 1} ●` : `Panel ${i + 1}`;
  }
  const panel = state.panels[selectedPanel];
  zoomInput.value = String(Math.round((panel.zoom || 1) * 100));
  zoomValue.textContent = `${Math.round((panel.zoom || 1) * 100)}%`;
  gradeSelect.value = state.grade;
  panelTabs.style.display = state.layout === 'single' ? 'none' : 'flex';
}

function selectPanel(i) {
  selectedPanel = i;
  syncPanelControls();
  redraw();
}

/** Which panel (if any) sits under a point on the preview canvas. */
function panelAt(clientX, clientY) {
  const box = canvas.getBoundingClientRect();
  const x = ((clientX - box.left) / box.width) * canvas.width;
  const y = ((clientY - box.top) / box.height) * canvas.height;
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  const count = state.layout === 'single' ? 1 : 3;
  for (let i = 0; i < count; i++) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

// Click a panel to work on it; drag its photo to move it; wheel zooms it.
let dragging = null;
canvas.addEventListener('pointerdown', (e) => {
  const i = panelAt(e.clientX, e.clientY);
  if (i < 0) return;
  selectPanel(i);
  const panel = state.panels[i];
  dragging = { x: e.clientX, y: e.clientY, ox: panel.ox || 0, oy: panel.oy || 0 };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const box = canvas.getBoundingClientRect();
  const scaleX = canvas.width / box.width;
  const scaleY = canvas.height / box.height;
  const panel = state.panels[selectedPanel];
  panel.ox = dragging.ox + (e.clientX - dragging.x) * scaleX;
  panel.oy = dragging.oy + (e.clientY - dragging.y) * scaleY;
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[selectedPanel];
  panel.zoom = Math.max(1, Math.min(3, (panel.zoom || 1) * (e.deltaY < 0 ? 1.08 : 0.93)));
  syncPanelControls();
  redraw();
}, { passive: false });

// Layout picker.
for (const button of document.querySelectorAll('[data-layout]')) {
  button.addEventListener('click', () => {
    state.layout = button.dataset.layout;
    for (const b of document.querySelectorAll('[data-layout]')) {
      b.classList.toggle('active', b === button);
    }
    syncPanelControls();
    redraw();
  });
}

// Panel tabs.
for (const tab of panelTabs.querySelectorAll('button')) {
  tab.addEventListener('click', () => selectPanel(Number(tab.dataset.panel)));
}

// Photo for the selected panel, from the machine.
document.getElementById('photo').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  state.panels[selectedPanel] = { img: await loadImage(URL.createObjectURL(file)), zoom: 1, ox: 0, oy: 0 };
  syncPanelControls();
  redraw();
  e.target.value = '';
});

// Sample photos: one click fills the selected panel, no upload needed.
for (const button of document.querySelectorAll('[data-sample]')) {
  button.addEventListener('click', async () => {
    state.panels[selectedPanel] = { img: await loadImage(`samples/${button.dataset.sample}.jpg`), zoom: 1, ox: 0, oy: 0 };
    syncPanelControls();
    redraw();
  });
}

// One photo across every panel.
document.getElementById('fillAll').addEventListener('click', () => {
  const source = state.panels[selectedPanel];
  if (!source.img) {
    status.textContent = 'Pick a photo for this panel first.';
    return;
  }
  for (let i = 0; i < 3; i++) {
    state.panels[i] = { img: source.img, zoom: source.zoom, ox: 0, oy: 0 };
  }
  status.textContent = 'Same photo in every panel — drag each one to frame it.';
  redraw();
});

// Zoom slider and grade select for the selected panel's look.
zoomInput.addEventListener('input', () => {
  state.panels[selectedPanel].zoom = Number(zoomInput.value) / 100;
  zoomValue.textContent = `${zoomInput.value}%`;
  redraw();
});
gradeSelect.addEventListener('change', () => {
  state.grade = gradeSelect.value;
  redraw();
});

// Caption words, position and colour.
captionInput.addEventListener('input', () => { state.caption = captionInput.value; redraw(); });
subcaptionInput.addEventListener('input', () => { state.subcaption = subcaptionInput.value; redraw(); });
for (const button of document.querySelectorAll('[data-position]')) {
  button.addEventListener('click', () => {
    state.captionPosition = button.dataset.position;
    for (const b of document.querySelectorAll('[data-position]')) {
      b.classList.toggle('active', b === button);
    }
    redraw();
  });
}
for (const swatch of document.querySelectorAll('[data-color]')) {
  swatch.addEventListener('click', () => {
    state.captionColor = swatch.dataset.color;
    for (const s of document.querySelectorAll('[data-color]')) {
      s.classList.toggle('active', s === swatch);
    }
    redraw();
  });
}

// Export size.
sizeSelect.addEventListener('change', () => {
  state.size = sizeSelect.value;
  resizePreview();
});

// Export: render the cover at full size on a fresh canvas and save the PNG.
async function exportCover() {
  const { w, h } = SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off, state);
  const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vice-cover-${state.size}.png`;
  a.click();
  status.textContent = `Saved vice-cover-${state.size}.png (${w} × ${h})`;
}
document.getElementById('export').addEventListener('click', exportCover);

/** Applies a scene (from ?shot=) on top of the current state, then redraws. */
export async function applyScene(scene) {
  if (scene.layout) {
    state.layout = scene.layout;
    for (const b of document.querySelectorAll('[data-layout]')) {
      b.classList.toggle('active', b.dataset.layout === scene.layout);
    }
  }
  if (scene.size) {
    state.size = scene.size;
    sizeSelect.value = scene.size;
  }
  resizePreview();
  if (scene.grade) state.grade = scene.grade;
  if (scene.caption !== undefined) { state.caption = scene.caption; captionInput.value = scene.caption; }
  if (scene.subcaption !== undefined) { state.subcaption = scene.subcaption; subcaptionInput.value = scene.subcaption; }
  if (scene.captionPosition) state.captionPosition = scene.captionPosition;
  if (scene.captionColor) state.captionColor = scene.captionColor;
  if (scene.photos) {
    for (let i = 0; i < scene.photos.length && i < 3; i++) {
      const name = scene.photos[i];
      if (!name) continue;
      state.panels[i] = { img: await loadImage(`samples/${name}.jpg`), zoom: 1, ox: 0, oy: 0 };
    }
  }
  if (scene.tweaks) {
    // Frame each panel on purpose: zoom and a vertical pan as a fraction of
    // the panel height (positive moves the photo down, showing its top).
    const rects = panelRects(state.layout, canvas.width, canvas.height);
    for (let i = 0; i < scene.tweaks.length && i < 3; i++) {
      const tweak = scene.tweaks[i] || {};
      if (tweak.zoom) state.panels[i].zoom = tweak.zoom;
      if (tweak.oyFrac) state.panels[i].oy = tweak.oyFrac * rects[i].h;
    }
  }
  resizePreview();
  syncPanelControls();
}

const shot = new URLSearchParams(location.search).get('shot');
async function start() {
  try {
    await document.fonts.load('100px Anton');
    await document.fonts.ready;
  } catch { /* the canvas falls back to a bold sans */ }
  fontReady = true;
  if (shot) {
    await runShot(shot, new URLSearchParams(location.search), applyScene);
  } else {
    resizePreview();
    syncPanelControls();
  }
}
start();
