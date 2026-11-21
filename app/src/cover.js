// Vice Frame — canvas renderer
// Draws a multi-panel poster collage: each cell gets a cover-fit photo
// (pan + zoom), a sunset grade wash, gutters, vignette, and big outlined type.

export const SIZES = [
  { id: "square", w: 1080, h: 1080, label: "1080 × 1080" },
  { id: "portrait", w: 1080, h: 1350, label: "1080 × 1350" },
  { id: "wide", w: 1920, h: 1080, label: "1920 × 1080" },
];

// Layouts are arrays of [x, y, w, h] fractions.
export const LAYOUTS = {
  vice: [[0, 0, 0.58, 1], [0.58, 0, 0.42, 0.55], [0.58, 0.55, 0.42, 0.45]],
  grid: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
  trio: [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]],
  solo: [[0, 0, 1, 1]],
};

export const GRADES = {
  sunset: { top: "24,160,190", mid: "255,110,60", low: "215,38,116", dark: "8,2,18" },
  neon: { top: "64,224,255", mid: "150,80,255", low: "255,43,214", dark: "4,0,24" },
  gold: { top: "64,120,160", mid: "255,170,60", low: "200,90,20", dark: "16,8,2" },
};

const blankPanel = () => ({ img: null, x: 0.5, y: 0.5, zoom: 1 });

export function freshState() {
  return {
    layout: "vice",
    panels: LAYOUTS.vice.map(blankPanel),
    caption: "Neon Vice",
    kicker: "Welcome to",
    gradeAmount: 0.65,
    gradeName: "sunset",
    gutter: 10,
    frameColor: "#ffffff",
    top: false,
  };
}

export function switchLayout(state, name) {
  if (!LAYOUTS[name]) return;
  const kept = state.panels;
  state.layout = name;
  state.panels = LAYOUTS[name].map((_, i) => kept[i] || blankPanel());
}

function paintPhoto(ctx, p, x, y, w, h) {
  if (!p.img) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "#24365e"); g.addColorStop(0.55, "#7a2d63"); g.addColorStop(1, "#e2603f");
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.font = `600 ${Math.max(14, Math.round(h * 0.045))}px system-ui,sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("ADD A PHOTO", x + w / 2, y + h / 2);
    return;
  }
  const s = Math.max(w / p.img.naturalWidth, h / p.img.naturalHeight) * p.zoom;
  const dw = p.img.naturalWidth * s, dh = p.img.naturalHeight * s;
  ctx.drawImage(p.img, x + (w - dw) * p.x, y + (h - dh) * p.y, dw, dh);
}

function wash(ctx, x, y, w, h, amt, recipe) {
  if (amt <= 0) return;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, `rgba(${recipe.top},${0.16 * amt})`);
  g.addColorStop(0.45, "rgba(0,0,0,0)");
  g.addColorStop(0.78, `rgba(${recipe.mid},${0.14 * amt})`);
  g.addColorStop(1, `rgba(${recipe.low},${0.34 * amt})`);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
}

function lettering(ctx, W, H, st) {
  const title = (st.caption || "").trim().toUpperCase();
  const kick = (st.kicker || "").trim().toUpperCase();
  if (!title && !kick) return;
  const maxW = W - W * 0.11;
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  let ts = H * 0.115;
  const setFont = () => { ctx.font = `italic 900 ${ts}px Impact,'Arial Black',sans-serif`; };
  if (title) { setFont(); while (ctx.measureText(title).width > maxW && ts > 14) { ts -= 3; setFont(); } }
  const ks = Math.max(13, H * 0.026);
  const anchor = st.top ? H * 0.055 : H * 0.945;
  const titleY = st.top ? anchor + (kick ? ks * 1.5 : 0) + ts * 0.82 : anchor - ts * 0.08;
  const kickY = st.top ? anchor + ks * 0.8 : titleY - ts * 1.02;
  if (kick) {
    ctx.font = `700 ${ks}px 'Arial Narrow',Arial,sans-serif`;
    const spaced = [...kick].join("  ");
    ctx.lineWidth = ks * 0.18; ctx.strokeStyle = "rgba(10,4,16,.9)"; ctx.fillStyle = "#ffd166";
    ctx.strokeText(spaced, W / 2, kickY); ctx.fillText(spaced, W / 2, kickY);
  }
  if (title) {
    setFont();
    const grad = ctx.createLinearGradient(0, titleY - ts, 0, titleY);
    grad.addColorStop(0, "#fff"); grad.addColorStop(0.55, "#ffe9f4"); grad.addColorStop(1, "#ffb3d1");
    ctx.lineJoin = "round"; ctx.lineWidth = ts * 0.16; ctx.strokeStyle = "#12040f";
    ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = ts * 0.12; ctx.shadowOffsetY = ts * 0.05;
    ctx.strokeText(title, W / 2, titleY);
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.fillStyle = grad; ctx.fillText(title, W / 2, titleY);
  }
}

export function renderCover(canvas, st) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const recipe = GRADES[st.gradeName] || GRADES.sunset;
  ctx.fillStyle = st.frameColor; ctx.fillRect(0, 0, W, H);
  const g = st.gutter;
  LAYOUTS[st.layout].forEach((r, i) => {
    const x = r[0] * W + g, y = r[1] * H + g, w = r[2] * W - g * 2, h = r[3] * H - g * 2;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    paintPhoto(ctx, st.panels[i], x, y, w, h);
    wash(ctx, x, y, w, h, st.gradeAmount, recipe);
    ctx.restore();
  });
  if (st.gradeAmount > 0) {
    const warm = ctx.createLinearGradient(0, 0, 0, H);
    warm.addColorStop(0, `rgba(${recipe.mid},${0.08 * st.gradeAmount})`);
    warm.addColorStop(0.5, "rgba(0,0,0,0)");
    warm.addColorStop(1, `rgba(${recipe.dark},${0.22 * st.gradeAmount})`);
    ctx.fillStyle = warm; ctx.fillRect(0, 0, W, H);
    const vig = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.42, W/2, H/2, Math.max(W,H)*0.78);
    vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, `rgba(${recipe.dark},${0.36 * st.gradeAmount})`);
    ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
  }
  lettering(ctx, W, H, st);
}

export function panelAt(st, canvas, px, py) {
  const fx = px / canvas.width, fy = py / canvas.height;
  const cells = LAYOUTS[st.layout];
  for (let i = cells.length - 1; i >= 0; i--) {
    const [x, y, w, h] = cells[i];
    if (fx >= x && fx <= x + w && fy >= y && fy <= y + h) return i;
  }
  return -1;
}
