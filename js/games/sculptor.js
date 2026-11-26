// ---------------------------------------------------------------------------
// GRAVITY SCULPTOR · interactive physics sandbox
//   pinch & hold   a glowing planet forms at your fingertips and grows
//   release/flick  launches it; a gentle release gets an automatic orbital
//                  nudge so first-timers see orbits straight away
//   quick pinch    a puff of stardust orbs
//   fist (held)    your hand becomes a black hole that bends orbits and
//                  swallows whatever crosses its horizon
//   open palm      held open for a moment → supernova repel wave
//   head tilt      shifts the room's gravity sideways
//   peace sign     freezes / unfreezes time
//   double blink   clears the sky
// Bodies attract toward the central star, merge when they collide, and
// earn "orbit" points for every full lap around the star.
// Mouse: drag to launch · F black hole · H supernova · P freeze · A/D tilt ·
// Space-Space reset.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { GameBase, HUD_Y } from './base.js';
import { glowText } from '../ui/draw.js';
import { TAU, rand, clamp, dist, rgba, pick, angleWrap } from '../core/util.js';

const G = 2.2e6;          // star gravity (px³/s²)
const HOLE = 5e6;         // black-hole gravity
const MAX_BODIES = 60;
const TRAIL = 26;
const PALETTE = ['#ffd36e', '#7ff3ff', '#ff9be8', '#b69bff', '#9dff9a', '#ffb46b', '#ffffff'];

export class SculptorGame extends GameBase {
  constructor() {
    super('sculptor', 'Gravity Sculptor');
    this.duration = Infinity; this.maxLives = 0;
    this.allow = { swipe: false, runes: false, faceMagic: false, chimes: false, overlays: true, scatter: false, snapshot: false, gravity: false, doubleBlink: false, tilt: true };
    this.cues = [{ cue: 'flick', key: 'Drag' }, { cue: 'fist', key: 'F' }, { cue: 'open', key: 'H' }, { cue: 'tilt', key: 'A / D' }];
  }

  playCoach() {
    return app.mode === 'camera'
      ? { icon: 'pinch', html: '<b>Pinch & flick</b> to launch planets<small>Fist = black hole · open palm = supernova · ✌ freeze · double blink clears</small>' }
      : { icon: 'pinch', html: '<b>Drag & release</b> to launch planets<small>F black hole · H supernova · P freeze · Space twice clears</small>' };
  }

  reset() {
    this.bodies = []; this.forming = new Map(); this.holes = new Map(); this.palmT = new Map();
    this.frozen = false; this.orbits = 0; this.swallowed = 0; this.star = { pulse: 0 };
    this.novaCool = 0;
    // a starter planet so the sky is never empty
    const s = this.starPos();
    this.addBody(s.x + 220, s.y, 0, -Math.sqrt(G / 220), 12, PALETTE[1]);
  }

  starPos() { return { x: app.W / 2, y: app.H * 0.48 }; }

  addBody(x, y, vx, vy, r, col) {
    if (this.bodies.length >= MAX_BODIES) this.bodies.shift();
    const s = this.starPos();
    const b = { x, y, vx, vy, r, m: r * r * r, col, trail: [], ang: Math.atan2(y - s.y, x - s.x), lap: 0, born: app.t };
    this.bodies.push(b);
    return b;
  }

  /** Give a slow release a circular-orbit velocity around the star (beginner assist). */
  orbitVelocity(x, y, vx, vy) {
    const s = this.starPos(), dx = x - s.x, dy = y - s.y, r = Math.max(60, Math.hypot(dx, dy));
    const v = Math.sqrt(G / r), dir = (dx * vy - dy * vx) >= 0 ? 1 : -1;
    return { vx: (-dy / r) * v * dir + vx * 0.3, vy: (dx / r) * v * dir + vy * 0.3 };
  }

