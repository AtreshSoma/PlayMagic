// ---------------------------------------------------------------------------
// Jelly Bubble: the one control used everywhere in the portal.
//
// Forgiving hover-to-select: hold any hand (or the mouse) over the bubble
// and a rainbow ring fills around it; at 1 s it pops into a choice. Taps,
// clicks and camera pinches select instantly. After choosing, the hand must leave before the
// same bubble can fire again, so nothing repeats by accident.
//
// Bubbles wobble like jelly when touched (two anti-phase springs give a
// volume-preserving squish) and bob gently while idle.
//
// options: { id, x, y, r, hue, icon(ctx, s, t, bubble), dwell = 1,
//            momentary (true = "held while touched", no dwell), onSelect }
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { TAU, Spring, clamp, damp, dist, hsl, rand } from '../core/util.js';
import { glowSprite, sparkSprite } from '../fx/sprites.js';

export class Bubble {
  constructor(o) {
    Object.assign(this, { id: '', x: 0, y: 0, r: 50, hue: 200, icon: null, dwell: 1, momentary: false, bob: 1, active: false, hidden: false, onSelect: null }, o);
    this.cx = this.x; this.cy = this.y;
    this.progress = 0; this.locked = false; this.hover = 0; this.hovered = false; this.wasHovered = false;
    this.held = false; this.selected = false; this.pop = 0; this.show = 1;
    this.sx = new Spring(260, 9, 1); this.sy = new Spring(260, 9, 1);
    this.phase = rand(TAU);
  }

  place(x, y, r) { this.x = x; this.y = y; if (r) this.r = r; return this; }

  contains(px, py, pad = 1.15) { return dist(px, py, this.cx, this.cy) < this.r * pad; }

  squish(power = 1) { this.sx.kick(5 * power); this.sy.kick(-5 * power); }

  update(dt) {
    this.selected = false;
    const t = app.t, input = app.input;
    this.show = damp(this.show, this.hidden ? 0 : 1, 10, dt);
    this.cx = this.x + Math.cos(t * 0.9 + this.phase) * this.r * 0.03 * this.bob;
    this.cy = this.y + Math.sin(t * 1.3 + this.phase) * this.r * 0.07 * this.bob;
    if (this.hidden) { this.progress = 0; this.hovered = false; this.held = false; return false; }

    let hov = false, pressed = false, cam = false;
    for (const h of input.hands) {
      if (h.src === 'mouse' && !h.recent) continue;
      const over = this.contains(h.x, h.y) || (h.src === 'cam' && this.contains(h.palm.x, h.palm.y, 1.0));
      if (over) { hov = true; if (h.pressed) pressed = true; if (h.src === 'cam') cam = true; }
    }
    for (const tp of input.taps) {
      if (!tp.used && this.contains(tp.x, tp.y, 1.25)) {
        tp.used = true;
        if (!this.momentary) this.fire();
      }
    }
    if (hov && !this.wasHovered) { this.squish(0.8); app.sound.wobble(); }
    this.wasHovered = hov; this.hovered = hov;
    this.hover = damp(this.hover, hov ? 1 : 0, 10, dt);

    if (this.momentary) {
      // touch screens: finger down on it · mouse: button held · camera: just hover
      this.held = hov && (pressed || cam);
    } else if (hov && !this.locked && !app.scenes.busy) {
      this.progress += dt / this.dwell;
      if (this.progress >= 1) this.fire();
    } else {
      this.progress = Math.max(0, this.progress - dt * 1.8);
      if (!hov) this.locked = false;
    }
    this.pop = Math.max(0, this.pop - dt * 3);
    this.sx.update(dt); this.sy.update(dt);
    return this.selected;
  }

  fire() {
    if (this.selected) return;
    this.selected = true; this.progress = 0; this.locked = true; this.pop = 1;
    this.squish(1.6);
    app.sound.chime(1, 0.09);
    app.sound.pop(1.2, 0.08);
    app.particles.burst(this.cx, this.cy, 26, null, { kind: 1, speed: 340, size: 6, life: 0.8 });
    this.onSelect?.(this);
  }

