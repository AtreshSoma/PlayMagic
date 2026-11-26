// ---------------------------------------------------------------------------
// GESTURE GATE · fast-paced pose reflex
// Glowing gesture tokens glide in from the edges toward a central portal
// ring. Once a token enters the match zone (the faint outer ring), make its
// gesture to shatter it into light: Open Palm, Peace, Fist, Thumbs Up, Smile,
// Open Mouth (no winks: many children can't wink yet). Earlier matches score more; streaks build a combo
// multiplier. If a token reaches the portal you lose a light.
//
// Difficulty adapts continuously: every match nudges speed up, every miss
// eases it back down, so a young child and an adult both land in flow.
// Without a camera, a pose pad appears (tap / click) and keys work too:
// H open · P peace · F fist · T thumbs · 1 smile · 2 open mouth.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { GameBase, HUD_SUB_Y } from './base.js';
import { drawCue, drawKey } from '../ui/signifiers.js';
import { glowText } from '../ui/draw.js';
import { TAU, rand, pick, clamp, rgba, angleWrap } from '../core/util.js';

const POSES = {
  open: { cue: 'open', key: 'H', color: '#7ff3ff' },
  peace: { cue: 'peace', key: 'P', color: '#ff9be8' },
  fist: { cue: 'fist', key: 'F', color: '#ffb46b' },
  thumbsUp: { cue: 'thumbsUp', key: 'T', color: '#9dff9a' },
  smile: { cue: 'smile', key: '1', color: '#ffe27a', face: true },
  mouth: { cue: 'mouth', key: '2', color: '#b69bff', face: true },
};
const ORDER = ['open', 'peace', 'fist', 'thumbsUp', 'smile', 'mouth'];
const LATCH = 0.3;      // seconds a one-shot (wink / pad tap) stays "on"
const COOLDOWN = 0.32;  // a pose must wait this long before matching again

export class GestureGateGame extends GameBase {
  constructor() {
    super('gate', 'Gesture Gate');
    this.duration = 75; this.maxLives = 5;
    this.allow = { swipe: false, runes: false, faceMagic: false, chimes: false, overlays: true, scatter: false, snapshot: false, doubleBlink: false, gravity: false };
    this.cues = [{ cue: 'peace', key: 'P' }, { cue: 'fist', key: 'F' }, { cue: 'smile', key: '1' }];
    this.needsHand = false;
  }

  playCoach() {
    return app.mode === 'camera'
      ? { icon: 'peace', html: 'Make the gesture on the <b>glowing token</b><small>Match it inside the outer ring, before it reaches the portal</small>' }
      : { icon: 'pinch', html: '<b>Tap the matching pose</b> below, or press its key' };
  }

  reset() {
    this.tokens = []; this.spawnT = 0.6; this.skill = 1; this.matches = 0;
    this.latch = {}; this.cool = {}; this.pulse = 0; this.ghost = null; this.missFlash = 0;
    this.faceSeen = -10;
  }

  get R() { return clamp(Math.min(app.W, app.H) * 0.14, 78, 140); }
  get zone() { return this.R + clamp(Math.min(app.W, app.H) * 0.26, 170, 280); }
  get cx() { return app.W / 2; }
  get cy() { return app.H * 0.48; }

  /** Poses the player can currently be asked for. Face poses need a face (or keys). */
  pool() {
    const faceOk = app.mode !== 'camera' || app.t - this.faceSeen < 3;
    const n = this.skill < 1.15 ? 4 : 6;
    return ORDER.slice(0, n).filter((p) => faceOk || !POSES[p].face);
  }

  spawn() {
    let a = rand(TAU);
    while (Math.abs(angleWrap(a - Math.PI / 2)) < 0.6) a = rand(TAU); // never straight up out of the dock
    const far = Math.hypot(app.W, app.H) * 0.55;
    const pose = pick(this.pool());
    this.tokens.push({ pose, a, d: far, born: app.t, dead: false, r: 42 });
  }

  /** Which poses are being made right now. */
  activePoses(dt) {
    const g = app.input.gest, inp = app.input, on = new Set();
    for (const k of Object.keys(this.latch)) { this.latch[k] -= dt; if (this.latch[k] <= 0) delete this.latch[k]; }
    if (g.has('open')) on.add('open');
    if (g.has('peace')) on.add('peace');
    if (g.has('fist')) on.add('fist');
    if (g.has('thumbsUp')) on.add('thumbsUp');
    if (g.has('smile')) on.add('smile');
    if (g.has('mouth')) on.add('mouth');
    for (const k of Object.keys(this.latch)) on.add(k);
    return on;
  }

