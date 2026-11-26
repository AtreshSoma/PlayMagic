// ---------------------------------------------------------------------------
// Transient visual effects: shockwaves, floating text, golden smile bloom,
// rune spells (Shield Pulse, Prism Beam, Vortex), fizzles and screen flashes.
// Each effect is a tiny closure {t, dur, draw(ctx, progress)}.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { fontStr } from '../ui/draw.js';
import { TAU, clamp, lerp, rand, rgba, easeOutCubic, easeOutBack } from '../core/util.js';

export class Effects {
  constructor() { this.list = []; this.flashA = 0; this.flashColor = '#ffffff'; this.shake = 0; }

  add(dur, draw, extra = {}) { const e = { t: 0, dur, draw, ...extra }; this.list.push(e); return e; }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i]; e.t += dt;
      e.update?.(dt, e);
      if (e.t >= e.dur) this.list.splice(i, 1);
    }
    this.flashA = Math.max(0, this.flashA - dt * 2.2);
    this.shake = Math.max(0, this.shake - dt * 2.5);
  }

  draw(ctx) {
    for (const e of this.list) { ctx.save(); e.draw(ctx, clamp(e.t / e.dur), e); ctx.restore(); }
  }
  drawFlash(ctx) {
    if (this.flashA <= 0.002) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(this.flashColor, this.flashA * 0.5);
    ctx.fillRect(0, 0, app.W, app.H); ctx.restore();
  }
  flash(color, a = 0.35) { this.flashColor = color; this.flashA = Math.max(this.flashA, a); }

  // ------------------------------------------------------------------ basics
  shockwave(x, y, { color = app.theme.accent, r0 = 8, r1 = 150, dur = 0.7, width = 3 } = {}) {
    this.add(dur, (ctx, p) => {
      const r = lerp(r0, r1, easeOutCubic(p));
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(color, (1 - p) * 0.9); ctx.lineWidth = width * (1 - p) + 0.6;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = rgba('#ffffff', (1 - p) * 0.45); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, r * 0.7, 0, TAU); ctx.stroke();
    });
  }

  text(x, y, str, { color = '#ffffff', size = 22, dur = 1.1, rise = 40, font = 'Cinzel', weight = 600 } = {}) {
    this.add(dur, (ctx, p) => {
      const a = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
      const s = p < 0.15 ? easeOutBack(p / 0.15) : 1;
      ctx.globalAlpha = clamp(a);
      ctx.font = fontStr(weight, size * s, font);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = color; ctx.shadowBlur = 18;
      ctx.fillStyle = color; ctx.fillText(str, x, y - rise * easeOutCubic(p));
    });
  }

  /** Golden radial filaments — the smile bloom. */
  bloom(x, y, { color = '#ffd479', count = 36, reach = 0 } = {}) {
    const R = reach || Math.hypot(app.W, app.H) * 0.45;
    const fil = Array.from({ length: count }, (_, i) => ({
      a: (i / count) * TAU + rand(-0.08, 0.08), len: R * rand(0.45, 1), curl: rand(-1.4, 1.4), w: rand(0.8, 2.4), d: rand(0, 0.15),
    }));
    this.add(1.9, (ctx, p) => {
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const f of fil) {
        const q = clamp((p - f.d) / 0.45), fade = 1 - clamp((p - 0.35) / 0.65);
        if (q <= 0 || fade <= 0) continue;
        const grow = easeOutCubic(q);
        ctx.strokeStyle = rgba(color, 0.75 * fade); ctx.lineWidth = f.w * fade + 0.3;
        ctx.beginPath();
        let px = x, py = y;
        ctx.moveTo(px, py);
        for (let s = 1; s <= 14; s++) {
          const u = (s / 14) * grow, r = u * f.len, ang = f.a + f.curl * u * u;
          px = x + Math.cos(ang) * r; py = y + Math.sin(ang) * r;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.fillStyle = rgba('#fff6d8', 0.9 * fade);
        ctx.beginPath(); ctx.arc(px, py, 1.6 + f.w * 0.6, 0, TAU); ctx.fill();
      }
      const core = (1 - p) * 0.6;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 120);
      g.addColorStop(0, rgba(color, core)); g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 120, 0, TAU); ctx.fill();
    });
  }

  // ------------------------------------------------------------------ spells
  /** ◯ Shield Pulse: a hexagonal glyph ward that blooms to fill the screen. */
  shield(x, y, size, color = app.theme.accent) {
    const maxR = Math.hypot(app.W, app.H);
    this.add(1.6, (ctx, p) => {
      ctx.globalCompositeOperation = 'lighter';
      const r = lerp(size * 0.5, maxR, easeOutCubic(p)), a = 1 - p;
      for (let ring = 0; ring < 3; ring++) {
        const rr = r * (1 - ring * 0.12), rot = p * (ring % 2 ? -1 : 1) * 1.2 + ring * 0.3;
        ctx.strokeStyle = rgba(ring ? '#ffffff' : color, a * (ring ? 0.35 : 0.9));
        ctx.lineWidth = ring ? 1 : 3 * a + 1;
        ctx.beginPath();
        for (let k = 0; k <= 6; k++) {
          const ang = rot + (k / 6) * TAU;
          const px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr;
          k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
      // glyph ticks around the inner ward
      const ri = Math.min(r, size * 0.9 + p * 120);
      ctx.strokeStyle = rgba(color, a);
      ctx.lineWidth = 2;
      for (let k = 0; k < 24; k++) {
        const ang = (k / 24) * TAU - p * 2, len = k % 3 ? 6 : 14;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(ang) * ri, y + Math.sin(ang) * ri);
        ctx.lineTo(x + Math.cos(ang) * (ri + len), y + Math.sin(ang) * (ri + len));
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(color, 0)); g.addColorStop(0.85, rgba(color, 0.12 * a)); g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    });
  }

  /** △ Prism Beam: white light enters the triangle and fans into a spectrum. */
  prism(x, y, size, dir = 0) {
    const L = Math.hypot(app.W, app.H);
    const hues = ['#ff4b6e', '#ff9d42', '#ffe45c', '#5cff8f', '#4fd8ff', '#6c7bff', '#c86bff'];
    this.add(1.8, (ctx, p) => {
      ctx.globalCompositeOperation = 'lighter';
      const a = p < 0.1 ? p / 0.1 : 1 - (p - 0.1) / 0.9;
      const s = size * 0.5;
      // incoming white beam
      const bx = x - Math.cos(dir) * L, by = y - Math.sin(dir) * L;
      ctx.strokeStyle = rgba('#ffffff', 0.8 * a); ctx.lineWidth = 6 * a + 1;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(x, y); ctx.stroke();
      // prism triangle
      ctx.strokeStyle = rgba('#ffffff', a); ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let k = 0; k <= 3; k++) {
        const ang = dir + p * 0.6 + (k / 3) * TAU - Math.PI / 2;
        const px = x + Math.cos(ang) * s, py = y + Math.sin(ang) * s;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
      // dispersed spectrum
      const spread = 0.5 + 0.15 * Math.sin(p * 8);
      hues.forEach((h, i) => {
        const ang = dir + (i / (hues.length - 1) - 0.5) * spread;
        const ex = x + Math.cos(ang) * L, ey = y + Math.sin(ang) * L;
        const grd = ctx.createLinearGradient(x, y, ex, ey);
        grd.addColorStop(0, rgba(h, 0.9 * a)); grd.addColorStop(1, rgba(h, 0));
        ctx.strokeStyle = grd; ctx.lineWidth = 10 * a + 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
      });
    }, { kind: 'beam', x, y, dir, spread: 0.6 });
  }

  /** ꩜ Vortex: rotating spiral arms that inhale light, then burst. */
  vortex(x, y, size, color = app.theme.accent2) {
    this.add(2.6, (ctx, p) => {
      ctx.globalCompositeOperation = 'lighter';
      const a = p < 0.1 ? p / 0.1 : p > 0.85 ? (1 - p) / 0.15 : 1;
      const R = size * (0.6 + 0.8 * Math.sin(Math.min(p, 0.85) / 0.85 * Math.PI * 0.5));
      for (let arm = 0; arm < 5; arm++) {
        ctx.strokeStyle = rgba(arm % 2 ? '#ffffff' : color, 0.55 * a);
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let s = 0; s <= 40; s++) {
          const u = s / 40, ang = arm * (TAU / 5) + u * 5.5 - p * 14, r = R * (1 - u);
          const px = x + Math.cos(ang) * r, py = y + Math.sin(ang) * r;
          s ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(x, y, 0, x, y, R * 0.5);
      g.addColorStop(0, rgba('#ffffff', 0.5 * a)); g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 0.5, 0, TAU); ctx.fill();
    }, { kind: 'vortex', x, y });
  }

  /** Failed rune: the stroke greys out and crumbles. */
  fizzle(pts) {
    if (!pts || pts.length < 2) return;
    const copy = pts.map((p) => ({ x: p.x, y: p.y, vx: rand(-30, 30), vy: rand(-10, 50) }));
    this.add(0.9, (ctx, p) => {
      const dt = app.dt;
      for (const q of copy) { q.x += q.vx * dt; q.y += q.vy * dt; }
      ctx.strokeStyle = rgba('#a9a4c8', (1 - p) * 0.7); ctx.lineWidth = 2; ctx.setLineDash([3, 7]);
      ctx.beginPath(); copy.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
    });
  }

  /** Recognised rune: draw the ideal shape over the stroke for confirmation. */
  runeGhost(shape, x, y, size, color = app.theme.accent) {
    this.add(0.9, (ctx, p) => {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(color, (1 - p)); ctx.lineWidth = 4 * (1 - p) + 1;
      ctx.shadowColor = color; ctx.shadowBlur = 20;
      const r = size * 0.5 * (1 + p * 0.25);
      ctx.beginPath();
      if (shape === 'circle') ctx.arc(x, y, r, 0, TAU);
      else if (shape === 'triangle') for (let k = 0; k <= 3; k++) { const a = -Math.PI / 2 + (k / 3) * TAU; k ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      else for (let s = 0; s <= 60; s++) { const u = s / 60, a = u * TAU * 2.2, rr = r * u; s ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x, y); }
      ctx.stroke();
    });
  }

  /** Small label that pops near a body part when a facial trigger fires. */
  glyphFlash(x, y, label, color = app.theme.accent) {
    this.text(x, y, label, { color, size: 13, dur: 1, rise: 28, font: 'Inter', weight: 600 });
  }
}
