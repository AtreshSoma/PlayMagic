// ---------------------------------------------------------------------------
// Play-to-learn coach. When a mode opens, a soft glowing cloud at the bottom
// of the screen shows a looping silhouette of the move to make (a pointing
// finger drawing, a winking eye, a tilting head…). No words at all.
//
// Each step stays up to 15 s (later steps 10 s) and vanishes the moment the
// child tries the move: modes call app.coach.tried('blink') etc. A sparkle
// burst and chime celebrate the try, then the next step (if any) appears.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { TAU, clamp, damp, ease, hsl, roundRect } from '../core/util.js';
import { drawHand, drawFace, drawButterfly } from './icons.js';
import { drawFirefly } from './characters.js';
import { drawPlane, drawStar, drawCrown } from './props.js';
import { drawRainbowRing } from './bubble.js';
import { glowSprite } from '../fx/sprites.js';

const POINT = [0.3, 1, 0, 0, 0], OPEN = [1, 1, 1, 1, 1];

function bubbleAt(ctx, x, y, r, hue, alpha = 1) {
  ctx.save(); ctx.globalAlpha *= alpha;
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, hsl(hue, 100, 90, 0.8)); g.addColorStop(1, hsl(hue + 30, 95, 60, 0.7));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.45, r * 0.22, r * 0.1, -0.6, 0, TAU); ctx.fill();
  ctx.restore();
}

function popBurst(ctx, x, y, p, r) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU, d = r * (0.5 + p * 1.4), s = r * 0.35 * (1 - p);
    ctx.drawImage(glowSprite(hsl(k * 45, 100, 70)), x + Math.cos(a) * d - s, y + Math.sin(a) * d - s, s * 2, s * 2);
  }
  ctx.restore();
}

/** Lemniscate (figure-8) path. */
const fig8 = (u, w, h) => { const a = u * TAU; const d = 1 + Math.sin(a) ** 2; return [w * Math.cos(a) / d, h * Math.sin(a) * Math.cos(a) / d]; };

