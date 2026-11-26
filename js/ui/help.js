// ---------------------------------------------------------------------------
// How to Play: one clear page with everything a new player needs.
//   the basics (move · choose · confirm · go back), the easy gestures with
//   their keyboard twins, every game's controls (from the catalog), and tips.
// Opens from the dock's "?" button or the ? key; shows itself once on the
// first visit to the hub.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { ICONS } from './icons.js';
import { CATALOG } from '../games/catalog.js';

const BASICS = [
  ['point', 'Move', 'Raise a hand and point at the screen', 'Move the mouse'],
  ['pinch', 'Choose', 'Pinch thumb and finger together', 'Click (or tap)'],
  ['thumbsUp', 'Play again', 'Thumbs up on the results screen', 'Enter'],
  ['shake', 'Go back', 'Home button, top-left (pinch-hold it during play)', 'Esc'],
];
const VISION = [
  ['point', 'Point to play', 'On Home, point at a game and hold still: a ring fills and the game starts', 'Click a game'],
  ['pinch', 'Pinch anywhere', 'Either hand can pinch to press what is in focus; no need to hold still', 'Click'],
  ['swipe', 'Pinch and drag', 'Hold the pinch and slide up or down to scroll the game list', 'Wheel / finger'],
  ['twoHands', 'Two-hand pinch', 'Pinch with both hands and pull apart to zoom the sky', 'Mouse wheel'],
];
const BODY = [
  ['tilt', 'Step left / right', 'Neon Rails: switch rail lines with your whole body', '← →'],
  ['nod', 'Jump · crouch', 'Neon Rails: jump over barriers, crouch to slide under bars', '↑ · ↓'],
  ['twoPalms', 'Steering wheel', 'Nebula Rally: hold both hands up and turn them like a wheel', '← →'],
  ['palm', 'Air joystick', 'Sky Kingdom: hand right of centre runs right; flick up to jump', '← → · ↑'],
];
const GESTURES = [
  ['palm', 'Open palm', 'Scatter light, catch stars, supernova', 'H'],
  ['fist', 'Fist (hold)', 'A gravity well pulls light into your hand', 'F'],
  ['peace', 'Peace sign', 'Freeze time and take a snapshot', 'P'],
  ['thumbsUp', 'Thumbs up', 'Play again on the results screen', 'T'],
  ['smile', 'Smile', 'Golden bloom', '1'],
  ['mouth', 'Open mouth', 'Stardust breath · shields · music swell', '2'],
  ['tilt', 'Head tilt', 'Bend gravity · steer · catch stars', 'A / D'],
  ['nod', 'Nod / shake', 'Nod: a beat in Cosmic Orchestra · shake: back from results', 'Y / N'],
];

export class Help {
  constructor() { this.el = document.getElementById('help'); }

  render() {
    const cam = app.mode === 'camera';
    const basic = ([icon, title, how, mouse]) => `<div class="help-card">${ICONS[icon] || ''}<div><b>${title}</b><p>${cam ? how : mouse}</p></div></div>`;
    const gesture = ([icon, title, what, key]) => `<div class="help-card">${ICONS[icon] || ''}<div><b>${title}</b><p>${what}</p><kbd>${key}</kbd></div></div>`;
    this.el.innerHTML = `<div class="panel glass">
      <div class="panel-head">
        <h1>HOW TO PLAY<small>${cam ? 'Your hands and face are the controller. Mouse, keys and touch work too.' : 'You are playing with mouse, keys and touch. Turn the camera on from the dock to use gestures.'}</small></h1>
        <div class="orb-wrap"><div class="orb" data-k="close">✕</div><span>Close</span></div>
      </div>
      <div class="section-title">THE BASICS</div>
      <div class="help-grid four">${BASICS.map(basic).join('')}</div>
      <div class="section-title">VISION-STYLE CONTROLS</div>
      <div class="help-grid four">${VISION.map(gesture).join('')}</div>
      <div class="section-title">BODY MOVES · MOTION GAMES</div>
      <div class="help-grid four">${BODY.map(gesture).join('')}</div>
      <div class="section-title">EASY GESTURES · WITH THEIR KEYBOARD TWINS</div>
      <div class="help-grid">${GESTURES.map(gesture).join('')}</div>
      <div class="section-title">THE GAMES</div>
      <div class="help-games">${CATALOG.map((g) => `<div class="help-game"><i style="background:${g.accent}"></i><div><b>${g.name}</b><span class="tag">${g.tag}</span><p>${cam ? g.how : g.howMouse}</p><p class="alt">${cam ? 'Keys: ' + g.howMouse : 'With the camera: ' + g.how}</p></div></div>`).join('')}</div>
      <div class="section-title">TIPS</div>
      <ul class="help-tips">
        <li>Light your face from the front and stand about an arm's length from the camera.</li>
        <li>The pill at the top shows the gesture the camera sees right now, so you always know it understood you.</li>
        <li>Every game starts with a 3-second picture of its moves. Thumbs up (or a click) skips it.</li>
        <li>No gesture needs to be held for long, and nothing needs winking. If one feels awkward, use its key or a tap instead.</li>
        <li>Little ones: the rainbow <b>Kids Realm</b> button in the dock opens Wonderland, made for small hands.</li>
      </ul>
    </div>`;
    this.closeEl = this.el.querySelector('[data-k="close"]');
  }

  open() { this.render(); this.el.hidden = false; app.audio.swell(330, { vel: 0.4 }); }
  close() { this.el.hidden = true; }
  update() {
    const st = app.ui.targetEl('help-close', this.closeEl, { layer: 'help', tip: 'close' });
    if (st.selected) app.overlays.close();
  }
}
