// Vice Frame — editor wiring + ?shot= mode
import { SIZES, LAYOUTS, freshState, switchLayout, renderCover, panelAt } from "./cover.js";

const SAMPLES = [
  { id: "heroine", src: "./samples/heroine.jpg", label: "Heroine" },
  { id: "driver", src: "./samples/driver.jpg", label: "Driver" },
  { id: "speedboat", src: "./samples/speedboat.jpg", label: "Speedboat" },
  { id: "boulevard", src: "./samples/boulevard.jpg", label: "Boulevard" },
  { id: "pier", src: "./samples/pier.jpg", label: "Pier" },
];

const canvas = document.getElementById("coverCanvas");
const state = freshState();
let size = SIZES[1];
let selected = 0;
const cache = new Map();

const sampleImg = (s) => {
  if (!cache.has(s.id)) { const im = new Image(); im.src = s.src; cache.set(s.id, im); }
  return cache.get(s.id);
};
const ready = (im) => (im.complete && im.naturalWidth > 0)
  ? Promise.resolve()
  : new Promise((res) => { im.addEventListener("load", res, { once: true }); im.addEventListener("error", res, { once: true }); });

function draw() {
  canvas.width = size.w; canvas.height = size.h;
  renderCover(canvas, state);
  const hint = document.getElementById("selectedPanelHint");
  if (hint) hint.textContent = `Panel ${selected + 1} of ${state.panels.length} — drag on the cover to move it, scroll to zoom.`;
  document.querySelectorAll("[data-layout]").forEach((b) => b.classList.toggle("active", b.dataset.layout === state.layout));
  document.querySelectorAll("[data-size]").forEach((b) => b.classList.toggle("active", b.dataset.size === size.id));
  const zs = document.getElementById("zoomSlider");
  if (zs && state.panels[selected]) zs.value = String(Math.round(state.panels[selected].zoom * 100));
}

function put(img, idx = selected) {
  const p = state.panels[idx]; if (!p) return;
  p.img = img; p.x = 0.5; p.y = 0.5; p.zoom = 1; draw();
}
function putInNextFree(img) {
  const i = state.panels.findIndex((p) => !p.img);
  put(img, i === -1 ? selected : i);
}

function buildStrip() {
  const strip = document.getElementById("sampleStrip");
  for (const s of SAMPLES) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "sampleThumb"; b.title = s.label;
    const im = document.createElement("img"); im.src = s.src; im.alt = s.label;
    b.appendChild(im);
    b.addEventListener("click", async () => { const img = sampleImg(s); await ready(img); put(img); });
    strip.appendChild(b);
  }
}