  play(dt) {
    const inp = app.input;
    if (inp.face.present) this.faceSeen = app.t;
    for (const k of Object.keys(this.cool)) this.cool[k] -= dt;
    this.pulse = Math.max(0, this.pulse - dt * 2.2);
    this.missFlash = Math.max(0, this.missFlash - dt * 1.6);

    // Pose pad (no camera): tapping a pad token latches that pose.
    this.pad = app.mode !== 'camera' ? this.padLayout() : [];
    for (const p of this.pad) {
      const st = app.ui.target('gate-pad-' + p.pose, p.x, p.y, p.r, { tip: '' });
      p.st = st;
      if (st.selected) this.latch[p.pose] = LATCH;
    }
    const active = this.activePoses(dt);
    this.ghost = [...active][0] || null;

    // Spawn
    this.spawnT -= dt;
    const maxTokens = this.skill < 1.3 ? 3 : 4;
    if (this.spawnT <= 0 && this.tokens.length < maxTokens) {
      this.spawn();
      this.spawnT = clamp(2.3 / this.skill, 0.65, 2.6) * rand(0.8, 1.2);
    }

    // Move, match, miss
    const speed = 105 * this.skill, R = this.R, zone = this.zone;
    for (const tk of this.tokens) {
      if (tk.dead) continue;
      tk.d -= speed * dt;
      if (tk.d < R * 0.55) { this.miss(tk); continue; }
    }
    for (const pose of active) {
      if ((this.cool[pose] || 0) > 0) continue;
      let best = null;
      for (const tk of this.tokens) if (!tk.dead && tk.pose === pose && tk.d < zone && (!best || tk.d < best.d)) best = tk;
      if (best) { this.match(best); this.cool[pose] = COOLDOWN; delete this.latch[pose]; }
    }
    this.tokens = this.tokens.filter((t) => !t.dead);
  }

  pos(tk) { return { x: this.cx + Math.cos(tk.a) * tk.d, y: this.cy + Math.sin(tk.a) * tk.d }; }

  match(tk) {
    tk.dead = true;
    const { x, y } = this.pos(tk), P = POSES[tk.pose];
    this.hit(); this.matches++;
    const early = Math.max(0, Math.round((tk.d - this.R) / 18));
    const gain = (10 + early) * this.mult;
    this.score += gain;
    this.skill = clamp(this.skill * 1.045, 0.55, 2.5);
    this.pulse = 1;
    app.particles.emit({ x, y, count: 46, speed: [120, 460], life: [0.5, 1.2], size: [1.5, 4.5], colors: [P.color, '#ffffff'], kind: 5, raw: true });
    app.fx.shockwave(x, y, { color: P.color, r1: 110, dur: 0.5 });
    app.fx.text(x, y - 46, `+${gain}`, { color: P.color, size: 18 });
    app.audio.combo(this.combo);
    app.audio.shatter((x / app.W) * 2 - 1, 0.35);
    // a beam of light into the portal
    const cx = this.cx, cy = this.cy;
    app.fx.add(0.35, (ctx, p) => {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(P.color, 1 - p); ctx.lineWidth = 4 * (1 - p); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(cx, cy); ctx.stroke();
    });
  }

  miss(tk) {
    tk.dead = true;
    this.skill = clamp(this.skill * 0.86, 0.55, 2.5);
    this.missFlash = 1;
    this.loseLife(this.cx, this.cy - this.R - 24);
    app.particles.emit({ x: this.cx, y: this.cy, count: 24, speed: [40, 180], life: [0.4, 0.9], colors: ['#6a3dff', '#2a0f5e'], raw: true });
  }

  padLayout() {
    const poses = this.pool(), n = poses.length, W = app.W, H = app.H;
    const r = clamp(W / (n * 3.2), 22, 34), gap = r * 2.6, y = H - 200;
    return poses.map((pose, i) => ({ pose, x: W / 2 + (i - (n - 1) / 2) * gap, y, r }));
  }

  resultTitle() { return `${this.matches} GESTURES MATCHED`; }

