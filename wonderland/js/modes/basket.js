// ---------------------------------------------------------------------------
// FRUIT BASKET: catch the falling fruit.
//
// A basket glides along the bottom, following the child's hand (just move
// it side to side), or their head tilt, or the mouse / a finger. Apples,
// oranges, strawberries, bananas and grapes tumble from the trees; catching
// them fills the star jar and piles fruit in the basket. A rainbow star is
// worth 3. Missed fruit just bounces on the grass: nothing can be failed.
// Keys: ← / → (A / D) move the basket.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { TAU, clamp, rand, pick, damp, hsl, Spring } from '../core/util.js';
import { homeBubble } from '../ui/bubble.js';
import { icon } from '../ui/icons.js';
import { StarJar } from '../ui/hud.js';
import { drawStar } from '../ui/props.js';
import { glowSprite } from '../fx/sprites.js';

const FRUIT = ['apple', 'orange', 'berry', 'banana', 'grapes'];
const PILE_MAX = 14;

/** A cute fruit centred at (0,0), radius s. */
export function drawFruit(ctx, kind, s, t = 0) {
  ctx.save();
  if (kind === 'star') { ctx.rotate(t * 2); drawStar(ctx, s * 1.1, t, (t * 120) % 360); ctx.restore(); return; }
  if (kind === 'banana') {
    ctx.rotate(-0.4);
    ctx.fillStyle = '#ffe25a'; ctx.beginPath(); ctx.arc(0, -s * 0.6, s * 1.15, Math.PI * 0.2, Math.PI * 0.8); ctx.arc(0, -s * 1.4, s * 1.6, Math.PI * 0.65, Math.PI * 0.35, true); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7a5a2a'; ctx.beginPath(); ctx.arc(-s * 0.95, -s * 0.05, s * 0.1, 0, TAU); ctx.fill();
  } else if (kind === 'grapes') {
    ctx.fillStyle = '#a66bff';
    for (const [x, y] of [[-0.4, -0.3], [0, -0.35], [0.4, -0.3], [-0.2, 0.05], [0.2, 0.05], [0, 0.4]]) { ctx.beginPath(); ctx.arc(x * s, y * s, s * 0.32, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    for (const [x, y] of [[-0.48, -0.4], [-0.08, -0.45], [0.32, -0.4]]) { ctx.beginPath(); ctx.arc(x * s, y * s, s * 0.08, 0, TAU); ctx.fill(); }
  } else {
    const col = { apple: '#ff4d6a', orange: '#ffa63c', berry: '#ff3d7f' }[kind];
    const g = ctx.createRadialGradient(-s * 0.35, -s * 0.35, s * 0.1, 0, 0, s);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, col); g.addColorStop(1, col);
    ctx.fillStyle = g;
    if (kind === 'berry') { ctx.beginPath(); ctx.moveTo(0, s); ctx.bezierCurveTo(-s * 1.2, s * 0.1, -s * 0.8, -s * 0.9, 0, -s * 0.7); ctx.bezierCurveTo(s * 0.8, -s * 0.9, s * 1.2, s * 0.1, 0, s); ctx.fill(); ctx.fillStyle = '#fff3a0'; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(Math.cos(i * 2.3) * s * 0.4, Math.sin(i * 2.3) * s * 0.35, 1.5, 2.5, 0, 0, TAU); ctx.fill(); } }
    else { ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill(); }
  }
  // leaf + happy face
  ctx.fillStyle = '#5be37a'; ctx.beginPath(); ctx.ellipse(s * 0.25, -s * 0.95, s * 0.3, s * 0.13, -0.5, 0, TAU); ctx.fill();
  if (kind !== 'grapes' && kind !== 'banana') {
    ctx.fillStyle = '#3a2160';
    ctx.beginPath(); ctx.arc(-s * 0.3, -s * 0.05, s * 0.09, 0, TAU); ctx.arc(s * 0.3, -s * 0.05, s * 0.09, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3a2160'; ctx.lineWidth = s * 0.08; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, s * 0.12, s * 0.2, 0.3, Math.PI - 0.3); ctx.stroke();
  }
  ctx.restore();
}

export class BasketMode {
  constructor() {
    this.palette = 'basket';
    this.scenery = { islands: false };
    this.home = homeBubble(icon.home);
    this.ui = [this.home];
    this.jar = new StarJar(10);
  }

  enter() {
    this.bx = app.W / 2; this.items = []; this.pile = []; this.spawnT = 0.8; this.elapsed = 0;
    this.combo = 0; this.comboT = 0; this.squash = new Spring(260, 10, 1); this.tilt = 0;
    this.jar.reset();
    const noCam = app.input.cam.state === 'off' || app.input.cam.state === 'error';
    app.coach.show(noCam ? ['drag-steer'] : ['basket']);
  }

  get by() { return app.H * 0.84; }
  get bw() { return clamp(app.W * 0.16, 110, 220); }

  layout() {
    const u = app.u, r = clamp(Math.min(app.W, app.H) * 0.05, 26, 42), m = 18 * u;
    this.home.place(r * 1.1 + m, r * 1.1 + m, r * 1.1);
  }

  /** Where the basket wants to be: camera hand → pointer → head tilt / keys. */
  target() {
    const inp = app.input, W = app.W;
    const cam = inp.hands.find((h) => h.src === 'cam');
    if (cam) return cam.palm.x;
    const ptr = inp.hands.find((h) => h.src !== 'cam' && h.recent !== false);
    if (ptr) return ptr.x;
    const f = inp.face;
    if (f.present || f.keySteer) return W / 2 + f.steer * W * 0.42;
    return this.bx;
  }

  spawn() {
    const W = app.W, kind = Math.random() < 0.07 ? 'star' : pick(FRUIT);
    this.items.push({ kind, x: rand(W * 0.1, W * 0.9), y: -40 * app.u, vy: rand(130, 190) * app.u * (1 + this.elapsed * 0.004), vx: rand(-20, 20) * app.u, rot: rand(TAU), spin: rand(-2, 2), s: rand(20, 26) * app.u, landed: 0 });
  }

  update(dt) {
    const u = app.u, H = app.H;
    this.layout();
    for (const b of this.ui) b.update(dt);
    this.jar.update(dt); this.squash.update(dt);
    this.elapsed += dt;
    this.comboT = Math.max(0, this.comboT - dt); if (!this.comboT) this.combo = 0;

    const prev = this.bx, half = this.bw / 2;
    this.bx = damp(this.bx, clamp(this.target(), half, app.W - half), 9, dt);
    this.tilt = damp(this.tilt, clamp((this.bx - prev) / dt / 1500, -0.25, 0.25), 10, dt);
    if (Math.abs(this.bx - prev) > 2 * u) { app.coach.tried('basket'); app.coach.tried('drag-steer'); }

    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawn(); this.spawnT = clamp(1.1 - this.elapsed * 0.006, 0.55, 1.1) * rand(0.7, 1.3); }

    const rimY = this.by - 18 * u;
    for (const it of this.items) {
      if (it.landed) { it.landed += dt; continue; }
      it.vy += 160 * u * dt; it.y += it.vy * dt; it.x += it.vx * dt; it.rot += it.spin * dt;
      if (!it.caught && it.y > rimY - it.s && it.y < rimY + it.s * 0.8 && Math.abs(it.x - this.bx) < half * 0.92) this.catchIt(it);
      if (!it.caught && it.y > H - 30 * u) { it.y = H - 30 * u; it.landed = 0.001; app.sound.boing(1.4, 0.06); this.combo = 0; }
    }
    this.items = this.items.filter((it) => !it.caught && it.landed < 1.2);
  }

  catchIt(it) {
    it.caught = true;
    this.combo++; this.comboT = 1.8;
    this.squash.kick(-6);
    const n = it.kind === 'star' ? 3 : 1;
    app.sound.xylo(523 * Math.pow(2, (Math.min(this.combo, 12) * 2) / 12));
    if (it.kind === 'star') app.sound.sparkle();
    app.particles.burst(it.x, this.by - 30 * app.u, it.kind === 'star' ? 30 : 14, it.kind === 'star' ? null : ['#ffffff', '#ffe27a'], { kind: 1, speed: 260, size: 6 });
    this.pile.push({ kind: it.kind === 'star' ? pick(FRUIT) : it.kind, dx: rand(-0.35, 0.35), rot: rand(-0.6, 0.6) });
    if (this.pile.length > PILE_MAX) this.pile.shift();
    let filled = false;
    for (let k = 0; k < n; k++) filled = this.jar.add() || filled;
    if (filled) {
      app.sound.fanfare();
      for (let k = 0; k < 4; k++) app.particles.confetti(app.W * (0.2 + k * 0.2), app.H * 0.6, 30, 1.2);
      this.pile.length = 0;
    }
  }

  draw(ctx) {
    const t = app.t, u = app.u, W = app.W, H = app.H;
    // orchard: two big friendly trees and grass
    ctx.save();
    ctx.fillStyle = 'rgba(70,160,90,0.55)'; ctx.fillRect(0, H - 40 * u, W, 40 * u);
    for (const [fx, sc] of [[0.08, 1], [0.92, 1.1]]) {
      const x = W * fx, r = 120 * u * sc;
      ctx.fillStyle = '#6a4228'; ctx.fillRect(x - 14 * u, H * 0.25, 28 * u, H * 0.75);
      ctx.fillStyle = 'rgba(60,170,90,0.85)';
      for (const [ox, oy, rr] of [[0, 0, 1], [-0.6, 0.3, 0.7], [0.6, 0.3, 0.7], [0, -0.5, 0.75]]) { ctx.beginPath(); ctx.arc(x + ox * r, H * 0.2 + oy * r, rr * r, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
    // landed fruit
    for (const it of this.items) {
      ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot);
      ctx.globalAlpha = it.landed ? Math.max(0, 1 - it.landed) : 1;
      if (it.kind === 'star') { ctx.globalCompositeOperation = 'lighter'; const g = it.s * 3; ctx.drawImage(glowSprite('#fff6a0'), -g, -g, g * 2, g * 2); ctx.globalCompositeOperation = 'source-over'; }
      drawFruit(ctx, it.kind, it.s, t);
      ctx.restore();
    }
    this.drawBasket(ctx);
  }

  drawBasket(ctx) {
    const u = app.u, t = app.t, w = this.bw, h = w * 0.42, x = this.bx, y = this.by, s = this.squash.x;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(this.tilt); ctx.scale(2 - s, s);
    // pile of caught fruit peeking out
    this.pile.forEach((p, i) => {
      ctx.save(); ctx.translate(p.dx * w, -h * 0.45 - Math.floor(i / 5) * 12 * u); ctx.rotate(p.rot); drawFruit(ctx, p.kind, 16 * u, t); ctx.restore();
    });
    // woven basket
    const g = ctx.createLinearGradient(0, -h * 0.5, 0, h * 0.5);
    g.addColorStop(0, '#e8a868'); g.addColorStop(1, '#a8643a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-w / 2, -h * 0.4); ctx.lineTo(w / 2, -h * 0.4); ctx.lineTo(w * 0.4, h * 0.5); ctx.lineTo(-w * 0.4, h * 0.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(90,50,25,0.5)'; ctx.lineWidth = 2;
    for (let k = 1; k < 4; k++) { const yy = -h * 0.4 + k * h * 0.22; ctx.beginPath(); ctx.moveTo(-w / 2 + k * w * 0.025, yy); ctx.lineTo(w / 2 - k * w * 0.025, yy); ctx.stroke(); }
    ctx.fillStyle = '#ffd6a0'; ctx.beginPath(); ctx.ellipse(0, -h * 0.4, w / 2, h * 0.12, 0, 0, TAU); ctx.fill();
    // smiley
    ctx.fillStyle = '#5a2e14';
    ctx.beginPath(); ctx.arc(-w * 0.12, h * 0.02, 4 * u, 0, TAU); ctx.arc(w * 0.12, h * 0.02, 4 * u, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#5a2e14'; ctx.lineWidth = 3 * u; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, h * 0.1, w * 0.08, 0.3, Math.PI - 0.3); ctx.stroke();
    ctx.restore();
    if (this.combo >= 3) {
      ctx.save(); ctx.font = app.font(26 * u, 700); ctx.textAlign = 'center';
      ctx.fillStyle = hsl(t * 200, 100, 75); ctx.fillText(`×${this.combo}`, x, y - h * 1.6);
      ctx.restore();
    }
  }

  drawTop(ctx) {
    const u = app.u;
    for (const b of this.ui) b.draw(ctx);
    this.jar.draw(ctx, this.home.x + this.home.r * 2.6, this.home.y + 6 * u, 26 * u);
  }
}
