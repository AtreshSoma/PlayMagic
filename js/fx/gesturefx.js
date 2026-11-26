// ---------------------------------------------------------------------------
// World responses to the expanded gesture vocabulary (available everywhere a
// scene allows it):
//   fist hold     → gravity well: nearby light spirals into your hand
//   peace sign    → time freezes for a beat and a stylised snapshot is taken
//                   (scenes with allow.snapshot)
//   two-hand frame→ a glowing energy barrier between your palms; light bounces off
//   cheek puff    → a charge ring builds around your mouth, release = shockwave
//   double blink  → radial light burst
//   winks / nod / shake → small acknowledgements (shake also closes overlays)
// Every recognised gesture also gets a soft audio cue and is recorded as a
// discovered magic in the Spellbook.
// Scenes opt out with allow.{gravity, snapshot, barrier, puff, doubleBlink} = false.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { discover } from '../ui/discovery.js';
import { TAU, rgba, rand, clamp } from '../core/util.js';

const CUE_EVENTS = new Set(['peace', 'thumbsUp', 'fistHoldStart', 'frameStart', 'winkL', 'winkR', 'doubleBlink', 'nod', 'shake', 'puffRelease']);

export class GestureFx {
  constructor() {
    this.wells = new Map();   // hand label → { force, x, y, t }
    this.freezeT = 0;
    this.frameT = 0;
  }

  allow(key) {
    const sc = app.scenes.current, a = sc?.allow || {};
    if (app.overlays.active || app.scenes.name === 'intro') return false;
    if (key === 'snapshot') return a.snapshot === true;
    return a[key] !== false;
  }

