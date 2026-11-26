// ---------------------------------------------------------------------------
// Dimensional Mirror.
//   Full Mirror      live camera, softly tinted
//   Ethereal Outline ghostly grayscale feed + luminous Sobel-edge aura that is
//                    weighted around your body, plus a constellation face mesh
//   Pure Void        nothing of you, only the tapestry
// Also draws the luminous hand skeletons with pinch-tension filaments.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { mapper } from '../input/mapper.js';
import { rgba, hexToRgb, clamp } from '../core/util.js';

const CONTOURS = [
  [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10],
  [33, 160, 158, 133, 153, 144, 33],
  [362, 385, 387, 263, 373, 380, 362],
  [70, 63, 105, 66, 107],
  [336, 296, 334, 293, 300],
  [61, 40, 37, 0, 267, 270, 291, 321, 314, 17, 84, 91, 61],
  [168, 6, 197, 195, 5, 4],
];
const KEY_STARS = [10, 152, 234, 454, 4, 33, 263, 133, 362, 61, 291, 168, 468, 473];
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];

export class Mirror {
  constructor(video, canvas) {
    this.video = video; this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mode = 'ethereal'; this.active = false;
    this.small = document.createElement('canvas');
    this.sctx = this.small.getContext('2d', { willReadFrequently: true });
    this.edge = document.createElement('canvas');
    this.ectx = this.edge.getContext('2d');
    this.prev = null; this.auraT = 0; this.hasAura = false;
  }

  setMode(m) { this.mode = m; this.canvas.className = 'mode-' + m; }
  resize(W, H) { this.canvas.width = W; this.canvas.height = H; }

