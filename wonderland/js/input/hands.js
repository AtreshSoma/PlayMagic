// ---------------------------------------------------------------------------
// Hand tracking → friendly hand objects.
//
// Each tracked hand exposes:
//   x, y        cursor (index tip when pointing, palm centre otherwise)
//   tip, palm   smoothed index fingertip / palm centre
//   vx, vy      palm velocity (px/s) — used for swats and waves
//   pose        'point' | 'open' | 'fist' | 'other'   (debounced)
//   lm          21 smoothed screen-space landmarks (for drawing + popping)
//   waving      true while the hand is waving back and forth
//   pinch       thumb + index tips together (hysteresis); a new pinch is a tap
//               at the cursor, so pinching chooses anything a finger could tap
//
// Kid tuning: generous finger-extension ratios, short debounce, 250 ms of
// "coasting" when the camera briefly loses a hand, and an adaptive EMA plus
// 60 FPS interpolation between ~30 FPS camera frames.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { Smooth2, damp, dist, lerp, sign } from '../core/util.js';

const FINGERS = [[6, 8], [10, 12], [14, 16], [18, 20]]; // [pip, tip] for index..pinky
const PALM = [0, 5, 9, 13, 17];
const LOST_MS = 250;
let nextId = 1;

class CamHand {
  constructor() {
    this.id = 'cam' + nextId++;
    this.src = 'cam';
    this.tipS = new Smooth2(7, 34, 1500);
    this.palmS = new Smooth2(6, 30, 1500);
    this.tip = { x: 0, y: 0 }; this.palm = { x: 0, y: 0 };
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.speed = 0;
    this.lm = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
    this.size = 80; this.pose = 'other'; this.cand = 'other'; this.candT = 0;
    this.pointW = 0; this.seen = 0; this.lost = false; this.fresh = true;
    this.flips = []; this.lastSign = 0; this.waving = false;
    this.pressed = false; this.recent = true;
    this.pinch = false; this.pinchT = 0; this.unpinchT = 0; this.pinchStarted = false;
  }
}

/** Convert a raw MediaPipe hand to screen space and classify the pose. */
function analyze(lm) {
  const pts = lm.map((p) => app.mapHand(p.x, p.y));
  let px = 0, py = 0;
  for (const i of PALM) { px += pts[i].x; py += pts[i].y; }
  px /= PALM.length; py /= PALM.length;
  const w = pts[0];
  const size = Math.max(20, dist(w.x, w.y, pts[9].x, pts[9].y));
  const ext = FINGERS.map(([pip, tip]) =>
    dist(pts[tip].x, pts[tip].y, w.x, w.y) > dist(pts[pip].x, pts[pip].y, w.x, w.y) * 1.12);
  const n = ext.filter(Boolean).length;
  // pinch: thumb tip to index tip, in palm-lengths. The index may curl to meet the thumb,
  // but if its tip folds nearer the wrist than its knuckle, that's a fist.
  const pd = dist(pts[4].x, pts[4].y, pts[8].x, pts[8].y) / size;
  const deep = dist(pts[8].x, pts[8].y, w.x, w.y) < dist(pts[5].x, pts[5].y, w.x, w.y) * 0.98;
  let pose = 'other';
  if (ext[0] && !ext[2] && !ext[3]) pose = 'point';     // index up, ring + pinky down (peace sign counts too)
  else if (n >= 3) pose = 'open';                       // a slightly curled pinky still counts as open
  else if (n === 0) pose = 'fist';
  return { pts, palm: { x: px, y: py }, tip: pts[8], size, pose, pd, deep };
}

export class HandTracker {
  constructor() { this.hands = []; }

  /** New camera result (≈30 FPS). */
  ingest(result, now) {
    const dets = (result?.landmarks || []).map(analyze);
    const free = this.hands.slice();
    const maxJump = Math.max(app.W, app.H) * 0.45;
    for (const d of dets) {
      let best = null, bd = Infinity;
      for (const h of free) {
        const dd = dist(h.palmS.x, h.palmS.y, d.palm.x, d.palm.y);
        if (dd < bd) { bd = dd; best = h; }
      }
      let h;
      if (best && bd < maxJump) { h = best; free.splice(free.indexOf(best), 1); }
      else { h = new CamHand(); this.hands.push(h); }
      this.update(h, d, now);
    }
    for (const h of free) h.lost = true;
  }

