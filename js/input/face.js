// ---------------------------------------------------------------------------
// Face landmarks + blendshapes → expressive signals.
//  • Expressions are baseline-corrected (a slow min-tracker learns your
//    resting face) so thresholds work across different faces.
//  • Blink = both eyes closed 0.2–0.9 s (deliberate, not a natural blink).
//  • Wink  = one eye closed 0.18–1 s while the other stays open.
//  • Eyes closed > 1.1 s → "eyesClosedLong".
//  • Double blink = two short closures (natural or deliberate) within 0.75 s.
//  • Head tilt = roll of the eye line in screen space.
//  • Yaw / pitch are measured against a slowly-adapting neutral pose, which
//    drives head-nod ("yes") and head-shake ("no") detection.
//  • Cheek puff comes from the cheekPuff blendshape (baseline-corrected).
// ---------------------------------------------------------------------------
import { mapper } from './mapper.js';
import { gazeFeature } from './gaze.js';
import { alphaFor, clamp } from '../core/util.js';

export class FaceTracker {
  constructor(gaze) {
    this.gaze = gaze;
    this.lastStamp = 0; this.lastSeen = -10;
    this.base = {};
    this.raw = {};
    this.target = new Float32Array(478 * 2);
    this.face = {
      present: false, x: 0, y: 0, mouthX: 0, mouthY: 0, width: 200,
      smile: 0, mouth: 0, brows: 0, browDown: 0, squint: 0,
      tilt: 0, blinkL: 0, blinkR: 0, eyesClosed: false, puff: 0, yaw: 0, pitch: 0,
      pts: new Float32Array(478 * 2), hasPts: false,
    };
    this.eyes = { L: false, R: false };
    this.both = { on: false, t0: 0, long: false };
    this.wink = { L: { on: false, t0: 0, spoiled: false }, R: { on: false, t0: 0, spoiled: false } };
    this.openBase = { L: 0.1, R: 0.1 };
    this.vals = { smile: 0, mouth: 0, brows: 0, browDown: 0, squint: 0, puff: 0 };
    this.head = { since: 0, neutral: null, yaw: 0, pitch: 0, slowNoseY: 0 };
    this.nod = { armed: false, dir: 0, t0: 0, last: -10 };
    this.shake = { side: 0, flips: [], last: -10 };
    this.closures = [];
  }

  update(result, stamp, dt, t, events) {
    const f = this.face;
    if (result && stamp !== this.lastStamp) {
      this.lastStamp = stamp;
      const L = result.faceLandmarks?.[0];
      if (L) this._ingest(result, L, t, events);
    }
    if (t - this.lastSeen > 0.5) {
      if (f.present) { f.present = false; f.eyesClosed = false; for (const k in this.vals) this.vals[k] = 0; }
      return;
    }
    // per-frame smoothing toward latest sample
    const a = alphaFor(dt, 0.05);
    const P = f.pts, T = this.target;
    for (let i = 0; i < P.length; i++) P[i] += (T[i] - P[i]) * a;
    const ea = alphaFor(dt, 0.06);
    for (const k in this.vals) f[k] += (this.vals[k] - f[k]) * ea;
    const cx = (P[168 * 2] + P[1 * 2]) / 2, cy = (P[168 * 2 + 1] + P[1 * 2 + 1]) / 2;
    f.x = cx; f.y = cy;
    f.mouthX = (P[13 * 2] + P[14 * 2]) / 2; f.mouthY = (P[13 * 2 + 1] + P[14 * 2 + 1]) / 2;
    f.width = Math.hypot(P[454 * 2] - P[234 * 2], P[454 * 2 + 1] - P[234 * 2 + 1]);
    // Screen-left eye is the subject's left eye (263); screen-right is 33.
    const lx = P[263 * 2], ly = P[263 * 2 + 1], rx = P[33 * 2], ry = P[33 * 2 + 1];
    const tilt = Math.atan2(ry - ly, rx - lx);
    f.tilt += (tilt - f.tilt) * alphaFor(dt, 0.12);
  }

