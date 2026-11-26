// ---------------------------------------------------------------------------
// Face tracking → simple, forgiving signals for kids.
//
// Continuous:  steer (-1..1 from head tilt), mouth, smile, brows (0..1),
//              eyesClosed, head anchor for hats, mouth position.
// Events:      'blink' (either eye: winks count!), 'nod', 'shake', 'brows'.
//
// Every expression is measured relative to the child's own resting face:
// a slow lower-envelope baseline follows each blendshape, and head angles
// are calibrated during the first second the face is seen, then drift
// slowly so a child who sits a little crooked still steers straight.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { Smooth1, Smooth2, clamp, damp, sign, dist } from '../core/util.js';

const LOST_MS = 600;

export class FaceTracker {
  constructor() {
    this.present = false; this.seen = 0; this.since = 0;
    this.base = { blink: 0.12, jaw: 0.04, smile: 0.08, brow: 0.12 };
    this.blink = 0; this.eyesClosed = false; this.eyeL = 0; this.eyeR = 0; this.lastBlink = 0;
    this.mouth = 0; this.mouthOn = false;
    this.smile = 0; this.smileOn = false;
    this.brows = 0; this.browsOn = false; this.lastBrows = 0;
    this.rollS = new Smooth1(16); this.yawS = new Smooth1(16); this.pitchS = new Smooth1(16);
    this.neutral = { roll: 0, yaw: 0, pitch: 0.42 };
    this.roll = 0; this.yaw = 0; this.pitch = 0; this.steer = 0;
    this.slowNoseY = 0;
    this.nod = { armed: false, dir: 0, t0: 0, last: 0 };
    this.shake = { side: 0, flips: [], last: 0 };
    this.headS = new Smooth2(8, 30, 1200);
    this.angleS = new Smooth1(14); this.widthS = new Smooth1(10, 160);
    this.head = { x: 0, y: 0, w: 160, h: 200, angle: 0 };
    this.mouthPos = { x: 0, y: 0 };
    this.eyes = { l: { x: 0, y: 0 }, r: { x: 0, y: 0 } };
  }

  adapt(key, v, dt) {
    const b = this.base[key];
    // falls fast to the resting value, rises very slowly while an expression is held
    this.base[key] = v < b ? damp(b, v, 6, dt) : b + (v - b) * Math.min(1, dt * 0.07);
    return clamp((v - this.base[key]) / Math.max(0.3, 1 - this.base[key]));
  }

