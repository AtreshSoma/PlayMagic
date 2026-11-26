// ---------------------------------------------------------------------------
// LIGHT MIRROR · two-hand laser deflector
// A continuous beam fires from a screen edge. Each raised hand becomes a
// glowing mirror blade along the hand's axis (wrist → fingers), so tilting
// your wrist angles the reflection. Steer the beam into the floating crystal
// prisms; hold it there for a moment to shatter them. Every prism climbs a
// harmonic chord, and clearing a layout spawns a harder multi-bounce one:
// fixed crystal reflectors, dark absorbers, emitters on other edges.
// Points multiply with the number of bounces the beam took to get there.
//
// Pinch (or click) leaves a mirror pinned in place (up to 3) so one hand can
// build multi-bounce paths. Pinch a pinned mirror to remove it.
// Mouse: the mirror follows the cursor; scroll or hold Q / E to rotate.
// Touch: the mirror auto-aims at the nearest prism.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { GameBase, HUD_SUB_Y } from './base.js';
import { glowText } from '../ui/draw.js';
import { TAU, rand, clamp, dist, rgba, alphaFor, angleWrap } from '../core/util.js';

const MAX_BOUNCES = 10;
const CHARGE_TIME = 0.45;   // seconds of beam contact to shatter a prism
const MAX_PINNED = 3;

/** Distance from point to segment, plus the closest-point parameter. */
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
  const u = clamp(((px - ax) * dx + (py - ay) * dy) / L2);
  return Math.hypot(px - (ax + dx * u), py - (ay + dy * u));
}
const beamColor = (b) => `hsl(${(188 + b * 38) % 360}, 100%, 70%)`;

export class LightMirrorGame extends GameBase {
  constructor() {
    super('lightmirror', 'Light Mirror');
    this.duration = 90; this.maxLives = 0;
    this.allow = { swipe: false, runes: false, faceMagic: false, chimes: false, overlays: true, scatter: false, tilt: false, snapshot: false };
    this.cues = [{ cue: 'tiltHand', key: 'Q / E' }, { cue: 'twoPalms', key: 'Move' }, { cue: 'pinch', key: 'Click' }];
  }

  playCoach() {
    return app.mode === 'camera'
      ? { icon: 'palm', html: '<b>Raise a hand</b> and tilt it to bend the beam<small>Pinch to pin a mirror · two hands = two mirrors</small>' }
      : { icon: 'pinch', html: '<b>Scroll</b> or hold <b>Q / E</b> to turn the mirror<small>Click to pin a mirror where it is</small>' };
  }

  reset() {
    this.level = 0; this.cleared = 0; this.chordStep = 0;
    this.pinned = []; this.mouseAngle = -0.7; this.segs = []; this.sparks = [];
    this.trans = 0;
    this.layout();
  }

