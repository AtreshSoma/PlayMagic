// ---------------------------------------------------------------------------
// Canvas drawing helpers: glass orbs, glass panels, sigils, glowing text.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { TAU, rgba, clamp } from '../core/util.js';

/**
 * Typography tokens. The original serif faces are aliased to the geometric
 * system: display → Sora, body → Inter (body text runs ~8% smaller so lines
 * keep their old measure).
 */
export const FONT = { display: 'Sora', body: 'Inter' };
const ALIAS = { Cinzel: [FONT.display, 1], 'Cormorant Garamond': [FONT.body, 0.92], Inter: [FONT.body, 1] };
export function fontStr(weight, size, font = 'Cinzel') {
  const [f, k] = ALIAS[font] || [font, 1];
  return `${weight} ${Math.round(size * k * 10) / 10}px ${f}, ${FONT.body}, system-ui, -apple-system, sans-serif`;
}

/**
 * Glowing text, cached as sprites. Canvas shadowBlur is one of the most
 * expensive 2D operations and the HUD redraws dozens of labels per frame, so
 * each distinct (string, style) is rendered once into an offscreen canvas at
 * device resolution and blitted afterwards. An LRU cap keeps changing strings
 * (scores, timers) from growing the cache without bound.
 */
const TEXT_CACHE = new Map();
const TEXT_CACHE_MAX = 420;
const measureCtx = document.createElement('canvas').getContext('2d');

function textSprite(str, font, color, glow, blur, spacing, size) {
  const dpr = app.dpr || 1;
  const key = `${str}|${font}|${color}|${glow}|${blur}|${spacing}|${dpr}`;
  let spr = TEXT_CACHE.get(key);
  if (spr) { TEXT_CACHE.delete(key); TEXT_CACHE.set(key, spr); return spr; }
  measureCtx.font = font;
  if ('letterSpacing' in measureCtx) measureCtx.letterSpacing = `${spacing}px`;
  const w = Math.ceil(measureCtx.measureText(str).width) + 2, pad = Math.ceil(blur * 1.6) + 4, h = Math.ceil(size * 1.5);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil((w + pad * 2) * dpr)); c.height = Math.max(1, Math.ceil((h + pad * 2) * dpr));
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  g.font = font; g.textAlign = 'left'; g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = `${spacing}px`;
  if (blur > 0) { g.shadowColor = glow; g.shadowBlur = blur; }
  g.fillStyle = color;
  g.fillText(str, pad, pad + h / 2);
  spr = { c, w, h, pad };
  TEXT_CACHE.set(key, spr);
  if (TEXT_CACHE.size > TEXT_CACHE_MAX) TEXT_CACHE.delete(TEXT_CACHE.keys().next().value);
  return spr;
}

export function glowText(ctx, str, x, y, { size = 20, color = '#fff', glow = app.theme.accent, font = 'Cinzel', weight = 600, align = 'center', alpha = 1, spacing = 0, blur = 16 } = {}) {
  if (font === 'Cinzel' && spacing > size * 0.12) spacing = size * 0.12; // geometric caps need less tracking
  if (alpha <= 0.003 || str === '' || str == null) return;
  const spr = textSprite(String(str), fontStr(weight, size, font), color, glow, blur, spacing, size);
  const ox = align === 'center' ? spr.w / 2 : align === 'right' || align === 'end' ? spr.w : 0;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * alpha;
  ctx.drawImage(spr.c, x - ox - spr.pad, y - spr.h / 2 - spr.pad, spr.c.width / (app.dpr || 1), spr.c.height / (app.dpr || 1));
  ctx.globalAlpha = prev;
}

/**
 * Creator signature in a flowing script face ("Great Vibes"), kept quiet:
 * small and low-contrast by default. Drawn only once the face has loaded, so
 * a fallback font is never baked into the text cache.
 */