  update(dt) {
    const inp = app.input;
    for (const e of inp.events) {
      if (CUE_EVENTS.has(e.type)) app.audio.gestureCue(e.type);
      switch (e.type) {
        case 'fistHoldStart':
          if (!this.allow('gravity')) break;
          this.wells.set(e.hand, { force: app.particles.addForce({ x: e.x, y: e.y, radius: 420, strength: 0, type: 'attract', life: Infinity }), x: e.x, y: e.y, t: 0 });
          app.audio.well((e.x / app.W) * 2 - 1);
          discover('gravity');
          break;
        case 'fistHoldEnd': this.endWell(e.hand); break;
        case 'peace':
          discover('freeze');
          if (!this.allow('snapshot')) break;
          this.freezeT = 1.2;
          app.audio.freeze();
          setTimeout(() => app.audio.shutter(), 120);
          app.snapshotPending = true;
          break;
        case 'thumbsUp': discover('thumbs'); this.burstAt(e.x, e.y, '#9dff9a', 18); break;
        case 'frameStart': discover('barrier'); app.audio.swell(330, { vel: 0.3, dur: 1 }); break;
        case 'puffRelease':
          discover('puff');
          if (!this.allow('puff')) break;
          app.particles.impulse(e.x, e.y, 560, 950 * e.power);
          app.particles.emit({ x: e.x, y: e.y, count: Math.round(70 * e.power), speed: [220, 620], life: [0.5, 1.2], size: [1.5, 4] });
          app.fx.shockwave(e.x, e.y, { r1: 380 * (0.5 + e.power), dur: 0.8, width: 4 });
          app.tapestry.ripple(e.x, e.y);
          app.audio.boom(e.power, (e.x / app.W) * 2 - 1);
          break;
        case 'doubleBlink': {
          if (!this.allow('doubleBlink')) break;
          discover('doubleBlink');
          const f = inp.face, x = f.present ? f.x : app.W / 2, y = f.present ? f.y : app.H / 2;
          for (let i = 0; i < 120; i++) {
            const a = (i / 120) * TAU, sp = rand(380, 720);
            app.particles.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.6, 1.2), rand(1.5, 3.5), app.theme.particles[i % 4], 5, 0, 0.97, 0);
          }
          app.fx.shockwave(x, y, { r1: 420, dur: 0.7, width: 3 });
          app.fx.flash(app.theme.accent, 0.15);
          break;
        }
        case 'winkL': case 'winkR': {
          discover('wink');
          const f = inp.face;
          if (f.present) {
            const P = f.pts, i = e.type === 'winkL' ? 263 : 33;
            this.burstAt(P[i * 2], P[i * 2 + 1], app.theme.accent, 10);
          }
          break;
        }
        case 'nod': discover('nod'); break;
        case 'shake': discover('shake'); if (app.overlays.active) app.overlays.close(); break;
      }
    }

    // Wells follow their fist and ramp up.
    for (const [label, w] of this.wells) {
      const h = inp.allHands().find((x) => x.label === label);
      if (!h || !h.present || !this.allow('gravity')) { this.endWell(label); continue; }
      w.x = h.source === 'mouse' ? h.x : h.palmX; w.y = h.source === 'mouse' ? h.y : h.palmY;
      w.t += dt;
      w.force.x = w.x; w.force.y = w.y; w.force.strength = Math.min(1, w.t * 2) * 1700;
      if (Math.random() < 0.6) {
        const a = rand(TAU), r = rand(160, 360);
        app.particles.spawn(w.x + Math.cos(a) * r, w.y + Math.sin(a) * r, -Math.sin(a) * 120, Math.cos(a) * 120, rand(0.8, 1.4), rand(1, 2.5), app.theme.particles[(Math.random() * 4) | 0], 0, 0, 0.98, 0);
      }
    }

    // Energy barrier between the palms.
    const F = inp.gest.frame;
    this.frameT = F.active && this.allow('barrier') ? Math.min(1, this.frameT + dt * 4) : Math.max(0, this.frameT - dt * 4);
    if (F.active && this.allow('barrier')) app.particles.barrier(F.ax, F.ay, F.bx, F.by);

    // Freeze (peace): particles nearly stop.
    this.freezeT = Math.max(0, this.freezeT - dt);
    app.timeScale = this.freezeT > 0.15 ? 0.04 : this.freezeT > 0 ? 0.04 + (1 - this.freezeT / 0.15) * 0.96 : 1;
  }

  endWell(label) {
    const w = this.wells.get(label);
    if (!w) return;
    w.force.life = 0;
    this.wells.delete(label);
    app.particles.impulse(w.x, w.y, 260, 420);
    app.fx.shockwave(w.x, w.y, { color: app.theme.accent2, r1: 160, dur: 0.5, width: 2 });
  }

  burstAt(x, y, color, n) {
    app.particles.emit({ x, y, count: n, speed: [40, 180], life: [0.4, 0.9], size: [1.5, 3.5], colors: [color, '#ffffff'], raw: true });
  }

  draw(ctx) {
    const t = app.t, inp = app.input;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // gravity wells: tilted accretion rings collapsing inward
    for (const w of this.wells.values()) {
      const k = Math.min(1, w.t * 2);
      for (let i = 0; i < 4; i++) {
        const p = (t * 0.8 + i / 4) % 1, r = (1 - p) * 140 * k + 12;
        ctx.strokeStyle = rgba(i % 2 ? app.theme.accent : app.theme.accent2, 0.5 * p * k); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(w.x, w.y, r, r * 0.6, t * 0.9, 0, TAU); ctx.stroke();
      }
      ctx.drawImage(app.particles.spriteCanvas(app.theme.accent2), w.x - 30, w.y - 30, 60, 60);
    }
    // energy barrier
    if (this.frameT > 0.01) {
      const F = inp.gest.frame, dx = F.bx - F.ax, dy = F.by - F.ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      for (let strand = 0; strand < 4; strand++) {
        ctx.strokeStyle = rgba(strand === 0 ? '#ffffff' : strand % 2 ? app.theme.accent : '#7ff3ff', (strand ? 0.45 : 0.9) * this.frameT);
        ctx.lineWidth = strand ? 1.5 : 3;
        ctx.beginPath();
        for (let s = 0; s <= 48; s++) {
          const u = s / 48, w = Math.sin(u * Math.PI) * Math.sin(u * 22 - t * 12 + strand * 1.7) * (4 + strand * 5);
          const px = F.ax + dx * u + nx * w, py = F.ay + dy * u + ny * w;
          s ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
      const g = ctx.createLinearGradient(F.ax + nx * 40, F.ay + ny * 40, F.ax - nx * 40, F.ay - ny * 40);
      g.addColorStop(0, rgba('#7ff3ff', 0)); g.addColorStop(0.5, rgba('#7ff3ff', 0.12 * this.frameT)); g.addColorStop(1, rgba('#7ff3ff', 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(F.ax + nx * 40, F.ay + ny * 40); ctx.lineTo(F.bx + nx * 40, F.by + ny * 40); ctx.lineTo(F.bx - nx * 40, F.by - ny * 40); ctx.lineTo(F.ax - nx * 40, F.ay - ny * 40); ctx.fill();
      for (const [px, py] of [[F.ax, F.ay], [F.bx, F.by]]) ctx.drawImage(app.particles.spriteCanvas('#7ff3ff'), px - 28, py - 28, 56, 56);
    }
    // cheek-puff charge ring
    const charge = inp.gest.puff;
    if (charge > 0.03 && this.allow('puff')) {
      const f = inp.face, x = f.present ? f.mouthX : inp.cursor.active ? inp.cursor.x : app.W / 2, y = f.present ? f.mouthY : inp.cursor.active ? inp.cursor.y : app.H * 0.55;
      const r = 26 + charge * 34 + Math.sin(t * 20) * charge * 3;
      ctx.strokeStyle = rgba(app.theme.accent, 0.3 + charge * 0.6); ctx.lineWidth = 2 + charge * 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + charge * TAU); ctx.stroke();
      ctx.globalAlpha = charge * 0.6;
      ctx.drawImage(app.particles.spriteCanvas(app.theme.accent), x - r, y - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // freeze: crystalline vignette
    if (this.freezeT > 0) {
      const a = clamp(this.freezeT / 1.2) * 0.5;
      ctx.save();
      const g = ctx.createRadialGradient(app.W / 2, app.H / 2, Math.min(app.W, app.H) * 0.3, app.W / 2, app.H / 2, Math.max(app.W, app.H) * 0.75);
      g.addColorStop(0, 'rgba(180,220,255,0)'); g.addColorStop(1, `rgba(180,220,255,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, app.W, app.H);
      ctx.restore();
    }
  }
}
