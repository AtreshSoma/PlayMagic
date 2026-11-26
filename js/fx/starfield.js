// ---------------------------------------------------------------------------
// Celestial map: a parallax starfield that two-hand expansion zooms, with the
// constellations you have bound (Gaze Constellations) etched faintly into it.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { CONSTELLATIONS } from '../data/constellations.js';
import { TAU, rgba, rand } from '../core/util.js';

export class Starfield {
  constructor() {
    this.stars = Array.from({ length: 240 }, () => ({ x: rand(-1, 1), y: rand(-1, 1), z: rand(0.3, 1), s: rand(0.5, 1.6), p: rand(TAU) }));
    // fixed sky placements for bound constellations
    this.slots = CONSTELLATIONS.map((c, i) => ({ id: c.id, x: Math.cos(i * 2.4) * 0.62, y: Math.sin(i * 2.4) * 0.5, s: 0.22 }));
  }

  draw(ctx, showCodex = false) {
    const W = app.W, H = app.H, cx = W / 2, cy = H / 2, z = app.zoom, t = app.t, R = Math.max(W, H) * 0.55;
    const px = (app.input.cursor.active ? (app.input.cursor.x - cx) / W : 0) * 18;
    const py = (app.input.cursor.active ? (app.input.cursor.y - cy) / H : 0) * 18;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.stars) {
      const k = 1 + (z - 1) * s.z * 1.6;
      const x = cx + s.x * R * k - px * s.z, y = cy + s.y * R * k - py * s.z;
      if (x < -5 || x > W + 5 || y < -5 || y > H + 5) continue;
      ctx.globalAlpha = (0.25 + 0.35 * Math.sin(t * 1.5 + s.p)) * s.z;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, s.s * k, s.s * k);
    }
    if (showCodex) {
      const codex = app.store.data.codex;
      ctx.globalAlpha = 1;
      for (const slot of this.slots) {
        if (!codex.includes(slot.id)) continue;
        const c = CONSTELLATIONS.find((q) => q.id === slot.id);
        const S = slot.s * R * z, ox = cx + slot.x * R * z - S / 2, oy = cy + slot.y * R * z - S / 2;
        ctx.strokeStyle = rgba(app.theme.accent, 0.16); ctx.lineWidth = 1;
        ctx.beginPath();
        c.path.forEach((si, k) => { const [sx, sy] = c.stars[si]; k ? ctx.lineTo(ox + sx * S, oy + sy * S) : ctx.moveTo(ox + sx * S, oy + sy * S); });
        ctx.stroke();
        ctx.fillStyle = rgba('#ffffff', 0.5);
        for (const [sx, sy] of c.stars) { ctx.beginPath(); ctx.arc(ox + sx * S, oy + sy * S, 1.4, 0, TAU); ctx.fill(); }
      }
    }
    ctx.restore();
  }
}
