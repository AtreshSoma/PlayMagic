// ---------------------------------------------------------------------------
// STARLIGHT RUN · endless three-lane runner
// Lumo, a little star sprite, dashes down a neon space road. Change lanes
// to dodge tall crystal walls, jump over low beams, and collect stars.
// Shields absorb one hit; magnets pull in every nearby star. The road
// speeds up the longer you survive. Three lights, then the run ends.
//
// Controls (all low-effort):
//   camera  move your hand left / centre / right to pick a lane (or tilt
//           your head); flick your hand upward or pinch to jump
//   keys    ← / → (or Q / E) change lane · ↑ / W / Space jump
//   mouse   the cursor's third of the screen picks the lane · click jumps
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { GameBase, HUD_SUB_Y } from './base.js';
import { glowText } from '../ui/draw.js';
import { TAU, rand, pick, clamp, rgba, approach, fmt } from '../core/util.js';

const HIT_Z = 0.03;
const JUMP_TIME = 0.62;

export class RunnerGame extends GameBase {
  constructor() {
    super('runner', 'Starlight Run');
    this.duration = Infinity; this.maxLives = 3;
    this.allow = { swipe: false, runes: false, faceMagic: false, chimes: false, overlays: true, scatter: false, snapshot: false, gravity: false, puff: false, tilt: false, barrier: false };
    this.cues = [{ cue: 'steer', key: '← →' }, { cue: 'flick', key: '↑' }, { cue: 'tilt', key: 'Mouse' }];
  }

  playCoach() {
    return app.mode === 'camera'
      ? { icon: 'palm', html: '<b>Move your hand</b> left or right to change lanes<small>Flick your hand up (or pinch) to jump the low beams</small>' }
      : { icon: 'swipe', html: '<b>← →</b> change lanes · <b>↑</b> or click to jump<small>Or steer with the mouse</small>' };
  }

  reset() {
    this.lane = 0; this.x = 0; this.keyLane = 0; this.jumpT = 0; this.invuln = 0;
    this.speed = 0.5; this.dist = 0; this.stars = 0; this.objs = []; this.spawnZ = 0;
    this.shield = false; this.magnet = 0; this.road = 0; this.hitFlash = 0; this.lastSrc = 'keys';
  }

  get jumping() { return this.jumpT > 0; }
  get jumpH() { return this.jumping ? Math.sin((1 - this.jumpT / JUMP_TIME) * Math.PI) : 0; }

  jump() {
    if (this.jumping) return;
    this.jumpT = JUMP_TIME;
    app.audio.whoosh(1);
    const p = this.project(this.x, 0);
    app.particles.emit({ x: p.x, y: p.y + 10, count: 14, speed: [60, 200], life: [0.3, 0.6], colors: [this.accent, '#ffffff'], raw: true });
  }

  /** world (lane X in −1..1, depth z 0 near … 1 horizon, height h) → screen */
  project(X, z, h = 0) {
    const W = app.W, H = app.H, hy = H * 0.34, py = H * 0.84;
    const s = 1 / (1 + z * 7);
    return { x: W / 2 + X * W * 0.26 * s, y: hy + (py - hy) * s - h * H * 0.22 * s, s };
  }

  // ------------------------------------------------------------------ steering
  steer(dt) {
    const inp = app.input, W = app.W;
    for (const e of inp.events) {
      if (e.type === 'swipe' && (e.dir === 'left' || e.dir === 'right') && e.key) { this.keyLane = clamp(this.lane + (e.dir === 'left' ? -1 : 1), -1, 1); this.lastSrc = 'keys'; }
      if ((e.type === 'swipe' && e.dir === 'up') || (e.type === 'pinchStart') || e.type === 'nod' || (e.type === 'blink' && e.key)) this.jump();
    }
    const cam = inp.hands.find((h) => h.present);
    if (cam) {
      // hand thirds with hysteresis
      const fx = cam.palmX / W, cur = this.lane;
      const want = fx < (cur === -1 ? 0.4 : 0.34) ? -1 : fx > (cur === 1 ? 0.6 : 0.66) ? 1 : 0;
      this.lane = want; this.lastSrc = 'hand';
      if (cam.vy < -1100 && !cam.pinch) this.jump();
    } else if (inp.mouseHand.present && app.t - inp.fb.lastMove < 1.2 && this.lastSrc !== 'keys') {
      const fx = inp.mouseHand.x / W;
      this.lane = fx < 0.36 ? -1 : fx > 0.64 ? 1 : 0;
    } else if (inp.face.present && Math.abs(inp.vals.tilt) > 0.2 && this.lastSrc !== 'keys') {
      this.lane = inp.vals.tilt < 0 ? -1 : 1;
    } else this.lane = this.keyLane;
    if (inp.mouseHand.present && app.t - inp.fb.lastMove < 0.1) this.lastSrc = 'mouse';
    this.x = approach(this.x, this.lane, dt, 0.07);
  }

