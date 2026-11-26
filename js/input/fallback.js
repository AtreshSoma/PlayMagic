// ---------------------------------------------------------------------------
// Mouse & keyboard fallback ("touch-weaving"). Produces the same events as the
// camera pipeline so every feature can be tested without a webcam.
//   mouse move  → hand cursor + gaze      left hold → pinch, release → palm
//   shift-drag / right-drag → rune casting    wheel → two-hand zoom
//   Space blink · ←/→/↑ swipes · 1 smile · 2 mouth · 3 brows · 4 focus
//   A/D head tilt · 7/8/9 cast ◯/△/꩜ · G spellbook · L leaderboard
//   R settings · M mute · V mirror · C runic card · Esc back
// Expanded gesture vocabulary (held keys act as hand poses on the mouse hand):
//   H open palm · F fist (gravity well) · P peace · T thumbs up · B two-hand frame
//   O cheek puff · Z / X left / right wink · Y nod (yes) · N shake (no)
//   Space twice quickly → double blink
// ---------------------------------------------------------------------------
const ONE_SHOT = {
  Space: { type: 'blink' },
  ArrowLeft: { type: 'swipe', dir: 'left' }, KeyQ: { type: 'swipe', dir: 'left' },
  ArrowRight: { type: 'swipe', dir: 'right' }, KeyE: { type: 'swipe', dir: 'right' },
  ArrowUp: { type: 'swipe', dir: 'up' }, KeyW: { type: 'swipe', dir: 'up' },
  KeyG: { type: 'cmd', name: 'grimoire' }, KeyL: { type: 'cmd', name: 'hall' },
  KeyR: { type: 'cmd', name: 'settings' }, KeyM: { type: 'cmd', name: 'mute' },
  KeyV: { type: 'cmd', name: 'mirror' }, KeyC: { type: 'cmd', name: 'card' },
  KeyK: { type: 'cmd', name: 'kids' }, Slash: { type: 'cmd', name: 'help' },
  KeyZ: { type: 'winkL' }, KeyX: { type: 'winkR' },
  KeyY: { type: 'nod' }, KeyN: { type: 'shake' },
  KeyH: { type: '_palmKey' },
  Escape: { type: 'cmd', name: 'back' }, Enter: { type: 'cmd', name: 'confirm' },
  Digit7: { type: 'keyRune', shape: 'circle' }, Digit8: { type: 'keyRune', shape: 'triangle' }, Digit9: { type: 'keyRune', shape: 'spiral' },
};

export class Fallback {
  constructor() {
    this.x = window.innerWidth / 2; this.y = window.innerHeight / 2;
    this.down = false; this.right = false; this.shift = false;
    this.lastMove = -10; this.keys = new Set(); this.queue = []; this.tapUntil = {};
    this.enabled = true; this.pointerType = 'mouse';
    const now = () => performance.now() / 1000;

    window.addEventListener('pointermove', (e) => {
      this.x = e.clientX; this.y = e.clientY; this.shift = e.shiftKey; this.lastMove = now(); this.pointerType = e.pointerType || 'mouse';
    }, { passive: true });
    window.addEventListener('pointerdown', (e) => {
      this.x = e.clientX; this.y = e.clientY; this.lastMove = now(); this.pointerType = e.pointerType || 'mouse';
      if (e.button === 2) this.right = true;
      else if (e.button === 0) { this.down = true; this.queue.push({ type: '_down' }); }
    });
    window.addEventListener('pointerup', (e) => {
      if (e.button === 2) this.right = false;
      else if (e.button === 0 && this.down) { this.down = false; this.queue.push({ type: '_up' }); }
    });
    // A touch that turns into a native scroll is cancelled: release the pinch, but never as a tap.
    window.addEventListener('pointercancel', () => {
      this.right = false;
      if (this.down) { this.down = false; this.queue.push({ type: '_up', cancel: true }); }
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => {
      if (e.target.closest && e.target.closest('.overlay, #home')) return; // let overlays and Home scroll
      this.queue.push({ type: 'zoom', factor: Math.exp(-e.deltaY * 0.0012) });
    }, { passive: true });
    window.addEventListener('keydown', (e) => {
      if (e.target.isContentEditable) return;
      this.lastKey = now();
      this.shift = e.shiftKey;
      // Keys aimed at a focused control (Home cards, buttons) belong to that control.
      const native = !!(e.target.closest && e.target.closest('button, [role="option"], [role="listbox"], a, input'));
      if (native && ['Space', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.code)) { this.keys.add(e.code); return; }
      if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (!e.repeat && ONE_SHOT[e.code]) this.queue.push({ ...ONE_SHOT[e.code], key: true });
      this.keys.add(e.code);
      if (!e.repeat) this.tapUntil[e.code] = now() + 0.22;
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); this.shift = e.shiftKey; });
    window.addEventListener('blur', () => { this.keys.clear(); this.tapUntil = {}; this.down = false; this.right = false; });
  }

  /** Held now, or tapped within the last 0.22 s (so a quick tap still registers for a few frames). */
  held(code) { return this.keys.has(code) || performance.now() / 1000 < (this.tapUntil[code] || 0); }
  /** True while any pose key (F P T H B O) is held — keeps the mouse hand "present". */
  poseHeld() { for (const c of ['KeyF', 'KeyP', 'KeyT', 'KeyH', 'KeyB', 'KeyO']) if (this.held(c)) return true; return false; }
  recent(t, window = 2.5) { return t - this.lastMove < window || this.down || this.right; }
  drain() { const q = this.queue; this.queue = []; return q; }
}
