// ---------------------------------------------------------------------------
// SKY PAINTER: magic air-doodle studio.
//
//   point a finger       → paint in the air (or press + drag with mouse/touch)
//   open your palm       → "push & play": doodles come alive, float, and
//                          bounce away when swatted (mouse: the hand bubble)
//   top paint orbs       → colours (rainbow first)
//   left bubbles         → brushes: rainbow ribbon · glitter · slime ·
//                          butterflies · neon tube · soap bubbles
//   right bubbles        → stamps: star · heart · planet, then
//                          mirror magic (off → 2 → 4 → 6-way kaleidoscope) and
//                          trace-a-picture (sparkly dotted outlines to follow)
//   bottom-right row     → play-mode hand · undo · save picture · whirlwind
//   wave both hands / shake head / whirlwind bubble → sparkle whirlwind that
//                          pops every doodle and clears the sky
// Points: every finished doodle drops a star in the jar; finishing a traced
// picture is worth 3 and starts the next picture.
//
// Strokes are smoothed with midpoint quadratic curves and baked once into
// small offscreen canvases, so dozens of glowing doodles fly at 60 FPS.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { TAU, clamp, dist, rand, hsl, Spring, ease, roundRect } from '../core/util.js';
import { Bubble, homeBubble } from '../ui/bubble.js';
import { icon, drawButterfly } from '../ui/icons.js';
import { STAMPS } from '../ui/props.js';
import { StarJar } from '../ui/hud.js';
import { sparkSprite, glowSprite } from '../fx/sprites.js';

const COLORS = ['rainbow', 330, 25, 52, 130, 190, 270];
const BRUSHES = ['ribbon', 'glitter', 'slime', 'butterfly', 'neon', 'bubble'];
const SYMS = [1, 2, 4, 6];
const STAMP_KINDS = ['star', 'heart', 'planet'];
const STAMP_HUE = { star: 48, heart: 338, planet: 265 };
const MAX_DOODLES = 90;
const WHIRL_TIME = 2.2;

const rnd = (i) => { const s = Math.sin(i * 12.9898) * 43758.5453; return s - Math.floor(s); };

/** Trace-a-picture outlines in unit space (−1..1), sampled densely. */
const sample = (fn, n) => Array.from({ length: n }, (_, i) => fn(i / n));
const poly = (pts, n) => { // closed polyline resampled to n points
  const segs = pts.map((p, i) => [p, pts[(i + 1) % pts.length]]), L = segs.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1])), tot = L.reduce((a, b) => a + b, 0);
  return sample((u) => { let d = u * tot, i = 0; while (d > L[i] && i < L.length - 1) d -= L[i++]; const [a, b] = segs[i], k = d / (L[i] || 1); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; }, n);
};
const TEMPLATES = [
  { name: 'star', pts: poly(Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * TAU - Math.PI / 2, r = i % 2 ? 0.42 : 1; return [Math.cos(a) * r, Math.sin(a) * r]; }), 90) },
  { name: 'heart', pts: sample((u) => { const a = u * TAU; return [Math.pow(Math.sin(a), 3), -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16 - 0.1]; }, 90) },
  { name: 'smile', pts: [...sample((u) => [Math.cos(u * TAU), Math.sin(u * TAU)], 70), ...sample((u) => [Math.cos(0.25 * Math.PI + u * 0.5 * Math.PI) * 0.55, Math.sin(0.25 * Math.PI + u * 0.5 * Math.PI) * 0.55], 16), ...sample((u) => [-0.35 + Math.cos(u * TAU) * 0.1, -0.3 + Math.sin(u * TAU) * 0.1], 8), ...sample((u) => [0.35 + Math.cos(u * TAU) * 0.1, -0.3 + Math.sin(u * TAU) * 0.1], 8)] },
  { name: 'house', pts: poly([[-0.75, 1], [0.75, 1], [0.75, 0], [1, 0], [0, -0.95], [-1, 0], [-0.75, 0]], 96) },
  { name: 'fish', pts: [...sample((u) => { const a = u * TAU; return [Math.cos(a) * 0.75 - 0.15, Math.sin(a) * 0.45]; }, 60), ...poly([[0.55, 0], [1, -0.45], [1, 0.45]], 30)] },
  { name: 'flower', pts: sample((u) => { const a = u * TAU, r = 0.55 + 0.4 * Math.abs(Math.cos(a * 2.5)); return [Math.cos(a) * r, Math.sin(a) * r]; }, 110) },
];

