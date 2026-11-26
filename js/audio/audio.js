// ---------------------------------------------------------------------------
// Procedural mystical soundscape (Web Audio API). Nothing is loaded — every
// sound is synthesised:
//   • evolving detuned pad whose scale/brightness follow the Mood Resonance
//   • inharmonic bell "chimes" (pitch from fingertip height, pan from x)
//   • crystalline swells, whooshes and spell sounds
//   • a breath-noise "exhale" voice that follows mouth openness
// Signal flow: voices → sfx bus ─┬→ master → compressor → out
//                                ├→ convolver reverb (generated impulse)
//                                └→ feedback delay (shimmer)
// ---------------------------------------------------------------------------
import { clamp } from '../core/util.js';

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export const SCALES = {
  calm: { root: 50, steps: [0, 2, 4, 7, 9], cutoff: 950, name: 'D major pentatonic' },
  joyful: { root: 55, steps: [0, 2, 4, 7, 9], cutoff: 1600, name: 'G major pentatonic' },
  focused: { root: 45, steps: [0, 3, 5, 7, 10], cutoff: 700, name: 'A minor pentatonic' },
  surprised: { root: 52, steps: [0, 2, 4, 6, 7, 11], cutoff: 2000, name: 'E lydian' },
};
// Chords as scale-degree indices (wrap into higher octaves).
const PROGRESSION = [[0, 2, 4, 7], [1, 3, 5, 8], [0, 2, 5, 9], [2, 4, 6, 9], [0, 3, 4, 7]];
const EXHALE_FILTER = { stardust: 2600, embers: 900, 'auroral mist': 520, 'prism shards': 1600 };

export class AudioEngine {
  constructor() {
    this.ctx = null; this.ready = false;
    this.volume = 0.7; this.muted = false;
    this.scaleKey = 'calm'; this.chordIdx = 0; this.chordT = 0;
    this.lastHover = 0; this.lastTick = 0;
  }
  get scale() { return SCALES[this.scaleKey]; }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  degreeToMidi(deg, octave = 0) {
    const s = this.scale.steps, n = s.length;
    const o = Math.floor(deg / n), i = ((deg % n) + n) % n;
    return this.scale.root + 12 * (o + octave) + s[i];
  }
  noteFromY(y01, octave = 1) {
    const n = this.scale.steps.length * 2;
    return mtof(this.degreeToMidi(Math.round((1 - clamp(y01)) * (n - 1)), octave));
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.25;
    this.master.connect(comp).connect(ctx.destination);

    this.noise = this._noiseBuffer();
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(3.6, 2.4);
    const revOut = ctx.createGain(); revOut.gain.value = 0.6;
    this.reverb.connect(revOut).connect(this.master);

    this.delay = ctx.createDelay(1.5); this.delay.delayTime.value = 0.375;
    const fb = ctx.createGain(); fb.gain.value = 0.36;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 3400;
    this.delay.connect(dlp).connect(fb).connect(this.delay);
    dlp.connect(this.reverb);
    this.delayIn = ctx.createGain(); this.delayIn.gain.value = 0.5;
    this.delayIn.connect(this.delay);

    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);

