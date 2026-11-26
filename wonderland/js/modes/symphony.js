// ---------------------------------------------------------------------------
// BUBBLE SYMPHONY & FUNNY FACE MIRROR
//
//   either hand (any fingertip or palm) → pop rising soap bubbles; each pop
//                                         is a pentatonic marimba note, so
//                                         every melody sounds lovely
//   open mouth wide   → blow a stream of bubbles and dragon sparkles
//   big smile         → glowing flowers sprout around the screen edges
//   raise eyebrows    → cycle crown → wizard hat → bunny ears → cat ears,
//                       tracked bouncily onto the child's head
//
// No camera / no face? A friendly moon buddy wears the hats instead, and
// three face bubbles (mouth, smile, brows) do the same magic when held.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { TAU, clamp, rand, pick, damp, dist, hsl, Spring, ease, noteFreq } from '../core/util.js';
import { Bubble, homeBubble } from '../ui/bubble.js';
import { icon, drawFace } from '../ui/icons.js';
import { HATS } from '../ui/props.js';
import { glowSprite } from '../fx/sprites.js';
import { StarJar } from '../ui/hud.js';

const MAX_BUBBLES = 34, MAX_FLOWERS = 26;

export class SymphonyMode {
  constructor() {
    this.palette = 'symphony';
    this.mirrorMin = 0.6;
    this.scenery = { islands: false };
    this.home = homeBubble(icon.home);
    this.mouthB = new Bubble({ id: 'mouth', hue: 190, icon: icon.mouth, momentary: true });
    this.smileB = new Bubble({ id: 'smile', hue: 330, icon: icon.smile, momentary: true });
    this.browsB = new Bubble({ id: 'brows', hue: 48, icon: icon.brows, dwell: 0.8, onSelect: () => this.nextHat() });
    this.ui = [this.home, this.mouthB, this.smileB, this.browsB];
    this.jar = new StarJar(15);
  }

  enter() {
    this.bubbles = []; this.flowers = []; this.ripples = [];
    this.spawnT = 0; this.blowT = 0; this.flowerT = 0; this.pops = 0;
    this.jar.reset();
    this.hat = -1; this.hatSpring = new Spring(160, 6, 1);
    this.noFaceT = 0;
    const noCam = app.input.cam.state === 'off' || app.input.cam.state === 'error';
    app.coach.show(noCam ? ['tap'] : ['wave', 'mouth', 'smile', 'brows']);
    for (let k = 0; k < 8; k++) this.spawnBubble(rand(app.H * 0.3, app.H));
  }

  exit() { app.sound.breathe(0); }

  /** Avatar stands in when the camera can't see a face. */
  get useAvatar() { return !app.input.face.present && this.noFaceT > 1.5; }

  layout() {
    const u = app.u, r = clamp(Math.min(app.W, app.H) * 0.055, 28, 46), m = 18 * u;
    this.home.place(r * 1.1 + m, r * 1.1 + m, r * 1.1);
    const x = app.W - r * 1.2 - m;
    [this.mouthB, this.smileB, this.browsB].forEach((b, i) => { b.place(x, app.H * 0.3 + i * r * 2.7, r * 1.15); b.hidden = !this.useAvatar; });
  }

  spawnBubble(y = app.H + 60 * app.u, x = rand(app.W * 0.08, app.W * 0.92), r = rand(26, 70) * app.u, vx = 0, vy = null) {
    if (this.bubbles.length >= MAX_BUBBLES) return;
    const u = app.u;
    // bigger bubbles sing lower notes
    const note = Math.round(clamp(1 - (r / u - 14) / 60) * 9);
    this.bubbles.push({ x, y, r, vx, vy: vy ?? -rand(40, 85) * u, hue: rand(360), note, p: rand(TAU), born: app.t, wob: new Spring(200, 6, 1) });
  }

  pop(b, i) {
    this.bubbles.splice(i, 1);
    this.pops++;
    if (this.jar.add()) { app.sound.fanfare(); app.particles.confetti(app.W / 2, app.H * 0.6, 50, 1.2); }
    app.sound.marimba(noteFreq(b.note), 0.2);
    app.sound.pop(1.2 + (1 - b.r / (70 * app.u)) * 0.6, 0.06);
    app.particles.burst(b.x, b.y, Math.round(10 + b.r / app.u / 3), [hsl(b.hue, 100, 70), hsl(b.hue + 60, 100, 75), '#ffffff'], { kind: 1, speed: 300, size: 5, life: 0.9 });
    app.particles.burst(b.x, b.y, 10, hsl(b.hue + 120, 100, 70), { kind: 3, speed: 120, size: 6, life: 1.2 });
    this.ripples.push({ x: b.x, y: b.y, r: b.r, t: 0, hue: b.hue });
    if (this.pops % 30 === 0) { app.sound.fanfare(); app.particles.confetti(app.W / 2, app.H * 0.7, 60, 1.3); }
  }

  nextHat() {
    this.hat = (this.hat + 1) % HATS.length;
    this.hatSpring.x = 0.2; this.hatSpring.kick(8);
    app.sound.boing(1.1); app.sound.sparkle();
    const a = this.anchor();
    app.particles.burst(a.x, a.y - a.w * 0.3, 30, null, { kind: 1, speed: 300, size: 7 });
    app.coach.tried('brows');
  }