/** Paints a stroke (array of {x,y}) with one of the four brushes. */
function renderStroke(ctx, pts, brush, hue, seed = 0) {
  const n = pts.length, u = app.u;
  if (n < 2) return;
  const hueAt = (i) => (hue === 'rainbow' ? (i * 5 + seed * 60) % 360 : hue + (rnd(i + seed) - 0.5) * 16);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // midpoint quadratic smoothing: each piece runs mid(i-1,i) → mid(i,i+1) curving through point i
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const seg = (w, colorFn, alpha, comp = 'source-over', ox = 0, oy = 0) => {
    ctx.globalCompositeOperation = comp; ctx.globalAlpha = alpha; ctx.lineWidth = w;
    for (let i = 1; i < n; i++) {
      const a = i === 1 ? pts[0] : mid(pts[i - 1], pts[i]), b = i === n - 1 ? pts[i] : mid(pts[i], pts[i + 1]);
      ctx.strokeStyle = colorFn(i);
      ctx.beginPath(); ctx.moveTo(a.x + ox, a.y + oy); ctx.quadraticCurveTo(pts[i].x + ox, pts[i].y + oy, b.x + ox, b.y + oy); ctx.stroke();
    }
  };
  if (brush === 'ribbon') {
    seg(22 * u, (i) => hsl(hueAt(i), 100, 62), 0.22, 'lighter');
    seg(10 * u, (i) => hsl(hueAt(i), 100, 64), 1);
    seg(3.5 * u, () => 'rgba(255,255,255,0.85)', 1);
  } else if (brush === 'slime') {
    seg(28 * u, (i) => hsl(hueAt(i), 90, 30), 1);
    seg(21 * u, (i) => hsl(hueAt(i), 100, 56), 1);
    seg(14 * u, (i) => hsl(hueAt(i), 100, 66), 0.25, 'lighter');
    seg(5 * u, (i) => hsl(hueAt(i), 100, 88), 0.9, 'source-over', -4 * u, -4 * u);
  } else if (brush === 'glitter') {
    seg(2.5 * u, (i) => hsl(hueAt(i), 100, 75), 0.55, 'lighter');
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
    for (let i = 0; i < n; i += 2) {
      const s = (5 + rnd(i * 3 + seed) * 10) * u, h = hue === 'rainbow' ? rnd(i + seed) * 360 : hueAt(i);
      ctx.drawImage(sparkSprite(hsl(Math.round(h / 15) * 15, 100, 70)), pts[i].x - s + (rnd(i) - 0.5) * 10 * u, pts[i].y - s + (rnd(i + 7) - 0.5) * 10 * u, s * 2, s * 2);
    }
  } else if (brush === 'neon') {
    seg(30 * u, (i) => hsl(hueAt(i), 100, 58), 0.16, 'lighter');
    seg(15 * u, (i) => hsl(hueAt(i), 100, 62), 0.35, 'lighter');
    seg(6 * u, (i) => hsl(hueAt(i), 100, 72), 1, 'lighter');
    seg(2 * u, () => '#ffffff', 1);
  } else if (brush === 'bubble') {
    let acc = 0;
    for (let i = 1; i < n; i++) {
      acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      const r = (8 + rnd(i + seed) * 14) * u;
      if (acc < r * 1.3) continue;
      acc = 0;
      const h = hue === 'rainbow' ? (i * 23 + seed * 40) % 360 : hueAt(i), x = pts[i].x, y = pts[i].y;
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(0.75, hsl(h, 100, 75, 0.18)); g.addColorStop(1, hsl(h + 60, 100, 75, 0.55));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = hsl(h + 120, 100, 85, 0.85); ctx.lineWidth = Math.max(1, 1.6 * u); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.17, 0, TAU); ctx.fill();
    }
  } else { // butterfly trail
    seg(10 * u, (i) => hsl(hueAt(i), 100, 70), 0.2, 'lighter');
    ctx.setLineDash([2 * u, 9 * u]);
    seg(3.5 * u, (i) => hsl(hueAt(i), 100, 80), 0.9, 'lighter');
  }
  ctx.restore();
}

class Doodle {
  constructor(kind, o) {
    this.kind = kind; // 'stroke' | 'stamp'
    Object.assign(this, o);
    this.x = this.x ?? 0; this.y = this.y ?? 0;
    this.pts = []; this.len = 0;
    this.rot = 0; this.vx = 0; this.vy = 0; this.vr = 0;
    this.spring = new Spring(180, 7, 1);
    this.cool = 0; this.seed = rand(100); this.r = 30 * app.u;
    this.flies = []; this.img = null; this.popping = 0; this.grow = 0;
  }

  get width() { return { ribbon: 12, slime: 26, glitter: 12, butterfly: 10, neon: 16, bubble: 22 }[this.brush] * app.u || 20; }

