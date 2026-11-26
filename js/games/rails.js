// ---------------------------------------------------------------------------
// NEON RAILS · full-body lane runner
// Created by Atresh Somayajula.
//
// Dash along three glowing rail lines through a night-time neon city.
// Your BODY is the controller:
//   step left / right  → switch rail lines (dodge oncoming trains)
//   jump               → hop over low barriers
//   crouch             → slide under the high neon bars
// Collect coins (every 50 raises the multiplier), grab Hoverboards (shield
// + double score) and Coin Magnets. The city speeds up the longer you run.
// Three lights; a crash costs one, with a moment of invulnerability after.
//
// A 1.2 s calibration ("stand tall in the middle") learns where you stand.
// Fallbacks so anyone can play: hand swipes (camera), ← → ↑ ↓ / A D W S /
// Space keys, or swipe with the mouse / a finger.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { GameBase, HUD_SUB_Y } from './base.js';
import { BodyMotion } from '../input/body.js';
import { glowText, roundRect } from '../ui/draw.js';
import { TAU, rand, pick, clamp, rgba, approach, fmt } from '../core/util.js';

const HIT_Z = 0.025, JUMP_T = 0.7, SLIDE_T = 0.65;
const BUILDING_HUES = ['#ff7ad9', '#7ff3ff', '#ffd36e', '#b69bff', '#9dff9a'];

export class RailsGame extends GameBase {
  constructor() {
    super('rails', 'Neon Rails');
    this.duration = Infinity; this.maxLives = 3;
    this.allow = { swipe: false, runes: false, faceMagic: false, chimes: false, overlays: true, scatter: false, snapshot: false, gravity: false, puff: false, tilt: false, barrier: false, doubleBlink: false };
    this.cues = [{ cue: 'bodyStep', key: '← →' }, { cue: 'bodyJump', key: '↑ / Space' }, { cue: 'bodyCrouch', key: '↓ / S' }];
    this.body = new BodyMotion();
    this.buildings = [];
  }

  playCoach() {
    return this.useBody
      ? { icon: 'tilt', html: '<b>Step</b> left or right · <b>jump</b> · <b>crouch</b><small>Your whole body is the controller</small>' }
      : app.mode === 'camera'
        ? { icon: 'swipe', html: 'Step into view so the camera sees your face<small>Meanwhile: swipe your hand ← → ↑ ↓</small>' }
        : { icon: 'swipe', html: '<b>← →</b> switch lines · <b>↑</b> jump · <b>↓</b> slide<small>Or swipe with the mouse / a finger</small>' };
  }

  get useBody() { return app.mode === 'camera' && (this.body.state === 'ready' || this.body.state === 'calibrating'); }

  reset() {
    this.lane = 0; this.x = 0; this.jumpT = 0; this.slideT = 0; this.inv = 0;
    this.speed = 0.55; this.dist = 0; this.coins = 0; this.objs = []; this.spawnZ = 0.3; this.road = 0;
    this.board = 0; this.magnet = 0; this.hitFlash = 0; this.runT = 0; this.drag = null;
    this.body.reset();
    this.buildings = Array.from({ length: 16 }, (_, i) => this.newBuilding(i / 16));
  }

  onStart() { if (app.mode === 'camera') this.body.calibrate(); }

  newBuilding(z) {
    return { z, side: Math.random() < 0.5 ? -1 : 1, w: rand(0.6, 1.1), h: rand(0.9, 2.2), hue: pick(BUILDING_HUES), win: Math.random() * 1000, off: rand(0, 0.5) };
  }

  get mult() { return (1 + Math.min(4, Math.floor(this.coins / 50))) * (this.board > 0 ? 2 : 1); }
  get jumpH() { return this.jumpT > 0 ? Math.sin((1 - this.jumpT / JUMP_T) * Math.PI) : 0; }
  get sliding() { return this.slideT > 0; }

  project(X, z, h = 0) {
    const W = app.W, H = app.H, hy = H * 0.36, py = H * 0.88, s = 1 / (1 + z * 6);
    return { x: W / 2 + X * W * 0.22 * s, y: hy + (py - hy) * s - h * H * 0.24 * s, s };
  }

  // ------------------------------------------------------------------ input
  jump() { if (this.jumpT > 0) return; this.jumpT = JUMP_T; this.slideT = 0; app.audio.whoosh(1); }
  slide() { if (this.jumpT > 0.25) this.jumpT = 0.12; this.slideT = SLIDE_T; app.audio.whoosh(-1); }
  step(d) { const n = clamp(this.lane + d, -1, 1); if (n !== this.lane) { this.lane = n; app.audio.tick(d * 0.5, 0.35); } }

