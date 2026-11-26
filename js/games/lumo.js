// ---------------------------------------------------------------------------
// Lumo: the portal's original mascot, a round star sprite with a ribbon
// scarf. Shared by Starlight Run, Sky Kingdom and Nebula Rally.
//   drawLumo(ctx, x, y, r, { t, accent, dir, sx, sy, mood, big, glow, scarf })
//     dir     1 faces right, -1 left (eyes look that way, scarf trails behind)
//     sx, sy  squash & stretch scale
//     mood    'happy' | 'hurt' | 'wow'
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { TAU } from '../core/util.js';

export function drawLumo(ctx, x, y, r, { t = app.t, accent = '#7ff3ff', dir = 0, sx = 1, sy = 1, mood = 'happy', glow = true, scarf = true, crown = false } = {}) {
  ctx.save();
  ctx.translate(x, y);
  if (glow) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.8;
    ctx.drawImage(app.particles.spriteCanvas(accent), -r * 3, -r * 3, r * 6, r * 6);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  if (scarf) { // ribbon trailing opposite the direction of travel
    ctx.strokeStyle = '#ff7ad9'; ctx.lineWidth = r * 0.24; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, r * 0.35);
    const back = dir ? -dir : 0;
    for (let i = 1; i <= 6; i++) ctx.lineTo(back * i * r * 0.22 + Math.sin(t * 10 + i) * r * 0.08 * i * 0.4, r * 0.35 + (dir ? Math.sin(t * 12 + i) * r * 0.08 : i * r * 0.3));
    ctx.stroke();
  }
  ctx.scale(sx, sy);
  // five soft star points behind the body
  ctx.fillStyle = '#fff6c4';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2 + Math.sin(t * 2) * 0.05, rr = i % 2 ? r * 0.95 : r * 1.32; i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#cff9ff'); g.addColorStop(1, accent);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  // face
  const look = dir * r * 0.12, blink = Math.sin(t * 3 + 1.3) > 0.97 ? 0.15 : 1;
  ctx.fillStyle = '#1b1840'; ctx.strokeStyle = '#1b1840'; ctx.lineCap = 'round';
  if (mood === 'hurt') {
    ctx.lineWidth = r * 0.1;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.3 + look - r * 0.1, -r * 0.15); ctx.lineTo(s * r * 0.3 + look + r * 0.1, r * 0.05); ctx.moveTo(s * r * 0.3 + look + r * 0.1, -r * 0.15); ctx.lineTo(s * r * 0.3 + look - r * 0.1, r * 0.05); ctx.stroke(); }
  } else {
    ctx.beginPath(); ctx.ellipse(-r * 0.3 + look, -r * 0.05, r * 0.1, r * 0.15 * blink, 0, 0, TAU); ctx.ellipse(r * 0.3 + look, -r * 0.05, r * 0.1, r * 0.15 * blink, 0, 0, TAU); ctx.fill();
  }
  ctx.lineWidth = r * 0.08;
  if (mood === 'wow') { ctx.beginPath(); ctx.ellipse(look, r * 0.3, r * 0.1, r * 0.14, 0, 0, TAU); ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(look, r * 0.15, r * 0.25, 0.2, Math.PI - 0.2); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,120,180,0.45)';
  ctx.beginPath(); ctx.ellipse(-r * 0.55 + look, r * 0.18, r * 0.13, r * 0.08, 0, 0, TAU); ctx.ellipse(r * 0.55 + look, r * 0.18, r * 0.13, r * 0.08, 0, 0, TAU); ctx.fill();
  if (crown) {
    ctx.fillStyle = '#ffd36e';
    ctx.beginPath(); ctx.moveTo(-r * 0.45, -r * 0.85); ctx.lineTo(-r * 0.45, -r * 1.25); ctx.lineTo(-r * 0.2, -r * 1.05); ctx.lineTo(0, -r * 1.35); ctx.lineTo(r * 0.2, -r * 1.05); ctx.lineTo(r * 0.45, -r * 1.25); ctx.lineTo(r * 0.45, -r * 0.85); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
