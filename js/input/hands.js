// ---------------------------------------------------------------------------
// Hand tracking → gesture vocabulary.
// Raw MediaPipe samples arrive ~30 Hz; poses are classified per sample with
// hysteresis + debounce, while positions are EMA-smoothed every render frame
// so motion stays fluid at 60 FPS.
//   pinch     thumb tip ↔ index tip, normalised by hand size
//   open      all four fingers extended
//   pointing  index extended, middle + ring folded (rune casting pose)
//   fist      index/middle/ring curled (thumb tucked)
//   peace     index + middle extended, ring + pinky folded
//   thumbsUp  four fingers curled, thumb extended and pointing up
//   angle     wrist → middle-knuckle direction (0 = fingers straight up)
//   swipe     fast lateral / upward wrist flick
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { mapper } from './mapper.js';
import { Smooth2, alphaFor, clamp, angleWrap } from '../core/util.js';

const TIP = [4, 8, 12, 16, 20];
const PIP = [3, 6, 10, 14, 18];

export function makeHand(label, source = 'camera') {
  return {
    label, source, present: false, primary: false,
    x: 0, y: 0, vx: 0, vy: 0, speed: 0,
    pinch: false, tension: 0, pinchX: 0, pinchY: 0,
    open: false, pointing: false, fist: false, peace: false, thumbsUp: false,
    palmX: 0, palmY: 0, angle: 0, rawAngle: 0,
    pts: Array.from({ length: 21 }, () => ({ x: 0, y: 0 })),
    raw: Array.from({ length: 21 }, () => ({ x: 0, y: 0 })),
    rawCursor: { x: 0, y: 0 }, rawPalm: { x: 0, y: 0 },
    scale: 80, lastSample: 0, lostT: 1,
    poseT: { open: 0, point: 0, fist: 0, peace: 0, thumb: 0, unpinch: 0 },
    smooth: new Smooth2(0.085, 0.022, 1600),
    palmSmooth: new Smooth2(0.06, 0.02, 1600),
    fresh: true,
  };
}

