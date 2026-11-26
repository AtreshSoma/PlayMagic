// ---------------------------------------------------------------------------
// NEBULA RALLY · gesture kart racer (pseudo-3D segment road)
// Race Lumo's comet kart against five rivals around a neon track that loops
// through space: three laps, curves, boost pads, item boxes and star coins.
// The kart accelerates by itself, so the only job is steering and items.
//
//   steering wheel   hold BOTH hands up like a wheel and turn them (the
//                    on-screen wheel turns with you). One hand: move it left /
//                    right. No hands: tilt your head.
//   use item         pinch (either hand), peace sign, or Space
//   items            Comet Boost (rocket ahead) · Star Shield (bump-proof) ·
//                    Spark (zaps the rival just ahead)
// Keys: ← → (A / D) steer · Space use item. Mouse: steer by pointer position.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { GameBase, HUD_SUB_Y } from './base.js';
import { drawLumo } from './lumo.js';
import { glowText, roundRect } from '../ui/draw.js';
import { TAU, rand, pick, clamp, rgba, approach, fmt } from '../core/util.js';

const SEG = 200, ROAD = 2000, CAM_H = 1000, DRAW = 150, DEPTH = 0.84, LAPS = 3;
const MAX = SEG * 60, ACCEL = MAX / 4, OFFROAD = MAX / 3.2, CENTRIFUGAL = 0.3;
const RIVAL_COLORS = ['#ff7ad9', '#ffd36e', '#9dff9a', '#b69bff', '#ff8a5c'];
const ITEMS = ['boost', 'shield', 'spark'];

function buildTrack() {
  const segs = [];
  let y = 0;
  const add = (n, curve, hill = 0) => {
    const y0 = y;
    for (let i = 0; i < n; i++) {
      const k = (1 - Math.cos((i / n) * Math.PI)) / 2;
      const y1 = y0 + hill * k * SEG * 18;
      segs.push({ index: segs.length, curve, y0: segs.length ? segs[segs.length - 1].y1 : 0, y1, sprites: [] });
    }
    y = segs[segs.length - 1].y1;
  };
  add(40, 0); add(50, 2.2, 0.6); add(30, 0, -0.6); add(60, -3, 0.3); add(40, 0); add(50, 3.4, -0.3);
  add(30, -2, 0.5); add(30, 2, -0.5); add(60, 0); add(70, -2.6, 0.2); add(40, 1.5, -0.2); add(50, 0);
  // close the loop: ease the height back to 0
  const last = segs[segs.length - 1].y1;
  add(40, 0); for (let i = 0; i < 40; i++) { const s = segs[segs.length - 40 + i], k = (i + 1) / 40; s.y0 = last * (1 - (i / 40)); s.y1 = last * (1 - k); }
  segs.forEach((s, i) => {
    if (i % 90 === 20) s.boost = true;
    if (i % 110 === 60) s.box = [-0.5, 0, 0.5].map((x) => ({ x, away: 0 }));
    if (i % 23 === 11 && !s.box) s.coins = [{ x: pick([-0.6, 0, 0.6]), got: false }];
    if (i % 6 === 0) s.sprites.push({ x: (i % 12 ? -1 : 1) * rand(1.4, 2.2), kind: i % 18 === 0 ? 'arch' : 'crystal', hue: pick(RIVAL_COLORS) });
  });
  return segs;
}

export class RallyGame extends GameBase {
  constructor() {
    super('rally', 'Nebula Rally');
    this.duration = Infinity; this.maxLives = 0;
    this.allow = { swipe: false, runes: false, faceMagic: false, chimes: false, overlays: true, scatter: false, snapshot: false, gravity: false, puff: false, tilt: false, barrier: false, doubleBlink: false };
    this.cues = [{ cue: 'twoPalms', key: '← →' }, { cue: 'tiltHand', key: 'Mouse' }, { cue: 'pinch', key: 'Space' }];
    this.segs = buildTrack();
    this.trackLen = this.segs.length * SEG;
  }

