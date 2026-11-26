// ---------------------------------------------------------------------------
// Small math + smoothing toolkit shared by every Wonderland module.
// Everything here is frame-rate independent: pass the real `dt` (seconds).
// ---------------------------------------------------------------------------

export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

/** Exponential approach of `a` toward `b` with rate `k` (1/s). Frame-rate independent EMA. */
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export const ease = {
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outBack: (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
};

export const hsl = (h, s = 90, l = 65, a = 1) => `hsla(${Math.round(((h % 360) + 360) % 360)},${s}%,${l}%,${a})`;

/** 24 quantised rainbow hues, so sprite caches stay small. */
export const HUES = Array.from({ length: 24 }, (_, i) => hsl(i * 15, 95, 66));
export const hueColor = (h) => HUES[Math.round((((h % 360) + 360) % 360) / 15) % 24];

/** Major-pentatonic note `i` (0 = C4). Any index sounds good with any other. */
const PENTA = [0, 2, 4, 7, 9];
export const noteFreq = (i, base = 261.63) => {
  const o = Math.floor(i / 5), d = PENTA[((i % 5) + 5) % 5];
  return base * Math.pow(2, (o * 12 + d) / 12);
};

/**
 * Adaptive 2D exponential moving average.
 * Smooths heavily when the point is nearly still (kills camera jitter) and
 * lightly when it moves fast (so quick little hands never feel laggy).
 */
export class Smooth2 {
  constructor(slow = 6, fast = 30, speedRef = 1400) {
    this.slow = slow; this.fast = fast; this.speedRef = speedRef;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.init = false;
  }
  reset(x, y) { this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.init = true; return this; }
  update(x, y, dt) {
    if (!this.init) return this.reset(x, y);
    dt = Math.max(dt, 1e-3);
    const speed = Math.hypot(x - this.x, y - this.y) / dt;
    const k = lerp(this.slow, this.fast, clamp(speed / this.speedRef));
    const a = 1 - Math.exp(-k * dt);
    const nx = this.x + (x - this.x) * a, ny = this.y + (y - this.y) * a;
    this.vx = damp(this.vx, (nx - this.x) / dt, 14, dt);
    this.vy = damp(this.vy, (ny - this.y) / dt, 14, dt);
    this.x = nx; this.y = ny;
    return this;
  }
}

/** 1D EMA with a fixed rate. */
export class Smooth1 {
  constructor(k = 10, v = 0) { this.k = k; this.v = v; this.init = false; }
  update(v, dt) {
    if (!this.init) { this.v = v; this.init = true; return v; }
    this.v = damp(this.v, v, this.k, dt);
    return this.v;
  }
}

/** Under-damped spring: the jelly wobble behind every bubble and doodle. */
export class Spring {
  constructor(k = 240, d = 10, v = 1) { this.k = k; this.d = d; this.x = v; this.target = v; this.v = 0; }
  kick(v) { this.v += v; }
  update(dt) {
    // sub-step so big frame gaps never explode the spring
    const n = dt > 0.02 ? 2 : 1, h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v += (-this.k * (this.x - this.target) - this.d * this.v) * h;
      this.x += this.v * h;
    }
    return this.x;
  }
}

/** Smallest distance from point p to segment ab (squared). */
export function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2);
  const qx = ax + dx * t - px, qy = ay + dy * t - py;
  return qx * qx + qy * qy;
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
