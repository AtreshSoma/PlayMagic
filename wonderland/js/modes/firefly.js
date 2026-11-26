// ---------------------------------------------------------------------------
// FIREFLY HOP: flap-and-bounce adventure.
//
// Swoop a hand upward (like flapping a wing), open your mouth, blink, or
// tap: any of them makes the friendly creature flap up across a scrolling
// magical sky. The hand swoop is the main move, so eyes never get tired. Collect golden stars into the jar; every full jar
// is a fanfare and a rainbow of confetti. Puffy storm clouds never end the
// game: bumping one makes the creature giggle and bounce softly away, and
// the cloud turns pink and smiles.
//
// Forgiving physics: gentle gravity, a slow fall cap, soft floor and ceiling,
// and the creature simply hovers until the first blink.
// No camera? Tap anywhere (or press Space) to flap.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { TAU, clamp, rand, pick, damp, dist, hsl, Spring } from '../core/util.js';
import { Bubble, homeBubble } from '../ui/bubble.js';
import { icon, drawFace } from '../ui/icons.js';
import { CHARACTERS } from '../ui/characters.js';
import { drawStar } from '../ui/props.js';
import { StarJar } from '../ui/hud.js';
import { glowSprite } from '../fx/sprites.js';

export class FireflyMode {
  constructor() {
    this.palette = 'firefly';
    this.char = 'firefly';
    this.home = homeBubble(icon.home);
    this.charB = ['firefly', 'frog', 'dragon'].map((c) => new Bubble({ id: c, hue: { firefly: 70, frog: 130, dragon: 290 }[c], icon: icon[c], onSelect: () => this.setChar(c) }));
    this.ui = [this.home, ...this.charB];
    this.jar = new StarJar(10);
  }

  enter() {
    const u = app.u;
    this.y = app.H * 0.45; this.vy = 0; this.started = false;
    this.flapT = 0; this.giggleT = 0; this.tilt = 0; this.bumpCool = 0;
    this.items = []; this.spawnAcc = 0; this.scrollX = 0; this.combo = 0; this.comboT = 0;
    this.squash = new Spring(260, 10, 1);
    this.rainbow = 0;
    this.speed = 160 * u;
    const noCam = app.input.cam.state === 'off' || app.input.cam.state === 'error';
    app.coach.show(noCam ? ['tap-flap'] : ['flap-hand', 'mouth']);
    this.handCool = new Map(); this.mouthWas = false;
    this.jar.reset();
  }

  exit() { app.world.scroll = 0; }

  setChar(c) { this.char = c; app.sound.boing(1.2); this.squash.kick(6); }

  get x() { return app.W * 0.28; }

  layout() {
    const u = app.u, r = clamp(Math.min(app.W, app.H) * 0.05, 26, 42), m = 18 * u;
    this.home.place(r * 1.1 + m, r * 1.1 + m, r * 1.1);
    this.charB.forEach((b, i) => b.place(app.W - r - m - i * r * 2.5, r + m + 60 * u, r * (b.active ? 1.05 : 0.9)));
    this.charB.forEach((b) => (b.active = b.id === this.char));
  }

  flap() {
    const u = app.u;
    this.started = true;
    this.vy = Math.min(this.vy, 0) - 330 * u;
    this.vy = Math.max(this.vy, -430 * u);
    this.flapT = 1;
    this.squash.kick(-5);
    app.sound.flap();
    app.particles.burst(this.x - 20 * u, this.y + 10 * u, 8, '#eaff7a', { kind: 0, speed: 120, size: 4, angle: Math.PI * 0.75, spread: 1.2, life: 0.6 });
    app.coach.tried('blink'); app.coach.tried('tap-flap'); app.coach.tried('flap-hand');
  }

  spawnPattern() {
    const W = app.W, H = app.H, u = app.u, x0 = W + 80 * u;
    const top = H * 0.2, bot = H * 0.82;
    const kind = pick(['arc', 'arc', 'cloud', 'pair', 'wave']);
    const star = (x, y) => this.items.push({ type: 'star', x, y, p: rand(TAU) });
    const cloud = (x, y, r) => this.items.push({ type: 'cloud', x, y, r, friendly: false, spring: new Spring(200, 8, 1), p: rand(TAU) });
    if (kind === 'arc') {
      const cy = rand(top + 60 * u, bot - 60 * u);
      for (let k = 0; k < 5; k++) star(x0 + k * 55 * u, cy - Math.sin((k / 4) * Math.PI) * 70 * u);
    } else if (kind === 'wave') {
      const cy = rand(top + 80 * u, bot - 80 * u);
      for (let k = 0; k < 6; k++) star(x0 + k * 50 * u, cy + Math.sin(k * 1.1) * 60 * u);
    } else if (kind === 'cloud') {
      const cy = rand(top + 40 * u, bot - 40 * u);
      cloud(x0 + 60 * u, cy, rand(50, 66) * u);
      const sy = cy < H / 2 ? cy + 150 * u : cy - 150 * u;
      for (let k = 0; k < 3; k++) star(x0 + k * 60 * u, sy);
    } else {
      // two clouds with a wide, star-filled gap between them
      const gapC = rand(H * 0.38, H * 0.62), gap = H * 0.24;
      cloud(x0 + 40 * u, gapC - gap - 30 * u, 60 * u);
      cloud(x0 + 40 * u, gapC + gap + 30 * u, 60 * u);
      for (let k = 0; k < 3; k++) star(x0 + k * 50 * u, gapC);
    }
  }

