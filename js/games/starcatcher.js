// ---------------------------------------------------------------------------
// STAR CATCHER · easy-reflex arcade
// Stars fall down the left and right lanes. When a star glows inside a
// lane's catch basket, catch it with whichever move is easiest for you:
// tilt your head toward that side, open your palm on that side of the
// screen, or wink that eye. Meteors tumble down the centre toward your
// home crystal: open your mouth wide (or blink both eyes) to fire the
// centre shield burst. No winking required.
// Timing windows are generous, a missed star only resets the streak, and
// streaks of 5 / 10 / 15 set off celebrations.
// Keys: Z or ← catch left · X or → catch right · Space shield.
// Touch / mouse: tap the left, centre or right third of the screen.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { GameBase, HUD_SUB_Y } from './base.js';
import { drawCue, drawKey } from '../ui/signifiers.js';
import { glowText } from '../ui/draw.js';
import { TAU, rand, clamp, rgba, pick } from '../core/util.js';

const WINDOW = 95;         // ± px around the basket line that counts as a catch
const STAR_COLORS = ['#ffe27a', '#fff3b8', '#ffd36e', '#ffffff'];
const CHEERS = ['Stellar!', 'Starry-eyed!', 'Wink-tastic!', 'Supernova!', 'Cosmic!'];

export class StarCatcherGame extends GameBase {
  constructor() {
    super('starcatcher', 'Star Catcher');
    this.duration = 60; this.maxLives = 3;
    this.allow = { swipe: false, runes: false, faceMagic: false, chimes: false, overlays: true, scatter: false, snapshot: false, doubleBlink: false, tilt: false };
    this.cues = [{ cue: 'tilt', key: 'Z / X' }, { cue: 'open', key: 'Tap a side' }, { cue: 'mouth', key: 'Space' }];
    this.needsHand = false;
  }

  playCoach() {
    return app.mode === 'camera'
      ? { icon: 'tilt', html: '<b>Tilt your head</b> (or open your palm) toward a star in the basket<small>Open your mouth wide to shield your crystal from meteors</small>' }
      : { icon: 'pinch', html: '<b>Z / X</b> (or tap a side) to catch · <b>Space</b> (or tap the middle) shields' };
  }

  lanes() { const W = app.W; return { L: W * 0.22, C: W * 0.5, R: W * 0.78 }; }
  get catchY() { return app.H * 0.66; }
  /** Home crystal, kept clear of the dock. */
  get homeY() { return app.H - 135; }

  reset() {
    this.items = []; this.spawnT = 1; this.meteorT = 4; this.caught = 0;
    this.basket = { L: 0, R: 0 }; this.shield = 0; this.shieldCool = 0; this.whiff = { L: 0, R: 0 };
    this.speed = 150; this.tiltSide = 0; this.palmOpen = new Map();
  }

  spawnStar() {
    const side = Math.random() < 0.5 ? 'L' : 'R';
    this.items.push({ kind: 'star', side, x: this.lanes()[side] + rand(-14, 14), y: -30, vy: this.speed * rand(0.9, 1.1), r: 20, rot: rand(TAU), col: pick(STAR_COLORS), dead: false });
  }
  spawnMeteor() {
    const { C } = this.lanes();
    this.items.push({ kind: 'meteor', side: 'C', x: C + rand(-app.W * 0.08, app.W * 0.08), y: -40, vx: rand(-20, 20), vy: this.speed * 0.75, r: 22, rot: rand(TAU), dead: false });
  }

  play(dt) {
    const inp = app.input, W = app.W, H = app.H, cy = this.catchY;
    const elapsed = this.duration - this.time;
    this.speed = 150 + elapsed * 2.4 + this.combo * 1.5;

    // spawning: stars steadily, meteors after a gentle first stretch
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawnStar(); this.spawnT = clamp(1.25 - elapsed * 0.01, 0.55, 1.25) * rand(0.75, 1.25); }
    this.meteorT -= dt;
    if (this.meteorT <= 0 && elapsed > 6) { this.spawnMeteor(); this.meteorT = clamp(5 - elapsed * 0.04, 2.2, 5) * rand(0.8, 1.3); }

