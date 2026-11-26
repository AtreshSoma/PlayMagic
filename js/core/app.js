// ---------------------------------------------------------------------------
// Shared runtime context. A plain registry that main.js fills in at boot so
// modules can reach each other without circular imports.
// ---------------------------------------------------------------------------
export const app = {
  W: window.innerWidth,
  H: window.innerHeight,
  dpr: 1,
  t: 0,            // seconds since start
  dt: 0,           // last frame delta (s)
  frame: 0,
  mode: 'fallback', // 'camera' | 'fallback'

  // Systems (assigned in main.js)
  input: null, ui: null, audio: null, particles: null, fx: null,
  tapestry: null, mirror: null, hud: null, store: null, scenes: null,
  overlays: null, mood: null, vision: null, actions: null, astrolabe: null,

  // Living world state
  theme: null, themeKey: 'astral', intensity: 1,
  zoom: 1,                 // two-hand expansion / celestial zoom
  bloom: 0,                // combo bloom 0..1 (games)
  levitate: 0,             // raised-brow levitation 0..1
  brightBoost: 0,          // tapestry brightening 0..1
  gravity: { x: 0, y: 1 }, // unit vector, rotated by head tilt
  timeScale: 1,            // particle time (peace-sign freeze dips it)
  snapshotPending: false,  // set by a peace sign; main.js captures after render
  dock: null, pill: null,
};
