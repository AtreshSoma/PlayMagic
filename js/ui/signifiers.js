// ---------------------------------------------------------------------------
// Animated gesture signifiers, drawn procedurally on canvas. One renderer for
// every "what to do" picture in the app: 3-second game onboarding, the
// silhouettes in Gesture Gate, hub cards and the keycap hints for keyboard
// players. No text, no image assets.
//
//   drawCue(ctx, kind, x, y, size, t, opts)
//     kind: open · fist · peace · thumbsUp · pinch · point · flick · tiltHand ·
//           swipe · steer · reach ·
//           twoPalms · winkL · winkR · blink · doubleBlink · smile · mouth ·
//           puff · brows · nod · shake · tilt · gaze
//     size: half-height of the glyph in px
//     opts: { color, alpha, anim (true = loop the motion), glow (true) }
//   drawKey(ctx, label, x, y, h)   keyboard keycap
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { TAU, clamp, rgba, easeInOutCubic } from '../core/util.js';

const FINGER_X = [-0.33, -0.11, 0.11, 0.33];
const FINGER_L = [0.6, 0.68, 0.64, 0.5];
const FINGER_A = [-0.16, -0.05, 0.05, 0.16];

/** Seamless 0→1→0 wave with a hold at each end, for looping poses. */
function pingPong(t, period) {
  const p = (t % period) / period;
  return easeInOutCubic(clamp(p < 0.5 ? p * 2.6 - 0.15 : (1 - p) * 2.6 - 0.15));
}

/**
 * Stylised hand silhouette. fingers: extension 0..1 for index→pinky.
 * thumb: { a: angle (rad, 0 = straight up), l: length factor }.
 */
function hand(ctx, s, fingers, thumb, { spread = 1, col, ink, curlIndexTo = null } = {}) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.fillStyle = col; ctx.strokeStyle = col;
  // palm
  const pw = s * 0.92, ph = s * 0.78, py = -s * 0.12;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-pw / 2, py, pw, ph, s * 0.26) : ctx.rect(-pw / 2, py, pw, ph);
  ctx.fill();
  // fingers
  ctx.lineWidth = s * 0.19;
  for (let i = 0; i < 4; i++) {
    const e = fingers[i], bx = FINGER_X[i] * s, by = py + s * 0.08;
    const len = s * (0.1 + FINGER_L[i] * e), a = FINGER_A[i] * spread;
    ctx.beginPath(); ctx.moveTo(bx, by);
    if (i === 0 && curlIndexTo) ctx.quadraticCurveTo(bx + s * 0.05, by - len * 0.9, curlIndexTo.x * s, curlIndexTo.y * s);
    else ctx.lineTo(bx + Math.sin(a) * len, by - Math.cos(a) * len);
    ctx.stroke();
  }
  // thumb (from the lower-left of the palm)
  const tx = -pw * 0.42, ty = py + ph * 0.42;
  ctx.lineWidth = s * 0.2;
  ctx.beginPath(); ctx.moveTo(tx, ty);
  ctx.lineTo(tx + Math.sin(thumb.a) * s * thumb.l, ty - Math.cos(thumb.a) * s * thumb.l);
  ctx.stroke();
  // knuckle creases for folded fingers
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, s * 0.04);
  const folded = fingers.filter((e) => e < 0.35).length;
  if (folded >= 3) for (let k = 0; k < 2; k++) {
    ctx.beginPath(); ctx.moveTo(-pw * 0.32, py + ph * (0.25 + k * 0.2)); ctx.lineTo(pw * 0.36, py + ph * (0.25 + k * 0.2)); ctx.stroke();
  }
}

/** Thumbs up: a sideways fist (finger rolls facing the viewer) with the thumb straight up. */
function thumbHand(ctx, s, k, { col, ink }) {
  ctx.lineCap = 'round'; ctx.fillStyle = col; ctx.strokeStyle = col;
  const w = s * 0.78, h = s * 0.86, x0 = -w * 0.45, y0 = -s * 0.12;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0, y0, w, h, s * 0.24) : ctx.rect(x0, y0, w, h); ctx.fill();
  // four curled finger rolls on the right edge
  for (let i = 0; i < 4; i++) {
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0 + w * 0.55, y0 + h * (0.04 + i * 0.235), w * 0.62, h * 0.2, s * 0.1) : ctx.rect(x0 + w * 0.55, y0 + h * (0.04 + i * 0.235), w * 0.62, h * 0.2); ctx.fill();
  }
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, s * 0.035);
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x0 + w * 0.62, y0 + h * (0.02 + i * 0.235)); ctx.lineTo(x0 + w * 1.12, y0 + h * (0.02 + i * 0.235)); ctx.stroke(); }
  // thumb
  ctx.strokeStyle = col; ctx.lineWidth = s * 0.26;
  const tx = x0 + w * 0.3, len = s * (0.25 + 0.55 * k);
  ctx.beginPath(); ctx.moveTo(tx, y0 + s * 0.1); ctx.lineTo(tx - s * 0.04, y0 - len); ctx.stroke();
}

