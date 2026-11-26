// ---------------------------------------------------------------------------
// Pooled particle system (structure-of-arrays, swap-remove, no per-frame
// allocation). Kinds:
//   0 glow   – soft round light          (additive)
//   1 spark  – four-point twinkle star   (additive, spins)
//   2 confetti – fluttering paper strip  (normal blend)
//   3 dust   – tiny glow that shrinks    (additive)
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { TAU, rand, pick, HUES } from '../core/util.js';
import { glowSprite, sparkSprite } from './sprites.js';

const N = 2600;
const CONFETTI = ['#ff6fae', '#ffd84a', '#6fe3ff', '#8dff8a', '#c79bff', '#ff9a4d', '#ffffff'];

export class Particles {
  constructor() {
    this.x = new Float32Array(N); this.y = new Float32Array(N);
    this.vx = new Float32Array(N); this.vy = new Float32Array(N);
    this.life = new Float32Array(N); this.max = new Float32Array(N);
    this.size = new Float32Array(N); this.grav = new Float32Array(N);
    this.drag = new Float32Array(N); this.rot = new Float32Array(N); this.vr = new Float32Array(N);
    this.kind = new Uint8Array(N);
    this.col = new Array(N).fill('#fff');
    this.n = 0;
  }

  /** color null → random rainbow hue. */
  spawn(x, y, vx, vy, life, size, color, kind = 0, grav = 0, drag = 0.97) {
    let i = this.n;
    if (i >= N) i = (Math.random() * N) | 0; // pool full: recycle a random one
    else this.n++;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = this.max[i] = life; this.size[i] = size;
    this.col[i] = color || pick(kind === 2 ? CONFETTI : HUES);
    this.kind[i] = kind; this.grav[i] = grav; this.drag[i] = drag;
    this.rot[i] = rand(TAU); this.vr[i] = rand(-8, 8);
  }

  /** Radial burst. */
  burst(x, y, n, colors, o = {}) {
    const { speed = 260, life = 0.9, size = 5, kind = 0, grav = 0, drag = 0.93, spread = TAU, angle = 0 } = o;
    const u = app.u;
    for (let k = 0; k < n; k++) {
      const a = angle + (Math.random() - 0.5) * spread, s = speed * u * (0.25 + Math.random() * 0.75);
      const c = Array.isArray(colors) ? pick(colors) : colors;
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, life * rand(0.6, 1.2), size * u * rand(0.6, 1.3), c, kind, grav * u, drag);
    }
  }

  /** Celebration confetti shower plus twinkles. */
  confetti(x, y, n = 40, power = 1) {
    const u = app.u;
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + rand(-1.1, 1.1), s = rand(250, 620) * power * u;
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(1.4, 2.4), rand(5, 10) * u, null, 2, 520 * u, 0.965);
    }
    this.burst(x, y, Math.round(n / 2), null, { kind: 1, speed: 320 * power, size: 9, life: 1 });
  }

  update(dt) {
    const f = dt * 60;
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.kill(i); i--; continue; }
      const d = Math.pow(this.drag[i], f);
      this.vx[i] *= d; this.vy[i] = this.vy[i] * d + this.grav[i] * dt;
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt;
      this.rot[i] += this.vr[i] * dt;
    }
  }

  kill(i) {
    const j = --this.n;
    if (i === j) return;
    this.x[i] = this.x[j]; this.y[i] = this.y[j]; this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j];
    this.life[i] = this.life[j]; this.max[i] = this.max[j]; this.size[i] = this.size[j];
    this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j]; this.rot[i] = this.rot[j]; this.vr[i] = this.vr[j];
    this.kind[i] = this.kind[j]; this.col[i] = this.col[j];
  }

  clear() { this.n = 0; }

  draw(ctx) {
    ctx.save();
    // confetti first, with normal blending
    for (let i = 0; i < this.n; i++) {
      if (this.kind[i] !== 2) continue;
      const a = Math.min(1, this.life[i] / (this.max[i] * 0.35)), s = this.size[i];
      ctx.globalAlpha = a;
      ctx.fillStyle = this.col[i];
      ctx.setTransform(app.dpr, 0, 0, app.dpr, app.dpr * this.x[i], app.dpr * this.y[i]);
      ctx.rotate(this.rot[i]);
      ctx.scale(1, Math.cos(this.rot[i] * 1.7));
      ctx.fillRect(-s / 2, -s * 0.3, s, s * 0.6);
    }
    ctx.setTransform(app.dpr, 0, 0, app.dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.n; i++) {
      const k = this.kind[i];
      if (k === 2) continue;
      const p = this.life[i] / this.max[i];
      let s = this.size[i] * (k === 3 ? p : 0.6 + 0.4 * p) * 2.4;
      ctx.globalAlpha = Math.min(1, p * 1.6);
      if (k === 1) {
        const tw = 0.75 + 0.25 * Math.sin(this.rot[i] * 3);
        s *= 1.4 * tw;
        ctx.setTransform(app.dpr, 0, 0, app.dpr, app.dpr * this.x[i], app.dpr * this.y[i]);
        ctx.rotate(this.rot[i] * 0.3);
        ctx.drawImage(sparkSprite(this.col[i]), -s, -s, s * 2, s * 2);
        ctx.setTransform(app.dpr, 0, 0, app.dpr, 0, 0);
      } else {
        ctx.drawImage(glowSprite(this.col[i]), this.x[i] - s, this.y[i] - s, s * 2, s * 2);
      }
    }
    ctx.restore();
  }
}