  readInput(dt) {
    const inp = app.input, fb = inp.fb;
    this.body.update(dt, inp.face);
    if (this.body.state === 'ready') {
      if (this.body.lane !== this.lane) { this.lane = this.body.lane; app.audio.tick(this.lane * 0.5, 0.35); }
      if (this.body.jumped) this.jump();
      if (this.body.ducking) this.slideT = Math.max(this.slideT, 0.18);
    }
    for (const e of inp.events) {
      if (e.type === 'swipe') {
        if (e.dir === 'left') this.step(-1); else if (e.dir === 'right') this.step(1); else if (e.dir === 'up') this.jump();
      }
      if (e.type === 'blink' && e.key) this.jump();
    }
    const down = fb.held('ArrowDown') || fb.held('KeyS');
    if (down && !this.downWas) this.slide();
    this.downWas = down;
    if (fb.held('KeyA') && !this.aWas) this.step(-1);
    if (fb.held('KeyD') && !this.dWas) this.step(1);
    this.aWas = fb.held('KeyA'); this.dWas = fb.held('KeyD');
    // pointer swipes (mouse drag or finger)
    const m = inp.mouseHand;
    if (fb.down && !this.drag) this.drag = { x: m.x, y: m.y };
    if (!fb.down && this.drag) {
      const dx = m.x - this.drag.x, dy = m.y - this.drag.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 40) {
        if (Math.abs(dx) > Math.abs(dy)) this.step(Math.sign(dx)); else if (dy < 0) this.jump(); else this.slide();
      } else this.jump(); // a tap jumps
      this.drag = null;
    }
  }

  // ------------------------------------------------------------------ world
  spawnRow() {
    const lanes = [-1, 0, 1], free = lanes.splice(Math.floor(rand(3)), 1)[0], r = Math.random(), hard = this.speed > 0.8;
    if (r < 0.34) { // trains in one or two lanes, some rolling toward you
      const n = hard && Math.random() < 0.5 ? 2 : 1;
      for (const L of lanes.slice(0, n)) this.objs.push({ type: 'train', X: L, z: 1, len: rand(0.18, 0.35), vz: Math.random() < 0.35 ? 0.25 : 0, hue: pick(BUILDING_HUES) });
      this.coinLine(free, 6);
    } else if (r < 0.56) {
      const t = Math.random() < 0.5 ? 'low' : 'high';
      for (const L of [-1, 0, 1]) if (L !== free || Math.random() < 0.45) this.objs.push({ type: t, X: L, z: 1 });
      this.coinLine(free, 4, t === 'low');
    } else if (r < 0.62) this.objs.push({ type: Math.random() < 0.5 ? 'board' : 'magnet', X: pick([-1, 0, 1]), z: 1 });
    else this.coinLine(pick([-1, 0, 1]), 7);
  }

  coinLine(X, n, arc = false) { for (let i = 0; i < n; i++) this.objs.push({ type: 'coin', X, z: 1 + i * 0.045, h: arc ? Math.sin((i / Math.max(1, n - 1)) * Math.PI) * 0.7 : 0 }); }

  crash(kind) {
    if (this.inv > 0) return;
    const p = this.project(this.x, 0);
    if (this.board > 0) {
      this.board = 0; this.inv = 1.2;
      app.audio.shatter(0, 0.6); app.fx.shockwave(p.x, p.y - 40, { color: '#7ff3ff', r1: 160, dur: 0.5 });
      app.fx.text(p.x, p.y - 120, 'Hoverboard saved you!', { color: '#7ff3ff', size: 18, font: 'Inter', weight: 700 });
      return;
    }
    this.loseLife(p.x, p.y - 140);
    this.inv = 1.6; this.hitFlash = 1; this.speed = Math.max(0.55, this.speed * 0.85);
    app.fx.text(p.x, p.y - 170, kind === 'high' ? 'Crouch to slide under!' : kind === 'low' ? 'Jump over these!' : 'Step aside!', { color: '#ffffff', size: 16, font: 'Inter', weight: 700, dur: 1.6 });
  }

  play(dt) {
    this.readInput(dt);
    const calibrating = this.body.state === 'calibrating';
    this.x = approach(this.x, this.lane, dt, 0.06);
    this.jumpT = Math.max(0, this.jumpT - dt); this.slideT = Math.max(0, this.slideT - dt);
    this.inv = Math.max(0, this.inv - dt); this.board = Math.max(0, this.board - dt); this.magnet = Math.max(0, this.magnet - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 2);
    if (calibrating) return; // the city waits while it learns where you stand
    this.runT += dt;
    this.speed = Math.min(1.6, this.speed + dt * 0.01);
    const v = this.speed * 0.6;
    this.road += v * dt; this.dist += v * dt * 120;
    this.score = Math.floor(this.dist * this.mult / 2) + this.coins * 10;
    this.spawnZ -= v * dt;
    if (this.spawnZ <= 0) { this.spawnRow(); this.spawnZ = clamp(0.42 - this.speed * 0.12, 0.24, 0.38); }
    for (const b of this.buildings) { b.z -= v * dt; if (b.z < -0.05) Object.assign(b, this.newBuilding(1)); }

    for (const o of this.objs) {
      o.z -= (v + (o.vz || 0)) * dt;
      if (this.magnet > 0 && o.type === 'coin' && o.z < 0.5) { o.X = approach(o.X, this.x, dt, 0.1); o.h = approach(o.h || 0, this.jumpH * 0.6, dt, 0.1); }
      const near = o.z <= HIT_Z && (o.type === 'train' ? o.z + o.len >= -0.01 : o.z > -0.03);
      if (!near || o.done) continue;
      if (Math.abs(o.X - this.x) > 0.42) { if (o.type !== 'train') o.done = true; continue; }
      if (o.type === 'coin') {
        if ((o.h || 0) > 0.35 && this.jumpH < 0.3) { o.done = true; continue; }
        o.done = o.got = true; this.coins++; this.hit();
        app.audio.chime(1318 + (this.coins % 6) * 70, { vel: 0.22, bright: 1, dur: 0.6 });
        if (this.coins % 50 === 0) { app.audio.victory(); app.fx.text(app.W / 2, app.H * 0.28, `Multiplier ×${this.mult}!`, { color: '#ffd36e', size: 30 }); }
      } else if (o.type === 'board' || o.type === 'magnet') {
        o.done = o.got = true;
        if (o.type === 'board') this.board = 10; else this.magnet = 8;
        app.audio.select();
        app.fx.text(app.W / 2, app.H * 0.3, o.type === 'board' ? 'Hoverboard! Shield + double score' : 'Coin magnet!', { color: '#ffffff', size: 22 });
      } else if (o.type === 'train') { o.done = true; this.crash('train'); }
      else if (o.type === 'low') { o.done = true; if (this.jumpH < 0.3) this.crash('low'); else { this.score += 20; app.audio.tick(0, 0.4); } }
      else if (o.type === 'high') { o.done = true; if (!this.sliding) this.crash('high'); else { this.score += 20; app.audio.tick(0, 0.4); } }
    }
    this.objs = this.objs.filter((o) => !o.got && (o.type === 'train' ? o.z + o.len > -0.1 : o.z > -0.06));
  }

  resultTitle() { return `${fmt(this.dist)} M · ${this.coins} COINS`; }

  // ------------------------------------------------------------------ draw
  drawBuildings(ctx) {
    const H = app.H, t = app.t;
    const list = [...this.buildings].sort((a, b) => b.z - a.z);
    for (const b of list) {
      if (b.z > 1 || b.z < 0) continue;
      const p = this.project(b.side * (1.9 + b.off), b.z), s = p.s, w = b.w * app.W * 0.12 * s * 2.2, h = b.h * H * 0.3 * s * 1.6;
      const x = p.x - (b.side > 0 ? 0 : w), y = p.y - h, fade = clamp((1 - b.z) * 2.5);
      ctx.save(); ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgba(18, 12, 46, 0.92)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = rgba(b.hue, 0.55); ctx.lineWidth = Math.max(1, 2 * s); ctx.strokeRect(x, y, w, h);
      // lit windows
      const cols = 4, rows = Math.max(3, Math.round(b.h * 4)), cw = w / cols, rh = h / rows;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const lit = Math.sin(b.win + r * 7.1 + c * 3.3) > 0.1;
        if (!lit) continue;
        ctx.fillStyle = rgba(r % 3 === 0 ? b.hue : '#ffe9b8', 0.55 + 0.3 * Math.sin(t * 0.7 + r + c));
        ctx.fillRect(x + c * cw + cw * 0.25, y + r * rh + rh * 0.3, cw * 0.5, rh * 0.4);
      }
      ctx.restore();
    }
  }

  drawTrain(ctx, o) {
    const back = this.project(o.X, Math.min(1, o.z + o.len)), front = this.project(o.X, Math.max(0, o.z)), k = app.H / 800;
    const hf = 170 * front.s * k, wf = 150 * front.s * k, hb = 170 * back.s * k, wb = 150 * back.s * k;
    // side faces (perspective quad from front to back)
    for (const side of [-1, 1]) {
      ctx.fillStyle = rgba(o.hue, 0.32);
      ctx.beginPath(); ctx.moveTo(front.x + side * wf / 2, front.y); ctx.lineTo(back.x + side * wb / 2, back.y); ctx.lineTo(back.x + side * wb / 2, back.y - hb); ctx.lineTo(front.x + side * wf / 2, front.y - hf); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(30, 24, 70, 0.95)';
    ctx.beginPath(); ctx.moveTo(front.x - wf / 2, front.y - hf); ctx.lineTo(back.x - wb / 2, back.y - hb); ctx.lineTo(back.x + wb / 2, back.y - hb); ctx.lineTo(front.x + wf / 2, front.y - hf); ctx.closePath(); ctx.fill();
    // front face
    const g = ctx.createLinearGradient(0, front.y - hf, 0, front.y);
    g.addColorStop(0, '#3a2f7a'); g.addColorStop(1, '#1c1640');
    roundRect(ctx, front.x - wf / 2, front.y - hf, wf, hf, 10 * front.s); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = rgba(o.hue, 0.95); ctx.lineWidth = Math.max(1.5, 3 * front.s); ctx.stroke();
    ctx.fillStyle = rgba('#bff8ff', 0.75); ctx.fillRect(front.x - wf * 0.38, front.y - hf * 0.82, wf * 0.76, hf * 0.3);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const s of [-1, 1]) { const r = 22 * front.s * k; ctx.drawImage(app.particles.spriteCanvas(o.vz ? '#ff6b6b' : '#fff3c4'), front.x + s * wf * 0.3 - r, front.y - hf * 0.22 - r, r * 2, r * 2); }
    ctx.restore();
  }

  drawRunner(ctx) {
    const t = app.t, p = this.project(this.x, 0), k = app.H / 800, s = 1.25 * k;
    if (this.inv > 0 && Math.floor(t * 12) % 2) return;
    const lift = this.jumpH * 150 * k, slide = this.sliding;
    const x = p.x, y = p.y - lift, ph = this.runT * 11;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 34 * s * (1 - this.jumpH * 0.4), 9 * s, 0, 0, TAU); ctx.fill();
    if (this.board > 0) { // hoverboard under the feet
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(app.particles.spriteCanvas('#7ff3ff'), x - 60 * s, y - 30 * s, 120 * s, 60 * s); ctx.restore();
      roundRect(ctx, x - 38 * s, y - 8 * s, 76 * s, 12 * s, 6 * s); ctx.fillStyle = '#7ff3ff'; ctx.fill();
    }
    ctx.translate(x, y - (this.board > 0 ? 10 * s : 0));
    if (slide) ctx.scale(1.15, 0.55);
    // legs (run cycle, seen from behind)
    ctx.strokeStyle = '#2a2050'; ctx.lineCap = 'round'; ctx.lineWidth = 11 * s;
    const swing = this.jumpT > 0 ? 0.5 : Math.sin(ph);
    for (const side of [-1, 1]) {
      const a = side * swing * 0.6;
      ctx.beginPath(); ctx.moveTo(side * 8 * s, -44 * s); ctx.lineTo(side * 10 * s + Math.sin(a) * 18 * s, -22 * s + Math.abs(Math.cos(a)) * 0); ctx.lineTo(side * 9 * s + Math.sin(a) * 26 * s, -4 * s - Math.max(0, side * swing) * 10 * s); ctx.stroke();
      ctx.fillStyle = '#ff7ad9'; ctx.beginPath(); ctx.ellipse(side * 9 * s + Math.sin(a) * 26 * s, -2 * s - Math.max(0, side * swing) * 10 * s, 9 * s, 5 * s, 0, 0, TAU); ctx.fill();
    }
    // hoodie body
    const g = ctx.createLinearGradient(0, -100 * s, 0, -40 * s);
    g.addColorStop(0, '#7ff3ff'); g.addColorStop(1, '#3a8fd9');
    roundRect(ctx, -22 * s, -98 * s, 44 * s, 58 * s, 16 * s); ctx.fillStyle = g; ctx.fill();
    // arms swing opposite the legs
    ctx.strokeStyle = '#3a8fd9'; ctx.lineWidth = 10 * s;
    for (const side of [-1, 1]) { const a = -side * swing * 0.7; ctx.beginPath(); ctx.moveTo(side * 20 * s, -88 * s); ctx.lineTo(side * 30 * s + Math.sin(a) * 10 * s, -62 * s - (this.jumpT > 0 ? 24 * s : 0)); ctx.stroke(); }
    // head + cap (back view) + backpack
    ctx.fillStyle = '#ffd6b8'; ctx.beginPath(); ctx.arc(0, -112 * s, 16 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff7ad9'; ctx.beginPath(); ctx.arc(0, -116 * s, 17 * s, Math.PI, TAU); ctx.fill();
    ctx.fillRect(-6 * s, -118 * s, 12 * s, 6 * s);
    roundRect(ctx, -15 * s, -90 * s, 30 * s, 34 * s, 8 * s); ctx.fillStyle = '#ffd36e'; ctx.fill();
    ctx.restore();
  }

  drawBack(ctx) {
    if (this.state === 'intro') return;
    const W = app.W, H = app.H, t = app.t, hy = H * 0.36;
    // night city sky + skyline glow
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, 'rgba(10, 6, 40, 0.55)'); sky.addColorStop(0.36, 'rgba(60, 20, 90, 0.4)'); sky.addColorStop(1, 'rgba(10, 6, 30, 0.6)');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5;
    ctx.drawImage(app.particles.spriteCanvas('#ff7ad9'), W / 2 - W * 0.4, hy - H * 0.2, W * 0.8, H * 0.4); ctx.restore();
    this.drawBuildings(ctx);
    // track bed + rails + rushing sleepers
    const L = (X, z) => this.project(X, z);
    const a = L(-1.6, 1), b = L(1.6, 1), c = L(1.6, 0), d = L(-1.6, 0);
    ctx.fillStyle = 'rgba(14, 10, 34, 0.85)';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x + W * 0.5, H); ctx.lineTo(d.x - W * 0.5, H); ctx.closePath(); ctx.fill();
    ctx.save();
    for (let k2 = 0; k2 < 22; k2++) {
      const z = k2 / 22 - (this.road % (1 / 22));
      if (z <= 0) continue;
      for (const X of [-1, 0, 1]) { const p0 = L(X - 0.38, z), p1 = L(X + 0.38, z); ctx.strokeStyle = rgba('#5a4a8a', 0.8 * (1 - z)); ctx.lineWidth = Math.max(1, 6 * p0.s); ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const X of [-1, 0, 1]) for (const off of [-0.25, 0.25]) {
      const p0 = L(X + off, 1), pn = L(X + off, 0), kk = (H - pn.y) / Math.max(1, pn.y - p0.y);
      ctx.strokeStyle = rgba(X === this.lane ? '#7ff3ff' : '#b69bff', X === this.lane ? 0.9 : 0.5); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(pn.x + (pn.x - p0.x) * kk, H); ctx.stroke();
    }
    ctx.restore();
    // objects far → near
    const objs = [...this.objs].sort((m, n) => n.z - m.z), k = H / 800;
    for (const o of objs) {
      if (o.z > 1.02) continue;
      if (o.type === 'train') { this.drawTrain(ctx, o); continue; }
      if (o.z < -0.04) continue;
      const p = this.project(o.X, Math.max(0, o.z), o.h || 0), s = p.s * k;
      ctx.save(); ctx.globalAlpha = clamp((1.02 - o.z) * 5);
      if (o.type === 'coin') {
        const sw = Math.abs(Math.cos(t * 4 + o.z * 20)) * 0.8 + 0.2, r = 15 * s, y = p.y - 34 * s;
        ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(app.particles.spriteCanvas('#ffd36e'), p.x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
        ctx.globalCompositeOperation = 'source-over';
        ctx.translate(p.x, y); ctx.scale(sw, 1); ctx.fillStyle = '#ffd36e'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff6c4'; ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, TAU); ctx.fill();
      } else if (o.type === 'low') {
        const w = 130 * s, h = 34 * s;
        for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#ffd36e' : '#2a2050'; ctx.fillRect(p.x - w / 2 + (i * w) / 5, p.y - h - 10 * s, w / 5 + 1, h); }
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(p.x - w / 2, p.y - h - 10 * s, w, h);
      } else if (o.type === 'high') {
        const w = 140 * s, y = p.y - 120 * s;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, 5 * s);
        ctx.beginPath(); ctx.moveTo(p.x - w / 2, p.y); ctx.lineTo(p.x - w / 2, y); ctx.moveTo(p.x + w / 2, p.y); ctx.lineTo(p.x + w / 2, y); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = '#ff7ad9'; ctx.lineWidth = Math.max(3, 16 * s); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x - w / 2, y); ctx.lineTo(p.x + w / 2, y); ctx.stroke();
      } else {
        const r = 24 * s, col = o.type === 'board' ? '#7ff3ff' : '#ff7ad9', y = p.y - 50 * s;
        ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(app.particles.spriteCanvas(col), p.x - r * 3, y - r * 3, r * 6, r * 6);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, y, r, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.font = `800 ${Math.round(r)}px Sora, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(o.type === 'board' ? '⇪' : 'U', p.x, y + 1);
      }
      ctx.restore();
    }
    this.drawRunner(ctx);
  }

  /** The body panel: where the camera sees you relative to your calibrated centre. */
  drawBodyPanel(ctx) {
    const b = this.body, W = app.W, H = app.H, pw = 150, ph = 112, x = W - pw - 18, y = H - ph - 108;
    ctx.save();
    roundRect(ctx, x, y, pw, ph, 18); ctx.fillStyle = 'rgba(12,10,36,0.6)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.stroke();
    const cx = x + pw / 2, cy = y + ph / 2 + 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.setLineDash([3, 4]);
    for (const lx of [-0.65, 0.65]) { ctx.beginPath(); ctx.moveTo(cx + lx * 46, y + 14); ctx.lineTo(cx + lx * 46, y + ph - 10); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x + 12, cy - 0.3 * 46); ctx.lineTo(x + pw - 12, cy - 0.3 * 46); ctx.moveTo(x + 12, cy + 0.5 * 46); ctx.lineTo(x + pw - 12, cy + 0.5 * 46); ctx.stroke();
    ctx.setLineDash([]);
    const ok = b.state === 'ready', hx = cx + clamp(b.lean, -1.4, 1.4) * 46 * 0.9, hy = cy - clamp(b.rise, -1, 1) * 46;
    ctx.fillStyle = ok ? (b.ducking ? '#ff7ad9' : b.rise > 0.3 ? '#ffd36e' : '#7ff3ff') : 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.arc(hx, hy - 14, 9, 0, TAU); ctx.fill();
    roundRect(ctx, hx - 9, hy - 3, 18, 26, 7); ctx.fill();
    ctx.restore();
    glowText(ctx, b.state === 'calibrating' ? 'Stand still…' : ok ? 'BODY' : 'Find your face', cx, y + 12, { size: 9, font: 'Inter', weight: 700, spacing: 2, color: 'rgba(255,255,255,0.6)', blur: 0 });
  }

  drawFront(ctx) {
    if (this.state === 'play') {
      const bits = [`${fmt(this.dist)} m`, `● ${this.coins}`, `×${this.mult}`];
      if (this.board > 0) bits.push(`board ${Math.ceil(this.board)}s`);
      if (this.magnet > 0) bits.push(`magnet ${Math.ceil(this.magnet)}s`);
      glowText(ctx, bits.join('   ·   '), app.W / 2, HUD_SUB_Y, { size: 11, font: 'Inter', weight: 700, spacing: 2, color: 'rgba(255,255,255,0.75)', blur: 0 });
      if (app.mode === 'camera') this.drawBodyPanel(ctx);
      if (this.body.state === 'calibrating') {
        const W = app.W, H = app.H, p = clamp(this.body.calibT / 1.2);
        glowText(ctx, 'Stand tall in the middle', W / 2, H * 0.3, { size: 30, glow: this.accent });
        glowText(ctx, 'Learning where you stand…', W / 2, H * 0.3 + 34, { size: 15, font: 'Inter', weight: 500, color: 'rgba(255,255,255,0.75)', blur: 0 });
        ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = this.accent;
        ctx.beginPath(); ctx.arc(W / 2, H * 0.3 + 80, 20, -Math.PI / 2, -Math.PI / 2 + p * TAU); ctx.stroke(); ctx.restore();
      }
      if (this.hitFlash > 0) { ctx.save(); ctx.fillStyle = `rgba(255,80,140,${this.hitFlash * 0.25})`; ctx.fillRect(0, 0, app.W, app.H); ctx.restore(); }
    }
    super.drawFront(ctx);
  }
}
