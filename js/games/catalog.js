// ---------------------------------------------------------------------------
// Game catalog: pure metadata for every experience in the portal, in hub
// order. No imports, so any module (hub, leaderboard, store) can read it
// without pulling in game code. Classes are attached in games/registry.js.
//   cue      animated signifier shown on the hub card (ui/signifiers.js)
//   accent   card + onboarding accent colour
//   scored   has a leaderboard (sandboxes and instruments do not)
//   group    Home filter (GROUPS below) · needs: what the camera has to see
//   credit   optional per-game creator signature (results corner); the site-wide
//            "Created by" credit lives on Home
// ---------------------------------------------------------------------------
export const CATALOG = [
  { id: 'rails', group: 'motion', needs: 'Full body', name: 'Neon Rails', blurb: 'Run the neon city with your whole body', tag: 'New', cue: 'bodyJump', accent: '#ff7ad9', scored: true,
    how: 'Step left / right to switch lines · jump to hop barriers · crouch to slide', howMouse: '← → switch lines · ↑ or Space jump · ↓ slide (or swipe)' },
  { id: 'kingdom', group: 'motion', needs: 'One hand', name: 'Sky Kingdom', blurb: 'Leap, stomp and bump blocks across sky islands', tag: 'New', cue: 'flick', accent: '#9dff9a', scored: true,
    how: 'Hand right of centre = run right · flick up to jump (twice for a double jump) · ✌ sparks', howMouse: '← → run · ↑ / Space jump · P spark' },
  { id: 'rally', group: 'motion', needs: 'Two hands', name: 'Nebula Rally', blurb: 'Kart race through space, steering-wheel style', tag: 'New', cue: 'twoPalms', accent: '#ffb347', scored: true,
    how: 'Hold both hands like a steering wheel and turn · pinch to use an item', howMouse: '← → steer · Space uses your item' },
  { id: 'keeper', group: 'motion', needs: 'Hands + head', name: 'Comet Keeper', blurb: 'Block comets with your palms, dodge the dark ones', tag: 'New', cue: 'open', accent: '#7ff3ff', scored: true,
    how: 'Put a palm on each glowing ring as its comet lands · move your head away from dark meteors', howMouse: 'Pointer on the ring as the comet lands · ← → dodge' },
  { id: 'slice', group: 'arcade', needs: 'One hand', name: 'Comet Slice', blurb: 'Swipe to slice flying space fruit', tag: 'Arcade', cue: 'swipe', accent: '#ff8a5c', scored: true,
    how: 'Swipe your hand through the fruit · dodge the dark bombs', howMouse: 'Swipe the mouse (or a finger) through the fruit' },
  { id: 'runner', group: 'arcade', needs: 'One hand', name: 'Starlight Run', blurb: 'Dash, dodge and jump through space', tag: 'Runner', cue: 'steer', accent: '#7ff3ff', scored: true,
    how: 'Move your hand left or right to change lanes · flick it up to jump', howMouse: '← → or move the mouse to change lanes · ↑ or click to jump' },
  { id: 'beat', group: 'arcade', needs: 'Hands', name: 'Beat Bloom', blurb: 'Hit the glowing pads to the beat', tag: 'Rhythm', cue: 'reach', accent: '#ff7ad9', scored: true,
    how: 'Touch each pad as its note lands on the ring', howMouse: 'Click the pads, or press D F J K on the beat' },
  { id: 'lightmirror', group: 'skill', needs: 'Hands', name: 'Light Mirror', blurb: 'Bend a laser into crystal prisms', tag: 'Puzzle', cue: 'tiltHand', accent: '#9fe8ff', scored: true,
    how: 'Your hands are mirrors: tilt them to bounce the beam', howMouse: 'Move the mirror · scroll or Q/E to turn · click to pin' },
  { id: 'gate', group: 'skill', needs: 'Hands + face', name: 'Gesture Gate', blurb: 'Match the pose before it reaches the ring', tag: 'Reflex', cue: 'peace', accent: '#ff9be8', scored: true,
    how: 'Make the gesture shown on the glowing token', howMouse: 'Tap the matching pose, or H P F T 1 2' },
  { id: 'starcatcher', group: 'arcade', needs: 'Face', name: 'Star Catcher', blurb: 'Catch falling stars, shield your crystal', tag: 'Arcade', cue: 'tilt', accent: '#ffe27a', scored: true,
    how: 'Tilt your head (or wink) toward a star to catch it · open your mouth to shield', howMouse: 'Z / X or tap a side to catch · Space shields' },
  { id: 'sculptor', group: 'create', needs: 'One hand', name: 'Gravity Sculptor', blurb: 'Spin planets into orbit', tag: 'Sandbox', cue: 'flick', accent: '#b69bff', scored: false,
    how: 'Pinch to make planets, flick to launch · fist = black hole · open palm = supernova', howMouse: 'Drag to launch · F black hole · H supernova · P freeze' },
  { id: 'orchestra', group: 'create', needs: 'Hands + face', name: 'Cosmic Orchestra', blurb: 'Play music in the air', tag: 'Studio', cue: 'open', accent: '#ffd36e', scored: false,
    how: 'Left hand chords · right hand melody · open mouth to swell · nod for a beat', howMouse: 'Left half chords · right half melody · 2 swell · Y beat' },
  { id: 'weaver', group: 'arcade', needs: 'One hand', name: 'Stardust Weaver', blurb: 'Catch the falling stars', tag: 'Classic', cue: 'pinch', accent: '#f5c96a', scored: true,
    how: 'Pinch stars · swat dark shards with an open hand', howMouse: 'Click stars · sweep over dark shards' },
];

export const GAMES = Object.fromEntries(CATALOG.map((g) => [g.id, g]));
export const SCORED_GAMES = CATALOG.filter((g) => g.scored);

/** Home filters, in order. */
export const GROUPS = [
  { id: 'all', label: 'All games' },
  { id: 'motion', label: 'Motion' },
  { id: 'arcade', label: 'Arcade' },
  { id: 'skill', label: 'Puzzle & reflex' },
  { id: 'create', label: 'Create' },
];
export const GROUP_LABEL = Object.fromEntries(GROUPS.map((g) => [g.id, g.label]));
