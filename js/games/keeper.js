// ---------------------------------------------------------------------------
// COMET KEEPER · block-and-dodge body game
// Comets rocket out of deep space toward you. Each one telegraphs where it
// will land with a glowing target ring; get a palm (or both, for golden
// comets) onto the ring when the comet arrives to block it. Dark meteors
// aim at your head: move your body out of their target zone to dodge.
// Blocks build a combo; misses and head hits cost a light (5 lights).
//
// Camera: hands = keeper gloves, head = what dark meteors aim at (the
//         camera mirror is shown faintly so you can see yourself).
// Mouse / touch: the pointer is your glove; ← → (A / D) move your "head"
//         marker to dodge dark meteors.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { GameBase, HUD_SUB_Y } from './base.js';
import { glowText } from '../ui/draw.js';
import { TAU, rand, clamp, rgba, dist } from '../core/util.js';

export class KeeperGame extends GameBase {
  constructor() {
    super('keeper', 'Comet Keeper');
    this.duration = 70; this.maxLives = 5;
    this.allow = { swipe: false, runes: false, faceMagic: false, chimes: false, overlays: true, scatter: false, snapshot: false, gravity: false, puff: false, tilt: false, barrier: false, doubleBlink: false };
    this.cues = [{ cue: 'open', key: 'Move' }, { cue: 'twoPalms', cam: true }, { cue: 'shake', key: '← →' }];
  }

  playCoach() {
    return app.mode === 'camera'
      ? { icon: 'palm', html: '<b>Palm on the ring</b> as the comet lands · <b>move your head</b> away from dark meteors<small>Golden comets need both hands</small>' }
      : { icon: 'pinch', html: 'Put the <b>pointer on the ring</b> as the comet lands<small>← → move your head marker away from dark meteors</small>' };
  }

  enter() {
    super.enter();
    this.prevMirror = app.mirror.mode;
    if (app.mode === 'camera' && app.mirror.mode === 'void') app.mirror.setMode('ethereal');
  }
  exit() { super.exit(); if (this.prevMirror) app.mirror.setMode(this.prevMirror); }

  reset() { this.comets = []; this.spawnT = 1; this.blocks = 0; this.headX = app.W / 2; this.flight = 1.7; }

  /** Where the player's head is (face, or the keyboard marker). */
  head() {
    const f = app.input.face;
    if (app.mode === 'camera' && f.present) return { x: f.x, y: f.y, r: Math.max(60, f.width * 0.75) };
    return { x: this.headX, y: app.H * 0.38, r: 70 };
  }

  spawn() {
    const W = app.W, H = app.H, elapsed = this.duration - this.time, roll = Math.random();
    const kind = roll < Math.min(0.28, 0.1 + elapsed * 0.003) ? 'dark' : roll > 0.93 ? 'gold' : 'comet';
    let tx, ty;
    if (kind === 'dark') { const h = this.head(); tx = h.x + rand(-40, 40); ty = h.y + rand(-20, 20); }
    else { tx = rand(W * 0.18, W * 0.82); ty = rand(H * 0.28, H * 0.72); }
    const ox = W / 2 + rand(-W * 0.15, W * 0.15), oy = H * 0.42 + rand(-H * 0.08, H * 0.08);
    this.comets.push({ kind, ox, oy, tx, ty, t: 0, T: this.flight * (kind === 'dark' ? 1.15 : 1), r: kind === 'gold' ? 70 : 54, hue: kind === 'gold' ? '#ffe27a' : kind === 'dark' ? '#7a3dff' : ['#7ff3ff', '#ff9be8', '#9dff9a'][(Math.random() * 3) | 0] });
  }

  /** Hand (glove) positions this frame. */
  gloves() {
    const inp = app.input, out = [];
    for (const h of inp.hands) if (h.present) out.push({ x: h.palmX, y: h.palmY });
    if (inp.mouseHand.present && (app.mode !== 'camera' || !out.length)) out.push({ x: inp.mouseHand.x, y: inp.mouseHand.y });
    return out;
  }

