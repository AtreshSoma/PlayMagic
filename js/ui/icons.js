// ---------------------------------------------------------------------------
// Inline SVG pictograms for the Grimoire and the Initiation Ritual.
// Stroke-based, inherit currentColor (the theme accent).
// ---------------------------------------------------------------------------
const S = (inner) => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const PALM = '<rect x="18" y="32" width="30" height="24" rx="9" fill="currentColor" fill-opacity=".14"/>';
const FACE = '<circle cx="32" cy="32" r="22"/>';
const STAR = (x, y, s = 1) => `<path class="spark" d="M${x} ${y - 5 * s} L${x + 1.6 * s} ${y - 1.6 * s} L${x + 5 * s} ${y} L${x + 1.6 * s} ${y + 1.6 * s} L${x} ${y + 5 * s} L${x - 1.6 * s} ${y + 1.6 * s} L${x - 5 * s} ${y} L${x - 1.6 * s} ${y - 1.6 * s}Z" fill="currentColor" stroke="none"/>`;

function spiral() {
  let d = 'M32 32';
  for (let i = 1; i <= 60; i++) { const u = i / 60, a = u * Math.PI * 4.4, r = u * 22; d += ` L${(32 + Math.cos(a) * r).toFixed(1)} ${(32 + Math.sin(a) * r).toFixed(1)}`; }
  return d;
}