  // ------------------------------------------------------------------ spawning
  spawnRow() {
    const r = Math.random(), lanes = [-1, 0, 1];
    const free = lanes.splice(Math.floor(rand(3)), 1)[0];
    if (r < 0.35) {
      // a wall in one or two lanes, always leaving a free lane
      const n = this.speed > 0.8 && Math.random() < 0.5 ? 2 : 1;
      for (const L of lanes.slice(0, n)) this.objs.push({ type: 'wall', X: L, z: 1 });
      this.trail(free);
    } else if (r < 0.6) {
      for (const L of [-1, 0, 1]) if (L !== free || Math.random() < 0.5) this.objs.push({ type: 'beam', X: L, z: 1 });
      this.trail(free);
    } else if (r < 0.66) {
      this.objs.push({ type: Math.random() < 0.5 ? 'shield' : 'magnet', X: pick([-1, 0, 1]), z: 1 });
    } else this.trail(pick([-1, 0, 1]), 5);
  }

  trail(X, n = 3) { for (let i = 0; i < n; i++) this.objs.push({ type: 'star', X, z: 1 + i * 0.05, h: n > 3 ? Math.sin((i / (n - 1)) * Math.PI) * 0.6 : 0 }); }

  hitObstacle() {
    if (this.invuln > 0) return;
    const p = this.project(this.x, 0);
    if (this.shield) {
      this.shield = false; this.invuln = 1;
      app.audio.shatter(0, 0.5);
      app.fx.shockwave(p.x, p.y - 30, { color: '#7ff3ff', r1: 140, dur: 0.5 });
      app.fx.text(p.x, p.y - 80, 'Shield saved you!', { color: '#7ff3ff', size: 18, font: 'Inter', weight: 600 });
      return;
    }
    this.loseLife(p.x, p.y - 90);
    this.invuln = 1.4; this.hitFlash = 1;
    this.speed = Math.max(0.5, this.speed * 0.8);
  }