  playCoach() {
    return app.mode === 'camera'
      ? { icon: 'twoPalms', html: '<b>Hold both hands like a steering wheel</b> and turn<small>Pinch or ✌ to use an item · the kart drives itself</small>' }
      : { icon: 'swipe', html: '<b>← →</b> steer · <b>Space</b> uses your item<small>The kart accelerates by itself</small>' };
  }

  reset() {
    this.segs.forEach((s) => { s.coins?.forEach((c) => (c.got = false)); s.box?.forEach((b) => (b.away = 0)); });
    this.pos = 0; this.x = 0; this.speed = 0; this.lap = 1; this.steer = 0; this.wheel = 0;
    this.item = null; this.boostT = 0; this.shieldT = 0; this.coins = 0; this.raceT = 0; this.countdown = 3.4;
    this.finished = false; this.finishT = 0; this.place = 6; this.skyX = 0; this.bumpT = 0;
    this.rivals = RIVAL_COLORS.map((c, i) => ({ color: c, z: -((i + 1) * SEG * 3), x: [-0.5, 0.4, -0.2, 0.55, 0][i], lap: 1, speed: MAX * (0.78 + i * 0.03), stun: 0 }));
  }

  segAt(z) { return this.segs[Math.floor(((z % this.trackLen) + this.trackLen) % this.trackLen / SEG) % this.segs.length]; }
  total(z, lap) { return (lap - 1) * this.trackLen + z; }

  // ------------------------------------------------------------------ input
  readSteer() {
    const inp = app.input, fb = inp.fb, W = app.W;
    const hands = inp.hands.filter((h) => h.present);
    this.wheelHands = hands.length >= 2;
    if (hands.length >= 2) {
      const [L, R] = hands[0].palmX < hands[1].palmX ? hands : [hands[1], hands[0]];
      return clamp(Math.atan2(R.palmY - L.palmY, R.palmX - L.palmX) / 0.6, -1, 1);
    }
    if (hands.length === 1) return clamp((hands[0].palmX - W / 2) / (W * 0.25), -1, 1);
    const kd = (fb.held('ArrowRight') || fb.held('KeyD') ? 1 : 0) - (fb.held('ArrowLeft') || fb.held('KeyA') ? 1 : 0);
    if (kd) return kd;
    if (inp.mouseHand.present && app.t - fb.lastMove < 2) return clamp((inp.mouseHand.x - W / 2) / (W * 0.3), -1, 1);
    if (inp.face.present) return clamp(inp.vals.tilt / 0.35, -1, 1);
    return 0;
  }

  useItem() {
    if (!this.item) return;
    const it = this.item; this.item = null;
    if (it === 'boost') { this.boostT = 2.2; app.audio.whoosh(1); app.audio.boom(0.4); }
    else if (it === 'shield') { this.shieldT = 5; app.audio.select(); }
    else {
      const me = this.total(this.pos, this.lap);
      const ahead = this.rivals.filter((r) => this.total(r.z, r.lap) > me).sort((a, b) => this.total(a.z, a.lap) - this.total(b.z, b.lap))[0];
      if (ahead) { ahead.stun = 2; app.audio.shatter(0, 0.6); app.fx.text(app.W / 2, app.H * 0.35, 'Zap!', { color: '#ffe27a', size: 30 }); }
    }
  }

