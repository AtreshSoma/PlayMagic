// ---------------------------------------------------------------------------
// Initiation Calibration: a rapid five-star gaze attunement (centre + four
// corners, ~6 s). The centre star also records your neutral gaze. Skippable
// with a flick, Esc or Enter.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { avgFeature } from '../input/gaze.js';
import { glowText } from '../ui/draw.js';
import { TAU, rgba, clamp, easeOutCubic } from '../core/util.js';

const POINTS = [[0.5, 0.5], [0.08, 0.12], [0.92, 0.12], [0.92, 0.88], [0.08, 0.88]];
const SETTLE = 0.6, COLLECT = 0.75;

export class CalibrationScene {
  constructor() { this.allow = { swipe: false, runes: false, faceMagic: false, chimes: false, overlays: false, tilt: false }; }

  enter(params = {}) {
    this.then = params.then || null;
    this.state = 'face'; this.t = 0; this.faceT = 0; this.noFace = 0; this.idx = 0; this.samples = [];
    app.input.gazeTracker.beginCalibration();
    app.hud.hint('Quick eye tune-up · about 5 seconds<small>Press Esc or swipe to skip</small>', 'gaze');
  }

  update(dt) {
    const inp = app.input, f = inp.face, gt = inp.gazeTracker;
    if (inp.has('swipe') || inp.cmd('confirm')) return this.finish(true);
    this.t += dt;
    if (this.state === 'face') {
      if (f.present) { this.faceT += dt; if (this.faceT > 0.7) { this.state = 'point'; this.t = 0; app.audio.select(); } }
      else { this.faceT = 0; this.noFace += dt; }
      return;
    }
    if (this.state === 'done') { if (this.t > 1.1) this._leave(); return; }
    if (this.t > SETTLE && f.present && gt.f && !f.eyesClosed) this.samples.push({ ...gt.f });
    if (this.t > SETTLE + COLLECT) {
      const [px, py] = POINTS[this.idx], x = px * app.W, y = py * app.H;
      if (this.samples.length >= 4) {
        const avg = avgFeature(this.samples);
        if (this.idx === 0) gt.setNeutral(avg);
        gt.addSample(x, y, avg);
        app.audio.chime(app.audio.noteFromY(1 - this.idx / POINTS.length), { vel: 0.4, bright: 0.9 });
        app.particles.emit({ x, y, count: 30, speed: [80, 260], life: [0.5, 1.1] });
        app.fx.shockwave(x, y, { r1: 90 });
      } else app.audio.fizzle();
      this.idx++; this.samples = []; this.t = 0;
      if (this.idx >= POINTS.length) this.finish(false);
    }
  }

  finish(skipped) {
    if (this.state === 'done') return;
    const ok = !skipped && app.input.gazeTracker.solve();
    app.hud.toast(skipped ? 'Tune-up skipped · eye tracking will be rougher' : ok ? 'Eye tracking tuned' : 'Tune-up was faint · eye tracking may be rough', '◉', 2600);
    if (ok) app.audio.victory();
    this.state = 'done'; this.t = 0;
    if (skipped) this._leave();
  }
  _leave() { if (this._left) return; this._left = true; app.actions.afterCalibration(this.then); }
  exit() { this._left = false; }

  drawFront(ctx) {
    const W = app.W, H = app.H, t = app.t;
    ctx.save();
    ctx.fillStyle = 'rgba(4,4,18,0.35)'; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    if (this.state === 'face') {
      const cx = W / 2, cy = H * 0.46, rx = Math.min(W, H) * 0.14, ry = rx * 1.3;
      ctx.save();
      ctx.setLineDash([6, 8]); ctx.lineDashOffset = -t * 20;
      ctx.strokeStyle = rgba(app.theme.accent, 0.7); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.stroke();
      ctx.restore();
      glowText(ctx, 'This game uses your eyes', cx, cy - ry - 64, { size: 28, spacing: 2 });
      glowText(ctx, 'First, a 5-second tune-up. Look straight at the screen.', cx, cy - ry - 30, { size: 18, font: 'Cormorant Garamond', weight: 600, color: rgba('#fff', 0.8), blur: 0 });
      glowText(ctx, 'Center your face in the oval', cx, cy + ry + 40, { size: 22, font: 'Cormorant Garamond', weight: 600 });
      if (this.noFace > 4) glowText(ctx, 'Face the camera in good light, or press Esc to skip.', cx, cy + ry + 70, { size: 15, font: 'Cormorant Garamond', weight: 400, color: rgba('#fff', 0.7), blur: 0 });
      return;
    }
    if (this.state === 'done') {
      glowText(ctx, 'Tuned', W / 2, H / 2, { size: 40, spacing: 8, alpha: clamp(1 - this.t) });
      return;
    }
    const [px, py] = POINTS[this.idx], x = px * W, y = py * H;
    const settle = clamp(this.t / SETTLE), collect = clamp((this.t - SETTLE) / COLLECT);
    const ringR = 70 - 56 * easeOutCubic(settle);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(app.theme.accent, 0.8); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, ringR, 0, TAU); ctx.stroke();
    if (collect > 0) {
      ctx.strokeStyle = rgba('#ffffff', 0.95); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 22, -Math.PI / 2, -Math.PI / 2 + collect * TAU); ctx.stroke();
    }
    const s = 26 + Math.sin(t * 9) * 4 + collect * 10;
    ctx.drawImage(app.particles.spriteCanvas(app.theme.accent), x - s, y - s, s * 2, s * 2);
    ctx.drawImage(app.particles.spriteCanvas('#ffffff'), x - s * 0.5, y - s * 0.5, s, s);
    ctx.restore();
    glowText(ctx, 'Look at the star · keep your head still', W / 2, H / 2 + (this.idx === 0 ? 70 : 0), { size: 24, font: 'Cormorant Garamond', weight: 600, alpha: 0.85 });
    glowText(ctx, `${this.idx + 1} / ${POINTS.length}`, W / 2, H / 2 + (this.idx === 0 ? 100 : 30), { size: 12, font: 'Inter', spacing: 3, alpha: 0.6, blur: 0 });
  }
}
