// ---------------------------------------------------------------------------
// Persistent progression (localStorage). Every access is guarded so a private
// window or blocked storage simply means "nothing is remembered".
// ---------------------------------------------------------------------------
import { pick } from './util.js';

const KEY = 'aetheria.v1';

export const TITLES = [
  'Novice Weaver', 'Star-Sworn Initiate', 'Ember Adept', 'Tidecaller',
  'Prism Seer', 'Keeper of Runes', 'Moon-Warden', 'Archweaver of Dusk',
];
export const EMBLEMS = ['✶', '☽', '❂', '◈', '✧', '⚝', '❖', '☄', '✺', '⟁'];

const A = ['Ae', 'Ly', 'Se', 'Ka', 'Or', 'Va', 'Ny', 'Il', 'Tha', 'Mi', 'Ze', 'Ro', 'Ca', 'Eli', 'Sa', 'Ve'];
const B = ['ra', 'ven', 'ris', 'lune', 'dor', 'wyn', 'sha', 'mir', 'qua', 'len', 'nis', 'rae', 'lis', 'thra'];
const C = ['', 'a', 'el', 'is', 'or', 'yn', 'e'];
export const randomName = () => pick(A) + pick(B) + pick(C);

const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const defaults = () => ({
  version: 1,
  profile: { name: randomName(), title: 0, emblem: 0 },
  settings: { theme: 'astral', intensity: 1, mirror: 'ethereal', volume: 0.7, muted: false, swapWinks: false, quality: 'auto' },
  best: { weaver: 0, constellations: 0, echoes: 0, lightmirror: 0, gate: 0, starcatcher: 0, sculptor: 0, orchestra: 0, slice: 0, runner: 0, beat: 0, rails: 0, kingdom: 0, rally: 0, keeper: 0 },
  history: [],
  totals: { runes: 0, games: 0, orbs: 0, spirits: 0, stars: 0 },
  bestCombo: 0,
  streak: { last: null, days: 0, best: 0 },
  codex: [],
  discovered: [],
  initiated: false,
  helpSeen: false,
  lastGame: 'rails',
});

function merge(base, src) {
  if (!src || typeof src !== 'object') return base;
  for (const k of Object.keys(base)) {
    if (!(k in src)) continue;
    const b = base[k], s = src[k];
    if (b && typeof b === 'object' && !Array.isArray(b)) base[k] = merge(b, s);
    else if (typeof s === typeof b || b === null) base[k] = s;
  }
  return base;
}

export const store = {
  data: defaults(),
  persistent: true,

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = merge(defaults(), JSON.parse(raw));
    } catch { this.persistent = false; }
    return this;
  },
  save() {
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { this.persistent = false; }
    }, 150);
  },

  /** Daily "Resonance Streak": consecutive days you have woven. */
  touchStreak() {
    const s = this.data.streak, today = dayKey();
    if (s.last === today) return s.days;
    const y = new Date(); y.setDate(y.getDate() - 1);
    s.days = s.last === dayKey(y) ? s.days + 1 : 1;
    s.last = today;
    s.best = Math.max(s.best, s.days);
    this.save();
    return s.days;
  },

  recordScore(game, score, meta = {}) {
    const d = this.data, prev = d.best[game] || 0, isBest = score > prev;
    if (isBest) d.best[game] = score;
    d.history.unshift({ game, score, at: Date.now() });
    d.history = d.history.slice(0, 30);
    d.totals.games++;
    if (meta.combo) d.bestCombo = Math.max(d.bestCombo, meta.combo);
    this.save();
    return { isBest, prev };
  },
  addTotal(key, n = 1) { this.data.totals[key] = (this.data.totals[key] || 0) + n; this.save(); },
  unlock(id) {
    if (this.data.codex.includes(id)) return false;
    this.data.codex.push(id); this.save(); return true;
  },
  setting(key, value) { this.data.settings[key] = value; this.save(); },
};
