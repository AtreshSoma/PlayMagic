// ---------------------------------------------------------------------------
// Celestial & Mood Resonance astrolabe (top-right). A translucent zodiac
// wheel with live planetary positions, conjunction threads and the current
// lunar phase at its heart. Hover with hand or gaze to unfold the details;
// pinch / blink to pin it open.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { skyState, SIGNS, SIGN_GLYPHS } from '../core/celestial.js';
import { MOODS } from '../input/mood.js';
import { SCALES } from '../audio/audio.js';
import { TAU, rgba, rgbStr } from '../core/util.js';

const D2R = Math.PI / 180;

export function drawMoon(ctx, x, y, r, frac) {
  ctx.save();
  ctx.fillStyle = '#1c1b3a';
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  const waxing = frac < 0.5, k = Math.cos(frac * TAU); // 1 new → -1 full
  ctx.fillStyle = '#f2f0ff';
  ctx.shadowColor = '#f2f0ff'; ctx.shadowBlur = r * 0.6;
  ctx.beginPath();
  if (waxing) ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, false);
  else ctx.arc(x, y, r, Math.PI / 2, Math.PI * 1.5, false);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = k > 0 ? '#1c1b3a' : '#f2f0ff';
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, r * Math.abs(k)), r, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.restore();
}

