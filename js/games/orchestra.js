// ---------------------------------------------------------------------------
// COSMIC ORCHESTRA · air theremin & rhythm studio (free play, no score to lose)
//   left hand height   → which chord plays (six chords, top = brightest)
//   right hand height  → melody note (D major pentatonic, two octaves);
//                        moving fast adds shimmering arpeggios
//   open mouth         → a warm synth swell that opens like a filter
//   head nod           → starts / renews a soft rhythmic pulse
// Every note paints a geometric ripple, and four light waves across the sky
// breathe with the chord, the swell and the pulse.
// With no left hand the chords drift through a gentle progression on their
// own, so one hand (or one mouse) is already music.
// Mouse: left half of the screen = chord hand, right half = melody hand.
// Keys: 2 swell · Y pulse.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { GameBase, HUD_Y } from './base.js';
import { OrchestraSynth } from '../audio/orchestra.js';
import { mtof } from '../audio/audio.js';
import { glowText } from '../ui/draw.js';
import { TAU, clamp, rgba, approach, rand } from '../core/util.js';

const CHORDS = [
  { name: 'D', notes: [50, 57, 62, 66, 69], hue: 46 },
  { name: 'A', notes: [45, 52, 57, 61, 64], hue: 28 },
  { name: 'Bm', notes: [47, 54, 59, 62, 66], hue: 300 },
  { name: 'G', notes: [43, 50, 55, 59, 62], hue: 200 },
  { name: 'Em', notes: [40, 47, 52, 55, 59], hue: 250 },
  { name: 'F♯m', notes: [42, 49, 54, 57, 61], hue: 170 },
];
const MELODY = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83];
const AUTO_PROG = [0, 3, 2, 1];
const BPM = 96;
const MAX_RIPPLES = 70;

export class OrchestraGame extends GameBase {
  constructor() {
    super('orchestra', 'Cosmic Orchestra');
    this.duration = Infinity; this.maxLives = 0;
    this.allow = { swipe: false, runes: false, faceMagic: false, chimes: false, overlays: true, scatter: false, tilt: false, snapshot: true, puff: false };
    this.cues = [{ cue: 'open', key: 'Left half' }, { cue: 'point', key: 'Right half' }, { cue: 'mouth', key: '2' }, { cue: 'nod', key: 'Y' }];
    this.synth = null;
  }

  playCoach() {
    return app.mode === 'camera'
      ? { icon: 'palm', html: '<b>Left hand</b> chords · <b>right hand</b> melody<small>Open your mouth to swell · nod for a beat</small>' }
      : { icon: 'pinch', html: 'Move on the <b>left</b> for chords, <b>right</b> for melody<small>Hold 2 to swell · press Y for a beat</small>' };
  }

  reset() {
    this.chord = 0; this.autoT = 0; this.autoI = 0; this.chordHand = false;
    this.note = -1; this.noteT = 0; this.arpT = 0; this.arpI = 0;
    this.notes = 0; this.ripples = []; this.waves = 0; this.pulseAmp = 0;
    this.beat = { on: false, left: 0, next: 0, n: 0 };
    this.swell = 0; this.bright = 0.5; this.padLevel = 0;
    this.melodyHand = null; this.leftHand = null;
  }

  onStart() {
    if (!app.audio.ready) return;
    this.synth = new OrchestraSynth(app.audio);
    this.synth.start();
    this.synth.setChord(CHORDS[0].notes);
    app.audio.duckPad(0.12);
  }

  exit() {
    super.exit();
    this.synth?.stop(); this.synth = null;
    app.audio.duckPad(1);
  }

  /** Assign hands to roles by screen side: leftmost on the left = chords, rightmost on the right = melody. */
  roles() {
    const inp = app.input, W = app.W;
    let hands = inp.hands.filter((h) => h.present);
    const m = inp.mouseHand;
    if (m.present && app.t - inp.fb.lastMove < 2) hands = [...hands, m];
    let left = null, right = null;
    for (const h of hands) {
      const x = h.source === 'mouse' ? h.x : h.palmX;
      if (x < W * 0.5) { if (!left || x < (left.palmX ?? left.x)) left = h; }
      else if (!right || x > (right.palmX ?? right.x)) right = h;
    }
    return { left, right };
  }

