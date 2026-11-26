// ---------------------------------------------------------------------------
// The 15-second tutorial — learn by doing, three steps:
//   1  Touch the three stars        (moving the light)
//   2  Grab the orb, then let it go (pinch + open hand)
//   3  Smile                        (your face casts magic too)
// Swipe right / → skips a step, Esc skips the tutorial.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { ICONS } from '../ui/icons.js';
import { glowText } from '../ui/draw.js';
import { TAU, rgba, clamp, dist, approach } from '../core/util.js';

const STEPS = [
  { key: 'touch', icon: 'point', title: 'Touch the three stars', cam: 'Raise your hand and point at the screen. The light follows your finger.', mouse: 'Move the mouse. The light follows it.' },
  { key: 'pinch', icon: 'pinch', title: 'Grab the orb', cam: 'Move onto the orb, then pinch your thumb and finger together.', mouse: 'Move onto the orb, then press and hold the mouse button.' },
  { key: 'smile', icon: 'smile', title: 'Now smile', cam: 'Your face can cast magic too.', mouse: 'Hold the 1 key. With a camera, you simply smile.' },
];

export class InitiationScene {
  constructor() {
    this.allow = { swipe: false, runes: false, faceMagic: true, chimes: true, overlays: false, magnet: true };
    this.needsHand = true;
    this.card = document.getElementById('ritual');
    this.els = { step: document.getElementById('ritual-step'), icon: document.getElementById('ritual-icon'), title: document.getElementById('ritual-title'), text: document.getElementById('ritual-text'), alt: document.getElementById('ritual-alt'), pips: document.getElementById('ritual-pips') };
  }

  enter() {
    this.i = 0; this.done = false;
    this.card.hidden = false;
    app.hud.hint(`<b>Esc</b> skips the tutorial`);
    this._begin();
  }
  exit() { this.card.hidden = true; }

  _begin() {
    const s = STEPS[this.i], W = app.W, H = app.H;
    this.phase = 'active'; this.successT = 0;
    this.stars = [[0.28, 0.3], [0.72, 0.26], [0.5, 0.52]].map(([x, y]) => ({ x: x * W, y: y * H, lit: false, glow: 0 }));
    this.orb = { x: W * 0.5, y: H * 0.4, r: 38, grabbed: false, glow: 0 };
    this._card(s.icon, s.title, app.mode === 'camera' ? s.cam : s.mouse);
  }
  _card(icon, title, text) {
    const e = this.els;
    e.step.textContent = `STEP ${this.i + 1} OF ${STEPS.length}`;
    e.icon.innerHTML = ICONS[icon]; e.title.textContent = title; e.text.textContent = text; e.alt.textContent = '';
    e.pips.innerHTML = STEPS.map((_, k) => `<i class="${k < this.i ? 'done' : k === this.i ? 'now' : ''}"></i>`).join('');
  }

  _succeed(x, y) {
    if (this.phase !== 'active') return;
    this.phase = 'success'; this.successT = 0;
    app.particles.emit({ x, y, count: 70, speed: [120, 480], life: [0.8, 1.6], size: [2, 5] });
    app.fx.shockwave(x, y, { r1: 260, dur: 1, width: 4 });
    app.audio.victory();
    this.els.pips.children[this.i]?.classList.add('done');
  }

  _next() { this.i++; if (this.i >= STEPS.length) return this._complete(); this._begin(); }
  _complete() {
    if (this.done) return;
    this.done = true;
    app.store.data.initiated = true; app.store.save();
    app.hud.toast(`You're ready, ${app.store.data.profile.name}`, '✦', 2600);
    app.actions.goHub();
  }
  skipAll() { this._complete(); }