  /** Turns the live stroke into a baked, centred doodle. */
  finish() {
    const pts = this.pts;
    let cx = 0, cy = 0;
    for (const p of pts) { cx += p.x; cy += p.y; }
    cx /= pts.length; cy /= pts.length;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, r = 0;
    for (const p of pts) {
      p.x -= cx; p.y -= cy;
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      r = Math.max(r, Math.hypot(p.x, p.y));
    }
    this.x = cx; this.y = cy; this.r = r + this.width;
    const pad = this.width * 1.6 + 16 * app.u;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(maxX - minX + pad * 2));
    c.height = Math.max(1, Math.ceil(maxY - minY + pad * 2));
    this.ox = minX - pad; this.oy = minY - pad;
    const g = c.getContext('2d');
    g.translate(-this.ox, -this.oy);
    renderStroke(g, pts, this.brush, this.hue, this.seed);
    this.img = c;
    if (this.brush === 'butterfly') {
      let acc = 0;
      for (let i = 1; i < pts.length; i++) {
        acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        if (acc > 90 * app.u || i === 1) {
          acc = 0;
          this.flies.push({ x: pts[i].x, y: pts[i].y, p: rand(TAU), hue: this.hue === 'rainbow' ? rand(360) : this.hue + rand(-20, 20) });
        }
      }
    }
    this.spring.kick(4);
  }

  toLocal(px, py) {
    const dx = px - this.x, dy = py - this.y, c = Math.cos(-this.rot), s = Math.sin(-this.rot), sc = this.spring.x || 1;
    return { x: (dx * c - dy * s) / sc, y: (dx * s + dy * c) / sc };
  }

  hit(px, py, rad) {
    if (dist(px, py, this.x, this.y) > this.r + rad) return false;
    if (this.kind === 'stamp') return true;
    const p = this.toLocal(px, py), R = rad + this.width * 0.5, R2 = R * R;
    for (let i = 0; i < this.pts.length; i += 2) {
      const q = this.pts[i], dx = q.x - p.x, dy = q.y - p.y;
      if (dx * dx + dy * dy < R2) return true;
    }
    return false;
  }

  draw(ctx, t) {
    const sc = this.spring.x * (1 - ease.inOut(clamp(this.popping))) * (this.kind === 'stamp' ? ease.outBack(clamp(this.grow)) : 1);
    if (sc <= 0.01) return;
    ctx.save();
    ctx.translate(this.x, this.y); ctx.rotate(this.rot);
    // jelly squish: stretch one axis while the other shrinks
    ctx.scale(sc, sc * Math.max(0.3, 2 - this.spring.x) / Math.max(0.3, this.spring.x));
    if (this.kind === 'stamp') {
      STAMPS[this.stamp](ctx, this.size, t + this.seed, this.hue === 'rainbow' ? STAMP_HUE[this.stamp] : this.hue);
    } else if (this.img) {
      ctx.drawImage(this.img, this.ox, this.oy);
      for (const f of this.flies) {
        ctx.save();
        ctx.translate(f.x + Math.cos(t * 1.3 + f.p) * 12 * app.u, f.y + Math.sin(t * 2.1 + f.p) * 9 * app.u);
        ctx.rotate(Math.sin(t * 1.3 + f.p) * 0.4);
        drawButterfly(ctx, 24 * app.u, t + f.p, f.hue);
        ctx.restore();
      }
    } else {
      renderStroke(ctx, this.pts, this.brush, this.hue, this.seed);
    }
    ctx.restore();
  }
}

export class PainterMode {
  constructor() {
    this.palette = 'painter';
    this.scenery = { islands: false };
    this.doodles = []; this.live = new Map();
    this.hue = 'rainbow'; this.brush = 'ribbon'; this.stamp = null;
    this.play = false; this.openT = 0; this.pointT = 0; this.whirl = null;
    this.sym = 1; this.trace = null; this.traceIdx = -1; this.group = 0; this.flash = 0; this.starCool = 0; this.saveCool = 0;
    this.jar = new StarJar(10);

    this.home = homeBubble(icon.home);
    this.colorB = COLORS.map((c) => new Bubble({ id: 'c' + c, hue: c === 'rainbow' ? 300 : c, icon: icon.color(c), onSelect: () => this.setColor(c) }));
    this.brushB = BRUSHES.map((b) => new Bubble({ id: b, hue: 280, icon: b === 'bubble' ? icon.bubbleBrush : icon[b], onSelect: () => this.setBrush(b) }));
    this.playB = new Bubble({ id: 'play', hue: 165, icon: icon.openHand, onSelect: () => this.setPlay(!this.play) });
    this.stampB = STAMP_KINDS.map((s) => new Bubble({ id: s, hue: STAMP_HUE[s], icon: icon[s], onSelect: () => this.setStamp(s) }));
    this.mirrorB = new Bubble({ id: 'mirror', hue: 300, icon: (ctx, s, t) => icon.mirror(this.sym)(ctx, s, t), onSelect: () => this.cycleSym() });
    this.traceB = new Bubble({ id: 'trace', hue: 48, icon: icon.trace, onSelect: () => this.nextTrace() });
    this.undoB = new Bubble({ id: 'undo', hue: 210, icon: icon.undo, dwell: 0.8, onSelect: () => this.undo() });
    this.saveB = new Bubble({ id: 'save', hue: 140, icon: icon.save, dwell: 1.4, onSelect: () => this.savePicture() });
    this.whirlB = new Bubble({ id: 'whirl', hue: 200, icon: icon.whirl, dwell: 1.2, onSelect: () => this.startWhirl() });
    this.ui = [this.home, ...this.colorB, ...this.brushB, ...this.stampB, this.mirrorB, this.traceB, this.playB, this.undoB, this.saveB, this.whirlB];
  }

