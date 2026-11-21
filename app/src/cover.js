// VICE FRAME cover renderer: draws a GTA-poster-style multi-panel collage onto a canvas.
// Panels hold photos (cover-fit with pan and zoom), a sunset/neon colour grade is laid over
// the collage, white or black gutters frame each panel, and the caption is set in heavy
// outlined display lettering. Pure canvas 2D, no dependencies.

export const POST_SIZES = [
  { id: 'square', label: '1080 x 1080', width: 1080, height: 1080 },
  { id: 'portrait', label: '1080 x 1350', width: 1080, height: 1350 },
  { id: 'wide', label: '1920 x 1080', width: 1920, height: 1080 },
];

// Panel layouts as relative rectangles [x, y, w, h] of the whole cover.
export const PANEL_LAYOUTS = {
  vice: {
    label: 'Vice (hero + stack)',
    panels: [
      [0, 0, 0.58, 1],
      [0.58, 0, 0.42, 0.55],
      [0.58, 0.55, 0.42, 0.45],
    ],
  },
  grid: {
    label: 'Grid (2 x 2)',
    panels: [
      [0, 0, 0.5, 0.5],
      [0.5, 0, 0.5, 0.5],
      [0, 0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5, 0.5],
    ],
  },
  trio: {
    label: 'Trio (3 strips)',
    panels: [
      [0, 0, 1 / 3, 1],
      [1 / 3, 0, 1 / 3, 1],
      [2 / 3, 0, 1 / 3, 1],
    ],
  },
  solo: {
    label: 'Solo (full bleed)',
    panels: [[0, 0, 1, 1]],
  },
};

export function makePanelState() {
  return { image: null, panX: 0.5, panY: 0.5, zoom: 1 };
}

export function makeCoverState() {
  return {
    layout: 'vice',
    panels: PANEL_LAYOUTS.vice.panels.map(makePanelState),
    caption: 'Neon Vice',
    kicker: 'WELCOME TO',
    grade: 0.65,
    gradeMode: 'sunset',
    gutter: 10,
    frame: '#ffffff',
    captionAtTop: false,
  };
}

// Colour recipes for the grade: teal from the top, a warm band, a hot colour low.
export const GRADE_MODES = {
  sunset: { top: [24, 160, 190], band: [255, 110, 60], low: [215, 38, 116], vig: [8, 2, 18] },
  neon: { top: [64, 224, 255], band: [150, 80, 255], low: [255, 43, 214], vig: [4, 0, 24] },
  gold: { top: [64, 120, 160], band: [255, 170, 60], low: [200, 90, 20], vig: [16, 8, 2] },
};

export function setLayout(state, layoutId) {
  const layout = PANEL_LAYOUTS[layoutId];
  const next = layout.panels.map((_, i) => state.panels[i] ?? makePanelState());
  state.layout = layoutId;
  state.panels = next;
}

