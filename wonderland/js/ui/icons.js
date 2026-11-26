// ---------------------------------------------------------------------------
// Zero-reading icon set. Every control in the portal is a picture, never a
// word. Icons draw centred on (0,0) at size `s` (≈ radius) and may animate
// with `t`. Also exports the hand and face silhouettes used by the coach.
// ---------------------------------------------------------------------------
import { TAU, hsl } from '../core/util.js';
import { glowSprite, sparkSprite } from '../fx/sprites.js';
import { drawFirefly, drawFrog, drawDragon } from './characters.js';
import { drawStar, drawHeart, drawPlanet, drawPlane, drawBoat, drawCrown, drawWizard, drawBunny, drawCat } from './props.js';

// ------------------------------------------------------------------ silhouettes
/**
 * A friendly cartoon hand, palm facing the viewer, fingers up.
 * ext = [thumb, index, middle, ring, pinky] extension 0..1.
 */
export function drawHand(ctx, s, ext = [1, 1, 1, 1, 1], { fill = 'rgba(255,255,255,0.95)', glow = '#ffd6fb' } = {}) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.shadowColor = glow; ctx.shadowBlur = s * 0.35;
  const pw = s * 0.9, ph = s * 0.82;
  const cap = (x, y, len, w, ang) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2, -len + w / 2);
    ctx.arc(0, -len + w / 2, w / 2, Math.PI, 0); ctx.lineTo(w / 2, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  // palm
  ctx.beginPath();
  const r = s * 0.28;
  ctx.moveTo(-pw / 2 + r, -ph / 2); ctx.lineTo(pw / 2 - r, -ph / 2); ctx.quadraticCurveTo(pw / 2, -ph / 2, pw / 2, -ph / 2 + r);
  ctx.lineTo(pw / 2, ph / 2 - r); ctx.quadraticCurveTo(pw / 2, ph / 2, pw / 2 - r * 1.2, ph / 2 + r * 0.2);
  ctx.lineTo(-pw / 2 + r * 1.2, ph / 2 + r * 0.2); ctx.quadraticCurveTo(-pw / 2, ph / 2, -pw / 2, ph / 2 - r);
  ctx.lineTo(-pw / 2, -ph / 2 + r); ctx.quadraticCurveTo(-pw / 2, -ph / 2, -pw / 2 + r, -ph / 2);
  ctx.fill();
  const fw = s * 0.2, lens = [0.62, 0.72, 0.66, 0.52], xs = [-0.33, -0.11, 0.11, 0.33], spread = [-0.12, -0.04, 0.04, 0.14];
  for (let i = 0; i < 4; i++) {
    const e = ext[i + 1];
    cap(xs[i] * s, -ph / 2 + fw * 0.4, s * (0.16 + (lens[i] - 0.16) * e), fw, spread[i] * e);
  }
  const te = ext[0];
  cap(-pw / 2 + s * 0.06, s * 0.08, s * (0.2 + 0.28 * te), fw * 1.05, -0.5 - 0.5 * te);
  ctx.restore();
}