  enter() {
    this.live.clear(); this.play = false; this.whirl = null;
    const noCam = app.input.cam.state === 'off' || app.input.cam.state === 'error';
    app.coach.show(noCam ? ['drag'] : ['point-draw', 'palm-push']);
  }

  exit() { this.finishAll(); }

  setColor(c) { this.hue = c; app.sound.note(COLORS.indexOf(c) + 5); }
  setBrush(b) { this.brush = b; this.stamp = null; this.setPlay(false, true); app.sound.boing(1.2); }
  setStamp(s) { this.stamp = s; this.setPlay(false, true); app.sound.boing(1.4); }

  setPlay(on, quiet = false) {
    if (on === this.play) return;
    this.play = on;
    if (on) {
      this.finishAll();
      app.sound.boing(0.8); app.sound.sparkle();
      for (const d of this.doodles) {
        const a = rand(TAU), s = rand(60, 150) * app.u;
        d.vx += Math.cos(a) * s; d.vy += Math.sin(a) * s; d.vr += rand(-1, 1); d.spring.kick(5);
      }
    } else if (!quiet) app.sound.chime();
  }

  // ------------------------------------------------------------------ mirror magic
  cycleSym() {
    this.sym = SYMS[(SYMS.indexOf(this.sym) + 1) % SYMS.length];
    app.sound.chime(1 + this.sym * 0.08); app.sound.sparkle();
    app.particles.burst(app.W / 2, app.H / 2, 12 * this.sym, null, { kind: 1, speed: 300, size: 6 });
  }

  /** Extra copies of a point for the current symmetry (mirror / rotations about the centre). */
  xforms() {
    const cx = app.W / 2, cy = app.H / 2, n = this.sym;
    if (n === 1) return [];
    const mx = (p) => ({ x: 2 * cx - p.x, y: p.y }), my = (p) => ({ x: p.x, y: 2 * cy - p.y });
    if (n === 2) return [mx];
    if (n === 4) return [mx, my, (p) => mx(my(p))];
    return [1, 2, 3, 4, 5].map((k) => {
      const a = (k * TAU) / n, c = Math.cos(a), sn = Math.sin(a);
      return (p) => ({ x: cx + (p.x - cx) * c - (p.y - cy) * sn, y: cy + (p.x - cx) * sn + (p.y - cy) * c });
    });
  }

  // ------------------------------------------------------------------ trace a picture
  nextTrace() {
    this.traceIdx++;
    if (this.traceIdx >= TEMPLATES.length) { this.traceIdx = -1; this.trace = null; app.sound.chime(0.8); return; }
    const tpl = TEMPLATES[this.traceIdx];
    this.trace = { name: tpl.name, pts: tpl.pts.map(([ux, uy]) => ({ ux, uy, done: false })), doneN: 0, complete: 0 };
    app.sound.chime(1.3); app.sound.sparkle();
    if (this.traceIdx === 0 && !this.traceShown) { this.traceShown = true; app.coach.show(['trace']); }
  }

  traceGeom() { return { cx: app.W / 2, cy: app.H * 0.54, size: Math.min(app.W, app.H) * 0.28 }; }

  traceHit(x, y) {
    const tr = this.trace;
    if (!tr || tr.complete) return;
    const { cx, cy, size } = this.traceGeom(), R = 26 * app.u;
    for (const p of tr.pts) {
      if (p.done) continue;
      if (Math.abs(cx + p.ux * size - x) < R && Math.abs(cy + p.uy * size - y) < R) {
        p.done = true; tr.doneN++;
        if (tr.doneN % 6 === 0) app.sound.xylo(523 * Math.pow(2, ((tr.doneN / 6) % 8) / 7), 0.08);
      }
    }
    app.coach.tried('trace');
    if (tr.doneN / tr.pts.length >= 0.85) {
      tr.complete = 0.001;
      app.sound.fanfare();
      for (let k = 0; k < 5; k++) app.particles.confetti(cx + (k - 2) * size * 0.4, cy, 26, 1.1);
      for (let k = 0; k < 3; k++) this.addStar(true);
    }
  }

