// ---------------------------------------------------------------------------
// Magic discovery. Instead of front-loading every gesture, the player collects
// "magics" by trying them. The coach suggests the next one; the Spellbook
// shows what's found and how to find the rest.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';

export const MAGICS = [
  { id: 'pinch', name: 'Spark', icon: 'pinch', how: 'Pinch your thumb and finger together', mouse: 'Click' },
  { id: 'palm', name: 'Scatter', icon: 'palm', how: 'Open your hand wide after a pinch', mouse: 'Let go of the click' },
  { id: 'smile', name: 'Golden Bloom', icon: 'smile', how: 'Smile', mouse: 'Hold the 1 key' },
  { id: 'brows', name: 'Levitation', icon: 'brows', how: 'Raise your eyebrows', mouse: 'Hold the 3 key' },
  { id: 'mouth', name: 'Stardust Breath', icon: 'mouth', how: 'Open your mouth', mouse: 'Hold the 2 key' },
  { id: 'tilt', name: 'Bend Gravity', icon: 'tilt', how: 'Tilt your head to one side', mouse: 'Hold A or D' },
  { id: 'swipe', name: 'Shift Element', icon: 'swipe', how: 'Swipe your open hand sideways, fast', mouse: 'Press ← or →' },
  { id: 'circle', name: 'Shield Rune', icon: 'circle', how: 'Point one finger, wait for the ring, draw a circle', mouse: 'Hold Shift and draw a circle' },
  { id: 'triangle', name: 'Prism Rune', icon: 'triangle', how: 'Point one finger, wait for the ring, draw a triangle', mouse: 'Hold Shift and draw a triangle' },
  { id: 'spiral', name: 'Vortex Rune', icon: 'spiral', how: 'Point one finger, wait for the ring, draw a spiral', mouse: 'Hold Shift and draw a spiral' },
  { id: 'gravity', name: 'Gravity Well', icon: 'fist', how: 'Make a fist and hold it', mouse: 'Hold the F key' },
  { id: 'freeze', name: 'Freeze Frame', icon: 'peace', how: 'Show a peace sign (two fingers)', mouse: 'Press P' },
  { id: 'thumbs', name: 'Confirm', icon: 'thumbsUp', how: 'Give a thumbs up', mouse: 'Press T' },
  { id: 'barrier', name: 'Energy Barrier', icon: 'twoPalms', how: 'Hold both palms up, apart', mouse: 'Hold the B key' },
  { id: 'wink', name: 'Wink Paging', icon: 'winkL', how: 'Wink one eye', mouse: 'Press Z or X' },
  { id: 'doubleBlink', name: 'Light Burst', icon: 'doubleBlink', how: 'Blink twice, quickly', mouse: 'Press Space twice' },
  { id: 'puff', name: 'Shockwave', icon: 'puff', how: 'Puff your cheeks (or open wide), then let go', mouse: 'Hold O, then release' },
  { id: 'nod', name: 'Yes', icon: 'nod', how: 'Nod your head', mouse: 'Press Y' },
  { id: 'shake', name: 'No', icon: 'shake', how: 'Shake your head', mouse: 'Press N' },
];

const found = () => app.store.data.discovered;

export function isFound(id) { return found().includes(id); }
export function foundCount() { return found().length; }

/** Mark a magic discovered; celebrates the first time. */
export function discover(id) {
  if (isFound(id) || !MAGICS.some((m) => m.id === id)) return;
  found().push(id);
  app.store.save();
  if (['intro', 'calibration', 'initiation', 'hub'].includes(app.scenes.name) || app.scenes.trans) return; // recorded quietly: the start click, tutorial and Home stay calm
  const sc = app.scenes.current;
  if (sc?.isGame && sc.state === 'play') return; // never pop a card over live gameplay
  const m = MAGICS.find((x) => x.id === id);
  app.hud.celebrate(m, found().length, MAGICS.length);
}

/** Next suggestion for the coach. Face magics are skipped without a camera face. */
export function nextMagic() {
  return MAGICS.find((m) => !isFound(m.id)) || null;
}

/** How to perform a magic in the current input mode. */
export function howTo(m) { return app.mode === 'camera' ? m.how : m.mouse; }
