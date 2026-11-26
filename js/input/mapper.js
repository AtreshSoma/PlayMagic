// ---------------------------------------------------------------------------
// Single source of truth for camera-space → screen-space mapping.
// The video is drawn mirrored, "cover"-fitted, and slightly zoomed (EXPAND) so
// that a comfortable central reach of your hands spans the whole screen.
// Landmarks and the drawn video use the exact same transform, so the hand
// skeleton and cursor line up with your reflection.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';

const EXPAND_X = 0.8;  // fraction of camera width mapped to full screen width
const EXPAND_Y = 0.86;

export const mapper = {
  vw: 1280, vh: 720,
  setVideo(w, h) { if (w && h) { this.vw = w; this.vh = h; } },

  _cover() {
    const W = app.W, H = app.H, va = this.vw / this.vh, sa = W / H;
    if (sa > va) { const dh = W / va; return { ox: 0, oy: (H - dh) / 2, dw: W, dh }; }
    const dw = H * va; return { ox: (W - dw) / 2, oy: 0, dw, dh: H };
  },

  /** Normalised (unmirrored) landmark → screen pixels. */
  toScreen(nx, ny, out = { x: 0, y: 0 }) {
    const c = this._cover();
    out.x = c.ox + (((1 - nx) - 0.5) / EXPAND_X + 0.5) * c.dw;
    out.y = c.oy + ((ny - 0.5) / EXPAND_Y + 0.5) * c.dh;
    return out;
  },

  /** Rectangle the full (mirrored) video frame occupies on screen. */
  videoRect() {
    const c = this._cover();
    const w = c.dw / EXPAND_X, h = c.dh / EXPAND_Y;
    return { x: c.ox + (c.dw - w) / 2, y: c.oy + (c.dh - h) / 2, w, h };
  },
};
