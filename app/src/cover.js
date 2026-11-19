// Renders the cover art: multi-panel photos with a colour grade, white gutters
// between the panels, and a bold poster caption. Pure canvas 2D, no network,
// no font beyond the Anton face the page ships under app/fonts/.
//
// A cover is a state object:
//   layout: 'poster' | 'triptych' | 'single'
//   caption, subcaption: strings
//   captionPosition: 'bottom' | 'top'
//   captionColor: 'white' | 'yellow' | 'pink'
//   grade: 'sunset' | 'neon' | 'noir' | 'golden'
//   panels: [{ img, zoom, ox, oy }] — img is an HTMLImageElement or null,
//           zoom scales the cover-fit photo, ox/oy pan it in panel pixels.

export const LAYOUTS = ['poster', 'triptych', 'single'];
export const GRADES = ['sunset', 'neon', 'noir', 'golden'];
export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square 1080 × 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait 1080 × 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Wide 1920 × 1080' },
};

/** The panel rectangles for a layout, as fractions of the cover. */
export function panelFractions(layout) {
  if (layout === 'triptych') {
    return [
      { x: 0, y: 0, w: 1 / 3, h: 1 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
    ];
  }
  if (layout === 'single') return [{ x: 0, y: 0, w: 1, h: 1 }];
  return [
    { x: 0, y: 0, w: 1, h: 0.62 },
    { x: 0, y: 0.62, w: 0.5, h: 0.38 },
    { x: 0.5, y: 0.62, w: 0.5, h: 0.38 },
  ];
}

/** Panel rectangles in pixels, inset by half the gutter so white seams show. */
export function panelRects(layout, width, height) {
  const gutter = Math.max(4, Math.round(Math.min(width, height) * 0.007));
  return panelFractions(layout).map((f) => ({
    x: Math.round(f.x * width) + gutter / 2,
    y: Math.round(f.y * height) + gutter / 2,
    w: Math.round(f.w * width) - gutter,
    h: Math.round(f.h * height) - gutter,
  }));
}

/** The CSS filter that grades a photo, per grade name. */
export function gradeFilter(grade) {
  switch (grade) {
    case 'neon': return 'saturate(1.45) contrast(1.08) hue-rotate(-8deg)';
    case 'noir': return 'grayscale(1) contrast(1.18) brightness(1.02)';
    case 'golden': return 'sepia(0.32) saturate(1.15) contrast(1.04)';
    default: return 'saturate(1.28) contrast(1.06)'; // sunset
  }
}

/** The warm/cool wash painted over a graded photo, per grade name. */
export function gradeOverlayStops(grade) {
  switch (grade) {
    case 'neon':
      return [
        [0, 'rgba(255, 0, 170, 0.20)'],
        [0.55, 'rgba(120, 0, 180, 0.06)'],
        [1, 'rgba(0, 210, 255, 0.20)'],
      ];
    case 'noir':
      return [
        [0, 'rgba(10, 10, 20, 0.10)'],
        [1, 'rgba(10, 10, 20, 0.22)'],
      ];
    case 'golden':
      return [
        [0, 'rgba(255, 200, 90, 0.10)'],
        [1, 'rgba(255, 150, 40, 0.22)'],
      ];
    default:
      return [
        [0, 'rgba(255, 90, 40, 0.08)'],
        [0.6, 'rgba(255, 110, 70, 0.10)'],
        [1, 'rgba(230, 30, 130, 0.30)'],
      ];
  }
}

let halftoneTile = null;
/** A tiny repeating dot tile, painted faintly over the caption scrim. */
function halftonePattern(ctx) {
  if (halftoneTile) return halftoneTile;
  const tile = document.createElement('canvas');
  tile.width = 18;
  tile.height = 18;
  const t = tile.getContext('2d');
  t.fillStyle = 'rgba(255, 255, 255, 0.9)';
  t.beginPath();
  t.arc(9, 9, 2.2, 0, Math.PI * 2);
  t.fill();
  halftoneTile = ctx.createPattern(tile, 'repeat');
  return halftoneTile;
}

/** Draws one panel's photo, cover-fit, zoomed and panned, then its grade wash. */
function drawPhotoPanel(ctx, panel, rect, grade) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (panel.img) {
    const img = panel.img;
    const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
    const scale = base * (panel.zoom || 1);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    // Pan is clamped so the photo always covers the panel.
    const maxX = Math.max(0, (dw - rect.w) / 2);
    const maxY = Math.max(0, (dh - rect.h) / 2);
    const ox = Math.max(-maxX, Math.min(maxX, panel.ox || 0));
    const oy = Math.max(-maxY, Math.min(maxY, panel.oy || 0));
    ctx.filter = gradeFilter(grade);
    ctx.drawImage(img, rect.x + (rect.w - dw) / 2 + ox, rect.y + (rect.h - dh) / 2 + oy, dw, dh);
    ctx.filter = 'none';
  } else {
    // Empty panel: a dusk gradient so the layout reads even before a photo.
    const empty = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    empty.addColorStop(0, '#3a2350');
    empty.addColorStop(1, '#120e1e');
    ctx.fillStyle = empty;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  const wash = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  for (const [stop, color] of gradeOverlayStops(grade)) wash.addColorStop(stop, color);
  ctx.fillStyle = wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** The largest Anton size that fits `text` inside `maxWidth`. */
function fitCaptionFont(ctx, text, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  while (size > 24 && ctx.measureText(text).width > maxWidth) {
    size -= 4;
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  }
  return size;
}

/** The caption (and subcaption) over a dark scrim, top or bottom. */
function drawCaption(ctx, width, height, state) {
  const text = (state.caption || '').trim().toUpperCase();
  const sub = (state.subcaption || '').trim().toUpperCase();
  if (!text && !sub) return;
  const atTop = state.captionPosition === 'top';
  const bandH = height * 0.34;
  const bandY = atTop ? 0 : height - bandH;
  const scrim = ctx.createLinearGradient(0, bandY, 0, atTop ? bandH : height);
  if (atTop) {
    scrim.addColorStop(0, 'rgba(8, 4, 18, 0.72)');
    scrim.addColorStop(1, 'rgba(8, 4, 18, 0)');
  } else {
    scrim.addColorStop(0, 'rgba(8, 4, 18, 0)');
    scrim.addColorStop(1, 'rgba(8, 4, 18, 0.72)');
  }
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandY, width, bandH);
  // Faint halftone dots across the scrim.
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = halftonePattern(ctx);
  ctx.fillRect(0, bandY, width, bandH);
  ctx.restore();

  const colors = { white: '#ffffff', yellow: '#ffd94d', pink: '#ff7ad9' };
  const fill = colors[state.captionColor] || '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const cx = width / 2;
  if (text) {
    const size = fitCaptionFont(ctx, text, width * 0.92, Math.round(height * 0.115));
    const y = atTop ? bandY + height * 0.115 : height - height * 0.055 - (sub ? height * 0.045 : 0);
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(10, 6, 20, 0.92)';
    ctx.lineWidth = Math.max(4, size * 0.14);
    ctx.shadowColor = 'rgba(255, 60, 160, 0.55)';
    ctx.shadowBlur = size * 0.16;
    ctx.shadowOffsetY = size * 0.03;
    ctx.strokeText(text, cx, y);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = fill;
    ctx.fillText(text, cx, y);
  }
  if (sub) {
    const subSize = Math.max(16, Math.round(height * 0.026));
    ctx.font = `600 ${subSize}px system-ui, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(subSize * 0.35)}px`; } catch { /* older canvas */ }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = subSize * 0.3;
    const y = atTop
      ? bandY + height * 0.115 + subSize * 1.9
      : height - height * 0.035;
    ctx.fillText(sub, cx, y);
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
    ctx.shadowBlur = 0;
  }
}

/** Draws the whole cover for `state` onto `canvas` at its own pixel size. */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  // White paper first: the gutters and the frame around the panels.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  const rects = panelRects(state.layout, w, h);
  const count = state.layout === 'single' ? 1 : 3;
  for (let i = 0; i < count; i++) {
    drawPhotoPanel(ctx, state.panels[i] || {}, rects[i], state.grade);
  }
  // Vignette: darkened corners so the photos sit in the frame.
  const vignette = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(10, 4, 20, 0.26)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
  drawCaption(ctx, w, h, state);
}
