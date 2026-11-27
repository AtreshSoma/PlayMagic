// ---------------------------------------------------------------------------
// BUNNY BOOP: pop-up meadow friends.
//
// Bunnies and chicks peek out of six burrows. Touch one (any hand, palm or
// fingertip: just reach) to boop it: it squishes, giggles and pops a star
// into the jar. A golden bunny is worth 3 stars. Nothing can be missed or
// lost; friends simply wave and duck back down.
// Touch / mouse: tap them (hovering the mouse over one works too).
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { TAU, clamp, rand, pick, dist, hsl, Spring, ease } from '../core/util.js';
import { homeBubble } from '../ui/bubble.js';
import { icon } from '../ui/icons.js';
import { StarJar } from '../ui/hud.js';
import { glowSprite } from '../fx/sprites.js';

const FRIENDS = ['bunny', 'bunny', 'chick', 'bunny', 'chick', 'gold'];

/** A round bunny / chick, centred on its head. squish 0..1, happy 0..1. */
export function drawFriend(ctx, kind, s, { t = 0, happy = 0, blink = false } = {}) {
  const gold = kind === 'gold', chick = kind === 'chick';
  const body = gold ? '#ffe27a' : chick ? '#fff07a' : '#fff0f7', inner = gold ? '#ffb347' : '#ffb3d1';
  ctx.save();
  if (!chick) { // ears
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(side * s * 0.38, -s * 0.75); ctx.rotate(side * (0.2 + Math.sin(t * 6 + side) * 0.08 * (1 + happy * 2)));
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, -s * 0.35, s * 0.2, s * 0.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = inner; ctx.beginPath(); ctx.ellipse(0, -s * 0.32, s * 0.1, s * 0.36, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  } else { // tuft
    ctx.fillStyle = '#ffb347';
    for (const a of [-0.4, 0, 0.4]) { ctx.beginPath(); ctx.ellipse(Math.sin(a) * s * 0.3, -s * 0.95, s * 0.07, s * 0.2, a, 0, TAU); ctx.fill(); }
  }
  const g = ctx.createRadialGradient(-s * 0.3, -s * 0.35, s * 0.1, 0, 0, s);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, body);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
  // face
  ctx.fillStyle = '#3a2160'; ctx.strokeStyle = '#3a2160'; ctx.lineCap = 'round'; ctx.lineWidth = s * 0.09;
  for (const side of [-1, 1]) {
    if (blink || happy > 0.5) { ctx.beginPath(); ctx.arc(side * s * 0.33, -s * 0.08, s * 0.12, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    else { ctx.beginPath(); ctx.ellipse(side * s * 0.33, -s * 0.1, s * 0.1, s * 0.14, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(side * s * 0.33 - s * 0.03, -s * 0.15, s * 0.04, 0, TAU); ctx.fill(); ctx.fillStyle = '#3a2160'; }
  }
  ctx.fillStyle = 'rgba(255,120,170,0.5)';
  ctx.beginPath(); ctx.ellipse(-s * 0.55, s * 0.2, s * 0.15, s * 0.09, 0, 0, TAU); ctx.ellipse(s * 0.55, s * 0.2, s * 0.15, s * 0.09, 0, 0, TAU); ctx.fill();
  if (chick) { ctx.fillStyle = '#ff9a3c'; ctx.beginPath(); ctx.moveTo(-s * 0.13, s * 0.12); ctx.lineTo(s * 0.13, s * 0.12); ctx.lineTo(0, s * 0.32); ctx.closePath(); ctx.fill(); }
  else {
    ctx.fillStyle = '#ff8fb8'; ctx.beginPath(); ctx.ellipse(0, s * 0.12, s * 0.08, s * 0.06, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3a2160'; ctx.lineWidth = s * 0.06;
    ctx.beginPath(); ctx.arc(-s * 0.08, s * 0.2, s * 0.08, 0, Math.PI * 0.9); ctx.arc(s * 0.08, s * 0.2, s * 0.08, Math.PI * 0.1, Math.PI); ctx.stroke();
  }
  if (happy > 0.3) { ctx.fillStyle = '#c2185b'; ctx.beginPath(); ctx.ellipse(0, s * 0.42, s * 0.14, s * 0.1 * happy, 0, 0, Math.PI); ctx.fill(); }
  ctx.restore();
}

export class BoopMode {
  constructor() {
    this.palette = 'boop';
    this.coachAt = 'top'; // the bottom row of holes sits where the coach card would
    this.scenery = { islands: false, clouds: true };
    this.home = homeBubble(icon.home);
    this.ui = [this.home];
    this.jar = new StarJar(10);
  }

  enter() {
    this.holes = Array.from({ length: 6 }, () => ({ f: null, cool: rand(0.2, 1.2) }));
    this.spawnT = 0.6; this.elapsed = 0;
    this.jar.reset();
    const noCam = app.input.cam.state === 'off' || app.input.cam.state === 'error';
    app.coach.show(noCam ? ['tap'] : ['boop']);
  }

  layout() {
    const W = app.W, H = app.H, u = app.u, r = clamp(Math.min(app.W, app.H) * 0.05, 26, 42), m = 18 * u;
    this.home.place(r * 1.1 + m, r * 1.1 + m, r * 1.1);
    const narrow = W < H;
    const cols = narrow ? 2 : 3, rows = narrow ? 3 : 2;
    const hr = clamp(Math.min(W / (cols * 2.6), H / (rows * 3.2)), 50, 120);
    this.holes.forEach((h, i) => {
      const c = i % cols, rr = Math.floor(i / cols);
      h.x = W * ((c + 0.5) / cols); h.y = H * (narrow ? 0.34 + rr * 0.21 : 0.46 + rr * 0.27); h.r = hr;
    });
  }

  popUp() {
    const free = this.holes.filter((h) => !h.f && h.cool <= 0);
    if (!free.length) return;
    const h = pick(free), kind = Math.random() < 0.08 ? 'gold' : pick(FRIENDS.slice(0, 5));
    h.f = { kind, t: 0, stay: clamp(2.6 - this.elapsed * 0.01, 1.5, 2.6) * rand(0.85, 1.2), booped: 0, spring: new Spring(240, 9, 1), wave: 0 };
    app.sound.pop(kind === 'gold' ? 1.6 : 1.1, 0.06);
  }

  boop(h) {
    const f = h.f;
    if (!f || f.booped || f.t < 0.15) return;
    f.booped = 0.001; f.spring.kick(8);
    const n = f.kind === 'gold' ? 3 : 1;
    app.sound.giggle(); app.sound.xylo(f.kind === 'gold' ? 1046 : 660 + rand(-40, 120));
    app.particles.burst(h.x, h.y - h.r * 0.6, f.kind === 'gold' ? 34 : 18, f.kind === 'gold' ? ['#ffe27a', '#ffffff'] : null, { kind: 1, speed: 320, size: 7, life: 0.9 });
    app.coach.tried('boop'); app.coach.tried('tap');
    let filled = false;
    for (let k = 0; k < n; k++) filled = this.jar.add() || filled;
    if (filled) {
      app.sound.fanfare();
      for (let k = 0; k < 4; k++) app.particles.confetti(app.W * (0.2 + k * 0.2), app.H * 0.7, 30, 1.2);
    }
  }

  update(dt) {
    const inp = app.input, u = app.u;
    this.layout();
    for (const b of this.ui) b.update(dt);
    this.jar.update(dt);
    this.elapsed += dt;
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.popUp(); this.spawnT = clamp(1.3 - this.elapsed * 0.006, 0.7, 1.3) * rand(0.7, 1.2); }

    for (const h of this.holes) {
      h.cool -= dt;
      const f = h.f;
      if (!f) continue;
      f.t += dt; f.spring.update(dt);
      if (f.booped) f.booped += dt;
      const up = this.upness(f);
      // touch: any hand over the friend's head (camera palm or tip, pointer)
      if (!f.booped && up > 0.55) {
        const hx = h.x, hy = h.y - h.r * 0.9 * up;
        for (const hand of inp.hands) {
          if (hand.src === 'mouse' && !hand.recent) continue;
          const near = dist(hand.x, hand.y, hx, hy) < h.r * 0.95 || (hand.src === 'cam' && dist(hand.palm.x, hand.palm.y, hx, hy) < h.r);
          if (near) { this.boop(h); break; }
        }
        for (const tp of inp.taps) if (!tp.used && dist(tp.x, tp.y, hx, hy) < h.r * 1.1) { tp.used = true; this.boop(h); }
      }
      if ((f.booped && f.booped > 0.55) || (!f.booped && f.t > f.stay + 0.35)) { h.f = null; h.cool = rand(0.3, 0.9); }
    }
  }

  /** 0 (hidden) → 1 (fully up), easing in and out of the burrow. */
  upness(f) {
    if (f.booped) return Math.max(0, 1 - ease.inOut(clamp((f.booped - 0.25) / 0.3)));
    if (f.t < 0.3) return ease.outBack(f.t / 0.3);
    if (f.t > f.stay) return Math.max(0, 1 - ease.inOut(clamp((f.t - f.stay) / 0.35)));
    return 1;
  }

  draw(ctx) {
    const t = app.t, u = app.u, W = app.W, H = app.H;
    // grassy meadow
    ctx.save();
    const g = ctx.createLinearGradient(0, H * 0.35, 0, H);
    g.addColorStop(0, 'rgba(90,200,120,0)'); g.addColorStop(0.3, 'rgba(70,170,100,0.45)'); g.addColorStop(1, 'rgba(40,120,80,0.75)');
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.35, W, H * 0.65);
    for (let i = 0; i < 40; i++) { // flowers
      const x = ((i * 97) % 100) / 100 * W, y = H * 0.42 + ((i * 53) % 100) / 100 * H * 0.56;
      ctx.fillStyle = hsl(i * 47, 90, 75, 0.8);
      ctx.beginPath(); ctx.arc(x, y + Math.sin(t * 2 + i) * 2 * u, 4 * u, 0, TAU); ctx.fill();
    }
    ctx.restore();
    for (const h of this.holes) {
      // burrow
      ctx.save();
      ctx.fillStyle = '#2a1a10';
      ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.32, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 6 * u; ctx.stroke();
      // friend, clipped so it rises out of the hole
      const f = h.f;
      if (f) {
        const up = this.upness(f), s = h.r * 0.55, sq = f.spring.x;
        ctx.save();
        ctx.beginPath(); ctx.rect(h.x - h.r * 1.6, h.y - h.r * 3, h.r * 3.2, h.r * 3); ctx.ellipse(h.x, h.y, h.r, h.r * 0.32, 0, 0, Math.PI); ctx.clip();
        ctx.translate(h.x, h.y + s * 1.2 - up * h.r * 1.05);
        ctx.scale(sq, 2 - sq);
        if (f.kind === 'gold') { ctx.globalCompositeOperation = 'lighter'; const gl = s * 2.6; ctx.drawImage(glowSprite('#ffe27a'), -gl, -gl, gl * 2, gl * 2); ctx.globalCompositeOperation = 'source-over'; }
        drawFriend(ctx, f.kind, s, { t, happy: f.booped ? 1 : 0, blink: Math.sin(t * 3 + h.x) > 0.96 });
        ctx.restore();
      }
      // front lip of the burrow
      ctx.fillStyle = '#4e8a3a';
      ctx.beginPath(); ctx.ellipse(h.x, h.y + h.r * 0.12, h.r * 1.05, h.r * 0.22, 0, 0, Math.PI); ctx.fill();
      ctx.restore();
    }
  }

  drawTop(ctx) {
    const u = app.u;
    for (const b of this.ui) b.draw(ctx);
    this.jar.draw(ctx, this.home.x + this.home.r * 2.6, this.home.y + 6 * u, 26 * u);
  }
}