  // ------------------------------------------------------------------ draw
  drawBack(ctx) {
    if (this.state === 'intro') return;
    const t = app.t, cx = this.cx, cy = this.cy, R = this.R, acc = this.accent;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // match zone
    ctx.strokeStyle = rgba('#ffffff', 0.07); ctx.lineWidth = 1; ctx.setLineDash([2, 10]);
    ctx.beginPath(); ctx.arc(cx, cy, this.zone, t * 0.05, t * 0.05 + TAU); ctx.stroke(); ctx.setLineDash([]);
    // portal
    const pr = R * (1 + this.pulse * 0.12);
    const halo = ctx.createRadialGradient(cx, cy, pr * 0.3, cx, cy, pr * 1.8);
    halo.addColorStop(0, rgba(this.missFlash > 0 ? '#6a3dff' : acc, 0.25 + this.pulse * 0.3)); halo.addColorStop(1, rgba(acc, 0));
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, pr * 1.8, 0, TAU); ctx.fill();
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = rgba(i ? '#ffffff' : acc, i ? 0.25 : 0.85); ctx.lineWidth = i ? 1 : 2.5;
      ctx.setLineDash(i === 2 ? [6, 14] : []);
      ctx.beginPath(); ctx.arc(cx, cy, pr * (1 - i * 0.12), t * (i % 2 ? -0.6 : 0.4), t * (i % 2 ? -0.6 : 0.4) + TAU); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
    // live pose ghost in the portal: instant confidence that the camera sees you
    if (this.ghost) drawCue(ctx, POSES[this.ghost].cue, cx, cy, R * 0.42, t, { alpha: 0.55, anim: false, accent: POSES[this.ghost].color });

    // tokens
    const zone = this.zone, cam = app.mode === 'camera';
    for (const tk of this.tokens) {
      const { x, y } = this.pos(tk), P = POSES[tk.pose], inZone = tk.d < zone;
      const s = Math.min(1, (t - tk.born) * 4);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // comet tail
      const tx = Math.cos(tk.a), ty = Math.sin(tk.a);
      const grd = ctx.createLinearGradient(x, y, x + tx * 120, y + ty * 120);
      grd.addColorStop(0, rgba(P.color, inZone ? 0.4 : 0.18)); grd.addColorStop(1, rgba(P.color, 0));
      ctx.strokeStyle = grd; ctx.lineWidth = tk.r * 1.1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + tx * 120, y + ty * 120); ctx.stroke();
      // glass token
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(12, 10, 36, 0.72)';
      ctx.beginPath(); ctx.arc(x, y, tk.r * s, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(P.color, inZone ? 1 : 0.5); ctx.lineWidth = inZone ? 2.5 : 1.2;
      ctx.stroke();
      if (inZone) { ctx.strokeStyle = rgba(P.color, 0.35 + 0.35 * Math.sin(t * 10)); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, tk.r * s + 7, 0, TAU); ctx.stroke(); }
      ctx.restore();
      drawCue(ctx, P.cue, x, y, tk.r * 0.55 * s, t, { accent: P.color, glow: inZone, alpha: inZone ? 1 : 0.7 });
      if (!cam) drawKey(ctx, P.key, x, y + tk.r + 16, 20, { alpha: 0.85 });
    }
    // pose pad (no camera)
    if (!cam && this.state === 'play') for (const p of this.pad || []) {
      const st = p.st || { hover: 0, pulse: 0 }, P = POSES[p.pose], R2 = p.r * (1 + st.hover * 0.1 + st.pulse * 0.2);
      ctx.save();
      ctx.fillStyle = 'rgba(12, 10, 36, 0.6)'; ctx.strokeStyle = rgba(P.color, 0.45 + st.hover * 0.5); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, R2, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
      drawCue(ctx, P.cue, p.x, p.y, R2 * 0.55, t, { anim: false, glow: false, alpha: 0.9 });
      drawKey(ctx, P.key, p.x, p.y + R2 + 14, 16, { alpha: 0.6 });
    }
  }

  drawFront(ctx) {
    if (this.state === 'play') glowText(ctx, `SPEED ${this.skill.toFixed(1)}×`, app.W / 2, HUD_SUB_Y, { size: 10, font: 'Inter', weight: 600, spacing: 3, color: 'rgba(255,255,255,0.5)', blur: 0 });
    super.drawFront(ctx);
  }
}