  update(dt) {
    const inp = app.input, u = app.u, H = app.H;
    this.layout();
    for (const b of this.ui) b.update(dt);

    if (inp.has('blink')) this.flap();
    for (const tp of inp.taps) if (!tp.used) { tp.used = true; this.flap(); }
    // a quick upward swoop of any camera hand = one flap
    for (const h of inp.camHands) {
      const cool = (this.handCool.get(h) || 0) - dt;
      this.handCool.set(h, cool);
      if (cool <= 0 && !h.lost && h.vy < -620 * u) { this.flap(); this.handCool.set(h, 0.28); }
    }
    // opening the mouth also flaps (rising edge)
    const mouth = inp.face.mouthOn;
    if (mouth && !this.mouthWas) { this.flap(); app.coach.tried('mouth'); }
    this.mouthWas = mouth;

    // physics
    if (this.started) {
      this.vy += 560 * u * dt;
      this.vy = Math.min(this.vy, 270 * u);
      this.y += this.vy * dt;
      this.speed = damp(this.speed, (160 + this.jar.goals * 8) * u, 1, dt);
    } else {
      this.y = damp(this.y, H * 0.45 + Math.sin(app.t * 2) * 18 * u, 4, dt);
    }
    const ceil = 90 * u, floor = H - 80 * u;
    if (this.y < ceil) { this.y = ceil; this.vy = Math.abs(this.vy) * 0.3; }
    if (this.y > floor) {
      this.y = floor; this.vy = -280 * u; this.squash.kick(7);
      app.sound.boing(1); app.particles.burst(this.x, floor + 20 * u, 10, '#9dff8a', { kind: 1, speed: 160, size: 4, angle: -Math.PI / 2, spread: 2 });
    }
    this.tilt = damp(this.tilt, clamp(this.vy / (500 * u), -0.5, 0.6), 8, dt);
    this.flapT = Math.max(0, this.flapT - dt * 3);
    this.giggleT = Math.max(0, this.giggleT - dt);
    this.bumpCool = Math.max(0, this.bumpCool - dt);
    this.comboT = Math.max(0, this.comboT - dt); if (!this.comboT) this.combo = 0;
    this.rainbow = Math.max(0, this.rainbow - dt * 0.4);
    this.squash.update(dt);
    this.jar.update(dt);

    // scroll the world
    const scroll = this.started ? this.speed : this.speed * 0.4;
    this.scrollX += scroll * dt;
    app.world.scroll = damp(app.world.scroll, scroll / (160 * u), 2, dt);
    this.spawnAcc += scroll * dt;
    if (this.spawnAcc > 380 * u) { this.spawnAcc = 0; this.spawnPattern(); }

    const cx = this.x, cy = this.y, cr = 32 * u;
    for (const it of this.items) {
      it.x -= scroll * dt;
      if (it.type === 'star' && !it.got && dist(cx, cy, it.x, it.y) < cr + 30 * u) {
        it.got = true;
        this.combo++; this.comboT = 1.6;
        app.sound.xylo(440 * Math.pow(2, (Math.min(this.combo, 10) * 2) / 12));
        app.sound.sparkle(0.05);
        app.particles.confetti(it.x, it.y, 16, 0.6);
        if (this.jar.add()) this.celebrate();
      }
      if (it.type === 'cloud') {
        it.spring.update(dt);
        if (this.bumpCool <= 0 && dist(cx, cy, it.x, it.y) < cr + it.r * 0.78) {
          this.bumpCool = 0.7; this.giggleT = 1.1;
          it.friendly = true; it.spring.kick(6);
          this.vy = (cy < it.y ? -1 : 1) * 240 * u;
          this.squash.kick(8);
          app.sound.giggle(); app.sound.boing(0.9, 0.08);
          app.particles.burst(cx, cy, 16, ['#ffb3d9', '#ffffff', '#ffe27a'], { kind: 1, speed: 240, size: 6 });
        }
      }
    }
    this.items = this.items.filter((it) => it.x > -120 * u && !(it.got && it.type === 'star'));
  }

