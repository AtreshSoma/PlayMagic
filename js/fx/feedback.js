// ---------------------------------------------------------------------------
// Global feedback layer. Turns every detected micro-action into immediate,
// unmistakable light + sound, and runs the continuous "facial magic":
//   pinch → shockwave ripple + crystalline chime     palm → momentum scatter
//   rune  → spell + resonant arpeggio                flick → element / mirror
//   brows → levitation + brightening                 mouth → exhaled stream
// First-time actions are recorded as discovered magics (see ui/discovery.js).
//   smile → golden bloom                             tilt  → gravity vector
//   fingertip motion → pentatonic chimes (pitch = height, pan = x)
// Scenes may opt out via scene.allow = { swipe, runes, faceMagic, chimes, overlays }.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { RUNES } from '../input/runes.js';
import { discover } from '../ui/discovery.js';
import { clamp, approach, smoothstep, dist, rand, TAU } from '../core/util.js';

export class Feedback {
  constructor() {
    this.lastChime = 0; this.lastNote = 0; this.mouthAcc = 0; this.zoomStart = 1; this.lastZoomStep = 10;
    this.tiltAngle = 0; this.trailAcc = new Map();
  }

  update(dt) {
    const inp = app.input, allow = app.scenes.current?.allow || {};
    for (const e of inp.events) this.handle(e, allow);
    this.continuous(dt, allow);
  }

  handle(e, allow) {
    const W = app.W, H = app.H, th = app.theme, A = app.actions, ov = app.overlays;
    const pan = (x) => clamp((x / W) * 2 - 1, -1, 1);
    switch (e.type) {
      case 'pinchStart':
        app.fx.shockwave(e.x, e.y, { r1: 120 });
        app.tapestry.ripple(e.x, e.y);
        app.particles.emit({ x: e.x, y: e.y, count: 14, speed: [60, 200], life: [0.3, 0.7], size: [1.5, 3.5] });
        app.audio.pinch(e.x / W, e.y / H);
        if (e.primary) discover('pinch');
        break;
      case 'pinchEnd':
        app.audio.tick(pan(e.x), 0.12);
        break;
      case 'palmOpen':
        if (allow.scatter === false) break;
        app.particles.impulse(e.x, e.y, 300, 380, (e.vx || 0) * 0.35, (e.vy || 0) * 0.35);
        app.particles.emit({ x: e.x, y: e.y, count: 22, speed: [180, 420], life: [0.6, 1.2], size: [1.5, 4], vx: (e.vx || 0) * 0.3, vy: (e.vy || 0) * 0.3 });
        app.fx.shockwave(e.x, e.y, { color: th.accent2, r1: 210, dur: 0.8, width: 2 });
        app.audio.release(pan(e.x));
        if (e.primary) discover('palm');
        break;
      case 'swipe':
        if (ov.active) break;
        if (allow.swipe === false) break;
        if (e.key && app.scenes.name === 'hub') break; // ← → browse the hub instead
        if (e.dir === 'left' || e.dir === 'right') {
          const d = e.dir === 'right' ? 1 : -1;
          for (let i = 0; i < 40; i++) app.particles.spawn(d > 0 ? -20 : W + 20, rand(H), d * rand(500, 1100), rand(-40, 40), rand(0.8, 1.6), rand(1.5, 4), th.accent, 3, 0, 0.985, 0);
          A.cycleTheme(d);
          discover('swipe');
        } else if (e.dir === 'up') A.cycleMirror();
        break;
      case 'runeBegin':
        app.audio.chime(app.audio.noteFromY(e.y / H, 2), { vel: 0.18, bright: 0.3, dur: 0.8, pan: pan(e.x) });
        app.fx.shockwave(e.x, e.y, { color: th.accent2, r1: 40, dur: 0.4, width: 1.5 });
        break;
      case 'runePoint':
        app.audio.tick(pan(e.x), 0.07);
        app.particles.emit({ x: e.x, y: e.y, count: 3, speed: [10, 50], life: [0.6, 1.2], size: [1.2, 2.5], raw: true });
        break;
      case 'rune':
        if (allow.runes === false || ov.active) break;
        this.castSpell(e);
        discover(e.shape);
        break;
      case 'runeFail':
        app.fx.fizzle(e.pts);
        app.audio.fizzle();
        app.fx.glyphFlash(e.x, e.y, 'THE RUNE UNRAVELS', '#b9b3ff');
        break;
      case 'blink':
        app.audio.tick(0, 0.2);
        break;
      case 'smile':
        if (allow.faceMagic === false) break;
        { const p = this.facePoint(); app.fx.bloom(p.x, p.y); app.audio.bloom(); this.faceLabel('BLOOM'); app.fx.flash('#ffd479', 0.12); discover('smile'); }
        break;
      case 'mouthOpen':
        if (allow.faceMagic === false) break;
        this.faceLabel('EXHALE');
        discover('mouth');
        app.audio.swell(app.audio.noteFromY(0.6), { vel: 0.25, dur: 1 });
        break;
      case 'brows':
        if (allow.faceMagic === false) break;
        this.faceLabel('LEVITATE');
        discover('brows');
        app.audio.levitate();
        break;
      case 'twoHandStart':
        this.zoomStart = app.zoom;
        app.audio.swell(196, { vel: 0.35, dur: 1 });
        break;
      case 'zoom':
        if (ov.active) break;
        app.zoom = clamp(app.zoom * e.factor, 0.6, 1.8);
        this.zoomTick();
        break;
      case 'cmd':
        if (e.name === 'grimoire') A.toggleGrimoire();
        else if (e.name === 'hall') A.toggleHall();
        else if (e.name === 'settings') A.toggleSettings();
        else if (e.name === 'mute') A.toggleMute();
        else if (e.name === 'back') A.back(false);
        else if (e.name === 'mirror') A.cycleMirror();
        else if (e.name === 'card') A.exportCard();
        else if (e.name === 'kids') A.enterKidsRealm();
        else if (e.name === 'help') A.toggleHelp();
        break;
    }
  }

