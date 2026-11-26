// ---------------------------------------------------------------------------
// Friendly characters, drawn procedurally so they can flap, hop, blink and
// giggle. Each draws centred on (0,0) at size `s` (≈ body radius).
//   st = { flap 0..1 (just flapped), eyes 0..1 (1 = open), giggle 0..1, t }
// Shared by Firefly Hop and the icons inside menu bubbles.
// ---------------------------------------------------------------------------
import { TAU } from '../core/util.js';
import { glowSprite } from '../fx/sprites.js';

function eyes(ctx, s, open, dx, dy, r, look = 0) {
  for (const side of [-1, 1]) {
    const x = side * dx, y = dy;
    if (open > 0.35) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(x, y, r, r * open, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1c1036';
      ctx.beginPath(); ctx.arc(x + look * r * 0.3, y + r * 0.1, r * 0.55, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x + look * r * 0.3 - r * 0.2, y - r * 0.15, r * 0.2, 0, TAU); ctx.fill();
    } else {
      // happy closed eye: ^
      ctx.strokeStyle = '#1c1036'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, y + r * 0.3, r * 0.7, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    }
  }
}

function cheeks(ctx, dx, dy, r) {
  ctx.fillStyle = 'rgba(255,120,170,0.55)';
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(side * dx, dy, r, r * 0.6, 0, 0, TAU); ctx.fill(); }
}

function smile(ctx, s, y, w, giggle) {
  ctx.strokeStyle = '#1c1036'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
  ctx.beginPath();
  if (giggle > 0.2) {
    ctx.fillStyle = '#ff6f91';
    ctx.ellipse(0, y, w * 0.8, w * 0.65, 0, 0, Math.PI); ctx.fill(); ctx.stroke();
  } else ctx.arc(0, y - w * 0.5, w, Math.PI * 0.2, Math.PI * 0.8), ctx.stroke();
}

