// ---------------------------------------------------------------------------
// Body motion from the face landmarks (no extra model to download).
// The head is a reliable proxy for the whole body in a front-facing camera:
//   step left / right → head moves sideways      → lean, lane −1 · 0 · +1
//   jump               → head rises quickly       → 'jump' (one-shot)
//   crouch / duck      → head drops below normal  → ducking (held)
// Everything is measured in face-widths relative to a neutral pose that is
// captured during a short calibration (stand tall, centred) and then drifts
// gently whenever the player is standing still, so it keeps working if they
// shuffle back or the camera gets bumped.
//
//   const body = new BodyMotion();  body.update(dt, app.input.face)
//   body.state: 'none' | 'calibrating' | 'ready'
//   body.lean (−1..1) · body.lane · body.rise (+ up) · body.ducking · body.jumped
// ---------------------------------------------------------------------------
import { clamp } from '../core/util.js';

const CALIB_TIME = 1.2;

export class BodyMotion {
  constructor() { this.reset(); }

  reset() {
    this.state = 'none'; this.calibT = 0; this.samples = [];
    this.base = null; this.lean = 0; this.rise = 0; this.prevRise = 0; this.vRise = 0;
    this.lane = 0; this.ducking = false; this.jumped = false; this.jumpCool = 0; this.lostT = 0;
  }

  /** Start (or redo) calibration. */
  calibrate() { this.state = 'calibrating'; this.calibT = 0; this.samples = []; }

  update(dt, face) {
    this.jumped = false;
    this.jumpCool = Math.max(0, this.jumpCool - dt);
    if (!face || !face.present || !face.width) {
      this.lostT += dt;
      if (this.lostT > 1.5 && this.state === 'ready') this.state = 'lost';
      return;
    }
    if (this.state === 'lost') this.state = 'ready';
    this.lostT = 0;
    if (this.state === 'none') this.calibrate();
    if (this.state === 'calibrating') {
      this.calibT += dt;
      this.samples.push({ x: face.x, y: face.y, w: face.width });
      if (this.calibT >= CALIB_TIME) {
        const n = this.samples.length, avg = (k) => this.samples.reduce((s, p) => s + p[k], 0) / n;
        this.base = { x: avg('x'), y: avg('y'), w: Math.max(40, avg('w')) };
        this.state = 'ready';
      }
      return;
    }
    const b = this.base, k = 1 - Math.exp(-dt / 0.05);
    const nx = (face.x - b.x) / b.w, ny = (b.y - face.y) / b.w; // ny > 0 = head higher than normal
    this.lean += (clamp(nx / 0.9, -1.5, 1.5) - this.lean) * k;
    this.rise += (ny - this.rise) * k;
    this.vRise += ((this.rise - this.prevRise) / Math.max(dt, 1e-3) - this.vRise) * (1 - Math.exp(-dt / 0.06));
    this.prevRise = this.rise;

    // lanes with hysteresis: enter a side at |lean| > 0.65, return to centre below 0.35
    if (this.lane === 0) { if (this.lean > 0.65) this.lane = 1; else if (this.lean < -0.65) this.lane = -1; }
    else if (this.lane === 1 && this.lean < 0.35) this.lane = this.lean < -0.65 ? -1 : 0;
    else if (this.lane === -1 && this.lean > -0.35) this.lane = this.lean > 0.65 ? 1 : 0;

    // jump: a quick upward head movement · duck: head clearly lower than standing
    if (this.jumpCool <= 0 && this.rise > 0.3 && this.vRise > 1.8) { this.jumped = true; this.jumpCool = 0.6; }
    if (!this.ducking && this.rise < -0.5) this.ducking = true;
    else if (this.ducking && this.rise > -0.28) this.ducking = false;

    // gentle re-centring while standing still near neutral
    if (Math.abs(nx) < 0.25 && Math.abs(ny) < 0.2) {
      const d = 1 - Math.exp(-dt / 5);
      b.x += (face.x - b.x) * d; b.y += (face.y - b.y) * d; b.w += (face.width - b.w) * d;
    }
  }
}
