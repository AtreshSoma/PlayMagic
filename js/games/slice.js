// ---------------------------------------------------------------------------
// COMET SLICE · swipe-to-slice arcade
// Glowing space fruit is tossed up from below. Swipe your hand (any pose,
// just move fast) through it to slice it in two. Dark void bombs cost a
// light if you slice them; a rare golden comet starts a 4-second fruit
// frenzy. Slicing several fruit in one swipe earns a combo bonus.
// Missing fruit never costs a light (only the streak), so it stays fun.
// Mouse / touch: swipe the pointer quickly (no click needed).
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { GameBase, HUD_SUB_Y } from './base.js';
import { glowText } from '../ui/draw.js';
import { TAU, rand, pick, clamp, rgba } from '../core/util.js';

const FRUITS = [
  { kind: 'orange', a: '#ffb347', b: '#ff7b1c', flesh: '#ffd27a' },
  { kind: 'berry', a: '#ff6b9a', b: '#d61f63', flesh: '#ffc2d6' },
  { kind: 'lime', a: '#a8ff6b', b: '#46c21f', flesh: '#e4ffc4' },
  { kind: 'plum', a: '#c79bff', b: '#7a3dff', flesh: '#ead9ff' },
  { kind: 'melon', a: '#7ff3ff', b: '#1fa7c2', flesh: '#d9fbff' },
];
const GRAVITY = 980;
const BLADE_SPEED = 650;    // px/s needed for a hand to count as slicing
const TRAIL_TIME = 0.14;

/** Distance from point to segment. */
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
  const u = clamp(((px - ax) * dx + (py - ay) * dy) / L2);
  return Math.hypot(px - (ax + dx * u), py - (ay + dy * u));
}

export class SliceGame extends GameBase {
  constructor() {
    super('slice', 'Comet Slice');
    this.duration = 60; this.maxLives = 3;
    this.allow = { swipe: false, runes: false, faceMagic: false, chimes: false, overlays: true, scatter: false, snapshot: false, gravity: false, puff: false, barrier: false };
    this.cues = [{ cue: 'swipe', key: 'Swipe' }, { cue: 'open', key: 'Move' }];
    this.needsHand = true;
  }

  playCoach() {
    return app.mode === 'camera'
      ? { icon: 'swipe', html: '<b>Swipe your hand</b> through the fruit<small>Slice several in one swipe for a combo · avoid the dark bombs</small>' }
      : { icon: 'swipe', html: '<b>Swipe the mouse</b> fast through the fruit<small>No click needed · avoid the dark bombs</small>' };
  }

  reset() {
    this.objs = []; this.halves = []; this.waveT = 0.8; this.frenzy = 0; this.sliced = 0;
    this.blades = new Map(); // hand → { trail: [{x,y,t}], count, idle }
  }

  // ------------------------------------------------------------------ spawning
  toss(kind, x) {
    const W = app.W, H = app.H, k = clamp(H / 800, 0.8, 1.3);
    const vy = -rand(900, 1200) * k, vx = (W / 2 - x) * rand(0.35, 0.8) + rand(-80, 80);
    const r = kind === 'bomb' ? 30 : kind === 'gold' ? 26 : rand(30, 40);
    const fruit = kind === 'fruit' ? pick(FRUITS) : null;
    this.objs.push({ kind, fruit, x, y: H + r + 10, vx, vy, r, rot: rand(TAU), spin: rand(-3, 3), t: 0 });
  }

  wave() {
    const W = app.W, elapsed = this.duration - this.time;
    const n = this.frenzy > 0 ? 3 : 1 + Math.floor(rand(0, Math.min(4, 1 + elapsed / 14)));
    for (let i = 0; i < n; i++) {
      const x = rand(W * 0.15, W * 0.85);
      const roll = Math.random();
      const kind = this.frenzy > 0 ? 'fruit' : roll < Math.min(0.22, 0.08 + elapsed * 0.003) ? 'bomb' : roll > 0.975 ? 'gold' : 'fruit';
      setTimeout(() => this.state === 'play' && this.toss(kind, x), i * 140);
    }
    this.waveT = this.frenzy > 0 ? 0.35 : clamp(1.7 - elapsed * 0.012, 0.85, 1.7) * rand(0.8, 1.2);
  }

  // ------------------------------------------------------------------ blades
  updateBlades(dt) {
    const inp = app.input, now = app.t, hands = inp.allHands();
    for (const h of hands) {
      let b = this.blades.get(h);
      if (!b) { b = { trail: [], count: 0, idle: 0 }; this.blades.set(h, b); }
      b.trail.push({ x: h.x, y: h.y, t: now });
      while (b.trail.length && now - b.trail[0].t > TRAIL_TIME) b.trail.shift();
      const need = h.source === 'mouse' ? BLADE_SPEED * 0.75 : BLADE_SPEED;
      b.active = h.speed > need && b.trail.length > 1;
      if (b.active) b.idle = 0; else b.idle += dt;
      if (b.idle > 0.18 && b.count) {
        if (b.count >= 3) this.comboBonus(b.count, h.x, h.y);
        b.count = 0;
      }
      if (!b.active) continue;
      const p0 = b.trail[b.trail.length - 2], p1 = b.trail[b.trail.length - 1];
      for (const o of this.objs) {
        if (o.dead || segDist(o.x, o.y, p0.x, p0.y, p1.x, p1.y) > o.r + 6) continue;
        this.cut(o, Math.atan2(p1.y - p0.y, p1.x - p0.x));
        if (o.kind !== 'bomb') b.count++;
      }
    }
    for (const h of [...this.blades.keys()]) if (!hands.includes(h)) this.blades.delete(h);
  }

