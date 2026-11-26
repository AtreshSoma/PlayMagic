// ---------------------------------------------------------------------------
// BEAT BLOOM · reach-to-the-beat rhythm game
// A synthesised track plays at 104 BPM. Notes bloom out of the centre and
// glide to four glowing pads placed within easy reach; an approach ring
// shrinks onto the pad. Touch the pad as the note lands: "Perfect" inside
// ±60 ms, "Good" inside ±140 ms. Every hit plays a melody note, so a good
// run sounds like a song. The chart builds from single taps to doubles
// (both hands) and quick runs. Nothing to lose: just chase the combo.
//
// Hand: move into a pad (re-entering, or a quick punch, counts as a tap).
// Mouse / touch: click or tap a pad. Keys: D F J K.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { GameBase, HUD_SUB_Y } from './base.js';
import { glowText } from '../ui/draw.js';
import { drawKey } from '../ui/signifiers.js';
import { mtof } from '../audio/audio.js';
import { TAU, clamp, rgba, dist, pick } from '../core/util.js';

const BPM = 104, BEAT = 60 / BPM;
const LEAD = 1.5;            // seconds a note travels before it lands
const PERFECT = 0.06, GOOD = 0.14;
const PADS = [
  { fx: 0.2, fy: 0.42, col: '#ff7ad9', key: 'KeyD', label: 'D', note: 0 },
  { fx: 0.38, fy: 0.7, col: '#ffd36e', key: 'KeyF', label: 'F', note: 2 },
  { fx: 0.62, fy: 0.7, col: '#7ff3ff', key: 'KeyJ', label: 'J', note: 4 },
  { fx: 0.8, fy: 0.42, col: '#9dff9a', key: 'KeyK', label: 'K', note: 5 },
];
const SCALE = [62, 64, 66, 69, 71, 74, 76, 78];  // D major pentatonic-ish
const BASS = [38, 38, 43, 45];                  // D D G A, one per bar
const BARS = 26;

/** Procedural chart: [{ t, pad }] grouped by sections that ramp up. */
function makeChart() {
  const notes = [], start = 4; // a 4-beat count-in
  const quarter = (b, pads) => pads.forEach((p) => notes.push({ beat: b, pad: p }));
  for (let bar = 0; bar < BARS; bar++) {
    const b0 = start + bar * 4, sec = bar < 6 ? 0 : bar < 14 ? 1 : bar < 22 ? 2 : 3;
    if (sec === 0) { quarter(b0, [bar % 4]); quarter(b0 + 2, [(bar + 2) % 4]); }
    else if (sec === 1) for (let i = 0; i < 4; i++) quarter(b0 + i, [[0, 3, 1, 2][(i + bar) % 4]]);
    else if (sec === 2) {
      quarter(b0, [0, 3]); quarter(b0 + 1, [1]); quarter(b0 + 2, [1, 2]); quarter(b0 + 3, [2]);
      if (bar % 2) quarter(b0 + 3.5, [pick([0, 3])]);
    } else {
      for (let i = 0; i < 8; i++) if (i % 2 === 0 || Math.random() < 0.5) quarter(b0 + i * 0.5, [[0, 1, 2, 3, 3, 2, 1, 0][i]]);
      if (bar === BARS - 1) quarter(b0 + 4, [0, 1, 2, 3]);
    }
  }
  return notes.map((n) => ({ t: n.beat * BEAT, pad: n.pad, hit: false, missed: false, judged: null }));
}

export class BeatGame extends GameBase {
  constructor() {
    super('beat', 'Beat Bloom');
    this.maxLives = 0;
    this.duration = (4 + BARS * 4 + 4) * BEAT;
    this.allow = { swipe: false, runes: false, faceMagic: false, chimes: false, overlays: true, scatter: false, snapshot: false, gravity: false, puff: false, tilt: false, barrier: false, doubleBlink: false };
    this.cues = [{ cue: 'reach', key: 'Click' }, { cue: 'twoPalms', key: 'D F J K' }];
  }

  playCoach() {
    return app.mode === 'camera'
      ? { icon: 'palm', html: '<b>Touch the pad</b> as its note lands on the ring<small>Two notes at once? Use both hands</small>' }
      : { icon: 'pinch', html: '<b>Click the pads</b> or press <b>D F J K</b> on the beat' };
  }

