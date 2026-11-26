// ---------------------------------------------------------------------------
// Unified input state. Merges camera hands/face/gaze with the mouse/keyboard
// fallback into one per-frame snapshot plus a list of discrete events.
// Scenes read `input.events` (cleared every frame) — no listener bookkeeping.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { HandTracker, makeHand } from './hands.js';
import { FaceTracker } from './face.js';
import { GazeTracker } from './gaze.js';
import { Fallback } from './fallback.js';
import { RuneCaster } from './runes.js';
import { GestureClassifier } from './gestures.js';
import { Smooth2, alphaFor, dist } from '../core/util.js';

// Expression thresholds with hysteresis [on, off]
const EXPR = { smile: [0.45, 0.25], mouth: [0.35, 0.18], brows: [0.45, 0.25] };
const EXPR_EVENT = { smile: 'smile', mouth: 'mouthOpen', brows: 'brows' };

export class Input {
  constructor() {
    this.events = [];
    this.handTracker = new HandTracker();
    this.gazeTracker = new GazeTracker();
    this.faceTracker = new FaceTracker(this.gazeTracker);
    this.fb = new Fallback();
    this.rune = new RuneCaster();
    this.gest = new GestureClassifier();
    this.mouseHand = makeHand('Mouse', 'mouse');
    this.mouseGaze = new Smooth2(0.14, 0.06, 2000);
    this.hands = this.handTracker.list();
    this.primary = null;
    this.cursor = { x: app.W / 2, y: app.H / 2, active: false, source: 'none' };
    this.gaze = { x: app.W / 2, y: app.H / 2, valid: false, source: 'none' };
    this.face = this.faceTracker.face;
    this.vals = { smile: 0, mouth: 0, brows: 0, browDown: 0, squint: 0, tilt: 0 };
    this.on = { smile: false, mouth: false, brows: false };
    this.twoHand = { active: false, ratio: 1, d0: 0, ax: 0, ay: 0, bx: 0, by: 0 };
    this.motion = 0;
  }

  has(type) { for (const e of this.events) if (e.type === type) return true; return false; }
  get(type) { return this.events.find((e) => e.type === type); }
  cmd(name) { return this.events.some((e) => e.type === 'cmd' && e.name === name); }
  allHands() { return [...this.hands, this.mouseHand].filter((h) => h.present); }
  get cameraHandsPresent() { return this.hands.some((h) => h.present); }

  update(dt, t) {
    const ev = this.events; ev.length = 0;
    const v = app.vision;
    if (v && v.ready) {
      this.handTracker.update(v.handResult, v.handStamp, dt, t, ev);
      this.faceTracker.update(v.faceResult, v.faceStamp, dt, t, ev);
    } else this.faceTracker.update(null, 0, dt, t, ev); // lets a face expire after the camera turns off
    this.handTracker.frame(dt, t, ev);
    this._mouse(dt, t, ev);
    this._choosePrimary(t);
    this._cursor();
    this._gaze(dt, t);
    this._expressions(dt, ev);
    this._twoHand(ev);
    if (app.scenes?.current?.allow?.runes === false) { if (this.rune.drawing || this.rune.holdProgress) this.rune.cancel(); }
    else this.rune.update(this.primary, dt, t, ev);
    this.gest.update(dt, t, ev);
    this.motion += ((this.primary ? Math.min(1, this.primary.speed / 1500) : 0) - this.motion) * alphaFor(dt, 0.5);
  }

  /** The mouse acts as a virtual hand (and fallback gaze). */
  _mouse(dt, t, ev) {
    const fb = this.fb, h = this.mouseHand;
    const wasPresent = h.present;
    h.present = fb.recent(t, 3) || fb.poseHeld();
    if (h.present && !wasPresent) h.smooth.reset(fb.x, fb.y);
    h.smooth.update(fb.x, fb.y, dt);
    h.x = fb.x; h.y = fb.y; h.vx = h.smooth.vx; h.vy = h.smooth.vy; h.speed = Math.hypot(h.vx, h.vy);
    h.palmX = h.x; h.palmY = h.y; h.pinchX = h.x; h.pinchY = h.y;
    h.pointing = fb.shift || fb.right;
    h.tension += ((fb.down ? 1 : h.pointing ? 0.2 : 0) - h.tension) * alphaFor(dt, 0.05);

    for (const q of fb.drain()) {
      if (q.type === '_down') {
        if (h.pointing) continue;
        h.pinch = true; h.open = false;
        ev.push({ type: 'pinchStart', hand: 'Mouse', x: h.x, y: h.y, primary: this.primary === h || !this.cameraHandsPresent });
      } else if (q.type === '_up') {
        if (!h.pinch) continue;
        h.pinch = false;
        const primary = this.primary === h || !this.cameraHandsPresent;
        ev.push({ type: 'pinchEnd', hand: 'Mouse', x: h.x, y: h.y, primary, cancel: !!q.cancel });
        ev.push({ type: 'palmOpen', hand: 'Mouse', x: h.x, y: h.y, vx: h.vx, vy: h.vy, primary });
      } else if (q.type === '_palmKey') {
        ev.push({ type: 'palmOpen', hand: 'Mouse', key: true, x: h.x, y: h.y, vx: 0, vy: 0, primary: true });
      } else if (q.type === 'keyRune') {
        ev.push({ type: 'rune', shape: q.shape, x: this.cursor.x || app.W / 2, y: this.cursor.y || app.H / 2, size: 220, pts: [] });
      } else ev.push(q);
    }
    h.open = !h.pinch && !h.pointing;
  }

