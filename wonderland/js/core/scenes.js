// ---------------------------------------------------------------------------
// Scene manager with a "portal bloom" transition: a disc of warm light grows
// from the bubble that was chosen, the scene swaps under it, then it fades.
//
// A scene is any object with optional hooks:
//   enter(opts) · exit() · update(dt) · draw(ctx) · drawTop(ctx)
//   palette    : world sky palette name
//   mirrorMin  : minimum mirror opacity this scene wants (face mode)
//   scenery    : { islands, clouds, fireflies } toggles for the world layer
// ---------------------------------------------------------------------------
import { app } from './app.js';
import { TAU, clamp, ease } from './util.js';
import { glowSprite } from '../fx/sprites.js';

const OUT = 0.42, IN = 0.55;

export class Scenes {
  constructor() {
    this.map = new Map();
    this.current = null; this.name = '';
    this.tr = null; // { phase, t, x, y, next, opts }
  }

  register(name, scene) { scene.name = name; this.map.set(name, scene); }

  go(name, opts = {}, instant = false) {
    const next = this.map.get(name);
    if (!next || (this.tr && this.tr.phase === 'out')) return;
    if (instant || !this.current) return this.swap(name, opts);
    this.tr = { phase: 'out', t: 0, x: opts.x ?? app.W / 2, y: opts.y ?? app.H / 2, name, opts };
    app.sound.whoosh(0.7, true);
  }

  swap(name, opts) {
    this.current?.exit?.();
    this.current = this.map.get(name); this.name = name;
    app.coach.clear();
    app.world.setPalette(this.current.palette || 'hub');
    this.current.enter?.(opts);
  }

  get busy() { return !!this.tr; }

  update(dt) {
    if (this.tr) {
      this.tr.t += dt;
      if (this.tr.phase === 'out' && this.tr.t >= OUT) {
        this.swap(this.tr.name, this.tr.opts);
        this.tr.phase = 'in'; this.tr.t = 0;
        app.sound.chime(1.2);
        for (let i = 0; i < 70; i++) {
          const a = Math.random() * TAU, s = 200 + Math.random() * 600;
          app.particles.spawn(app.W / 2, app.H / 2, Math.cos(a) * s, Math.sin(a) * s, 1.2, 3 + Math.random() * 5, null, 1, 0, 0.93);
        }
      } else if (this.tr.phase === 'in' && this.tr.t >= IN) this.tr = null;
    }
    this.current?.update?.(dt);
  }

  draw(ctx) { this.current?.draw?.(ctx); }
  drawTop(ctx) { this.current?.drawTop?.(ctx); }

  drawTransition(ctx) {
    const tr = this.tr;
    if (!tr) return;
    const W = app.W, H = app.H;
    const maxR = Math.hypot(Math.max(tr.x, W - tr.x), Math.max(tr.y, H - tr.y)) * 1.1;
    ctx.save();
    if (tr.phase === 'out') {
      const p = ease.inOut(clamp(tr.t / OUT));
      const r = maxR * p;
      const g = ctx.createRadialGradient(tr.x, tr.y, r * 0.1, tr.x, tr.y, Math.max(1, r));
      g.addColorStop(0, 'rgba(255,250,235,1)');
      g.addColorStop(0.7, 'rgba(255,214,250,0.95)');
      g.addColorStop(1, 'rgba(160,140,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(tr.x, tr.y, Math.max(1, r), 0, TAU); ctx.fill();
      // sparkle ring on the rim
      ctx.globalCompositeOperation = 'lighter';
      const spr = glowSprite('#ffe28a');
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU + app.t * 3;
        const s = 26 * app.u;
        ctx.drawImage(spr, tr.x + Math.cos(a) * r - s, tr.y + Math.sin(a) * r - s, s * 2, s * 2);
      }
    } else {
      const p = clamp(tr.t / IN);
      ctx.globalAlpha = 1 - ease.out(p);
      ctx.fillStyle = 'rgb(255,248,240)';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }
}
