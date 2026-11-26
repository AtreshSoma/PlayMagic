// ---------------------------------------------------------------------------
// Immediate-mode gesture targets. Every frame, scenes call
//   const r = ui.target(id, x, y, radius, opts)
// and get back hover / dwell / primed / selected for that orb.
// Selection paths (no buttons anywhere), modelled on visionOS:
//   • focus: the hand cursor snaps magnetically to the nearest target in
//     reach (the mouse snaps only a little), and ui.snap tells the reticle
//     where to draw the hover glow
//   • pinch ANYWHERE, with either hand, selects the focused target, so the
//     pointing hand never has to hold still while the other one pinches
//   • opts.release: select on pinch *release* if the pinch didn't travel,
//     which leaves pinch-and-drag free for scrolling (see ui.drag)
//   • in eye-driven scenes: gaze dwell primes the target + deliberate blink
//   • opts.tip shows "Pinch to …" beside the cursor while hovering
//   • opts.hold: pinch must be held on the target (guards against accidents)
//   • opts.autoDwell: very long gaze dwell selects on its own (accessibility)
// A modal layer (open overlay) silences targets of other layers.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { dist, clamp, approach } from '../core/util.js';
import { verb } from './hud.js';

const NONE = Object.freeze({ hover: 0, handHover: false, gazeHover: false, dwell: 0, primed: false, selected: false, hold: 0, pulse: 0 });

export class UI {
  constructor() {
    this.state = new Map();
    this.frame = 0;
    this.modal = null;
    this.gazeFocus = { dwell: 0, primed: false, x: 0, y: 0 };
    this._focus = { dwell: 0, primed: false };
    this.cands = []; this._cands = []; this.focusId = null; this.snap = null;
    this.pinches = new Map(); this.releaseTap = null; this.drag = null;
  }

  begin(dt) {
    this.frame++; this.dt = dt;
    const inp = app.input;
    // magnetic focus from last frame's candidates
    const c = inp.cursor, hand = c.source === 'hand';
    let best = null, bs = Infinity;
    if (c.active) for (const k of this._cands) {
      const d = k.rect
        ? Math.hypot(Math.max(k.rect.left - c.x, 0, c.x - k.rect.right), Math.max(k.rect.top - c.y, 0, c.y - k.rect.bottom))
        : Math.max(0, dist(c.x, c.y, k.x, k.y) - k.r);
      const reach = k.rect ? (hand ? 26 : 4) : k.r * (hand ? 0.75 : 0.15) + (hand ? 18 : 6);
      if (d < reach && d < bs) { bs = d; best = k; }
    }
    // Sticky focus: while the fingers are closing (or pinched), keep the target that was in
    // focus. Closing the fingers slides the cursor toward the pinch point, which used to drag
    // it off small targets right at the moment of selection.
    const prim = inp.primary, closing = hand && (inp.allHands().some((x) => x.pinch) || (prim && prim.tension > 0.5));
    if (closing && this.focusId && (!best || best.id !== this.focusId)) {
      const prev = this._cands.find((k) => k.id === this.focusId);
      if (prev) best = prev;
    }
    this.focusId = best ? best.id : null;
    if (this.focusId) this.recentFocus = { id: this.focusId, t: app.t };
    this.snap = best;
    this._cands = [];
    // pinch bookkeeping: any hand's pinch counts; travel decides tap vs drag
    // Tap vs drag is judged on the PALM for camera hands (it stays put while the fingers close;
    // the fingertip cursor does not), with a tolerance that grows with the screen.
    this.releaseTap = null;
    const anchor = (h) => (h && h.source === 'camera' ? { x: h.palmX, y: h.palmY } : h ? { x: h.x, y: h.y } : null);
    const tapSlop = (h) => (h && h.source === 'camera' ? Math.max(44, Math.min(app.W, app.H) * 0.06) : 30);
    for (const e of inp.events) {
      if (e.type === 'pinchStart') {
        const h = inp.allHands().find((x) => x.label === e.hand), a = anchor(h) || e;
        // the target in focus a moment ago still counts (the cursor may have slid off as the fingers met)
        let focus = this.focusId;
        if (!focus && this.recentFocus && app.t - this.recentFocus.t < 0.35) focus = this.focusId = this.recentFocus.id;
        this.pinches.set(e.hand, { x0: e.x, y0: e.y, ax: a.x, ay: a.y, moved: 0, focus, t0: app.t, slop: tapSlop(h) });
      } else if (e.type === 'pinchEnd') {
        const p = this.pinches.get(e.hand);
        if (p && !e.cancel && p.moved < p.slop && app.t - p.t0 < 1.5) this.releaseTap = { focus: p.focus, used: false };
        this.pinches.delete(e.hand);
      }
    }
    this.drag = null;
    for (const [label, p] of this.pinches) {
      const h = inp.allHands().find((x) => x.label === label);
      if (!h || !h.pinch) { this.pinches.delete(label); continue; }
      const a = anchor(h);
      p.moved = Math.max(p.moved, dist(a.x, a.y, p.ax, p.ay));
      if (p.moved >= p.slop && !this.drag) this.drag = { dx: a.x - p.ax, dy: a.y - p.ay, vx: h.vx, vy: h.vy, hand: label, start: p };
    }
    this.pinch = inp.events.find((e) => e.type === 'pinchStart') || null;
    this.blink = inp.has('blink');
    this.pinchUsed = false; this.blinkUsed = false;
    this.gazeFocus = this._focus;
    this._focus = { dwell: 0, primed: false };
    this.tip = this._tip; this._tip = null;
    this.hoveringAny = false;
  }