  play(dt) {
    const inp = app.input, W = app.W, H = app.H, top = 110, bot = H - 130;
    const yNorm = (y) => clamp((y - top) / (bot - top));
    const { left, right } = this.roles();
    this.leftHand = left; this.melodyHand = right;

    // --- chords
    if (left) {
      const y = left.source === 'mouse' ? left.y : left.palmY;
      const idx = Math.min(CHORDS.length - 1, Math.floor(yNorm(y) * CHORDS.length));
      if (idx !== this.chord) this.setChord(idx, left.source === 'mouse' ? left.x : left.palmX, y);
      this.padLevel = approach(this.padLevel, 1, dt, 0.2);
      this.bright = approach(this.bright, 1 - yNorm(y), dt, 0.1);
      this.autoT = 0;
    } else {
      this.padLevel = approach(this.padLevel, 0.45, dt, 0.8);
      this.autoT += dt;
      if (this.autoT > 60 / BPM * 8) { this.autoT = 0; this.autoI = (this.autoI + 1) % AUTO_PROG.length; this.setChord(AUTO_PROG[this.autoI], W * 0.15, H * 0.5, true); }
    }

    // --- melody
    this.noteT += dt; this.arpT += dt;
    if (right) {
      const y = right.y, idx = Math.round((1 - yNorm(y)) * (MELODY.length - 1));
      const moving = right.speed > 40 || right.source !== 'mouse';
      if (idx !== this.note && moving && this.noteT > 0.07) {
        this.playNote(MELODY[idx], right.x, y, clamp(0.35 + right.speed / 2500, 0.35, 0.8));
        this.note = idx; this.noteT = 0;
      }
      if (right.speed > 700) {
        const rate = clamp(right.speed / 130, 6, 16);
        if (this.arpT > 1 / rate) {
          this.arpT = 0;
          const ch = CHORDS[this.chord].notes, n = ch[1 + (this.arpI++ % (ch.length - 1))] + 24;
          app.audio.pluck(mtof(n), { pan: (right.x / W) * 2 - 1, vel: 0.18, dur: 0.6, bright: 0.9 });
          this.ripple(right.x + rand(-20, 20), right.y + rand(-20, 20), 3, CHORDS[this.chord].hue + 40, 0.6, 50);
        }
      }
      if (inp.events.some((e) => e.type === 'pinchStart' && e.hand === right.label)) {
        this.playNote(MELODY[Math.max(0, this.note)] + 12, right.x, y, 0.8);
      }
    }

    // --- mouth swell
    const m = clamp((inp.vals.mouth - 0.12) / 0.6);
    this.swell = approach(this.swell, m, dt, 0.08);
    this.synth?.setSwell(this.swell);
    this.synth?.setPad(this.padLevel, this.bright);

    // --- nod pulse
    if (inp.has('nod')) {
      const was = this.beat.on;
      if (!was) { this.beat.on = true; this.beat.next = 0; this.beat.n = 0; }
      this.beat.left = 16;
      app.fx.text(W / 2, H * 0.24, was ? 'Pulse renewed' : 'Pulse on', { color: this.accent, size: 16, font: 'Inter', weight: 600 });
    }
    if (this.beat.on) {
      this.beat.next -= dt;
      if (this.beat.next <= 0) {
        this.beat.next += 60 / BPM / 2;
        const onBeat = this.beat.n % 2 === 0;
        if (onBeat) {
          app.audio.thump(this.beat.n % 8 === 0 ? 0.8 : 0.5);
          this.pulseAmp = 1;
          this.beat.left--;
          this.ripple(W / 2, H - 60, 32, CHORDS[this.chord].hue, 1.4, Math.max(W, H) * 0.6);
        } else app.audio.tickHat(0.35);
        this.beat.n++;
        if (this.beat.left <= 0) this.beat.on = false;
      }
    }
    this.pulseAmp = Math.max(0, this.pulseAmp - dt * 3);
    this.waves += dt * (1 + this.swell * 2);

    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter((r) => r.t < r.dur);
    this.score = this.notes;
  }

  setChord(idx, x, y, quiet = false) {
    this.chord = idx;
    const c = CHORDS[idx];
    this.synth?.setChord(c.notes);
    if (!quiet) c.notes.slice(1).forEach((n, i) => app.audio.pluck(mtof(n + 12), { vel: 0.12, dur: 1, when: i * 0.035, pan: -0.5 }));
    this.ripple(x, y, 6, c.hue, 1.6, 220);
  }

  playNote(midi, x, y, vel) {
    app.audio.pluck(mtof(midi), { pan: (x / app.W) * 2 - 1, vel, dur: 1.4, bright: 0.6 });
    this.notes++;
    const deg = MELODY.indexOf(midi);
    this.ripple(x, y, 3 + ((deg < 0 ? 5 : deg) % 6), (CHORDS[this.chord].hue + (deg < 0 ? 5 : deg) * 24) % 360, 1.3, 160);
    app.particles.emit({ x, y, count: 10, speed: [40, 160], life: [0.5, 1.1], size: [1.5, 3.5], colors: [`#ffffff`, app.theme.accent], raw: true });
  }

  ripple(x, y, sides, hue, dur, reach) {
    if (this.ripples.length >= MAX_RIPPLES) this.ripples.shift();
    this.ripples.push({ x, y, sides, hue, dur, reach, t: 0, rot: rand(TAU), spin: rand(-0.8, 0.8) });
  }