  /** Where hats and mouth-bubbles come from: the real face, or the avatar. */
  anchor() {
    const f = app.input.face, u = app.u;
    if (!this.useAvatar && f.present) return { x: f.head.x, y: f.head.y, w: f.head.w, angle: f.head.angle, mx: f.mouthPos.x, my: f.mouthPos.y };
    const r = 62 * u, x = app.W / 2, y = app.H - r - 40 * u;
    return { x, y: y - r * 0.92, w: r * 1.9, angle: Math.sin(app.t * 1.2) * 0.08, mx: x, my: y + r * 0.42 };
  }

  update(dt) {
    const inp = app.input, u = app.u, face = inp.face;
    this.noFaceT = face.present ? 0 : this.noFaceT + dt;
    this.layout();
    for (const b of this.ui) b.update(dt);

    // gentle rain of rising bubbles
    this.spawnT += dt;
    const rate = 0.55 + app.W / 2400;
    if (this.spawnT > 1 / rate) { this.spawnT = 0; this.spawnBubble(); }

    // popping: every fingertip and palm of every hand, the mouse, and taps
    const pts = [];
    for (const h of inp.hands) {
      if (h.src === 'mouse' && !h.recent) continue;
      pts.push(h.x, h.y);
      if (h.src === 'cam') { pts.push(h.palm.x, h.palm.y); for (const k of [4, 8, 12, 16, 20]) pts.push(h.lm[k].x, h.lm[k].y); }
    }
    for (const tp of inp.taps) if (!tp.used) { pts.push(tp.x, tp.y); }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      if (app.t - b.born < 0.25) continue; // freshly blown bubbles can't pop instantly
      for (let k = 0; k < pts.length; k += 2) {
        if (dist(pts[k], pts[k + 1], b.x, b.y) < b.r + 8 * u) { this.pop(b, i); app.coach.tried('wave'); app.coach.tried('tap'); break; }
      }
    }

    // bubble motion
    const t = app.t;
    for (const b of this.bubbles) {
      b.wob.update(dt);
      b.x += (b.vx + Math.sin(t * 1.4 + b.p) * 18 * u) * dt;
      b.y += b.vy * dt;
      b.vx *= Math.pow(0.98, dt * 60);
      b.vy = damp(b.vy, -60 * u, 0.6, dt);
      if (Math.random() < dt * 0.5) b.wob.kick(rand(-2, 2));
    }
    this.bubbles = this.bubbles.filter((b) => b.y > -b.r - 20 && b.x > -100 && b.x < app.W + 100);
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter((r) => r.t < 0.6);

    // open mouth → bubble stream + dragon sparkles
    const mouth = Math.max(face.mouth * (face.present ? 1 : 0), this.mouthB.held ? 1 : 0, face.mouthOn ? 1 : 0);
    const blowing = mouth > 0.5;
    app.sound.breathe(blowing ? mouth : 0);
    if (blowing) {
      app.coach.tried('mouth');
      const a = this.anchor();
      this.blowT += dt;
      if (this.blowT > 0.11) {
        this.blowT = 0;
        const dir = a.mx < app.W / 2 ? 1 : -1;
        this.spawnBubble(a.my, a.mx, rand(14, 34) * u, dir * rand(80, 260) * u + rand(-60, 60) * u, -rand(90, 220) * u);
      }
      for (let k = 0; k < 2; k++) {
        const ang = -Math.PI / 2 + rand(-1.2, 1.2);
        app.particles.spawn(a.mx, a.my, Math.cos(ang) * rand(120, 300) * u, Math.sin(ang) * rand(120, 300) * u, rand(0.6, 1.1), rand(3, 6) * u, null, 1, 0, 0.95);
      }
    }

    // big smile → flowers along the edges
    const smiling = face.smileOn || this.smileB.held;
    this.flowerT += dt;
    if (smiling) {
      app.coach.tried('smile');
      if (this.flowerT > 0.22 && this.flowers.length < MAX_FLOWERS) { this.flowerT = 0; this.sprout(); }
    }
    for (const f of this.flowers) f.t += dt;
    this.flowers = this.flowers.filter((f) => f.t < f.life);