function bind() {
  document.getElementById("photoInput").addEventListener("change", async (e) => {
    for (const f of [...e.target.files]) {
      const im = new Image(); im.src = URL.createObjectURL(f);
      await ready(im); putInNextFree(im);
    }
    e.target.value = "";
  });
  document.querySelectorAll("[data-layout]").forEach((b) => b.addEventListener("click", () => {
    switchLayout(state, b.dataset.layout);
    selected = Math.min(selected, state.panels.length - 1); draw();
  }));
  document.querySelectorAll("[data-size]").forEach((b) => b.addEventListener("click", () => {
    size = SIZES.find((s) => s.id === b.dataset.size) || size; draw();
  }));
  const cap = document.getElementById("captionInput");
  cap.addEventListener("input", () => { state.caption = cap.value; draw(); });
  const kick = document.getElementById("kickerInput");
  kick.addEventListener("input", () => { state.kicker = kick.value; draw(); });
  document.getElementById("gradeSlider").addEventListener("input", (e) => { state.gradeAmount = Number(e.target.value) / 100; draw(); });
  document.getElementById("gradeModeSelect").addEventListener("change", (e) => { state.gradeName = e.target.value; draw(); });
  document.getElementById("gutterSlider").addEventListener("input", (e) => { state.gutter = Number(e.target.value); draw(); });
  document.getElementById("frameSelect").addEventListener("change", (e) => { state.frameColor = e.target.value; draw(); });
  document.getElementById("captionTopToggle").addEventListener("change", (e) => { state.top = e.target.checked; draw(); });
  document.getElementById("zoomSlider").addEventListener("input", (e) => {
    if (state.panels[selected]) state.panels[selected].zoom = Number(e.target.value) / 100; draw();
  });
  document.getElementById("exportButton").addEventListener("click", () => {
    draw();
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `vice-frame-${size.w}x${size.h}.png`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      const st = document.getElementById("exportStatus");
      if (st) st.textContent = `Saved PNG ${size.w} × ${size.h}`;
    }, "image/png");
  });

  let drag = null;
  const point = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) }; };
  canvas.addEventListener("pointerdown", (e) => {
    const p = point(e); const i = panelAt(state, canvas, p.x, p.y);
    if (i >= 0) selected = i;
    drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); draw();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = state.panels[selected]; if (!p || !p.img) return;
    const r = canvas.getBoundingClientRect();
    const cell = LAYOUTS[state.layout][selected];
    const pw = cell[2] * canvas.width, ph = cell[3] * canvas.height;
    const sc = Math.max(pw / p.img.naturalWidth, ph / p.img.naturalHeight) * p.zoom;
    const ox = Math.max(1, p.img.naturalWidth * sc - pw), oy = Math.max(1, p.img.naturalHeight * sc - ph);
    const dx = ((e.clientX - drag.x) / r.width) * canvas.width;
    const dy = ((e.clientY - drag.y) / r.height) * canvas.height;
    p.x = Math.min(1, Math.max(0, p.x - dx / ox));
    p.y = Math.min(1, Math.max(0, p.y - dy / oy));
    drag = { x: e.clientX, y: e.clientY }; draw();
  });
  const end = () => { drag = null; };
  canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault(); const p = state.panels[selected]; if (!p) return;
    p.zoom = Math.min(4, Math.max(1, p.zoom * (e.deltaY < 0 ? 1.07 : 0.93))); draw();
  }, { passive: false });
}

async function applyParams(params) {
  const sz = params.get("size");
  if (sz) { const f = SIZES.find((s) => s.id === sz) || SIZES.find((s) => `${s.w}x${s.h}` === sz); if (f) size = f; }
  const lo = params.get("layout"); if (lo && LAYOUTS[lo]) switchLayout(state, lo);
  if (params.get("caption") !== null) state.caption = params.get("caption");
  if (params.get("kicker") !== null) state.kicker = params.get("kicker");
  if (params.get("grade") !== null && params.get("grade") !== "") state.gradeAmount = Number(params.get("grade"));
  if (params.get("mode")) state.gradeName = params.get("mode");
  if (params.get("top") === "1") state.top = true;
  // keep editor controls in sync for editor shots
  const capEl = document.getElementById("captionInput"); if (capEl) capEl.value = state.caption;
  const kickEl = document.getElementById("kickerInput"); if (kickEl) kickEl.value = state.kicker;
  const modeEl = document.getElementById("gradeModeSelect"); if (modeEl) modeEl.value = state.gradeName;
  const topEl = document.getElementById("captionTopToggle"); if (topEl) topEl.checked = state.top;

  const single = params.get("photo");
  const list = (params.get("photos") || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (single && !list.length) {
    const s = SAMPLES.find((x) => x.id === single);
    if (s) { const im = sampleImg(s); await ready(im); state.panels.forEach((p) => { p.img = im; }); }
  } else {
    for (let i = 0; i < list.length; i++) {
      const s = SAMPLES.find((x) => x.id === list[i]); if (!s) continue;
      const im = sampleImg(s); await ready(im);
      if (state.panels[i]) state.panels[i].img = im;
    }
  }
  draw();
}

async function init() {
  buildStrip(); bind();
  const params = new URLSearchParams(location.search);
  const shot = params.get("shot");
  if (shot) {
    document.body.classList.add(shot === "cover" ? "shotCover" : "shotEditor");
    await applyParams(params);
    requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
    return;
  }
  for (const [i, id] of ["heroine", "driver", "speedboat"].entries()) {
    const s = SAMPLES.find((x) => x.id === id); const im = sampleImg(s); await ready(im);
    if (state.panels[i]) state.panels[i].img = im;
  }
  draw();
}
init();
