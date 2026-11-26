// ---------------------------------------------------------------------------
// Mood Resonance: samples expression signals over a rolling 4 s window and
// blends four moods. The weights steer the tapestry palette, flow speed and
// the musical scale of the soundscape.
// ---------------------------------------------------------------------------
import { alphaFor } from '../core/util.js';

export const MOODS = {
  calm: { label: 'Calm', color: [110, 170, 255], hex: '#6eaaff', flow: 0.7, bright: 0.92 },
  joyful: { label: 'Joyful', color: [255, 196, 96], hex: '#ffc460', flow: 1.25, bright: 1.15 },
  focused: { label: 'Focused', color: [150, 110, 255], hex: '#966eff', flow: 0.85, bright: 0.95 },
  surprised: { label: 'Surprised', color: [255, 110, 210], hex: '#ff6ed2', flow: 1.6, bright: 1.2 },
};
const KEYS = Object.keys(MOODS);

export class Mood {
  constructor() {
    this.samples = []; this.acc = 0;
    this.w = { calm: 1, joyful: 0, focused: 0, surprised: 0 };
    this.dominant = 'calm'; this.changed = false;
    this.color = [...MOODS.calm.color]; this.flow = MOODS.calm.flow; this.bright = MOODS.calm.bright;
  }

  update(dt, t, v, motion) {
    this.changed = false;
    this.acc += dt;
    if (this.acc > 1 / 15) {
      this.acc = 0;
      this.samples.push({ t, s: v.smile, b: v.brows, m: v.mouth, d: v.browDown, q: v.squint, mo: motion });
    }
    while (this.samples.length && t - this.samples[0].t > 4) this.samples.shift();
    const n = this.samples.length || 1;
    const avg = { s: 0, b: 0, m: 0, d: 0, q: 0, mo: 0 };
    for (const s of this.samples) for (const k in avg) avg[k] += s[k];
    for (const k in avg) avg[k] /= n;

    const score = {
      calm: 0.32,
      joyful: avg.s * 1.5,
      surprised: avg.b * 0.8 + avg.m * 0.7,
      focused: avg.d * 1.3 + avg.q * 0.6 + (avg.mo < 0.15 ? 0.06 : 0),
    };
    const sum = KEYS.reduce((s, k) => s + score[k], 0);
    const a = alphaFor(dt, 2.2);
    for (const k of KEYS) this.w[k] += (score[k] / sum - this.w[k]) * a;

    let best = this.dominant;
    for (const k of KEYS) if (this.w[k] > this.w[best] + 0.06) best = k;
    if (best !== this.dominant) { this.dominant = best; this.changed = true; }

    this.color = [0, 0, 0]; this.flow = 0; this.bright = 0;
    for (const k of KEYS) {
      const m = MOODS[k], w = this.w[k];
      this.color[0] += m.color[0] * w; this.color[1] += m.color[1] * w; this.color[2] += m.color[2] * w;
      this.flow += m.flow * w; this.bright += m.bright * w;
    }
  }
}