export const CREDIT_FONT = '"Great Vibes"';
export function drawCredit(ctx, text, x, y, { size = 18, color = 'rgba(255,255,255,0.5)', glow = '#ffffff', blur = 0, alpha = 1, align = 'center' } = {}) {
  const ok = !document.fonts || document.fonts.check(`${size}px ${CREDIT_FONT}`);
  if (!ok) { document.fonts.load(`${size}px ${CREDIT_FONT}`).catch(() => {}); return; }
  glowText(ctx, text, x, y, { size, font: CREDIT_FONT, weight: 400, color, glow, blur, alpha, align });
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function glassPanel(ctx, x, y, w, h, { r = 22, alpha = 1, fill = 0.62 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = `rgba(10, 9, 32, ${fill})`; ctx.fill();
  const g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

/**
 * Luminous glass orb with optional glyph, label, dwell ring and hold ring.
 * `st` is the ui.target() result.
 */
export function drawOrb(ctx, x, y, r, st, { glyph = '', label = '', sub = '', color = app.theme.accent, glyphSize = 0, labelBelow = true, dim = false } = {}) {
  const t = app.t, hov = st.hover || 0, scale = 1 + hov * 0.12 + st.pulse * 0.25;
  const R = r * scale;
  ctx.save();
  ctx.globalAlpha = dim ? 0.45 : 1;
  // halo
  const halo = ctx.createRadialGradient(x, y, R * 0.6, x, y, R * 2.1);
  halo.addColorStop(0, rgba(color, 0.18 + hov * 0.25 + (st.primed ? 0.2 : 0)));
  halo.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, R * 2.1, 0, TAU); ctx.fill();
  // glass body
  const body = ctx.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R);
  body.addColorStop(0, 'rgba(255,255,255,0.32)');
  body.addColorStop(0.45, 'rgba(255,255,255,0.06)');
  body.addColorStop(1, rgba(color, 0.18));
  ctx.fillStyle = body; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', 0.28 + hov * 0.4); ctx.lineWidth = 1.2; ctx.stroke();
  // orbiting mote
  const ma = t * 1.3 + x * 0.01;
  ctx.fillStyle = rgba(color, 0.9);
  ctx.beginPath(); ctx.arc(x + Math.cos(ma) * R * 1.15, y + Math.sin(ma) * R * 1.15, 1.6 + hov, 0, TAU); ctx.fill();
  // dwell ring (gaze) and hold ring (pinch-hold)
  const ring = Math.max(st.dwell || 0, st.hold || 0);
  if (ring > 0.01) {
    ctx.strokeStyle = rgba(st.primed ? '#ffffff' : color, 0.95); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, R + 6, -Math.PI / 2, -Math.PI / 2 + ring * TAU); ctx.stroke();
  }
  if (st.primed) {
    ctx.strokeStyle = rgba(color, 0.5 + 0.5 * Math.sin(t * 8)); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, R + 11, 0, TAU); ctx.stroke();
  }
  if (glyph) {
    ctx.font = `${glyphSize || R * 0.85}px Sora, 'Segoe UI Symbol', 'Apple Symbols', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = color; ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(glyph, x, y + 1);
    ctx.shadowBlur = 0;
  }
  if (label) {
    const ly = labelBelow ? y + R + 18 : y;
    ctx.font = `500 ${clamp(r * 0.32, 10, 13)}px Inter, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = rgba('#ffffff', 0.6 + hov * 0.4);
    ctx.fillText(label.toUpperCase(), x, ly);
    if (sub) {
      ctx.font = `400 11px Inter, sans-serif`;
      ctx.fillStyle = rgba('#ffffff', 0.4 + hov * 0.3);
      ctx.fillText(sub, x, ly + 16);
    }
  }
  ctx.restore();
}

