// ---------------------------------------------------------------------------
// Rune casting: hold the pointing pose (index finger) for a heartbeat, then
// trace a shape in the air. Strokes are resampled and classified with simple,
// robust geometry:
//   spiral   ≥ ~1.6 turns of cumulative curvature with a radius trend
//   triangle Douglas-Peucker → 3 sharp corners on a closed path
//   circle   closed path, near-constant radius, ~1 turn
// ---------------------------------------------------------------------------
import { clamp, dist, TAU, angleWrap } from '../core/util.js';

const HOLD = 0.28;
const N = 64;

export const RUNES = {
  circle: { name: 'Shield Pulse', glyph: '◯' },
  triangle: { name: 'Prism Beam', glyph: '△' },
  spiral: { name: 'Vortex', glyph: '꩜' },
};

function pathLength(P) { let L = 0; for (let i = 1; i < P.length; i++) L += dist(P[i - 1].x, P[i - 1].y, P[i].x, P[i].y); return L; }

function resample(pts, n) {
  const P = pts.map((p) => ({ x: p.x, y: p.y }));
  const I = pathLength(P) / (n - 1);
  const out = [{ ...P[0] }];
  let D = 0;
  for (let i = 1; i < P.length; i++) {
    const d = dist(P[i - 1].x, P[i - 1].y, P[i].x, P[i].y);
    if (d > 0 && D + d >= I) {
      const k = (I - D) / d;
      const q = { x: P[i - 1].x + k * (P[i].x - P[i - 1].x), y: P[i - 1].y + k * (P[i].y - P[i - 1].y) };
      out.push(q); P.splice(i, 0, q); D = 0;
    } else D += d;
  }
  while (out.length < n) out.push({ ...P[P.length - 1] });
  return out.slice(0, n);
}

function segDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
  if (L2 < 1e-6) return dist(p.x, p.y, a.x, a.y);
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / L2);
  return dist(p.x, p.y, a.x + t * dx, a.y + t * dy);
}

function simplify(P, eps) {
  if (P.length < 3) return P.slice();
  let maxD = 0, idx = 0;
  for (let i = 1; i < P.length - 1; i++) { const d = segDist(P[i], P[0], P[P.length - 1]); if (d > maxD) { maxD = d; idx = i; } }
  if (maxD > eps) return simplify(P.slice(0, idx + 1), eps).slice(0, -1).concat(simplify(P.slice(idx), eps));
  return [P[0], P[P.length - 1]];
}

export const centroid = (P) => {
  let x = 0, y = 0; for (const p of P) { x += p.x; y += p.y; }
  return { x: x / P.length, y: y / P.length };
};

