// ---------------------------------------------------------------------------
// The Gate: the very first screen. Browsers need one real tap or click
// before they allow sound or the camera, so this is a single giant glowing
// portal: tap anywhere to step inside. A tapping-finger animation shows how.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { TAU, clamp, hsl } from '../core/util.js';
import { glowSprite } from '../fx/sprites.js';
import { drawTitle } from '../ui/title.js';
import { drawHand } from '../ui/icons.js';

export class GateMode {
  constructor() { this.palette = 'gate'; this.t = 0; this.going = false; }

  enter() {
    this.t = 0; this.going = false;
    const onKey = (e) => { if (e.code === 'Enter' || e.code === 'Space') go(); };
    const go = () => {
      if (this.going) return;
      this.going = true;
      window.removeEventListener('keydown', onKey);
      app.begin(this.geo());
    };
    this.go = go;
    window.addEventListener('keydown', onKey);
  }

  geo() { const r = Math.min(app.W, app.H) * 0.2; return { x: app.W / 2, y: app.H * 0.56, r }; }

  update(dt) {
    this.t += dt;
    if (!this.going && app.input.taps.length) { app.input.taps.forEach((tp) => (tp.used = true)); this.go(); }
  }

  draw(ctx) {
    const { x, y, r } = this.geo(), t = this.t, u = app.u;
    drawTitle(ctx, 'WONDERLAND PORTAL', app.W / 2, app.H * 0.17, clamp(app.W * 0.065, 30, 84));
    // swirling portal
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const R = r * (1 + Math.sin(t * 1.8) * 0.04);
    ctx.globalAlpha = 0.7;
    ctx.drawImage(glowSprite('#c9a0ff'), x - R * 2.2, y - R * 2.2, R * 4.4, R * 4.4);
    ctx.globalAlpha = 1;
    for (let arm = 0; arm < 7; arm++) {
      ctx.strokeStyle = hsl(arm * 50 + t * 40, 100, 70, 0.75);
      ctx.lineWidth = 5 * u; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let s = 0; s <= 36; s++) {
        const q = s / 36, a = arm * (TAU / 7) + q * 3.6 + t * 1.2, rr = R * (0.12 + 0.88 * q);
        s ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 6 * u;
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.stroke();
    // big play triangle
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.shadowColor = '#ffd6fb'; ctx.shadowBlur = 30 * u;
    ctx.beginPath(); ctx.moveTo(x - R * 0.22, y - R * 0.32); ctx.lineTo(x + R * 0.34, y); ctx.lineTo(x - R * 0.22, y + R * 0.32); ctx.closePath(); ctx.fill();
    ctx.restore();
    // tapping finger hint
    const p = (t % 1.6) / 1.6, press = p > 0.4 && p < 0.55;
    ctx.save();
    ctx.translate(x + R * 0.95, y + R * 0.9 + (press ? 6 * u : -Math.sin(p * Math.PI) * 12 * u));
    ctx.rotate(-0.3);
    drawHand(ctx, 34 * u, [0.3, 1, 0, 0, 0]);
    ctx.restore();
    if (press) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3 * u;
      ctx.beginPath(); ctx.arc(x + R * 0.82, y + R * 0.6, (8 + (p - 0.4) * 300) * u, 0, TAU); ctx.stroke();
    }
  }
}