export const ICONS = {
  gaze: S(`<path d="M6 32 C16 18 48 18 58 32 C48 46 16 46 6 32Z"/><circle cx="38" cy="32" r="7"/><circle cx="38" cy="32" r="2.6" fill="currentColor"/>${STAR(54, 12)}`),
  blink: S('<path d="M8 28 C18 40 46 40 56 28"/><path d="M15 35 l-3 6 M25 38.5 l-1 7 M39 38.5 l1 7 M49 35 l3 6"/><circle class="spark" cx="32" cy="16" r="3" fill="currentColor" stroke="none"/>'),
  winkL: S('<path d="M4 32 C9 37 23 37 28 32"/><path d="M36 32 C41 24 55 24 60 32 C55 40 41 40 36 32Z"/><circle cx="48" cy="32" r="3.5" fill="currentColor"/><path d="M8 18 l6 4 M20 18 l-6 4" opacity=".6"/>'),
  winkR: S('<path d="M4 32 C9 24 23 24 28 32 C23 40 9 40 4 32Z"/><circle cx="16" cy="32" r="3.5" fill="currentColor"/><path d="M36 32 C41 37 55 37 60 32"/><path d="M44 18 l6 4 M56 18 l-6 4" opacity=".6"/>'),
  closed: S('<path d="M6 30 C10 36 24 36 28 30"/><path d="M36 30 C40 36 54 36 58 30"/><path d="M40 12 a9 9 0 1 0 10 10 a7 7 0 1 1 -10 -10Z" fill="currentColor" fill-opacity=".3"/>'),
  pinch: S(`${PALM}<g stroke-width="5.5"><path d="M38 34 V14"/><path d="M45 37 V19"/><path d="M30 34 C30 24 27 19 23 18"/><path d="M19 44 C14 36 15 26 21 20"/></g>${STAR(22, 18, 1.2)}`),
  palm: S(`${PALM}<g stroke-width="5.5"><path d="M22 36 V14"/><path d="M30 34 V9"/><path d="M38 34 V11"/><path d="M45 37 V18"/><path d="M19 44 L9 34"/></g><path d="M4 12 l4 3 M56 6 l-3 4 M60 26 l-4 1" opacity=".7"/>`),
  point: S(`${PALM}<g stroke-width="5.5"><path d="M24 36 V8"/><path d="M31 33 C33 29 36 29 38 33"/><path d="M38 36 C40 32 43 32 45 37"/><path d="M19 44 L12 38"/></g><path d="M24 4 C40 2 50 12 46 22" stroke-dasharray="3 4" opacity=".8"/>`),
  fist: S('<rect x="16" y="22" width="32" height="30" rx="10" fill="currentColor" fill-opacity=".14"/><path d="M20 30 h24 M20 38 h24" opacity=".7"/><path d="M16 40 C10 36 12 28 18 28" stroke-width="4"/><circle cx="32" cy="10" r="5"/><path d="M26 10 h12 M32 4 v12" opacity=".6"/>'),
  twoHands: S('<circle cx="14" cy="32" r="5" fill="currentColor" fill-opacity=".3"/><circle cx="50" cy="32" r="5" fill="currentColor" fill-opacity=".3"/><path d="M22 32 H42"/><path d="M8 24 l-4 8 4 8 M56 24 l4 8 -4 8"/><path d="M28 26 l-6 6 6 6 M36 26 l6 6 -6 6" opacity=".5"/>'),
  twoPalms: S('<rect x="6" y="28" width="20" height="18" rx="6" fill="currentColor" fill-opacity=".14"/><rect x="38" y="28" width="20" height="18" rx="6" fill="currentColor" fill-opacity=".14"/><g stroke-width="3.5"><path d="M10 30 V16 M16 28 V12 M22 30 V16"/><path d="M42 30 V16 M48 28 V12 M54 30 V16"/></g><path d="M32 22 V52" stroke-dasharray="2 4"/>'),
  swipe: S(`${PALM.replace('x="18"', 'x="20"')}<g stroke-width="4.5"><path d="M24 36 V18 M31 34 V14 M38 34 V16 M45 37 V22"/></g><path d="M4 22 h10 M8 18 l-4 4 4 4"/><path d="M60 22 h-10 M56 18 l4 4 -4 4"/>`),
  circle: S(`<circle cx="32" cy="32" r="20" stroke-dasharray="110 16"/><path d="M50 22 l2 -8 -8 2"/><circle cx="32" cy="12" r="3" fill="currentColor"/>`),
  triangle: S('<path d="M32 10 L54 50 H10Z"/><circle cx="32" cy="10" r="3" fill="currentColor"/>'),
  spiral: S(`<path d="${spiral()}"/><circle cx="32" cy="32" r="2.5" fill="currentColor"/>`),
  brows: S(`${FACE}<circle cx="24" cy="30" r="2.4" fill="currentColor"/><circle cx="40" cy="30" r="2.4" fill="currentColor"/><path d="M17 22 C20 17 27 17 30 20 M34 20 C37 17 44 17 47 22"/><path d="M26 42 h12"/><path d="M32 3 v6 M29 6 l3 -3 3 3" opacity=".7"/>`),
  mouth: S(`${FACE}<circle cx="24" cy="27" r="2.4" fill="currentColor"/><circle cx="40" cy="27" r="2.4" fill="currentColor"/><ellipse cx="32" cy="41" rx="6" ry="7"/><circle class="spark" cx="32" cy="58" r="1.6" fill="currentColor"/><circle class="spark" cx="25" cy="60" r="1.2" fill="currentColor"/><circle class="spark" cx="39" cy="60" r="1.2" fill="currentColor"/>`),
  smile: S(`${FACE}<circle cx="24" cy="27" r="2.4" fill="currentColor"/><circle cx="40" cy="27" r="2.4" fill="currentColor"/><path d="M21 37 C26 46 38 46 43 37"/><path d="M6 10 l5 5 M58 10 l-5 5 M32 1 v6" opacity=".7"/>`),
  peace: S(`${PALM}<g stroke-width="5.5"><path d="M25 34 L19 9"/><path d="M36 33 L42 9"/><path d="M38 38 C41 34 44 35 45 39"/><path d="M19 44 C15 40 17 34 22 36"/></g>${STAR(50, 14, 1)}`),
  thumbsUp: S('<rect x="20" y="28" width="26" height="26" rx="8" fill="currentColor" fill-opacity=".14"/><path d="M24 35 h18 M24 42 h18 M24 49 h16" opacity=".6"/><path d="M26 28 C26 18 28 10 33 8 C37 7 37 13 36 18 L35 28" stroke-width="4.5"/><path d="M50 14 l4 -4 M54 22 h5 M48 6 v-4" opacity=".7"/>'),
  puff: S(`${FACE}<circle cx="24" cy="26" r="2.4" fill="currentColor"/><circle cx="40" cy="26" r="2.4" fill="currentColor"/><path d="M10 34 C6 40 10 46 16 44 M54 34 C58 40 54 46 48 44" stroke-width="2.6"/><circle cx="32" cy="42" r="3.2"/><path d="M2 32 h4 M58 32 h4" opacity=".6"/>`),
  nod: S('<circle cx="32" cy="30" r="15"/><circle cx="26" cy="30" r="2" fill="currentColor"/><circle cx="38" cy="30" r="2" fill="currentColor"/><path d="M27 37 C30 40 34 40 37 37"/><path d="M54 14 V46 M50 18 l4 -4 4 4 M50 42 l4 4 4 -4"/>'),
  shake: S('<circle cx="32" cy="28" r="15"/><circle cx="26" cy="27" r="2" fill="currentColor"/><circle cx="38" cy="27" r="2" fill="currentColor"/><path d="M27 35 h10"/><path d="M14 54 H50 M18 50 l-4 4 4 4 M46 50 l4 4 -4 4"/>'),
  doubleBlink: S('<path d="M6 24 C12 31 26 31 32 24"/><path d="M32 24 C38 31 52 31 58 24" opacity=".5"/><path d="M6 42 C12 49 26 49 32 42" opacity=".5"/><path d="M32 42 C38 49 52 49 58 42"/><circle class="spark" cx="32" cy="12" r="3" fill="currentColor" stroke="none"/><circle class="spark" cx="32" cy="56" r="2" fill="currentColor" stroke="none"/>'),
  tilt: S('<g transform="rotate(-18 32 30)"><circle cx="32" cy="26" r="16"/><circle cx="26" cy="24" r="2" fill="currentColor"/><circle cx="38" cy="24" r="2" fill="currentColor"/><path d="M27 32 h10"/></g><path d="M44 48 L54 58 M54 50 V58 H46"/>'),
};

