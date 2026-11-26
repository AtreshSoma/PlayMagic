// ---------------------------------------------------------------------------
// Procedural sound (Web Audio API). Every sound is synthesised on the fly,
// so nothing is downloaded and it all works offline.
//
// Tuned for small ears: soft attacks, warm low-pass, a compressor that keeps
// peaks gentle, and a voice budget so twenty bubbles popping at once still
// sounds like music rather than noise. Notes come from the major pentatonic
// scale, so any combination is in harmony.
// ---------------------------------------------------------------------------
import { noteFreq, rand, pick } from '../core/util.js';

const MASTER = 0.5; // overall ceiling before the grown-up volume slider

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true; this.volume = 0.7;
    this.recent = []; // timestamps for the voice budget
    this.breath = null;
  }

  /** Must be called from a user gesture (tap / click / key). */
  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.level();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 18; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.25;
    const warm = ctx.createBiquadFilter();
    warm.type = 'lowpass'; warm.frequency.value = 7200; warm.Q.value = 0.5;
    this.bus = ctx.createGain();
    this.bus.connect(warm); warm.connect(comp); comp.connect(this.master); this.master.connect(ctx.destination);

    // a little "storybook room" echo for chimes
    this.wet = ctx.createGain(); this.wet.gain.value = 0.22;
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.19;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 3200;
    this.wet.connect(delay); delay.connect(tone); tone.connect(fb); fb.connect(delay); tone.connect(this.bus);

    // one second of white noise, reused by pops, whooshes and breath
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  level() { return this.enabled ? this.volume * MASTER : 0; }
  setVolume(v) { this.volume = v; this.apply(); }
  setEnabled(on) { this.enabled = on; this.apply(); }
  apply() { if (this.ctx) this.master.gain.setTargetAtTime(this.level(), this.ctx.currentTime, 0.05); }

  get ready() { return !!this.ctx && this.ctx.state === 'running' && this.enabled; }

  /** Voice budget: at most ~10 new sounds per 120 ms. */
  allow(cost = 1) {
    if (!this.ready) return false;
    const now = performance.now();
    while (this.recent.length && now - this.recent[0] > 120) this.recent.shift();
    if (this.recent.length >= 10) return false;
    for (let i = 0; i < cost; i++) this.recent.push(now);
    return true;
  }

  // ---------------------------------------------------------------- primitives
  osc({ freq, type = 'sine', at = 0, dur = 0.5, attack = 0.006, gain = 0.2, to = null, toAt = null, wet = 0, vib = 0, vibRate = 7 }) {
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + (toAt ?? dur * 0.6));
    if (vib) {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = vibRate; lg.gain.value = vib;
      l.connect(lg); lg.connect(o.frequency);
      l.start(t); l.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.bus);
    if (wet) { const w = c.createGain(); w.gain.value = wet; g.connect(w); w.connect(this.wet); }
    o.start(t); o.stop(t + dur + 0.05);
  }

  hiss({ at = 0, dur = 0.2, gain = 0.15, type = 'bandpass', f = 1200, f2 = null, q = 1.2 }) {
    const c = this.ctx, t = c.currentTime + at;
    const s = c.createBufferSource(); s.buffer = this.noise;
    s.playbackRate.value = rand(0.8, 1.2);
    const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.03, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.bus);
    s.start(t, rand(0, 0.5)); s.stop(t + dur + 0.05);
  }

  // ---------------------------------------------------------------- palette
  /** Wooden marimba pluck: fundamental + quickly-dying 4th partial + mallet tick. */
  marimba(freq, gain = 0.22, at = 0) {
    if (!this.allow()) return;
    this.osc({ freq, at, dur: 1.1, attack: 0.004, gain });
    this.osc({ freq: freq * 3.99, at, dur: 0.16, attack: 0.002, gain: gain * 0.3 });
    this.osc({ freq: freq * 2, at, dur: 0.4, attack: 0.003, gain: gain * 0.12, wet: 0.5 });
    this.hiss({ at, dur: 0.02, gain: gain * 0.25, f: freq * 5, q: 3 });
  }

  /** Bright xylophone bar (used for scale runs). */
  xylo(freq, gain = 0.16, at = 0) {
    if (!this.allow()) return;
    this.osc({ freq, type: 'triangle', at, dur: 0.55, attack: 0.002, gain });
    this.osc({ freq: freq * 3, at, dur: 0.12, attack: 0.002, gain: gain * 0.25 });
  }

  note(i, gain) { this.marimba(noteFreq(i), gain); }

  /** Playful spring "boing". */
  boing(pitch = 1, gain = 0.16) {
    if (!this.allow()) return;
    this.osc({ freq: 150 * pitch, to: 460 * pitch, toAt: 0.09, dur: 0.5, attack: 0.008, gain, vib: 38 * pitch, vibRate: 13 });
  }

  /** Tiny jelly wobble when a hand first touches a bubble. */
  wobble() {
    if (!this.allow()) return;
    this.osc({ freq: 420, to: 620, toAt: 0.05, dur: 0.18, attack: 0.006, gain: 0.05, vib: 30, vibRate: 22 });
  }

  /** Bell chime (inharmonic partials) with the room echo. */
  chime(pitch = 1, gain = 0.1) {
    if (!this.allow()) return;
    const f = noteFreq(pick([10, 11, 12, 13, 14])) * pitch;
    [[1, 1, 1.6], [2.76, 0.4, 1.0], [5.4, 0.2, 0.6]].forEach(([m, g, d]) =>
      this.osc({ freq: f * m, dur: d, attack: 0.003, gain: gain * g, wet: 0.8 }));
  }

  /** Quick ascending twinkle. */
  sparkle(gain = 0.07) {
    if (!this.allow(2)) return;
    const s = Math.floor(rand(10, 14));
    for (let k = 0; k < 3; k++) this.osc({ freq: noteFreq(s + k * 2), at: k * 0.06, dur: 0.35, attack: 0.002, gain, wet: 0.7 });
  }

  /** Soap-bubble pop. */
  pop(pitch = 1, gain = 0.14) {
    if (!this.allow()) return;
    this.hiss({ dur: 0.05, gain, f: 1500 * pitch, q: 2.5 });
    this.osc({ freq: 700 * pitch, to: 220 * pitch, toAt: 0.06, dur: 0.09, attack: 0.002, gain: gain * 0.8 });
  }

  /** Soft wing flap / hop. */
  flap(gain = 0.12) {
    if (!this.allow()) return;
    this.hiss({ dur: 0.12, gain: gain * 0.7, f: 700, f2: 1800, q: 0.9 });
    this.osc({ freq: 330, to: 520, toAt: 0.08, dur: 0.16, attack: 0.005, gain: gain * 0.6 });
  }

  /** "Hee-hee-hee": the giggle when a character bumps a cloud. */
  giggle(gain = 0.09) {
    if (!this.allow(3)) return;
    const base = rand(820, 980);
    for (let k = 0; k < 4; k++) {
      const f = base * (1 - k * 0.06);
      this.osc({ freq: f, to: f * 1.25, toAt: 0.04, dur: 0.1, at: k * 0.1, attack: 0.008, gain, vib: 40, vibRate: 30, type: 'triangle' });
    }
  }

  /** Air rushing past (transitions, whirlwinds, boosts). */
  whoosh(dur = 0.8, up = true, gain = 0.12) {
    if (!this.allow()) return;
    this.hiss({ dur, gain, f: up ? 280 : 2200, f2: up ? 2400 : 300, q: 0.8 });
  }

  /** Cheerful major fanfare for goals. */
  fanfare(gain = 0.12) {
    if (!this.allow(4)) return;
    const seq = [10, 12, 14, 15];
    seq.forEach((n, k) => this.osc({ freq: noteFreq(n), type: 'triangle', at: k * 0.11, dur: 0.35, attack: 0.01, gain }));
    [10, 12, 14, 17].forEach((n) => this.osc({ freq: noteFreq(n), type: 'triangle', at: 0.46, dur: 1.4, attack: 0.02, gain: gain * 0.6, wet: 0.5 }));
    this.osc({ freq: noteFreq(5), at: 0.46, dur: 1.4, attack: 0.02, gain: gain * 0.7 });
  }

  /** Flower opening: a soft upward glide. */
  bloom(gain = 0.06) {
    if (!this.allow()) return;
    const f = noteFreq(Math.floor(rand(7, 12)));
    this.osc({ freq: f, to: f * 1.5, toAt: 0.25, dur: 0.6, attack: 0.05, gain, wet: 0.6 });
  }

  /** Continuous breathy hush while the mouth blows bubbles (level 0..1). */
  breathe(level) {
    if (!this.ctx) return;
    if (!this.breath) {
      const c = this.ctx, s = c.createBufferSource();
      s.buffer = this.noise; s.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.6;
      const g = c.createGain(); g.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(this.bus); s.start();
      this.breath = g;
    }
    this.breath.gain.setTargetAtTime(this.enabled ? level * 0.05 : 0, this.ctx.currentTime, 0.08);
  }
}