  cut(o, ang) {
    o.dead = true;
    const pan = (o.x / app.W) * 2 - 1;
    if (o.kind === 'bomb') {
      this.loseLife(o.x, o.y - 40);
      app.audio.boom(0.9, pan);
      app.particles.emit({ x: o.x, y: o.y, count: 70, speed: [200, 600], life: [0.4, 1], size: [2, 5], colors: ['#9a6bff', '#3a1470', '#ffffff'], raw: true });
      app.fx.shockwave(o.x, o.y, { color: '#9a6bff', r1: 220, dur: 0.6, width: 4 });
      return;
    }
    this.sliced++; this.hit();
    const gold = o.kind === 'gold', gain = (gold ? 50 : 10) * this.mult;
    this.score += gain;
    const col = gold ? '#ffe27a' : o.fruit.a, flesh = gold ? '#fff6c0' : o.fruit.flesh;
    // two halves fly apart along the cut normal
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    for (const side of [-1, 1]) this.halves.push({ x: o.x, y: o.y, vx: o.vx + nx * side * 160, vy: o.vy * 0.4 + ny * side * 160 - 120, r: o.r, ang, side, rot: 0, spin: side * rand(2, 5), col, flesh, fruit: o.fruit, gold, t: 0 });
    app.particles.emit({ x: o.x, y: o.y, count: 26, speed: [120, 420], life: [0.4, 0.9], size: [2, 5], colors: [col, flesh], raw: true, grav: 1.4 });
    app.fx.text(o.x, o.y - o.r - 10, `+${gain}`, { color: col, size: gold ? 22 : 17 });
    app.audio.shatter(pan, 0.25);
    app.audio.pluck(260 * Math.pow(2, Math.min(this.combo, 14) / 7), { pan, vel: 0.4, dur: 0.6, bright: 0.9 });
    // slash flash along the cut
    app.fx.add(0.25, (ctx, p) => {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba('#ffffff', 1 - p); ctx.lineWidth = 3 * (1 - p); ctx.lineCap = 'round';
      const L = o.r * 1.8;
      ctx.beginPath(); ctx.moveTo(o.x - Math.cos(ang) * L, o.y - Math.sin(ang) * L); ctx.lineTo(o.x + Math.cos(ang) * L, o.y + Math.sin(ang) * L); ctx.stroke();
    });
    if (gold) {
      this.frenzy = 4; this.waveT = 0.1;
      app.audio.victory(); app.fx.flash('#ffe27a', 0.3);
      app.fx.text(app.W / 2, app.H * 0.3, 'FRUIT FRENZY!', { color: '#ffe27a', size: 34, dur: 1.5 });
    }
  }

  comboBonus(n, x, y) {
    const bonus = n * 10;
    this.score += bonus;
    app.fx.text(x, y - 50, `${n} in one swipe! +${bonus}`, { color: this.accent, size: 22, dur: 1.3 });
    app.audio.select();
    app.particles.emit({ x, y, count: 40, speed: [100, 380], colors: [this.accent, '#ffffff'], raw: true });
  }

  play(dt) {
    const H = app.H;
    this.frenzy = Math.max(0, this.frenzy - dt);
    this.waveT -= dt;
    if (this.waveT <= 0) this.wave();
    for (const o of this.objs) {
      o.t += dt; o.vy += GRAVITY * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.spin * dt;
      if (o.kind === 'bomb' && Math.random() < 0.5) app.particles.spawn(o.x + Math.cos(o.rot) * o.r, o.y + Math.sin(o.rot) * o.r, rand(-30, 30), rand(-60, -20), 0.35, rand(1.5, 3), '#ffb46b', 5, 0, 0.94, 0);
      if (o.y > H + o.r + 20 && o.vy > 0) {
        o.dead = true;
        if (o.kind !== 'bomb' && o.t > 0.5) this.breakCombo();
      }
    }
    this.updateBlades(dt);
    for (const hv of this.halves) { hv.t += dt; hv.vy += GRAVITY * dt; hv.x += hv.vx * dt; hv.y += hv.vy * dt; hv.rot += hv.spin * dt; }
    this.objs = this.objs.filter((o) => !o.dead);
    this.halves = this.halves.filter((hv) => hv.y < H + 80);
  }

  resultTitle() { return `${this.sliced} FRUIT SLICED`; }

