// ---------------------------------------------------------------------------
// Shared runtime registry. main.js fills the systems in at boot so modules
// can reach each other without circular imports.
// ---------------------------------------------------------------------------
import { clamp } from './util.js';

export const FONT = 'Fredoka, "Baloo 2", "Nunito", ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif';

export const app = {
  W: window.innerWidth,
  H: window.innerHeight,
  dpr: 1,
  t: 0,
  dt: 0,
  frame: 0,
  /** Layout unit: 1 at ~800px short side. Multiply sizes and speeds by it. */
  u: 1,

  // systems (assigned in main.js)
  canvas: null, ctx: null, settings: null, input: null, sound: null,
  particles: null, world: null, scenes: null, coach: null, hud: null, cursors: null,

  /** Native camera resolution; set once the stream opens. */
  video: { w: 1280, h: 720 },

  font(px, weight = 600) { return `${weight} ${Math.round(px)}px ${FONT}`; },

  /**
   * Camera-normalised (0..1) → screen pixels, matching the mirrored,
   * cover-fitted mirror exactly. Used for the face (hats must sit on heads).
   */
  mapFace(nx, ny) {
    const { w: vw, h: vh } = this.video;
    const s = Math.max(this.W / vw, this.H / vh);
    const ox = (this.W - vw * s) / 2, oy = (this.H - vh * s) / 2;
    return { x: ox + (1 - nx) * vw * s, y: oy + ny * vh * s };
  },

  /**
   * Same mapping plus "reach gain": small arms rarely reach the frame edges,
   * so hand motion is expanded around the centre to cover the whole screen.
   */
  mapHand(nx, ny) {
    const p = this.mapFace(nx, ny), G = 1.32;
    return {
      x: clamp(this.W / 2 + (p.x - this.W / 2) * G, -40, this.W + 40),
      y: clamp(this.H / 2 + (p.y - this.H / 2) * G - this.H * 0.04, -40, this.H + 40),
    };
  },
};
