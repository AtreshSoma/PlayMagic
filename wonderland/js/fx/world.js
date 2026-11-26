// ---------------------------------------------------------------------------
// The storybook world behind every mode:
//   night-sky gradient (palette eases per mode) → twinkling stars →
//   camera mirror (soft, optional) → glowing hills → floating islands with
//   bioluminescent mushrooms → drifting clouds → wandering fireflies.
// Islands and clouds are pre-rendered once to offscreen canvases.
// A gentle parallax follows the child's hand.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { TAU, rand, pick, damp, lerp, dist } from '../core/util.js';
import { glowSprite } from './sprites.js';

// [top, middle, horizon, hill glow]
const PALETTES = {
  hub:      ['#140a38', '#3a1a72', '#127083', '#5fffd7'],
  painter:  ['#0f1240', '#36287a', '#a9478f', '#ff9ee6'],
  firefly:  ['#06172f', '#103b5a', '#2b8a6a', '#b8ff6a'],
  glider:   ['#25104c', '#6a3591', '#f0937a', '#ffd27a'],
  symphony: ['#0a1138', '#203072', '#3b9bb8', '#7af0ff'],
  gate:     ['#100830', '#2c1560', '#5a2a8a', '#ffb6f2'],
  boop:     ['#0d2338', '#1d5a6a', '#4fb36a', '#c8ff8a'],
  basket:   ['#2a1040', '#7a3570', '#f08a5a', '#ffd27a'],
  monster:  ['#1a0b3a', '#4b1f7a', '#c25aa8', '#ffb3f0'],
};
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

function makeIsland(seed) {
  const W = 300, H = 240, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const top = 70, left = 30, right = W - 30;
  // rocky underside
  g.beginPath(); g.moveTo(left, top);
  const steps = 9;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps, x = lerp(left, right, u);
    const depth = Math.sin(u * Math.PI) * (110 + seed * 25) * (0.75 + Math.random() * 0.4);
    g.lineTo(x, top + 10 + depth);
  }
  g.lineTo(right, top); g.closePath();
  const rock = g.createLinearGradient(0, top, 0, H);
  rock.addColorStop(0, '#3c2a6e'); rock.addColorStop(1, '#120a2c');
  g.fillStyle = rock; g.fill();
  // glowing crystal veins
  g.strokeStyle = 'rgba(140,255,230,0.35)'; g.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    g.beginPath();
    let x = rand(left + 40, right - 40), y = top + 18;
    g.moveTo(x, y);
    for (let s = 0; s < 4; s++) { x += rand(-14, 14); y += rand(14, 26); g.lineTo(x, y); }
    g.stroke();
  }
  // grassy cap
  g.beginPath(); g.moveTo(left - 6, top + 8);
  for (let i = 0; i <= 24; i++) { const x = lerp(left - 6, right + 6, i / 24); g.lineTo(x, top - 6 - Math.sin(i * 1.7 + seed) * 4 - Math.random() * 4); }
  g.lineTo(right + 6, top + 12); g.quadraticCurveTo(W / 2, top + 26, left - 6, top + 8); g.closePath();
  const grass = g.createLinearGradient(0, top - 14, 0, top + 20);
  grass.addColorStop(0, '#7dffcf'); grass.addColorStop(0.4, '#2fae94'); grass.addColorStop(1, '#1b5b6e');
  g.fillStyle = grass; g.fill();
  // little round tree
  if (seed % 2 === 0) {
    const tx = rand(W * 0.3, W * 0.45);
    g.fillStyle = '#2a1a4a'; g.fillRect(tx - 4, top - 46, 8, 42);
    const can = g.createRadialGradient(tx - 8, top - 64, 4, tx, top - 56, 34);
    can.addColorStop(0, '#d6a8ff'); can.addColorStop(1, '#6b3fb8');
    g.fillStyle = can; g.beginPath(); g.arc(tx, top - 58, 30, 0, TAU); g.fill();
    for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(255,240,180,0.9)'; g.beginPath(); g.arc(tx + rand(-20, 20), top - 58 + rand(-18, 18), 2.2, 0, TAU); g.fill(); }
  }
  // bioluminescent mushrooms
  const caps = ['#6fe3ff', '#ff8be0', '#fff17a', '#9dff8a'];
  for (let k = 0; k < 5; k++) {
    const mx = rand(left + 20, right - 20), h = rand(10, 22), col = pick(caps);
    g.fillStyle = '#e8ddff'; g.fillRect(mx - 2, top - h, 4, h);
    const halo = g.createRadialGradient(mx, top - h, 0, mx, top - h, 18);
    halo.addColorStop(0, col); halo.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.6; g.fillStyle = halo; g.fillRect(mx - 18, top - h - 18, 36, 36); g.globalAlpha = 1;
    g.fillStyle = col; g.beginPath(); g.ellipse(mx, top - h, 9, 6, 0, Math.PI, TAU); g.fill();
  }
  return c;
}