  reset() {
    this.chart = makeChart(); this.songT = -0.4; this.beatIdx = 0; this.halfIdx = 0;
    this.perfect = 0; this.good = 0; this.misses = 0; this.melody = 0;
    this.padState = PADS.map(() => ({ inside: false, flash: 0, judge: null, judgeT: 0, keyWas: false, lastHit: -9 }));
    this.pulse = 0;
  }

  onStart() { app.audio.duckPad(0.15); }
  exit() { super.exit(); app.audio.duckPad(1); }

  padPos(i) {
    const W = app.W, H = app.H, r = clamp(Math.min(W, H) * 0.075, 44, 78);
    return { x: W * PADS[i].fx, y: H * PADS[i].fy, r };
  }

  /** Backing track: kick on beats, hat on off-beats, a bass note per bar. */
  music() {
    while (this.halfIdx * BEAT / 2 <= this.songT) {
      const h = this.halfIdx, beat = h / 2;
      if (h % 2 === 0) {
        app.audio.thump(beat % 4 === 0 ? 0.75 : 0.5);
        if (beat % 4 === 0) app.audio.pluck(mtof(BASS[Math.floor(beat / 4) % 4]), { vel: 0.5, dur: BEAT * 3.5, bright: 0.2 });
        this.pulse = 1;
      } else app.audio.tickHat(0.3);
      this.halfIdx++;
    }
  }

  /** Is pad i being tapped this frame (by hand entry/punch, click or key)? */
  taps(dt) {
    const inp = app.input, out = PADS.map(() => false);
    PADS.forEach((pd, i) => {
      const { x, y, r } = this.padPos(i), st = this.padState[i];
      let inside = false, punch = false;
      for (const h of inp.hands) {
        if (!h.present) continue;
        if (dist(h.x, h.y, x, y) < r * 1.25 || dist(h.palmX, h.palmY, x, y) < r * 1.1) { inside = true; if (h.speed > 900) punch = true; }
      }
      if ((inside && !st.inside) || (punch && this.songT - st.lastHit > 0.18)) out[i] = true;
      st.inside = inside;
      const kd = inp.fb.held(pd.key);
      if (kd && !st.keyWas) out[i] = true;
      st.keyWas = kd;
    });
    for (const e of inp.events) {
      if (e.type !== 'pinchStart') continue;
      PADS.forEach((_, i) => { const { x, y, r } = this.padPos(i); if (dist(e.x, e.y, x, y) < r * 1.3) out[i] = true; });
    }
    return out;
  }

  judge(note, d) {
    const st = this.padState[note.pad], p = this.padPos(note.pad), pan = (p.x / app.W) * 2 - 1;
    note.hit = true;
    const perfect = Math.abs(d) <= PERFECT;
    note.judged = perfect ? 'Perfect' : 'Good';
    if (perfect) this.perfect++; else this.good++;
    this.hit();
    this.score += (perfect ? 100 : 50) * this.mult;
    st.flash = 1; st.judge = note.judged; st.judgeT = 0.6; st.lastHit = this.songT;
    // the player plays the melody
    const m = SCALE[(PADS[note.pad].note + (this.melody++ % 3)) % SCALE.length];
    app.audio.pluck(mtof(m), { pan, vel: perfect ? 0.6 : 0.45, dur: 1, bright: 0.8 });
    if (perfect) app.audio.chime(mtof(m + 12), { pan, vel: 0.2, dur: 1.2 });
    app.particles.emit({ x: p.x, y: p.y, count: perfect ? 30 : 16, speed: [100, 360], life: [0.4, 0.9], colors: [PADS[note.pad].col, '#ffffff'], raw: true });
    app.fx.shockwave(p.x, p.y, { color: PADS[note.pad].col, r1: p.r * 2, dur: 0.4, width: perfect ? 4 : 2 });
  }

  play(dt) {
    this.songT += dt;
    this.pulse = Math.max(0, this.pulse - dt * 4);
    this.music();
    for (const st of this.padState) { st.flash = Math.max(0, st.flash - dt * 4); st.judgeT = Math.max(0, st.judgeT - dt); }
    const taps = this.taps(dt);
    taps.forEach((tap, i) => {
      if (!tap) return;
      let best = null, bd = Infinity;
      for (const n of this.chart) {
        if (n.pad !== i || n.hit || n.missed) continue;
        const d = this.songT - n.t;
        if (Math.abs(d) <= GOOD && Math.abs(d) < bd) { bd = Math.abs(d); best = n; }
      }
      if (best) this.judge(best, this.songT - best.t);
    });
    for (const n of this.chart) {
      if (n.hit || n.missed || this.songT - n.t <= GOOD + 0.04) continue;
      n.missed = true; this.misses++;
      this.breakCombo();
      const st = this.padState[n.pad]; st.judge = 'Miss'; st.judgeT = 0.5;
    }
  }