  update(h, d, now) {
    const dt = h.fresh ? 0.033 : Math.min(0.12, Math.max(0.008, (now - h.seen) / 1000));
    h.seen = now; h.lost = false;
    if (h.fresh) {
      h.tipS.reset(d.tip.x, d.tip.y); h.palmS.reset(d.palm.x, d.palm.y);
      h.tip = { ...d.tip }; h.palm = { ...d.palm };
      d.pts.forEach((p, i) => { h.lm[i].x = p.x; h.lm[i].y = p.y; });
      h.pose = h.cand = d.pose; h.pointW = d.pose === 'point' ? 1 : 0;
      h.fresh = false;
    } else {
      h.tipS.update(d.tip.x, d.tip.y, dt);
      h.palmS.update(d.palm.x, d.palm.y, dt);
      for (let i = 0; i < 21; i++) {
        h.lm[i].x = lerp(h.lm[i].x, d.pts[i].x, 0.6);
        h.lm[i].y = lerp(h.lm[i].y, d.pts[i].y, 0.6);
      }
    }
    h.size = lerp(h.size, d.size, 0.3);

    // pose debounce: a new pose must hold briefly (shorter for "point" so drawing starts fast)
    if (d.pose === h.cand) h.candT += dt; else { h.cand = d.pose; h.candT = 0; }
    if (h.cand !== h.pose && h.candT >= (h.cand === 'point' ? 0.05 : 0.1)) h.pose = h.cand;

    // pinch with hysteresis (enter < 0.36, exit > 0.52 palm-lengths) and a short debounce
    if (!h.pinch) {
      h.pinchT = d.pd < 0.36 && !d.deep ? h.pinchT + dt : 0;
      if (h.pinchT >= 0.05) { h.pinch = true; h.pinchStarted = true; h.unpinchT = 0; }
    } else {
      h.unpinchT = d.pd > 0.52 ? h.unpinchT + dt : 0;
      if (h.unpinchT >= 0.06) { h.pinch = false; h.pinchT = 0; }
    }
    h.pressed = h.pinch;

    // waving: count direction reversals of fast horizontal palm motion
    const vx = h.palmS.vx, thr = 240 * app.u;
    if (Math.abs(vx) > thr) {
      const s = sign(vx);
      if (h.lastSign && s !== h.lastSign) h.flips.push(now);
      h.lastSign = s;
    }
    while (h.flips.length && now - h.flips[0] > 1200) h.flips.shift();
    h.waving = h.flips.length >= 2;
  }

  /** New pinches since the last call, as taps at each hand's cursor. */
  takePinchTaps() {
    const out = [];
    for (const h of this.hands) if (h.pinchStarted) { h.pinchStarted = false; if (!h.lost) out.push({ x: h.x, y: h.y, type: 'pinch', used: false, hand: h }); }
    return out;
  }

  /** Every render frame: interpolate toward the latest camera estimate, drop lost hands. */
  tick(dt, now) {
    this.hands = this.hands.filter((h) => !(h.lost && now - h.seen > LOST_MS));
    for (const h of this.hands) if (h.lost) { h.pinch = false; h.pressed = false; }
    for (const h of this.hands) {
      const k = 32;
      h.tip.x = damp(h.tip.x, h.tipS.x, k, dt); h.tip.y = damp(h.tip.y, h.tipS.y, k, dt);
      h.palm.x = damp(h.palm.x, h.palmS.x, k, dt); h.palm.y = damp(h.palm.y, h.palmS.y, k, dt);
      h.pointW = damp(h.pointW, h.pose === 'point' ? 1 : 0, 14, dt);
      h.x = lerp(h.palm.x, h.tip.x, h.pointW);
      h.y = lerp(h.palm.y, h.tip.y, h.pointW);
      h.vx = h.palmS.vx; h.vy = h.palmS.vy;
      if (h.lost) { h.vx *= 0.5; h.vy *= 0.5; }
      h.speed = Math.hypot(h.vx, h.vy);
    }
  }
}
