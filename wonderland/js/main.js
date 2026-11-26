// ===========================================================================
// WONDERLAND PORTAL — bootstrap & 60 FPS loop
//
// Frame order
//   simulate: input → scene → particles → world → coach → hud
//   render:   sky → camera mirror → scenery → scene → particles
//             → scene UI (drawTop)
//   overlay:  scene overlay → hand cursors → coach → hud → transition
//             (a second, transparent canvas above the HTML Home page)
//
// Both canvases render at devicePixelRatio (capped at 2, adaptive).
// ===========================================================================
import { app } from './core/app.js';
import { settings } from './core/settings.js';
import { Scenes } from './core/scenes.js';
import { Input } from './input/input.js';
import { Sound } from './audio/sound.js';
import { Particles } from './fx/particles.js';
import { World } from './fx/world.js';
import { Coach } from './ui/coach.js';
import { Hud, sleepyCamera } from './ui/hud.js';
import { Cursors } from './ui/cursors.js';
import { ParentPanel } from './ui/parent.js';
import { icon } from './ui/icons.js';
import { GateMode } from './modes/gate.js';
import { HubMode } from './modes/hub.js';
import { PainterMode } from './modes/painter.js';
import { FireflyMode } from './modes/firefly.js';
import { GliderMode } from './modes/glider.js';
import { SymphonyMode } from './modes/symphony.js';
import { BoopMode } from './modes/boop.js';
import { BasketMode } from './modes/basket.js';
import { MonsterMode } from './modes/monster.js';

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d', { alpha: false });
// Cursors, picture coach, HUD and transitions draw on a transparent canvas above the HTML
// Home page, so a child always sees their sparkle cursor.
const overlay = $('overlay');
const octx = overlay.getContext('2d');
const video = $('cam');
let parent, mirrorAlpha = 0, lastCamState = 'off', last = 0;

// Adaptive resolution: if frames run long (>21 ms smoothed for 2.5 s) the
// canvas drops to a lower pixel ratio; it climbs back when there's headroom.
const DPR_STEPS = [2, 1.5, 1.1];
const gov = { step: 0, ema: 16.7, slow: 0, fast: 0, cool: 0 };
function govern(dtMs) {
  gov.ema += (Math.min(dtMs, 60) - gov.ema) * 0.05;
  gov.cool = Math.max(0, gov.cool - dtMs / 1000);
  if (gov.cool > 0 || document.hidden) return;
  if (gov.ema > 21) { gov.slow += dtMs / 1000; gov.fast = 0; } else if (gov.ema < 14) { gov.fast += dtMs / 1000; gov.slow = 0; } else gov.slow = gov.fast = 0;
  if (gov.slow > 2.5 && gov.step < DPR_STEPS.length - 1) { gov.step++; gov.slow = 0; gov.cool = 6; resize(); }
  else if (gov.fast > 8 && gov.step > 0) { gov.step--; gov.fast = 0; gov.cool = 6; resize(); }
}

function resize() {
  app.W = window.innerWidth; app.H = window.innerHeight;
  app.dpr = Math.min(window.devicePixelRatio || 1, DPR_STEPS[gov.step]);
  app.u = Math.max(0.55, Math.min(app.W, app.H) / 800);
  canvas.width = Math.round(app.W * app.dpr);
  canvas.height = Math.round(app.H * app.dpr);
  overlay.width = canvas.width; overlay.height = canvas.height;
}

/** Called once from the Gate's tap: unlock sound, wake the camera, enter the hub. */
app.begin = (from) => {
  app.started = true;
  app.sound.init();
  app.sound.setVolume(settings.data.volume);
  app.sound.setEnabled(settings.data.sound);
  if (settings.data.input === 'camera') app.input.startCamera();
  app.scenes.go('hub', from);
};