/** Classify a stroke. Returns {shape, x, y, size, quality} or null. */
export function recognize(pts) {
  if (pts.length < 8) return null;
  const P = resample(pts, N);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of P) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const size = Math.max(maxX - minX, maxY - minY);
  if (size < 70) return null;
  const c = centroid(P);
  const closed = dist(P[0].x, P[0].y, P[N - 1].x, P[N - 1].y) < size * 0.38;

  // Cumulative signed turning and windowed corner sharpness
  let turn = 0, maxCorner = 0;
  const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  for (let i = 1; i < N - 1; i++) turn += angleWrap(ang(P[i], P[i + 1]) - ang(P[i - 1], P[i]));
  for (let i = 3; i < N - 3; i++) maxCorner = Math.max(maxCorner, Math.abs(angleWrap(ang(P[i], P[i + 3]) - ang(P[i - 3], P[i]))));
  const absTurn = Math.abs(turn);

  // Radius statistics around the centroid
  const radii = P.map((p) => dist(p.x, p.y, c.x, c.y));
  const mean = radii.reduce((s, r) => s + r, 0) / N;
  const std = Math.sqrt(radii.reduce((s, r) => s + (r - mean) ** 2, 0) / N);
  const cv = std / mean;
  // Pearson correlation of radius with progress (spirals grow or shrink)
  const mi = (N - 1) / 2;
  let sxy = 0, sxx = 0, syy = 0;
  radii.forEach((r, i) => { sxy += (i - mi) * (r - mean); sxx += (i - mi) ** 2; syy += (r - mean) ** 2; });
  const corr = sxy / Math.sqrt(sxx * syy + 1e-6);

  const base = { x: c.x, y: c.y, size };
  if ((absTurn > TAU * 1.6 && (Math.abs(corr) > 0.4 || cv > 0.28)) || (absTurn > TAU * 0.85 && !closed && Math.abs(corr) > 0.65))
    return { ...base, shape: 'spiral', quality: clamp(Math.abs(corr)) };

  // Triangle: closed polyline with three sharp corners
  if (closed) {
    const simp = simplify(P, size * 0.13);
    let V = simp.slice(0, -1);
    if (V.length >= 3) {
      const keep = V.filter((v, i) => {
        const a = V[(i - 1 + V.length) % V.length], b = V[(i + 1) % V.length];
        return Math.abs(angleWrap(ang(v, b) - ang(a, v))) > 0.6;
      });
      if (keep.length === 3 && maxCorner > 1.1) return { ...base, shape: 'triangle', quality: clamp(maxCorner / 2), verts: keep };
    }
    if (cv < 0.3 && absTurn > TAU * 0.75 && absTurn < TAU * 1.6) return { ...base, shape: 'circle', quality: clamp(1 - cv * 2.5) };
  }
  return null;
}

/** Hold-to-arm, trace, release-to-cast state machine driven by the primary hand. */
export class RuneCaster {
  constructor() {
    this.state = 'idle'; this.hold = 0; this.holdProgress = 0;
    this.pts = []; this.len = 0; this.startT = 0; this.lost = 0; this.still = 0; this.cool = 0; this.tickAcc = 0;
  }
  get drawing() { return this.state === 'drawing'; }

  update(h, dt, t, ev) {
    const pointing = !!(h && h.present && h.pointing && !h.pinch);
    if (this.cool > 0) { this.cool -= dt; this.holdProgress = 0; return; }
    if (this.state === 'idle') {
      if (pointing) {
        this.hold += dt;
        this.holdProgress = clamp(this.hold / HOLD);
        if (this.hold >= HOLD) {
          this.state = 'drawing';
          this.pts = [{ x: h.x, y: h.y }];
          this.len = 0; this.startT = t; this.lost = 0; this.still = 0; this.tickAcc = 0;
          ev.push({ type: 'runeBegin', x: h.x, y: h.y });
        }
      } else { this.hold = 0; this.holdProgress = 0; }
      return;
    }
    if (pointing) {
      this.lost = 0;
      const last = this.pts[this.pts.length - 1];
      const d = dist(last.x, last.y, h.x, h.y);
      if (d > 3) {
        this.pts.push({ x: h.x, y: h.y });
        this.len += d; this.tickAcc += d;
        if (this.tickAcc > 70) { this.tickAcc = 0; ev.push({ type: 'runePoint', x: h.x, y: h.y, n: this.pts.length }); }
      }
      if (h.speed < 70 && this.len > 220) this.still += dt; else this.still = 0;
      if (this.still > 0.45) return this._finish(ev, t);
    } else {
      this.lost += dt;
      if (this.lost > 0.16) return this._finish(ev, t);
    }
    if (t - this.startT > 4.5) this._finish(ev, t);
  }

  _finish(ev, t) {
    const pts = this.pts, len = this.len, dur = t - this.startT;
    this.state = 'idle'; this.hold = 0; this.holdProgress = 0; this.cool = 0.35; this.pts = [];
    if (len < 140) return;
    const res = recognize(pts);
    if (res) ev.push({ type: 'rune', ...res, pts });
    else if (len > 280 && dur > 0.45) { const c = centroid(pts); ev.push({ type: 'runeFail', x: c.x, y: c.y, pts }); }
  }

  cancel() { this.state = 'idle'; this.pts = []; this.hold = 0; this.holdProgress = 0; }
}
