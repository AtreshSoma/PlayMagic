// ===========================================================================
// AETHERIA · The Living Tapestry — bootstrap & main loop
//
// Frame order:
//   vision.tick → input.update (hands, face, mouse, gesture classifier)
//   → ui.begin → mood/audio → global feedback + gesture fx
//   → overlays → scene → particles/effects → widgets (dock, pill, snapshot)
//   → render: tapestry (WebGL) → mirror (video) → fx canvas (everything else)
//   → snapshot capture (same task as rendering)
// ===========================================================================
import { app } from './core/app.js';
import { store } from './core/store.js';
import { THEMES, THEME_ORDER, INTENSITIES, MIRROR_MODES } from './core/themes.js';
import { txt, rand } from './core/util.js';
import { Input } from './input/input.js';
import { Vision } from './input/vision.js';
import { Mood } from './input/mood.js';
import { AudioEngine } from './audio/audio.js';
import { Particles } from './fx/particles.js';
import { Effects } from './fx/effects.js';
import { Tapestry } from './fx/tapestry.js';
import { Mirror } from './fx/mirror.js';
import { Feedback } from './fx/feedback.js';
import { Starfield } from './fx/starfield.js';
import { UI } from './ui/ui.js';
import { Hud } from './ui/hud.js';
import { Reticle } from './ui/reticle.js';
import { Astrolabe } from './ui/astrolabe.js';
import { Grimoire } from './ui/grimoire.js';
import { Settings } from './ui/settings.js';
import { Hall } from './ui/hall.js';
import { SceneManager, OverlayManager } from './scenes/manager.js';
import { IntroScene } from './scenes/intro.js';
import { CalibrationScene } from './scenes/calibration.js';
import { InitiationScene } from './scenes/initiation.js';
import { HubScene } from './scenes/hub.js';
import { REGISTRY } from './games/registry.js';
import { GestureFx } from './fx/gesturefx.js';
import { BackButton } from './ui/back.js';
import { Dock } from './ui/dock.js';
import { GesturePill } from './ui/pill.js';
import { Snapshots } from './ui/snapshot.js';
import { Help } from './ui/help.js';

const $ = (id) => document.getElementById(id);
/** Route of the self-contained kids' portal (see wonderland/README.md). */
const KIDS_REALM_URL = 'wonderland/';
const fxCanvas = $('fx');
const fx = fxCanvas.getContext('2d');
// The pointer (hand / mouse cursor, hover light, tips) sits above the HTML layer so it is never hidden behind Home or a panel.
const ptrCanvas = $('pointer');
const ptrCtx = ptrCanvas.getContext('2d');
let feedback, gestureFx, starfield, intro, calibration, initiation, hall, snapshots;

function applyThemeCss() {
  const r = document.documentElement.style, th = app.theme;
  r.setProperty('--accent', th.accent);
  r.setProperty('--accent2', th.accent2);
  r.setProperty('--deep', th.shader[0]);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', th.shader[0]);
}