function boot() {
  settings.load();
  app.settings = settings;
  app.canvas = canvas; app.ctx = ctx;
  resize();

  app.sound = new Sound();
  app.input = new Input(canvas, video);
  app.particles = new Particles();
  app.world = new World();
  app.coach = new Coach();
  app.hud = new Hud();
  app.cursors = new Cursors();
  app.scenes = new Scenes();
  app.scenes.register('gate', new GateMode());
  app.scenes.register('hub', new HubMode());
  app.scenes.register('painter', new PainterMode());
  app.scenes.register('firefly', new FireflyMode());
  app.scenes.register('glider', new GliderMode());
  app.scenes.register('symphony', new SymphonyMode());
  app.scenes.register('boop', new BoopMode());
  app.scenes.register('basket', new BasketMode());
  app.scenes.register('monster', new MonsterMode());

  parent = new ParentPanel({ exitUrl: document.body.dataset.exitUrl || '' });
  app.parent = parent;

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) app.sound.ctx?.suspend?.();
    else if (app.started) app.sound.ctx?.resume?.();
  });
  window.wonderland = app; // handy from the devtools console

  app.scenes.go('gate', {}, true);
  document.body.classList.add('ready');
  last = performance.now();
  requestAnimationFrame(frame);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  app.dt = dt; app.t += dt; app.frame++;
  govern(dt * 1000);

  // ------------------------------------------------ simulate
  const inp = app.input;
  inp.update(dt, now);
  if (parent.isOpen) { inp.taps.length = 0; inp.events.length = 0; }
  if (inp.has('home') && !['gate', 'hub'].includes(app.scenes.name)) app.scenes.go('hub');

  const cs = inp.cam.state;
  if (cs !== lastCamState) {
    if (cs === 'error') app.hud.toast(sleepyCamera, 3.2), setTimeout(() => app.hud.toast(icon.pointHand, 2.6), 1200);
    if (cs === 'on') app.hud.toast(icon.openHand, 2);
    lastCamState = cs;
  }

  app.scenes.update(dt);
  app.cursors.update(dt);
  app.particles.update(dt);
  app.world.update(dt);
  app.coach.update(dt);
  app.hud.update(dt);

  // ------------------------------------------------ render
  const scene = app.scenes.current || {};
  const W = app.W, H = app.H;
  ctx.setTransform(app.dpr, 0, 0, app.dpr, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

  app.world.drawSky(ctx);
  const camLive = cs === 'on' || cs === 'mirror';
  const want = settings.data.mirror > 0.005 ? Math.max(settings.data.mirror, scene.mirrorMin || 0) : 0;
  mirrorAlpha += ((camLive ? want : 0) - mirrorAlpha) * (1 - Math.exp(-4 * dt));
  app.world.drawMirror(ctx, video, mirrorAlpha);
  app.world.drawScenery(ctx, scene.scenery || {});

  app.scenes.draw(ctx);
  app.particles.draw(ctx);
  ctx.setTransform(app.dpr, 0, 0, app.dpr, 0, 0);
  // soft vignette keeps the edges storybook-dark
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(8,4,24,0.45)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  app.scenes.drawTop(ctx);

  octx.setTransform(app.dpr, 0, 0, app.dpr, 0, 0);
  octx.clearRect(0, 0, W, H);
  scene.drawOverlay?.(octx);
  if (app.scenes.name !== 'gate') app.cursors.draw(octx);
  app.coach.draw(octx);
  app.hud.draw(octx);
  app.scenes.drawTransition(octx);
}

function fatal(err) {
  console.error(err);
  const b = $('boot');
  b.hidden = false;
  b.innerHTML = `<h1>The portal could not open</h1><p>${String(err && err.message || err).replace(/</g, '&lt;')}</p><p>Try a current Chrome, Edge, Firefox or Safari, served from <code>http://localhost</code> or <code>https://</code>.</p>`;
}

if (location.protocol !== 'file:') {
  const fontsReady = document.fonts ? Promise.race([document.fonts.load('700 40px Fredoka'), new Promise((r) => setTimeout(r, 1200))]) : Promise.resolve();
  fontsReady.catch(() => {}).then(() => { try { boot(); } catch (e) { fatal(e); } });
}