function face(ctx, s, { eyeL = 1, eyeR = 1, mouth = 'line', amt = 0, brows = 0, puff = 0, col, ink }) {
  const r = s * 0.82;
  ctx.lineCap = 'round';
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  if (puff > 0) { // cheeks bulge
    ctx.beginPath(); ctx.arc(-r * 0.72, r * 0.25, r * 0.32 * puff, 0, TAU); ctx.arc(r * 0.72, r * 0.25, r * 0.32 * puff, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = Math.max(1.5, s * 0.08);
  // eyes: screen-left eye is the player's left (mirror view)
  [[-1, eyeL], [1, eyeR]].forEach(([side, open]) => {
    const ex = side * r * 0.36, ey = -r * 0.16;
    if (open > 0.35) { ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.1, r * 0.13 * open, 0, 0, TAU); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(ex, ey - r * 0.06, r * 0.13, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
    if (brows > 0) {
      ctx.beginPath(); ctx.arc(ex, ey - r * (0.16 + brows * 0.16), r * 0.17, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
    }
  });
  if (mouth === 'smile') { ctx.beginPath(); ctx.arc(0, r * 0.1, r * (0.25 + amt * 0.17), Math.PI * 0.18, Math.PI * 0.82); ctx.stroke(); }
  else if (mouth === 'open') { ctx.beginPath(); ctx.ellipse(0, r * 0.42, r * 0.17, r * (0.06 + amt * 0.2), 0, 0, TAU); ctx.fill(); }
  else if (mouth === 'o') { ctx.beginPath(); ctx.arc(0, r * 0.42, r * 0.08, 0, TAU); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(-r * 0.18, r * 0.42); ctx.lineTo(r * 0.18, r * 0.42); ctx.stroke(); }
}

function spark(ctx, x, y, r, a, col) {
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * TAU, rr = i % 2 ? r * 0.3 : r;
    i ? ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr) : ctx.moveTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function arrow(ctx, x0, y0, x1, y1, s, col) {
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, s * 0.06); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0), h = s * 0.16;
  ctx.beginPath(); ctx.moveTo(x1 - Math.cos(a - 0.5) * h, y1 - Math.sin(a - 0.5) * h); ctx.lineTo(x1, y1); ctx.lineTo(x1 - Math.cos(a + 0.5) * h, y1 - Math.sin(a + 0.5) * h); ctx.stroke();
}

export function drawCue(ctx, kind, x, y, s, t = app.t, { color = '#ffffff', alpha = 1, anim = true, glow = true, accent = app.theme?.accent || '#f5c96a' } = {}) {
  const T = anim ? t : 0.9; // a static pose shows the "completed" frame
  const ink = 'rgba(8, 8, 28, 0.85)';
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  if (glow && app.particles) {
    ctx.globalCompositeOperation = 'lighter';
    const g = s * 2.1;
    ctx.globalAlpha = alpha * 0.35;
    ctx.drawImage(app.particles.spriteCanvas(accent), -g, -g, g * 2, g * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
  }
  const open = [1, 1, 1, 1], col = color;
  switch (kind) {
    case 'open': {
      const k = anim ? pingPong(T, 1.8) : 1;
      hand(ctx, s, open.map(() => 0.35 + 0.65 * k), { a: -0.9, l: 0.42 + 0.1 * k }, { spread: 0.6 + 1.2 * k, col, ink });
      if (k > 0.8) for (let i = 0; i < 3; i++) spark(ctx, (i - 1) * s * 0.6, -s * 1.05 - (i % 2) * s * 0.12, s * 0.12, (k - 0.8) * 5, accent);
      break;
    }
    case 'fist': {
      const k = anim ? pingPong(T, 1.6) : 1;
      hand(ctx, s, open.map(() => 1 - k), { a: -0.9 + k * 1.6, l: 0.45 - k * 0.1 }, { col, ink });
      if (k > 0.85) { // gravity rings pulling inward
        ctx.strokeStyle = accent; ctx.lineWidth = Math.max(1, s * 0.05);
        for (let i = 0; i < 2; i++) { const r = s * (1.5 - ((T * 1.2 + i * 0.5) % 1) * 0.7); ctx.globalAlpha = alpha * 0.6; ctx.beginPath(); ctx.arc(0, s * 0.2, r, 0, TAU); ctx.stroke(); }
        ctx.globalAlpha = alpha;
      }
      break;
    }
    case 'peace': {
      const k = anim ? pingPong(T, 1.7) : 1;
      ctx.save(); ctx.rotate(-0.05);
      hand(ctx, s, [0.15 + 0.85 * k, 0.15 + 0.85 * k, 0.05, 0.05], { a: 0.9, l: 0.32 }, { spread: 1 + 1.6 * k, col, ink });
      ctx.restore();
      if (k > 0.85) spark(ctx, s * 0.55, -s * 0.95, s * 0.16, (k - 0.85) * 6, accent);
      break;
    }
    case 'thumbsUp': {
      const k = anim ? pingPong(T, 1.5) : 1;
      const bob = anim ? Math.sin(T * 7) * s * 0.04 * k : 0;
      ctx.translate(0, bob + s * 0.15);
      thumbHand(ctx, s, k, { col, ink });
      if (k > 0.85) spark(ctx, -s * 0.75, -s * 0.95, s * 0.15, (k - 0.85) * 6, accent);
      break;
    }
    case 'point': {
      const k = anim ? pingPong(T, 1.3) : 1;
      hand(ctx, s, [1, 0.05, 0.05, 0.05], { a: 0.8, l: 0.32 }, { col, ink });
      ctx.strokeStyle = accent; ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.globalAlpha = alpha * k; ctx.beginPath(); ctx.arc(FINGER_X[0] * s - s * 0.1, -s * 0.95, s * 0.12 + k * s * 0.18, 0, TAU); ctx.stroke();
      break;
    }
    case 'pinch':
    case 'flick': {
      const period = kind === 'flick' ? 2 : 1.5;
      const k = anim ? pingPong(T, period) : 1;
      const dx = kind === 'flick' && anim ? Math.max(0, ((T % period) / period - 0.55)) * s * 2.2 : 0;
      ctx.translate(dx, -dx * 0.6);
      const tip = { x: -0.56 + 0.16 * (1 - k), y: -0.32 - 0.42 * (1 - k) };
      hand(ctx, s, [0.9, 0.6, 0.55, 0.5], { a: -0.9 + k * 0.6, l: 0.53 }, { col, ink, curlIndexTo: tip, spread: 0.8 });
      if (k > 0.85) spark(ctx, -0.56 * s, -0.32 * s, s * 0.24, (k - 0.85) * 6, accent);
      if (kind === 'flick' && dx > 0) arrow(ctx, -s * 1.2 - dx, s * 0.6 + dx * 0.6, -s * 0.8 - dx * 0.2, s * 0.35 + dx * 0.2, s, accent);
      break;
    }
    case 'swipe': { // open hand slashing across, leaving a blade trail
      const p = anim ? (T % 1.3) / 1.3 : 0.6, k = easeInOutCubic(clamp(p * 1.6));
      const x = -s * 1.1 + k * s * 2.2, y = s * 0.5 - k * s * 1.0;
      if (k > 0.05 && k < 0.99) {
        ctx.strokeStyle = accent; ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) { ctx.globalAlpha = alpha * (0.6 - i * 0.18); ctx.lineWidth = s * (0.16 - i * 0.04); ctx.beginPath(); ctx.moveTo(-s * 1.1, s * 0.5); ctx.lineTo(x, y); ctx.stroke(); }
        ctx.globalAlpha = alpha;
      }
      ctx.save(); ctx.translate(x, y); ctx.rotate(0.7); ctx.scale(0.6, 0.6); hand(ctx, s, open, { a: -0.9, l: 0.45 }, { spread: 0.4, col, ink }); ctx.restore();
      if (k > 0.45) spark(ctx, 0, -s * 0.05, s * 0.3, Math.min(1, (k - 0.45) * 4) * (1 - p), accent);
      break;
    }
    case 'steer': { // hand gliding between three lanes
      const lane = anim ? Math.round(Math.sin(T * 1.6) * 1.2) : 1, x = lane * s * 0.7;
      ctx.strokeStyle = rgba('#ffffff', 0.35); ctx.lineWidth = Math.max(1, s * 0.04);
      for (const lx of [-1.05, -0.35, 0.35, 1.05]) { ctx.beginPath(); ctx.moveTo(lx * s, s * 0.9); ctx.lineTo(lx * s * 0.5, -s * 0.9); ctx.stroke(); }
      ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(x * 0.8, s * 0.55, s * 0.16, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(x, -s * 0.15); ctx.scale(0.62, 0.62); hand(ctx, s, open, { a: -0.9, l: 0.45 }, { spread: 0.5, col, ink }); ctx.restore();
      break;
    }
    case 'reach': { // hand tapping a glowing pad as a note lands
      const p = anim ? (T % 1.2) / 1.2 : 0.5, k = Math.sin(clamp(p / 0.5) * Math.PI);
      ctx.strokeStyle = accent; ctx.lineWidth = Math.max(1.5, s * 0.07);
      ctx.beginPath(); ctx.arc(s * 0.35, s * 0.35, s * 0.42, 0, TAU); ctx.stroke();
      const nr = s * (0.42 + (1 - clamp(p / 0.5)) * 0.6);
      ctx.globalAlpha = alpha * 0.6; ctx.beginPath(); ctx.arc(s * 0.35, s * 0.35, nr, 0, TAU); ctx.stroke(); ctx.globalAlpha = alpha;
      if (p > 0.45 && p < 0.7) spark(ctx, s * 0.35, s * 0.35, s * 0.45, 1, accent);
      ctx.save(); ctx.translate(-s * 0.35 + k * s * 0.5, -s * 0.35 + k * s * 0.5); ctx.scale(0.62, 0.62); hand(ctx, s, open, { a: -0.9, l: 0.45 }, { col, ink }); ctx.restore();
      break;
    }
    case 'bodyStep': case 'bodyJump': case 'bodyCrouch': { // a little person, for full-body moves
      const k = anim ? pingPong(T, 1.4) : 1;
      let bx = 0, by = 0, crouch = 0, tuck = 0;
      if (kind === 'bodyStep') bx = (anim ? Math.sin(T * 2.2) : 0.8) * s * 0.55;
      if (kind === 'bodyJump') { by = -k * s * 0.45; tuck = k; }
      if (kind === 'bodyCrouch') crouch = k;
      ctx.strokeStyle = rgba('#ffffff', 0.35); ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.beginPath(); ctx.moveTo(-s * 0.9, s * 0.95); ctx.lineTo(s * 0.9, s * 0.95); ctx.stroke();
      if (kind === 'bodyStep') for (const lx of [-0.55, 0, 0.55]) { ctx.beginPath(); ctx.arc(lx * s, s * 0.95, s * 0.05, 0, TAU); ctx.stroke(); }
      if (kind === 'bodyCrouch') { ctx.strokeStyle = accent; ctx.lineWidth = s * 0.1; ctx.beginPath(); ctx.moveTo(-s * 0.8, -s * 0.55); ctx.lineTo(s * 0.8, -s * 0.55); ctx.stroke(); }
      ctx.save(); ctx.translate(bx, by + crouch * s * 0.42);
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = s * 0.16;
      const hip = s * (0.25 - crouch * 0.05), knee = s * (0.6 - crouch * 0.12);
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * s * 0.1, hip); ctx.lineTo(side * s * (0.14 + tuck * 0.12 + crouch * 0.18), knee - tuck * s * 0.12); ctx.lineTo(side * s * 0.14, s * (0.92 - crouch * 0.42) - tuck * s * 0.2); ctx.stroke(); }
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-s * 0.22, -s * 0.38, s * 0.44, s * 0.66, s * 0.18) : ctx.rect(-s * 0.22, -s * 0.38, s * 0.44, s * 0.66); ctx.fill();
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * s * 0.2, -s * 0.28); ctx.lineTo(side * s * (0.42 + tuck * 0.05), -s * (0.02 + tuck * 0.45)); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, -s * 0.62, s * 0.22, 0, TAU); ctx.fill();
      ctx.restore();
      if (kind === 'bodyJump' && k > 0.8) spark(ctx, s * 0.6, -s * 0.8, s * 0.16, (k - 0.8) * 5, accent);
      break;
    }
    case 'tiltHand': {
      const a = anim ? Math.sin(T * 2.4) * 0.55 : 0.4;
      ctx.rotate(a);
      hand(ctx, s, open, { a: -0.9, l: 0.45 }, { spread: 0.5, col, ink });
      break;
    }
    case 'twoPalms': {
      const k = anim ? pingPong(T, 2) : 1, gap = s * (0.7 + 0.55 * k);
      ctx.save(); ctx.translate(-gap, 0); ctx.scale(0.62, 0.62); hand(ctx, s, open, { a: -0.9, l: 0.45 }, { col, ink }); ctx.restore();
      ctx.save(); ctx.translate(gap, 0); ctx.scale(-0.62, 0.62); hand(ctx, s, open, { a: -0.9, l: 0.45 }, { col, ink }); ctx.restore();
      ctx.strokeStyle = accent; ctx.lineWidth = Math.max(1.5, s * 0.08); ctx.globalAlpha = alpha * (0.3 + 0.7 * k);
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) { const u = i / 20, px = -gap * 0.7 + u * gap * 1.4, py = Math.sin(u * 14 + T * 10) * s * 0.06 * k; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
      break;
    }
    case 'winkL': case 'winkR': {
      const k = anim ? pingPong(T, 1.4) : 1;
      const closed = k > 0.5 ? 0 : 1;
      face(ctx, s, { eyeL: kind === 'winkL' ? closed : 1, eyeR: kind === 'winkR' ? closed : 1, mouth: 'smile', amt: 0.3, col, ink });
      if (k > 0.5) spark(ctx, (kind === 'winkL' ? -1 : 1) * s * 0.95, -s * 0.7, s * 0.16, 1, accent);
      break;
    }
    case 'blink': case 'doubleBlink': {
      let closed = 1;
      if (anim) {
        const p = T % 1.6;
        closed = kind === 'blink' ? (p > 0.6 && p < 1.1 ? 0 : 1) : ((p > 0.5 && p < 0.68) || (p > 0.82 && p < 1) ? 0 : 1);
      }
      face(ctx, s, { eyeL: closed, eyeR: closed, mouth: 'line', col, ink });
      if (!closed) spark(ctx, 0, -s * 1.12, s * 0.16, 1, accent);
      break;
    }
    case 'smile': {
      const k = anim ? pingPong(T, 1.6) : 1;
      face(ctx, s, { mouth: k > 0.2 ? 'smile' : 'line', amt: k, col, ink });
      break;
    }
    case 'mouth': {
      const k = anim ? pingPong(T, 1.6) : 1;
      face(ctx, s, { mouth: 'open', amt: k, col, ink });
      break;
    }
    case 'puff': {
      const k = anim ? pingPong(T, 1.8) : 1;
      face(ctx, s, { mouth: 'o', puff: k, col, ink });
      if (k > 0.9 && anim) { ctx.strokeStyle = accent; ctx.lineWidth = Math.max(1, s * 0.05); ctx.beginPath(); ctx.arc(0, 0, s * (1.1 + (T % 0.6)), 0, TAU); ctx.stroke(); }
      break;
    }
    case 'brows': {
      const k = anim ? pingPong(T, 1.6) : 1;
      face(ctx, s, { brows: 0.2 + k * 0.8, mouth: 'o', col, ink });
      break;
    }
    case 'nod': {
      const dy = anim ? Math.sin(T * 6) * s * 0.16 * (Math.sin(T * 1.5) > -0.2 ? 1 : 0) : 0;
      ctx.translate(0, dy); face(ctx, s, { mouth: 'smile', amt: 0.4, col, ink });
      break;
    }
    case 'shake': {
      const dx = anim ? Math.sin(T * 8) * s * 0.18 * (Math.sin(T * 1.5) > -0.2 ? 1 : 0) : 0;
      ctx.translate(dx, 0); face(ctx, s, { mouth: 'line', col, ink });
      break;
    }
    case 'tilt': {
      ctx.rotate(anim ? Math.sin(T * 1.8) * 0.4 : 0.35); face(ctx, s, { mouth: 'smile', amt: 0.2, col, ink });
      break;
    }
    case 'gaze': {
      const lx = anim ? Math.sin(T * 1.6) * 0.5 : 0.3;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.55, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(lx * s * 0.5, 0, s * 0.26, 0, TAU); ctx.fill();
      spark(ctx, s * 1.15, -s * 0.5, s * 0.16, 1, accent);
      break;
    }
    default:
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/** A rounded keyboard keycap, for keyboard / mouse players. */
export function drawKey(ctx, label, x, y, h = 22, { alpha = 1, color = '#ffffff' } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `600 ${Math.round(h * 0.5)}px Sora, Inter, system-ui, sans-serif`;
  const w = Math.max(h, ctx.measureText(label).width + h * 0.7);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.strokeStyle = rgba(color, 0.5); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - h / 2, w, h, h * 0.28) : ctx.rect(x - w / 2, y - h / 2, w, h);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + 0.5);
  ctx.restore();
  return w;
}

/** Map the legacy rule icons (base.js rules) to cue kinds. */
export const CUE_FOR_ICON = { pinch: 'pinch', palm: 'open', gaze: 'gaze', blink: 'blink', smile: 'smile', mouth: 'mouth', brows: 'brows', point: 'point', fist: 'fist', tilt: 'tilt' };
