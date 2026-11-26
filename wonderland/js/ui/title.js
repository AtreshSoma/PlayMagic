// ---------------------------------------------------------------------------
// The jelly rainbow "WONDERLAND PORTAL" title. Each letter bobs and glows
// in its own colour, and letters bounce away from a nearby hand.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { hsl, dist, clamp } from '../core/util.js';

const cache = new Map();

export function drawTitle(ctx, text, cx, cy, size, { hueShift = 0 } = {}) {
  const t = app.t;
  ctx.save();
  ctx.font = app.font(size, 700);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const key = text + size;
  let widths = cache.get(key);
  if (!widths) { widths = [...text].map((ch) => ctx.measureText(ch).width); cache.set(key, widths); }
  const gap = size * 0.04;
  const total = widths.reduce((a, b) => a + b + gap, -gap);
  let x = cx - total / 2;
  const hands = app.input?.hands || [];
  [...text].forEach((ch, i) => {
    const w = widths[i], lx = x + w / 2;
    x += w + gap;
    if (ch === ' ') return;
    let push = 0;
    for (const h of hands) { if (h.src === 'mouse' && !h.recent) continue; push = Math.max(push, clamp(1 - dist(h.x, h.y, lx, cy) / (size * 1.6))); }
    const bob = Math.sin(t * 2.2 + i * 0.55) * size * 0.07 - push * size * 0.35;
    const sq = 1 + Math.sin(t * 4.4 + i * 0.55) * 0.04 + push * 0.15;
    const hue = i * 22 + hueShift + t * 25;
    ctx.save();
    ctx.translate(lx, cy + bob);
    ctx.scale(1 / sq, sq);
    ctx.rotate(Math.sin(t * 1.7 + i) * 0.05 + push * 0.2 * Math.sin(i));
    ctx.shadowColor = hsl(hue, 100, 65); ctx.shadowBlur = size * 0.45;
    ctx.fillStyle = hsl(hue, 100, 80);
    ctx.fillText(ch, 0, 0);
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1.5, size * 0.04);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.strokeText(ch, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}
