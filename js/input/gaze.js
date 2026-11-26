// ---------------------------------------------------------------------------
// Gaze estimation ("The Astral Reticle").
// Feature vector = iris offset inside each eye (along / across the eye axis)
// + head yaw/pitch proxies from landmarks. A 5-point calibration (centre + 4
// corners) fits a ridge-regularised linear map per screen axis; before that a
// neutral-relative default map keeps the reticle usable.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { Smooth2, clamp, solveLinear } from '../core/util.js';

const NORM = { ix: 0.05, iy: 0.05, hx: 0.1, hy: 0.06 };

export function gazeFeature(L, vw, vh) {
  const P = (i) => [L[i].x * vw, L[i].y * vh];
  if (L.length < 478) return null;
  const irises = [P(468), P(473)];
  let sx = 0, sy = 0;
  for (const [a, b] of [[33, 133], [362, 263]]) {
    let c1 = P(a), c2 = P(b);
    if (c1[0] > c2[0]) [c1, c2] = [c2, c1];
    const mid = [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2];
    const da = Math.hypot(irises[0][0] - mid[0], irises[0][1] - mid[1]);
    const db = Math.hypot(irises[1][0] - mid[0], irises[1][1] - mid[1]);
    const ir = da < db ? irises[0] : irises[1];
    const ux = c2[0] - c1[0], uy = c2[1] - c1[1], w = Math.hypot(ux, uy) || 1;
    const nx = ux / w, ny = uy / w, rx = ir[0] - mid[0], ry = ir[1] - mid[1];
    sx += (rx * nx + ry * ny) / w;
    sy += (-rx * ny + ry * nx) / w;
  }
  const nose = P(1), lc = P(234), rc = P(454), top = P(10), chin = P(152);
  const fw = Math.hypot(rc[0] - lc[0], rc[1] - lc[1]) || 1;
  const fh = Math.hypot(chin[0] - top[0], chin[1] - top[1]) || 1;
  return {
    ix: -sx / 2,                                   // + = screen right (mirrored)
    iy: sy / 2,                                    // + = down
    hx: -(nose[0] - (lc[0] + rc[0]) / 2) / fw,
    hy: (nose[1] - (top[1] + chin[1]) / 2) / fh,
  };
}

export class GazeTracker {
  constructor() {
    this.f = null; this.neutral = null; this.nBuf = [];
    this.model = null; this.samples = [];
    this.smooth = new Smooth2(0.17, 0.045, 2600);
    this.frozen = false; this.valid = false; this.x = 0; this.y = 0;
  }

  ingest(f, eyesClosed) {
    if (!f) return;
    this.frozen = eyesClosed;
    if (eyesClosed) return;           // iris is unreliable mid-blink
    this.f = f;
    if (!this.neutral) {
      this.nBuf.push(f);
      if (this.nBuf.length >= 12) this.neutral = avgFeature(this.nBuf);
    }
  }

  rel(f) {
    const n = this.neutral || f;
    return { ix: (f.ix - n.ix) / NORM.ix, iy: (f.iy - n.iy) / NORM.iy, hx: (f.hx - n.hx) / NORM.hx, hy: (f.hy - n.hy) / NORM.hy };
  }

  map(f) {
    const r = this.rel(f), W = app.W, H = app.H;
    if (this.model) {
      const { ax, ay } = this.model;
      return { x: ax[0] + ax[1] * r.ix + ax[2] * r.hx, y: ay[0] + ay[1] * r.iy + ay[2] * r.hy };
    }
    return { x: W / 2 + (r.ix * 0.2 + r.hx * 0.28) * W, y: H / 2 + (r.iy * 0.25 + r.hy * 0.3) * H };
  }

  frame(dt, facePresent) {
    if (!facePresent || !this.f || !this.neutral) { this.valid = false; return; }
    if (!this.frozen) {
      const p = this.map(this.f);
      const W = app.W, H = app.H;
      this.smooth.update(clamp(p.x, -40, W + 40), clamp(p.y, -40, H + 40), dt);
    }
    this.x = this.smooth.x; this.y = this.smooth.y; this.valid = true;
  }

  // ---- calibration ----
  beginCalibration() { this.samples = []; }
  setNeutral(f) { this.neutral = f; }
  addSample(tx, ty, f) { this.samples.push({ tx, ty, f }); }

  /** Ridge regression: x ≈ a0 + a1·ix + a2·hx and y ≈ b0 + b1·iy + b2·hy. */
  solve() {
    if (this.samples.length < 4) return false;
    const fit = (featA, featB, target) => {
      const lam = 0.4;
      const XtX = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], Xty = [0, 0, 0];
      for (const s of this.samples) {
        const r = this.rel(s.f), row = [1, r[featA], r[featB]];
        for (let i = 0; i < 3; i++) { Xty[i] += row[i] * s[target]; for (let j = 0; j < 3; j++) XtX[i][j] += row[i] * row[j]; }
      }
      XtX[1][1] += lam; XtX[2][2] += lam;
      return solveLinear(XtX, Xty);
    };
    const ax = fit('ix', 'hx', 'tx'), ay = fit('iy', 'hy', 'ty');
    if (!ax || !ay || [...ax, ...ay].some((v) => !Number.isFinite(v))) return false;
    this.model = { ax, ay };
    return true;
  }
}

export function avgFeature(list) {
  const o = { ix: 0, iy: 0, hx: 0, hy: 0 };
  for (const f of list) { o.ix += f.ix; o.iy += f.iy; o.hx += f.hx; o.hy += f.hy; }
  for (const k in o) o[k] /= list.length;
  return o;
}