  _ingest(result, L, t, events) {
    const f = this.face;
    const dtS = clamp(t - this.lastSeen, 0.016, 0.2);
    const firstSeen = !f.present;
    this.lastSeen = t;
    f.present = true;
    const tmp = { x: 0, y: 0 };
    const n = Math.min(478, L.length);
    for (let i = 0; i < n; i++) {
      mapper.toScreen(L[i].x, L[i].y, tmp);
      this.target[i * 2] = tmp.x; this.target[i * 2 + 1] = tmp.y;
    }
    if (firstSeen || !f.hasPts) { f.pts.set(this.target); f.hasPts = true; }

    // Blendshapes
    const cats = result.faceBlendshapes?.[0]?.categories || [];
    const raw = this.raw;
    for (const c of cats) raw[c.categoryName] = c.score;
    const g = (k) => raw[k] || 0;
    const adj = (key, v) => {
      // min-tracker baseline: falls quickly, rises very slowly
      let b = this.base[key]; if (b === undefined) b = v;
      b += (v - b) * alphaFor(dtS, v < b ? 0.4 : 25);
      this.base[key] = b;
      const bb = Math.min(b, 0.6) * 0.9;
      return clamp((v - bb) / (1 - bb));
    };
    this.vals.smile = adj('smile', (g('mouthSmileLeft') + g('mouthSmileRight')) / 2);
    this.vals.mouth = adj('mouth', g('jawOpen'));
    this.vals.brows = adj('brows', Math.max(g('browInnerUp'), (g('browOuterUpLeft') + g('browOuterUpRight')) / 2));
    this.vals.browDown = adj('browDown', (g('browDownLeft') + g('browDownRight')) / 2);
    this.vals.squint = adj('squint', (g('eyeSquintLeft') + g('eyeSquintRight')) / 2);
    this.vals.puff = adj('puff', g('cheekPuff'));

    // Eyes: adaptive open-level baseline, hysteretic closed state
    const bl = g('eyeBlinkLeft'), br = g('eyeBlinkRight');
    f.blinkL = bl; f.blinkR = br;
    const eye = (side, v) => {
      if (v < 0.4) this.openBase[side] += (v - this.openBase[side]) * alphaFor(dtS, 2.5);
      const thr = clamp(this.openBase[side] + 0.28, 0.42, 0.72);
      return this.eyes[side] ? v > thr - 0.12 : v > thr;
    };
    const lc = (this.eyes.L = eye('L', bl));
    const rc = (this.eyes.R = eye('R', br));
    f.eyesClosed = lc && rc;

    const B = this.both;
    if (lc && rc) {
      if (!B.on) { B.on = true; B.t0 = t; B.long = false; }
      if (!B.long && t - B.t0 > 1.1) { B.long = true; events.push({ type: 'eyesClosedLong' }); }
    } else if (B.on && !lc && !rc) {
      B.on = false;
      const dur = t - B.t0;
      if (!B.long) events.push({ type: dur >= 0.2 && dur <= 0.9 ? 'blink' : 'blinkSoft' });
      // Double blink: two short closures close together.
      if (dur < 0.55) {
        this.closures = this.closures.filter((c) => t - c < 0.75);
        this.closures.push(t);
        if (this.closures.length >= 2) { this.closures.length = 0; events.push({ type: 'doubleBlink' }); }
      }
    }
    for (const [side, closed, other] of [['L', lc, rc], ['R', rc, lc]]) {
      const w = this.wink[side];
      if (closed && !other && !w.on) { w.on = true; w.t0 = t; w.spoiled = false; }
      if (w.on && other) w.spoiled = true;
      if (w.on && !closed) {
        w.on = false;
        const dur = t - w.t0;
        if (!w.spoiled && dur >= 0.18 && dur <= 1.0) events.push({ type: side === 'L' ? 'winkL' : 'winkR' });
      }
    }

    this.gaze.ingest(gazeFeature(L, mapper.vw, mapper.vh), lc || rc);
    this._headPose(L, t, dtS, firstSeen, events);
  }

