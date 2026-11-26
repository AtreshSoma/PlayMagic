// ---------------------------------------------------------------------------
// Gesture classifier: the expanded gesture vocabulary on top of the raw hand
// and face trackers. It runs once per frame after hands/face/mouse have
// updated, and:
//   • emulates hand poses on the mouse hand from held keys (F fist, P peace,
//     T thumbs up, H open palm, B two-hand frame, O cheek puff), so every
//     gesture can be tested without a camera
//   • turns poses into debounced, one-shot events:
//       fistHoldStart / fistHoldEnd   fist held ≥ 0.35 s ("gravity well")
//       peace                          two-finger V sign (onset)
//       thumbsUp                       thumbs up (onset, 1 s cooldown)
//       frameStart / frameEnd          both palms up, apart ("energy barrier")
//       puffRelease                    cheek puff / wide mouth charged, then released
//       doubleBlink                    (face tracker on camera, Space-Space on keys)
//   • keeps a live "currently recognised" label for the status pill
//
// Games read the pose state through `has(pose)`:
//   open · fist · peace · thumbsUp · pinch · point · frame · smile · mouth ·
//   puff · brows · eyesClosed
// Mouse idle is NOT an open palm here (unlike the legacy `hand.open` flag),
// so pose-matching games only see deliberate poses.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { clamp } from '../core/util.js';

const FIST_HOLD = 0.35;
const POSE_KEYS = { KeyF: 'fist', KeyP: 'peace', KeyT: 'thumbsUp', KeyH: 'open', KeyB: 'frame', KeyO: 'puff' };

/** Human label + icon for the status pill, by gesture key. */
export const GESTURE_INFO = {
  pinch: ['Pinch', 'pinch'], fist: ['Fist', 'fist'], gravity: ['Gravity Well', 'fist'],
  peace: ['Peace', 'peace'], thumbsUp: ['Thumbs Up', 'thumbsUp'], open: ['Open Palm', 'palm'],
  point: ['Point', 'point'], frame: ['Two-Hand Frame', 'twoPalms'],
  winkL: ['Left Wink', 'winkL'], winkR: ['Right Wink', 'winkR'], blink: ['Blink', 'blink'],
  doubleBlink: ['Double Blink', 'doubleBlink'], smile: ['Smile', 'smile'], mouth: ['Mouth Open', 'mouth'],
  puff: ['Cheek Puff', 'puff'], puffRelease: ['Shockwave', 'puff'], brows: ['Brows Up', 'brows'],
  tilt: ['Head Tilt', 'tilt'], nod: ['Nod · Yes', 'nod'], shake: ['Shake · No', 'shake'],
  swipe: ['Swipe', 'swipe'], rune: ['Rune', 'circle'], eyesClosed: ['Eyes Closed', 'closed'],
};
const ONE_SHOT = new Set(['winkL', 'winkR', 'blink', 'doubleBlink', 'nod', 'shake', 'swipe', 'rune', 'peace', 'thumbsUp', 'puffRelease']);

export class GestureClassifier {
  constructor() {
    this.pose = new Set();
    this.per = new Map();      // hand → { fistT, holding, peace, thumbs, thumbCool }
    this.frame = { active: false, ax: 0, ay: 0, bx: 0, by: 0, keys: false };
    this.puff = 0;             // 0..1 charge
    this.puffOn = false;
    this.lastKeyBlink = -10;
    this.flash = null;         // { key, t } last one-shot, for the pill
    this.current = null;       // key currently shown on the pill
  }

  has(p) { return this.pose.has(p); }
  /** Any present hand (camera or mouse emulation) currently holding `flag`. */
  hand(flag) { return app.input.allHands().find((h) => h[flag]) || null; }