  // ------------------------------------------------------------------ draw
  drawFruit(ctx, o) {
    const r = o.r;
    if (o.kind === 'bomb') {
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#5a3d8a'); g.addColorStop(1, '#12061f');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba('#b48cff', 0.8); ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-r * 0.35, -r * 0.2); ctx.lineTo(r * 0.35, r * 0.2); ctx.moveTo(r * 0.35, -r * 0.2); ctx.lineTo(-r * 0.35, r * 0.2); ctx.stroke();
      return;
    }
    const a = o.kind === 'gold' ? '#fff3b0' : o.fruit.a, b = o.kind === 'gold' ? '#f2a91a' : o.fruit.b;
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, a); g.addColorStop(1, b);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    // texture per fruit
    ctx.strokeStyle = rgba('#ffffff', 0.35); ctx.lineWidth = 1.5;
    if (o.kind === 'gold') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const ang = (i / 10) * TAU - Math.PI / 2, rr = i % 2 ? r * 0.25 : r * 0.6; i ? ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
      ctx.closePath(); ctx.fill();
    } else if (o.fruit.kind === 'melon') {
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(i) * r * 0.22 + 2, r * 0.98, 0, 0, TAU); ctx.stroke(); }
    } else if (o.fruit.kind === 'berry') {
      ctx.fillStyle = rgba('#fff3b0', 0.8);
      for (let i = 0; i < 9; i++) { const ang = i * 2.4, rr = r * 0.25 + (i % 3) * r * 0.2; ctx.beginPath(); ctx.ellipse(Math.cos(ang) * rr, Math.sin(ang) * rr, 1.8, 3, ang, 0, TAU); ctx.fill(); }
    } else {
      for (let i = 0; i < 12; i++) { const ang = (i / 12) * TAU; ctx.fillStyle = rgba('#ffffff', 0.18); ctx.beginPath(); ctx.arc(Math.cos(ang) * r * 0.6, Math.sin(ang) * r * 0.6, 1.6, 0, TAU); ctx.fill(); }
    }
    // leaf
    ctx.fillStyle = '#5be37a';
    ctx.beginPath(); ctx.ellipse(r * 0.15, -r * 1.02, r * 0.28, r * 0.12, -0.5, 0, TAU); ctx.fill();
  }

  drawBack(ctx) {
    if (this.state === 'intro') return;
    const t = app.t;
    // halves (behind whole fruit)
    for (const hv of this.halves) {
      ctx.save(); ctx.translate(hv.x, hv.y); ctx.rotate(hv.ang + hv.rot);
      ctx.globalAlpha = Math.max(0, 1 - hv.t * 0.7);
      ctx.beginPath(); ctx.arc(0, 0, hv.r, hv.side > 0 ? 0 : Math.PI, hv.side > 0 ? Math.PI : TAU); ctx.closePath();
      ctx.fillStyle = hv.col; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, hv.r * 0.82, hv.side > 0 ? 0 : Math.PI, hv.side > 0 ? Math.PI : TAU); ctx.closePath();
      ctx.fillStyle = hv.flesh; ctx.fill();
      ctx.restore();
    }
    for (const o of this.objs) {
      ctx.save(); ctx.translate(o.x, o.y);
      ctx.globalCompositeOperation = 'lighter';
      const glow = o.r * (o.kind === 'gold' ? 3.4 : 2.4);
      ctx.globalAlpha = o.kind === 'bomb' ? 0.5 : 0.45;
      ctx.drawImage(app.particles.spriteCanvas(o.kind === 'bomb' ? '#7a3dff' : o.kind === 'gold' ? '#ffe27a' : o.fruit.a), -glow, -glow, glow * 2, glow * 2);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.rotate(o.rot);
      this.drawFruit(ctx, o);
      ctx.restore();
    }
    if (this.frenzy > 0) {
      ctx.save(); ctx.globalAlpha = 0.08 + 0.05 * Math.sin(t * 12); ctx.fillStyle = '#ffe27a'; ctx.fillRect(0, 0, app.W, app.H); ctx.restore();
    }
  }

  drawFront(ctx) {
    if (this.state === 'play') {
      // blade trails: tapered, glowing
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (const b of this.blades.values()) {
        const tr = b.trail;
        if (tr.length < 2 || !b.active && b.idle > 0.08) continue;
        for (let i = 1; i < tr.length; i++) {
          const k = i / tr.length;
          ctx.strokeStyle = rgba(this.accent, 0.55 * k); ctx.lineWidth = 14 * k;
          ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y); ctx.lineTo(tr[i].x, tr[i].y); ctx.stroke();
          ctx.strokeStyle = rgba('#ffffff', 0.9 * k); ctx.lineWidth = 4 * k;
          ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y); ctx.lineTo(tr[i].x, tr[i].y); ctx.stroke();
        }
      }
      ctx.restore();
      if (this.frenzy > 0) glowText(ctx, `FRENZY ${this.frenzy.toFixed(1)}s`, app.W / 2, HUD_SUB_Y, { size: 12, font: 'Inter', weight: 700, spacing: 3, color: '#ffe27a', blur: 8 });
    }
    super.drawFront(ctx);
  }
}