  facePoint() {
    const f = app.input.face;
    if (f.present) return { x: f.x, y: f.y };
    return { x: app.W / 2, y: app.H * 0.45 };
  }
  faceLabel(text) {
    const p = this.facePoint(), f = app.input.face;
    if (!f.present) return; // only label a real, tracked face
    app.fx.glyphFlash(p.x, p.y - (f.present ? f.width * 0.75 : 60), text);
  }

  zoomTick() {
    const step = Math.round(app.zoom * 10);
    if (step !== this.lastZoomStep) { this.lastZoomStep = step; app.audio.tick(0, 0.18); }
  }

  castSpell(e) {
    const W = app.W, H = app.H, th = app.theme, { shape, x, y } = e;
    const size = clamp(e.size || 220, 160, 520);
    app.fx.runeGhost(shape, x, y, size);
    app.tapestry.ripple(x, y);
    if (shape === 'circle') {
      app.fx.shield(x, y, size);
      app.particles.impulse(x, y, Math.max(W, H), 650);
      app.particles.emit({ x, y, count: 90, speed: [220, 650], life: [0.8, 1.6], size: [2, 5] });
    } else if (shape === 'triangle') {
      const dir = x < W / 2 ? 0 : Math.PI;
      app.fx.prism(x, y, size, dir);
      const hues = ['#ff4b6e', '#ff9d42', '#ffe45c', '#5cff8f', '#4fd8ff', '#6c7bff', '#c86bff'];
      for (let i = 0; i < 70; i++) {
        const k = i % hues.length, a = dir + (k / (hues.length - 1) - 0.5) * 0.55 + rand(-0.03, 0.03), sp = rand(400, 1100);
        app.particles.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.6, 1.3), rand(1.5, 3.5), hues[k], 3, 0, 0.99, 0);
      }
    } else {
      app.fx.vortex(x, y, size);
      app.particles.addForce({ x, y, radius: Math.max(W, H) * 0.7, strength: 900, type: 'swirl', life: 2.2 });
      app.fx.add(2.4, () => {}, {
        update: (dt, fx) => {
          if (!fx.burst && fx.t > 2.15) {
            fx.burst = true;
            app.particles.impulse(x, y, 700, 900);
            app.particles.emit({ x, y, count: 70, speed: [300, 700], life: [0.6, 1.3], size: [2, 4.5] });
            app.fx.shockwave(x, y, { r1: 380, dur: 0.9, width: 4 });
            app.audio.release(0);
          }
        },
      });
    }
    app.audio.rune(shape);
    app.hud.toast(RUNES[shape].name, RUNES[shape].glyph, 1600);
    app.store.addTotal('runes');
    app.fx.flash(th.accent, 0.22);
  }

  continuous(dt, allow) {
    const inp = app.input, W = app.W, H = app.H, th = app.theme, t = app.t;
    const magic = allow.faceMagic !== false && !app.overlays.active;

    // Raised brows → levitation + brightening
    const lev = magic ? smoothstep(0.25, 0.8, inp.vals.brows) : 0;
    app.levitate = approach(app.levitate, lev, dt, 0.25);
    app.brightBoost = approach(app.brightBoost, lev, dt, 0.4);

    // Open mouth → exhaled stream from the mouth
    const m = magic ? inp.vals.mouth : 0;
    if (m > 0.22) {
      const f = inp.face;
      const mx = f.present ? f.mouthX : inp.cursor.active ? inp.cursor.x : W / 2;
      const my = f.present ? f.mouthY : inp.cursor.active ? inp.cursor.y : H * 0.62;
      this.mouthAcc += (m - 0.2) * 140 * app.intensity * dt;
      const n = this.mouthAcc | 0; this.mouthAcc -= n;
      for (let i = 0; i < n; i++) {
        const a = Math.PI / 2 + rand(-0.9, 0.9), sp = rand(120, 360) * (0.5 + m);
        app.particles.spawn(mx + rand(-6, 6), my + rand(-3, 3), Math.cos(a) * sp, Math.sin(a) * sp * 0.6,
          rand(1, 2.2), rand(1.5, 4), th.particles[(Math.random() * th.particles.length) | 0], th.kind, 0.1, 0.955, 1);
      }
    }
    app.audio.setExhale(m > 0.22 ? (m - 0.2) / 0.8 : 0, th.exhale);

    // Head tilt → gravity vector
    const target = allow.tilt === false ? 0 : clamp(inp.vals.tilt, -0.7, 0.7) * 1.25;
    this.tiltAngle = approach(this.tiltAngle, target, dt, 0.2);
    if (magic && Math.abs(this.tiltAngle) > 0.35) discover('tilt');
    app.gravity.x = Math.sin(this.tiltAngle); app.gravity.y = Math.cos(this.tiltAngle);

    // Magic dust swirls around your hand where the scene invites play
    if (!this.magnet) this.magnet = app.particles.addForce({ x: 0, y: 0, radius: 170, strength: 0, type: 'swirl', life: Infinity });
    const ph = inp.primary;
    this.magnet.strength = allow.magnet && ph && !app.overlays.active ? 240 : 0;
    if (ph) { this.magnet.x = ph.x; this.magnet.y = ph.y; }

    // Two-hand expansion
    if (inp.twoHand.active && !app.overlays.active) {
      app.zoom = clamp(this.zoomStart * inp.twoHand.ratio, 0.6, 1.8);
      this.zoomTick();
    }

    // Fingertip chimes
    const p = inp.primary;
    if (allow.chimes !== false && p && p.speed > 650 && t - this.lastChime > 0.12 && !app.overlays.active) {
      const f = app.audio.noteFromY(p.y / H);
      if (f !== this.lastNote || t - this.lastChime > 0.35) {
        const g = inp.gaze, gd = g.valid ? dist(g.x, g.y, p.x, p.y) : W * 0.3;
        app.audio.chime(f, { pan: (p.x / W) * 2 - 1, vel: clamp(p.speed / 3200, 0.08, 0.32), bright: 1 - clamp(gd / (W * 0.6)), dur: 1.5 });
        this.lastNote = f; this.lastChime = t;
      }
    }

    // Luminous trails from every moving fingertip
    for (const h of inp.allHands()) {
      const acc = (this.trailAcc.get(h) || 0) + h.speed * dt / (h.pinch ? 9 : 16);
      const n = Math.min(6, acc | 0);
      this.trailAcc.set(h, acc - (acc | 0));
      for (let i = 0; i < n; i++) {
        const col = h.pinch ? '#ffffff' : th.particles[(Math.random() * th.particles.length) | 0];
        const a = rand(TAU), sp = rand(5, 40);
        app.particles.spawn(h.x + rand(-3, 3), h.y + rand(-3, 3), Math.cos(a) * sp - h.vx * 0.04, Math.sin(a) * sp - h.vy * 0.04,
          rand(0.5, 1.1), rand(1, 2.6), col, th.kind === 3 ? 3 : 0, 0.08, 0.95, 0.6);
      }
    }
  }
}