  play(dt) {
    this.steer(dt);
    this.jumpT = Math.max(0, this.jumpT - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.magnet = Math.max(0, this.magnet - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 2);
    this.speed = Math.min(1.5, this.speed + dt * 0.012);
    const v = this.speed * 0.55;
    this.road += v * dt; this.dist += v * dt * 100;
    this.score = Math.floor(this.dist) + this.stars * 10;
    this.spawnZ += v * dt;
    if (this.spawnZ > clamp(0.36 - this.speed * 0.1, 0.2, 0.32)) { this.spawnZ = 0; this.spawnRow(); }

    for (const o of this.objs) {
      o.z -= v * dt;
      if (this.magnet > 0 && o.type === 'star' && o.z < 0.45) o.X = approach(o.X, this.x, dt, 0.12);
      if (o.done || o.z > HIT_Z) continue;
      o.done = true;
      const same = Math.abs(o.X - this.x) < 0.45;
      if (!same) continue;
      const p = this.project(o.X, 0);
      if (o.type === 'star') {
        if (o.h && this.jumpH < o.h * 0.5 && o.h > 0.3) continue;
        o.got = true; this.stars++; this.hit();
        app.audio.chime(app.audio.noteFromY(clamp(1 - (this.combo % 10) / 10), 1), { vel: 0.3, bright: 0.9, dur: 1 });
        app.particles.emit({ x: p.x, y: p.y - 40, count: 10, speed: [60, 200], colors: ['#ffe27a', '#ffffff'], raw: true });
      } else if (o.type === 'shield' || o.type === 'magnet') {
        o.got = true;
        if (o.type === 'shield') this.shield = true; else this.magnet = 6;
        app.audio.select();
        app.fx.text(p.x, p.y - 90, o.type === 'shield' ? 'Shield!' : 'Star magnet!', { color: '#ffffff', size: 20 });
      } else if (o.type === 'wall') this.hitObstacle();
      else if (o.type === 'beam' && this.jumpH < 0.35) this.hitObstacle();
      else if (o.type === 'beam') { this.score += 5; app.audio.tick(0, 0.3); }
    }
    this.objs = this.objs.filter((o) => o.z > -0.05 && !o.got);
    this.objs.sort((a, b) => b.z - a.z);
  }

  resultTitle() { return `${fmt(this.dist)} M · ${this.stars} STARS`; }

  // ------------------------------------------------------------------ draw
  drawBack(ctx) {
    if (this.state === 'intro') return;
    const W = app.W, H = app.H, t = app.t, acc = this.accent, hy = H * 0.34;
    ctx.save();
    // road surface
    const L = (X, z) => this.project(X, z);
    const a = L(-1.6, 1), b = L(1.6, 1), c = L(1.6, 0), d = L(-1.6, 0);
    const g = ctx.createLinearGradient(0, hy, 0, H);
    g.addColorStop(0, 'rgba(20, 14, 60, 0.2)'); g.addColorStop(1, 'rgba(40, 20, 110, 0.55)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x + W, c.y + H * 0.2); ctx.lineTo(d.x - W, d.y + H * 0.2); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    // lane rails
    for (const X of [-1.5, -0.5, 0.5, 1.5]) {
      // project the near end at z = 0, then extend the same line to the bottom edge
      const p0 = L(X, 1), pn = L(X, 0), k = (H + 20 - pn.y) / Math.max(1, pn.y - p0.y);
      const p1 = { x: pn.x + (pn.x - p0.x) * k, y: H + 20 };
      ctx.strokeStyle = rgba(Math.abs(X) > 1 ? acc : '#ffffff', Math.abs(X) > 1 ? 0.7 : 0.18); ctx.lineWidth = Math.abs(X) > 1 ? 3 : 1.5;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    // rushing cross stripes
    for (let k = 0; k < 16; k++) {
      const z = k / 16 - (this.road % (1 / 16));
      if (z <= 0) continue;
      const p0 = L(-1.5, z), p1 = L(1.5, z);
      ctx.strokeStyle = rgba(acc, 0.25 * (1 - z)); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    // side pylons
    for (let k = 0; k < 8; k++) {
      const z = k / 8 - (this.road * 1.0 % (1 / 8));
      if (z <= 0) continue;
      for (const X of [-1.9, 1.9]) {
        const p = L(X, z), hh = 60 * p.s * (H / 800);
        ctx.strokeStyle = rgba(k % 2 ? '#ff7ad9' : acc, 0.6 * (1 - z)); ctx.lineWidth = 3 * p.s + 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - hh); ctx.stroke();
        ctx.drawImage(app.particles.spriteCanvas(k % 2 ? '#ff7ad9' : acc), p.x - 10 * p.s - 4, p.y - hh - 10 * p.s - 4, 20 * p.s + 8, 20 * p.s + 8);
      }
    }
    ctx.restore();

    // objects, far to near
    for (const o of this.objs) {
      if (o.z > 1.02 || o.z < -0.04) continue;
      const fade = clamp((1.02 - o.z) * 5);
      const p = this.project(o.X, Math.max(0, o.z), o.h || 0), k = H / 800, s = p.s * k;
      ctx.save(); ctx.globalAlpha = fade;
      if (o.type === 'wall') {
        const w = 120 * s, h = 150 * s;
        const gg = ctx.createLinearGradient(p.x, p.y - h, p.x, p.y);
        gg.addColorStop(0, 'rgba(255,120,200,0.25)'); gg.addColorStop(1, 'rgba(255,90,170,0.65)');
        ctx.fillStyle = gg; ctx.fillRect(p.x - w / 2, p.y - h, w, h);
        ctx.strokeStyle = '#ffb3e6'; ctx.lineWidth = 2; ctx.strokeRect(p.x - w / 2, p.y - h, w, h);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x - w / 2, p.y - h); ctx.lineTo(p.x + w / 2, p.y); ctx.moveTo(p.x + w / 2, p.y - h); ctx.lineTo(p.x - w / 2, p.y); ctx.stroke();
      } else if (o.type === 'beam') {
        const w = 120 * s, h = 26 * s;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba('#ffb46b', 0.55); ctx.fillRect(p.x - w / 2, p.y - h * 1.6, w, h);
        ctx.strokeStyle = '#ffe2b8'; ctx.lineWidth = 2; ctx.strokeRect(p.x - w / 2, p.y - h * 1.6, w, h);
      } else if (o.type === 'star') {
        ctx.globalCompositeOperation = 'lighter';
        const r = 16 * s, gl = r * 3;
        ctx.drawImage(app.particles.spriteCanvas('#ffe27a'), p.x - gl, p.y - 40 * s - gl, gl * 2, gl * 2);
        ctx.translate(p.x, p.y - 40 * s); ctx.rotate(t * 2);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (let i = 0; i < 10; i++) { const ang = (i / 10) * TAU - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; i ? ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
        ctx.closePath(); ctx.fill();
      } else {
        const r = 22 * s, col = o.type === 'shield' ? '#7ff3ff' : '#ff7ad9';
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(app.particles.spriteCanvas(col), p.x - r * 3, p.y - 50 * s - r * 3, r * 6, r * 6);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(p.x, p.y - 50 * s, r, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.font = `700 ${Math.round(r)}px Sora, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(o.type === 'shield' ? '◇' : 'U', p.x, p.y - 50 * s + 1);
      }
      ctx.restore();
    }
    this.drawLumo(ctx);
  }

  /** Lumo: a round star sprite with a trailing ribbon scarf. */
  drawLumo(ctx) {
    const t = app.t, p = this.project(this.x, 0), k = app.H / 800, r = 30 * k;
    const y = p.y - 34 * k - this.jumpH * 140 * k + Math.sin(t * 14) * 3 * k * (this.jumping ? 0 : 1);
    if (this.invuln > 0 && Math.floor(t * 12) % 2) return;
    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r * (1 - this.jumpH * 0.4), r * 0.28, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(app.particles.spriteCanvas(this.accent), p.x - r * 3, y - r * 3, r * 6, r * 6);
    // scarf
    ctx.strokeStyle = '#ff7ad9'; ctx.lineWidth = 7 * k; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.x, y + r * 0.3);
    for (let i = 1; i <= 6; i++) ctx.lineTo(p.x + Math.sin(t * 10 + i) * 6 * k * i * 0.4, y + r * 0.3 + i * 9 * k);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createRadialGradient(p.x - r * 0.3, y - r * 0.35, r * 0.1, p.x, y, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#cff9ff'); g.addColorStop(1, this.accent);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, y, r, 0, TAU); ctx.fill();
    // face
    ctx.fillStyle = '#1b1840';
    const blink = Math.sin(t * 3) > 0.97 ? 0.15 : 1;
    ctx.beginPath(); ctx.ellipse(p.x - r * 0.3, y - r * 0.05, r * 0.1, r * 0.15 * blink, 0, 0, TAU); ctx.ellipse(p.x + r * 0.3, y - r * 0.05, r * 0.1, r * 0.15 * blink, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#1b1840'; ctx.lineWidth = 2.5 * k;
    ctx.beginPath(); ctx.arc(p.x, y + r * 0.15, r * 0.25, 0.2, Math.PI - 0.2); ctx.stroke();
    if (this.shield) { ctx.strokeStyle = rgba('#7ff3ff', 0.7 + 0.3 * Math.sin(t * 8)); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, y, r * 1.5, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }

  drawFront(ctx) {
    if (this.state === 'play') {
      const bits = [`${fmt(this.dist)} m`, `★ ${this.stars}`];
      if (this.magnet > 0) bits.push(`magnet ${Math.ceil(this.magnet)}s`);
      if (this.shield) bits.push('shield');
      glowText(ctx, bits.join('  ·  '), app.W / 2, HUD_SUB_Y, { size: 11, font: 'Inter', weight: 600, spacing: 2, color: 'rgba(255,255,255,0.7)', blur: 0 });
      if (this.hitFlash > 0) { ctx.save(); ctx.fillStyle = `rgba(255,80,140,${this.hitFlash * 0.25})`; ctx.fillRect(0, 0, app.W, app.H); ctx.restore(); }
    }
    super.drawFront(ctx);
  }
}