  // ------------------------------------------------------------------ layout
  layout() {
    const W = app.W, H = app.H, L = this.level;
    const top = 165, bottom = H - 140, margin = 90;
    const edge = L === 0 ? 0 : Math.floor(rand(4));
    const u = rand(0.3, 0.7);
    const em = [
      { x: 0, y: top + (bottom - top) * u }, { x: W * u, y: 0 },
      { x: W, y: top + (bottom - top) * u }, { x: W * u, y: H },
    ][edge];
    const aim = Math.atan2(H / 2 - em.y + rand(-80, 80), W / 2 - em.x + rand(-80, 80));
    this.emitter = { x: em.x, y: em.y, a: aim, edge };

    const placed = [];
    const ok = (x, y, r, avoidLine) => {
      if (x < margin || x > W - margin || y < top || y > bottom) return false;
      for (const p of placed) if (dist(x, y, p.x, p.y) < r + p.r + 70) return false;
      if (avoidLine) {
        const lx = em.x + Math.cos(aim) * 3000, ly = em.y + Math.sin(aim) * 3000;
        if (segDist(x, y, em.x, em.y, lx, ly) < r + 60) return false;
      }
      return true;
    };
    const place = (r, avoidLine) => {
      for (let tries = 0; tries < 200; tries++) {
        const x = rand(margin, W - margin), y = rand(top, bottom);
        if (ok(x, y, r, avoidLine && tries < 150)) { const p = { x, y, r }; placed.push(p); return p; }
      }
      const p = { x: rand(margin, W - margin), y: rand(top, bottom), r }; placed.push(p); return p;
    };
    const nPrism = Math.min(1 + Math.floor(L / 1.5), 4);
    const nCrystal = L >= 2 ? Math.min(1 + Math.floor((L - 2) / 2), 3) : 0;
    const nBlock = L >= 3 ? Math.min(1 + Math.floor((L - 3) / 2), 3) : 0;
    this.prisms = Array.from({ length: nPrism }, () => {
      const p = place(26, true);
      return { x: p.x, y: p.y, r: 26, charge: 0, lit: false, litB: 0, dead: false, rot: rand(TAU), born: 0 };
    });
    this.crystals = Array.from({ length: nCrystal }, () => {
      const p = place(55, false);
      return { x: p.x, y: p.y, len: 120, a: rand(TAU), spin: L >= 5 ? rand(-0.35, 0.35) : 0 };
    });
    this.blockers = Array.from({ length: nBlock }, () => { const p = place(30, false); return { x: p.x, y: p.y, r: 30 }; });
  }

  // ------------------------------------------------------------------ mirrors
  /** Every reflective segment this frame: hand mirrors, mouse mirror, pinned, crystals. */
  mirrors() {
    const inp = app.input, list = [], k = clamp(Math.min(app.W, app.H) / 900, 0.75, 1.25);
    for (const h of inp.hands) {
      if (!h.present) continue;
      const half = 85 * k, dx = Math.sin(h.angle) * half, dy = -Math.cos(h.angle) * half;
      list.push({ ax: h.palmX - dx, ay: h.palmY - dy, bx: h.palmX + dx, by: h.palmY + dy, kind: 'hand', a: h.angle, cx: h.palmX, cy: h.palmY });
    }
    const m = inp.mouseHand;
    if (m.present && (!inp.cameraHandsPresent || app.t - inp.fb.lastMove < 1.5)) {
      const half = 80 * k, a = this.mouseAngle, dx = Math.sin(a) * half, dy = -Math.cos(a) * half;
      list.push({ ax: m.x - dx, ay: m.y - dy, bx: m.x + dx, by: m.y + dy, kind: 'mouse', a, cx: m.x, cy: m.y });
    }
    for (const p of this.pinned) {
      const dx = Math.sin(p.a) * p.half, dy = -Math.cos(p.a) * p.half;
      list.push({ ax: p.x - dx, ay: p.y - dy, bx: p.x + dx, by: p.y + dy, kind: 'pinned', a: p.a, cx: p.x, cy: p.y });
    }
    for (const c of this.crystals) {
      const dx = Math.cos(c.a) * c.len / 2, dy = Math.sin(c.a) * c.len / 2;
      list.push({ ax: c.x - dx, ay: c.y - dy, bx: c.x + dx, by: c.y + dy, kind: 'crystal', cx: c.x, cy: c.y });
    }
    return list;
  }