    // input → actions: head tilt (edge-triggered), open palm on a side, winks, taps, keys
    const acts = [];
    const tilt = inp.face.present ? inp.vals.tilt : 0;
    const side = tilt < -0.2 ? -1 : tilt > 0.2 ? 1 : Math.abs(tilt) < 0.1 ? 0 : this.tiltSide;
    if (side !== this.tiltSide && side !== 0) acts.push(side < 0 ? 'L' : 'R');
    this.tiltSide = side;
    for (const h of inp.hands) {
      const was = this.palmOpen.get(h) || false, now = h.present && h.open;
      if (now && !was) acts.push(h.palmX < W / 2 ? 'L' : 'R');
      this.palmOpen.set(h, now);
    }
    for (const e of inp.events) {
      if (e.type === 'winkL') acts.push('L');
      else if (e.type === 'winkR') acts.push('R');
      else if (e.type === 'blink' || e.type === 'doubleBlink' || e.type === 'mouthOpen') acts.push('C');
      else if (e.type === 'swipe' && e.key) acts.push(e.dir === 'left' ? 'L' : e.dir === 'right' ? 'R' : null);
      else if (e.type === 'pinchStart' && e.hand === 'Mouse') acts.push(e.x < W / 3 ? 'L' : e.x > (W * 2) / 3 ? 'R' : 'C');
    }
    for (const a of acts) if (a === 'C') this.fireShield(); else if (a) this.tryCatch(a);

    this.basket.L = Math.max(0, this.basket.L - dt * 3); this.basket.R = Math.max(0, this.basket.R - dt * 3);
    this.whiff.L = Math.max(0, this.whiff.L - dt * 3); this.whiff.R = Math.max(0, this.whiff.R - dt * 3);
    this.shield = Math.max(0, this.shield - dt * 1.6);
    this.shieldCool -= dt;