  // ------------------------------------------------------------------ draw
  drawBack(ctx) {
    if (this.state === 'intro') return;
    const W = app.W, H = app.H, t = app.t, c = CHORDS[this.chord];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // light waves
    const amp = 18 + this.padLevel * 26 + this.swell * 90 + this.pulseAmp * 40;
    const k = (c.notes[0] - 38) / 14;
    for (let w = 0; w < 4; w++) {
      const base = H * (0.34 + w * 0.11), hue = (c.hue + w * 22) % 360;
      ctx.strokeStyle = `hsla(${hue}, 95%, 70%, ${0.16 + this.swell * 0.25 + this.pulseAmp * 0.15})`;
      ctx.lineWidth = 1.5 + this.swell * 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const x = (i / 64) * W, u = i / 64;
        const y = base + Math.sin(u * TAU * (1.5 + k + w * 0.4) + this.waves * (1 + w * 0.3)) * amp * Math.sin(u * Math.PI) * (1 - w * 0.12);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    // swell glow rising from the bottom
    if (this.swell > 0.02) {
      const g = ctx.createRadialGradient(W / 2, H * 1.1, 10, W / 2, H * 1.1, H * (0.4 + this.swell * 0.7));
      g.addColorStop(0, `hsla(${c.hue}, 100%, 65%, ${0.35 * this.swell})`); g.addColorStop(1, 'hsla(0,0%,0%,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // ripples
    for (const r of this.ripples) {
      const p = r.t / r.dur, R = 10 + r.reach * (1 - Math.pow(1 - p, 3)), a = (1 - p) * 0.85;
      ctx.strokeStyle = `hsla(${r.hue}, 100%, 72%, ${a})`; ctx.lineWidth = 2 * (1 - p) + 0.5;
      ctx.beginPath();
      for (let s = 0; s <= r.sides; s++) {
        const ang = r.rot + r.spin * r.t + (s / r.sides) * TAU;
        s ? ctx.lineTo(r.x + Math.cos(ang) * R, r.y + Math.sin(ang) * R) : ctx.moveTo(r.x + Math.cos(ang) * R, r.y + Math.sin(ang) * R);
      }
      ctx.stroke();
    }
    ctx.restore();
    this.drawRails(ctx);
  }

  /** Chord rail (left) and note rail (right): where each height lands. */
  drawRails(ctx) {
    const W = app.W, H = app.H, top = 110, bot = H - 130, t = app.t;
    const lx = 34, rx = W - 34;
    ctx.save();
    ctx.strokeStyle = rgba('#ffffff', 0.1); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(lx, top); ctx.lineTo(lx, bot); ctx.moveTo(rx, top); ctx.lineTo(rx, bot); ctx.stroke();
    ctx.restore();
    CHORDS.forEach((c, i) => {
      const y = top + (bot - top) * ((i + 0.5) / CHORDS.length), on = i === this.chord;
      glowText(ctx, c.name, lx + 18, y, { size: on ? 18 : 12, font: 'Cinzel', weight: on ? 700 : 500, align: 'left', color: on ? '#ffffff' : 'rgba(255,255,255,0.4)', glow: `hsl(${c.hue},100%,65%)`, blur: on ? 14 : 0 });
      ctx.fillStyle = on ? `hsl(${c.hue},100%,70%)` : 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.arc(lx, y, on ? 4 + Math.sin(t * 6) : 2.5, 0, TAU); ctx.fill();
    });
    MELODY.forEach((m, i) => {
      const y = top + (bot - top) * (1 - i / (MELODY.length - 1)), on = i === this.note && this.noteT < 0.4;
      ctx.fillStyle = on ? '#ffffff' : 'rgba(255,255,255,0.22)';
      ctx.beginPath(); ctx.arc(rx, y, on ? 4.5 : 2, 0, TAU); ctx.fill();
    });
    // role halos on the hands
    for (const [h, col] of [[this.leftHand, `hsl(${CHORDS[this.chord].hue},100%,70%)`], [this.melodyHand, '#ffffff']]) {
      if (!h) continue;
      const x = h.source === 'mouse' ? h.x : h.palmX, y = h.source === 'mouse' ? h.y : h.palmY;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = col; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 34 + Math.sin(t * 4) * 3, 0, TAU); ctx.stroke(); ctx.restore();
    }
  }

  drawHud(ctx) {
    const W = app.W;
    glowText(ctx, CHORDS[this.chord].name, W / 2, HUD_Y + 28, { size: 28, glow: `hsl(${CHORDS[this.chord].hue},100%,65%)` });
    glowText(ctx, `♪ ${this.notes} notes${this.beat.on ? '  ·  pulse' : ''}`, W / 2, HUD_Y + 56, { size: 11, font: 'Inter', weight: 600, spacing: 2, color: 'rgba(255,255,255,0.6)', blur: 0 });
  }
}