// ------------------------------------------------------------------ actions
const actions = {
  /** Called once from the intro's user gesture: starts audio, then the camera. */
  async awaken(useCamera) {
    app.audio.init();
    app.audio.setVolume(store.data.settings.volume);
    app.audio.setMuted(store.data.settings.muted);
    const days = store.touchStreak();
    if (!store.persistent) app.hud.toast('This window cannot remember progress (storage is blocked)', '☾', 4000);
    if (useCamera && await actions.startCamera((s) => intro.setStatus(s))) {
      app.hud.toast(days > 1 ? `The mirror is awake · ${days}-day streak` : 'The mirror is awake', '◉', 2600);
      actions.afterCalibration();
      return;
    }
    app.mode = 'fallback';
    app.dock.sync();
    actions.afterCalibration();
  },
  /** Opens the camera + vision models. Resolves true on success; on failure explains why and stays in mouse mode. */
  async startCamera(onStatus = () => {}) {
    if (actions.camBusy) return false;
    actions.camBusy = true;
    const vision = actions.visionCache || new Vision($('cam'));
    actions.visionCache = vision;
    try {
      await vision.start(onStatus);
      app.vision = vision; app.mode = 'camera'; app.mirror.active = true;
      return true;
    } catch (err) {
      console.warn('[Aetheria] vision unavailable:', err);
      vision.stop();
      app.hud.toast(err.message || 'The mirror could not open. Mouse and keys will carry your magic.', '☾', 7000);
      return false;
    } finally {
      actions.camBusy = false;
      app.dock.sync();
    }
  },
  /** Dock toggle: camera off → everything keeps working with mouse, keys and touch. */
  async toggleCamera() {
    if (app.mode === 'camera') {
      app.vision?.stop(); app.vision = null;
      app.mode = 'fallback'; app.mirror.active = false;
      app.hud.toast('Camera off · mouse, keys and touch still work', '◌', 2400);
    } else {
      app.hud.toast('Opening the camera…', '◉', 6000);
      if (await actions.startCamera((s) => app.hud.toast(s, '◉', 6000))) app.hud.toast('Camera on · hands and face are live', '◉', 2400);
    }
    app.dock.sync();
  },
  afterCalibration(then) { app.scenes.go(then || (store.data.initiated ? 'hub' : 'initiation')); },

  setTheme(key, quiet = false) {
    if (!THEMES[key]) return;
    app.themeKey = key; app.theme = THEMES[key];
    app.tapestry.setTheme(app.theme);
    store.setting('theme', key);
    applyThemeCss();
    if (quiet) return;
    app.hud.toast(app.theme.name, txt(app.theme.glyph));
    app.audio.whoosh(1);
    app.tapestry.ripple(app.W / 2, app.H / 2);
    for (let i = 0; i < 90; i++) app.particles.spawn(rand(app.W), app.H + 10, rand(-30, 30), rand(-500, -180), rand(1, 2.2), rand(1.5, 4), app.theme.particles[i % 4], app.theme.kind, 0.2, 0.975, 1);
  },
  cycleTheme(d) { const i = THEME_ORDER.indexOf(app.themeKey); actions.setTheme(THEME_ORDER[(i + d + THEME_ORDER.length) % THEME_ORDER.length]); },
  setIntensity(i) {
    app.intensity = INTENSITIES[i].mult;
    store.setting('intensity', i);
    app.hud.toast(`${INTENSITIES[i].label} intensity`, '✧');
  },
  cycleMirror() {
    const i = MIRROR_MODES.findIndex((m) => m.key === app.mirror.mode), m = MIRROR_MODES[(i + 1) % MIRROR_MODES.length];
    app.mirror.setMode(m.key);
    store.setting('mirror', m.key);
    app.hud.toast(m.label + (app.mode === 'camera' ? '' : ' · shows once the camera is on'), m.glyph);
    app.audio.whoosh(-1);
  },
  toggleMute() {
    app.audio.setMuted(!app.audio.muted);
    store.setting('muted', app.audio.muted);
    app.hud.toast(app.audio.muted ? 'Silence' : 'Sound restored', app.audio.muted ? '∅' : '♪', 1200);
    app.dock?.sync();
  },
  toggleGrimoire() { app.overlays.toggle('grimoire'); },
  toggleHall() { app.overlays.toggle('hall'); },
  toggleSettings() { app.overlays.toggle('settings'); },
  toggleHelp() { app.overlays.toggle('help'); },
  exportCard() { if (app.overlays.active !== 'hall') app.overlays.open('hall'); hall.exportCard(); },
  goHub() { app.overlays.close(); app.scenes.go('hub'); },
  /** Opens the Wonderland Portal (kids' realm). The camera is released first so the portal can open it. */
  enterKidsRealm() {
    if (actions.leaving) return;
    actions.leaving = true;
    app.audio.whoosh(1);
    app.vision?.stop();
    setTimeout(() => { location.href = KIDS_REALM_URL; }, 350);
  },
  startGame(id, x, y) {
    app.scenes.go(id, { fromX: x, fromY: y });
  },
  back() {
    if (app.overlays.active) return app.overlays.close();
    const n = app.scenes.name;
    if (n === 'intro') return;
    if (n === 'calibration') return calibration.finish(true);
    if (n === 'initiation') return initiation.skipAll();
    if (n !== 'hub') actions.goHub();
  },
};

