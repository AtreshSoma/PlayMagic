// ---------------------------------------------------------------------------
// Drawable props shared across modes: stamps (star, heart, planet),
// vehicles (paper plane, magic boat) and head accessories (crown, wizard
// hat, bunny ears, cat ears). All draw centred at (0,0).
// ---------------------------------------------------------------------------
import { TAU, hsl } from '../core/util.js';
import { glowSprite } from '../fx/sprites.js';

function face(ctx, s, y = 0, color = '#5a2a1a') {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(-s * 0.2, y - s * 0.05, s * 0.08, 0, TAU); ctx.arc(s * 0.2, y - s * 0.05, s * 0.08, 0, TAU); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, y + s * 0.02, s * 0.14, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  ctx.fillStyle = 'rgba(255,110,150,0.5)';
  ctx.beginPath(); ctx.arc(-s * 0.36, y + s * 0.08, s * 0.08, 0, TAU); ctx.arc(s * 0.36, y + s * 0.08, s * 0.08, 0, TAU); ctx.fill();
}

export function starPath(ctx, s, points = 5, inner = 0.48) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * TAU - Math.PI / 2, r = i % 2 ? s * inner : s;
    i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

export function drawStar(ctx, s, t = 0, hue = 48) {
  ctx.save();
  ctx.rotate(Math.sin(t * 2) * 0.12);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(glowSprite(hsl(hue, 100, 65)), -s * 1.8, -s * 1.8, s * 3.6, s * 3.6);
  ctx.globalCompositeOperation = 'source-over';
  starPath(ctx, s, 5, 0.5);
  const g = ctx.createRadialGradient(-s * 0.2, -s * 0.3, s * 0.1, 0, 0, s);
  g.addColorStop(0, hsl(hue, 100, 88)); g.addColorStop(1, hsl(hue - 8, 100, 58));
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = s * 0.06; ctx.lineJoin = 'round'; ctx.stroke();
  face(ctx, s * 0.9, s * 0.05);
  ctx.restore();
}

export function drawHeart(ctx, s, t = 0, hue = 338) {
  const beat = 1 + Math.max(0, Math.sin(t * 6)) * 0.12;
  ctx.save();
  ctx.scale(beat, beat);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(glowSprite(hsl(hue, 100, 65)), -s * 1.8, -s * 1.8, s * 3.6, s * 3.6);
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath();
  ctx.moveTo(0, s * 0.85);
  ctx.bezierCurveTo(-s * 1.2, s * 0.05, -s * 0.75, -s * 0.95, 0, -s * 0.4);
  ctx.bezierCurveTo(s * 0.75, -s * 0.95, s * 1.2, s * 0.05, 0, s * 0.85);
  const g = ctx.createRadialGradient(-s * 0.3, -s * 0.4, s * 0.1, 0, 0, s);
  g.addColorStop(0, hsl(hue, 100, 85)); g.addColorStop(1, hsl(hue, 90, 58));
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = s * 0.06; ctx.stroke();
  face(ctx, s * 0.8, s * 0.05);
  ctx.restore();
}

export function drawPlanet(ctx, s, t = 0, hue = 265) {
  ctx.save();
  ctx.rotate(-0.35);
  const ring = (front) => {
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.35, s * 0.38, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
    ctx.strokeStyle = hsl(hue + 140, 100, 75, 0.95); ctx.lineWidth = s * 0.14; ctx.stroke();
  };
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(glowSprite(hsl(hue, 100, 65)), -s * 1.8, -s * 1.8, s * 3.6, s * 3.6);
  ctx.globalCompositeOperation = 'source-over';
  ring(false);
  const g = ctx.createRadialGradient(-s * 0.3, -s * 0.35, s * 0.1, 0, 0, s * 0.8);
  g.addColorStop(0, hsl(hue, 100, 82)); g.addColorStop(1, hsl(hue, 80, 50));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 0.78, 0, TAU); ctx.fill();
  ctx.rotate(0.35);
  face(ctx, s * 0.75, 0, '#2a1450');
  ctx.rotate(-0.35);
  ring(true);
  // orbiting moon
  const a = t * 2;
  ctx.fillStyle = '#fff6d0';
  ctx.beginPath(); ctx.arc(Math.cos(a) * s * 1.35, Math.sin(a) * s * 0.38, s * 0.12, 0, TAU); ctx.fill();
  ctx.restore();
}

export const STAMPS = { star: drawStar, heart: drawHeart, planet: drawPlanet };

