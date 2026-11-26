// ---------------------------------------------------------------------------
// Grown-up settings, saved in this browser only (localStorage).
// Nothing about the child is stored: just sound, mirror opacity and input.
// ---------------------------------------------------------------------------
const KEY = 'wonderland-portal.settings.v1';

const DEFAULTS = Object.freeze({
  sound: true,     // master on/off
  volume: 0.7,     // 0..1 (the engine is already soft; this scales it)
  mirror: 0.35,    // camera mirror opacity 0..1 (0 hides the child's image)
  input: 'camera', // 'camera' = camera + touch/mouse · 'touch' = touch/mouse only
});

export const settings = {
  data: { ...DEFAULTS },
  listeners: new Set(),

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(this.data, JSON.parse(raw));
    } catch { /* private window or blocked storage: defaults are fine */ }
    // sanitise anything odd that may have been stored
    const d = this.data;
    d.sound = d.sound !== false;
    d.volume = Number.isFinite(+d.volume) ? Math.min(1, Math.max(0, +d.volume)) : DEFAULTS.volume;
    d.mirror = Number.isFinite(+d.mirror) ? Math.min(1, Math.max(0, +d.mirror)) : DEFAULTS.mirror;
    d.input = d.input === 'touch' ? 'touch' : 'camera';
    return this;
  },

  set(key, value) {
    this.data[key] = value;
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
    for (const fn of this.listeners) fn(key, value);
  },

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
};