// ------------------------------------------------------------------ adaptive quality
// Three levels trade sharpness and particle density for frame rate. In 'auto'
// the governor watches a smoothed frame time: sustained >21 ms steps down,
// sustained <14 ms steps back up (with a cool-down so it never oscillates).
const QUALITY = [
  { name: 'High', dpr: 1.75, tap: 1, fx: 1 },
  { name: 'Balanced', dpr: 1.4, tap: 0.75, fx: 0.72 },
  { name: 'Battery saver', dpr: 1.1, tap: 0.55, fx: 0.5 },
];
const governor = { level: 0, ema: 16.7, slowT: 0, fastT: 0, coolT: 0 };
function applyQuality(level, announce = false) {
  governor.level = level;
  const q = QUALITY[level];
  app.qualityScale = q.tap; app.fxScale = q.fx; app.qualityName = q.name;
  resize();
  if (announce) app.hud?.toast(`Visual quality: ${q.name}`, '◐', 1600);
}
function govern(dtMs) {
  const mode = store.data.settings.quality || 'auto';
  if (mode !== 'auto') return;
  governor.ema += (Math.min(dtMs, 60) - governor.ema) * 0.05;
  governor.coolT = Math.max(0, governor.coolT - dtMs / 1000);
  if (governor.coolT > 0 || document.hidden) return;
  if (governor.ema > 21) { governor.slowT += dtMs / 1000; governor.fastT = 0; } else if (governor.ema < 14) { governor.fastT += dtMs / 1000; governor.slowT = 0; } else { governor.slowT = governor.fastT = 0; }
  if (governor.slowT > 2.5 && governor.level < QUALITY.length - 1) { applyQuality(governor.level + 1); governor.slowT = 0; governor.coolT = 6; }
  else if (governor.fastT > 8 && governor.level > 0) { applyQuality(governor.level - 1); governor.fastT = 0; governor.coolT = 6; }
}
app.setQuality = (mode) => {
  store.setting('quality', mode);
  applyQuality(mode === 'high' ? 0 : mode === 'saver' ? 2 : governor.level, true);
};

// ------------------------------------------------------------------ setup
function resize() {
  app.W = window.innerWidth; app.H = window.innerHeight;
  app.dpr = Math.min(window.devicePixelRatio || 1, QUALITY[governor.level].dpr);
  fxCanvas.width = Math.round(app.W * app.dpr); fxCanvas.height = Math.round(app.H * app.dpr);
  ptrCanvas.width = fxCanvas.width; ptrCanvas.height = fxCanvas.height;
  app.tapestry.resize(app.W, app.H);
  app.mirror.resize(app.W, app.H);
}