const DEMOS = {
  'palm-hover'(ctx, w, h, t) {
    const L = 3.2, p = (t % L) / L, bx = w * 0.18, by = 0, br = h * 0.2;
    const move = clamp(p / 0.25), dwell = clamp((p - 0.25) / 0.4), popped = p > 0.65;
    if (!popped) bubbleAt(ctx, bx, by, br, 300);
    else popBurst(ctx, bx, by, clamp((p - 0.65) / 0.3), br);
    if (dwell > 0 && !popped) drawRainbowRing(ctx, bx, by, br * 1.3, dwell, br * 0.18);
    const hx = -w * 0.3 + (bx + w * 0.3) * ease.inOut(move), hy = by + h * 0.05;
    ctx.save(); ctx.translate(hx, hy); ctx.globalAlpha = 0.95; drawHand(ctx, h * 0.26, OPEN); ctx.restore();
  },

  tap(ctx, w, h, t) {
    const L = 1.8, p = (t % L) / L, bx = w * 0.05, by = -h * 0.05, br = h * 0.2;
    const press = p > 0.35 && p < 0.55;
    if (p < 0.45) bubbleAt(ctx, bx, by, br, 190);
    else popBurst(ctx, bx, by, clamp((p - 0.45) / 0.4), br);
    if (press) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(bx, by, br * (0.4 + (p - 0.35) * 5), 0, TAU); ctx.stroke(); }
    const lift = press ? 0 : h * 0.12 * Math.min(1, Math.abs(p - 0.45) * 4);
    ctx.save(); ctx.translate(bx + h * 0.06, by + h * 0.3 + lift); ctx.scale(press ? 0.92 : 1, press ? 0.92 : 1); drawHand(ctx, h * 0.24, POINT); ctx.restore();
  },

  'point-draw'(ctx, w, h, t) {
    const L = 3, u = (t % L) / L;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = h * 0.06;
    const N = 40;
    for (let k = 0; k < N; k++) {
      const u0 = u - (k / N) * 0.6, u1 = u - ((k + 1) / N) * 0.6;
      if (u1 < 0) break;
      const [x0, y0] = fig8(u0, w * 0.32, h * 0.5), [x1, y1] = fig8(u1, w * 0.32, h * 0.5);
      ctx.strokeStyle = hsl(k * 9 + t * 120, 100, 65, 1 - k / N);
      ctx.beginPath(); ctx.moveTo(x0, y0 - h * 0.05); ctx.lineTo(x1, y1 - h * 0.05); ctx.stroke();
    }
    ctx.restore();
    const [x, y] = fig8(u, w * 0.32, h * 0.5);
    ctx.save(); ctx.translate(x + h * 0.04, y + h * 0.17); drawHand(ctx, h * 0.22, POINT); ctx.restore();
  },

  drag(ctx, w, h, t) {
    DEMOS['point-draw'](ctx, w, h, t);
    const L = 3, u = (t % L) / L, [x, y] = fig8(u, w * 0.32, h * 0.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y - h * 0.05, h * 0.07 + Math.sin(t * 10) * 2, 0, TAU); ctx.stroke();
  },

  'palm-push'(ctx, w, h, t) {
    const L = 2.4, p = (t % L) / L;
    const hx = -w * 0.35 + w * 0.5 * ease.inOut(clamp(p / 0.45));
    const hit = p > 0.4;
    const sx = hit ? w * 0.12 + (p - 0.4) * w * 0.6 : w * 0.12, sy = hit ? -Math.sin((p - 0.4) / 0.6 * Math.PI) * h * 0.3 : 0;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(hit ? (p - 0.4) * 12 : 0); drawStar(ctx, h * 0.14, t); ctx.restore();
    ctx.save(); ctx.translate(hx, h * 0.05); ctx.rotate(0.25); drawHand(ctx, h * 0.26, OPEN); ctx.restore();
  },

  blink(ctx, w, h, t) {
    const L = 1.6, p = (t % L) / L, wink = p > 0.55 && p < 0.72, side = Math.floor(t / L) % 2;
    const open = side ? [1, wink ? 0 : 1] : [wink ? 0 : 1, wink ? 0 : 1];
    ctx.save(); ctx.translate(-w * 0.17, 0); drawFace(ctx, h * 0.3, { open, smile: 0.6 }); ctx.restore();
    // the firefly hops on every blink
    const hop = p > 0.55 ? Math.sin(clamp((p - 0.55) / 0.45) * Math.PI) : 0;
    ctx.save(); ctx.translate(w * 0.22, h * 0.15 - hop * h * 0.4); drawFirefly(ctx, h * 0.12, { t, flap: hop }); ctx.restore();
    if (wink) { const s = h * 0.18; ctx.drawImage(glowSprite('#fff6a0'), -w * 0.17 - s + (side ? h * 0.1 : 0), -h * 0.04 - s, s * 2, s * 2); }
  },

  tilt(ctx, w, h, t) {
    const a = Math.sin(t * 1.6) * 0.38;
    ctx.save(); ctx.translate(-w * 0.15, -h * 0.02); ctx.rotate(a); drawFace(ctx, h * 0.28, { smile: 0.7 }); ctx.restore();
    ctx.save(); ctx.translate(w * 0.2 + a * w * 0.25, h * 0.1); ctx.rotate(a * 0.8); drawPlane(ctx, h * 0.14, t); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-w * 0.15, -h * 0.02, h * 0.38, -Math.PI * 0.75, -Math.PI * 0.25); ctx.stroke();
  },

  nod(ctx, w, h, t) {
    const p = (t % 1.4) / 1.4, nod = Math.sin(clamp(p / 0.5) * Math.PI);
    ctx.save(); ctx.translate(-w * 0.15, -h * 0.05 + nod * h * 0.1); ctx.scale(1, 1 - nod * 0.08); drawFace(ctx, h * 0.28, { smile: 0.8, open: 1 - nod * 0.6 }); ctx.restore();
    const boost = p > 0.45 ? 1 - clamp((p - 0.45) / 0.55) : 0;
    ctx.save(); ctx.translate(w * 0.22, 0);
    ['#ff6b8b', '#ffd84a', '#6fe3ff'].forEach((c, i) => {
      ctx.strokeStyle = c; ctx.globalAlpha = 0.3 + boost * 0.7; ctx.lineWidth = h * 0.05; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-h * 0.35 - boost * h * 0.2, (i - 1) * h * 0.08 + h * 0.05); ctx.lineTo(-h * 0.08, (i - 1) * h * 0.08 + h * 0.05); ctx.stroke();
    });
    ctx.globalAlpha = 1; ctx.translate(boost * h * 0.08, h * 0.05); ctx.rotate(Math.PI / 2); drawPlane(ctx, h * 0.12, t);
    ctx.restore();
  },

  wave(ctx, w, h, t) {
    const a = Math.sin(t * 7) * 0.45;
    const bubbles = [[w * 0.25, -h * 0.2, 0], [w * 0.3, h * 0.15, 1], [-w * 0.3, -h * 0.15, 2]];
    for (const [x, y, i] of bubbles) {
      const p = ((t * 0.6 + i * 0.33) % 1);
      if (p < 0.7) bubbleAt(ctx, x, y - p * h * 0.2, h * 0.09, 180 + i * 60, 1 - p * 0.3);
      else popBurst(ctx, x, y - 0.7 * h * 0.2, (p - 0.7) / 0.3, h * 0.09);
    }
    ctx.save(); ctx.translate(0, h * 0.32); ctx.rotate(a); ctx.translate(0, -h * 0.3); drawHand(ctx, h * 0.27, OPEN); ctx.restore();
  },

  mouth(ctx, w, h, t) {
    const m = 0.5 + 0.5 * Math.sin(t * 2.4);
    ctx.save(); ctx.translate(-w * 0.18, 0); drawFace(ctx, h * 0.28, { mouth: m, open: 1 }); ctx.restore();
    for (let k = 0; k < 4; k++) {
      const p = (t * 0.7 + k * 0.25) % 1;
      if (m > 0.3 || p > 0.2) bubbleAt(ctx, -w * 0.1 + p * w * 0.45, h * 0.1 - p * h * 0.35 + Math.sin(p * 9) * 6, h * (0.04 + p * 0.06), 170 + k * 40, 1 - p);
    }
  },

  smile(ctx, w, h, t) {
    const s = 0.5 + 0.5 * Math.sin(t * 2);
    ctx.save(); drawFace(ctx, h * 0.28, { smile: s, open: 1 - s * 0.5 }); ctx.restore();
    for (const side of [-1, 1]) {
      const grow = clamp(s * 1.4 - 0.2);
      ctx.save(); ctx.translate(side * w * 0.3, h * 0.3);
      ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -h * 0.35 * grow); ctx.stroke();
      ctx.translate(0, -h * 0.35 * grow);
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = hsl(320 + side * 30, 100, 75);
        ctx.beginPath(); ctx.ellipse(Math.cos(k * 1.256) * h * 0.06 * grow, Math.sin(k * 1.256) * h * 0.06 * grow, h * 0.05 * grow, h * 0.03 * grow, k * 1.256, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#fff27a'; ctx.beginPath(); ctx.arc(0, 0, h * 0.03 * grow, 0, TAU); ctx.fill();
      ctx.restore();
    }
  },

  brows(ctx, w, h, t) {
    const p = (t % 2) / 2, up = Math.sin(clamp(p / 0.4) * Math.PI);
    ctx.save(); ctx.translate(0, h * 0.08); drawFace(ctx, h * 0.26, { brows: up, open: 1 + up * 0.2, smile: 0.5 }); ctx.restore();
    const drop = p > 0.25 ? ease.outBack(clamp((p - 0.25) / 0.35)) : 0;
    if (drop > 0) { ctx.save(); ctx.translate(0, -h * 0.55 + drop * h * 0.37); drawCrown(ctx, h * 0.4, t); ctx.restore(); }
  },

  'tap-flap'(ctx, w, h, t) {
    const L = 1.4, p = (t % L) / L, press = p < 0.15;
    const hop = Math.sin(clamp(p / 0.8) * Math.PI);
    ctx.save(); ctx.translate(-w * 0.2, h * 0.12 + (press ? 4 : 0)); drawHand(ctx, h * 0.22, POINT); ctx.restore();
    if (press) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-w * 0.2 - h * 0.03, -h * 0.12, h * 0.06 + p * h, 0, TAU); ctx.stroke(); }
    ctx.save(); ctx.translate(w * 0.2, h * 0.15 - hop * h * 0.4); drawFirefly(ctx, h * 0.12, { t, flap: hop }); ctx.restore();
  },

  'drag-steer'(ctx, w, h, t) {
    const x = Math.sin(t * 1.5) * w * 0.3;
    ctx.save(); ctx.translate(x, -h * 0.12); ctx.rotate(Math.cos(t * 1.5) * 0.4); drawPlane(ctx, h * 0.13, t); ctx.restore();
    ctx.save(); ctx.translate(x + h * 0.04, h * 0.25); drawHand(ctx, h * 0.2, POINT); ctx.restore();
  },

  butterfly(ctx, w, h, t) { drawButterfly(ctx, h * 0.2, t); },

  /** Swoop a hand upward → the firefly flaps. */
  'flap-hand'(ctx, w, h, t) {
    const L = 1.5, p = (t % L) / L, up = ease.inOut(clamp(p / 0.4)), back = clamp((p - 0.5) / 0.5);
    const hy = h * 0.3 - up * h * 0.45 + back * h * 0.45;
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    if (p < 0.45) { ctx.beginPath(); ctx.moveTo(-w * 0.22, h * 0.32); ctx.lineTo(-w * 0.22, hy + h * 0.2); ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.translate(-w * 0.22, hy); drawHand(ctx, h * 0.22, OPEN); ctx.restore();
    const hop = p < 0.6 ? Math.sin(clamp(p / 0.6) * Math.PI) : 0;
    ctx.save(); ctx.translate(w * 0.22, h * 0.15 - hop * h * 0.4); drawFirefly(ctx, h * 0.12, { t, flap: hop }); ctx.restore();
  },

  /** Touch a bunny as it pops up. */
  boop(ctx, w, h, t) {
    const L = 2, p = (t % L) / L, rise = ease.outBack(clamp(p / 0.3)), touched = p > 0.55;
    const hx = w * 0.06, hy = h * 0.05;
    ctx.save(); ctx.fillStyle = 'rgba(20,10,40,0.6)'; ctx.beginPath(); ctx.ellipse(hx, hy + h * 0.25, h * 0.2, h * 0.07, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(hx, hy + h * 0.25 - rise * h * 0.3); ctx.scale(touched ? 1.15 : 1, touched ? 0.85 : 1);
    ctx.fillStyle = '#fff0f7';
    ctx.beginPath(); ctx.ellipse(-h * 0.06, -h * 0.17, h * 0.035, h * 0.1, -0.2, 0, TAU); ctx.ellipse(h * 0.06, -h * 0.17, h * 0.035, h * 0.1, 0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, h * 0.12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a2160'; ctx.beginPath(); ctx.arc(-h * 0.04, -h * 0.01, h * 0.015, 0, TAU); ctx.arc(h * 0.04, -h * 0.01, h * 0.015, 0, TAU); ctx.fill();
    ctx.restore();
    if (touched) popBurst(ctx, hx, hy - h * 0.05, clamp((p - 0.55) / 0.4), h * 0.18);
    const handX = -w * 0.35 + (hx - h * 0.05 + w * 0.35) * ease.inOut(clamp((p - 0.2) / 0.35));
    ctx.save(); ctx.translate(handX, hy - h * 0.02); drawHand(ctx, h * 0.2, OPEN); ctx.restore();
  },

  /** Slide a hand sideways → the basket follows and catches a falling apple. */
  basket(ctx, w, h, t) {
    const x = Math.sin(t * 1.4) * w * 0.28;
    const fall = ((t * 0.7) % 1), ax = Math.sin(Math.floor(t * 0.7) * 2.3) * w * 0.28;
    ctx.save(); ctx.translate(ax, -h * 0.45 + fall * h * 0.7);
    ctx.fillStyle = '#ff5a6e'; ctx.beginPath(); ctx.arc(0, 0, h * 0.06, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6fe37a'; ctx.beginPath(); ctx.ellipse(h * 0.02, -h * 0.07, h * 0.03, h * 0.015, -0.5, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.translate(x, h * 0.25);
    ctx.fillStyle = '#d9925a'; ctx.beginPath(); ctx.moveTo(-h * 0.16, -h * 0.05); ctx.lineTo(h * 0.16, -h * 0.05); ctx.lineTo(h * 0.12, h * 0.08); ctx.lineTo(-h * 0.12, h * 0.08); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.translate(x, h * 0.02); ctx.globalAlpha = 0.9; drawHand(ctx, h * 0.17, OPEN); ctx.restore();
  },

  /** Touch a cookie → it flies into the monster's open mouth. */
  feed(ctx, w, h, t) {
    const L = 2.2, p = (t % L) / L, fly = ease.inOut(clamp((p - 0.35) / 0.4)), munch = p > 0.75;
    const mx = w * 0.22, my = h * 0.22;
    ctx.save(); ctx.translate(mx, my);
    ctx.fillStyle = '#9b7bff'; ctx.beginPath(); ctx.arc(0, 0, h * 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-h * 0.07, -h * 0.07, h * 0.05, 0, TAU); ctx.arc(h * 0.07, -h * 0.07, h * 0.05, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a1050'; ctx.beginPath(); ctx.arc(-h * 0.07, -h * 0.07, h * 0.022, 0, TAU); ctx.arc(h * 0.07, -h * 0.07, h * 0.022, 0, TAU); ctx.fill();
    const open = munch ? 0.3 : fly > 0 ? 1 : 0.4;
    ctx.beginPath(); ctx.ellipse(0, h * 0.07, h * 0.09, h * 0.07 * open + 2, 0, 0, TAU); ctx.fill();
    ctx.restore();
    const cx0 = -w * 0.2, cy0 = -h * 0.2;
    if (!munch) {
      const cx = cx0 + (mx - cx0) * fly, cy = cy0 + (my + h * 0.07 - cy0) * fly - Math.sin(fly * Math.PI) * h * 0.2;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 3 * (fly > 0 ? 1 : 0));
      ctx.fillStyle = '#e0a060'; ctx.beginPath(); ctx.arc(0, 0, h * 0.06, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5a3018'; for (const [a, b] of [[-0.02, -0.02], [0.025, 0.01], [-0.01, 0.03]]) { ctx.beginPath(); ctx.arc(a * h, b * h, h * 0.01, 0, TAU); ctx.fill(); }
      ctx.restore();
    } else popBurst(ctx, mx, my, clamp((p - 0.75) / 0.25), h * 0.12);
    const reach = Math.sin(clamp(p / 0.4) * Math.PI);
    ctx.save(); ctx.translate(cx0 - h * 0.15 + reach * h * 0.1, cy0 + h * 0.2 - reach * h * 0.1); drawHand(ctx, h * 0.17, POINT); ctx.restore();
  },

  /** Follow the sparkly dots with a pointing finger. */
  trace(ctx, w, h, t) {
    const L = 3, u = (t % L) / L, N = 26, R = h * 0.32;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * TAU - Math.PI / 2, done = k / N < u;
      ctx.fillStyle = done ? '#ffe27a' : 'rgba(255,255,255,0.45)';
      const rr = done ? 4 : 2.5;
      ctx.beginPath(); ctx.arc(Math.cos(a) * R, Math.sin(a) * R * 0.9, rr, 0, TAU); ctx.fill();
    }
    const a = u * TAU - Math.PI / 2;
    ctx.save(); ctx.translate(Math.cos(a) * R + h * 0.04, Math.sin(a) * R * 0.9 + h * 0.17); drawHand(ctx, h * 0.2, POINT); ctx.restore();
  },
};

export class Coach {
  constructor() { this.steps = []; this.i = 0; this.t = 0; this.alpha = 0; this.yay = 0; this.state = 'off'; }

  /** steps: list of demo names, shown in order. */
  show(steps) {
    this.steps = steps.filter((s) => DEMOS[s]);
    this.i = 0; this.t = 0; this.yay = 0;
    this.state = this.steps.length ? 'on' : 'off';
  }

  clear() { this.steps = []; this.state = 'off'; }

  get current() { return this.state === 'on' ? this.steps[this.i] : null; }

  /**
   * Called by modes when the child attempts a move. Trying a later step
   * first skips straight to it (and past it).
   */
  tried(kind) {
    if (this.state !== 'on') return;
    const j = this.steps.indexOf(kind);
    if (j < this.i) return;
    this.i = j;
    this.state = 'yay'; this.yay = 0;
    app.sound.sparkle();
    const { x, y } = this.box();
    app.particles.burst(x, y, 40, null, { kind: 1, speed: 380, size: 7, life: 1 });
  }

  next() {
    this.i++; this.t = 0;
    this.state = this.i < this.steps.length ? 'on' : 'off';
  }

  box() {
    const u = app.u, w = Math.min(300 * u, app.W * 0.7), h = w * 0.62;
    // scenes whose action happens at the bottom (Cloud Glider) ask for the top
    if (app.scenes.current?.coachAt === 'top') return { x: app.W / 2, y: h / 2 + 110 * u, w, h };
    return { x: app.W / 2, y: app.H - h / 2 - 26 * u, w, h };
  }

  update(dt) {
    const visible = this.state === 'on';
    this.alpha = damp(this.alpha, visible ? 1 : 0, 6, dt);
    if (this.state === 'on') {
      this.t += dt;
      if (this.t > (this.i === 0 ? 15 : 10)) this.next();
    } else if (this.state === 'yay') {
      this.yay += dt;
      if (this.yay > 0.7) this.next();
    }
  }

  draw(ctx) {
    const kind = this.steps[Math.min(this.i, this.steps.length - 1)];
    if (this.alpha < 0.02 || !kind) return;
    const { x, y, w, h } = this.box();
    const pop = this.state === 'yay' ? ease.outBack(clamp(this.yay / 0.3)) * 0.12 : 0;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(x, y);
    ctx.scale(0.9 + this.alpha * 0.1 + pop, 0.9 + this.alpha * 0.1 + pop);
    // cloud-shaped glowing card
    ctx.save();
    ctx.shadowColor = 'rgba(255,190,250,0.7)'; ctx.shadowBlur = 30 * app.u;
    roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.36);
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, 'rgba(90,60,170,0.72)'); g.addColorStop(1, 'rgba(40,24,100,0.78)');
    ctx.fillStyle = g; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    // puffy cloud bumps on top
    ctx.fillStyle = 'rgba(90,60,170,0.72)';
    for (const [bx, r] of [[-0.25, 0.16], [0.05, 0.2], [0.3, 0.14]]) { ctx.beginPath(); ctx.arc(bx * w, -h / 2 + r * h * 0.3, r * h, Math.PI, TAU); ctx.fill(); }
    // the demo itself
    ctx.save();
    roundRect(ctx, -w / 2, -h / 2 - h * 0.2, w, h * 1.2, h * 0.36); ctx.clip();
    DEMOS[kind](ctx, w, h * 0.85, this.t + this.yay);
    ctx.restore();
    // timer dots: how long the hint stays (purely visual)
    const left = this.state === 'on' ? 1 - this.t / (this.i === 0 ? 15 : 10) : 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 3 * app.u; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-w * 0.2, h / 2 - 10 * app.u); ctx.lineTo(-w * 0.2 + w * 0.4 * left, h / 2 - 10 * app.u); ctx.stroke();
    ctx.restore();
  }
}
