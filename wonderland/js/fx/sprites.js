// ---------------------------------------------------------------------------
// Cached glow sprites. Drawing a pre-rendered radial gradient with
// drawImage + 'lighter' is far cheaper than shadowBlur, which keeps the
// whole world at 60 FPS even with a couple of thousand particles.
// ---------------------------------------------------------------------------
import { TAU } from '../core/util.js';

const glowCache = new Map();
const sparkCache = new Map();
const SIZE = 64;
let probe = null;

function canvas(n) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  return c;
}

/** Any CSS colour → [r, g, b] (resolved by the browser itself). */
export function rgbOf(color) {
  if (!probe) probe = canvas(1).getContext('2d', { willReadFrequently: true });
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = '#000';
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}

const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;

/** Soft round glow: white-hot core fading through `color` to nothing. */
export function glowSprite(color = '#ffffff') {
  let c = glowCache.get(color);
  if (c) return c;
  c = canvas(SIZE);
  const g = c.getContext('2d'), h = SIZE / 2, rgb = rgbOf(color);
  const grd = g.createRadialGradient(h, h, 0, h, h, h);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.16, rgba(rgb, 1));
  grd.addColorStop(0.42, rgba(rgb, 0.35));
  grd.addColorStop(1, rgba(rgb, 0));
  g.fillStyle = grd;
  g.fillRect(0, 0, SIZE, SIZE);
  glowCache.set(color, c);
  return c;
}

/** Four-point twinkle star with a soft halo. */
export function sparkSprite(color = '#ffffff') {
  let c = sparkCache.get(color);
  if (c) return c;
  c = canvas(SIZE);
  const g = c.getContext('2d'), h = SIZE / 2, rgb = rgbOf(color);
  const halo = g.createRadialGradient(h, h, 0, h, h, h * 0.75);
  halo.addColorStop(0, rgba(rgb, 0.7));
  halo.addColorStop(1, rgba(rgb, 0));
  g.fillStyle = halo;
  g.fillRect(0, 0, SIZE, SIZE);
  g.fillStyle = '#fff';
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2, r = i % 2 ? h * 0.13 : h * 0.95;
    const x = h + Math.cos(a) * r, y = h + Math.sin(a) * r;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
  g.fill();
  sparkCache.set(color, c);
  return c;
}