  addStar(force = false) {
    if (!force && this.starCool > 0) return;
    this.starCool = 0.8;
    if (this.jar.add()) { app.sound.fanfare(); app.particles.confetti(app.W / 2, app.H * 0.5, 50, 1.2); }
  }

  // ------------------------------------------------------------------ undo / save
  undo() {
    if (this.live.size) this.finishAll();
    if (!this.doodles.length) { app.sound.boing(0.7); return; }
    const g = this.doodles[this.doodles.length - 1].group;
    for (const d of this.doodles) if (d.group === g) app.particles.burst(d.x, d.y, 12, null, { kind: 1, speed: 200, size: 5 });
    this.doodles = this.doodles.filter((d) => d.group !== g);
    app.sound.pop(0.9); app.sound.whoosh(0.3, false, 0.08);
  }

  savePicture() {
    if (this.saveCool > 0) return;
    this.saveCool = 3;
    this.finishAll();
    const W = app.W, H = app.H, k = Math.min(2, app.dpr), c = document.createElement('canvas');
    c.width = Math.round(W * k); c.height = Math.round(H * k);
    const g = c.getContext('2d');
    g.scale(k, k);
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0f1240'); bg.addColorStop(0.6, '#36287a'); bg.addColorStop(1, '#a9478f');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + rnd(i) * 0.6})`; g.beginPath(); g.arc(rnd(i * 3) * W, rnd(i * 7) * H * 0.8, 0.6 + rnd(i * 11) * 1.6, 0, TAU); g.fill(); }
    for (const d of this.doodles) d.draw(g, app.t);
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 4; roundRect(g, 10, 10, W - 20, H - 20, 24); g.stroke();
    g.font = app.font(22, 700); g.fillStyle = '#ffffff'; g.textAlign = 'right';
    g.fillText(`My Wonderland painting · ${new Date().toLocaleDateString()}`, W - 34, H - 34);
    try {
      const a = document.createElement('a');
      a.href = c.toDataURL('image/png'); a.download = `wonderland-painting-${Date.now()}.png`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { console.warn('[Wonderland] could not save the painting', e); }
    this.flash = 1;
    app.sound.chime(1.4); app.sound.sparkle();
  }

  // ------------------------------------------------------------------ layout
  layout() {
    const W = app.W, H = app.H, u = app.u;
    const r = clamp(Math.min(W, H) * 0.048, 24, 44), m = 16 * u;
    this.home.place(r * 1.1 + m, r * 1.1 + m, r * 1.1);
    this.jarPos = { x: W - 130 * u, y: r + m + 6 * u };
    const left = this.home.x + r * 2.4, right = W - 190 * u;
    const step = Math.min(r * 2.5, (right - left) / (COLORS.length - 1));
    const x0 = (left + right) / 2 - step * (COLORS.length - 1) / 2;
    this.colorB.forEach((b, i) => b.place(x0 + i * step, r + m, r * (b.active ? 1.08 : 0.92)));
    // left column: brushes
    const ly0 = this.home.y + r * 2.7, lstep = Math.min(r * 2.35, (H - ly0 - r * 1.3) / (this.brushB.length - 1));
    this.brushB.forEach((b, i) => b.place(r + m, ly0 + i * lstep, r));
    // bottom-right row (right → left): whirlwind · save · undo · play hand
    const by = H - r - m;
    [this.whirlB, this.saveB, this.undoB, this.playB].forEach((b, i) => b.place(W - r - m - i * r * 2.4, by, r * 0.95));
    // right column: stamps, mirror, trace (kept above the bottom row)
    const rcol = [...this.stampB, this.mirrorB, this.traceB];
    const ry0 = this.jarPos.y + r * 2.6, rstep = Math.min(r * 2.35, (by - r * 2.6 - ry0) / (rcol.length - 1));
    rcol.forEach((b, i) => b.place(W - r - m, ry0 + i * rstep, r));
    this.colorB.forEach((b, i) => (b.active = this.hue === COLORS[i]));
    this.brushB.forEach((b, i) => (b.active = !this.stamp && this.brush === BRUSHES[i]));
    this.stampB.forEach((b, i) => (b.active = this.stamp === STAMP_KINDS[i]));
    this.playB.active = this.play;
    this.mirrorB.active = this.sym > 1;
    this.traceB.active = !!this.trace;
  }

  overUI(x, y) { return this.ui.some((b) => b.contains(x, y, 1.35)); }

  addDoodle(d) {
    this.doodles.push(d);
    while (this.doodles.length > MAX_DOODLES) {
      const old = this.doodles.shift();
      app.particles.burst(old.x, old.y, 14, null, { kind: 1, speed: 200, size: 5 });
    }
  }

  finishStroke(id) {
    const d = this.live.get(id);
    this.live.delete(id);
    if (!d) return;
    if (d.pts.length < 3) return;
    const g = ++this.group;
    // mirror copies first (finish() re-centres the points)
    const copies = this.xforms().map((xf) => {
      const c = new Doodle('stroke', { brush: d.brush, hue: d.hue });
      c.seed = d.seed; c.pts = d.pts.map(xf); c.group = g;
      return c;
    });
    d.group = g;
    for (const c of [d, ...copies]) { c.finish(); this.addDoodle(c); }
    app.sound.note(Math.floor(rand(5, 12)), 0.1);
    if (d.len > 80 * app.u) this.addStar();
  }

  finishAll() { for (const id of [...this.live.keys()]) this.finishStroke(id); }

  placeStamp(x, y) {
    const g = ++this.group, u = app.u;
    for (const p of [{ x, y }, ...this.xforms().map((xf) => xf({ x, y }))]) {
      const st = new Doodle('stamp', { stamp: this.stamp, hue: this.hue, x: p.x, y: p.y, size: 30 * u });
      st.r = st.size * 1.4; st.spring.kick(6); st.group = g;
      this.addDoodle(st);
      this.traceHit(p.x, p.y);
    }
    app.sound.boing(1.3 + rand(0.3)); app.particles.burst(x, y, 14, null, { kind: 1, speed: 220, size: 5 });
    this.addStar();
  }

  update(dt) {
    const inp = app.input, u = app.u, t = app.t;
    this.layout();
    for (const b of this.ui) b.update(dt);
    this.jar.update(dt);
    this.starCool = Math.max(0, this.starCool - dt); this.saveCool = Math.max(0, this.saveCool - dt); this.flash = Math.max(0, this.flash - dt * 2);
    if (this.trace?.complete) { this.trace.complete += dt; if (this.trace.complete > 2.2) { if (this.traceIdx >= TEMPLATES.length - 1) this.traceIdx = -1; this.nextTrace(); } }

    // open palm → play, pointing → paint (camera hands)
    const cam = inp.camHands;
    const anyOpen = cam.some((h) => h.pose === 'open' && !h.lost);
    const anyPoint = cam.some((h) => h.pose === 'point' && !h.lost && !this.overUI(h.x, h.y));
    this.openT = anyOpen ? this.openT + dt : 0;
    this.pointT = anyPoint ? this.pointT + dt : 0;
    if (this.openT > 0.3) this.setPlay(true);
    if (this.pointT > 0.2 && this.play) this.setPlay(false);

    // painting / stamping
    const seen = new Set();
    for (const h of inp.hands) {
      const wants = !this.play && !this.whirl && (h.src === 'cam' ? h.pose === 'point' && !h.lost : h.pressed);
      if (!wants || this.overUI(h.x, h.y)) continue;
      seen.add(h.id);
      if (this.stamp) {
        let d = this.live.get(h.id);
        if (!d || dist(h.x, h.y, d.lx, d.ly) > 95 * u) {
          this.placeStamp(h.x, h.y);
          this.live.set(h.id, { lx: h.x, ly: h.y, pts: [] });
          app.coach.tried('point-draw'); app.coach.tried('drag');
        }
        continue;
      }
      let d = this.live.get(h.id);
      if (!(d instanceof Doodle)) {
        d = new Doodle('stroke', { brush: this.brush, hue: this.hue });
        this.live.set(h.id, d);
      }
      const last = d.pts[d.pts.length - 1];
      if (!last || dist(last.x, last.y, h.x, h.y) > 4 * u) {
        if (last) d.len += dist(last.x, last.y, h.x, h.y);
        d.pts.push({ x: h.x, y: h.y });
        if (this.trace) { this.traceHit(h.x, h.y); for (const xf of this.xforms()) { const q = xf({ x: h.x, y: h.y }); this.traceHit(q.x, q.y); } }
        if (Math.random() < 0.35) app.particles.spawn(h.x, h.y, rand(-40, 40) * u, rand(-40, 40) * u, 0.6, 3 * u, null, 1, 0, 0.95);
        if (d.pts.length > 12) { app.coach.tried('point-draw'); app.coach.tried('drag'); }
        // long strokes split into separate doodles (more fun to swat, lighter to bake)
        if (d.pts.length > 150 || d.len > Math.min(app.W, app.H) * 0.9) { this.finishStroke(h.id); const nd = new Doodle('stroke', { brush: this.brush, hue: this.hue }); nd.pts.push({ x: h.x, y: h.y }); this.live.set(h.id, nd); }
      }
    }
    for (const id of [...this.live.keys()]) if (!seen.has(id)) { const d = this.live.get(id); if (d instanceof Doodle) this.finishStroke(id); else this.live.delete(id); }

    // wipe gestures
    if (inp.has('wave') || inp.has('shake') || inp.has('wipe')) this.startWhirl();

    // doodle physics
    const W = app.W, H = app.H;
    for (const d of this.doodles) {
      d.spring.update(dt); d.cool = Math.max(0, d.cool - dt); d.grow = Math.min(1, d.grow + dt * 3);
      if (this.play) {
        d.vx += Math.cos(t * 0.7 + d.seed) * 14 * u * dt; d.vy += Math.sin(t * 0.9 + d.seed * 2) * 14 * u * dt;
        const sp = Math.hypot(d.vx, d.vy);
        if (sp < 26 * u) { const a = d.seed + t * 0.3; d.vx += Math.cos(a) * 30 * u * dt; d.vy += Math.sin(a) * 30 * u * dt; }
        const fr = Math.pow(0.992, dt * 60); d.vx *= fr; d.vy *= fr; d.vr *= Math.pow(0.985, dt * 60);
      } else {
        const fr = Math.pow(0.9, dt * 60); d.vx *= fr; d.vy *= fr; d.vr *= fr;
      }
      d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt;
      const m = Math.min(d.r * 0.5, 70 * u), rest = d.brush === 'slime' ? 0.95 : 0.8;
      if (d.x < m && d.vx < 0) { d.vx = -d.vx * rest; d.spring.kick(3); }
      if (d.x > W - m && d.vx > 0) { d.vx = -d.vx * rest; d.spring.kick(3); }
      if (d.y < m && d.vy < 0) { d.vy = -d.vy * rest; d.spring.kick(3); }
      if (d.y > H - m && d.vy > 0) { d.vy = -d.vy * rest; d.spring.kick(3); }
      if (d.brush === 'glitter' && Math.random() < 0.12 && d.pts.length) {
        const q = d.pts[(Math.random() * d.pts.length) | 0], c = Math.cos(d.rot), s = Math.sin(d.rot);
        app.particles.spawn(d.x + q.x * c - q.y * s, d.y + q.x * s + q.y * c, 0, -10 * u, 0.7, rand(3, 6) * u, null, 1, 0, 0.98);
      }
    }

    // swatting in play mode
    if (this.play) {
      for (const h of inp.hands) {
        if (h.src === 'mouse' && (!h.recent || h.speed < 40)) continue;
        if (h.src === 'cam' && h.pose === 'point') continue;
        const px = h.src === 'cam' ? h.palm.x : h.x, py = h.src === 'cam' ? h.palm.y : h.y;
        const rad = h.src === 'cam' ? Math.max(30 * u, h.size * 0.7) : 26 * u;
        for (const d of this.doodles) {
          if (d.cool > 0 || !d.hit(px, py, rad)) continue;
          let dx = d.x - px, dy = d.y - py; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
          d.vx += dx * 260 * u + h.vx * 0.6; d.vy += dy * 260 * u + h.vy * 0.6;
          const sp = Math.hypot(d.vx, d.vy), cap = 1500 * u;
          if (sp > cap) { d.vx *= cap / sp; d.vy *= cap / sp; }
          d.vr += rand(-3, 3); d.spring.kick(7); d.cool = 0.3;
          app.sound.boing(clamp(60 * u / d.r, 0.6, 1.8), 0.13);
          app.particles.burst(px + dx * rad, py + dy * rad, 10, null, { kind: 1, speed: 220, size: 5, life: 0.6 });
          app.coach.tried('palm-push');
        }
      }
    }

    this.updateWhirl(dt);
  }

  startWhirl() {
    if (this.whirl) return;
    this.finishAll();
    this.whirl = { t: 0, x: -app.W * 0.15, y: app.H * 0.5 };
    app.sound.whoosh(WHIRL_TIME * 0.9, true, 0.16);
  }

  updateWhirl(dt) {
    const w = this.whirl;
    if (!w) return;
    const u = app.u;
    w.t += dt;
    const p = clamp(w.t / WHIRL_TIME);
    w.x = -app.W * 0.15 + app.W * 1.3 * ease.inOut(p);
    w.y = app.H * 0.5 + Math.sin(w.t * 3) * app.H * 0.15;
    for (let k = 0; k < 4; k++) {
      const a = rand(TAU), r = rand(20, 140) * u;
      app.particles.spawn(w.x + Math.cos(a) * r, w.y + Math.sin(a) * r * 1.4, -Math.sin(a) * 300 * u, Math.cos(a) * 300 * u, 0.7, rand(3, 7) * u, null, 1, 0, 0.92);
    }
    for (const d of this.doodles) {
      const dx = w.x - d.x, dy = w.y - d.y, l = Math.hypot(dx, dy) || 1;
      const pull = 1800 * u / Math.max(80 * u, l);
      d.vx += (dx / l) * pull * dt * 60; d.vy += (dy / l) * pull * dt * 60;
      d.vr += 8 * dt;
      if (l < 70 * u || p >= 1) d.popping += dt * 4;
    }
    for (const d of this.doodles) {
      if (d.popping >= 1 && !d.gone) {
        d.gone = true;
        app.particles.confetti(d.x, d.y, 18, 0.7);
        app.sound.pop(rand(0.8, 1.5));
      }
    }
    this.doodles = this.doodles.filter((d) => !d.gone);
    if (p >= 1 && !this.doodles.length) {
      this.whirl = null;
      app.sound.fanfare(0.08);
      app.particles.confetti(app.W / 2, app.H * 0.6, 60, 1.2);
    }
  }

  /** Faint guide lines while mirror magic is on. */
  drawSymGuides(ctx) {
    if (this.sym === 1) return;
    const cx = app.W / 2, cy = app.H / 2, R = Math.hypot(app.W, app.H);
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2; ctx.setLineDash([6, 12]);
    const angles = this.sym === 2 ? [Math.PI / 2] : this.sym === 4 ? [0, Math.PI / 2] : [Math.PI / 2, Math.PI / 2 + Math.PI / 3, Math.PI / 2 + (2 * Math.PI) / 3];
    for (const a of angles) { ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * R, cy - Math.sin(a) * R); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke(); }
    ctx.restore();
  }

