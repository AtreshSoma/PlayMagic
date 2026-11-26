// ---------------------------------------------------------------------------
// Continuous voices for Cosmic Orchestra, built on the shared AudioEngine
// graph (master bus, reverb, delay). Everything is synthesised.
//   pad    five detuned saw/triangle pairs through one low-pass: the chord
//   swell  a warm two-oscillator synth whose level and brightness follow
//          how wide the mouth is open
// Plucked melody notes and arpeggios use AudioEngine.pluck(); the rhythmic
// pulse uses AudioEngine.thump() / tickHat().
// ---------------------------------------------------------------------------
import { mtof } from './audio.js';
import { clamp } from '../core/util.js';

export class OrchestraSynth {
  constructor(audio) { this.a = audio; this.live = false; }

  start() {
    const a = this.a, ctx = a.ctx;
    if (!ctx || this.live) return;
    this.live = true;
    const now = ctx.currentTime;
    this.out = ctx.createGain(); this.out.gain.value = 0.9;
    this.out.connect(a.master);
    const send = ctx.createGain(); send.gain.value = 0.55; this.out.connect(send).connect(a.reverb);

    // chord pad
    this.padF = ctx.createBiquadFilter(); this.padF.type = 'lowpass'; this.padF.frequency.value = 700; this.padF.Q.value = 0.7;
    this.padG = ctx.createGain(); this.padG.gain.value = 0.0001;
    this.padF.connect(this.padG).connect(this.out);
    this.oscs = [];
    this.voices = Array.from({ length: 5 }, (_, i) => {
      const g = ctx.createGain(); g.gain.value = 0.045 / (1 + i * 0.15);
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'triangle'; o1.detune.value = -6 - i; o2.detune.value = 6 + i;
      o1.frequency.value = o2.frequency.value = 220;
      o1.connect(g); o2.connect(g); g.connect(this.padF);
      o1.start(now); o2.start(now);
      this.oscs.push(o1, o2);
      return { o1, o2 };
    });

    // mouth swell
    this.swF = ctx.createBiquadFilter(); this.swF.type = 'lowpass'; this.swF.frequency.value = 300; this.swF.Q.value = 3;
    this.swG = ctx.createGain(); this.swG.gain.value = 0.0001;
    this.swF.connect(this.swG).connect(this.out);
    this.sw1 = ctx.createOscillator(); this.sw2 = ctx.createOscillator();
    this.sw1.type = 'sawtooth'; this.sw2.type = 'sawtooth'; this.sw2.detune.value = 1207;
    const sg = ctx.createGain(); sg.gain.value = 0.08;
    this.sw1.connect(sg); this.sw2.connect(sg); sg.connect(this.swF);
    this.sw1.start(now); this.sw2.start(now);
    this.oscs.push(this.sw1, this.sw2);
  }

  setChord(midis) {
    if (!this.live) return;
    const t = this.a.now;
    this.voices.forEach((v, i) => {
      const f = mtof(midis[i % midis.length] + (i >= midis.length ? 12 : 0));
      v.o1.frequency.setTargetAtTime(f, t, 0.06);
      v.o2.frequency.setTargetAtTime(f, t, 0.06);
    });
    this.sw1.frequency.setTargetAtTime(mtof(midis[0]), t, 0.1);
    this.sw2.frequency.setTargetAtTime(mtof(midis[0]), t, 0.1);
  }

  /** level 0..1 (chord hand present / auto), bright 0..1 (hand height). */
  setPad(level, bright) {
    if (!this.live) return;
    const t = this.a.now;
    this.padG.gain.setTargetAtTime(Math.max(0.0001, clamp(level) * 0.55), t, 0.25);
    this.padF.frequency.setTargetAtTime(380 + clamp(bright) * 2400, t, 0.15);
  }

  setSwell(amount) {
    if (!this.live) return;
    const t = this.a.now, k = clamp(amount);
    this.swG.gain.setTargetAtTime(Math.max(0.0001, k * 0.42), t, 0.08);
    this.swF.frequency.setTargetAtTime(220 + k * 2600, t, 0.08);
  }

  stop() {
    if (!this.live) return;
    this.live = false;
    const t = this.a.now;
    this.padG.gain.setTargetAtTime(0.0001, t, 0.2);
    this.swG.gain.setTargetAtTime(0.0001, t, 0.1);
    const oscs = this.oscs, out = this.out;
    setTimeout(() => { for (const o of oscs) { try { o.stop(); } catch { /* already stopped */ } } out.disconnect(); }, 1500);
  }
}