  /** Yaw / pitch relative to a neutral pose learned in the first second, then nod / shake. */
  _headPose(L, t, dt, firstSeen, events) {
    const T = this.target, H = this.head, f = this.face;
    const P = (i) => ({ x: T[i * 2], y: T[i * 2 + 1] });
    const eR = P(33), eL = P(263), nose = P(1), chin = P(152), cR = P(234), cL = P(454);
    const faceW = Math.max(30, Math.hypot(cR.x - cL.x, cR.y - cL.y));
    const em = { x: (eR.x + eL.x) / 2, y: (eR.y + eL.y) / 2 };
    const axLen = Math.max(20, Math.hypot(chin.x - em.x, chin.y - em.y));
    const ax = { x: (chin.x - em.x) / axLen, y: (chin.y - em.y) / axLen };
    const roll = Math.atan2(eR.y - eL.y, eR.x - eL.x);
    const cm = { x: (cR.x + cL.x) / 2, y: (cR.y + cL.y) / 2 };
    const ox = nose.x - cm.x, oy = nose.y - cm.y;
    const yaw = (ox * Math.cos(-roll) - oy * Math.sin(-roll)) / (faceW / 2);
    const pitch = ((nose.x - em.x) * ax.x + (nose.y - em.y) * ax.y) / axLen;
    const a = alphaFor(dt, 0.06);
    if (firstSeen || !H.neutral) {
      H.since = t; H.neutral = { yaw, pitch }; H.yaw = yaw; H.pitch = pitch; H.slowNoseY = nose.y;
      return;
    }
    H.yaw += (yaw - H.yaw) * a; H.pitch += (pitch - H.pitch) * a;
    const n = H.neutral, calibrating = t - H.since < 1;
    const k = calibrating ? alphaFor(dt, 0.2) : alphaFor(dt, 6);
    if (calibrating || Math.abs(H.yaw - n.yaw) < 0.1) n.yaw += (H.yaw - n.yaw) * k;
    if (calibrating || Math.abs(H.pitch - n.pitch) < 0.05) n.pitch += (H.pitch - n.pitch) * k;
    H.slowNoseY += (nose.y - H.slowNoseY) * alphaFor(dt, 0.6);
    f.yaw = H.yaw - n.yaw;
    f.pitch = (H.pitch - n.pitch) + 0.5 * (nose.y - H.slowNoseY) / axLen;
    if (calibrating) return;
    this._nod(f.pitch, t, events);
    this._shake(f.yaw, t, events);
  }

  /** Down-and-up (or up-and-down) within ~1 s. Holding the head down is not a nod. */
  _nod(p, t, events) {
    const s = this.nod, A = 0.05, sg = Math.sign(p);
    if (!s.armed) {
      if (Math.abs(p) > A) { s.armed = true; s.dir = sg; s.t0 = t; }
    } else if (Math.abs(p) < A * 0.4 || sg === -s.dir) {
      if (t - s.t0 < 1 && t - s.last > 0.65 && t - this.shake.last > 0.8) { s.last = t; events.push({ type: 'nod' }); }
      s.armed = false;
    } else if (t - s.t0 > 1.3) s.armed = false;
  }

  /** Left-right-left: two side-to-side reversals within 1.1 s. */
  _shake(y, t, events) {
    const s = this.shake, A = 0.13;
    const side = y > A ? 1 : y < -A ? -1 : 0;
    if (side && side !== s.side) { if (s.side) s.flips.push(t); s.side = side; }
    while (s.flips.length && t - s.flips[0] > 1.1) s.flips.shift();
    if (s.flips.length >= 2 && t - s.last > 1.1) { s.last = t; s.flips.length = 0; events.push({ type: 'shake' }); }
  }
}
