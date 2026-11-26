// ---------------------------------------------------------------------------
// Scene manager with a "portal iris" transition, plus the overlay manager
// (Spellbook, Leaderboard, Settings). While an overlay is open the
// UI goes modal and games pause.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { TAU, rgba, easeInOutCubic } from '../core/util.js';

export class SceneManager {
  constructor() { this.map = {}; this.current = null; this.name = ''; this.trans = null; }
  register(name, scene) { scene.name = name; this.map[name] = scene; }

  go(name, params = {}, { instant = false } = {}) {
    if (this.trans) return;
    if (instant || !this.current) { this._switch(name, params); return; }
    this.trans = { to: name, params, t: 0, phase: 'out', x: params.fromX ?? app.W / 2, y: params.fromY ?? app.H / 2 };
    app.audio.portal();
  }

  _switch(name, params) {
    this.current?.exit?.();
    app.input.rune.cancel();
    this.current = this.map[name];
    this.name = name;
    document.body.toggleAttribute('data-game', !!this.current.isGame);
    document.body.dataset.scene = name;
    this.current.enter?.(params);
  }

  update(dt) {
    const tr = this.trans;
    if (tr) {
      tr.t += dt;
      if (tr.phase === 'out' && tr.t >= 0.45) { this._switch(tr.to, tr.params); tr.phase = 'in'; tr.t = 0; tr.x = app.W / 2; tr.y = app.H / 2; }
      else if (tr.phase === 'in' && tr.t >= 0.55) this.trans = null;
    }
    this.current?.update?.(dt);
  }

  drawBack(ctx) { this.current?.drawBack?.(ctx); }
  drawFront(ctx) { this.current?.drawFront?.(ctx); }

  drawTransition(ctx) {
    const tr = this.trans;
    if (!tr) return;
    const W = app.W, H = app.H, maxR = Math.hypot(W, H);
    const p = tr.phase === 'out' ? easeInOutCubic(tr.t / 0.45) : 1 - easeInOutCubic(tr.t / 0.55);
    const r = Math.max(0, maxR * (1 - p));
    ctx.save();
    ctx.fillStyle = rgba(app.theme.shader[0], 0.96);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(tr.x, tr.y, r, 0, TAU, true); ctx.fill('evenodd');
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(app.theme.accent, 0.8 * p); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(tr.x, tr.y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = rgba('#ffffff', 0.4 * p); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(tr.x, tr.y, r * 0.96, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}

export class OverlayManager {
  constructor() { this.map = {}; this.active = null; }
  register(name, o) { this.map[name] = o; }
  open(name, params) {
    if (this.active === name) return;
    if (this.active) this.map[this.active].close();
    this.active = name;
    app.ui.modal = name;
    app.input.rune.cancel();
    this.map[name].open(params);
    document.body.classList.add('overlay-open');
  }
  close() {
    if (!this.active) return;
    this.map[this.active].close();
    this.active = null;
    app.ui.modal = null;
    document.body.classList.remove('overlay-open');
    app.audio.tick(0, 0.2);
  }
  toggle(name, params) { this.active === name ? this.close() : this.open(name, params); }
  update(dt) {
    for (const o of Object.values(this.map)) if (o.animate) o.animate(dt);
    if (this.active) this.map[this.active].update(dt);
  }
  draw(ctx) { for (const o of Object.values(this.map)) o.draw?.(ctx); }
}