  target(id, x, y, r, opts = {}) {
    const layer = opts.layer || 'scene';
    if (this.modal && layer !== 'global' && layer !== this.modal) return NONE;
    let s = this.state.get(id);
    if (!s) { s = { dwell: 0, hover: 0, wasHover: false, primedPlayed: false, holdT: 0, holdLock: false, pulse: 0, seen: 0 }; this.state.set(id, s); }
    if (s.seen < this.frame - 2) { s.dwell = 0; s.holdT = 0; s.hover = 0; }
    s.seen = this.frame;

    const inp = app.input, dt = this.dt, c = inp.cursor, g = inp.gaze;
    const R = opts.rect;
    if (opts.hand !== false) this._cands.push({ id, x, y, r: r * (opts.handPad ?? 1.15), rect: R ? { left: R.left, top: R.top, right: R.right, bottom: R.bottom } : null });
    const handHover = opts.hand !== false && c.active && this.focusId === id;
    // Gaze only selects in scenes built around the eyes (keeps one cursor elsewhere).
    const gazeOn = opts.gaze ?? (layer === 'scene' && !!app.scenes.current?.allow?.gaze);
    const gazeHover = gazeOn && g.valid && dist(g.x, g.y, x, y) < r * (opts.gazePad ?? 1.3) + 24;

    s.dwell = gazeHover ? s.dwell + dt : Math.max(0, s.dwell - dt * 2.5);
    const dwellNeed = opts.dwell ?? 0.65;
    const primed = s.dwell >= dwellNeed;
    if (primed && !s.primedPlayed) { s.primedPlayed = true; app.audio.primed(); }
    if (!primed) s.primedPlayed = false;
    if (gazeHover && s.dwell / dwellNeed > this._focus.dwell) this._focus = { dwell: clamp(s.dwell / dwellNeed), primed };

    const hovering = handHover || gazeHover;
    if (hovering && !s.wasHover) app.audio.hover();
    s.wasHover = hovering;
    if (hovering) this.hoveringAny = true;
    if (handHover && opts.tip) this._tip = { text: opts.hold ? `Hold ${verb().toLowerCase()} to ${opts.tip}` : `${verb()} to ${opts.tip}`, x, y, r };
    s.hover = approach(s.hover, hovering ? 1 : 0, dt, 0.08);

    let selected = false;
    if (opts.hold) {
      const pinching = inp.allHands().some((h) => h.pinch);
      if (handHover && pinching && !s.holdLock) s.holdT += dt; else s.holdT = 0;
      if (!pinching) s.holdLock = false;
      if (s.holdT >= opts.hold) { selected = true; s.holdT = 0; s.holdLock = true; }
    } else if (opts.release) {
      if (this.releaseTap && !this.releaseTap.used && this.releaseTap.focus === id) { selected = true; this.releaseTap.used = true; }
    } else if (handHover && this.pinch && !this.pinchUsed) { selected = true; this.pinchUsed = true; }
    if (!selected && primed && this.blink && !this.blinkUsed) { selected = true; this.blinkUsed = true; }
    if (!selected && opts.autoDwell && s.dwell >= opts.autoDwell) selected = true;

    if (selected) { s.dwell = 0; s.pulse = 1; }
    s.pulse = Math.max(0, s.pulse - dt * 2.5);
    return { hover: s.hover, handHover, gazeHover, dwell: clamp(s.dwell / dwellNeed), primed, selected, hold: opts.hold ? clamp(s.holdT / opts.hold) : 0, pulse: s.pulse };
  }

  /** Same as target() but for a DOM element; mirrors state into CSS classes. */
  targetEl(id, el, opts = {}) {
    if (!el) return NONE;
    const b = opts.box || el.getBoundingClientRect(); // callers may pass a cached rectangle
    if (b.width === 0) return NONE;
    const r = this.target(id, b.left + b.width / 2, b.top + b.height / 2, Math.max(b.width, b.height) / 2, { handPad: 1.0, gazePad: 1.05, rect: el.classList.contains('orb') ? null : b, ...opts });
    // Write to the DOM only when something changed: per-frame style writes force the browser
    // to recalculate layout on the next measurement.
    const hv = r.hover > 0.5, dw = Math.max(r.dwell, r.hold).toFixed(3);
    if (el.classList.contains('hover') !== hv) el.classList.toggle('hover', hv);
    if (el.classList.contains('primed') !== r.primed) el.classList.toggle('primed', r.primed);
    if (el._dw !== dw) { el._dw = dw; el.style.setProperty('--dwell', dw); }
    if (r.selected) {
      el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
    }
    return r;
  }
}