    for (const it of this.items) {
      if (it.dead) continue;
      it.y += it.vy * dt; it.x += (it.vx || 0) * dt; it.rot += dt * (it.kind === 'star' ? 1.5 : 3);
      if (it.kind === 'star' && it.y > cy + WINDOW + 10) {
        it.dead = true; this.breakCombo();
        app.particles.emit({ x: it.x, y: it.y, count: 8, speed: [20, 80], colors: ['#8a86b8'], raw: true });
      }
      if (it.kind === 'meteor' && it.y > this.homeY) {
        it.dead = true; this.loseLife(it.x, this.homeY - 40);
        app.particles.emit({ x: it.x, y: this.homeY, count: 40, speed: [80, 320], colors: ['#ff7a4a', '#ffb46b', '#5b2a1a'], raw: true });
      }
    }
    this.items = this.items.filter((i) => !i.dead);
  }

  tryCatch(side) {
    const cy = this.catchY;
    let best = null;
    for (const it of this.items) if (it.kind === 'star' && it.side === side && Math.abs(it.y - cy) < WINDOW && (!best || Math.abs(it.y - cy) < Math.abs(best.y - cy))) best = it;
    if (!best) { this.whiff[side] = 1; app.audio.tick(side === 'L' ? -0.6 : 0.6, 0.15); return; }
    best.dead = true;
    this.caught++; this.hit();
    const perfect = Math.abs(best.y - cy) < 30;
    const gain = (perfect ? 15 : 10) * this.mult;
    this.score += gain;
    this.basket[side] = 1;
    app.particles.emit({ x: best.x, y: best.y, count: 30, speed: [80, 300], life: [0.5, 1.1], size: [1.5, 4], colors: [best.col, '#ffffff'], kind: 5, raw: true });
    app.fx.text(best.x, best.y - 30, perfect ? `Perfect +${gain}` : `+${gain}`, { color: best.col, size: perfect ? 20 : 17 });
    app.audio.chime(app.audio.noteFromY(clamp(1 - this.combo / 16), 1) * (side === 'L' ? 1 : 1.5), { pan: side === 'L' ? -0.6 : 0.6, vel: 0.45, bright: 0.9, dur: 1.4 });
    if (this.combo > 0 && this.combo % 5 === 0) this.celebrate();
  }

  fireShield() {
    if (this.shieldCool > 0) return;
    this.shieldCool = 0.7; this.shield = 1;
    const { C } = this.lanes(), H = app.H, cy = this.homeY;
    app.audio.whoosh(1); app.audio.boom(0.4);
    app.fx.shockwave(C, cy, { color: '#7ff3ff', r1: H * 0.75, dur: 0.7, width: 4 });
    let n = 0;
    for (const it of this.items) {
      if (it.kind !== 'meteor' || it.y < H * 0.18) continue;
      it.dead = true; n++;
      this.score += 20 * this.mult;
      app.particles.emit({ x: it.x, y: it.y, count: 36, speed: [100, 380], colors: ['#ffb46b', '#ffffff', '#7ff3ff'], kind: 3, raw: true });
      app.fx.text(it.x, it.y - 24, `+${20 * this.mult}`, { color: '#7ff3ff', size: 16 });
    }
    if (n) { this.hit(); app.audio.shatter(0, 0.5); }
  }

  celebrate() {
    const W = app.W, H = app.H, big = this.combo % 10 === 0;
    app.fx.text(W / 2, H * 0.3, pick(CHEERS), { color: '#ffe27a', size: big ? 40 : 30, dur: 1.4 });
    const hues = ['#ff6b8b', '#ffd36e', '#7ff3ff', '#9dff9a', '#b69bff', '#ff9be8'];
    for (let i = 0; i < (big ? 160 : 80); i++) app.particles.spawn(rand(W), -10, rand(-60, 60), rand(120, 420), rand(1.4, 2.6), rand(2, 4.5), pick(hues), 5, 0.6, 0.99, 0);
    app.audio.victory();
  }

  resultTitle() { return `${this.caught} STARS CAUGHT`; }

  // ------------------------------------------------------------------ draw
  drawBack(ctx) {
    if (this.state === 'intro') return;
    const t = app.t, H = app.H, cy = this.catchY, ln = this.lanes(), cam = app.mode === 'camera';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // lanes
    for (const [side, x] of [['L', ln.L], ['R', ln.R]]) {
      const g = ctx.createLinearGradient(x, 0, x, H);
      g.addColorStop(0, rgba('#ffe27a', 0)); g.addColorStop(0.7, rgba('#ffe27a', 0.06)); g.addColorStop(1, rgba('#ffe27a', 0));
      ctx.fillStyle = g; ctx.fillRect(x - 60, 0, 120, H);
      // basket
      const ready = this.items.some((i) => i.kind === 'star' && i.side === side && Math.abs(i.y - cy) < WINDOW);
      const k = this.basket[side];
      ctx.strokeStyle = rgba(ready ? '#ffffff' : '#ffe27a', 0.35 + (ready ? 0.45 : 0) + k * 0.2); ctx.lineWidth = ready ? 3 : 1.5;
      ctx.beginPath(); ctx.ellipse(x, cy, 62 + k * 14, 18 + k * 4, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = rgba('#ffe27a', 0.12); ctx.lineWidth = 1; ctx.setLineDash([3, 8]);
      ctx.beginPath(); ctx.moveTo(x - 60, cy - WINDOW); ctx.lineTo(x + 60, cy - WINDOW); ctx.moveTo(x - 60, cy + WINDOW); ctx.lineTo(x + 60, cy + WINDOW); ctx.stroke();
      ctx.setLineDash([]);
      if (this.whiff[side] > 0) { ctx.strokeStyle = rgba('#8a86b8', this.whiff[side] * 0.6); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, cy, 70, 22, 0, 0, TAU); ctx.stroke(); }
    }
    ctx.restore();
    // lane signifiers under the baskets
    for (const [side, x] of [['L', ln.L], ['R', ln.R]]) {
      const ready = this.items.some((i) => i.kind === 'star' && i.side === side && Math.abs(i.y - cy) < WINDOW);
      ctx.save(); if (side === 'L') { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
      drawCue(ctx, 'tilt', x, cy + 62, 16, t, { anim: ready, alpha: ready ? 0.95 : 0.4, glow: ready, accent: '#ffe27a' });
      ctx.restore();
      if (!cam) drawKey(ctx, side === 'L' ? 'Z' : 'X', x + 36, cy + 62, 20, { alpha: 0.6 });
    }
    // home crystal + shield
    const hx = ln.C, hy = this.homeY;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(app.particles.spriteCanvas('#7ff3ff'), hx - 50, hy - 50, 100, 100);
    ctx.fillStyle = rgba('#dffbff', 0.9);
    ctx.beginPath(); ctx.moveTo(hx, hy - 22); ctx.lineTo(hx + 13, hy); ctx.lineTo(hx, hy + 22); ctx.lineTo(hx - 13, hy); ctx.closePath(); ctx.fill();
    if (this.shield > 0) {
      ctx.strokeStyle = rgba('#7ff3ff', this.shield); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(hx, hy, 60 + (1 - this.shield) * 240, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    } else if (this.shieldCool <= 0) {
      ctx.strokeStyle = rgba('#7ff3ff', 0.25 + 0.15 * Math.sin(t * 4)); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(hx, hy, 44, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    }
    ctx.restore();
    // items
    for (const it of this.items) {
      ctx.save();
      ctx.translate(it.x, it.y);
      if (it.kind === 'star') {
        const inWin = Math.abs(it.y - cy) < WINDOW;
        ctx.globalCompositeOperation = 'lighter';
        const g = it.r * (inWin ? 3.2 : 2.4);
        ctx.drawImage(app.particles.spriteCanvas(it.col), -g, -g, g * 2, g * 2);
        ctx.rotate(it.rot);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2, r = i % 2 ? it.r * 0.42 : it.r; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill();
      } else {
        // meteor: tail, rocky body, hot rim
        ctx.globalCompositeOperation = 'lighter';
        const tail = ctx.createLinearGradient(0, 0, 0, -110);
        tail.addColorStop(0, rgba('#ff8a4a', 0.55)); tail.addColorStop(1, rgba('#ff8a4a', 0));
        ctx.fillStyle = tail; ctx.beginPath(); ctx.moveTo(-it.r * 0.8, 0); ctx.lineTo(0, -110); ctx.lineTo(it.r * 0.8, 0); ctx.closePath(); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.rotate(it.rot);
        ctx.fillStyle = '#3a2016'; ctx.strokeStyle = '#ffb46b'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, r = it.r * (i % 3 ? 1 : 0.78); i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
    // shield signifier when a meteor is near
    const danger = this.items.some((i) => i.kind === 'meteor' && i.y > H * 0.35);
    if (danger) {
      drawCue(ctx, 'mouth', hx + 64, hy - 6, 14, t, { accent: '#7ff3ff', alpha: 0.9 });
      if (!cam) drawKey(ctx, 'Space', hx + 64, hy + 22, 18, { alpha: 0.7 });
    }
  }

  drawFront(ctx) {
    if (this.state === 'play' && this.combo >= 3) glowText(ctx, `★ ${this.combo} streak`, app.W / 2, HUD_SUB_Y, { size: 11, font: 'Inter', weight: 600, spacing: 2, color: '#ffe27a', blur: 6 });
    super.drawFront(ctx);
  }
}