  draw(ctx) {
    if (this.show < 0.02) return;
    const t = app.t, h = this.hue;
    const r = this.r * (1 + this.hover * 0.1 + this.pop * 0.15) * this.show;
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.globalAlpha = this.show;

    // outer glow
    ctx.globalCompositeOperation = 'lighter';
    const gr = r * (1.9 + this.hover * 0.4 + (this.active ? 0.3 : 0));
    ctx.globalAlpha = this.show * (0.35 + this.hover * 0.35 + (this.active ? 0.25 : 0));
    ctx.drawImage(glowSprite(hsl(h, 100, 65)), -gr, -gr, gr * 2, gr * 2);
    ctx.globalAlpha = this.show;
    ctx.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.scale(this.sx.x, this.sy.x);
    // jelly body
    const body = ctx.createRadialGradient(-r * 0.3, -r * 0.38, r * 0.08, 0, 0, r);
    body.addColorStop(0, hsl(h, 100, 90, 0.75));
    body.addColorStop(0.55, hsl(h, 90, 62, 0.45));
    body.addColorStop(1, hsl(h + 35, 95, 58, 0.78));
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    // iridescent rim
    const rim = ctx.createLinearGradient(-r, -r, r, r);
    rim.addColorStop(0, hsl(h + 60 + t * 30, 100, 80, 0.9));
    rim.addColorStop(0.5, hsl(h + 180 + t * 30, 100, 80, 0.6));
    rim.addColorStop(1, hsl(h + 300 + t * 30, 100, 80, 0.9));
    ctx.strokeStyle = rim; ctx.lineWidth = Math.max(2, r * 0.06);
    ctx.stroke();
    // icon
    if (this.icon) { ctx.save(); this.icon(ctx, r * 0.62, t, this); ctx.restore(); }
    // glossy highlight
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(-r * 0.4, -r * 0.48, r * 0.24, r * 0.12, -0.6, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.arc(-r * 0.62, -r * 0.18, r * 0.05, 0, TAU); ctx.fill();
    ctx.restore();

    // "this one is chosen" orbiting sparkles
    if (this.active) {
      for (let k = 0; k < 3; k++) {
        const a = t * 2 + (k * TAU) / 3, s = r * 0.22;
        ctx.drawImage(sparkSprite('#fff6c0'), Math.cos(a) * r * 1.12 - s, Math.sin(a) * r * 1.12 - s, s * 2, s * 2);
      }
    }
    // held (momentary) pulse
    if (this.held) {
      ctx.strokeStyle = hsl(h, 100, 85, 0.8); ctx.lineWidth = r * 0.08;
      ctx.beginPath(); ctx.arc(0, 0, r * (1.12 + Math.sin(t * 10) * 0.04), 0, TAU); ctx.stroke();
    }
    ctx.restore();

    if (this.progress > 0.01) drawRainbowRing(ctx, this.cx, this.cy, r * 1.2, this.progress, Math.max(5, r * 0.13));
  }
}

/** The dwell ring: a rainbow arc that fills clockwise with a sparkle at its head. */
export function drawRainbowRing(ctx, x, y, R, p, w) {
  p = clamp(p);
  const SEG = 48, n = Math.ceil(SEG * p), start = -Math.PI / 2;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = w;
  ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.stroke();
  for (let pass = 0; pass < 2; pass++) {
    ctx.globalCompositeOperation = pass ? 'source-over' : 'lighter';
    ctx.lineWidth = pass ? w : w * 2.2;
    ctx.globalAlpha = pass ? 1 : 0.25;
    for (let i = 0; i < n; i++) {
      const a0 = start + (i / SEG) * TAU, a1 = start + Math.min(p, (i + 1) / SEG) * TAU;
      ctx.strokeStyle = hsl((i / SEG) * 330, 100, 64);
      ctx.beginPath(); ctx.arc(x, y, R, a0, a1 + 0.01); ctx.stroke();
    }
  }
  const a = start + p * TAU, s = w * 2.2;
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
  ctx.drawImage(sparkSprite('#ffffff'), x + Math.cos(a) * R - s, y + Math.sin(a) * R - s, s * 2, s * 2);
  ctx.restore();
}

/** The home bubble every mode shows top-left. */
export function homeBubble(iconFn) {
  return new Bubble({ id: 'home', hue: 45, icon: iconFn, dwell: 1.5, onSelect: (b) => app.scenes.go('hub', { x: b.cx, y: b.cy }) });
}