function boot() {
  store.load();
  app.store = store;
  const s = store.data.settings;
  app.themeKey = THEMES[s.theme] ? s.theme : 'astral';
  app.theme = THEMES[app.themeKey];
  app.intensity = INTENSITIES[s.intensity]?.mult ?? 1;

  app.input = new Input();
  app.ui = new UI();
  app.audio = new AudioEngine();
  app.audio.volume = s.volume; app.audio.muted = s.muted;
  app.particles = new Particles();
  app.fx = new Effects();
  app.tapestry = new Tapestry($('tapestry'));
  app.tapestry.setTheme(app.theme, true);
  app.mirror = new Mirror($('cam'), $('mirror'));
  app.mirror.setMode(MIRROR_MODES.some((m) => m.key === s.mirror) ? s.mirror : 'ethereal');
  app.mood = new Mood();
  app.hud = new Hud();
  app.reticle = new Reticle();
  app.astrolabe = new Astrolabe();
  app.actions = actions;
  feedback = new Feedback();
  gestureFx = new GestureFx();
  starfield = new Starfield();
  app.dock = new Dock();
  app.back = new BackButton();
  app.pill = new GesturePill();
  snapshots = new Snapshots();

  app.overlays = new OverlayManager();
  hall = new Hall();
  app.overlays.register('grimoire', new Grimoire());
  app.overlays.register('hall', hall);
  app.overlays.register('settings', new Settings());
  app.overlays.register('help', new Help());

  app.scenes = new SceneManager();
  intro = new IntroScene(); calibration = new CalibrationScene(); initiation = new InitiationScene();
  app.scenes.register('intro', intro);
  app.scenes.register('calibration', calibration);
  app.scenes.register('initiation', initiation);
  app.scenes.register('hub', new HubScene());
  for (const g of REGISTRY) app.scenes.register(g.id, g.create());

  window.aetheria = app; // handy for debugging from the devtools console
  applyThemeCss();
  const qm = s.quality || 'auto';
  applyQuality(qm === 'saver' ? 2 : 0);
  window.addEventListener('resize', resize);
  app.scenes.go('intro', {}, { instant: true });
  last = performance.now();
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ loop
let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  app.dt = dt; app.t += dt; app.frame++;
  govern(dt * 1000);

  // --- simulate
  app.vision?.tick(now);
  app.input.update(dt, app.t);
  app.ui.begin(dt);
  app.mood.update(dt, app.t, app.input.vals, app.input.motion);
  if (app.mood.changed) app.audio.setMood(app.mood.dominant);
  app.audio.update(dt);
  feedback.update(dt);
  gestureFx.update(dt);
  app.overlays.update(dt);
  app.scenes.update(dt);
  app.particles.update(dt * app.timeScale);
  app.fx.update(dt);
  app.reticle.update(dt);
  app.astrolabe.update(dt);
  app.hud.update(dt);
  app.dock.update(dt);
  app.back.update(dt);
  app.pill.update(dt);
  snapshots.update(dt);

  // --- render
  const inp = app.input, W = app.W, H = app.H;
  const ptr = inp.cursor.active ? inp.cursor : inp.gaze.valid ? inp.gaze : { x: W / 2, y: H / 2 };
  app.tapestry.render(dt, {
    flow: app.mood.flow * (1 + app.bloom * 0.7),
    bright: app.mood.bright * (1 + app.brightBoost * 0.55),
    mood: app.mood.color, ptrX: ptr.x, ptrY: ptr.y, bloom: app.bloom, zoom: app.zoom,
  });
  app.mirror.render(dt);

  fx.setTransform(app.dpr, 0, 0, app.dpr, 0, 0);
  fx.clearRect(0, 0, W, H);
  fx.save();
  if (app.fx.shake > 0) fx.translate(rand(-1, 1) * app.fx.shake * 9, rand(-1, 1) * app.fx.shake * 9);
  starfield.draw(fx, app.scenes.name === 'hub');
  app.mirror.drawAura(fx);
  app.scenes.drawBack(fx);
  app.particles.draw(fx);
  app.fx.draw(fx);
  gestureFx.draw(fx);
  app.mirror.drawHands(fx, inp.hands);
  app.scenes.drawFront(fx);
  fx.restore();
  app.fx.drawFlash(fx);
  app.overlays.draw(fx);
  app.scenes.drawTransition(fx);
  ptrCtx.setTransform(app.dpr, 0, 0, app.dpr, 0, 0);
  ptrCtx.clearRect(0, 0, W, H);
  app.reticle.draw(ptrCtx);

  if (app.snapshotPending) { app.snapshotPending = false; snapshots.capture(); }
}

// ------------------------------------------------------------------ start
function fatal(err) {
  console.error(err);
  const b = $('boot');
  b.hidden = false;
  b.innerHTML = `<h1>The tapestry could not be woven</h1><p>${String(err && err.message || err)}</p><p>Try a current Chrome, Edge, Firefox or Safari, served from <code>http://localhost</code>.</p>`;
}

if (location.protocol !== 'file:') {
  // Wait briefly for the UI faces (and the script face used for the creator signature); system fonts stand in if slow.
  const fontsReady = document.fonts
    ? Promise.race([Promise.all([document.fonts.ready, document.fonts.load('48px "Great Vibes"').catch(() => {})]), new Promise((r) => setTimeout(r, 1500))])
    : Promise.resolve();
  fontsReady.then(() => { try { boot(); } catch (e) { fatal(e); } });
}
