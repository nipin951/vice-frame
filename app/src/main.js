// VICE FRAME editor: wires the controls to the cover renderer, handles photo loading,
// per-panel pan and zoom by dragging on the canvas, PNG export, and the ?shot= mode the
// maker uses to produce the entry's screenshots with the app's own drawing.

import {
  POST_SIZES,
  PANEL_LAYOUTS,
  drawCover,
  makeCoverState,
  panelIndexAt,
  setLayout,
} from './cover.js';

const SAMPLE_PHOTOS = [
  { id: 'heroine', src: './samples/heroine.jpg', label: 'Heroine' },
  { id: 'driver', src: './samples/driver.jpg', label: 'Driver' },
  { id: 'speedboat', src: './samples/speedboat.jpg', label: 'Speedboat' },
  { id: 'boulevard', src: './samples/boulevard.jpg', label: 'Boulevard' },
  { id: 'pier', src: './samples/pier.jpg', label: 'Pier' },
];

const canvas = document.getElementById('coverCanvas');
const state = makeCoverState();
let selectedPanel = 0;
let currentSize = POST_SIZES[1]; // start at 1080 x 1350, the poster size

const imageCache = new Map();
function loadSampleImage(sample) {
  if (!imageCache.has(sample.id)) {
    const img = new Image();
    img.src = sample.src;
    imageCache.set(sample.id, img);
  }
  return imageCache.get(sample.id);
}

function whenImageReady(img) {
  return img.complete && img.naturalWidth > 0
    ? Promise.resolve()
    : new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
}

function renderCover() {
  canvas.width = currentSize.width;
  canvas.height = currentSize.height;
  drawCover(canvas, state);
  markSelectedPanelHint();
}

function markSelectedPanelHint() {
  const hint = document.getElementById('selectedPanelHint');
  if (hint) {
    hint.textContent = `Panel ${selectedPanel + 1}/${state.panels.length} selected. Drag to move, scroll to zoom.`;
  }
  document.querySelectorAll('[data-layout]').forEach((b) =>
    b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('[data-size]').forEach((b) =>
    b.classList.toggle('active', b.dataset.size === currentSize.id));
}

function assignImageToPanel(img, index = selectedPanel) {
  const panel = state.panels[index];
  if (!panel) return;
  panel.image = img;
  panel.panX = 0.5;
  panel.panY = 0.5;
  panel.zoom = 1;
  renderCover();
}

function assignImageToNextPanels(img) {
  const empty = state.panels.findIndex((p) => !p.image);
  assignImageToPanel(img, empty === -1 ? selectedPanel : empty);
}

// --- controls ---------------------------------------------------------------

function buildSampleStrip() {
  const strip = document.getElementById('sampleStrip');
  for (const sample of SAMPLE_PHOTOS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sampleThumb';
    btn.title = `Put the ${sample.label} sample in the selected panel`;
    const img = document.createElement('img');
    img.src = sample.src;
    img.alt = sample.label;
    btn.appendChild(img);
    btn.addEventListener('click', async () => {
      const image = loadSampleImage(sample);
      await whenImageReady(image);
      assignImageToPanel(image);
    });
    strip.appendChild(btn);
  }
}

function bindControls() {
  document.getElementById('photoInput').addEventListener('change', async (event) => {
    const files = [...event.target.files];
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await whenImageReady(img);
      assignImageToNextPanels(img);
    }
    event.target.value = '';
  });

  document.querySelectorAll('[data-layout]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setLayout(state, btn.dataset.layout);
      selectedPanel = Math.min(selectedPanel, state.panels.length - 1);
      renderCover();
    });
  });

  document.querySelectorAll('[data-size]').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentSize = POST_SIZES.find((s) => s.id === btn.dataset.size);
      renderCover();
    });
  });

  const captionInput = document.getElementById('captionInput');
  captionInput.addEventListener('input', () => {
    state.caption = captionInput.value;
    renderCover();
  });
  const kickerInput = document.getElementById('kickerInput');
  kickerInput.addEventListener('input', () => {
    state.kicker = kickerInput.value;
    renderCover();
  });

  document.getElementById('gradeSlider').addEventListener('input', (e) => {
    state.grade = Number(e.target.value) / 100;
    renderCover();
  });
  document.getElementById('gutterSlider').addEventListener('input', (e) => {
    state.gutter = Number(e.target.value);
    renderCover();
  });
  document.getElementById('frameSelect').addEventListener('change', (e) => {
    state.frame = e.target.value;
    renderCover();
  });
  document.getElementById('captionTopToggle').addEventListener('change', (e) => {
    state.captionAtTop = e.target.checked;
    renderCover();
  });
  document.getElementById('zoomSlider').addEventListener('input', (e) => {
    state.panels[selectedPanel].zoom = Number(e.target.value) / 100;
    renderCover();
  });

  document.getElementById('exportButton').addEventListener('click', exportCoverPng);
}