  update(dt) {
    const inp = app.input;
    if (this.done) return; // transition to the hub is playing
    if (inp.events.some((e) => e.type === 'swipe' && e.dir === 'right')) { app.audio.whoosh(1); return this._next(); }
    if (this.phase === 'success') { this.successT += dt; if (this.successT > 1.2) this._next(); return; }
    const key = STEPS[this.i].key, c = inp.cursor;

    if (key === 'touch') {
      for (const s of this.stars) {
        const near = c.active && dist(c.x, c.y, s.x, s.y) < 60;
        s.glow = approach(s.glow, s.lit ? 1 : near ? 0.6 : 0.15, dt, 0.12);
        if (near && !s.lit) {
          s.lit = true;
          app.audio.chime(app.audio.noteFromY(1 - this.stars.filter((q) => q.lit).length / 4), { vel: 0.45, bright: 0.9 });
          app.particles.emit({ x: s.x, y: s.y, count: 24, speed: [60, 220], life: [0.5, 1] });
          app.fx.shockwave(s.x, s.y, { r1: 80 });
        }
      }
      if (this.stars.every((s) => s.lit)) this._succeed(this.stars[2].x, this.stars[2].y);
    }
    if (key === 'pinch') {
      const o = this.orb, p = inp.primary;
      for (const e of inp.events) {
        if (e.type === 'pinchStart' && e.primary && !o.grabbed && dist(e.x, e.y, o.x, o.y) < o.r * 1.8) {
          o.grabbed = true; app.audio.select();
          this._card('palm', 'Now let it go', app.mode === 'camera' ? 'Carry it anywhere, then open your hand.' : 'Carry it anywhere, then release the button.');
        }
        if (o.grabbed && (e.type === 'palmOpen' || e.type === 'pinchEnd') && e.primary) {
          app.particles.impulse(o.x, o.y, 300, 500);
          this._succeed(o.x, o.y);
        }
      }
      if (o.grabbed && p) { o.x = approach(o.x, p.x, dt, 0.06); o.y = approach(o.y, p.y, dt, 0.06); }
      const near = c.active && dist(c.x, c.y, o.x, o.y) < o.r * 1.8;
      o.glow = approach(o.glow, o.grabbed ? 1 : near ? 0.6 : 0.15, dt, 0.15);
      // tooltip beside the cursor while hovering the orb
      if (!o.grabbed) app.ui.target('tut-orb', o.x, o.y, o.r * 1.5, { tip: 'grab' });
    }
    if (key === 'smile' && inp.has('smile')) {
      const f = inp.face;
      this._succeed(f.present ? f.x : app.W / 2, f.present ? f.y : app.H * 0.45);
      app.fx.flash('#ffd479', 0.45);
    }
  }

  drawBack(ctx) {
    const key = STEPS[this.i]?.key, t = app.t, acc = app.theme.accent;
    if (!key || this.done || this.phase === 'success') return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (key === 'touch') {
      for (const s of this.stars) {
        const sz = 18 + s.glow * 26 + Math.sin(t * 4 + s.x) * 3;
        ctx.globalAlpha = 0.4 + s.glow * 0.6;
        ctx.drawImage(app.particles.spriteCanvas(s.lit ? acc : '#cfd8ff'), s.x - sz, s.y - sz, sz * 2, sz * 2);
        if (!s.lit) {
          ctx.globalAlpha = 0.6; ctx.strokeStyle = rgba('#ffffff', 0.35); ctx.setLineDash([3, 6]); ctx.lineDashOffset = -t * 10;
          ctx.beginPath(); ctx.arc(s.x, s.y, 40, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        }
      }
    }
    if (key === 'pinch') {
      const o = this.orb, s = o.r * (1.6 + o.glow * 1.2) + Math.sin(t * 4) * 3;
      ctx.globalAlpha = 0.35 + o.glow * 0.65;
      ctx.drawImage(app.particles.spriteCanvas(acc), o.x - s, o.y - s, s * 2, s * 2);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = rgba('#ffffff', 0.3 + o.glow * 0.5); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.stroke();
      if (!o.grabbed) { ctx.setLineDash([4, 6]); ctx.lineDashOffset = -t * 10; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 1.8, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    }
    if (key === 'smile') {
      const f = app.input.face, x = f.present ? f.x : app.W / 2, y = f.present ? f.y : app.H * 0.42;
      const R = 90 + Math.sin(t * 2) * 8 + app.input.vals.smile * 60;
      const g = ctx.createRadialGradient(x, y, R * 0.3, x, y, R * 1.6);
      g.addColorStop(0, rgba('#ffd479', 0.12 + app.input.vals.smile * 0.3)); g.addColorStop(1, rgba('#ffd479', 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 1.6, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  drawFront(ctx) {
    if (this.phase !== 'success') return;
    const a = clamp(1 - Math.abs(this.successT - 0.5) * 1.6);
    glowText(ctx, this.i === STEPS.length - 1 ? "You're ready" : 'Nice!', app.W / 2, app.H * 0.18, { size: 36, spacing: 4, alpha: a });
  }
}