  play(dt) {
    const inp = app.input, W = app.W, H = app.H, s = this.starPos();
    this.novaCool -= dt;
    this.star.pulse = Math.max(0, this.star.pulse - dt * 2);

    for (const e of inp.events) {
      if (e.type === 'peace') { this.frozen = !this.frozen; app.audio.freeze(); app.fx.flash('#bfe8ff', 0.18); app.fx.text(W / 2, H * 0.22, this.frozen ? 'Time frozen' : 'Time flows', { color: '#bfe8ff', size: 20 }); }
      else if (e.type === 'doubleBlink') this.clear();
      else if (e.type === 'pinchStart') {
        const h = inp.allHands().find((x) => x.label === e.hand) || inp.mouseHand;
        this.forming.set(e.hand, { x: e.x, y: e.y, r: 4, t: 0, col: pick(PALETTE), hand: h });
        app.audio.chime(app.audio.noteFromY(e.y / H, 1), { vel: 0.2, dur: 0.8, pan: (e.x / W) * 2 - 1 });
      } else if (e.type === 'pinchEnd') this.release(e.hand);
      else if (e.type === 'palmOpen' && e.key) this.supernova(e.x, e.y); // keyboard H
      else if (e.type === 'fistHoldStart') { this.holes.set(e.hand, { x: e.x, y: e.y, t: 0 }); app.audio.well((e.x / W) * 2 - 1); }
      else if (e.type === 'fistHoldEnd') { const hl = this.holes.get(e.hand); this.holes.delete(e.hand); if (hl) { app.particles.emit({ x: hl.x, y: hl.y, count: 40, speed: [100, 380], colors: ['#b69bff', '#ffffff'], raw: true }); app.audio.release(0); } }
    }

    // Camera palms: held open ≥ 0.35 s, not right after a pinch release → supernova.
    for (const h of inp.hands) {
      const t0 = (this.palmT.get(h) || 0);
      const lastPinch = h.lastPinchEnd || -10;
      const tt = h.present && h.open && app.t - lastPinch > 0.7 ? t0 + dt : 0;
      this.palmT.set(h, tt);
      if (tt > 0.35 && t0 <= 0.35 && this.novaCool <= 0) this.supernova(h.palmX, h.palmY);
    }

    // Forming planets follow their hand and grow.
    for (const [label, f] of this.forming) {
      f.t += dt;
      const h = f.hand;
      if (h && h.present) { f.x = h.x; f.y = h.y; }
      f.r = Math.min(24, 4 + f.t * 14);
      if (Math.random() < 0.5) app.particles.spawn(f.x + rand(-f.r * 2, f.r * 2), f.y + rand(-f.r * 2, f.r * 2), 0, 0, 0.4, rand(1, 2), f.col, 0, 0, 0.9, 0);
      if (!h || !h.present) this.release(label);
    }

    // Black holes track their fist.
    for (const [label, hl] of this.holes) {
      const h = inp.allHands().find((x) => x.label === label);
      if (h && h.present) { hl.x = h.source === 'mouse' ? h.x : h.palmX; hl.y = h.source === 'mouse' ? h.y : h.palmY; }
      hl.t += dt;
    }

    if (this.frozen) return;

    // Room gravity from head tilt (sideways, grows with tilt).
    const tilt = clamp(inp.vals.tilt, -0.7, 0.7);
    const gx = Math.sin(tilt * 1.4) * 260, gy = (1 - Math.cos(tilt * 1.4)) * 260;
    this.roomG = { x: gx, y: gy };

    const sub = 2, h = dt / sub;
    for (let k = 0; k < sub; k++) {
      for (const b of this.bodies) {
        let ax = gx, ay = gy;
        const dx = s.x - b.x, dy = s.y - b.y, d2 = dx * dx + dy * dy + 400, d = Math.sqrt(d2);
        ax += (G / d2) * (dx / d); ay += (G / d2) * (dy / d);
        for (const hl of this.holes.values()) {
          const hx = hl.x - b.x, hy = hl.y - b.y, h2 = hx * hx + hy * hy + 300, hd = Math.sqrt(h2);
          ax += (HOLE / h2) * (hx / hd); ay += (HOLE / h2) * (hy / hd);
        }
        b.vx += ax * h; b.vy += ay * h;
        b.x += b.vx * h; b.y += b.vy * h;
      }
    }

    // Laps, trails, swallowing, merging, escaping.
    for (const b of this.bodies) {
      if (b.dead) continue;
      const a = Math.atan2(b.y - s.y, b.x - s.x);
      b.lap += angleWrap(a - b.ang); b.ang = a;
      if (Math.abs(b.lap) >= TAU) {
        b.lap -= Math.sign(b.lap) * TAU;
        this.orbits++; this.score += Math.round(10 + b.r);
        app.audio.chime(app.audio.noteFromY(clamp(b.y / H), 1), { vel: 0.22, bright: 0.8, pan: (b.x / W) * 2 - 1, dur: 1.4 });
        app.fx.shockwave(b.x, b.y, { color: b.col, r1: 40, dur: 0.5, width: 1.5 });
      }
      b.trail.push(b.x, b.y);
      if (b.trail.length > TRAIL * 2) b.trail.splice(0, 2);
      if (dist(b.x, b.y, s.x, s.y) < 30 + b.r * 0.5) { this.consume(b, s.x, s.y, '#ffd36e'); this.star.pulse = 1; continue; }
      for (const hl of this.holes.values()) if (dist(b.x, b.y, hl.x, hl.y) < 26) { this.consume(b, hl.x, hl.y, '#b69bff'); this.swallowed++; break; }
      if (b.x < -W * 0.6 || b.x > W * 1.6 || b.y < -H * 0.6 || b.y > H * 1.6) b.dead = true;
    }
    for (let i = 0; i < this.bodies.length; i++) {
      const a = this.bodies[i]; if (a.dead) continue;
      for (let j = i + 1; j < this.bodies.length; j++) {
        const b = this.bodies[j]; if (b.dead) continue;
        if (dist(a.x, a.y, b.x, b.y) < (a.r + b.r) * 0.8) this.merge(a, b);
      }
    }
    this.bodies = this.bodies.filter((b) => !b.dead);
  }