function makeCloud() {
  const W = 320, H = 150, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  for (let k = 0; k < 9; k++) {
    const x = rand(60, W - 60), y = rand(55, H - 40), r = rand(30, 58);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(240,225,255,0.42)'); grd.addColorStop(0.6, 'rgba(210,190,255,0.2)'); grd.addColorStop(1, 'rgba(200,180,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  return c;
}

export class World {
  constructor() {
    this.pal = PALETTES.hub.map(hex);
    this.target = this.pal.map((c) => c.slice());
    this.islandArt = [0, 1, 2, 3].map(makeIsland);
    this.cloudArt = [0, 1, 2, 3].map(makeCloud);
    this.stars = Array.from({ length: 150 }, () => ({ x: Math.random(), y: Math.random() * 0.75, r: rand(0.5, 1.8), p: rand(TAU), s: rand(0.8, 2.6) }));
    this.islands = [
      { x: 0.08, y: 0.3, s: 0.42, art: 0, depth: 0.3, p: rand(TAU) },
      { x: 0.92, y: 0.24, s: 0.36, art: 1, depth: 0.25, p: rand(TAU) },
      { x: 0.5, y: 0.2, s: 0.22, art: 2, depth: 0.12, p: rand(TAU) },
      { x: 0.03, y: 0.78, s: 0.7, art: 3, depth: 0.6, p: rand(TAU) },
      { x: 0.98, y: 0.74, s: 0.62, art: 0, depth: 0.55, p: rand(TAU) },
    ];
    this.clouds = Array.from({ length: 6 }, (_, i) => ({ x: rand(-0.2, 1.1), y: rand(0.08, 0.7), s: rand(0.6, 1.4), v: rand(0.006, 0.018), art: i % 4, depth: rand(0.2, 0.7) }));
    this.flies = Array.from({ length: 38 }, () => this.newFly());
    this.px = 0; this.py = 0;
    this.scroll = 0; // modes can push the scenery sideways (Firefly Hop)
  }

  newFly() {
    return { x: Math.random(), y: rand(0.15, 0.95), p: rand(TAU), f: rand(0.3, 0.9), r: rand(2, 4.5), col: pick(['#eaff7a', '#b8ff6a', '#7affd8', '#ffe27a']), cool: 0 };
  }

  setPalette(name) { this.target = (PALETTES[name] || PALETTES.hub).map(hex); }

  update(dt) {
    for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) this.pal[i][k] = damp(this.pal[i][k], this.target[i][k], 2.2, dt);
    // parallax: follow the first hand a little
    const h = app.input.hands[0];
    const tx = h ? (h.x / app.W - 0.5) : 0, ty = h ? (h.y / app.H - 0.5) : 0;
    this.px = damp(this.px, tx, 1.5, dt); this.py = damp(this.py, ty, 1.5, dt);
    for (const c of this.clouds) {
      c.x += c.v * dt * (1 + this.scroll * 6 * c.depth);
      if (c.x > 1.25) { c.x = -0.3; c.y = rand(0.08, 0.7); }
    }
    const t = app.t;
    for (const f of this.flies) {
      f.x += (Math.cos(t * f.f + f.p) * 0.012 - this.scroll * 0.08) * dt;
      f.y += Math.sin(t * f.f * 1.3 + f.p * 2) * 0.01 * dt;
      if (f.x < -0.05) f.x = 1.05; if (f.x > 1.05) f.x = -0.05;
      f.cool = Math.max(0, f.cool - dt);
    }
  }

  /** Fireflies chime and sparkle when a hand brushes through them (hub play). */
  touchFireflies(hands) {
    for (const f of this.flies) {
      if (f.cool > 0) continue;
      const fx = f.x * app.W, fy = f.y * app.H;
      for (const h of hands) {
        if (h.src === 'mouse' && !h.recent) continue;
        if (dist(h.x, h.y, fx, fy) < 40 * app.u && h.speed > 80) {
          f.cool = 2.5;
          app.sound.chime(0.9 + Math.random() * 0.4, 0.06);
          app.particles.burst(fx, fy, 12, f.col, { kind: 1, speed: 160, size: 4, life: 0.7 });
          break;
        }
      }
    }
  }

  drawSky(ctx) {
    const W = app.W, H = app.H, [a, b, c, glow] = this.pal;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, css(a)); g.addColorStop(0.55, css(b)); g.addColorStop(1, css(c));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // aurora shimmer band
    const t = app.t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = css(glow);
    ctx.beginPath();
    ctx.moveTo(0, H * 0.25);
    for (let i = 0; i <= 20; i++) {
      const x = (i / 20) * W;
      ctx.lineTo(x, H * 0.22 + Math.sin(i * 0.6 + t * 0.4) * H * 0.04 + Math.sin(i * 1.7 - t * 0.3) * H * 0.02);
    }
    for (let i = 20; i >= 0; i--) {
      const x = (i / 20) * W;
      ctx.lineTo(x, H * 0.3 + Math.sin(i * 0.5 + t * 0.35) * H * 0.05);
    }
    ctx.fill();
    // stars
    ctx.globalAlpha = 1;
    const spr = glowSprite('#ffffff');
    for (const s of this.stars) {
      const tw = 0.5 + 0.5 * Math.sin(t * s.s + s.p);
      const r = s.r * (1.5 + tw * 2.5);
      ctx.globalAlpha = 0.3 + tw * 0.6;
      ctx.drawImage(spr, s.x * W - this.px * 8 - r, s.y * H - this.py * 6 - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  /** Soft mirror of the camera so children see themselves inside the world. */
  drawMirror(ctx, video, alpha) {
    if (alpha <= 0.01 || !video || video.readyState < 2) return;
    const W = app.W, H = app.H, { w: vw, h: vh } = app.video;
    const s = Math.max(W / vw, H / vh), dw = vw * s, dh = vh * s;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.restore();
    // dreamy tint so the camera image belongs to the storybook
    ctx.save();
    ctx.globalAlpha = alpha * 0.35;
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = css(this.pal[1]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  drawScenery(ctx, opt = {}) {
    const W = app.W, H = app.H, t = app.t, u = app.u, glow = this.pal[3];
    const { islands = true, clouds = true, fireflies = true, hills = true } = opt;
    ctx.save();
    if (hills) {
      // two rolling hill silhouettes with glowing rims
      for (let layer = 0; layer < 2; layer++) {
        const base = H * (0.9 + layer * 0.05), amp = H * (0.05 - layer * 0.015);
        const off = this.scroll * (layer ? 140 : 70) * u + this.px * (layer ? 30 : 15);
        ctx.beginPath(); ctx.moveTo(0, H);
        for (let i = 0; i <= 32; i++) {
          const x = (i / 32) * W;
          const y = base - Math.sin((x + off) * 0.006 + layer * 2) * amp - Math.sin((x + off) * 0.017) * amp * 0.4;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H); ctx.closePath();
        ctx.fillStyle = layer ? 'rgba(12,8,36,0.92)' : 'rgba(24,14,60,0.75)';
        ctx.fill();
        ctx.strokeStyle = css(glow, layer ? 0.5 : 0.3); ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    if (islands) {
      for (const is of this.islands) {
        const art = this.islandArt[is.art], s = is.s * u;
        const x = is.x * W - this.px * 40 * is.depth, y = is.y * H + Math.sin(t * 0.6 + is.p) * 8 * u - this.py * 20 * is.depth;
        ctx.globalAlpha = 0.55 + is.depth * 0.5;
        ctx.drawImage(art, x - art.width * s / 2, y - 70 * s, art.width * s, art.height * s);
      }
      ctx.globalAlpha = 1;
    }
    if (clouds) {
      for (const c of this.clouds) {
        const art = this.cloudArt[c.art], s = c.s * u;
        ctx.globalAlpha = 0.5 + c.depth * 0.4;
        ctx.drawImage(art, c.x * W - this.px * 30 * c.depth - art.width * s / 2, c.y * H - art.height * s / 2, art.width * s, art.height * s);
      }
      ctx.globalAlpha = 1;
    }
    if (fireflies) {
      ctx.globalCompositeOperation = 'lighter';
      for (const f of this.flies) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + f.p * 3);
        const r = f.r * u * (2.5 + pulse * 3) * (f.cool > 0 ? 1.8 : 1);
        ctx.globalAlpha = 0.35 + pulse * 0.6;
        ctx.drawImage(glowSprite(f.col), f.x * W - r, f.y * H - r, r * 2, r * 2);
      }
    }
    ctx.restore();
  }
}