  get accuracy() { const total = this.perfect + this.good + this.misses; return total ? (this.perfect + this.good * 0.5) / total : 0; }
  resultTitle() { return `ACCURACY ${Math.round(this.accuracy * 100)}%`; }
  resultExtra() { return `${this.perfect} perfect · ${this.good} good · ${this.misses} missed`; }

  // ------------------------------------------------------------------ draw
  drawBack(ctx) {
    if (this.state === 'intro') return;
    const W = app.W, H = app.H, t = app.t, cx = W / 2, cy = H * 0.5, cam = app.mode === 'camera';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // centre bloom pulses with the kick
    const br = 40 + this.pulse * 26;
    ctx.drawImage(app.particles.spriteCanvas(this.accent), cx - br * 2, cy - br * 2, br * 4, br * 4);
    ctx.strokeStyle = rgba('#ffffff', 0.25 + this.pulse * 0.4); ctx.lineWidth = 2;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + t * 0.4;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * br * 0.6, cy + Math.sin(a) * br * 0.6); ctx.lineTo(cx + Math.cos(a) * br * 1.1, cy + Math.sin(a) * br * 1.1); ctx.stroke();
    }
    // pads
    PADS.forEach((pd, i) => {
      const { x, y, r } = this.padPos(i), st = this.padState[i];
      const R = r * (1 + st.flash * 0.12 + (st.inside ? 0.05 : 0));
      ctx.globalAlpha = 0.35 + st.flash * 0.6;
      ctx.drawImage(app.particles.spriteCanvas(pd.col), x - R * 2.4, y - R * 2.4, R * 4.8, R * 4.8);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = rgba(pd.col, 0.95); ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.stroke();
      ctx.strokeStyle = rgba('#ffffff', 0.35); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, R * 0.7, 0, TAU); ctx.stroke();
      // the lane from centre to pad
      ctx.strokeStyle = rgba(pd.col, 0.12); ctx.lineWidth = r * 0.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
    });
    // notes: glide from centre, approach ring shrinks onto the pad
    for (const n of this.chart) {
      const d = n.t - this.songT;
      if (n.hit || d > LEAD || d < -0.25) continue;
      const { x, y, r } = this.padPos(n.pad), col = PADS[n.pad].col, p = clamp(1 - d / LEAD);
      const nx = cx + (x - cx) * p, ny = cy + (y - cy) * p;
      const a = n.missed ? Math.max(0, 1 + d * 4) : 1;
      ctx.globalAlpha = a;
      ctx.drawImage(app.particles.spriteCanvas(col), nx - 26, ny - 26, 52, 52);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(nx, ny, 8 + p * 6, 0, TAU); ctx.fill();
      if (d > 0) { ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r * (1 + d / LEAD * 1.4), 0, TAU); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // judgements + key hints
    PADS.forEach((pd, i) => {
      const { x, y, r } = this.padPos(i), st = this.padState[i];
      if (st.judgeT > 0) glowText(ctx, st.judge, x, y - r - 22 - (0.6 - st.judgeT) * 30, { size: st.judge === 'Perfect' ? 20 : 15, font: 'Cinzel', weight: 700, color: st.judge === 'Miss' ? '#9a94c8' : '#ffffff', glow: pd.col, alpha: clamp(st.judgeT * 3) });
      if (!cam) drawKey(ctx, pd.label, x, y + r + 22, 22, { alpha: 0.7 });
    });
    if (this.songT < 0 + BEAT * 4) {
      const n = Math.ceil((BEAT * 4 - this.songT) / BEAT);
      if (n > 0 && n <= 4) glowText(ctx, String(n), cx, cy, { size: 54, glow: this.accent, alpha: 0.85 });
    }
  }

  drawFront(ctx) {
    if (this.state === 'play') glowText(ctx, `${Math.round(this.accuracy * 100)}% accuracy`, app.W / 2, HUD_SUB_Y, { size: 11, font: 'Inter', weight: 600, spacing: 2, color: 'rgba(255,255,255,0.6)', blur: 0 });
    super.drawFront(ctx);
  }
}