  play(dt) {
    const W = app.W;
    this.steer = approach(this.steer, this.readSteer(), dt, 0.08);
    this.wheel = approach(this.wheel, this.steer, dt, 0.05);
    for (const e of app.input.events) if (e.type === 'pinchStart' || e.type === 'peace' || (e.type === 'blink' && e.key) || e.type === 'thumbsUp') this.useItem();

    if (this.countdown > 0) {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      if (Math.ceil(this.countdown) !== before) app.audio.chime(this.countdown <= 0 ? 1318 : 659, { vel: 0.4, bright: 1, dur: 0.6 });
      return;
    }
    if (this.finished) { this.finishT += dt; this.speed = approach(this.speed, MAX * 0.4, dt, 0.6); }
    else this.raceT += dt;

    const seg = this.segAt(this.pos), pct = this.speed / MAX, d = dt * 2 * pct;
    this.boostT = Math.max(0, this.boostT - dt); this.shieldT = Math.max(0, this.shieldT - dt); this.bumpT = Math.max(0, this.bumpT - dt);
    this.x += this.steer * d * 1.1;
    this.x -= d * pct * seg.curve * CENTRIFUGAL;
    this.x = clamp(this.x, -2.2, 2.2);
    const top = MAX * (this.boostT > 0 ? 1.4 : 1);
    if (Math.abs(this.x) > 1.05) this.speed = approach(this.speed, OFFROAD, dt, 0.4);
    else this.speed = Math.min(top, this.speed + ACCEL * dt * (this.boostT > 0 ? 2 : 1));
    if (this.boostT <= 0 && this.speed > MAX) this.speed = approach(this.speed, MAX, dt, 0.5);
    this.skyX += seg.curve * pct * dt * 0.02;

    const prev = this.pos;
    this.pos += this.speed * dt;
    if (this.pos >= this.trackLen) {
      this.pos -= this.trackLen;
      if (!this.finished) {
        this.lap++;
        if (this.lap > LAPS) this.finishRace();
        else { app.audio.victory(); app.fx.text(W / 2, app.H * 0.3, this.lap === LAPS ? 'FINAL LAP!' : `LAP ${this.lap}`, { color: this.accent, size: 36, dur: 1.6 }); }
      }
    }
    // things on the segments we just crossed
    for (let z = prev; z < prev + this.speed * dt + 1; z += SEG) {
      const s = this.segAt(z);
      if (s.boost && Math.abs(this.x) < 0.6) { this.boostT = Math.max(this.boostT, 1.2); app.audio.whoosh(1); }
      if (s.coins) for (const c of s.coins) if (!c.got && Math.abs(c.x - this.x) < 0.3) { c.got = true; this.coins++; this.score += 10; app.audio.chime(1318 + (this.coins % 5) * 80, { vel: 0.25, dur: 0.5 }); }
      if (s.box) for (const b of s.box) if (b.away <= 0 && Math.abs(b.x - this.x) < 0.28) { b.away = 3; if (!this.item) { this.item = pick(ITEMS); app.audio.select(); } }
    }
    for (const s of this.segs) if (s.box) for (const b of s.box) b.away = Math.max(0, b.away - dt);

    // rivals: follow the racing line, ease off in curves, get stunned by sparks
    for (const r of this.rivals) {
      r.stun = Math.max(0, r.stun - dt);
      const rs = this.segAt(r.z);
      const want = r.speed * (1 - Math.min(0.25, Math.abs(rs.curve) * 0.05)) * (r.stun > 0 ? 0.35 : 1) * (this.finished ? 0.6 : 1);
      r.z += want * dt;
      if (r.z >= this.trackLen) { r.z -= this.trackLen; r.lap++; }
      r.x = approach(r.x, clamp(-rs.curve * 0.12 + Math.sin(r.z * 0.0004 + r.speed) * 0.35, -0.8, 0.8), dt, 1.2);
      // bump
      const dz = ((r.z - this.pos) % this.trackLen + this.trackLen) % this.trackLen;
      if ((dz < SEG * 0.8 || dz > this.trackLen - SEG * 0.3) && Math.abs(r.x - this.x) < 0.32 && this.bumpT <= 0 && !this.finished) {
        this.bumpT = 0.6;
        if (this.shieldT > 0) { r.stun = 1; r.x += Math.sign(r.x - this.x || 1) * 0.4; app.audio.shatter(0, 0.4); }
        else { this.speed *= 0.55; this.x += Math.sign(this.x - r.x || 1) * 0.25; app.audio.thump(0.8); app.fx.shake = 0.5; }
      }
    }
    const me = this.total(this.pos, this.lap);
    this.place = 1 + this.rivals.filter((r) => this.total(r.z, r.lap) > me).length;
    if (!this.finished) this.score = this.coins * 10 + Math.floor(me / SEG);
  }

