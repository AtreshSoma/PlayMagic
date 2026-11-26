// ---------------------------------------------------------------------------
// Start screen: two clear choices.
//   • the sigil → start with the camera (hands + face)
//   • the small orb below → use the mouse instead
// Browsers need one real click to start sound and ask for the camera, so this
// is the only ordinary click in Aetheria. It then shows loading progress.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { drawSigil, glowText, drawOrb, drawKidsGateway } from '../ui/draw.js';
import { rgba, dist, clamp } from '../core/util.js';

export class IntroScene {
  constructor() { this.allow = { swipe: false, runes: false, faceMagic: false, chimes: false, overlays: false }; this.status = ''; this.state = 'await'; this.t = 0; }

  geo() {
    const W = app.W, H = app.H, r = Math.min(W, H) * 0.15;
    return { cx: W / 2, cy: H * 0.48, r, mx: W / 2, my: H * 0.48 + r + 150, mr: 26, kx: 64, ky: 72, kr: 26 };
  }

  enter() {
    this.t = 0; this.state = 'await';
    app.hud.hint('');
    const begin = (camera) => {
      if (this.state !== 'await') return;
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
      this.state = 'loading';
      app.actions.awaken(camera);
    };
    const onPointer = (e) => {
      if (e.button !== 0) return;
      const g = this.geo();
      if (dist(e.clientX, e.clientY, g.kx, g.ky) < g.kr * 1.8) { this.state = 'kids'; return app.actions.enterKidsRealm(); }
      if (dist(e.clientX, e.clientY, g.mx, g.my) < g.mr * 2.2) begin(false);
      else begin(true);
    };
    const onKey = (e) => { if (e.code === 'KeyK') { this.state = 'kids'; return app.actions.enterKidsRealm(); } if (e.code === 'KeyF' || e.code === 'KeyM') begin(false); else if (e.code === 'Enter' || e.code === 'Space') begin(true); };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
  }

  setStatus(s) { this.status = s; }
  update(dt) { this.t += dt; }

  drawFront(ctx) {
    const t = this.t, { cx, cy, r, mx, my, mr, kx, ky, kr } = this.geo();
    const loading = this.state === 'loading', c = app.input.cursor;
    const overSigil = c.active && dist(c.x, c.y, cx, cy) < r * 1.05 && dist(c.x, c.y, kx, ky) >= kr * 1.8;
    const overMouse = c.active && dist(c.x, c.y, mx, my) < mr * 2.2;
    const overKids = c.active && dist(c.x, c.y, kx, ky) < kr * 1.8;
    drawKidsGateway(ctx, kx, ky, kr, { hover: overKids ? 1 : 0 });
    drawSigil(ctx, cx, cy, r * (1 + Math.sin(t * 1.6) * 0.03 + (overSigil && !loading ? 0.06 : 0)), loading ? t * 4 : t * (overSigil ? 2.5 : 1));
    const size = Math.min(72, app.W * 0.08);
    glowText(ctx, 'AETHERIA', cx, cy - r - size * 1.05, { size, spacing: size * 0.22, blur: 28 });
    glowText(ctx, 'Magic you control with your hands and face', cx, cy - r - size * 0.3, { size: Math.max(17, size * 0.3), font: 'Cormorant Garamond', weight: 600, color: rgba('#ffffff', 0.8), blur: 8 });
    if (loading) {
      glowText(ctx, this.status || 'Getting ready…', cx, cy + r + 50, { size: 19, font: 'Cormorant Garamond', weight: 600, alpha: 0.9 });
      glowText(ctx, 'If your browser asks, allow the camera', cx, cy + r + 78, { size: 13, font: 'Inter', weight: 500, alpha: 0.55, blur: 0 });
      return;
    }
    const a = overSigil ? 1 : 0.65 + 0.35 * Math.sin(t * 2.4);
    glowText(ctx, 'CLICK THE SIGIL TO START', cx, cy + r + 44, { size: 14, font: 'Inter', weight: 600, spacing: 3, alpha: a, blur: 10 });
    glowText(ctx, 'Uses your camera to see your hands and face. Nothing leaves this device.', cx, cy + r + 72, { size: 16, font: 'Cormorant Garamond', weight: 400, color: rgba('#ffffff', 0.62), blur: 0 });
    drawOrb(ctx, mx, my, mr, { hover: overMouse ? 1 : 0, pulse: 0, dwell: 0, hold: 0 }, { glyph: '⌖', glyphSize: 20 });
    glowText(ctx, 'No camera? Use the mouse instead', mx, my + mr + 20, { size: 13, font: 'Inter', weight: 500, alpha: clamp(overMouse ? 1 : 0.6), blur: 0 });
  }
}