    // raise brows → next hat
    if (inp.has('brows')) this.nextHat();
    this.hatSpring.update(dt);
  }

  sprout() {
    const W = app.W, H = app.H, u = app.u, side = Math.random();
    let x, y, ang;
    if (side < 0.6) { x = rand(W * 0.04, W * 0.96); y = H + 4; ang = -Math.PI / 2 + rand(-0.25, 0.25); }
    else if (side < 0.8) { x = -4; y = rand(H * 0.3, H); ang = rand(-0.5, -0.1); }
    else { x = W + 4; y = rand(H * 0.3, H); ang = Math.PI + rand(0.1, 0.5); }
    this.flowers.push({ x, y, ang, len: rand(60, 150) * u, hue: pick([320, 290, 50, 190, 20, 140]), petals: Math.floor(rand(5, 8)), t: 0, life: rand(7, 10), p: rand(TAU), size: rand(14, 26) * u });
    app.sound.bloom();
  }

  draw(ctx) {
    const t = app.t, u = app.u;
    // flowers behind the bubbles
    for (const f of this.flowers) this.drawFlower(ctx, f, t);
    for (const r of this.ripples) {
      const p = r.t / 0.6;
      ctx.strokeStyle = hsl(r.hue, 100, 80, 1 - p); ctx.lineWidth = 3 * u;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (1 + p * 1.2), 0, TAU); ctx.stroke();
    }
    for (const b of this.bubbles) this.drawSoap(ctx, b, t);
    if (this.useAvatar) this.drawAvatar(ctx);
  }

  drawSoap(ctx, b, t) {
    const s = b.wob.x, r = b.r;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(s, 2 - s);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r);
    g.addColorStop(0, 'rgba(255,255,255,0.32)');
    g.addColorStop(0.7, hsl(b.hue, 100, 80, 0.07));
    g.addColorStop(0.92, hsl(b.hue + 50, 100, 72, 0.4));
    g.addColorStop(1, hsl(b.hue + 120, 100, 80, 0.75));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    // swirling iridescent film
    ctx.strokeStyle = hsl(b.hue + t * 80, 100, 78, 0.45); ctx.lineWidth = Math.max(1.5, r * 0.06);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.94, t * 1.5 + b.p, t * 1.5 + b.p + 2.2); ctx.stroke();
    ctx.strokeStyle = hsl(b.hue + 180 + t * 80, 100, 78, 0.35);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.94, t * 1.5 + b.p + 3.2, t * 1.5 + b.p + 4.6); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 0.42, r * 0.2, r * 0.09, -0.7, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.4, r * 0.38, r * 0.06, 0, TAU); ctx.fill();
    ctx.restore();
  }

  drawFlower(ctx, f, t) {
    const u = app.u, grow = ease.out(clamp(f.t / 0.7)), bloom = ease.outBack(clamp((f.t - 0.5) / 0.6));
    const wilt = clamp((f.life - f.t) / 1.2);
    const sway = Math.sin(t * 1.6 + f.p) * 0.12;
    const L = f.len * grow * wilt;
    const ex = f.x + Math.cos(f.ang + sway) * L, ey = f.y + Math.sin(f.ang + sway) * L;
    ctx.save();
    ctx.strokeStyle = '#6fe8a0'; ctx.lineWidth = 4 * u; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(f.x, f.y);
    ctx.quadraticCurveTo(f.x + Math.cos(f.ang - 0.4) * L * 0.5, f.y + Math.sin(f.ang - 0.4) * L * 0.5, ex, ey); ctx.stroke();
    if (bloom > 0) {
      const s = f.size * bloom * wilt;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glowSprite(hsl(f.hue, 100, 65)), ex - s * 2.4, ey - s * 2.4, s * 4.8, s * 4.8);
      ctx.globalCompositeOperation = 'source-over';
      ctx.translate(ex, ey); ctx.rotate(t * 0.4 + f.p);
      for (let k = 0; k < f.petals; k++) {
        ctx.rotate(TAU / f.petals);
        ctx.fillStyle = hsl(f.hue + k * 6, 100, 74);
        ctx.beginPath(); ctx.ellipse(s * 0.75, 0, s * 0.7, s * 0.38, 0, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#fff27a'; ctx.beginPath(); ctx.arc(0, 0, s * 0.42, 0, TAU); ctx.fill();
      if (Math.random() < 0.04) app.particles.spawn(ex, ey, rand(-30, 30) * u, -rand(30, 80) * u, 1, 4 * u, hsl(f.hue, 100, 75), 1, 0, 0.98);
    }
    ctx.restore();
  }

  drawAvatar(ctx) {
    const u = app.u, t = app.t, r = 62 * u, x = app.W / 2, y = app.H - r - 40 * u;
    const mouth = this.mouthB.held || app.input.face.mouthOn ? 0.8 : 0;
    const smile = this.smileB.held || app.input.face.smileOn ? 1 : 0.4;
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 2) * 4 * u);
    ctx.rotate(Math.sin(t * 1.2) * 0.08);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(glowSprite('#c9b6ff'), -r * 2, -r * 2, r * 4, r * 4);
    ctx.globalCompositeOperation = 'source-over';
    drawFace(ctx, r, { mouth, smile, open: smile > 0.9 ? 0.2 : 1, fill: '#fff4d6' });
    ctx.restore();
  }

  drawTop(ctx) {
    this.jar.update(app.dt);
    this.jar.draw(ctx, this.home.x + this.home.r * 2.6, this.home.y + 6 * app.u, 26 * app.u);
    // the hat rides on the head with a bouncy spring
    if (this.hat >= 0) {
      const a = this.anchor(), s = this.hatSpring.x;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.angle + Math.sin(app.t * 3) * 0.03);
      ctx.scale(2 - s, s);
      HATS[this.hat](ctx, a.w * 1.05, app.t);
      ctx.restore();
    }
    for (const b of this.ui) b.draw(ctx);
  }
}