/** A round friendly face. o = { open (eyes 0..1, or [l, r]), mouth 0..1, smile 0..1, brows 0..1 } */
export function drawFace(ctx, s, o = {}) {
  const { open = 1, mouth = 0, smile = 0.4, brows = 0, fill = '#fff1fb', ink = '#3a2160' } = o;
  const [oL, oR] = Array.isArray(open) ? open : [open, open];
  ctx.save();
  ctx.shadowColor = '#ffc6f5'; ctx.shadowBlur = s * 0.4;
  ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,130,180,0.45)';
  ctx.beginPath(); ctx.ellipse(-s * 0.55, s * 0.2, s * 0.16, s * 0.1, 0, 0, TAU); ctx.ellipse(s * 0.55, s * 0.2, s * 0.16, s * 0.1, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineCap = 'round'; ctx.lineWidth = s * 0.09;
  [[-1, oL], [1, oR]].forEach(([side, op]) => {
    const x = side * s * 0.36, y = -s * 0.12;
    if (op > 0.25) { ctx.beginPath(); ctx.ellipse(x, y, s * 0.11, s * 0.15 * op, 0, 0, TAU); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(x - s * 0.13, y); ctx.lineTo(x + s * 0.13, y); ctx.stroke(); }
    const by = y - s * (0.3 + brows * 0.18);
    ctx.beginPath(); ctx.arc(x, by + s * 0.12, s * 0.16, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
  });
  if (mouth > 0.15) {
    ctx.fillStyle = '#7a2a5a';
    ctx.beginPath(); ctx.ellipse(0, s * 0.42, s * 0.2, s * 0.08 + s * 0.2 * mouth, 0, 0, TAU); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(0, s * 0.18, s * (0.22 + smile * 0.12), Math.PI * (0.25 - smile * 0.1), Math.PI * (0.75 + smile * 0.1)); ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ menu icons
export const icon = {
  home(ctx, s) {
    ctx.save();
    ctx.fillStyle = '#ffe9a8'; ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.08; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(0, -s * 0.8); ctx.lineTo(s * 0.85, -s * 0.05); ctx.lineTo(s * 0.62, -s * 0.05); ctx.lineTo(s * 0.62, s * 0.7);
    ctx.lineTo(-s * 0.62, s * 0.7); ctx.lineTo(-s * 0.62, -s * 0.05); ctx.lineTo(-s * 0.85, -s * 0.05); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff8fb8'; ctx.beginPath(); ctx.moveTo(-s * 0.18, s * 0.7); ctx.lineTo(-s * 0.18, s * 0.22); ctx.arc(0, s * 0.22, s * 0.18, Math.PI, 0); ctx.lineTo(s * 0.18, s * 0.7); ctx.fill();
    ctx.restore();
  },

  /** Rainbow brush: Sky Painter. */
  paint(ctx, s, t) {
    ctx.save();
    const cols = ['#ff6b8b', '#ffa94d', '#ffe066', '#7cf29c', '#6fc8ff', '#b48cff'];
    ctx.lineCap = 'round'; ctx.lineWidth = s * 0.12;
    cols.forEach((c, i) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(0, s * 0.45, s * (0.95 - i * 0.13), Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); });
    ctx.rotate(0.6 + Math.sin(t * 2) * 0.15);
    ctx.fillStyle = '#c98a5a'; ctx.fillRect(-s * 0.07, -s * 0.2, s * 0.14, s * 0.8);
    ctx.fillStyle = '#e0e0f0'; ctx.fillRect(-s * 0.09, -s * 0.32, s * 0.18, s * 0.14);
    ctx.fillStyle = hsl(t * 90, 100, 65);
    ctx.beginPath(); ctx.moveTo(-s * 0.09, -s * 0.32); ctx.quadraticCurveTo(0, -s * 0.75, s * 0.09, -s * 0.32); ctx.fill();
    ctx.restore();
  },

  firefly(ctx, s, t) { drawFirefly(ctx, s * 0.62, { t, flap: (Math.sin(t * 3) + 1) * 0.3 }); },
  frog(ctx, s, t) { drawFrog(ctx, s * 0.7, { t }); },
  dragon(ctx, s, t) { drawDragon(ctx, s * 0.6, { t }); },

  plane(ctx, s, t) {
    ctx.save(); ctx.translate(Math.sin(t * 1.5) * s * 0.1, Math.cos(t * 2) * s * 0.06); ctx.rotate(0.5 + Math.sin(t * 1.5) * 0.15);
    drawPlane(ctx, s * 0.72, t); ctx.restore();
  },
  boat(ctx, s, t) { ctx.save(); ctx.rotate(Math.sin(t * 2) * 0.1); drawBoat(ctx, s * 0.7, t); ctx.restore(); },

  bubbles(ctx, s, t) {
    ctx.save();
    for (const [x, y, r, p] of [[-0.35, 0.25, 0.4, 0], [0.35, 0.05, 0.32, 1.3], [0, -0.45, 0.26, 2.6]]) {
      const yy = (y - ((t * 0.25 + p) % 1) * 0.15) * s;
      const g = ctx.createRadialGradient(x * s - r * s * 0.3, yy - r * s * 0.3, 0, x * s, yy, r * s);
      g.addColorStop(0, 'rgba(255,255,255,0.7)'); g.addColorStop(0.7, hsl(190 + p * 50, 90, 75, 0.25)); g.addColorStop(1, hsl(280 + p * 30, 90, 75, 0.8));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x * s, yy, r * s, 0, TAU); ctx.fill();
    }
    // music note
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.07;
    ctx.beginPath(); ctx.ellipse(s * 0.3, s * 0.55, s * 0.12, s * 0.09, -0.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s * 0.4, s * 0.53); ctx.lineTo(s * 0.4, s * 0.1); ctx.quadraticCurveTo(s * 0.55, s * 0.18, s * 0.6, s * 0.3); ctx.stroke();
    ctx.restore();
  },

  star(ctx, s, t) { drawStar(ctx, s * 0.75, t); },
  heart(ctx, s, t) { drawHeart(ctx, s * 0.72, t); },
  planet(ctx, s, t) { drawPlanet(ctx, s * 0.62, t); },

  whirl(ctx, s, t) {
    ctx.save(); ctx.rotate(-t * 4);
    ctx.lineCap = 'round';
    for (let arm = 0; arm < 3; arm++) {
      ctx.strokeStyle = ['#a8f0ff', '#ffd1f5', '#fff3a8'][arm]; ctx.lineWidth = s * 0.1;
      ctx.beginPath();
      for (let k = 0; k <= 20; k++) {
        const u = k / 20, a = arm * (TAU / 3) + u * 4, r = s * 0.85 * u;
        k ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(0, 0);
      }
      ctx.stroke();
    }
    ctx.restore();
  },

  openHand(ctx, s, t) { ctx.save(); ctx.rotate(Math.sin(t * 4) * 0.15); drawHand(ctx, s * 0.8, [1, 1, 1, 1, 1]); ctx.restore(); },
  pointHand(ctx, s) { drawHand(ctx, s * 0.8, [0.3, 1, 0, 0, 0]); },

  ribbon(ctx, s, t) {
    ctx.save(); ctx.lineCap = 'round';
    for (let k = 0; k < 12; k++) {
      ctx.strokeStyle = hsl(k * 30 + t * 60, 100, 65); ctx.lineWidth = s * 0.22;
      const x0 = -s * 0.8 + k * s * 0.135, x1 = x0 + s * 0.15;
      ctx.beginPath(); ctx.moveTo(x0, Math.sin(k * 0.7 + t * 3) * s * 0.35); ctx.lineTo(x1, Math.sin((k + 1) * 0.7 + t * 3) * s * 0.35); ctx.stroke();
    }
    ctx.restore();
  },

  glitter(ctx, s, t) {
    ctx.save();
    for (const [x, y, r, h] of [[-0.35, -0.3, 0.45, 50], [0.35, 0.05, 0.55, 300], [-0.15, 0.4, 0.35, 190], [0.4, -0.5, 0.25, 120]]) {
      const tw = 0.7 + 0.3 * Math.sin(t * 5 + x * 9);
      const rr = r * s * tw;
      ctx.drawImage(sparkSprite(hsl(h, 100, 70)), x * s - rr, y * s - rr, rr * 2, rr * 2);
    }
    ctx.restore();
  },

  slime(ctx, s, t) {
    ctx.save();
    const wob = Math.sin(t * 5) * s * 0.06;
    ctx.fillStyle = '#7dff6a'; ctx.shadowColor = '#7dff6a'; ctx.shadowBlur = s * 0.4;
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, -s * 0.1);
    ctx.bezierCurveTo(-s * 0.7, -s * 0.75 - wob, s * 0.7, -s * 0.75 + wob, s * 0.7, -s * 0.1);
    ctx.lineTo(s * 0.7, s * 0.1); ctx.quadraticCurveTo(s * 0.55, s * 0.6 + wob, s * 0.4, s * 0.15);
    ctx.quadraticCurveTo(s * 0.1, s * 0.75 - wob, -s * 0.15, s * 0.15);
    ctx.quadraticCurveTo(-s * 0.45, s * 0.45, -s * 0.7, s * 0.1); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.ellipse(-s * 0.3, -s * 0.35, s * 0.16, s * 0.08, -0.4, 0, TAU); ctx.fill();
    ctx.restore();
  },

  butterfly(ctx, s, t) { drawButterfly(ctx, s * 0.85, t, 300); },

  /** Neon tube brush: a glowing zig-zag. */
  neon(ctx, s, t) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const path = () => { ctx.beginPath(); ctx.moveTo(-s * 0.7, s * 0.3); ctx.lineTo(-s * 0.25, -s * 0.35); ctx.lineTo(s * 0.15, s * 0.3); ctx.lineTo(s * 0.65, -s * 0.35); };
    ctx.globalCompositeOperation = 'lighter';
    path(); ctx.strokeStyle = hsl(190 + Math.sin(t * 2) * 40, 100, 60, 0.45); ctx.lineWidth = s * 0.4; ctx.stroke();
    path(); ctx.strokeStyle = hsl(190 + Math.sin(t * 2) * 40, 100, 70); ctx.lineWidth = s * 0.16; ctx.stroke();
    path(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = s * 0.05; ctx.stroke();
    ctx.restore();
  },

  /** Bubble brush: a trail of soap bubbles. */
  bubbleBrush(ctx, s, t) {
    ctx.save();
    for (const [x, y, r] of [[-0.45, 0.3, 0.28], [0, -0.05, 0.36], [0.45, -0.38, 0.22]]) {
      const rr = r * s * (1 + Math.sin(t * 3 + x * 5) * 0.06);
      ctx.strokeStyle = hsl(200 + x * 200 + t * 40, 100, 80, 0.95); ctx.lineWidth = s * 0.06;
      ctx.beginPath(); ctx.arc(x * s, y * s, rr, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(x * s - rr * 0.35, y * s - rr * 0.35, rr * 0.18, 0, TAU); ctx.fill();
    }
    ctx.restore();
  },

  /** Mirror magic: a kaleidoscope flower; `n` petals = symmetry ways. */
  mirror(n) {
    return (ctx, s, t) => {
      ctx.save(); ctx.rotate(t * 0.4);
      const k = Math.max(1, n);
      for (let i = 0; i < Math.max(2, k); i++) {
        ctx.save(); ctx.rotate((i / Math.max(2, k)) * TAU);
        ctx.fillStyle = hsl(i * (360 / Math.max(2, k)) + t * 40, 100, 70, k === 1 ? 0.35 : 0.95);
        ctx.beginPath(); ctx.ellipse(0, -s * 0.38, s * 0.16, s * 0.36, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, s * 0.14, 0, TAU); ctx.fill();
      ctx.restore();
    };
  },

  /** Trace a picture: a dotted heart with a pointing finger. */
  trace(ctx, s, t) {
    ctx.save();
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU, x = 16 * Math.pow(Math.sin(a), 3), y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
      const lit = (i / 22) < ((t * 0.4) % 1);
      ctx.fillStyle = lit ? '#ffe27a' : 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.arc(x * s * 0.036, y * s * 0.036 - s * 0.05, lit ? s * 0.07 : s * 0.05, 0, TAU); ctx.fill();
    }
    ctx.restore();
  },

  /** Undo: a curly back arrow. */
  undo(ctx, s) {
    ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.fillStyle = '#ffffff'; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(s * 0.05, s * 0.05, s * 0.42, Math.PI * 1.05, Math.PI * 2.35); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.62, -s * 0.3); ctx.lineTo(-s * 0.32, s * 0.12); ctx.lineTo(-s * 0.05, -s * 0.28); ctx.closePath(); ctx.fill();
    ctx.restore();
  },

  /** Save: a little camera with a sparkle. */
  save(ctx, s, t) {
    ctx.save(); ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-s * 0.6, -s * 0.35, s * 1.2, s * 0.8, s * 0.18) : ctx.rect(-s * 0.6, -s * 0.35, s * 1.2, s * 0.8); ctx.fill();
    ctx.fillRect(-s * 0.25, -s * 0.5, s * 0.5, s * 0.2);
    ctx.fillStyle = hsl(200 + t * 50, 90, 60); ctx.beginPath(); ctx.arc(0, s * 0.05, s * 0.24, 0, TAU); ctx.fill();
    ctx.drawImage(sparkSprite('#fff6a0'), s * 0.3, -s * 0.85, s * 0.5, s * 0.5);
    ctx.restore();
  },

  /** Hub art for the new worlds. */
  boopIcon(ctx, s, t) {
    ctx.save(); ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.ellipse(0, s * 0.45, s * 0.6, s * 0.18, 0, 0, TAU); ctx.fill();
    const up = (Math.sin(t * 2.5) + 1) / 2;
    ctx.translate(0, s * 0.35 - up * s * 0.45);
    ctx.fillStyle = '#fff0f7';
    ctx.beginPath(); ctx.ellipse(-s * 0.16, -s * 0.42, s * 0.09, s * 0.26, -0.2, 0, TAU); ctx.ellipse(s * 0.16, -s * 0.42, s * 0.09, s * 0.26, 0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a2160'; ctx.beginPath(); ctx.arc(-s * 0.1, -s * 0.03, s * 0.04, 0, TAU); ctx.arc(s * 0.1, -s * 0.03, s * 0.04, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff8fb8'; ctx.beginPath(); ctx.arc(0, s * 0.06, s * 0.035, 0, TAU); ctx.fill();
    ctx.restore();
  },
  basketIcon(ctx, s, t) {
    ctx.save();
    const fy = ((t * 0.8) % 1) * s * 0.7 - s * 0.6;
    ctx.fillStyle = '#ff4d6a'; ctx.beginPath(); ctx.arc(Math.sin(t) * s * 0.15, fy, s * 0.17, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5be37a'; ctx.beginPath(); ctx.ellipse(Math.sin(t) * s * 0.15 + s * 0.06, fy - s * 0.18, s * 0.09, s * 0.04, -0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d9925a'; ctx.beginPath(); ctx.moveTo(-s * 0.55, s * 0.12); ctx.lineTo(s * 0.55, s * 0.12); ctx.lineTo(s * 0.42, s * 0.6); ctx.lineTo(-s * 0.42, s * 0.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd6a0'; ctx.beginPath(); ctx.ellipse(0, s * 0.12, s * 0.55, s * 0.1, 0, 0, TAU); ctx.fill();
    ctx.restore();
  },
  monsterIcon(ctx, s, t) {
    ctx.save(); ctx.scale(1, 1 + Math.sin(t * 4) * 0.04);
    ctx.fillStyle = hsl(265, 80, 62); ctx.beginPath(); ctx.arc(0, s * 0.05, s * 0.55, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff3c4';
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * s * 0.25, -s * 0.4); ctx.lineTo(side * s * 0.42, -s * 0.72); ctx.lineTo(side * s * 0.12, -s * 0.48); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-s * 0.19, -s * 0.1, s * 0.13, 0, TAU); ctx.arc(s * 0.19, -s * 0.1, s * 0.13, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a1050'; ctx.beginPath(); ctx.arc(-s * 0.19, -s * 0.08, s * 0.06, 0, TAU); ctx.arc(s * 0.19, -s * 0.08, s * 0.06, 0, TAU); ctx.fill();
    const o = (Math.sin(t * 5) + 1) / 2;
    ctx.fillStyle = '#3a0a2a'; ctx.beginPath(); ctx.ellipse(0, s * 0.25, s * 0.22, s * (0.04 + o * 0.12), 0, 0, TAU); ctx.fill();
    ctx.restore();
  },

  mouth(ctx, s, t) { drawFace(ctx, s * 0.78, { mouth: 0.6 + Math.sin(t * 4) * 0.3 }); },
  smile(ctx, s) { drawFace(ctx, s * 0.78, { smile: 1, open: 0.2 }); },
  brows(ctx, s, t) {
    drawFace(ctx, s * 0.78, { brows: 0.5 + Math.sin(t * 4) * 0.5, open: 1.1 });
    ctx.save(); ctx.translate(0, -s * 0.6); drawCrown(ctx, s * 0.7, t); ctx.restore();
  },

  /** Rainbow "speed" arrow: boost. */
  boost(ctx, s, t) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ['#ff6b8b', '#ffd84a', '#6fe3ff'].forEach((c, i) => {
      ctx.strokeStyle = c; ctx.lineWidth = s * 0.16;
      const y = (i - 1) * s * 0.35, sh = ((t * 2 + i * 0.3) % 1) * s * 0.2;
      ctx.beginPath(); ctx.moveTo(-s * 0.7 + sh, y); ctx.lineTo(s * 0.2 + sh, y); ctx.stroke();
    });
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(s * 0.25, -s * 0.6); ctx.lineTo(s * 0.85, 0); ctx.lineTo(s * 0.25, s * 0.6); ctx.closePath(); ctx.fill();
    ctx.restore();
  },
  spin(ctx, s, t) { icon.whirl(ctx, s, t * 0.6); ctx.save(); ctx.rotate(t * 3); drawStar(ctx, s * 0.3, t); ctx.restore(); },

  crown(ctx, s, t) { ctx.save(); ctx.translate(0, s * 0.35); drawCrown(ctx, s * 1.5, t); ctx.restore(); },
  wizard(ctx, s, t) { ctx.save(); ctx.translate(0, s * 0.55); drawWizard(ctx, s * 1.05, t); ctx.restore(); },
  bunny(ctx, s, t) { ctx.save(); ctx.translate(0, s * 0.55); drawBunny(ctx, s * 1.3, t); ctx.restore(); },
  cat(ctx, s, t) { ctx.save(); ctx.translate(0, s * 0.3); drawCat(ctx, s * 1.6, t); ctx.restore(); },

  /** Plain colour dot (palette bubbles). hue = 'rainbow' or a number. */
  color(hue) {
    return (ctx, s, t) => {
      ctx.save();
      if (hue === 'rainbow') {
        for (let i = 0; i < 12; i++) {
          ctx.fillStyle = hsl(i * 30 + t * 40, 100, 62);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, s * 0.62, (i / 12) * TAU, ((i + 1) / 12) * TAU + 0.02); ctx.fill();
        }
      } else {
        const g = ctx.createRadialGradient(-s * 0.2, -s * 0.25, s * 0.05, 0, 0, s * 0.62);
        g.addColorStop(0, hsl(hue, 100, 85)); g.addColorStop(1, hsl(hue, 95, 55));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 0.62, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath(); ctx.ellipse(-s * 0.22, -s * 0.28, s * 0.16, s * 0.09, -0.5, 0, TAU); ctx.fill();
      ctx.restore();
    };
  },
};

/** A fluttering glowing butterfly. */
export function drawButterfly(ctx, s, t, hue = 300) {
  const f = Math.abs(Math.sin(t * 9));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(glowSprite(hsl(hue, 100, 65)), -s * 1.2, -s * 1.2, s * 2.4, s * 2.4);
  ctx.globalCompositeOperation = 'source-over';
  for (const side of [-1, 1]) {
    ctx.save(); ctx.scale(side * (0.25 + 0.75 * f), 1);
    ctx.fillStyle = hsl(hue, 100, 72, 0.92);
    ctx.beginPath(); ctx.ellipse(s * 0.38, -s * 0.22, s * 0.38, s * 0.3, -0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = hsl(hue + 40, 100, 75, 0.92);
    ctx.beginPath(); ctx.ellipse(s * 0.3, s * 0.25, s * 0.26, s * 0.22, 0.5, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#2a1650';
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.07, s * 0.36, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
