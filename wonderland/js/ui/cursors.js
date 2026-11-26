// ---------------------------------------------------------------------------
// Hand cursors. Children need to *see* where the portal thinks their hand
// is: a faint glowing skeleton of each camera hand, plus a sparkle orb at
// the cursor that changes with the pose (bright pen-star when pointing, a
// wide soft ring when the palm is open). Fast hands leave glitter trails.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { TAU, rand, hsl } from '../core/util.js';
import { glowSprite, sparkSprite } from '../fx/sprites.js';

const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];

export class Cursors {
  constructor() { this.visible = true; this.trail = true; }

  update() {
    if (!this.trail) return;
    for (const h of app.input.hands) {
      if (h.src === 'mouse' && !h.recent) continue;
      if (h.speed > 260 && Math.random() < 0.7) {
        app.particles.spawn(h.x + rand(-6, 6), h.y + rand(-6, 6), -h.vx * 0.05, -h.vy * 0.05 + 20, 0.6, rand(2, 4) * app.u, hsl(app.t * 120 + rand(60), 100, 70), 1, 30, 0.95);
      }
    }
  }

  draw(ctx) {
    if (!this.visible) return;
    const u = app.u, t = app.t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const h of app.input.hands) {
      if (h.src === 'mouse' && !h.recent) continue;
      const fade = h.lost ? 0.4 : 1;
      if (h.lm) {
        ctx.globalAlpha = 0.28 * fade;
        ctx.strokeStyle = '#d9c8ff'; ctx.lineWidth = 3 * u; ctx.lineCap = 'round';
        ctx.beginPath();
        for (const [a, b] of BONES) { ctx.moveTo(h.lm[a].x, h.lm[a].y); ctx.lineTo(h.lm[b].x, h.lm[b].y); }
        ctx.stroke();
        ctx.globalAlpha = 0.5 * fade;
        const spr = glowSprite('#c9b6ff');
        for (const i of [4, 8, 12, 16, 20]) { const s = 9 * u; ctx.drawImage(spr, h.lm[i].x - s, h.lm[i].y - s, s * 2, s * 2); }
      }
      ctx.globalAlpha = fade;
      if (h.pose === 'open') {
        const r = Math.max(36 * u, h.size * 0.9);
        ctx.strokeStyle = 'rgba(160,255,230,0.55)'; ctx.lineWidth = 4 * u;
        ctx.beginPath(); ctx.arc(h.palm.x, h.palm.y, r * (1 + Math.sin(t * 6) * 0.05), 0, TAU); ctx.stroke();
        const g = r * 1.4;
        ctx.globalAlpha = 0.45 * fade;
        ctx.drawImage(glowSprite('#7affd8'), h.palm.x - g, h.palm.y - g, g * 2, g * 2);
      } else if (h.pose === 'point' || h.pressed) {
        const s = 20 * u * (1 + Math.sin(t * 10) * 0.12);
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(t * 2);
        ctx.drawImage(sparkSprite(hsl(t * 90, 100, 72)), -s, -s, s * 2, s * 2);
        ctx.restore();
      } else {
        const s = 16 * u;
        ctx.globalAlpha = 0.85 * fade;
        ctx.drawImage(glowSprite('#ffe9fb'), h.x - s, h.y - s, s * 2, s * 2);
      }
    }
    ctx.restore();
  }
}