export function drawFirefly(ctx, s, st = {}) {
  const { flap = 0, eyes: open = 1, giggle = 0, t = 0 } = st;
  const wing = Math.sin(t * (14 + flap * 30)) * (0.3 + flap * 0.6);
  ctx.save();
  // glowing tail
  ctx.globalCompositeOperation = 'lighter';
  const g = s * (2.4 + Math.sin(t * 4) * 0.3);
  ctx.drawImage(glowSprite('#e8ff6a'), -s * 0.9 - g, s * 0.25 - g, g * 2, g * 2);
  ctx.globalCompositeOperation = 'source-over';
  // wings
  ctx.fillStyle = 'rgba(200,240,255,0.55)'; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = s * 0.04;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(-s * 0.1, -s * 0.55);
    ctx.rotate(side * 0.5 - 0.3 + wing * side);
    ctx.beginPath(); ctx.ellipse(0, -s * 0.45, s * 0.32, s * 0.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // abdomen
  const ab = ctx.createRadialGradient(-s * 0.8, s * 0.25, s * 0.05, -s * 0.8, s * 0.25, s * 0.6);
  ab.addColorStop(0, '#ffffd0'); ab.addColorStop(0.5, '#eaff5a'); ab.addColorStop(1, '#9bd12a');
  ctx.fillStyle = ab; ctx.beginPath(); ctx.ellipse(-s * 0.75, s * 0.22, s * 0.55, s * 0.45, -0.3, 0, TAU); ctx.fill();
  // body + head
  ctx.fillStyle = '#4a3a9a'; ctx.beginPath(); ctx.ellipse(-s * 0.15, s * 0.1, s * 0.5, s * 0.42, 0, 0, TAU); ctx.fill();
  const head = ctx.createRadialGradient(s * 0.3, -s * 0.25, s * 0.1, s * 0.4, -s * 0.05, s * 0.75);
  head.addColorStop(0, '#9e8cff'); head.addColorStop(1, '#5a46c0');
  ctx.fillStyle = head; ctx.beginPath(); ctx.arc(s * 0.4, -s * 0.05, s * 0.66, 0, TAU); ctx.fill();
  // antennae with glowing tips
  ctx.strokeStyle = '#5a46c0'; ctx.lineWidth = s * 0.07;
  for (const side of [-1, 1]) {
    const ex = s * 0.4 + side * s * 0.35 + Math.sin(t * 3 + side) * s * 0.05, ey = -s * 1.05;
    ctx.beginPath(); ctx.moveTo(s * 0.4 + side * s * 0.15, -s * 0.6); ctx.quadraticCurveTo(s * 0.4 + side * s * 0.3, -s * 0.9, ex, ey); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(glowSprite('#fff27a'), ex - s * 0.25, ey - s * 0.25, s * 0.5, s * 0.5);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.translate(s * 0.45, -s * 0.05);
  eyes(ctx, s, open, s * 0.24, -s * 0.08, s * 0.17, 0.6);
  cheeks(ctx, s * 0.42, s * 0.17, s * 0.1);
  smile(ctx, s, s * 0.22, s * 0.16, giggle);
  ctx.restore();
}

export function drawFrog(ctx, s, st = {}) {
  const { flap = 0, eyes: open = 1, giggle = 0, t = 0 } = st;
  ctx.save();
  // legs kick out when hopping
  ctx.fillStyle = '#3fbf5f';
  const kick = flap * s * 0.5;
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(side * s * 0.55, s * 0.55 + kick * 0.6, s * 0.3, s * 0.16 + kick * 0.15, side * 0.4, 0, TAU); ctx.fill();
  }
  const body = ctx.createRadialGradient(-s * 0.2, -s * 0.2, s * 0.1, 0, 0, s);
  body.addColorStop(0, '#9dff8a'); body.addColorStop(1, '#2fa65a');
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, s * 0.1, s * 0.85, s * 0.68, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(240,255,200,0.7)'; ctx.beginPath(); ctx.ellipse(0, s * 0.38, s * 0.5, s * 0.3, 0, 0, TAU); ctx.fill();
  // eye bumps
  ctx.fillStyle = '#5ad97a';
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(side * s * 0.38, -s * 0.48, s * 0.3, 0, TAU); ctx.fill(); }
  eyes(ctx, s, open, s * 0.38, -s * 0.5, s * 0.2);
  // glowing spots
  ctx.globalCompositeOperation = 'lighter';
  for (const [x, y] of [[-0.5, 0.05], [0.55, 0.1], [0.1, -0.15]]) {
    const r = s * (0.2 + Math.sin(t * 3 + x * 5) * 0.04);
    ctx.drawImage(glowSprite('#7affd8'), x * s - r, y * s - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  cheeks(ctx, s * 0.55, s * 0.12, s * 0.11);
  smile(ctx, s, s * 0.18, s * 0.3, giggle);
  ctx.restore();
}

export function drawDragon(ctx, s, st = {}) {
  const { flap = 0, eyes: open = 1, giggle = 0, t = 0 } = st;
  const wing = Math.sin(t * (8 + flap * 26)) * (0.25 + flap * 0.6);
  ctx.save();
  // tail with glowing tip
  ctx.strokeStyle = '#efe6ff'; ctx.lineWidth = s * 0.22; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-s * 0.6, s * 0.2);
  ctx.quadraticCurveTo(-s * 1.3, s * 0.5 + Math.sin(t * 3) * s * 0.15, -s * 1.35, -s * 0.05); ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(glowSprite('#ff9be8'), -s * 1.35 - s * 0.4, -s * 0.05 - s * 0.4, s * 0.8, s * 0.8);
  ctx.globalCompositeOperation = 'source-over';
  // little wings
  ctx.fillStyle = 'rgba(214,180,255,0.85)';
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(-s * 0.15, -s * 0.45); ctx.rotate(-0.4 + side * 0.25 + wing * side);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-s * 0.2, -s * 0.8, -s * 0.7, -s * 0.6); ctx.quadraticCurveTo(-s * 0.4, -s * 0.3, 0, 0); ctx.fill();
    ctx.restore();
  }
  // fluffy cloud body
  ctx.fillStyle = '#fbf7ff';
  for (const [x, y, r] of [[-0.45, 0.15, 0.42], [0, 0.25, 0.48], [0.1, -0.1, 0.55], [-0.3, -0.15, 0.4], [0.5, 0.15, 0.36]]) {
    ctx.beginPath(); ctx.arc(x * s, y * s, r * s, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = 'rgba(200,180,255,0.35)';
  ctx.beginPath(); ctx.ellipse(0, s * 0.5, s * 0.7, s * 0.14, 0, 0, TAU); ctx.fill();
  // horns
  ctx.fillStyle = '#b78cff';
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(s * 0.2 + side * s * 0.2, -s * 0.55); ctx.lineTo(s * 0.25 + side * s * 0.32, -s * 0.95); ctx.lineTo(s * 0.3 + side * s * 0.08, -s * 0.6); ctx.fill();
  }
  ctx.translate(s * 0.22, -s * 0.05);
  eyes(ctx, s, open, s * 0.22, -s * 0.08, s * 0.15, 0.5);
  cheeks(ctx, s * 0.38, s * 0.15, s * 0.1);
  smile(ctx, s, s * 0.2, s * 0.15, giggle);
  ctx.restore();
}

export const CHARACTERS = { firefly: drawFirefly, frog: drawFrog, dragon: drawDragon };
