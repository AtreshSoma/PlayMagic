// Fictional global challengers that pre-populate the Hall of Weavers.
export const CHALLENGERS = [
  { name: 'Seren Valemont', city: 'Cardiff', emblem: '☽', scores: { weaver: 5210, constellations: 2480, echoes: 3120 } },
  { name: 'Kaito Mizuhara', city: 'Sapporo', emblem: '✶', scores: { weaver: 4870, constellations: 2610, echoes: 2760 } },
  { name: 'Amara Okafor', city: 'Lagos', emblem: '❂', scores: { weaver: 4420, constellations: 2050, echoes: 2990 } },
  { name: 'Ilse Brandvold', city: 'Tromsø', emblem: '❖', scores: { weaver: 3960, constellations: 2330, echoes: 2210 } },
  { name: 'Mateo Quispe', city: 'Cusco', emblem: '☄', scores: { weaver: 3610, constellations: 1890, echoes: 2540 } },
  { name: 'Noor Haddad', city: 'Amman', emblem: '✧', scores: { weaver: 3240, constellations: 2170, echoes: 1980 } },
  { name: 'Elif Kaya', city: 'İzmir', emblem: '◈', scores: { weaver: 2980, constellations: 1720, echoes: 2310 } },
  { name: 'Rafael Duarte', city: 'Porto', emblem: '⚝', scores: { weaver: 2650, constellations: 1560, echoes: 1840 } },
  { name: 'Mei-Lin Zhou', city: 'Chengdu', emblem: '✺', scores: { weaver: 2390, constellations: 1980, echoes: 1620 } },
  { name: 'Aroha Ngata', city: 'Rotorua', emblem: '❂', scores: { weaver: 2110, constellations: 1340, echoes: 1710 } },
  { name: 'Priya Raman', city: 'Chennai', emblem: '✶', scores: { weaver: 1870, constellations: 1450, echoes: 1390 } },
  { name: 'Leon Hartmann', city: 'Leipzig', emblem: '⟁', scores: { weaver: 1520, constellations: 1120, echoes: 1210 } },
  { name: 'Sofía Arriaga', city: 'Montevideo', emblem: '☽', scores: { weaver: 1240, constellations: 980, echoes: 1060 } },
  { name: 'Tomasz Wilk', city: 'Kraków', emblem: '✧', scores: { weaver: 960, constellations: 760, echoes: 880 } },
];

// Scores for the newer games, derived so each challenger keeps a consistent skill profile.
for (const c of CHALLENGERS) {
  const w = c.scores.weaver, e = c.scores.echoes;
  c.scores.lightmirror = Math.round((w * 0.92 + e * 0.3) / 10) * 10;
  c.scores.gate = Math.round((e * 0.85 + w * 0.15) / 10) * 10;
  c.scores.starcatcher = Math.round((w * 0.45 + e * 0.35) / 10) * 10;
  c.scores.slice = Math.round((w * 0.7 + e * 0.2) / 10) * 10;
  c.scores.runner = Math.round((w * 1.1 + e * 0.4) / 10) * 10;
  c.scores.beat = Math.round((w * 0.9 + e * 0.6) / 10) * 10;
  c.scores.rails = Math.round((w * 1.3 + e * 0.5) / 10) * 10;
  c.scores.kingdom = Math.round((w * 0.8 + e * 0.5) / 10) * 10;
  c.scores.rally = Math.round((w * 0.9 + e * 0.4) / 10) * 10;
  c.scores.keeper = Math.round((w * 0.5 + e * 0.4) / 10) * 10;
}

export { GAMES } from '../games/catalog.js';

/** 1-based rank of a score among the challengers. */
export function rankFor(game, score) {
  return CHALLENGERS.filter((c) => (c.scores[game] || 0) > score).length + 1;
}
