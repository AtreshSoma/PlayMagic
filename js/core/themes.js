// ---------------------------------------------------------------------------
// Elemental spellcasting loadouts. Each defines the tapestry shader palette,
// particle colours/behaviour, and a style index for shader detail layers.
//   style 0 astral constellations · 1 heat shimmer · 2 caustics · 3 fractures
// ---------------------------------------------------------------------------
export const THEMES = {
  astral: {
    key: 'astral', name: 'Astral Weave', glyph: '✶', tagline: 'Indigo night, gold constellations, stardust trails',
    shader: ['#04051a', '#16196a', '#3a2a8e', '#f6cf78'],
    accent: '#f5c96a', accent2: '#8f7dff',
    particles: ['#f7d98b', '#c9b6ff', '#ffffff', '#93a8ff'],
    kind: 0, style: 0, exhale: 'stardust',
  },
  ember: {
    key: 'ember', name: 'Solar Ember', glyph: '☀', tagline: 'Molten amber, rising sparks, heat ripples',
    shader: ['#120302', '#5a1307', '#a63a0b', '#ffb64d'],
    accent: '#ffb347', accent2: '#ff5a2a',
    particles: ['#ffd27a', '#ff8a3d', '#ff5a1f', '#fff1c1'],
    kind: 1, style: 1, exhale: 'embers',
  },
  tide: {
    key: 'tide', name: 'Bioluminescent Tide', glyph: '❂', tagline: 'Cyan & emerald liquid light, drifting spores',
    shader: ['#01100f', '#033a3a', '#0a6d5f', '#62f6d4'],
    accent: '#5ff5d2', accent2: '#3fb8ff',
    particles: ['#5ff5d2', '#86ffb0', '#43d2ff', '#e2fff8'],
    kind: 2, style: 2, exhale: 'auroral mist',
  },
  void: {
    key: 'void', name: 'Void Prism', glyph: '◈', tagline: 'Iridescent violet, chromatic trails, fractures',
    shader: ['#06020e', '#250a45', '#5d1e92', '#eaa9ff'],
    accent: '#e6a8ff', accent2: '#6ae3ff',
    particles: ['#ff6ad5', '#a66bff', '#6ae3ff', '#ffffff'],
    kind: 3, style: 3, exhale: 'prism shards',
  },
};
export const THEME_ORDER = ['astral', 'ember', 'tide', 'void'];

export const INTENSITIES = [
  { key: 'subtle', label: 'Subtle', mult: 0.55 },
  { key: 'radiant', label: 'Radiant', mult: 1 },
  { key: 'torrent', label: 'Torrent', mult: 1.7 },
];

export const MIRROR_MODES = [
  { key: 'full', label: 'Full Mirror', glyph: '◉' },
  { key: 'ethereal', label: 'Ethereal Outline', glyph: '◐' },
  { key: 'void', label: 'Pure Void', glyph: '○' },
];
