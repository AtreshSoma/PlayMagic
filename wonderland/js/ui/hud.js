// ---------------------------------------------------------------------------
// Heads-up pictures (no text):
//   • top-right tracking badges: a hand and a face that light up when the
//     camera can see them; a sleepy camera while it wakes up
//   • picture "toasts" (e.g. camera off → finger icon) that float and fade
//   • StarJar: a glass jar that fills with stars toward a celebration
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { TAU, clamp, damp, ease } from '../core/util.js';
import { drawHand, drawFace } from './icons.js';
import { starPath } from './props.js';
import { glowSprite } from '../fx/sprites.js';

function drawCamera(ctx, s, t, sleepy) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-s * 0.7, -s * 0.45, s * 1.4, s * 0.9, s * 0.2) : ctx.rect(-s * 0.7, -s * 0.45, s * 1.4, s * 0.9); ctx.fill();
  ctx.fillRect(-s * 0.3, -s * 0.6, s * 0.6, s * 0.2);
  ctx.fillStyle = '#3a2160'; ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, TAU); ctx.fill();
  if (sleepy) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = app.font(s * 0.55, 700);
    ctx.fillText('z', s * 0.75 + Math.sin(t * 2) * 2, -s * 0.6);
    ctx.font = app.font(s * 0.4, 700);
    ctx.fillText('z', s * 1.05, -s * 0.95 + Math.sin(t * 2 + 1) * 2);
  }
  ctx.restore();
}

export class Hud {
  constructor() { this.toasts = []; this.handGlow = 0; this.faceGlow = 0; }

  /** A picture toast: iconFn(ctx, s, t) drawn large near the top, then fades. */
  toast(iconFn, dur = 2.6) { this.toasts.push({ iconFn, t: 0, dur }); }

  update(dt) {
    const inp = app.input;
    this.handGlow = damp(this.handGlow, inp.camHands.length ? 1 : 0, 8, dt);
    this.faceGlow = damp(this.faceGlow, inp.face.present ? 1 : 0, 8, dt);
    for (const tt of this.toasts) tt.t += dt;
    this.toasts = this.toasts.filter((tt) => tt.t < tt.dur);
  }