const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class HandTracker {
  constructor() {
    this.hands = { Left: makeHand('Left'), Right: makeHand('Right') };
    this.lastStamp = 0;
    this.swipeHist = [];
    this.swipeCool = 0;
  }

  list() { return [this.hands.Left, this.hands.Right]; }

  /** Ingest a new inference result (if any). */
  update(result, stamp, dt, t, events) {
    if (!result || stamp === this.lastStamp) return;
    this.lastStamp = stamp;
    const seen = { Left: false, Right: false };
    const n = result.landmarks?.length || 0;
    for (let i = 0; i < n; i++) {
      const cat = (result.handednesses || result.handedness)?.[i]?.[0];
      let label = cat?.categoryName === 'Left' ? 'Left' : 'Right';
      if (seen[label]) label = label === 'Left' ? 'Right' : 'Left';
      seen[label] = true;
      this._ingest(this.hands[label], result.landmarks[i], t, events);
    }
    for (const k of ['Left', 'Right']) if (!seen[k]) this.hands[k].lostT += 0.034;
  }

  _ingest(h, L, t, events) {
    const vw = mapper.vw, vh = mapper.vh;
    const P = (i) => ({ x: L[i].x * vw, y: L[i].y * vh }); // aspect-correct pixel space
    const sdt = clamp(t - h.lastSample, 0.016, 0.1);
    h.lastSample = t;
    h.lostT = 0;

    // Screen-mapped raw landmarks
    for (let i = 0; i < 21; i++) mapper.toScreen(L[i].x, L[i].y, h.raw[i]);

    const w = P(0);
    const scale = (d2(w, P(9)) + d2(P(5), P(17)) * 1.25) / 2;
    const ext = (f) => d2(w, P(TIP[f])) > d2(w, P(PIP[f])) * 1.12;
    const curl = (f) => d2(w, P(TIP[f])) < d2(w, P(PIP[f])) * 1.02;
    // Folded deep into the palm (tip nearer the wrist than its own knuckle): a fist, never a pinch.
    // A natural thumb-to-index pinch curls the index too, so plain curl() must NOT block pinching.
    const deep = (f) => d2(w, P(TIP[f])) < d2(w, P(TIP[f] - 3)) * 0.98;
    const pd = d2(P(4), P(8)) / scale;
    const tension = clamp(1 - (pd - 0.2) / 0.6);

    // Pinch with hysteresis (enter < .34, exit > .5). An index folded into the palm means fist, not pinch.
    const wasPinch = h.pinch;
    if (!h.pinch && pd < 0.34 && !deep(1)) h.pinch = true;
    else if (h.pinch && pd > 0.5) {
      h.poseT.unpinch += sdt;
      if (h.poseT.unpinch > 0.05) h.pinch = false;
    } else h.poseT.unpinch = 0;

    // Thumb: extended away from the index knuckle and pointing up (image y grows downward).
    const thumbOut = d2(P(4), P(5)) / scale > 0.55 && d2(w, P(4)) > d2(w, P(3)) * 1.05;
    const thumbUp = P(4).y < P(2).y - scale * 0.35 && P(4).y < P(5).y - scale * 0.15;
    const folded = (f) => !ext(f);
    const openRaw = ext(1) && ext(2) && ext(3) && ext(4) && !h.pinch && pd > 0.42;
    const pointRaw = ext(1) && !ext(2) && !ext(3) && !h.pinch;
    const peaceRaw = ext(1) && ext(2) && folded(3) && folded(4) && !h.pinch;
    const thumbRaw = thumbOut && thumbUp && folded(1) && folded(2) && folded(3) && folded(4);
    const fistRaw = curl(1) && curl(2) && curl(3) && !h.pinch && !thumbRaw;
    h.poseT.open = openRaw ? h.poseT.open + sdt : 0;
    h.poseT.point = pointRaw ? h.poseT.point + sdt : 0;
    h.poseT.fist = fistRaw ? h.poseT.fist + sdt : 0;
    h.poseT.peace = peaceRaw ? h.poseT.peace + sdt : 0;
    h.poseT.thumb = thumbRaw ? h.poseT.thumb + sdt : 0;
    const wasOpen = h.open;
    h.open = h.poseT.open > 0.07;
    h.pointing = h.poseT.point > 0.07 && !h.peace;
    h.fist = h.poseT.fist > 0.1;
    h.peace = h.poseT.peace > 0.1;
    h.thumbsUp = h.poseT.thumb > 0.12;
    // Wrist angle in screen space (mirrored like the reflection). 0 = fingers up, + = tipped clockwise.
    const a0 = h.raw[0], a9 = h.raw[9];
    h.rawAngle = Math.atan2(a9.x - a0.x, -(a9.y - a0.y));
    h.tension = tension;
    h.scale = scale;

    // Cursor: index tip, sliding toward the pinch midpoint as tension rises (no jump on pinch).
    const tip = h.raw[8], th = h.raw[4];
    const mx = (tip.x + th.x) / 2, my = (tip.y + th.y) / 2;
    const k = clamp((tension - 0.3) / 0.6);
    h.rawCursor.x = tip.x + (mx - tip.x) * k;
    h.rawCursor.y = tip.y + (my - tip.y) * k;
    const pr = [0, 5, 9, 17];
    h.rawPalm.x = pr.reduce((s, i) => s + h.raw[i].x, 0) / 4;
    h.rawPalm.y = pr.reduce((s, i) => s + h.raw[i].y, 0) / 4;

    if (!h.present) {
      h.present = true; h.fresh = true;
      h.smooth.reset(h.rawCursor.x, h.rawCursor.y);
      h.palmSmooth.reset(h.rawPalm.x, h.rawPalm.y);
      h.angle = h.rawAngle;
      for (let i = 0; i < 21; i++) { h.pts[i].x = h.raw[i].x; h.pts[i].y = h.raw[i].y; }
    }

    if (h.pinch && !wasPinch)
      events.push({ type: 'pinchStart', hand: h.label, x: h.smooth.x, y: h.smooth.y, primary: h.primary });
    if (!h.pinch && wasPinch)
      events.push({ type: 'pinchEnd', hand: h.label, x: h.smooth.x, y: h.smooth.y, primary: h.primary });
    if (h.open && !wasOpen)
      events.push({ type: 'palmOpen', hand: h.label, x: h.palmX, y: h.palmY, vx: h.vx, vy: h.vy, primary: h.primary });
  }

  /** Per-render-frame smoothing, loss handling and swipe detection. */
  frame(dt, t, events) {
    for (const h of this.list()) {
      if (!h.present) continue;
      if (h.lostT > 0.22 || t - h.lastSample > 0.3) { this._lose(h, events); continue; }
      const a = alphaFor(dt, 0.045);
      for (let i = 0; i < 21; i++) {
        h.pts[i].x += (h.raw[i].x - h.pts[i].x) * a;
        h.pts[i].y += (h.raw[i].y - h.pts[i].y) * a;
      }
      h.smooth.update(h.rawCursor.x, h.rawCursor.y, dt);
      h.palmSmooth.update(h.rawPalm.x, h.rawPalm.y, dt);
      h.x = h.smooth.x; h.y = h.smooth.y; h.vx = h.smooth.vx; h.vy = h.smooth.vy;
      h.speed = Math.hypot(h.vx, h.vy);
      h.palmX = h.palmSmooth.x; h.palmY = h.palmSmooth.y;
      h.pinchX = h.x; h.pinchY = h.y;
      h.angle += angleWrap(h.rawAngle - h.angle) * alphaFor(dt, 0.07);
      h.fresh = false;
    }
    this._swipe(dt, t, events);
  }

  _lose(h, events) {
    if (h.pinch) events.push({ type: 'pinchEnd', hand: h.label, x: h.x, y: h.y, primary: h.primary });
    h.present = false; h.pinch = false; h.open = false; h.pointing = false; h.fist = false;
    h.peace = false; h.thumbsUp = false;
    h.tension = 0; h.speed = 0;
    h.poseT.open = h.poseT.point = h.poseT.fist = h.poseT.peace = h.poseT.thumb = 0;
  }

  /** Wrist flick: large, fast, mostly-straight palm travel within ~260 ms. */
  _swipe(dt, t, events) {
    this.swipeCool -= dt;
    const h = [this.hands.Right, this.hands.Left].find((x) => x.present && x.primary)
      || [this.hands.Right, this.hands.Left].find((x) => x.present);
    if (!h || h.pinch || h.pointing || h.fist || h.peace || h.thumbsUp) { this.swipeHist.length = 0; return; }
    this.swipeHist.push({ t, x: h.palmX, y: h.palmY });
    while (this.swipeHist.length && t - this.swipeHist[0].t > 0.26) this.swipeHist.shift();
    if (this.swipeCool > 0 || this.swipeHist.length < 4) return;
    const a = this.swipeHist[0], b = this.swipeHist[this.swipeHist.length - 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const W = app.W, H = app.H;
    let dir = null;
    if (Math.abs(dx) > W * 0.24 && Math.abs(dx) > Math.abs(dy) * 2.2) dir = dx > 0 ? 'right' : 'left';
    else if (dy < -H * 0.3 && Math.abs(dy) > Math.abs(dx) * 2.2) dir = 'up';
    if (dir) {
      events.push({ type: 'swipe', dir, x: b.x, y: b.y });
      this.swipeCool = 0.9;
      this.swipeHist.length = 0;
    }
  }
}
