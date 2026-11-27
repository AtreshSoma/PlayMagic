// ---------------------------------------------------------------------------
// HUNGRY MONSTER: feed the fluffy friend.
//
// Snacks (cookies, cupcakes, apples, carrots, lollipops) float across the
// sky. Touch one and it flies in an arc into the monster's mouth: CHOMP!
// Or open your own mouth wide: the monster copies you and slurps up every
// snack that drifts near it. Each snack is a star; a full jar makes the
// monster dance and change colour. Nothing can go wrong.
// Touch / mouse: tap a snack · hold the 1 key (or the mouth bubble) to slurp.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { TAU, clamp, rand, pick, damp, dist, hsl, Spring, ease } from '../core/util.js';
import { Bubble, homeBubble } from '../ui/bubble.js';
import { icon } from '../ui/icons.js';
import { StarJar } from '../ui/hud.js';
import { drawFruit } from './basket.js';

const SNACKS = ['cookie', 'cupcake', 'apple', 'carrot', 'lolly'];
const HUES = [265, 190, 320, 140, 30];

function drawSnack(ctx, kind, s, t) {
  ctx.save();
  if (kind === 'apple') { drawFruit(ctx, 'apple', s, t); ctx.restore(); return; }
  if (kind === 'cookie') {
    ctx.fillStyle = '#e0a060'; ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5a3018';
    for (const [x, y] of [[-0.4, -0.3], [0.35, -0.2], [-0.1, 0.35], [0.45, 0.4], [-0.5, 0.25], [0.05, -0.55]]) { ctx.beginPath(); ctx.arc(x * s, y * s, s * 0.12, 0, TAU); ctx.fill(); }
  } else if (kind === 'cupcake') {
    ctx.fillStyle = '#ff9ad5'; ctx.beginPath(); ctx.arc(0, -s * 0.2, s * 0.75, Math.PI, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -s * 0.85, s * 0.18, 0, TAU); ctx.fillStyle = '#ff3d5a'; ctx.fill();
    ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.moveTo(-s * 0.7, -s * 0.2); ctx.lineTo(s * 0.7, -s * 0.2); ctx.lineTo(s * 0.5, s * 0.8); ctx.lineTo(-s * 0.5, s * 0.8); ctx.closePath(); ctx.fill();
  } else if (kind === 'carrot') {
    ctx.rotate(0.6);
    ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.moveTo(-s * 0.35, -s * 0.6); ctx.lineTo(s * 0.35, -s * 0.6); ctx.lineTo(0, s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5be37a'; for (const a of [-0.4, 0, 0.4]) { ctx.beginPath(); ctx.ellipse(Math.sin(a) * s * 0.2, -s * 0.85, s * 0.08, s * 0.28, a, 0, TAU); ctx.fill(); }
  } else { // lollipop
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = s * 0.15; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s * 1.3); ctx.stroke();
    for (let k = 0; k < 4; k++) { ctx.fillStyle = hsl(k * 90 + t * 60, 100, 65); ctx.beginPath(); ctx.arc(0, 0, s * (0.85 - k * 0.2), 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

export class MonsterMode {
  constructor() {
    this.palette = 'monster';
    this.coachAt = 'top'; // keep the hint off the monster's face
    this.scenery = { islands: false };
    this.home = homeBubble(icon.home);
    this.mouthB = new Bubble({ id: 'mouth', hue: 300, icon: icon.mouth, momentary: true });
    this.ui = [this.home, this.mouthB];
    this.jar = new StarJar(10);
  }

  enter() {
    this.snacks = []; this.flying = []; this.spawnT = 0.5; this.open = 0; this.chomp = 0; this.dance = 0;
    this.hue = HUES[0]; this.hueI = 0; this.bounce = new Spring(220, 8, 1); this.noFaceT = 0; this.eat = 0;
    this.jar.reset();
    const noCam = app.input.cam.state === 'off' || app.input.cam.state === 'error';
    app.coach.show(noCam ? ['tap'] : ['feed', 'mouth']);
  }

  get mx() { return app.W / 2; }
  get my() { return app.H * 0.74; }
  get size() { return clamp(Math.min(app.W, app.H) * 0.17, 80, 160); }

  layout() {
    const u = app.u, r = clamp(Math.min(app.W, app.H) * 0.05, 26, 42), m = 18 * u;
    this.home.place(r * 1.1 + m, r * 1.1 + m, r * 1.1);
    this.mouthB.place(app.W - r * 1.4 - m, app.H - r * 1.4 - m - 20 * u, r * 1.2);
    this.mouthB.hidden = app.input.face.present && this.noFaceT < 1;
  }

  spawn() {
    const W = app.W, H = app.H, fromLeft = Math.random() < 0.5;
    this.snacks.push({ kind: pick(SNACKS), x: fromLeft ? -40 : W + 40, y: rand(H * 0.18, H * 0.5), vx: (fromLeft ? 1 : -1) * rand(50, 90) * app.u, p: rand(TAU), s: rand(22, 30) * app.u, rot: rand(TAU) });
  }

  launch(sn) {
    sn.fly = 0; sn.x0 = sn.x; sn.y0 = sn.y;
    this.flying.push(sn);
    app.sound.whoosh(0.4, true, 0.08); app.sound.boing(1.3, 0.08);
    app.coach.tried('feed'); app.coach.tried('tap');
  }

  munch(sn) {
    this.chomp = 1; this.bounce.kick(7); this.eat = 0.6;
    app.sound.pop(0.7, 0.14); app.sound.giggle();
    app.particles.burst(this.mx, this.my, 18, ['#ffffff', '#ffe27a', '#ffb3f0'], { kind: 1, speed: 260, size: 6 });
    if (this.jar.add()) {
      app.sound.fanfare(); this.dance = 2.5;
      this.hueI = (this.hueI + 1) % HUES.length; this.hue = HUES[this.hueI];
      for (let k = 0; k < 4; k++) app.particles.confetti(app.W * (0.2 + k * 0.2), app.H * 0.6, 30, 1.2);
    }
  }

  update(dt) {
    const inp = app.input, u = app.u, face = inp.face;
    this.noFaceT = face.present ? 0 : this.noFaceT + dt;
    this.layout();
    for (const b of this.ui) b.update(dt);
    this.jar.update(dt); this.bounce.update(dt);
    this.chomp = Math.max(0, this.chomp - dt * 3); this.dance = Math.max(0, this.dance - dt); this.eat = Math.max(0, this.eat - dt);

    // the monster copies the child's mouth (or the mouth bubble / 1 key)
    const childMouth = Math.max(face.present ? face.mouth : 0, face.mouthOn ? 1 : 0, this.mouthB.held ? 1 : 0);
    const incoming = this.flying.some((s) => s.fly > 0.5);
    this.open = damp(this.open, Math.max(childMouth, incoming ? 0.9 : 0, this.chomp > 0 ? 0 : 0.15), 12, dt);
    if (childMouth > 0.5) app.coach.tried('mouth');

    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.snacks.length < 7) { this.spawn(); this.spawnT = rand(0.8, 1.5); }

    // floating snacks: touch to launch, or get slurped when the mouth is wide open
    for (const sn of this.snacks) {
      sn.x += sn.vx * dt; sn.p += dt; sn.rot += dt * 0.5;
      sn.yy = sn.y + Math.sin(sn.p * 2) * 14 * u;
      if (sn.launched) continue;
      for (const h of inp.hands) {
        if (h.src === 'mouse' && !h.recent) continue;
        if (dist(h.x, h.y, sn.x, sn.yy) < sn.s * 1.8 || (h.src === 'cam' && dist(h.palm.x, h.palm.y, sn.x, sn.yy) < sn.s * 2)) { sn.launched = true; break; }
      }
      for (const tp of inp.taps) if (!tp.used && dist(tp.x, tp.y, sn.x, sn.yy) < sn.s * 2) { tp.used = true; sn.launched = true; }
      if (this.open > 0.6 && dist(sn.x, sn.yy, this.mx, this.my) < this.size * 3.2) { sn.launched = true; sn.slurp = true; }
      if (sn.launched) { sn.y = sn.yy; this.launch(sn); }
    }
    this.snacks = this.snacks.filter((sn) => !sn.launched && sn.x > -80 && sn.x < app.W + 80);

    for (const sn of this.flying) {
      sn.fly += dt / (sn.slurp ? 0.45 : 0.7);
      if (sn.fly >= 1 && !sn.eaten) { sn.eaten = true; this.munch(sn); }
    }
    this.flying = this.flying.filter((sn) => !sn.eaten);
    if (inp.taps.length) for (const tp of inp.taps) if (!tp.used && dist(tp.x, tp.y, this.mx, this.my) < this.size) { tp.used = true; this.bounce.kick(6); app.sound.giggle(); }
  }

  draw(ctx) {
    const t = app.t;
    for (const sn of this.snacks) { ctx.save(); ctx.translate(sn.x, sn.yy); ctx.rotate(Math.sin(sn.rot) * 0.3); drawSnack(ctx, sn.kind, sn.s, t); ctx.restore(); }
    for (const sn of this.flying) {
      const p = ease.inOut(clamp(sn.fly)), tx = this.mx, ty = this.my + this.size * 0.1;
      const x = sn.x0 + (tx - sn.x0) * p, y = sn.y0 + (ty - sn.y0) * p - Math.sin(p * Math.PI) * (sn.slurp ? 20 : 120) * app.u;
      ctx.save(); ctx.translate(x, y); ctx.rotate(p * 8); ctx.scale(1 - p * 0.5, 1 - p * 0.5); drawSnack(ctx, sn.kind, sn.s, t); ctx.restore();
    }
    this.drawMonster(ctx);
  }

  drawMonster(ctx) {
    const t = app.t, u = app.u, S = this.size, x = this.mx, open = this.open;
    const hop = this.dance > 0 ? Math.abs(Math.sin(t * 9)) * 30 * u : 0;
    const y = this.my - hop, sq = this.bounce.x;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(this.dance > 0 ? Math.sin(t * 9) * 0.15 : Math.sin(t * 1.5) * 0.03);
    ctx.scale(2 - sq, sq);
    // fluffy body: overlapping tufts
    const h = this.hue;
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU, r = S * (0.95 + Math.sin(k * 3.1 + t * 2) * 0.04);
      ctx.fillStyle = hsl(h, 80, 60);
      ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82, S * 0.28, 0, TAU); ctx.fill();
    }
    const g = ctx.createRadialGradient(-S * 0.3, -S * 0.4, S * 0.1, 0, 0, S);
    g.addColorStop(0, hsl(h, 90, 80)); g.addColorStop(1, hsl(h, 80, 58));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, S * 0.9, 0, TAU); ctx.fill();
    // horns + feet
    ctx.fillStyle = '#fff3c4';
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * S * 0.45, -S * 0.75); ctx.lineTo(side * S * 0.7, -S * 1.15); ctx.lineTo(side * S * 0.25, -S * 0.85); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = hsl(h, 70, 45);
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(side * S * 0.45, S * 0.92, S * 0.25, S * 0.12, 0, 0, TAU); ctx.fill(); }
    // big eyes that watch the nearest snack
    const target = this.flying[0] || this.snacks[0];
    const lookX = target ? clamp((target.x - x) / app.W, -0.5, 0.5) : 0, lookY = target ? clamp(((target.yy ?? target.y) - y) / app.H, -0.5, 0.3) : 0;
    for (const side of [-1, 1]) {
      const ex = side * S * 0.32, ey = -S * 0.32;
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex, ey, S * 0.22, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a1050'; ctx.beginPath(); ctx.arc(ex + lookX * S * 0.2, ey + lookY * S * 0.2, S * 0.11, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex + lookX * S * 0.2 - S * 0.04, ey + lookY * S * 0.2 - S * 0.04, S * 0.035, 0, TAU); ctx.fill();
    }
    // mouth: opens with the child's mouth; chomps when it eats
    const mo = this.chomp > 0 ? Math.abs(Math.sin(this.chomp * 9)) * 0.6 : open;
    ctx.fillStyle = '#3a0a2a';
    ctx.beginPath(); ctx.ellipse(0, S * 0.28, S * 0.42, S * (0.06 + mo * 0.32), 0, 0, TAU); ctx.fill();
    if (mo > 0.3) { ctx.fillStyle = '#ff6b9a'; ctx.beginPath(); ctx.ellipse(0, S * 0.28 + S * mo * 0.18, S * 0.22, S * 0.1 * mo, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#ffffff';
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * S * 0.16, S * 0.28 - S * (0.06 + mo * 0.32) + 2); ctx.lineTo(side * S * 0.08, S * 0.28 - S * (0.06 + mo * 0.32) + S * 0.1); ctx.lineTo(side * S * 0.24, S * 0.28 - S * (0.06 + mo * 0.32) + 2); ctx.fill(); }
    // happy cheeks
    ctx.fillStyle = 'rgba(255,120,180,0.5)';
    ctx.beginPath(); ctx.ellipse(-S * 0.6, S * 0.1, S * 0.13, S * 0.08, 0, 0, TAU); ctx.ellipse(S * 0.6, S * 0.1, S * 0.13, S * 0.08, 0, 0, TAU); ctx.fill();
    ctx.restore();
    if (this.eat > 0) {
      ctx.save(); ctx.font = app.font(30 * u, 700); ctx.textAlign = 'center'; ctx.globalAlpha = clamp(this.eat * 2);
      ctx.fillStyle = '#ffffff'; ctx.fillText('YUM!', x + S * 0.9, y - S * 0.9 - (0.6 - this.eat) * 40 * u);
      ctx.restore();
    }
  }

  drawTop(ctx) {
    const u = app.u;
    for (const b of this.ui) b.draw(ctx);
    this.jar.draw(ctx, this.home.x + this.home.r * 2.6, this.home.y + 6 * u, 26 * u);
  }
}
