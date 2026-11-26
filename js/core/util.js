// ---------------------------------------------------------------------------
// Small math / colour / smoothing helpers shared by every module.
// ---------------------------------------------------------------------------
export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a));
export const smoothstep = (a, b, v) => { const t = invLerp(a, b, v); return t * t * (3 - 2 * t); };
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randRange = (r) => (Array.isArray(r) ? rand(r[0], r[1]) : r);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const angleWrap = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

/** Frame-rate independent EMA coefficient for a time constant `tau` (seconds). */
export const alphaFor = (dt, tau) => 1 - Math.exp(-dt / Math.max(1e-4, tau));
/** Exponential approach of `cur` toward `target`. */
export const approach = (cur, target, dt, tau) => cur + (target - cur) * alphaFor(dt, tau);

export function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbStr = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const _rgbCache = new Map();
export const rgba = (hex, a = 1) => {
  let c = _rgbCache.get(hex);
  if (!c) { c = hexToRgb(hex); _rgbCache.set(hex, c); }
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
};
export const mixRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Force text (not emoji) presentation for symbol glyphs such as ☀ ☺ ♈. */
export const txt = (g) => g + '︎';

/** Scalar EMA. */
export class Smooth1 {
  constructor(tau = 0.1) { this.tau = tau; this.v = 0; this.init = false; }
  update(v, dt) {
    if (!this.init) { this.v = v; this.init = true; } else this.v += (v - this.v) * alphaFor(dt, this.tau);
    return this.v;
  }
  reset(v) { this.v = v; this.init = true; }
}

/**
 * Adaptive EMA for 2D points. Small gaps (jitter at rest) get heavy smoothing,
 * large gaps (intentional motion) get light smoothing, so the cursor feels both
 * steady and responsive. Also tracks a smoothed velocity in px/s.
 */
export class Smooth2 {
  constructor(restTau = 0.12, moveTau = 0.03, speedRef = 1500) {
    this.restTau = restTau; this.moveTau = moveTau; this.speedRef = speedRef;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.init = false;
  }
  reset(x, y) { this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.init = true; }
  update(x, y, dt) {
    if (!this.init) { this.reset(x, y); return this; }
    if (dt <= 0) return this;
    const dx = x - this.x, dy = y - this.y;
    const gapSpeed = Math.hypot(dx, dy) / Math.max(dt, 1e-3);
    const k = clamp(gapSpeed / this.speedRef);
    const a = alphaFor(dt, lerp(this.restTau, this.moveTau, k));
    const nx = this.x + dx * a, ny = this.y + dy * a;
    const va = alphaFor(dt, 0.07);
    this.vx += ((nx - this.x) / dt - this.vx) * va;
    this.vy += ((ny - this.y) / dt - this.vy) * va;
    this.x = nx; this.y = ny;
    return this;
  }
}

/** Solve a small dense linear system A·x = b (Gaussian elimination with pivoting). */
export function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-10) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

export const fmt = (n) => Math.round(n).toLocaleString('en-US');