export class Astrolabe {
  constructor() {
    this.el = document.getElementById('astrolabe');
    this.canvas = document.getElementById('astro-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.moonEl = document.getElementById('astro-moon');
    this.lineEl = document.getElementById('astro-line');
    this.detailEl = document.getElementById('astro-detail');
    this.sky = skyState(); this.skyT = 0; this.drawT = 1; this.detailT = 1;
    this.hoverT = 0; this.awayT = 0; this.pinned = false; this.expanded = false;
    this._text();
  }

  _text() {
    const s = this.sky;
    this.moonEl.textContent = `${s.phase.name} · ${Math.round(s.phase.illum * 100)}%`;
    this.lineEl.textContent = `☉︎ ${SIGNS[s.sun.sign]} · ☽︎ ${SIGNS[s.moon.sign]}`;
  }

  _detail() {
    const s = this.sky, mood = app.mood, sc = SCALES[app.audio.scaleKey];
    const rows = s.bodies.map((b) => `<div class="row"><span>${b.glyph} ${b.name}</span><span>${SIGN_GLYPHS[b.sign]} ${SIGNS[b.sign]} ${Math.floor(b.lon % 30)}°${b.retro ? ' <b class="retro">℞</b>' : ''}</span></div>`).join('');
    const conj = s.conj.slice(0, 2).map((c) => `<div class="row"><span>☌ ${c.a.name} · ${c.b.name}</span><span>${c.sep.toFixed(1)}°</span></div>`).join('');
    const moods = Object.entries(MOODS).map(([k, m]) => `<div class="moodbar"><span>${m.label}</span><i style="--c:${m.hex};--v:${mood.w[k].toFixed(2)}"></i></div>`).join('');
    this.detailEl.innerHTML = `<div class="astro-clip"><div class="glass">
      <h4>CELESTIAL ALIGNMENTS</h4>${rows}
      <div class="sep"></div>
      <div class="row"><span>Alignment</span><span>${s.alignment}</span></div>
      <div class="row"><span>Planetary spread</span><span>${Math.round(s.spread)}°</span></div>
      ${conj}${s.retro.length ? `<div class="row"><span>Retrograde</span><span class="retro">${s.retro.map((b) => b.name).join(', ')}</span></div>` : ''}
      <div class="sep"></div>
      <h4>MOOD RESONANCE</h4>${moods}
      <div class="row"><span>Harmonic scale</span><span>${sc.name}</span></div>
      <div class="row"><span>Tapestry flow</span><span>×${mood.flow.toFixed(2)}</span></div>
    </div></div>`;
  }

  update(dt) {
    this.skyT += dt;
    if (this.skyT > 30) { this.skyT = 0; this.sky = skyState(); this._text(); }
    const st = app.ui.targetEl('astrolabe', this.canvas, { layer: 'global', gazePad: 1.15, dwell: 0.5 });
    if (st.selected) this.pinned = !this.pinned;
    const hovering = st.handHover || st.gazeHover;
    if (hovering) { this.hoverT += dt; this.awayT = 0; } else { this.awayT += dt; this.hoverT = 0; }
    const want = this.pinned || this.hoverT > 0.25 || (this.expanded && this.awayT < 1.4);
    if (want !== this.expanded) { this.expanded = want; this.el.classList.toggle('expanded', want); if (want) this._detail(); }
    this.el.classList.toggle('hover', hovering);
    this.detailT += dt;
    if (this.expanded && this.detailT > 0.5) { this.detailT = 0; this._detail(); }
    this.drawT += dt;
    if (this.drawT > 1 / 20) { this.drawT = 0; this._draw(); }
  }

  _draw() {
    const ctx = this.ctx, S = this.canvas.width, c = S / 2, R = S * 0.46, t = app.t, s = this.sky;
    const acc = app.theme.accent;
    const pos = (lonDeg, r) => [c - Math.cos(lonDeg * D2R) * r, c + Math.sin(lonDeg * D2R) * r];
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    // mood aura
    const g = ctx.createRadialGradient(c, c, R * 0.3, c, c, R);
    g.addColorStop(0, rgbStr(app.mood.color, 0.0)); g.addColorStop(1, rgbStr(app.mood.color, 0.28));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.fill();
    // rotating decorative tick ring
    ctx.strokeStyle = rgba('#ffffff', 0.18); ctx.lineWidth = 1;
    for (let k = 0; k < 72; k++) {
      const a = t * 0.05 + (k / 72) * TAU, len = k % 6 ? 3 : 7;
      ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * R, c + Math.sin(a) * R); ctx.lineTo(c + Math.cos(a) * (R - len), c + Math.sin(a) * (R - len)); ctx.stroke();
    }
    // zodiac ring
    const zr = R * 0.8;
    ctx.strokeStyle = rgba(acc, 0.35);
    ctx.beginPath(); ctx.arc(c, c, R * 0.9, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(c, c, R * 0.7, 0, TAU); ctx.stroke();
    ctx.font = `${S * 0.055}px 'Segoe UI Symbol', 'Apple Symbols', serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let k = 0; k < 12; k++) {
      const [x1, y1] = pos(k * 30, R * 0.7), [x2, y2] = pos(k * 30, R * 0.9);
      ctx.strokeStyle = rgba('#ffffff', 0.15); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const [gx, gy] = pos(k * 30 + 15, zr);
      const active = k === s.sun.sign;
      ctx.fillStyle = active ? acc : rgba('#ffffff', 0.55);
      ctx.fillText(SIGN_GLYPHS[k], gx, gy);
    }
    // conjunction threads
    for (const cj of s.conj) {
      const [ax, ay] = pos(cj.a.lon, R * 0.55), [bx, by] = pos(cj.b.lon, R * 0.55);
      ctx.strokeStyle = rgba(acc, 0.7); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(ax, ay); ctx.moveTo(c, c); ctx.lineTo(bx, by); ctx.stroke();
    }
    // bodies (staggered radii to avoid overlap)
    const sorted = [...s.bodies].sort((a, b) => a.lon - b.lon);
    let lastLon = -99, ring = 0;
    ctx.font = `${S * 0.06}px 'Segoe UI Symbol', 'Apple Symbols', serif`;
    for (const b of sorted) {
      ring = b.lon - lastLon < 9 ? (ring + 1) % 3 : 0;
      lastLon = b.lon;
      const [x, y] = pos(b.lon, R * (0.56 - ring * 0.1));
      ctx.shadowColor = b.color; ctx.shadowBlur = 8;
      ctx.fillStyle = b.retro ? '#ff9db0' : b.color;
      ctx.fillText(b.glyph, x, y);
    }
    ctx.shadowBlur = 0;
    drawMoon(ctx, c, c, R * 0.17, s.phase.frac);
    ctx.restore();
  }
}