  _choosePrimary(t) {
    const m = this.mouseHand;
    const mouseActive = m.present && (t - this.fb.lastMove < 1.0 || this.fb.down || this.fb.right);
    let p = null;
    if (mouseActive) p = m;
    else {
      const cam = this.hands.filter((h) => h.present);
      if (cam.length === 1) p = cam[0];
      else if (cam.length === 2) {
        const prev = this.primary && cam.includes(this.primary) ? this.primary : cam.find((h) => h.label === 'Right') || cam[0];
        const other = cam.find((h) => h !== prev);
        p = (other.pinch || other.pointing) && !(prev.pinch || prev.pointing) ? other : prev;
      } else if (m.present) p = m;
    }
    for (const h of [...this.hands, m]) h.primary = h === p;
    this.primary = p;
  }

  _cursor() {
    const p = this.primary, c = this.cursor;
    if (p) { c.x = p.x; c.y = p.y; c.active = true; c.source = p.source === 'mouse' ? 'mouse' : 'hand'; }
    else c.active = false;
  }

  _gaze(dt, t) {
    const gt = this.gazeTracker, g = this.gaze;
    gt.frame(dt, this.face.present);
    if (gt.valid && !(this.mouseHand.present && t - this.fb.lastMove < 0.6)) {
      g.x = gt.x; g.y = gt.y; g.valid = true; g.source = 'eyes';
      this.mouseGaze.reset(g.x, g.y);
    } else if (this.mouseHand.present) {
      this.mouseGaze.update(this.fb.x, this.fb.y, dt);
      g.x = this.mouseGaze.x; g.y = this.mouseGaze.y; g.valid = true; g.source = 'mouse';
    } else if (gt.valid) {
      g.x = gt.x; g.y = gt.y; g.valid = true; g.source = 'eyes';
    } else g.valid = false;
  }

  /** Merge face blendshapes with held keys, apply hysteresis, emit rising edges. */
  _expressions(dt, ev) {
    const f = this.face, fb = this.fb, v = this.vals;
    const camOn = f.present ? 1 : 0;
    const key = (code, cur) => {
      const target = fb.held(code) ? 1 : 0;
      return cur + (target - cur) * alphaFor(dt, 0.07);
    };
    this._k = this._k || { smile: 0, mouth: 0, brows: 0, browDown: 0, tilt: 0 };
    const k = this._k;
    k.smile = key('Digit1', k.smile); k.mouth = key('Digit2', k.mouth);
    k.brows = key('Digit3', k.brows); k.browDown = key('Digit4', k.browDown);
    const tiltTarget = (fb.held('KeyD') ? 0.4 : 0) - (fb.held('KeyA') ? 0.4 : 0);
    k.tilt += (tiltTarget - k.tilt) * alphaFor(dt, 0.15);

    v.smile = Math.max(f.smile * camOn, k.smile);
    v.mouth = Math.max(f.mouth * camOn, k.mouth);
    v.brows = Math.max(f.brows * camOn, k.brows);
    v.browDown = Math.max(f.browDown * camOn, k.browDown);
    v.squint = f.squint * camOn;
    v.tilt = (f.present ? f.tilt : 0) + k.tilt;

    for (const name of Object.keys(EXPR)) {
      const [hi, lo] = EXPR[name];
      if (!this.on[name] && v[name] > hi) { this.on[name] = true; ev.push({ type: EXPR_EVENT[name] }); }
      else if (this.on[name] && v[name] < lo) this.on[name] = false;
    }
  }

  _twoHand(ev) {
    const [a, b] = this.hands, th = this.twoHand;
    const both = a.present && b.present && a.pinch && b.pinch;
    if (both) {
      const d = dist(a.x, a.y, b.x, b.y);
      if (!th.active) { th.active = true; th.d0 = Math.max(40, d); ev.push({ type: 'twoHandStart' }); }
      th.ratio = d / th.d0; th.ax = a.x; th.ay = a.y; th.bx = b.x; th.by = b.y;
    } else if (th.active) { th.active = false; ev.push({ type: 'twoHandEnd' }); }
  }
}