/** The awakening sigil used on the intro / loading screens and portals. */
export function drawSigil(ctx, x, y, r, t, { color = app.theme.accent, color2 = app.theme.accent2, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const rr = r * (1 - i * 0.18), rot = t * (i % 2 ? -0.25 : 0.18) + i;
    ctx.strokeStyle = rgba(i ? color2 : color, 0.55 - i * 0.12); ctx.lineWidth = i ? 1 : 1.6;
    ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
    for (let k = 0; k < 12 + i * 12; k++) {
      const a = rot + (k / (12 + i * 12)) * TAU, len = k % 3 ? 4 : 10;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      ctx.lineTo(x + Math.cos(a) * (rr - len), y + Math.sin(a) * (rr - len));
      ctx.stroke();
    }
  }
  // hexagram
  ctx.strokeStyle = rgba(color, 0.7); ctx.lineWidth = 1.4;
  for (let tri = 0; tri < 2; tri++) {
    ctx.beginPath();
    for (let k = 0; k <= 3; k++) {
      const a = t * 0.1 + tri * Math.PI / 3 + (k / 3) * TAU - Math.PI / 2;
      const px = x + Math.cos(a) * r * 0.5, py = y + Math.sin(a) * r * 0.5;
      k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
  const core = ctx.createRadialGradient(x, y, 0, x, y, r * 0.35);
  core.addColorStop(0, rgba('#ffffff', 0.6 + 0.3 * Math.sin(t * 2)));
  core.addColorStop(0.4, rgba(color, 0.35));
  core.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = core; ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, TAU); ctx.fill();
  ctx.restore();
}

/** Tiny pictograms for face expressions (used in Echoes of the Face). */
export function drawExprIcon(ctx, type, x, y, s, color = '#fff', alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, s * 0.09); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.stroke();
  ctx.fillStyle = color;
  const ey = y - s * 0.2;
  if (type === 'brows') {
    ctx.beginPath(); ctx.arc(x - s * 0.35, ey, s * 0.08, 0, TAU); ctx.arc(x + s * 0.35, ey, s * 0.08, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x - s * 0.35, ey - s * 0.05, s * 0.28, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + s * 0.35, ey - s * 0.05, s * 0.28, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - s * 0.25, y + s * 0.4); ctx.lineTo(x + s * 0.25, y + s * 0.4); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(x - s * 0.35, ey, s * 0.09, 0, TAU); ctx.arc(x + s * 0.35, ey, s * 0.09, 0, TAU); ctx.fill();
    if (type === 'smile') { ctx.beginPath(); ctx.arc(x, y + s * 0.05, s * 0.45, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
    else { ctx.beginPath(); ctx.ellipse(x, y + s * 0.38, s * 0.2, s * 0.26, 0, 0, TAU); ctx.stroke(); }
  }
  ctx.restore();
}

/**
 * The glowing rainbow "Kids Realm" gateway that leads to the Wonderland
 * Portal (wonderland/). `hover` 0..1, `dwell` 0..1 fill.
 */
export function drawKidsGateway(ctx, x, y, r, { hover = 0, pulse = 0, t = app.t } = {}) {
  const R = r * (1 + hover * 0.12 + pulse * 0.25 + Math.sin(t * 2) * 0.03);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(x, y, R * 0.3, x, y, R * 2.2);
  halo.addColorStop(0, `rgba(255,170,240,${0.35 + hover * 0.3})`);
  halo.addColorStop(1, 'rgba(255,170,240,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, R * 2.2, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  const body = ctx.createRadialGradient(x - R * 0.3, y - R * 0.35, R * 0.05, x, y, R);
  body.addColorStop(0, '#ffffff'); body.addColorStop(0.25, '#ffd6fb'); body.addColorStop(0.65, '#b98cff'); body.addColorStop(1, '#3a1d86');
  ctx.fillStyle = body; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
  // spinning rainbow rim
  ctx.lineWidth = Math.max(3, R * 0.12); ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const a0 = t * 1.4 + (i / 12) * TAU;
    ctx.strokeStyle = `hsl(${i * 30},100%,66%)`;
    ctx.beginPath(); ctx.arc(x, y, R * 1.12, a0, a0 + TAU / 12 + 0.02); ctx.stroke();
  }
  // four-point star
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2 + Math.sin(t) * 0.2, rr = i % 2 ? R * 0.14 : R * 0.5;
    i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
  glowText(ctx, 'KIDS REALM', x, y + R + 22, { size: 12, font: 'Inter', weight: 600, spacing: 2, color: rgba('#ffffff', 0.7 + hover * 0.3), glow: '#ff9ee6', blur: 8 });
}