function exportCoverPng() {
  renderCover();
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vice-frame-${currentSize.width}x${currentSize.height}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    const status = document.getElementById('exportStatus');
    if (status) status.textContent = `Exported PNG ${currentSize.width} x ${currentSize.height}.`;
  }, 'image/png');
}

// --- canvas pan / zoom --------------------------------------------------------

function bindCanvasGestures() {
  let drag = null;
  const toCanvasPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };
  canvas.addEventListener('pointerdown', (event) => {
    const p = toCanvasPoint(event);
    const idx = panelIndexAt(state, canvas, p.x, p.y);
    if (idx >= 0) {
      selectedPanel = idx;
      document.getElementById('zoomSlider').value = String(Math.round(state.panels[idx].zoom * 100));
      markSelectedPanelHint();
    }
    drag = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const panel = state.panels[selectedPanel];
    if (!panel || !panel.image) return;
    const rect = canvas.getBoundingClientRect();
    const layout = PANEL_LAYOUTS[state.layout].panels[selectedPanel];
    const panelPxW = layout[2] * canvas.width;
    const panelPxH = layout[3] * canvas.height;
    const scale = Math.max(panelPxW / panel.image.naturalWidth, panelPxH / panel.image.naturalHeight) * panel.zoom;
    const overflowX = Math.max(1, panel.image.naturalWidth * scale - panelPxW);
    const overflowY = Math.max(1, panel.image.naturalHeight * scale - panelPxH);
    const dx = ((event.clientX - drag.x) / rect.width) * canvas.width;
    const dy = ((event.clientY - drag.y) / rect.height) * canvas.height;
    panel.panX = Math.min(1, Math.max(0, panel.panX - dx / overflowX));
    panel.panY = Math.min(1, Math.max(0, panel.panY - dy / overflowY));
    drag = { x: event.clientX, y: event.clientY };
    renderCover();
  });
  canvas.addEventListener('pointerup', () => (drag = null));
  canvas.addEventListener('pointercancel', () => (drag = null));
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const panel = state.panels[selectedPanel];
    if (!panel) return;
    panel.zoom = Math.min(4, Math.max(1, panel.zoom * (event.deltaY < 0 ? 1.07 : 0.93)));
    document.getElementById('zoomSlider').value = String(Math.round(panel.zoom * 100));
    renderCover();
  }, { passive: false });
}

// --- screenshot mode ------------------------------------------------------------

async function applyShotParams(params) {
  const sizeParam = params.get('size');
  if (sizeParam) {
    const found = POST_SIZES.find((s) => s.id === sizeParam)
      ?? POST_SIZES.find((s) => `${s.width}x${s.height}` === sizeParam);
    if (found) currentSize = found;
  }
  const layout = params.get('layout');
  if (layout && PANEL_LAYOUTS[layout]) setLayout(state, layout);
  if (params.get('caption') !== null) state.caption = params.get('caption');
  if (params.get('kicker') !== null) state.kicker = params.get('kicker');
  if (params.get('grade') !== null) state.grade = Number(params.get('grade'));
  if (params.get('top') === '1') state.captionAtTop = true;

  const photoList = (params.get('photos') ?? params.get('photo') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (let i = 0; i < photoList.length; i++) {
    const sample = SAMPLE_PHOTOS.find((s) => s.id === photoList[i]);
    if (!sample) continue;
    const img = loadSampleImage(sample);
    await whenImageReady(img);
    if (params.get('photo') && !params.get('photos')) {
      state.panels.forEach((p) => (p.image = img));
    } else if (state.panels[i]) {
      state.panels[i].image = img;
    }
  }
  renderCover();
}

async function initEditor() {
  buildSampleStrip();
  bindControls();
  bindCanvasGestures();

  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  if (shot) {
    document.body.classList.add(shot === 'cover' ? 'shotCover' : 'shotEditor');
    await applyShotParams(params);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.__shotReady = true;
    }));
    return;
  }

  // First paint: fill the hero layout with the three samples made for this app.
  const defaults = ['heroine', 'driver', 'speedboat'];
  for (let i = 0; i < defaults.length; i++) {
    const sample = SAMPLE_PHOTOS.find((s) => s.id === defaults[i]);
    const img = loadSampleImage(sample);
    await whenImageReady(img);
    state.panels[i].image = img;
  }
  renderCover();
}

initEditor();
