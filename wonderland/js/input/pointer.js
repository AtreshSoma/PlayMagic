// ---------------------------------------------------------------------------
// Mouse / touch / keyboard fallback. Every pointer becomes a "virtual hand"
// with the same shape as a camera hand, so all modes work without a camera.
//   mouse: hovers (dwell-select works) and draws while the button is down
//   touch: each finger is its own hand (multi-touch bubble popping!)
// Taps are queued so bubbles can claim them before a mode sees them.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { damp } from '../core/util.js';

const MOUSE_IDLE_MS = 2500;

export class PointerInput {
  constructor(el) {
    this.ptrs = new Map();
    this.taps = [];
    this.keys = new Set();
    this.keyDowns = [];

    const pos = (e) => ({ x: e.clientX, y: e.clientY });
    const get = (e) => {
      let p = this.ptrs.get(e.pointerId);
      if (!p) {
        const { x, y } = pos(e);
        p = { id: e.pointerId, type: e.pointerType || 'mouse', x, y, sx: x, sy: y, vx: 0, vy: 0, down: false, t: performance.now(), gone: false, hand: null };
        this.ptrs.set(e.pointerId, p);
      }
      return p;
    };

    // Listen on the whole window so the HTML Home page (drawn over the canvas) still moves
    // the sparkle cursor. Presses on HTML controls are left to those controls (no tap queued).
    const onUi = (e) => !!(e.target.closest && e.target.closest('#home button, #home a, #home [role="option"], #parent-btn, #parent-panel'));
    window.addEventListener('pointerdown', (e) => {
      const p = get(e), { x, y } = pos(e);
      p.x = p.sx = x; p.y = p.sy = y; p.down = true; p.gone = false; p.t = performance.now();
      if (onUi(e)) return;
      if (e.target === el) { try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ } e.preventDefault(); }
      this.taps.push({ x, y, type: p.type, used: false });
    });
    window.addEventListener('pointermove', (e) => {
      const p = get(e), { x, y } = pos(e);
      p.x = x; p.y = y; p.gone = false; p.t = performance.now();
    });
    const up = (e) => {
      const p = this.ptrs.get(e.pointerId);
      if (!p) return;
      p.down = false;
      if (p.type !== 'mouse') this.ptrs.delete(e.pointerId);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    document.documentElement.addEventListener('pointerleave', (e) => {
      const p = this.ptrs.get(e.pointerId);
      if (p && p.type === 'mouse') p.gone = true;
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (e.target.closest?.('#parent-panel')) return; // grown-up panel keeps its keys
      // keys aimed at a focused Home control belong to it
      if (e.target.closest?.('#home') && ['Enter', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab'].includes(e.code)) return;
      if (!e.repeat) this.keyDowns.push(e.code);
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  /** Builds/updates the virtual hands for this frame. */
  hands(dt, now) {
    const out = [];
    for (const p of this.ptrs.values()) {
      const recent = p.down || (!p.gone && now - p.t < MOUSE_IDLE_MS);
      if (p.type === 'mouse' && !recent) { if (p.hand) p.hand.recent = false; continue; }
      if (!p.hand) p.hand = { id: 'ptr' + p.id, src: p.type, tip: { x: p.x, y: p.y }, palm: { x: p.x, y: p.y }, lm: null, size: 70 * app.u, waving: false };
      const h = p.hand;
      // light smoothing only: pointers are already precise
      const px = h.x ?? p.x, py = h.y ?? p.y;
      h.x = damp(px, p.x, 40, dt); h.y = damp(py, p.y, 40, dt);
      p.vx = damp(p.vx, (h.x - px) / Math.max(dt, 1e-3), 20, dt);
      p.vy = damp(p.vy, (h.y - py) / Math.max(dt, 1e-3), 20, dt);
      h.vx = p.vx; h.vy = p.vy; h.speed = Math.hypot(h.vx, h.vy);
      h.tip.x = h.palm.x = h.x; h.tip.y = h.palm.y = h.y;
      h.pressed = p.down;
      h.pose = p.down ? 'point' : 'hover';
      h.recent = recent;
      h.size = 70 * app.u;
      out.push(h);
    }
    return out;
  }

  takeTaps() { const t = this.taps; this.taps = []; return t; }
  takeKeys() { const k = this.keyDowns; this.keyDowns = []; return k; }
}