function drawPhotoInPanel(ctx, panel, x, y, w, h) {
  const img = panel.image;
  if (!img) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#233a5e');
    g.addColorStop(0.55, '#7a2d63');
    g.addColorStop(1, '#e2603f');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `600 ${Math.round(h * 0.045)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('ADD A PHOTO', x + w / 2, y + h / 2);
    return;
  }
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * panel.zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = x + (w - dw) * panel.panX;
  const dy = y + (h - dh) * panel.panY;
  ctx.drawImage(img, dx, dy, dw, dh);
}

// The colour grade inside one panel: cool from the top, a warm band, a hot colour low.
function gradePanel(ctx, x, y, w, h, amount, mode) {
  if (amount <= 0) return;
  const [tr, tg, tb] = mode.top;
  const [br, bg, bb] = mode.band;
  const [lr, lg, lb] = mode.low;
  const top = ctx.createLinearGradient(0, y, 0, y + h);
  top.addColorStop(0, `rgba(${tr}, ${tg}, ${tb}, ${0.16 * amount})`);
  top.addColorStop(0.45, 'rgba(0,0,0,0)');
  top.addColorStop(0.78, `rgba(${br}, ${bg}, ${bb}, ${0.14 * amount})`);
  top.addColorStop(1, `rgba(${lr}, ${lg}, ${lb}, ${0.34 * amount})`);
  ctx.fillStyle = top;
  ctx.fillRect(x, y, w, h);
}

function drawPanelCollage(ctx, w, h, state) {
  ctx.fillStyle = state.frame;
  ctx.fillRect(0, 0, w, h);
  const layout = PANEL_LAYOUTS[state.layout];
  const g = state.gutter;
  layout.panels.forEach((rect, i) => {
    const px = rect[0] * w + g;
    const py = rect[1] * h + g;
    const pw = rect[2] * w - g * 2;
    const ph = rect[3] * h - g * 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, pw, ph);
    ctx.clip();
    drawPhotoInPanel(ctx, state.panels[i], px, py, pw, ph);
    gradePanel(ctx, px, py, pw, ph, state.grade, GRADE_MODES[state.gradeMode] ?? GRADE_MODES.sunset);
    ctx.restore();
  });
}

function applyGlobalGrade(ctx, w, h, amount, mode) {
  if (amount <= 0) return;
  const [br, bg, bb] = mode.band;
  const [vr, vg, vb] = mode.vig;
  const warm = ctx.createLinearGradient(0, 0, 0, h);
  warm.addColorStop(0, `rgba(${br}, ${bg}, ${bb}, ${0.08 * amount})`);
  warm.addColorStop(0.5, 'rgba(0,0,0,0)');
  warm.addColorStop(1, `rgba(${vr}, ${vg}, ${vb}, ${0.22 * amount})`);
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, w, h);
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, `rgba(${vr}, ${vg}, ${vb}, ${0.36 * amount})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

// Heavy display lettering: italic condensed capitals, gradient fill, thick black outline.
function drawCaptionLettering(ctx, w, h, state) {
  const title = (state.caption || '').trim().toUpperCase();
  const kicker = (state.kicker || '').trim().toUpperCase();
  if (!title && !kicker) return;
  const margin = w * 0.055;
  const maxWidth = w - margin * 2;
  const baseY = state.captionAtTop ? h * 0.055 : h * 0.945;
  ctx.textAlign = 'center';

  let titleSize = h * 0.115;
  const setTitleFont = () => {
    ctx.font = `italic 900 ${titleSize}px Impact, 'Arial Black', 'Franklin Gothic Heavy', sans-serif`;
  };
  if (title) {
    setTitleFont();
    while (ctx.measureText(title).width > maxWidth && titleSize > 14) {
      titleSize -= 3;
      setTitleFont();
    }
  }
  const kickerSize = Math.max(13, h * 0.026);
  const titleBaseline = state.captionAtTop
    ? baseY + (kicker ? kickerSize * 1.5 : 0) + titleSize * 0.82
    : baseY - titleSize * 0.08;
  const kickerBaseline = state.captionAtTop ? baseY + kickerSize * 0.8 : titleBaseline - titleSize * 1.02;

  if (kicker) {
    ctx.font = `700 ${kickerSize}px 'Arial Narrow', Arial, sans-serif`;
    const spaced = kicker.split('').join('  ');
    ctx.lineWidth = kickerSize * 0.18;
    ctx.strokeStyle = 'rgba(10,4,16,0.9)';
    ctx.fillStyle = '#ffd166';
    ctx.strokeText(spaced, w / 2, kickerBaseline);
    ctx.fillText(spaced, w / 2, kickerBaseline);
  }
  if (title) {
    setTitleFont();
    const grad = ctx.createLinearGradient(0, titleBaseline - titleSize, 0, titleBaseline);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, '#ffe9f4');
    grad.addColorStop(1, '#ffb3d1');
    ctx.lineJoin = 'round';
    ctx.lineWidth = titleSize * 0.16;
    ctx.strokeStyle = '#12040f';
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = titleSize * 0.12;
    ctx.shadowOffsetY = titleSize * 0.05;
    ctx.strokeText(title, w / 2, titleBaseline);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = grad;
    ctx.fillText(title, w / 2, titleBaseline);
  }
}

/** Draws the whole cover described by `state` onto the canvas at its own width and height. */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  drawPanelCollage(ctx, w, h, state);
  applyGlobalGrade(ctx, w, h, state.grade, GRADE_MODES[state.gradeMode] ?? GRADE_MODES.sunset);
  drawCaptionLettering(ctx, w, h, state);
}

/** Returns the panel index under a point given in canvas pixels, or -1. */
export function panelIndexAt(state, canvas, px, py) {
  const layout = PANEL_LAYOUTS[state.layout];
  const fx = px / canvas.width;
  const fy = py / canvas.height;
  for (let i = layout.panels.length - 1; i >= 0; i--) {
    const [x, y, w, h] = layout.panels[i];
    if (fx >= x && fx <= x + w && fy >= y && fy <= y + h) return i;
  }
  return -1;
}
