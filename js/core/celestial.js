// ---------------------------------------------------------------------------
// Real-time sky from the local clock. Low-precision but genuine ephemerides:
//  • Sun: standard low-precision solar longitude (~0.01°)
//  • Moon: mean elements + six principal periodic terms (~0.5°)
//  • Planets: JPL "Approximate Positions of the Planets" Keplerian elements
//    (valid 1800–2050), converted to geocentric ecliptic longitude.
// ---------------------------------------------------------------------------
import { txt } from './util.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const n360 = (d) => ((d % 360) + 360) % 360;

export const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
export const SIGN_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'].map(txt);
export const PHASES = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];

export const julian = (date) => date.getTime() / 86400000 + 2440587.5;

export function sunLongitude(jd) {
  const n = jd - 2451545.0;
  const L = n360(280.460 + 0.9856474 * n);
  const g = n360(357.528 + 0.9856003 * n) * D2R;
  return n360(L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g));
}

export function moonLongitude(jd) {
  const n = jd - 2451545.0;
  const L = n360(218.316 + 13.176396 * n);
  const Mm = n360(134.963 + 13.064993 * n) * D2R;  // Moon mean anomaly
  const Ms = n360(357.529 + 0.98560028 * n) * D2R; // Sun mean anomaly
  const D = n360(297.850 + 12.190749 * n) * D2R;   // mean elongation
  const F = n360(93.272 + 13.229350 * n) * D2R;    // argument of latitude
  return n360(L + 6.289 * Math.sin(Mm) + 1.274 * Math.sin(2 * D - Mm) + 0.658 * Math.sin(2 * D)
    + 0.214 * Math.sin(2 * Mm) - 0.186 * Math.sin(Ms) - 0.114 * Math.sin(2 * F));
}

export function moonPhase(date) {
  const jd = julian(date);
  const elong = n360(moonLongitude(jd) - sunLongitude(jd));
  const frac = elong / 360;
  return {
    frac,
    illum: (1 - Math.cos(elong * D2R)) / 2,
    age: frac * 29.530588853,
    name: PHASES[Math.floor(frac * 8 + 0.5) % 8],
    waxing: frac < 0.5,
  };
}

// a, ȧ, e, ė, I, İ, L, L̇, ϖ, ϖ̇, Ω, Ω̇   (per Julian century from J2000)
const ELEMENTS = {
  mercury: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.25032350, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081],
  venus: [0.72333566, 0.00000390, 0.00677672, -0.00004107, 3.39467605, -0.00078890, 181.97909950, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
  earth: [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0],
  mars: [1.52371034, 0.00001847, 0.09339410, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
  jupiter: [5.20288700, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
  saturn: [9.53667594, -0.00125060, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794],
};

function heliocentric(el, T) {
  const a = el[0] + el[1] * T, e = el[2] + el[3] * T, I = (el[4] + el[5] * T) * D2R;
  const L = el[6] + el[7] * T, w = el[8] + el[9] * T, O = el[10] + el[11] * T;
  const omega = (w - O) * D2R, Om = O * D2R;
  let M = n360(L - w); if (M > 180) M -= 360; M *= D2R;
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(omega), sw = Math.sin(omega), cO = Math.cos(Om), sO = Math.sin(Om), cI = Math.cos(I), sI = Math.sin(I);
  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    sw * sI * xp + cw * sI * yp,
  ];
}

function geocentricLongitude(key, jd) {
  const T = (jd - 2451545) / 36525;
  const p = heliocentric(ELEMENTS[key], T), e = heliocentric(ELEMENTS.earth, T);
  return n360(Math.atan2(p[1] - e[1], p[0] - e[0]) * R2D);
}

export const PLANETS = [
  { key: 'mercury', name: 'Mercury', glyph: txt('☿'), color: '#c9c3b8' },
  { key: 'venus', name: 'Venus', glyph: txt('♀'), color: '#ffe3a3' },
  { key: 'mars', name: 'Mars', glyph: txt('♂'), color: '#ff7a5c' },
  { key: 'jupiter', name: 'Jupiter', glyph: txt('♃'), color: '#f2c38b' },
  { key: 'saturn', name: 'Saturn', glyph: txt('♄'), color: '#e6d39a' },
];

const sep = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/** Full sky snapshot for a moment. */
export function skyState(date = new Date()) {
  const jd = julian(date);
  const bodies = [
    { key: 'sun', name: 'Sun', glyph: txt('☉'), color: '#ffd36b', lon: sunLongitude(jd) },
    { key: 'moon', name: 'Moon', glyph: txt('☽'), color: '#e8ecff', lon: moonLongitude(jd) },
  ];
  for (const p of PLANETS) {
    const lon = geocentricLongitude(p.key, jd);
    const next = geocentricLongitude(p.key, jd + 1);
    const motion = ((next - lon + 540) % 360) - 180;
    bodies.push({ ...p, lon, retro: motion < 0 });
  }
  for (const b of bodies) b.sign = Math.floor(b.lon / 30) % 12;

  const conj = [];
  for (let i = 0; i < bodies.length; i++)
    for (let j = i + 1; j < bodies.length; j++) {
      const s = sep(bodies[i].lon, bodies[j].lon);
      if (s < 8) conj.push({ a: bodies[i], b: bodies[j], sep: s });
    }
  conj.sort((x, y) => x.sep - y.sep);

  // Smallest arc containing the Moon and the five naked-eye planets.
  const lons = bodies.filter((b) => b.key !== 'sun').map((b) => b.lon).sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 0; i < lons.length; i++) {
    const gap = i === lons.length - 1 ? lons[0] + 360 - lons[i] : lons[i + 1] - lons[i];
    maxGap = Math.max(maxGap, gap);
  }
  const spread = 360 - maxGap;
  const planetsOnly = bodies.filter((b) => !['sun', 'moon'].includes(b.key));
  let alignment;
  if (spread < 70) alignment = 'Grand Alignment';
  else if (spread < 130) alignment = 'Planetary Parade';
  else if (conj.length) alignment = `${conj[0].a.name}–${conj[0].b.name} conjunction`;
  else alignment = 'Scattered heavens';

  return {
    date, jd, bodies, conj, spread, alignment,
    phase: moonPhase(date),
    sun: bodies[0], moon: bodies[1],
    retro: planetsOnly.filter((b) => b.retro),
  };
}