  ingest(result, now, emit) {
    const lm = result?.faceLandmarks?.[0];
    if (!lm) return;
    const returning = !this.present || now - this.seen > 1500;
    const dt = returning ? 0.033 : Math.min(0.12, Math.max(0.008, (now - this.seen) / 1000));
    if (returning) this.since = now;
    this.seen = now; this.present = true;
    const calibrating = now - this.since < 1000;

    // ---------------- blendshapes
    const bs = {};
    for (const c of result.faceBlendshapes?.[0]?.categories || []) bs[c.categoryName] = c.score;
    const L = bs.eyeBlinkLeft ?? 0, R = bs.eyeBlinkRight ?? 0;
    // a wink (one eye) counts as much as a blink, smiling squints do not
    const closedRaw = Math.max((L + R) / 2, Math.max(L, R) * 0.85);
    this.blink = this.adapt('blink', closedRaw, dt);
    this.eyeL = L; this.eyeR = R;
    const wasClosed = this.eyesClosed;
    if (!this.eyesClosed && this.blink > 0.42 && closedRaw > 0.38) this.eyesClosed = true;
    else if (this.eyesClosed && this.blink < 0.22) this.eyesClosed = false;
    if (this.eyesClosed && !wasClosed && now - this.lastBlink > 240 && !calibrating) {
      this.lastBlink = now; emit('blink');
    }

    this.mouth = clamp(this.adapt('jaw', bs.jawOpen ?? 0, dt) / 0.55);
    if (!this.mouthOn && this.mouth > 0.5) this.mouthOn = true; else if (this.mouthOn && this.mouth < 0.3) this.mouthOn = false;

    this.smile = clamp(this.adapt('smile', ((bs.mouthSmileLeft ?? 0) + (bs.mouthSmileRight ?? 0)) / 2, dt) / 0.6);
    if (!this.smileOn && this.smile > 0.55) this.smileOn = true; else if (this.smileOn && this.smile < 0.35) this.smileOn = false;

    const browRaw = Math.max(bs.browInnerUp ?? 0, ((bs.browOuterUpLeft ?? 0) + (bs.browOuterUpRight ?? 0)) / 2);
    this.brows = clamp(this.adapt('brow', browRaw, dt) / 0.5);
    const wasBrows = this.browsOn;
    if (!this.browsOn && this.brows > 0.55) this.browsOn = true; else if (this.browsOn && this.brows < 0.3) this.browsOn = false;
    if (this.browsOn && !wasBrows && now - this.lastBrows > 700 && !calibrating) { this.lastBrows = now; emit('brows'); }

    // ---------------- head geometry (screen space, mirrored like the mirror)
    const P = (i) => app.mapFace(lm[i].x, lm[i].y);
    const eR = P(33), eL = P(263), nose = P(1), chin = P(152), top = P(10), cR = P(234), cL = P(454);
    const m1 = P(13), m2 = P(14);
    this.eyes.r = eR; this.eyes.l = eL;
    this.mouthPos.x = (m1.x + m2.x) / 2; this.mouthPos.y = (m1.y + m2.y) / 2;
    const faceW = Math.max(30, dist(cR.x, cR.y, cL.x, cL.y));
    const eyeMid = { x: (eR.x + eL.x) / 2, y: (eR.y + eL.y) / 2 };
    const axLen = Math.max(20, dist(eyeMid.x, eyeMid.y, chin.x, chin.y));
    const ax = { x: (chin.x - eyeMid.x) / axLen, y: (chin.y - eyeMid.y) / axLen };

    // roll > 0 = head tipped toward the screen's right; yaw > 0 = turned right
    const roll = Math.atan2(eR.y - eL.y, eR.x - eL.x);
    const cm = { x: (cR.x + cL.x) / 2, y: (cR.y + cL.y) / 2 };
    const ox = nose.x - cm.x, oy = nose.y - cm.y;
    const yaw = (ox * Math.cos(-roll) - oy * Math.sin(-roll)) / (faceW / 2);
    const pitch = ((nose.x - eyeMid.x) * ax.x + (nose.y - eyeMid.y) * ax.y) / axLen;

    this.roll = this.rollS.update(roll, dt);
    this.yaw = this.yawS.update(yaw, dt);
    this.pitch = this.pitchS.update(pitch, dt);
    const n = this.neutral;
    if (calibrating || returning) {
      const k = returning ? 1 : 6;
      n.roll = returning ? roll : damp(n.roll, this.roll, k, dt);
      n.yaw = returning ? yaw : damp(n.yaw, this.yaw, k, dt);
      n.pitch = returning ? pitch : damp(n.pitch, this.pitch, k, dt);
      this.slowNoseY = nose.y;
    } else {
      // slow drift toward the current pose only while it's near neutral
      if (Math.abs(this.roll - n.roll) < 0.1) n.roll = damp(n.roll, this.roll, 0.15, dt);
      if (Math.abs(this.yaw - n.yaw) < 0.1) n.yaw = damp(n.yaw, this.yaw, 0.15, dt);
      if (Math.abs(this.pitch - n.pitch) < 0.05) n.pitch = damp(n.pitch, this.pitch, 0.25, dt);
    }
    const rollD = this.roll - n.roll, yawD = this.yaw - n.yaw;
    this.slowNoseY = damp(this.slowNoseY, nose.y, 1.6, dt);
    const pitchD = (this.pitch - n.pitch) + 0.5 * (nose.y - this.slowNoseY) / axLen;

    // steering: mostly tilt, a little turn, small dead zone, full lock at ~17°
    const raw = rollD / 0.3 + (yawD / 0.5) * 0.35;
    this.steer = clamp(sign(raw) * Math.max(0, Math.abs(raw) - 0.1) / 0.9, -1, 1);

    if (!calibrating) {
      this.detectNod(pitchD, now, emit);
      this.detectShake(yawD, now, emit);
    }

    // hat anchor: just above the forehead, rotated with the head
    const up = { x: -ax.x, y: -ax.y };
    const faceH = dist(top.x, top.y, chin.x, chin.y);
    const hx = top.x + up.x * faceH * 0.04, hy = top.y + up.y * faceH * 0.04;
    if (returning) this.headS.reset(hx, hy); else this.headS.update(hx, hy, dt);
    this.head.x = this.headS.x; this.head.y = this.headS.y;
    this.head.angle = this.angleS.update(roll, dt);
    this.head.w = this.widthS.update(faceW, dt);
    this.head.h = faceH;
  }

  /** Down-and-up (or up-and-down) within ~1 s. Holding the head down is not a nod. */
  detectNod(p, now, emit) {
    const s = this.nod, A = 0.05;
    if (!s.armed) {
      if (Math.abs(p) > A) { s.armed = true; s.dir = sign(p); s.t0 = now; }
    } else {
      if (Math.abs(p) < A * 0.4 || sign(p) === -s.dir) {
        if (now - s.t0 < 1000 && now - s.last > 650) { s.last = now; emit('nod'); }
        s.armed = false;
      } else if (now - s.t0 > 1300) s.armed = false;
    }
  }

  /** Left-right-left: two side-to-side reversals within 1.1 s. */
  detectShake(y, now, emit) {
    const s = this.shake, A = 0.13;
    const side = y > A ? 1 : y < -A ? -1 : 0;
    if (side && side !== s.side) {
      if (s.side) s.flips.push(now);
      s.side = side;
    }
    while (s.flips.length && now - s.flips[0] > 1100) s.flips.shift();
    if (s.flips.length >= 2 && now - s.last > 1100) { s.last = now; s.flips.length = 0; emit('shake'); }
  }

  tick(now) {
    if (this.present && now - this.seen > LOST_MS) {
      this.present = false;
      this.mouthOn = this.smileOn = this.browsOn = this.eyesClosed = false;
      this.mouth = this.smile = this.brows = 0; this.steer = 0;
    }
  }
}