  play(dt) {
    const fb = app.input.fb, W = app.W;
    const kd = (fb.held('ArrowRight') || fb.held('KeyD') ? 1 : 0) - (fb.held('ArrowLeft') || fb.held('KeyA') ? 1 : 0);
    this.headX = clamp(this.headX + kd * W * 0.9 * dt, W * 0.15, W * 0.85);
    const elapsed = this.duration - this.time;
    this.flight = clamp(1.7 - elapsed * 0.009, 1.05, 1.7);
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawn(); this.spawnT = clamp(1.35 - elapsed * 0.009, 0.6, 1.35) * rand(0.8, 1.2); }
    const gloves = this.gloves();
    for (const c of this.comets) {
      c.t += dt;
      if (c.done || c.t < c.T) continue;
      c.done = true;
      if (c.kind === 'dark') {
        const h = this.head();
        if (dist(h.x, h.y, c.tx, c.ty) < h.r + 20 && elapsed < 8) { this.breakCombo(); app.audio.boom(0.5); app.fx.text(c.tx, c.ty - 90, 'Move away from the dark ones!', { color: '#c9a8ff', size: 16, font: 'Inter', weight: 700 }); }
        else if (dist(h.x, h.y, c.tx, c.ty) < h.r + 20) { this.loseLife(c.tx, c.ty - 60); app.audio.boom(0.7); app.fx.text(c.tx, c.ty - 90, 'Dodge the dark ones!', { color: '#c9a8ff', size: 16, font: 'Inter', weight: 700 }); }
        else { this.score += 30 * this.mult; this.hit(); app.fx.text(c.tx, c.ty, `Dodged! +${30 * this.mult}`, { color: '#c9a8ff', size: 18 }); app.audio.whoosh(1); }
        continue;
      }
      const near = gloves.filter((g) => dist(g.x, g.y, c.tx, c.ty) < c.r * 1.15).length;
      const need = c.kind === 'gold' && app.mode === 'camera' && app.input.hands.filter((h) => h.present).length >= 2 ? 2 : 1;
      if (near >= need) this.block(c);
      // Warm-up: the first few comets teach the ring without costing a light.
      else if (elapsed < 8) { this.breakCombo(); app.audio.miss(); app.fx.text(c.tx, c.ty - 50, 'Reach the ring!', { color: '#ffffff', size: 16, font: 'Inter', weight: 700 }); }
      else { this.loseLife(c.tx, c.ty - 50); app.fx.flash('#ffffff', 0.15); }
    }
    this.comets = this.comets.filter((c) => !c.done || c.t < c.T + 0.4);
  }

  block(c) {
    this.blocks++; this.hit();
    const gain = (c.kind === 'gold' ? 100 : 20) * this.mult;
    this.score += gain;
    app.audio.shatter((c.tx / app.W) * 2 - 1, 0.6); app.audio.thump(0.6);
    if (c.kind === 'gold') app.audio.victory();
    app.particles.emit({ x: c.tx, y: c.ty, count: c.kind === 'gold' ? 70 : 40, speed: [150, 520], life: [0.5, 1.1], size: [2, 5], colors: [c.hue, '#ffffff'], raw: true });
    app.fx.shockwave(c.tx, c.ty, { color: c.hue, r1: 160, dur: 0.5, width: 4 });
    app.fx.text(c.tx, c.ty - c.r - 10, c.kind === 'gold' ? `GOLDEN SAVE +${gain}` : `Save! +${gain}`, { color: c.hue, size: c.kind === 'gold' ? 24 : 18 });
    app.fx.shake = 0.4;
  }

  resultTitle() { return `${this.blocks} SAVES`; }

  drawBack(ctx) {
    if (this.state === 'intro') return;
    const t = app.t;
    // speed tunnel from the vanishing point
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const cx = app.W / 2, cy = app.H * 0.42;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * TAU, q = (t * 0.6 + (k * 0.37) % 1) % 1, r0 = q * q * app.W * 0.7;
      ctx.strokeStyle = rgba('#b69bff', 0.25 * q); ctx.lineWidth = 1 + q * 2;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.7); ctx.lineTo(cx + Math.cos(a) * (r0 + 40 * q), cy + Math.sin(a) * (r0 + 40 * q) * 0.7); ctx.stroke();
    }
    ctx.restore();
    // head marker (dark meteors aim here)
    const h = this.head(), danger = this.comets.some((c) => c.kind === 'dark' && !c.done);
    ctx.save(); ctx.strokeStyle = rgba(danger ? '#c9a8ff' : '#ffffff', danger ? 0.6 + 0.3 * Math.sin(t * 10) : 0.18); ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.stroke(); ctx.restore();
    // comets: target ring brightens as impact nears; comet grows from deep space
    for (const c of this.comets) {
      const p = clamp(c.t / c.T), e = p * p;
      const x = c.ox + (c.tx - c.ox) * e, y = c.oy + (c.ty - c.oy) * e, r = 6 + c.r * e;
      if (!c.done) {
        ctx.save();
        ctx.strokeStyle = rgba(c.hue, 0.25 + p * 0.7); ctx.lineWidth = 2 + p * 3;
        ctx.beginPath(); ctx.arc(c.tx, c.ty, c.r * (1.6 - p * 0.6), 0, TAU); ctx.stroke();
        if (c.kind === 'gold') { ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.arc(c.tx, c.ty, c.r * 1.9, 0, TAU); ctx.stroke(); }
        ctx.restore();
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        // tail back toward the origin
        const tl = ctx.createLinearGradient(x, y, c.ox, c.oy);
        tl.addColorStop(0, rgba(c.hue, 0.6)); tl.addColorStop(1, rgba(c.hue, 0));
        ctx.strokeStyle = tl; ctx.lineWidth = r * 0.8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (c.ox - x) * 0.35, y + (c.oy - y) * 0.35); ctx.stroke();
        ctx.drawImage(app.particles.spriteCanvas(c.hue), x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
        ctx.restore();
        ctx.fillStyle = c.kind === 'dark' ? '#1a0a3a' : '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, TAU); ctx.fill();
        if (c.kind === 'dark') { ctx.strokeStyle = '#b48cff'; ctx.lineWidth = 2; ctx.stroke(); }
      }
    }
    // gloves
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const g of this.gloves()) {
      ctx.drawImage(app.particles.spriteCanvas(this.accent), g.x - 46, g.y - 46, 92, 92);
      ctx.strokeStyle = rgba('#ffffff', 0.8); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.x, g.y, 30, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  drawFront(ctx) {
    if (this.state === 'play') glowText(ctx, `${this.blocks} saves`, app.W / 2, HUD_SUB_Y, { size: 11, font: 'Inter', weight: 700, spacing: 2, color: 'rgba(255,255,255,0.7)', blur: 0 });
    super.drawFront(ctx);
  }
}

