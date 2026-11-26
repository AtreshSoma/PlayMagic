// ---------------------------------------------------------------------------
// Unified input. Camera hands, mouse and touch all appear in `hands`; face
// signals and keyboard stand-ins merge into `face`; one-shot gestures land
// in `events` for exactly one frame.
//
//   events:  blink · nod · shake · brows · wave (both hands) · wipe · home
//   taps:    pointer presses and camera pinches this frame (bubbles mark them `used`)
//
// Keyboard stand-ins (for grown-ups testing without a camera):
//   Space blink · ←/→ or A/D steer · W/↑ nod · S/↓ shake
//   1 open mouth (hold) · 2 smile (hold) · 3 raise brows · C wipe · Esc home
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { damp } from '../core/util.js';
import { Vision } from './vision.js';
import { HandTracker } from './hands.js';
import { FaceTracker } from './face.js';
import { PointerInput } from './pointer.js';

const KEY_EVENTS = {
  Space: 'blink', KeyW: 'nod', ArrowUp: 'nod', KeyS: 'shake', ArrowDown: 'shake',
  Digit3: 'brows', KeyC: 'wipe', Escape: 'home',
};

export class Input {
  constructor(canvas, video) {
    this.video = video;
    this.pointer = new PointerInput(canvas);
    this.handT = new HandTracker();
    this.faceT = new FaceTracker();
    this.vision = null;
    /** 'off' | 'starting' | 'mirror' (camera on, models loading) | 'on' | 'error' */
    this.cam = { state: 'off', error: null };
    this.hands = []; this.events = []; this.taps = [];
    this.hStamp = 0; this.fStamp = 0;
    this.keySteer = 0; this.lastWave = 0;
    this.face = {
      present: false, steer: 0, mouth: 0, mouthOn: false, smile: 0, smileOn: false,
      brows: 0, eyesClosed: false, head: this.faceT.head, mouthPos: this.faceT.mouthPos, eyes: this.faceT.eyes,
    };
  }

  get camOn() { return this.cam.state === 'on'; }
  get camHands() { return this.handT.hands; }

  async startCamera() {
    if (this.vision || this.cam.state === 'starting') return;
    this.cam = { state: 'starting', error: null };
    const v = new Vision(this.video);
    this.vision = v;
    try {
      await v.start((stage) => { if (this.vision === v) this.cam.state = stage; });
      if (this.vision !== v) return v.stop(); // stopped while loading
      this.cam.state = 'on';
    } catch (err) {
      console.warn('[Wonderland] camera unavailable:', err);
      v.stop();
      if (this.vision === v) { this.vision = null; this.cam = { state: 'error', error: err }; }
    }
  }

  stopCamera() {
    this.vision?.stop();
    this.vision = null;
    this.cam = { state: 'off', error: null };
    this.handT.hands = [];
    this.faceT.present = false;
  }

  emit(type, data) { this.events.push({ type, ...data }); }
  has(type) { return this.events.some((e) => e.type === type); }

  update(dt, now) {
    this.events.length = 0;
    const emit = (type) => this.emit(type);

    const v = this.vision;
    if (v?.ready) {
      v.tick(now);
      if (v.handStamp !== this.hStamp) { this.hStamp = v.handStamp; this.handT.ingest(v.handResult, now); }
      if (v.faceStamp !== this.fStamp) { this.fStamp = v.faceStamp; this.faceT.ingest(v.faceResult, now, emit); }
    }
    this.handT.tick(dt, now);
    this.faceT.tick(now);

    this.hands = this.handT.hands.concat(this.pointer.hands(dt, now));
    this.taps = this.pointer.takeTaps().concat(this.handT.takePinchTaps());

    // both camera hands waving at once → sparkle whirlwind
    const ch = this.handT.hands;
    if (ch.length >= 2 && ch[0].waving && ch[1].waving && now - this.lastWave > 1500) {
      this.lastWave = now; emit('wave');
    }

    // keyboard
    const keys = this.pointer.keys;
    for (const code of this.pointer.takeKeys()) if (KEY_EVENTS[code]) emit(KEY_EVENTS[code]);
    const ks = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
    this.keySteer = damp(this.keySteer, ks, 6, dt);

    // merged face view
    const F = this.faceT, f = this.face, km = keys.has('Digit1'), kSm = keys.has('Digit2');
    f.present = F.present;
    f.steer = Math.abs(this.keySteer) > 0.02 ? this.keySteer : F.steer;
    f.keySteer = Math.abs(this.keySteer) > 0.02;
    f.mouth = km ? 1 : F.mouth; f.mouthOn = km || F.mouthOn;
    f.smile = kSm ? 1 : F.smile; f.smileOn = kSm || F.smileOn;
    f.brows = F.brows; f.eyesClosed = F.eyesClosed || keys.has('Space');
  }
}