// Dock / chrome icons: 24-unit grid, 1.75 stroke, geometric.
const D = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
export const DOCK_ICONS = {
  home: D('<path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>'),
  book: D('<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3Z"/><path d="M5 17a3 3 0 0 1 3-3h10"/><path d="m11 7 .9 1.9L14 9.3l-1.5 1.4.4 2-1.9-1-1.9 1 .4-2L8 9.3l2.1-.4Z" fill="currentColor" stroke="none"/>'),
  trophy: D('<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8.5 20h7M10 17h4"/>'),
  help: D('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>'),
  gear: D('<circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"/>'),
  camera: D('<rect x="3" y="7" width="13" height="10" rx="3"/><path d="m16 11 5-3v8l-5-3"/>'),
  cameraOff: D('<rect x="3" y="7" width="13" height="10" rx="3" opacity=".45"/><path d="m16 11 5-3v8l-5-3" opacity=".45"/><path d="M3 4l18 16"/>'),
  sound: D('<path d="M4 10v4h3l5 4V6L7 10Z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>'),
  mute: D('<path d="M4 10v4h3l5 4V6L7 10Z"/><path d="m16 10 4 4m0-4-4 4"/>'),
  kids: D('<path d="M4 16a8 8 0 0 1 16 0" stroke="#ff8fd8"/><path d="M6.5 16a5.5 5.5 0 0 1 11 0" stroke="#ffe066"/><path d="M9 16a3 3 0 0 1 6 0" stroke="#7fe8ff"/><path d="m12 4 .8 1.7 1.8.3-1.3 1.2.3 1.8-1.6-.9-1.6.9.3-1.8L9.4 6l1.8-.3Z" fill="currentColor" stroke="none"/>'),
  snapshot: D('<rect x="3" y="6" width="18" height="13" rx="3"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>'),
};