  release(label) {
    const f = this.forming.get(label);
    if (!f) return;
    this.forming.delete(label);
    const h = f.hand;
    if (h) h.lastPinchEnd = app.t;
    if (f.t < 0.22) { // quick pinch → stardust
      for (let i = 0; i < 6; i++) {
        const v = this.orbitVelocity(f.x + rand(-20, 20), f.y + rand(-20, 20), 0, 0);
        this.addBody(f.x + rand(-20, 20), f.y + rand(-20, 20), v.vx * rand(0.85, 1.1), v.vy * rand(0.85, 1.1), rand(3, 5), pick(PALETTE));
      }
      app.audio.pinch(f.x / app.W, f.y / app.H);
      return;
    }
    let vx = (h?.vx || 0) * 0.9, vy = (h?.vy || 0) * 0.9;
    if (Math.hypot(vx, vy) < 160) ({ vx, vy } = this.orbitVelocity(f.x, f.y, vx, vy));
    this.addBody(f.x, f.y, vx, vy, f.r, f.col);
    app.audio.whoosh(vx > 0 ? 1 : -1);
    app.fx.shockwave(f.x, f.y, { color: f.col, r1: 60, dur: 0.4, width: 2 });
  }

  supernova(x, y) {
    if (this.novaCool > 0) return;
    this.novaCool = 1.2;
    for (const b of this.bodies) {
      const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy) || 1;
      if (d < 460) { const k = (1 - d / 460) * 900; b.vx += (dx / d) * k; b.vy += (dy / d) * k; }
    }
    app.particles.impulse(x, y, 500, 700);
    app.particles.emit({ x, y, count: 90, speed: [260, 720], life: [0.6, 1.4], size: [2, 5], colors: ['#ffffff', '#ffd36e', '#ff9be8'], raw: true });
    app.fx.shockwave(x, y, { color: '#ffd36e', r1: 460, dur: 0.9, width: 5 });
    app.fx.flash('#ffd36e', 0.25);
    app.audio.boom(0.8, (x / app.W) * 2 - 1);
  }

  consume(b, x, y, col) {
    b.dead = true;
    app.particles.emit({ x: b.x, y: b.y, count: 20 + b.r, speed: [40, 200], life: [0.4, 1], size: [1.5, 3.5], colors: [b.col, col], raw: true });
    app.audio.tick((x / app.W) * 2 - 1, 0.3);
  }

  merge(a, b) {
    const [big, small] = a.m >= b.m ? [a, b] : [b, a];
    const m = big.m + small.m;
    big.vx = (big.vx * big.m + small.vx * small.m) / m; big.vy = (big.vy * big.m + small.vy * small.m) / m;
    big.m = m; big.r = Math.min(30, Math.cbrt(m));
    small.dead = true;
    app.particles.emit({ x: small.x, y: small.y, count: 18, speed: [60, 240], life: [0.4, 0.9], colors: [small.col, big.col, '#ffffff'], raw: true });
    app.audio.chime(app.audio.noteFromY(clamp(big.y / app.H), 0), { vel: 0.3, bright: 0.4, dur: 1, pan: (big.x / app.W) * 2 - 1 });
  }

  clear() {
    for (const b of this.bodies) app.particles.emit({ x: b.x, y: b.y, count: 12, speed: [60, 260], colors: [b.col, '#ffffff'], raw: true });
    this.bodies = [];
    app.fx.flash('#ffffff', 0.25);
    app.audio.whoosh(1);
    app.fx.text(app.W / 2, app.H * 0.22, 'A fresh sky', { color: this.accent, size: 20 });
  }

  // ------------------------------------------------------------------ draw
  drawBack(ctx) {
    if (this.state === 'intro') return;
    const t = app.t, s = this.starPos();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // central star
    const sr = 26 * (1 + this.star.pulse * 0.4 + Math.sin(t * 2) * 0.04);
    const g = sr * 5;
    ctx.drawImage(app.particles.spriteCanvas('#ffd36e'), s.x - g, s.y - g, g * 2, g * 2);
    ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(s.x, s.y, sr * 0.6, 0, TAU); ctx.fill();
    // faint orbit guides
    ctx.strokeStyle = rgba('#ffffff', 0.04); ctx.lineWidth = 1;
    for (const r of [140, 240, 340]) { ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.stroke(); }
    // trails + bodies
    ctx.lineCap = 'round';
    for (const b of this.bodies) {
      const tr = b.trail, n = tr.length / 2;
      for (let i = 1; i < n; i++) {
        ctx.strokeStyle = rgba(b.col, (i / n) * 0.5); ctx.lineWidth = Math.max(1, b.r * 0.5 * (i / n));
        ctx.beginPath(); ctx.moveTo(tr[(i - 1) * 2], tr[(i - 1) * 2 + 1]); ctx.lineTo(tr[i * 2], tr[i * 2 + 1]); ctx.stroke();
      }
      const gg = b.r * 3;
      ctx.drawImage(app.particles.spriteCanvas(b.col), b.x - gg, b.y - gg, gg * 2, gg * 2);
      ctx.globalCompositeOperation = 'source-over';
      const body = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.1, b.x, b.y, b.r);
      body.addColorStop(0, '#ffffff'); body.addColorStop(0.5, b.col); body.addColorStop(1, rgba(b.col, 0.35));
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
    }
    // forming planets
    for (const f of this.forming.values()) {
      ctx.strokeStyle = rgba(f.col, 0.8); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r + 8 + Math.sin(t * 10) * 2, 0, TAU); ctx.stroke();
      const gg = f.r * 3;
      ctx.drawImage(app.particles.spriteCanvas(f.col), f.x - gg, f.y - gg, gg * 2, gg * 2);
    }
    ctx.restore();
    // black holes
    for (const hl of this.holes.values()) {
      const grow = Math.min(1, hl.t * 3), R = 26 * grow;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const rr = R * (3.2 - ((t * 0.9 + i / 3) % 1) * 2.2);
        ctx.strokeStyle = rgba('#b69bff', 0.35 * grow); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(hl.x, hl.y, rr, rr * 0.55, t * 0.8, 0, TAU); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(hl.x, hl.y, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba('#e3d6ff', 0.9 * grow); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(hl.x, hl.y, R + 2, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    if (this.frozen) {
      ctx.save(); ctx.fillStyle = 'rgba(160, 210, 255, 0.06)'; ctx.fillRect(0, 0, app.W, app.H); ctx.restore();
    }
  }

  drawHud(ctx) {
    const W = app.W;
    glowText(ctx, `${this.orbits}`, W / 2, HUD_Y + 28, { size: 28, glow: this.accent });
    glowText(ctx, `ORBITS  ·  ${this.bodies.length} BODIES${this.frozen ? '  ·  FROZEN' : ''}`, W / 2, HUD_Y + 56, { size: 10, font: 'Inter', weight: 600, spacing: 2.5, color: 'rgba(255,255,255,0.6)', blur: 0 });
  }
}