// ------------------------------------------------------------------ vehicles
export function drawPlane(ctx, s, t = 0) {
  ctx.save();
  ctx.lineJoin = 'round';
  // top wing (light) and fold (shade)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(0, -s * 0.95); ctx.lineTo(-s * 1.1, s * 0.55); ctx.lineTo(0, s * 0.25); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e6e0ff';
  ctx.beginPath(); ctx.moveTo(0, -s * 0.95); ctx.lineTo(s * 1.1, s * 0.55); ctx.lineTo(0, s * 0.25); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b9aef0';
  ctx.beginPath(); ctx.moveTo(0, -s * 0.95); ctx.lineTo(-s * 0.16, s * 0.6); ctx.lineTo(0, s * 0.25); ctx.lineTo(s * 0.16, s * 0.6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(120,100,200,0.6)'; ctx.lineWidth = s * 0.04;
  ctx.beginPath(); ctx.moveTo(0, -s * 0.95); ctx.lineTo(0, s * 0.25); ctx.stroke();
  // a tiny star sticker
  ctx.translate(-s * 0.45, s * 0.2);
  starPath(ctx, s * 0.14); ctx.fillStyle = '#ffd84a'; ctx.fill();
  ctx.restore();
}

export function drawBoat(ctx, s, t = 0) {
  ctx.save();
  // sail
  ctx.fillStyle = '#fff5e0';
  ctx.beginPath(); ctx.moveTo(-s * 0.05, -s * 1.05); ctx.quadraticCurveTo(s * 0.75, -s * 0.5 + Math.sin(t * 3) * s * 0.06, s * 0.05, s * 0.1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ff9ec7';
  ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.85); ctx.quadraticCurveTo(-s * 0.7, -s * 0.4, -s * 0.1, s * 0.1); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = s * 0.07;
  ctx.beginPath(); ctx.moveTo(0, -s * 1.1); ctx.lineTo(0, s * 0.2); ctx.stroke();
  // glowing hull
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(glowSprite('#7affd8'), -s * 1.4, -s * 0.2, s * 2.8, s * 1.4);
  ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createLinearGradient(0, s * 0.15, 0, s * 0.6);
  g.addColorStop(0, '#8a5cf0'); g.addColorStop(1, '#4a2aa0');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-s * 0.95, s * 0.15); ctx.lineTo(s * 0.95, s * 0.15); ctx.quadraticCurveTo(s * 0.6, s * 0.65, 0, s * 0.62); ctx.quadraticCurveTo(-s * 0.6, s * 0.65, -s * 0.95, s * 0.15); ctx.fill();
  ctx.fillStyle = '#fff27a';
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.arc(k * s * 0.3, s * 0.34, s * 0.06, 0, TAU); ctx.fill(); }
  ctx.restore();
}

export const VEHICLES = { plane: drawPlane, boat: drawBoat };

// ------------------------------------------------------------------ hats & ears
// Each draws with its base on y = 0, extending upward, `w` = face width.
export function drawCrown(ctx, w, t = 0) {
  const h = w * 0.42, hw = w * 0.42;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(glowSprite('#ffd84a'), -w * 0.7, -h * 1.6, w * 1.4, w * 1.1);
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath();
  ctx.moveTo(-hw, 0); ctx.lineTo(-hw, -h * 0.55); ctx.lineTo(-hw * 0.55, -h * 0.2); ctx.lineTo(-hw * 0.28, -h); ctx.lineTo(0, -h * 0.3);
  ctx.lineTo(hw * 0.28, -h); ctx.lineTo(hw * 0.55, -h * 0.2); ctx.lineTo(hw, -h * 0.55); ctx.lineTo(hw, 0); ctx.closePath();
  const g = ctx.createLinearGradient(0, -h, 0, 0);
  g.addColorStop(0, '#fff2a0'); g.addColorStop(1, '#f2a91a');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = w * 0.02; ctx.lineJoin = 'round'; ctx.stroke();
  const gems = [['#ff4f8b', -hw * 0.55], ['#4fd2ff', 0], ['#8dff6a', hw * 0.55]];
  for (const [c, x] of gems) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, -h * 0.18, w * 0.045, 0, TAU); ctx.fill(); }
  for (const x of [-hw, -hw * 0.28, hw * 0.28, hw]) {
    const y = x === -hw || x === hw ? -h * 0.55 : -h;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, w * 0.035 * (1 + Math.sin(t * 5 + x) * 0.3), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

export function drawWizard(ctx, w, t = 0) {
  const h = w * 1.05;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-w * 0.42, -w * 0.05);
  ctx.quadraticCurveTo(-w * 0.1, -h * 0.5, w * 0.18 + Math.sin(t * 2) * w * 0.05, -h);
  ctx.quadraticCurveTo(w * 0.15, -h * 0.5, w * 0.42, -w * 0.05);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -h, 0, 0);
  g.addColorStop(0, '#8f6bff'); g.addColorStop(1, '#4a2aa8');
  ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = '#3a1f88';
  ctx.beginPath(); ctx.ellipse(0, -w * 0.02, w * 0.62, w * 0.12, 0, 0, TAU); ctx.fill();
  for (const [x, y, r] of [[-0.12, -0.35, 0.07], [0.12, -0.6, 0.05], [0.02, -0.18, 0.04]]) {
    ctx.save(); ctx.translate(x * w, y * h); ctx.rotate(t);
    starPath(ctx, r * w); ctx.fillStyle = '#ffe27a'; ctx.fill(); ctx.restore();
  }
  ctx.globalCompositeOperation = 'lighter';
  const tx = w * 0.18 + Math.sin(t * 2) * w * 0.05;
  ctx.drawImage(glowSprite('#ffe27a'), tx - w * 0.15, -h - w * 0.15, w * 0.3, w * 0.3);
  ctx.restore();
}

export function drawBunny(ctx, w, t = 0) {
  ctx.save();
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * w * 0.22, -w * 0.02);
    ctx.rotate(side * (0.18 + Math.sin(t * 3 + side) * 0.08));
    ctx.fillStyle = '#fbf3ff';
    ctx.beginPath(); ctx.ellipse(0, -w * 0.42, w * 0.14, w * 0.44, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffb3d1';
    ctx.beginPath(); ctx.ellipse(0, -w * 0.42, w * 0.07, w * 0.34, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

export function drawCat(ctx, w, t = 0) {
  ctx.save();
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * w * 0.3, 0);
    ctx.rotate(side * (0.2 + Math.max(0, Math.sin(t * 4 + side * 2)) * 0.12));
    ctx.fillStyle = '#ffb35a';
    ctx.beginPath(); ctx.moveTo(-w * 0.15, 0); ctx.lineTo(0, -w * 0.36); ctx.lineTo(w * 0.15, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd6e6';
    ctx.beginPath(); ctx.moveTo(-w * 0.08, -w * 0.02); ctx.lineTo(0, -w * 0.24); ctx.lineTo(w * 0.08, -w * 0.02); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

export const HATS = [drawCrown, drawWizard, drawBunny, drawCat];