  finishRace() {
    this.finished = true; this.finishT = 0;
    const bonus = (7 - this.place) * 1000 + Math.max(0, Math.round((240 - this.raceT) * 10));
    this.score += bonus;
    app.audio.victory(); app.fx.flash('#ffe27a', 0.35);
    app.fx.text(app.W / 2, app.H * 0.3, `FINISHED ${this.ordinal(this.place).toUpperCase()}!`, { color: '#ffe27a', size: 42, dur: 2.5 });
  }

  isOver() { return this.finished && this.finishT > 2.6; }
  ordinal(n) { return n + (['th', 'st', 'nd', 'rd'][n] || 'th'); }
  resultTitle() { return `${this.ordinal(this.place).toUpperCase()} PLACE · ${this.coins} COINS`; }
  resultExtra() { return `Race time ${this.raceT.toFixed(1)} s`; }

  // ------------------------------------------------------------------ render
  project(wx, wy, wz, camX, camY, camZ) {
    const cz = wz - camZ, s = DEPTH / Math.max(cz, 1);
    return { x: app.W / 2 + s * (wx - camX) * app.W / 2, y: app.H / 2 - s * (wy - camY) * app.H / 2, w: s * ROAD * app.W / 2, s, cz };
  }

  drawBack(ctx) {
    if (this.state === 'intro') return;
    const W = app.W, H = app.H, t = app.t, acc = this.accent;
    // space backdrop: planets drift opposite to the curves
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    sky.addColorStop(0, 'rgba(8, 6, 30, 0.5)'); sky.addColorStop(1, 'rgba(90, 30, 120, 0.35)');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    for (const [fx, fy, r, col] of [[0.2, 0.18, 60, '#ff9be8'], [0.75, 0.12, 34, '#7ff3ff'], [0.55, 0.28, 90, '#b69bff']]) {
      const x = ((fx - this.skyX) % 1 + 1) % 1 * W;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; ctx.drawImage(app.particles.spriteCanvas(col), x - r * 2.4, H * fy - r * 2.4, r * 4.8, r * 4.8); ctx.restore();
      ctx.fillStyle = rgba(col, 0.75); ctx.beginPath(); ctx.arc(x, H * fy, r * 0.5, 0, TAU); ctx.fill();
    }
    // road
    const base = this.segAt(this.pos), pct = (this.pos % SEG) / SEG;
    const camY = base.y0 + (base.y1 - base.y0) * pct + CAM_H, camX = this.x * ROAD;
    let x = 0, dx = -base.curve * pct, maxy = H;
    const drawn = [];
    for (let n = 0; n < DRAW; n++) {
      const s = this.segs[(base.index + n) % this.segs.length];
      const looped = s.index < base.index, z0 = s.index * SEG + (looped ? this.trackLen : 0);
      const p1 = this.project(0, s.y0, z0, camX - x, camY, this.pos);
      const p2 = this.project(0, s.y1, z0 + SEG, camX - x - dx, camY, this.pos);
      x += dx; dx += s.curve;
      s.clip = maxy; s.p1 = p1;
      if (p1.cz <= DEPTH || p2.y >= p1.y || p2.y >= maxy) continue;
      const band = Math.floor(s.index / 3) % 2;
      // space "verge"
      ctx.fillStyle = band ? 'rgba(30, 18, 70, 0.9)' : 'rgba(22, 12, 56, 0.9)'; ctx.fillRect(0, p2.y, W, p1.y - p2.y + 1);
      const quad = (x1, y1, w1, x2, y2, w2, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x1 - w1, y1); ctx.lineTo(x2 - w2, y2); ctx.lineTo(x2 + w2, y2); ctx.lineTo(x1 + w1, y1); ctx.closePath(); ctx.fill(); };
      quad(p1.x, p1.y, p1.w * 1.15, p2.x, p2.y, p2.w * 1.15, band ? '#ff7ad9' : '#7ff3ff');
      quad(p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, s.boost ? (Math.floor(t * 8) % 2 ? '#ffe27a' : '#ffb347') : band ? '#3a2a7a' : '#34266e');
      if (band) for (const lx of [-1 / 3, 1 / 3]) quad(p1.x + p1.w * lx, p1.y, p1.w * 0.015, p2.x + p2.w * lx, p2.y, p2.w * 0.015, 'rgba(255,255,255,0.6)');
      if (s.index === 0) quad(p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, Math.floor(t * 4) % 2 ? '#ffffff' : '#1b1840');
      maxy = p2.y;
      drawn.push(s);
    }
    // sprites back to front: scenery, boxes, coins, rivals
    const rivalsBySeg = new Map();
    for (const r of this.rivals) { const s = this.segAt(r.z); if (!rivalsBySeg.has(s.index)) rivalsBySeg.set(s.index, []); rivalsBySeg.get(s.index).push(r); }
    for (let i = drawn.length - 1; i >= 0; i--) {
      const s = drawn[i], p = s.p1, sc = p.w / ROAD;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, s.clip); ctx.clip();
      for (const sp of s.sprites) {
        const sx = p.x + sp.x * p.w, h = 900 * sc * (sp.kind === 'arch' ? 1.4 : 1);
        if (sp.kind === 'arch') { ctx.strokeStyle = rgba(sp.hue, 0.8); ctx.lineWidth = Math.max(2, 60 * sc); ctx.beginPath(); ctx.arc(p.x, p.y, p.w * 1.3, Math.PI, TAU); ctx.stroke(); }
        else { ctx.fillStyle = rgba(sp.hue, 0.85); ctx.beginPath(); ctx.moveTo(sx, p.y - h); ctx.lineTo(sx + h * 0.22, p.y); ctx.lineTo(sx - h * 0.22, p.y); ctx.closePath(); ctx.fill(); }
      }
      if (s.box) for (const b of s.box) if (b.away <= 0) {
        const bx = p.x + b.x * p.w, r = 260 * sc;
        ctx.save(); ctx.translate(bx, p.y - r * 1.4); ctx.rotate(t * 2);
        roundRect(ctx, -r / 2, -r / 2, r, r, r * 0.2); ctx.fillStyle = `hsla(${(t * 120) % 360},100%,65%,0.85)`; ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.font = `800 ${Math.max(6, r * 0.6)}px Sora, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, r * 0.04);
        ctx.restore();
      }
      if (s.coins) for (const c of s.coins) if (!c.got) { const r = 120 * sc; ctx.fillStyle = '#ffd36e'; ctx.beginPath(); ctx.ellipse(p.x + c.x * p.w, p.y - r * 2, r * Math.abs(Math.cos(t * 4)) + 1, r, 0, 0, TAU); ctx.fill(); }
      for (const r of rivalsBySeg.get(s.index) || []) this.drawKart(ctx, p.x + r.x * p.w, p.y, sc * 4.2, r.color, 0, r.stun > 0);
      ctx.restore();
    }
    // the player's kart
    const bounce = Math.sin(t * 30) * (this.speed / MAX) * 1.5;
    this.drawKart(ctx, W / 2, H - 70 + bounce, Math.min(W, H) / 900, acc, this.steer, false, true);
    if (this.boostT > 0) { // speed lines
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (let k = 0; k < 26; k++) {
        const a = (k / 26) * TAU, q = (t * 2 + ((k * 0.618) % 1)) % 1, r0 = q * q * W * 0.7;
        ctx.strokeStyle = rgba('#ffe27a', 0.4 * q); ctx.lineWidth = 1 + q * 3;
        ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * r0, H * 0.45 + Math.sin(a) * r0 * 0.6); ctx.lineTo(W / 2 + Math.cos(a) * (r0 + 60), H * 0.45 + Math.sin(a) * (r0 + 60) * 0.6); ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** A rounded hover-kart seen from behind; the player's carries Lumo. */
  drawKart(ctx, x, y, s, color, steer, stunned, player = false) {
    if (s < 0.03) return;
    const t = app.t, w = 150 * s, h = 60 * s;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(steer * 0.12 + (stunned ? Math.sin(t * 30) * 0.3 : 0));
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 4 * s, w * 0.6, h * 0.25, 0, 0, TAU); ctx.fill();
    // exhaust glow
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const fl = player && this.boostT > 0 ? 2.2 : 1;
    for (const side of [-1, 1]) ctx.drawImage(app.particles.spriteCanvas(player && this.boostT > 0 ? '#ffe27a' : '#7ff3ff'), side * w * 0.28 - 18 * s * fl, -h * 0.35 - 18 * s * fl, 36 * s * fl, 36 * s * fl);
    ctx.restore();
    // wheels + body
    ctx.fillStyle = '#1b1840';
    for (const side of [-1, 1]) { roundRect(ctx, side * w * 0.5 - (side > 0 ? 26 * s : 0), -h * 0.75, 26 * s, h * 0.75, 8 * s); ctx.fill(); }
    const g = ctx.createLinearGradient(0, -h * 1.1, 0, 0);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, color); g.addColorStop(1, rgba(color, 0.7));
    roundRect(ctx, -w * 0.42, -h * 1.05, w * 0.84, h * 0.8, 18 * s); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = Math.max(1, 2 * s); ctx.stroke();
    ctx.fillStyle = 'rgba(20,16,50,0.7)'; roundRect(ctx, -w * 0.22, -h * 0.85, w * 0.44, h * 0.3, 8 * s); ctx.fill();
    if (player) drawLumo(ctx, 0, -h * 1.45, 26 * s, { dir: Math.sign(steer) * (Math.abs(steer) > 0.2 ? 1 : 0), accent: color, glow: false, scarf: false, mood: this.boostT > 0 ? 'wow' : 'happy' });
    else { ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(0, -h * 1.35, 20 * s, 0, TAU); ctx.fill(); }
    if (player && this.shieldT > 0) { ctx.strokeStyle = rgba('#7ff3ff', 0.6 + 0.3 * Math.sin(t * 10)); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, -h * 0.8, w * 0.7, h * 1.3, 0, 0, TAU); ctx.stroke(); }
    if (stunned) { ctx.fillStyle = '#ffe27a'; for (let k = 0; k < 3; k++) { const a = t * 6 + k * 2.1; ctx.beginPath(); ctx.arc(Math.cos(a) * 30 * s, -h * 1.9 + Math.sin(a) * 8 * s, 5 * s, 0, TAU); ctx.fill(); } }
    ctx.restore();
  }

  drawHud(ctx) {
    const W = app.W, H = app.H, acc = this.accent;
    glowText(ctx, this.ordinal(this.place).toUpperCase(), 40, 120, { size: 44, align: 'left', glow: acc });
    glowText(ctx, `LAP ${Math.min(this.lap, LAPS)} / ${LAPS}`, W / 2, 70, { size: 26, glow: acc });
    glowText(ctx, `● ${this.coins}   ·   ${fmt(this.score)} pts   ·   ${Math.round(this.speed / MAX * 180)} km/h`, W / 2, HUD_SUB_Y - 30, { size: 11, font: 'Inter', weight: 700, spacing: 2, color: 'rgba(255,255,255,0.75)', blur: 0 });
    // item slot
    const ix = 64, iy = H - 150;
    ctx.save(); roundRect(ctx, ix - 34, iy - 34, 68, 68, 20); ctx.fillStyle = 'rgba(12,10,36,0.6)'; ctx.fill(); ctx.strokeStyle = this.item ? acc : 'rgba(255,255,255,0.2)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    if (this.item) glowText(ctx, { boost: '🚀', shield: '🛡', spark: '⚡' }[this.item], ix, iy, { size: 30, blur: 0 });
    // steering wheel: turns with your hands, so the gesture explains itself
    const wx = W - 90, wy = H - 160, R = 38;
    ctx.save(); ctx.translate(wx, wy); ctx.rotate(this.wheel * 1.1);
    ctx.strokeStyle = this.wheelHands ? acc : 'rgba(255,255,255,0.45)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-R, 0); ctx.lineTo(R, 0); ctx.moveTo(0, 0); ctx.lineTo(0, R); ctx.stroke();
    ctx.restore();
    if (this.countdown > 0) {
      const n = Math.ceil(this.countdown);
      glowText(ctx, n > 3 ? 'READY' : n > 0 ? String(n) : 'GO!', W / 2, H * 0.36, { size: 84, glow: acc, blur: 30 });
    }
  }
}