  update(dt, t, ev) {
    const inp = app.input, fb = inp.fb, m = inp.mouseHand;

    // 1 · Keyboard pose emulation on the mouse hand.
    m.keyPose = null;
    for (const [code, pose] of Object.entries(POSE_KEYS)) if (fb.held(code)) m.keyPose = pose;
    m.fist = m.keyPose === 'fist';
    m.peace = m.keyPose === 'peace';
    m.thumbsUp = m.keyPose === 'thumbsUp';
    if (m.keyPose === 'open') m.open = true;

    // 2 · Swap wink sides if the player asked for it (some cameras report them mirrored).
    if (app.store?.data.settings.swapWinks) for (const e of ev) {
      if (e.key) continue;
      if (e.type === 'winkL') e.type = 'winkR'; else if (e.type === 'winkR') e.type = 'winkL';
    }
    // Keyboard double blink: Space twice within 0.45 s.
    for (const e of ev) if (e.type === 'blink' && e.key) {
      if (t - this.lastKeyBlink < 0.45) { ev.push({ type: 'doubleBlink', key: true }); this.lastKeyBlink = -10; }
      else this.lastKeyBlink = t;
    }

    // 3 · Per-hand pose onsets.
    const P = this.pose; P.clear();
    for (const h of inp.allHands()) {
      let s = this.per.get(h);
      if (!s) { s = { fistT: 0, holding: false, peace: false, thumbs: false, thumbCool: 0 }; this.per.set(h, s); }
      const deliberateOpen = h.source === 'mouse' ? m.keyPose === 'open' : h.open;
      if (deliberateOpen) P.add('open');
      if (h.pinch) P.add('pinch');
      if (h.pointing && h.source !== 'mouse') P.add('point');
      if (h.fist) P.add('fist');
      if (h.peace) P.add('peace');
      if (h.thumbsUp) P.add('thumbsUp');

      const x = h.source === 'mouse' ? h.x : h.palmX, y = h.source === 'mouse' ? h.y : h.palmY;
      s.fistT = h.fist ? s.fistT + dt : 0;
      if (!s.holding && s.fistT >= FIST_HOLD) { s.holding = true; ev.push({ type: 'fistHoldStart', hand: h.label, x, y }); }
      else if (s.holding && !h.fist) { s.holding = false; ev.push({ type: 'fistHoldEnd', hand: h.label, x, y }); }
      h.gravity = s.holding;
      if (h.peace && !s.peace) ev.push({ type: 'peace', hand: h.label, x, y, key: h.source === 'mouse' });
      s.peace = h.peace;
      s.thumbCool -= dt;
      if (h.thumbsUp && !s.thumbs && s.thumbCool <= 0) { ev.push({ type: 'thumbsUp', hand: h.label, x, y }); s.thumbCool = 1; }
      s.thumbs = h.thumbsUp;
    }
    // Hands that vanished while holding a fist release their well.
    for (const [h, s] of this.per) if (!h.present && s.holding) { s.holding = false; h.gravity = false; ev.push({ type: 'fistHoldEnd', hand: h.label, x: h.x, y: h.y }); }

    // 4 · Two-hand frame: both camera palms open, fingers up, clearly apart (or B key).
    const [a, b] = inp.hands, F = this.frame, W = app.W;
    const camFrame = a.present && b.present && a.open && b.open && Math.abs(a.angle) < 0.75 && Math.abs(b.angle) < 0.75
      && Math.abs(a.palmX - b.palmX) > W * 0.14;
    const keyFrame = m.keyPose === 'frame';
    const on = camFrame || keyFrame;
    if (on) {
      if (camFrame) {
        const [l, r] = a.palmX < b.palmX ? [a, b] : [b, a];
        F.ax = l.palmX; F.ay = l.palmY; F.bx = r.palmX; F.by = r.palmY;
      } else {
        const c = inp.cursor.active ? inp.cursor : { x: W / 2, y: app.H / 2 };
        F.ax = c.x - 170; F.ay = c.y; F.bx = c.x + 170; F.by = c.y;
      }
      F.keys = !camFrame;
      P.add('frame');
    }
    if (on && !F.active) ev.push({ type: 'frameStart' });
    if (!on && F.active) ev.push({ type: 'frameEnd' });
    F.active = on;

    // 5 · Face poses (continuous) and cheek-puff charge → release shockwave.
    const v = inp.vals, face = inp.face, camFace = face.present ? 1 : 0;
    const puffAmt = Math.max(clamp((face.puff || 0) * camFace), m.keyPose === 'puff' ? 1 : 0);
    if (inp.on.smile) P.add('smile');
    if (inp.on.mouth) P.add('mouth');
    if (inp.on.brows) P.add('brows');
    if (face.present && face.eyesClosed) P.add('eyesClosed');
    const charging = puffAmt > 0.45 || v.mouth > 0.72;
    if (charging) { P.add('puff'); this.puff = Math.min(1, this.puff + dt / 1.4); this.puffOn = true; }
    else if (this.puffOn) {
      this.puffOn = false;
      if (this.puff > 0.3) {
        const fx = face.present ? face.mouthX : inp.cursor.active ? inp.cursor.x : W / 2;
        const fy = face.present ? face.mouthY : inp.cursor.active ? inp.cursor.y : app.H * 0.55;
        ev.push({ type: 'puffRelease', x: fx, y: fy, power: this.puff });
      }
      this.puff = 0;
    }

    // 6 · Status pill: newest one-shot flashes for ~1.1 s, otherwise the strongest live pose.
    for (const e of ev) if (ONE_SHOT.has(e.type)) this.flash = { key: e.type, t };
    if (this.flash && t - this.flash.t > 1.1) this.flash = null;
    let live = null;
    const order = ['frame', 'gravity', 'pinch', 'peace', 'thumbsUp', 'fist', 'puff', 'point', 'open', 'smile', 'mouth', 'brows'];
    for (const k of order) {
      if (k === 'gravity' ? inp.allHands().some((h) => h.gravity) : P.has(k)) { live = k; break; }
    }
    if (!live && Math.abs(v.tilt) > 0.28) live = 'tilt';
    if (!live && P.has('eyesClosed')) live = 'eyesClosed';
    this.current = this.flash ? this.flash.key : live;
    this.isFlash = !!this.flash;
  }
}