  /** Sparkly dotted outline to trace; dots turn gold as they're covered. */
  drawTrace(ctx) {
    const tr = this.trace;
    if (!tr) return;
    const { cx, cy, size } = this.traceGeom(), t = app.t, u = app.u, done = tr.complete > 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    tr.pts.forEach((p, i) => {
      const x = cx + p.ux * size, y = cy + p.uy * size;
      if (p.done || done) {
        const s = (done ? 9 + Math.sin(t * 8 + i) * 3 : 6) * u;
        ctx.drawImage(sparkSprite(done ? hsl(i * 12 + t * 200, 100, 70) : '#ffe27a'), x - s, y - s, s * 2, s * 2);
      } else {
        ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.25 * Math.sin(t * 3 + i * 0.4)})`;
        ctx.beginPath(); ctx.arc(x, y, 3.2 * u, 0, TAU); ctx.fill();
      }
    });
    ctx.restore();
    // progress ring under the picture
    const prog = tr.doneN / tr.pts.length;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 6 * u;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(cx, cy + size * 1.25, 18 * u, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(cx, cy + size * 1.25, 18 * u, -Math.PI / 2, -Math.PI / 2 + Math.min(1, prog / 0.85) * TAU); ctx.stroke();
    ctx.restore();
  }

  draw(ctx) {
    const t = app.t;
    this.drawSymGuides(ctx);
    this.drawTrace(ctx);
    for (const d of this.doodles) d.draw(ctx, t);
    const xfs = this.xforms();
    for (const d of this.live.values()) {
      if (!(d instanceof Doodle)) continue;
      renderStroke(ctx, d.pts, d.brush, d.hue, d.seed);
      for (const xf of xfs) renderStroke(ctx, d.pts.map(xf), d.brush, d.hue, d.seed);
    }
    if (this.play) {
      // gentle "alive" glow under the sky
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.08 + 0.04 * Math.sin(t * 3);
      ctx.fillStyle = '#7affd8'; ctx.fillRect(0, 0, app.W, app.H); ctx.restore();
    }
    if (this.whirl) this.drawWhirl(ctx);
  }

  drawWhirl(ctx) {
    const w = this.whirl, u = app.u, t = app.t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) {
      const y = w.y - 150 * u + i * 26 * u, rx = (16 + i * 9) * u;
      ctx.strokeStyle = hsl(i * 30 + t * 200, 100, 72, 0.7); ctx.lineWidth = 4 * u;
      ctx.beginPath(); ctx.ellipse(w.x + Math.sin(t * 7 + i * 0.6) * 14 * u, y, rx, rx * 0.28, 0, t * 9 + i, t * 9 + i + Math.PI * 1.6); ctx.stroke();
    }
    const g = 160 * u;
    ctx.globalAlpha = 0.35;
    ctx.drawImage(glowSprite('#b8f0ff'), w.x - g, w.y - g * 1.2, g * 2, g * 2.4);
    ctx.restore();
  }

  drawTop(ctx) {
    for (const b of this.ui) b.draw(ctx);
    if (this.jarPos) this.jar.draw(ctx, this.jarPos.x, this.jarPos.y, 24 * app.u);
    if (this.flash > 0) { ctx.save(); ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.6})`; ctx.fillRect(0, 0, app.W, app.H); ctx.restore(); }
  }
}