  /** Ray-trace the beam through mirrors; returns coloured segments with bounce counts. */
  trace(mirrors) {
    const W = app.W, H = app.H, out = [], hitsAt = [];
    let x = this.emitter.x, y = this.emitter.y, dx = Math.cos(this.emitter.a), dy = Math.sin(this.emitter.a);
    let last = null;
    for (let b = 0; b <= MAX_BOUNCES; b++) {
      // distance to the screen edge (with a small overshoot)
      let tMin = Infinity;
      if (dx > 1e-6) tMin = Math.min(tMin, (W + 20 - x) / dx); else if (dx < -1e-6) tMin = Math.min(tMin, (-20 - x) / dx);
      if (dy > 1e-6) tMin = Math.min(tMin, (H + 20 - y) / dy); else if (dy < -1e-6) tMin = Math.min(tMin, (-20 - y) / dy);
      let hit = null, absorbed = false;
      for (const m of mirrors) {
        if (m === last) continue;
        const ex = m.bx - m.ax, ey = m.by - m.ay, den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-6) continue;
        const t = ((m.ax - x) * ey - (m.ay - y) * ex) / den;
        const u = ((m.ax - x) * dy - (m.ay - y) * dx) / den;
        if (t > 0.5 && t < tMin && u >= 0 && u <= 1) { tMin = t; hit = m; }
      }
      for (const o of this.blockers) {
        const fx = x - o.x, fy = y - o.y, bq = fx * dx + fy * dy, c = fx * fx + fy * fy - o.r * o.r, disc = bq * bq - c;
        if (disc < 0) continue;
        const t = -bq - Math.sqrt(disc);
        if (t > 0.5 && t < tMin) { tMin = t; hit = null; absorbed = true; }
      }
      const nx = x + dx * tMin, ny = y + dy * tMin;
      out.push({ x0: x, y0: y, x1: nx, y1: ny, b });
      if (!hit) { if (absorbed) hitsAt.push({ x: nx, y: ny, absorbed: true }); break; }
      // reflect about the mirror's normal
      const ex = hit.bx - hit.ax, ey = hit.by - hit.ay, el = Math.hypot(ex, ey) || 1;
      const mx = -ey / el, my = ex / el, d = dx * mx + dy * my;
      dx -= 2 * d * mx; dy -= 2 * d * my;
      x = nx; y = ny; last = hit;
      hitsAt.push({ x, y, b: b + 1 });
    }
    this.reflections = hitsAt;
    return out;
  }

  // ------------------------------------------------------------------ play
  play(dt) {
    const inp = app.input, fb = inp.fb, W = app.W, H = app.H;
    // Mouse mirror rotation: wheel, Q/E, or touch auto-aim.
    if (fb.held('KeyQ')) this.mouseAngle -= 2.4 * dt;
    if (fb.held('KeyE')) this.mouseAngle += 2.4 * dt;
    for (const e of inp.events) if (e.type === 'zoom') this.mouseAngle += Math.log(e.factor) * 4;
    if (fb.pointerType === 'touch' && inp.mouseHand.present) this.autoAim(dt);

    // Pin / unpin mirrors with a pinch or click.
    for (const e of inp.events) {
      if (e.type !== 'pinchStart') continue;
      const near = this.pinned.findIndex((p) => dist(p.x, p.y, e.x, e.y) < 46);
      if (near >= 0) { this.pinned.splice(near, 1); app.audio.tick(0, 0.3); continue; }
      const src = this.mirrors().find((m) => (m.kind === 'hand' || m.kind === 'mouse') && dist(m.cx, m.cy, e.x, e.y) < 140);
      if (!src) continue;
      this.pinned.push({ x: src.cx, y: src.cy, a: src.a, half: Math.hypot(src.bx - src.ax, src.by - src.ay) / 2, born: app.t });
      if (this.pinned.length > MAX_PINNED) this.pinned.shift();
      app.audio.lock((src.cx / W) * 2 - 1);
      app.fx.shockwave(src.cx, src.cy, { color: this.accent, r1: 70, dur: 0.4, width: 2 });
    }

    for (const c of this.crystals) c.a += c.spin * dt;
    const mirrors = this.mirrors();
    this.segs = this.trace(mirrors);

    // Prism contact → charge → shatter.
    if (this.trans > 0) { this.trans -= dt; if (this.trans <= 0) this.layout(); return; }
    for (const p of this.prisms) {
      if (p.dead) continue;
      p.born += dt; p.rot += dt * (p.lit ? 2.4 : 0.5);
      p.lit = false; p.litB = 0;
      for (const s of this.segs) if (segDist(p.x, p.y, s.x0, s.y0, s.x1, s.y1) < p.r) { p.lit = true; p.litB = Math.max(p.litB, s.b); }
      p.charge = p.lit ? p.charge + dt / CHARGE_TIME : Math.max(0, p.charge - dt * 0.8);
      if (p.lit && Math.random() < 0.4) app.particles.spawn(p.x + rand(-p.r, p.r), p.y + rand(-p.r, p.r), rand(-40, 40), rand(-60, 0), 0.5, rand(1, 2.5), '#ffffff', 5, 0, 0.95, 0);
      if (p.charge >= 1) this.shatter(p);
    }
    if (this.prisms.every((p) => p.dead)) {
      this.cleared++; this.level++;
      this.time = Math.min(this.duration, this.time + 6);
      app.fx.text(W / 2, H * 0.3, `Layout ${this.level + 1}`, { color: this.accent, size: 26, dur: 1.2 });
      app.fx.text(W / 2, H * 0.3 + 30, '+6 s', { color: '#ffffff', size: 14, font: 'Inter', dur: 1.2 });
      app.audio.victory();
      this.trans = 0.9;
    }
    // Sparks where the beam bounces.
    for (const r of this.reflections) if (!r.absorbed && Math.random() < 0.35) {
      app.particles.spawn(r.x, r.y, rand(-120, 120), rand(-120, 120), rand(0.25, 0.5), rand(1, 2.4), '#bff8ff', 5, 0, 0.9, 0);
    }
  }

  shatter(p) {
    p.dead = true;
    const bounces = p.litB, gain = 100 * (1 + bounces) * this.mult;
    this.score += gain;
    this.hit();
    app.audio.harmonic(this.chordStep++, (p.x / app.W) * 2 - 1);
    app.audio.shatter((p.x / app.W) * 2 - 1, 0.5);
    app.particles.emit({ x: p.x, y: p.y, count: 60, speed: [120, 520], life: [0.6, 1.4], size: [1.5, 4.5], colors: ['#7ff3ff', '#d4a8ff', '#ffffff', '#ffd6f5'], kind: 3, raw: true });
    app.fx.shockwave(p.x, p.y, { color: this.accent, r1: 140, dur: 0.6 });
    app.fx.text(p.x, p.y - 34, bounces ? `+${gain} · ${bounces} bounce${bounces > 1 ? 's' : ''}` : `+${gain}`, { color: '#ffffff', size: 17, font: 'Inter', weight: 600 });
    app.tapestry.ripple(p.x, p.y);
  }

  /** Touch players: rotate the mirror so the beam reflects toward the nearest live prism. */
  autoAim(dt) {
    const m = app.input.mouseHand, e = this.emitter;
    const target = this.prisms.filter((p) => !p.dead).sort((a, b) => dist(a.x, a.y, m.x, m.y) - dist(b.x, b.y, m.x, m.y))[0];
    if (!target) return;
    const inA = Math.atan2(m.y - e.y, m.x - e.x), outA = Math.atan2(target.y - m.y, target.x - m.x);
    const ix = Math.cos(inA), iy = Math.sin(inA), ox = Math.cos(outA), oy = Math.sin(outA);
    const nx = ox - ix, ny = oy - iy; // mirror normal bisects the turn
    // blade direction (sin a, −cos a) must be perpendicular to the normal (nx, ny)
    const want = Math.atan2(-ny, -nx);
    this.mouseAngle += angleWrap(want - this.mouseAngle) * alphaFor(dt, 0.15);
  }

  resultTitle() { return `${this.cleared} LAYOUT${this.cleared === 1 ? '' : 'S'} CLEARED`; }

  // ------------------------------------------------------------------ draw
  drawBack(ctx) {
    if (this.state === 'intro') return;
    const t = app.t, e = this.emitter;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // blockers (absorb light)
    for (const o of this.blockers) {
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createRadialGradient(o.x, o.y, 2, o.x, o.y, o.r);
      g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(0.8, 'rgba(10,0,25,0.92)'); g.addColorStop(1, 'rgba(120,60,255,0.6)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba('#9a6bff', 0.6 + 0.2 * Math.sin(t * 3)); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r + 4, 0, TAU); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    // crystals (fixed mirrors)
    for (const c of this.crystals) {
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a);
      const L = c.len / 2;
      ctx.fillStyle = 'rgba(160, 240, 255, 0.16)';
      ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(0, -9); ctx.lineTo(L, 0); ctx.lineTo(0, 9); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(200, 250, 255, 0.85)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.stroke();
      ctx.restore();
    }
    // prisms
    for (const p of this.prisms) {
      if (p.dead) continue;
      const s = Math.min(1, p.born * 4), R = p.r * s * (1 + (p.lit ? 0.08 * Math.sin(t * 30) : 0));
      const glow = R * (2.4 + p.charge * 1.6);
      ctx.globalAlpha = 0.5 + p.charge * 0.5;
      ctx.drawImage(app.particles.spriteCanvas(p.lit ? '#ffffff' : '#9feaff'), p.x - glow, p.y - glow, glow * 2, glow * 2);
      ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.strokeStyle = rgba('#e6fbff', 0.9); ctx.lineWidth = 1.6; ctx.fillStyle = 'rgba(140, 220, 255, 0.12)';
      ctx.beginPath();
      for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; k ? ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R) : ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = rgba('#d4a8ff', 0.6); ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R); ctx.lineTo(Math.cos(a + Math.PI) * R, Math.sin(a + Math.PI) * R); ctx.stroke(); }
      ctx.restore();
      if (p.charge > 0.01) {
        ctx.strokeStyle = rgba('#ffffff', 0.95); ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 10, -Math.PI / 2, -Math.PI / 2 + p.charge * TAU); ctx.stroke();
      }
    }
    // emitter
    const ex = clamp(e.x, 6, app.W - 6), ey = clamp(e.y, 6, app.H - 6);
    ctx.drawImage(app.particles.spriteCanvas('#7ff3ff'), ex - 40, ey - 40, 80, 80);
    ctx.strokeStyle = rgba('#ffffff', 0.8); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ex, ey, 12 + Math.sin(t * 6) * 2, 0, TAU); ctx.stroke();
    // beam
    ctx.lineCap = 'round';
    const flick = 1 + Math.sin(t * 40) * 0.12;
    for (const s of this.segs) {
      const col = beamColor(s.b);
      ctx.strokeStyle = col; ctx.globalAlpha = 0.14; ctx.lineWidth = 18 * flick;
      ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x1, s.y1); ctx.stroke();
      ctx.globalAlpha = 0.55; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x1, s.y1); ctx.stroke();
      ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x1, s.y1); ctx.stroke();
    }
    for (const r of this.reflections || []) {
      const g = r.absorbed ? 18 : 30;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(app.particles.spriteCanvas(r.absorbed ? '#9a6bff' : '#ffffff'), r.x - g, r.y - g, g * 2, g * 2);
    }
    ctx.restore();
  }

  drawFront(ctx) {
    if (this.state === 'play') {
      const t = app.t;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const m of this.mirrors()) {
        if (m.kind === 'crystal') continue;
        const pinned = m.kind === 'pinned';
        ctx.strokeStyle = rgba(this.accent, pinned ? 0.25 : 0.35); ctx.lineWidth = 14;
        ctx.beginPath(); ctx.moveTo(m.ax, m.ay); ctx.lineTo(m.bx, m.by); ctx.stroke();
        ctx.strokeStyle = rgba('#e8fcff', 0.95); ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(m.ax, m.ay); ctx.lineTo(m.bx, m.by); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        for (const [px, py] of [[m.ax, m.ay], [m.bx, m.by]]) { ctx.beginPath(); ctx.arc(px, py, 3.5, 0, TAU); ctx.fill(); }
        if (pinned) { ctx.strokeStyle = rgba(this.accent, 0.5 + 0.3 * Math.sin(t * 4)); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(m.cx, m.cy, 9, 0, TAU); ctx.stroke(); }
      }
      ctx.restore();
      glowText(ctx, `LAYOUT ${this.level + 1}`, app.W / 2, HUD_SUB_Y, { size: 10, font: 'Inter', weight: 600, spacing: 3, color: 'rgba(255,255,255,0.55)', blur: 0 });
    }
    super.drawFront(ctx);
  }
}