    this._buildPad();
    this._buildExhale();
    this.ready = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
  }

  _noiseBuffer() {
    const ctx = this.ctx, len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  _impulse(sec, decay) {
    const ctx = this.ctx, rate = ctx.sampleRate, len = Math.floor(rate * sec);
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  /** Output strip: gain → (panner) → sfx bus, plus reverb / delay sends. */
  _out(pan = 0, send = 0.45, delay = 0) {
    const ctx = this.ctx, g = ctx.createGain();
    let node = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); node = p; }
    node.connect(this.sfxBus);
    if (send > 0) { const s = ctx.createGain(); s.gain.value = send; node.connect(s); s.connect(this.reverb); }
    if (delay > 0) { const d = ctx.createGain(); d.gain.value = delay; node.connect(d); d.connect(this.delayIn); }
    return g;
  }
  _osc(type, freq, t0, dur, peak, out, attack = 0.005, freqEnd = 0) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(out);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  _noise(t0, dur, { type = 'bandpass', f0 = 800, f1 = 4000, q = 1.2, peak = 0.2, attack = 0.03, out }) {
    const ctx = this.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise; src.loop = true;
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t0, Math.random() * 1.5); src.stop(t0 + dur + 0.05);
  }

  // ------------------------------------------------------------ primitives
  /** Inharmonic bell partials — the signature "chime". */
  chime(freq, { pan = 0, vel = 0.6, bright = 0.5, dur = 2.4, delay = 0.25, when = 0 } = {}) {
    if (!this.ready) return;
    const t = this.now + when, out = this._out(pan, 0.55, delay);
    const parts = [[1, 1], [2, 0.28 + bright * 0.3], [2.76, 0.04 + 0.22 * bright], [5.4, 0.1 * bright], [8.93, 0.05 * bright]];
    const nyquist = this.ctx.sampleRate * 0.45;
    parts.forEach(([r, a], i) => { if (a > 0.003 && freq * r < nyquist) this._osc('sine', freq * r, t, dur / (1 + i * 0.7), a * vel * 0.2, out, 0.004); });
  }
  /** Crystalline swell: soft-attack cluster + rising airy noise. */
  swell(freq, { pan = 0, vel = 0.5, dur = 1.5, when = 0 } = {}) {
    if (!this.ready) return;
    const t = this.now + when, out = this._out(pan, 0.7, 0.3);
    [1, 1.5, 2, 3, 4].forEach((r, i) => this._osc(i % 2 ? 'triangle' : 'sine', freq * r, t, dur, vel * 0.07 / (1 + i * 0.4), out, dur * 0.3));
    this._noise(t, dur, { f0: 1500, f1: 8000, q: 3, peak: vel * 0.05, attack: dur * 0.4, out });
  }

  // ------------------------------------------------------------ sfx vocabulary
  hover() {
    if (!this.ready || this.now - this.lastHover < 0.07) return;
    this.lastHover = this.now;
    this.chime(mtof(this.degreeToMidi(7, 2)), { vel: 0.12, bright: 0.2, dur: 0.5, delay: 0 });
  }
  primed() { this.chime(mtof(this.degreeToMidi(9, 2)), { vel: 0.22, bright: 0.6, dur: 0.9 }); }
  tick(pan = 0, vel = 0.15) {
    if (!this.ready || this.now - this.lastTick < 0.03) return;
    this.lastTick = this.now;
    this._osc('sine', 2400, this.now, 0.05, vel * 0.25, this._out(pan, 0.2));
  }
  pinch(x01, y01) {
    const f = this.noteFromY(y01, 1), pan = x01 * 2 - 1;
    this.chime(f * 2, { pan, vel: 0.42, bright: 0.85, dur: 1.4 });
    this.swell(f, { pan, vel: 0.28, dur: 0.8 });
  }
  select() {
    const r = mtof(this.degreeToMidi(0, 1));
    this.swell(r, { vel: 0.6, dur: 1.6 });
    [0, 2, 4].forEach((d, i) => this.chime(mtof(this.degreeToMidi(d + 5, 1)), { vel: 0.35, bright: 0.8, when: i * 0.06 }));
  }
  release(pan = 0) {
    if (!this.ready) return;
    const t = this.now, out = this._out(pan, 0.5);
    this._noise(t, 0.6, { f0: 3200, f1: 380, q: 0.9, peak: 0.16, attack: 0.02, out });
    this.chime(mtof(this.degreeToMidi(2, 1)), { pan, vel: 0.18, bright: 0.2, dur: 1.2 });
  }
  whoosh(dir = 1) {
    if (!this.ready) return;
    const t = this.now, out = this._out(dir * 0.5, 0.6);
    this._noise(t, 0.7, { f0: 400, f1: 3600, q: 1.4, peak: 0.22, attack: 0.25, out });
    this.chime(mtof(this.degreeToMidi(dir > 0 ? 4 : 2, 1)), { pan: dir * 0.6, vel: 0.2, when: 0.2 });
  }
  rune(shape) {
    if (!this.ready) return;
    const seq = { circle: [0, 2, 4, 7, 9], triangle: [0, 4, 7, 11, 14], spiral: [9, 7, 4, 2, 0, -3] }[shape] || [0, 2, 4];
    seq.forEach((d, i) => this.chime(mtof(this.degreeToMidi(d + 5, 1)), { vel: 0.4, bright: 0.9, pan: (i / seq.length) * 1.4 - 0.7, when: i * 0.07 }));
    this.swell(mtof(this.degreeToMidi(0, 0)), { vel: 0.7, dur: 2 });
    const t = this.now, out = this._out(0, 0.5);
    this._osc('sine', 140, t, 1.2, 0.35, out, 0.01, 38);
  }
  fizzle() {
    if (!this.ready) return;
    const t = this.now, out = this._out(0, 0.4);
    this._noise(t, 0.5, { type: 'lowpass', f0: 1400, f1: 180, q: 4, peak: 0.12, out });
    this._osc('sawtooth', 320, t, 0.45, 0.04, out, 0.01, 90);
  }
  combo(n) {
    const d = Math.min(n, 14);
    this.chime(mtof(this.degreeToMidi(d + 3, 1)), { vel: 0.4, bright: 0.9, dur: 1.6 });
    if (n % 5 === 0) this.select();
  }
  lock(pan = 0) {
    this.tick(pan, 0.4);
    this.chime(mtof(this.degreeToMidi(7, 2)), { pan, vel: 0.3, bright: 0.9, dur: 1.1 });
  }
  miss() {
    if (!this.ready) return;
    const t = this.now, out = this._out(0, 0.3);
    this._osc('sine', 170, t, 0.6, 0.4, out, 0.005, 55);
    this._noise(t, 0.35, { type: 'lowpass', f0: 600, f1: 120, q: 1, peak: 0.12, out });
  }
  bloom() {
    [0, 2, 4, 7, 9].forEach((d, i) => this.chime(mtof(this.degreeToMidi(d + 5, 1)), { vel: 0.28, bright: 1, pan: i * 0.3 - 0.6, when: i * 0.045, dur: 2.8 }));
  }
  levitate() {
    if (!this.ready) return;
    const t = this.now, out = this._out(0, 0.7, 0.3);
    this._osc('sine', 420, t, 1.1, 0.08, out, 0.3, 1260);
    this.chime(mtof(this.degreeToMidi(9, 1)), { vel: 0.2, when: 0.25 });
  }
  portal() {
    if (!this.ready) return;
    const t = this.now, out = this._out(0, 0.8);
    this._osc('sine', 60, t, 2.2, 0.3, out, 0.4, 220);
    this._noise(t, 1.6, { f0: 200, f1: 6000, q: 0.8, peak: 0.12, attack: 1.2, out });
    this.swell(mtof(this.degreeToMidi(0, 1)), { vel: 0.5, dur: 2 });
  }
  victory() { [0, 2, 4, 5, 7, 9, 10].forEach((d, i) => this.chime(mtof(this.degreeToMidi(d + 3, 1)), { vel: 0.4, bright: 1, when: i * 0.09, dur: 3 })); }
  absorb(type) {
    if (type === 'wisp') this.bloom();
    else if (type === 'fire') { this.swell(mtof(this.degreeToMidi(2, 0)), { vel: 0.5, dur: 0.9 }); this.release(0); }
    else this.levitate();
  }

  // ------------------------------------------------------------ expanded vocabulary
  /** Soft per-gesture confirmation blip; pitch identifies the gesture family. */
  gestureCue(kind) {
    if (!this.ready || this.now - (this.lastCue || 0) < 0.12) return;
    this.lastCue = this.now;
    const deg = { peace: 9, thumbsUp: 11, fistHoldStart: 2, frameStart: 7, winkL: 5, winkR: 6, doubleBlink: 12, nod: 8, shake: 1, puffRelease: 0 }[kind] ?? 7;
    const t = this.now, out = this._out(0, 0.35);
    this._osc('sine', mtof(this.degreeToMidi(deg, 2)), t, 0.18, 0.05, out, 0.004);
    this._osc('triangle', mtof(this.degreeToMidi(deg, 1)), t, 0.12, 0.03, out, 0.004);
  }
  /** UI click: crisp and short. */
  click(pan = 0) {
    if (!this.ready) return;
    const t = this.now, out = this._out(pan, 0.15);
    this._osc('sine', 1800, t, 0.04, 0.06, out, 0.002, 900);
    this._noise(t, 0.03, { type: 'highpass', f0: 4000, f1: 6000, q: 0.7, peak: 0.04, attack: 0.002, out });
  }
  /** A warm sustained chord from absolute MIDI notes. */
  chord(midis, { vel = 0.5, dur = 1.8, pan = 0, when = 0, bright = 0.5 } = {}) {
    if (!this.ready) return;
    const t = this.now + when, out = this._out(pan, 0.6, 0.15);
    midis.forEach((m, i) => {
      const f = mtof(m), a = vel * 0.06 / (1 + i * 0.25);
      this._osc('sine', f, t + i * 0.012, dur, a, out, 0.02);
      this._osc('triangle', f * 2, t + i * 0.012, dur * 0.6, a * 0.35 * bright, out, 0.02);
    });
  }
  /** Rising harmonic chord: each `step` climbs the progression and the octave. */
  harmonic(step, pan = 0) {
    const roots = [50, 55, 57, 59, 62, 64, 67, 69, 71, 74];
    const r = roots[Math.min(step, roots.length - 1)];
    this.chord([r, r + 4, r + 7, r + 12, r + 16], { vel: 0.7, dur: 2.4, pan, bright: 0.9 });
    this.chime(mtof(r + 24), { pan, vel: 0.35, bright: 1, dur: 2, when: 0.04 });
  }
  /** Glassy shatter: bright noise crack + scattered high partials. */
  shatter(pan = 0, vel = 0.6) {
    if (!this.ready) return;
    const t = this.now, out = this._out(pan, 0.5, 0.15);
    this._noise(t, 0.35, { type: 'highpass', f0: 5000, f1: 2500, q: 0.8, peak: 0.16 * vel, attack: 0.003, out });
    for (let i = 0; i < 5; i++) this._osc('sine', 2200 + Math.random() * 3800, t + Math.random() * 0.08, 0.3 + Math.random() * 0.4, 0.03 * vel, out, 0.002);
  }
  /** Camera shutter for snapshots. */
  shutter() {
    if (!this.ready) return;
    const t = this.now, out = this._out(0, 0.2);
    this._noise(t, 0.045, { type: 'bandpass', f0: 3000, f1: 2000, q: 1.5, peak: 0.25, attack: 0.002, out });
    this._noise(t + 0.09, 0.06, { type: 'bandpass', f0: 2200, f1: 1200, q: 1.5, peak: 0.2, attack: 0.002, out });
  }
  /** Soft rhythmic pulse (felt more than heard). */
  thump(vel = 0.6, pan = 0) {
    if (!this.ready) return;
    const t = this.now, out = this._out(pan, 0.15);
    this._osc('sine', 130, t, 0.35, 0.5 * vel, out, 0.003, 44);
    this._noise(t, 0.05, { type: 'lowpass', f0: 900, f1: 200, q: 0.8, peak: 0.08 * vel, attack: 0.002, out });
  }
  /** Airy tick used as a soft hi-hat in the pulse loop. */
  tickHat(vel = 0.3, pan = 0) {
    if (!this.ready) return;
    this._noise(this.now, 0.06, { type: 'highpass', f0: 7000, f1: 9000, q: 0.7, peak: 0.05 * vel, attack: 0.002, out: this._out(pan, 0.2) });
  }
  /** Shockwave / supernova: sub sweep + rushing noise. */
  boom(power = 1, pan = 0) {
    if (!this.ready) return;
    const t = this.now, out = this._out(pan, 0.7);
    this._osc('sine', 90, t, 1.1, 0.5 * power, out, 0.005, 30);
    this._noise(t, 0.9, { type: 'lowpass', f0: 3500, f1: 180, q: 0.7, peak: 0.22 * power, attack: 0.01, out });
    this.chime(mtof(this.degreeToMidi(0, 1)), { pan, vel: 0.25 * power, dur: 2 });
  }
  /** Gravity-well onset: a deep inward-bending swell. */
  well(pan = 0) {
    if (!this.ready) return;
    const t = this.now, out = this._out(pan, 0.7, 0.2);
    this._osc('sine', 220, t, 1.4, 0.18, out, 0.25, 70);
    this._osc('triangle', 330, t, 1.2, 0.06, out, 0.3, 110);
  }
  /** Time-freeze: a glassy descending shimmer. */
  freeze() {
    if (!this.ready) return;
    [12, 9, 7, 4, 2].forEach((d, i) => this.chime(mtof(this.degreeToMidi(d, 1)), { vel: 0.25, bright: 1, dur: 2.4, when: i * 0.05, pan: 0.6 - i * 0.3 }));
  }
  /** Warm plucked note (triangle body + filtered saw bite). */
  pluck(freq, { pan = 0, vel = 0.5, dur = 1.2, bright = 0.5, when = 0 } = {}) {
    if (!this.ready) return;
    const ctx = this.ctx, t = this.now + when, out = this._out(pan, 0.5, 0.25);
    this._osc('triangle', freq, t, dur, vel * 0.16, out, 0.004);
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = freq;
    f.type = 'lowpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(freq * (2 + bright * 6), t); f.frequency.exponentialRampToValueAtTime(freq * 1.2, t + dur * 0.6);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.05, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.7);
    o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + dur);
  }
  /** Lower the ambient pad (0 = silent, 1 = normal), e.g. while an instrument plays. */
  duckPad(level = 1) {
    if (!this.ready || !this.padOut) return;
    this.padOut.gain.setTargetAtTime(Math.max(0.0001, 0.85 * level), this.now, 0.4);
  }

  // ------------------------------------------------------------ continuous voices
  _buildPad() {
    const ctx = this.ctx;
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass'; this.padFilter.frequency.value = this.scale.cutoff; this.padFilter.Q.value = 0.8;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 0.07; lfoG.gain.value = 320;
    lfo.connect(lfoG).connect(this.padFilter.frequency); lfo.start();
    this.padOut = ctx.createGain(); this.padOut.gain.value = 0.0001;
    this.padOut.gain.exponentialRampToValueAtTime(0.85, ctx.currentTime + 5);
    this.padFilter.connect(this.padOut);
    this.padOut.connect(this.master);
    const send = ctx.createGain(); send.gain.value = 0.7; this.padOut.connect(send).connect(this.reverb);
    this.voices = [];
    for (let i = 0; i < 4; i++) {
      const g = ctx.createGain(); g.gain.value = 0.032;
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'triangle'; o1.detune.value = -7; o2.detune.value = 7;
      o1.connect(g); o2.connect(g); g.connect(this.padFilter);
      o1.start(); o2.start();
      this.voices.push({ o1, o2, g });
    }
    this._nextChord(true);
  }
  _nextChord(immediate = false) {
    if (!this.voices) return;
    this.chordT = 0;
    this.chordIdx = immediate ? this.chordIdx : (this.chordIdx + 1 + (Math.random() * 2 | 0)) % PROGRESSION.length;
    const chord = PROGRESSION[this.chordIdx], t = this.now;
    chord.forEach((deg, i) => {
      const f = mtof(this.degreeToMidi(deg, i === 0 ? -1 : 0));
      const v = this.voices[i];
      v.o1.frequency.setTargetAtTime(f, t, 1.6);
      v.o2.frequency.setTargetAtTime(f * (i === 0 ? 2 : 1), t, 1.6);
    });
    this.padFilter.frequency.setTargetAtTime(this.scale.cutoff, t, 2);
  }
  _buildExhale() {
    const ctx = this.ctx, src = ctx.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    this.exFilter = ctx.createBiquadFilter(); this.exFilter.type = 'bandpass'; this.exFilter.frequency.value = 2000; this.exFilter.Q.value = 0.9;
    this.exGain = ctx.createGain(); this.exGain.gain.value = 0;
    src.connect(this.exFilter).connect(this.exGain);
    this.exGain.connect(this.master);
    const s = ctx.createGain(); s.gain.value = 0.5; this.exGain.connect(s).connect(this.reverb);
    src.start();
  }
  setExhale(amount, kind) {
    if (!this.ready) return;
    const t = this.now;
    this.exGain.gain.setTargetAtTime(clamp(amount) * 0.16, t, 0.06);
    this.exFilter.frequency.setTargetAtTime((EXHALE_FILTER[kind] || 1800) * (0.7 + amount * 0.6), t, 0.1);
  }

  setMood(key) {
    if (!SCALES[key] || key === this.scaleKey) return;
    this.scaleKey = key;
    this._nextChord(true);
  }
  setVolume(v) {
    this.volume = clamp(v);
    if (this.ready && !this.muted) this.master.gain.setTargetAtTime(this.volume, this.now, 0.05);
  }
  setMuted(m) {
    this.muted = m;
    if (this.ready) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.now, 0.08);
  }
  update(dt) {
    if (!this.ready) return;
    this.chordT += dt;
    if (this.chordT > 9) this._nextChord();
  }
}