  render(dt) {
    const ctx = this.ctx, v = this.video;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.active || this.mode === 'void' || v.readyState < 2) return;
    const r = mapper.videoRect();
    ctx.save();
    ctx.translate(r.x + r.w, r.y); ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, r.w, r.h);
    ctx.restore();
    if (this.mode === 'ethereal') {
      this.auraT += dt;
      if (this.auraT > 1 / 24) { this.auraT = 0; this._computeAura(); }
    }
  }

  /** Low-res Sobel edges, temporally smoothed, weighted around the person. */
  _computeAura() {
    const v = this.video, w = 160, h = Math.max(2, Math.round(160 * mapper.vh / mapper.vw));
    if (this.small.width !== w || this.small.height !== h) {
      this.small.width = this.edge.width = w; this.small.height = this.edge.height = h;
      this.prev = new Float32Array(w * h); this.out = this.ectx.createImageData(w, h);
    }
    this.sctx.drawImage(v, 0, 0, w, h);
    let img;
    try { img = this.sctx.getImageData(0, 0, w, h).data; } catch { return; }
    const lum = new Float32Array(w * h);
    for (let i = 0, j = 0; i < lum.length; i++, j += 4) lum[i] = img[j] * 0.3 + img[j + 1] * 0.59 + img[j + 2] * 0.11;

    // Body weighting (in unmirrored small-frame coordinates) from face position.
    const f = app.input.face;
    let fx = w / 2, fy = h * 0.35, fw = w * 0.2;
    if (f.present && f.hasPts) {
      const nose = { x: f.pts[4 * 2], y: f.pts[4 * 2 + 1] };
      const r = mapper.videoRect();
      fx = (1 - (nose.x - r.x) / r.w) * w; fy = ((nose.y - r.y) / r.h) * h;
      fw = (f.width / r.w) * w;
    }
    const [cr, cg, cb] = hexToRgb(app.theme.accent);
    const out = this.out.data, prev = this.prev;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx = -lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1] + lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1];
        const gy = -lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1] + lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1];
        let m = Math.sqrt(gx * gx + gy * gy);
        const dx = (x - fx) / (fw * 2.4), above = y < fy - fw * 1.1 ? (fy - fw * 1.1 - y) / (fw * 0.8) : 0;
        const weight = Math.exp(-dx * dx) * Math.exp(-above * above);
        m = m * (0.15 + 0.85 * weight);
        const e = (prev[i] = prev[i] * 0.55 + m * 0.45);
        const a = clamp((e - 26) * 2.4, 0, 255);
        const j = i * 4;
        out[j] = cr; out[j + 1] = cg; out[j + 2] = cb; out[j + 3] = a;
      }
    }
    this.ectx.putImageData(this.out, 0, 0);
    this.hasAura = true;
  }

  /** Called on the fx canvas: edge aura, constellation mesh. */
  drawAura(ctx) {
    if (!this.active || this.mode === 'void') return;
    if (this.mode === 'ethereal' && this.hasAura) {
      const r = mapper.videoRect();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(r.x + r.w, r.y); ctx.scale(-1, 1);
      ctx.globalAlpha = 0.55; ctx.drawImage(this.edge, 0, 0, r.w, r.h);
      ctx.globalAlpha = 0.25; ctx.drawImage(this.edge, -r.w * 0.006, -r.h * 0.006, r.w * 1.012, r.h * 1.012);
      ctx.restore();
    }
    const f = app.input.face;
    if (f.present && f.hasPts) this._drawMesh(ctx, f.pts, this.mode === 'full' ? 0.5 : 0.9);
  }

  _drawMesh(ctx, P, strength) {
    const t = app.t, acc = app.theme.accent, acc2 = app.theme.accent2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = rgba(acc2, 0.22 * strength);
    for (const c of CONTOURS) {
      ctx.beginPath();
      c.forEach((idx, k) => (k ? ctx.lineTo(P[idx * 2], P[idx * 2 + 1]) : ctx.moveTo(P[idx * 2], P[idx * 2 + 1])));
      ctx.stroke();
    }
    ctx.fillStyle = rgba('#ffffff', 0.65 * strength);
    for (const c of CONTOURS) for (let k = 0; k < c.length; k += 2) {
      const idx = c[k], tw = 0.6 + 0.4 * Math.sin(t * 3 + idx);
      ctx.globalAlpha = tw * strength;
      ctx.fillRect(P[idx * 2] - 0.9, P[idx * 2 + 1] - 0.9, 1.8, 1.8);
    }
    const spr = app.particles.spriteCanvas(acc);
    for (const idx of KEY_STARS) {
      const tw = 0.55 + 0.45 * Math.sin(t * 2.2 + idx * 0.7), s = (idx >= 468 ? 9 : 7) * tw;
      ctx.globalAlpha = 0.8 * strength;
      ctx.drawImage(spr, P[idx * 2] - s, P[idx * 2 + 1] - s, s * 2, s * 2);
    }
    ctx.restore();
  }

  /** Luminous bones; thumb–index filament brightens with pinch tension. */
  drawHands(ctx, hands) {
    const acc = app.theme.accent, acc2 = app.theme.accent2;
    const spr = app.particles.spriteCanvas(acc), spr2 = app.particles.spriteCanvas('#ffffff');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const h of hands) {
      if (!h.present || h.source !== 'camera') continue;
      const P = h.pts;
      ctx.strokeStyle = rgba(acc2, 0.35); ctx.lineWidth = 3;
      ctx.beginPath();
      for (const [a, b] of BONES) { ctx.moveTo(P[a].x, P[a].y); ctx.lineTo(P[b].x, P[b].y); }
      ctx.stroke();
      ctx.strokeStyle = rgba('#ffffff', 0.25); ctx.lineWidth = 1; ctx.stroke();
      for (let i = 0; i < 21; i++) {
        const tip = i % 4 === 0 && i > 0, s = tip ? 9 : 4;
        ctx.globalAlpha = tip ? 0.9 : 0.5;
        ctx.drawImage(spr, P[i].x - s, P[i].y - s, s * 2, s * 2);
      }
      // pinch tension filament
      const T = h.tension;
      if (T > 0.15) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = rgba(h.pinch ? '#ffffff' : acc, 0.25 + T * 0.7);
        ctx.lineWidth = 1 + T * 3;
        ctx.beginPath();
        const ax = P[4].x, ay = P[4].y, bx = P[8].x, by = P[8].y;
        const mx = (ax + bx) / 2 + Math.sin(app.t * 30) * (1 - T) * 6, my = (ay + by) / 2 + Math.cos(app.t * 27) * (1 - T) * 6;
        ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
        if (h.pinch) { const s = 16 + Math.sin(app.t * 20) * 3; ctx.drawImage(spr2, (ax + bx) / 2 - s, (ay + by) / 2 - s, s * 2, s * 2); }
      }
      // pose label near the wrist
      const pose = h.pinch ? 'PINCH' : h.fist ? 'FIST' : h.pointing ? 'POINT' : h.open ? 'PALM' : '';
      if (pose) {
        ctx.globalAlpha = 0.75; ctx.globalCompositeOperation = 'source-over';
        ctx.font = '600 9px Inter, sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = rgba(acc, 0.9);
        ctx.fillText(pose, P[0].x, P[0].y + 22);
        ctx.globalCompositeOperation = 'lighter';
      }
    }
    ctx.restore();
  }
}