  draw(ctx) {
    const u = app.u, t = app.t, inp = app.input, st = inp.cam.state;
    const s = 15 * u, y = 30 * u;
    let x = app.W - 34 * u;
    ctx.save();
    if (app.scenes.name === 'hub') { /* Home shows camera status in its header */ } else if (st === 'on') {
      for (const [glow, draw] of [[this.faceGlow, () => drawFace(ctx, s, { smile: 0.6 })], [this.handGlow, () => drawHand(ctx, s * 1.1, [1, 1, 1, 1, 1])]]) {
        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = 0.28 + glow * 0.72;
        if (glow > 0.5) {
          ctx.globalCompositeOperation = 'lighter';
          const g = s * 2.6;
          ctx.drawImage(glowSprite('#9effd8'), -g, -g, g * 2, g * 2);
          ctx.globalCompositeOperation = 'source-over';
        }
        draw();
        ctx.restore();
        x -= 44 * u;
      }
    } else if (st === 'starting' || st === 'mirror') {
      ctx.translate(x, y);
      ctx.globalAlpha = 0.85;
      drawCamera(ctx, s, t, false);
      for (let k = 0; k < 6; k++) {
        const a = t * 4 + (k / 6) * TAU, r = s * 1.5;
        ctx.globalAlpha = 0.3 + 0.7 * ((k / 6 + t) % 1);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 2 * u, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();

    // picture toasts
    for (const tt of this.toasts) {
      const p = tt.t / tt.dur, a = p < 0.15 ? p / 0.15 : p > 0.8 ? (1 - p) / 0.2 : 1;
      const sc = ease.outBack(clamp(tt.t / 0.35));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(app.W / 2, app.H * 0.3 - p * 20 * u);
      ctx.scale(sc, sc);
      ctx.fillStyle = 'rgba(60,36,130,0.7)';
      ctx.beginPath(); ctx.arc(0, 0, 44 * u, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.stroke();
      tt.iconFn(ctx, 28 * u, app.t);
      ctx.restore();
    }
  }
}

/** Sleepy-camera picture for the "camera is off" toast. */
export const sleepyCamera = (ctx, s, t) => drawCamera(ctx, s * 0.8, t, true);

// ------------------------------------------------------------------ star jar
export class StarJar {
  constructor(max = 10) { this.max = max; this.count = 0; this.shown = 0; this.wiggle = 0; this.goals = 0; this.total = 0; this.bump = 0; }

  /** Adds a star; returns true when the jar just filled up. `total` is the round's points. */
  add(n = 1) {
    this.count += n; this.wiggle = 1; this.total += n; this.bump = 1;
    if (this.count >= this.max) { this.count = 0; this.goals++; return true; }
    return false;
  }

  update(dt) { this.shown = damp(this.shown, this.count, 8, dt); this.wiggle = Math.max(0, this.wiggle - dt * 2.5); this.bump = Math.max(0, this.bump - dt * 3); }

  reset() { this.count = 0; this.shown = 0; this.goals = 0; this.total = 0; }

  draw(ctx, x, y, s) {
    const t = app.t, fill = clamp(this.shown / this.max);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 20) * 0.08 * this.wiggle);
    // glow
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.3 + fill * 0.6;
    ctx.drawImage(glowSprite('#ffd84a'), -s * 1.6, -s * 1.6, s * 3.2, s * 3.2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // jar body
    const w = s * 0.75, h = s;
    ctx.beginPath();
    ctx.moveTo(-w * 0.6, -h); ctx.lineTo(w * 0.6, -h); ctx.lineTo(w * 0.6, -h * 0.82);
    ctx.quadraticCurveTo(w, -h * 0.7, w, -h * 0.3); ctx.lineTo(w, h * 0.75); ctx.quadraticCurveTo(w, h, w * 0.7, h);
    ctx.lineTo(-w * 0.7, h); ctx.quadraticCurveTo(-w, h, -w, h * 0.75); ctx.lineTo(-w, -h * 0.3);
    ctx.quadraticCurveTo(-w, -h * 0.7, -w * 0.6, -h * 0.82); ctx.closePath();
    ctx.fillStyle = 'rgba(200,230,255,0.18)'; ctx.fill();
    ctx.save(); ctx.clip();
    // golden fill level
    const top = h - fill * h * 1.75;
    const g = ctx.createLinearGradient(0, top, 0, h);
    g.addColorStop(0, '#fff2a0'); g.addColorStop(1, '#f2a91a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-w, h);
    for (let i = 0; i <= 10; i++) ctx.lineTo(-w + (i / 10) * w * 2, top + Math.sin(i + t * 4) * s * 0.04);
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    // little stars inside
    const n = Math.round(this.shown);
    for (let k = 0; k < n; k++) {
      ctx.save();
      ctx.translate(((k * 37) % 10 / 10 - 0.5) * w * 1.4, h * 0.8 - (k / this.max) * h * 1.6);
      ctx.rotate(k + t * 0.5);
      starPath(ctx, s * 0.14); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = Math.max(2, s * 0.07); ctx.stroke();
    ctx.fillStyle = '#c98a5a'; ctx.fillRect(-w * 0.7, -h * 1.12, w * 1.4, h * 0.18);
    ctx.restore();
    // points: a big friendly star counter beside the jar
    ctx.save();
    ctx.translate(x + s * 1.35, y - s * 0.15);
    ctx.scale(1 + this.bump * 0.25, 1 + this.bump * 0.25);
    starPath(ctx, s * 0.32); ctx.fillStyle = '#ffd84a'; ctx.fill();
    ctx.font = app.font(s * 0.85, 700); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.lineWidth = s * 0.14; ctx.strokeStyle = 'rgba(40,20,90,0.7)'; ctx.strokeText(String(this.total), s * 0.45, s * 0.04);
    ctx.fillStyle = '#ffffff'; ctx.fillText(String(this.total), s * 0.45, s * 0.04);
    ctx.restore();
    // trophies for every filled jar
    for (let k = 0; k < Math.min(this.goals, 8); k++) {
      ctx.save(); ctx.translate(x + s * 1.3 + k * s * 0.55, y + s * 0.7); ctx.rotate(Math.sin(t * 3 + k) * 0.15);
      starPath(ctx, s * 0.22); ctx.fillStyle = '#ffd84a'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    }
  }
}
