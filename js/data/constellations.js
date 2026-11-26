// Original mythical constellations for Gaze Constellations.
// `stars` are in a unit box; `path` is the order in which stars are bound
// (consecutive pairs become lines; a star may be revisited).
export const CONSTELLATIONS = [
  {
    id: 'heron', name: 'The Lantern Heron',
    myth: 'She carried a lantern across the drowned sky so the lost could find the shore.',
    stars: [[0.12, 0.8], [0.28, 0.62], [0.4, 0.42], [0.5, 0.16], [0.64, 0.24], [0.56, 0.5], [0.74, 0.64], [0.9, 0.56]],
    path: [0, 1, 2, 3, 4, 2, 5, 6, 7],
  },
  {
    id: 'harp', name: 'Veyra’s Harp',
    myth: 'Strung with the last light of a dying star, it plays only for those who listen with closed eyes.',
    stars: [[0.2, 0.85], [0.18, 0.45], [0.32, 0.15], [0.62, 0.12], [0.84, 0.3], [0.7, 0.62], [0.48, 0.86]],
    path: [0, 1, 2, 3, 4, 5, 6, 0],
  },
  {
    id: 'crown', name: 'The Drowned Crown',
    myth: 'Five tides rose to claim a queen; her crown still glints where the sea meets the night.',
    stars: [[0.08, 0.7], [0.22, 0.3], [0.36, 0.62], [0.5, 0.18], [0.64, 0.62], [0.78, 0.3], [0.92, 0.7]],
    path: [0, 1, 2, 3, 4, 5, 6, 0],
  },
  {
    id: 'ouroboros', name: 'Ouroboros Minor',
    myth: 'A small serpent that swallows its tail each winter, so the year may begin again.',
    stars: [[0.5, 0.1], [0.8, 0.22], [0.9, 0.52], [0.74, 0.82], [0.44, 0.9], [0.16, 0.74], [0.12, 0.42], [0.3, 0.18], [0.5, 0.32]],
    path: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  },
  {
    id: 'stag', name: 'The Ember Stag',
    myth: 'His antlers caught fire at the world’s first dawn and have never stopped burning.',
    stars: [[0.3, 0.86], [0.38, 0.6], [0.6, 0.6], [0.7, 0.86], [0.66, 0.38], [0.8, 0.22], [0.92, 0.08], [0.62, 0.1], [0.5, 0.4]],
    path: [0, 1, 2, 3, 2, 4, 5, 6, 5, 7],
  },
  {
    id: 'key', name: 'The Ninth Key',
    myth: 'Eight keys open the eight doors of heaven. No one remembers what the ninth unlocks.',
    stars: [[0.2, 0.3], [0.34, 0.14], [0.48, 0.3], [0.34, 0.46], [0.5, 0.56], [0.68, 0.7], [0.86, 0.86], [0.78, 0.58], [0.66, 0.9]],
    path: [0, 1, 2, 3, 0, 3, 4, 5, 6, 5, 7, 5, 8],
  },
  {
    id: 'loom', name: 'The Loom of Dusk',
    myth: 'Every evening the weaver-goddess threads the sunset back into the dark.',
    stars: [[0.14, 0.18], [0.14, 0.82], [0.86, 0.82], [0.86, 0.18], [0.5, 0.5], [0.5, 0.18]],
    path: [0, 1, 2, 3, 0, 4, 2, 3, 4, 5],
  },
  {
    id: 'moth', name: 'The Moon-Moth',
    myth: 'Drawn to the moon for a thousand years, it finally landed and became its shadow.',
    stars: [[0.5, 0.2], [0.5, 0.82], [0.14, 0.12], [0.08, 0.48], [0.3, 0.56], [0.86, 0.12], [0.92, 0.48], [0.7, 0.56]],
    path: [0, 2, 3, 4, 1, 7, 6, 5, 0, 1],
  },
];