  celebrate() {
    app.sound.fanfare();
    this.rainbow = 1;
    for (let k = 0; k < 5; k++) app.particles.confetti(app.W * (0.15 + k * 0.17), app.H * 0.75, 30, 1.3);
  }

  draw(ctx) {
    const u = app.u, t = app.t, W = app.W, H = app.H;
    // rainbow arch after each full jar
    if (this.rainbow > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, this.rainbow * 2) * 0.55; ctx.lineCap = 'round';
      for (let k = 0; k < 7; k++) {
        ctx.strokeStyle = hsl(k * 45, 100, 65); ctx.lineWidth = 14 * u;
        ctx.beginPath(); ctx.arc(W / 2, H * 1.05, H * (0.7 - k * 0.035), Math.PI, TAU); ctx.stroke();
      }
      ctx.restore();
    }
    // scrolling glowing mushrooms along the ground
    const sp = 90 * u, off = this.scrollX % sp;
    ctx.save();
    for (let x = -off, i = Math.floor(this.scrollX / sp); x < W + sp; x += sp, i++) {
      const h = (14 + ((i * 37) % 5) * 5) * u, col = ['#6fe3ff', '#ff8be0', '#fff17a', '#9dff8a'][((i % 4) + 4) % 4];
      const gy = H - 22 * u;
      ctx.fillStyle = '#e8ddff'; ctx.fillRect(x - 2 * u, gy - h, 4 * u, h);
      ctx.globalCompositeOperation = 'lighter';
      const g = 22 * u; ctx.drawImage(glowSprite(col), x - g, gy - h - g, g * 2, g * 2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, gy - h, 11 * u, 7 * u, 0, Math.PI, TAU); ctx.fill();
    }
    ctx.restore();

    for (const it of this.items) {
      if (it.type === 'star') {
        ctx.save(); ctx.translate(it.x, it.y + Math.sin(t * 3 + it.p) * 6 * u); drawStar(ctx, 20 * u, t + it.p); ctx.restore();
      } else this.drawCloud(ctx, it, t);
    }

    // the creature
    const face = app.input.face;
    const eyes = face.present && face.eyesClosed ? 0 : 1;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.tilt + (this.giggleT > 0 ? Math.sin(t * 30) * 0.12 : 0));
    const s = this.squash.x;
    ctx.scale(s, 2 - s);
    CHARACTERS[this.char](ctx, 34 * u, { t, flap: this.flapT, eyes, giggle: this.giggleT });
    ctx.restore();
    if (this.giggleT > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, this.giggleT * 2);
      for (let k = 0; k < 3; k++) {
        const a = t * 4 + k * 2.1, r = 50 * u;
        ctx.drawImage(glowSprite('#ffb3d9'), this.x + Math.cos(a) * r - 8 * u, this.y - 30 * u + Math.sin(a) * r * 0.4 - 8 * u, 16 * u, 16 * u);
      }
      ctx.restore();
    }
  }

  drawCloud(ctx, c, t) {
    const u = app.u, s = c.spring.x;
    ctx.save();
    ctx.translate(c.x, c.y + Math.sin(t * 1.5 + c.p) * 8 * u);
    ctx.scale(s, 2 - s);
    const base = c.friendly ? ['#ffd1ec', '#ffb3d9'] : ['#8f86c8', '#5d5498'];
    for (const [x, y, r] of [[-0.55, 0.15, 0.5], [0, -0.2, 0.62], [0.55, 0.1, 0.5], [0.1, 0.3, 0.5], [-0.25, 0.3, 0.45]]) {
      const g = ctx.createRadialGradient(x * c.r - c.r * 0.15, y * c.r - c.r * 0.2, 0, x * c.r, y * c.r, r * c.r);
      g.addColorStop(0, base[0]); g.addColorStop(1, base[1]);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x * c.r, y * c.r, r * c.r, 0, TAU); ctx.fill();
    }
    ctx.translate(0, c.r * 0.08);
    drawFace(ctx, c.r * 0.38, { fill: 'rgba(0,0,0,0)', ink: c.friendly ? '#8a2a6a' : '#2a2050', smile: c.friendly ? 1 : -0.4, open: c.friendly ? 0.2 : 0.9 });
    ctx.restore();
    if (!c.friendly && Math.sin(t * 2 + c.p) > 0.97) {
      // tiny harmless lightning sparkle
      app.particles.spawn(c.x + rand(-20, 20) * u, c.y + c.r * 0.7, 0, 120 * u, 0.3, 4 * u, '#fff7a0', 1, 0, 0.95);
    }
  }

  drawTop(ctx) {
    const u = app.u;
    for (const b of this.ui) b.draw(ctx);
    this.jar.draw(ctx, this.home.x + this.home.r * 2.6, this.home.y + 6 * u, 26 * u);
  }
}
