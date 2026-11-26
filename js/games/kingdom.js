// ---------------------------------------------------------------------------
// SKY KINGDOM · gesture-only side-scrolling platformer
// Guide Lumo across floating sky islands to the rainbow gate at the end of
// each world. Stomp grumpy Grumbles, bump glowing crystal blocks for star
// coins, Star Seeds (grow big: survive one extra bump) and Spark Wands
// (throw magic sparks), ride cloud platforms and leap the gaps. Lumo has a
// magic double jump, so gaps are friendly. Each world gets longer and wilder.
//
// Controls (no buttons needed):
//   camera  your hand is an air joystick: move it right of centre to run
//           right, left to run left, middle to stop (an on-screen ring shows
//           it). Flick it upward (or pinch, or nod) to jump; flick again in
//           the air to double jump. Peace sign throws a spark.
//   keys    ← → (A / D) run · ↑ / W / Space jump · P spark
//   mouse   hold the button on either side of Lumo to run that way · click jumps
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { GameBase, HUD_SUB_Y } from './base.js';
import { drawLumo } from './lumo.js';
import { glowText, roundRect } from '../ui/draw.js';
import { TAU, rand, pick, clamp, rgba, approach } from '../core/util.js';

const ROWS = 14;
const AIR = 0, GROUND = 1, BRICK = 2, CRYSTAL = 3, USED = 4, TOWER = 5, CLOUD = 6;
const SOLID = new Set([GROUND, BRICK, CRYSTAL, USED, TOWER, CLOUD]);
const GRAV = 40, JUMP = 15.2, JUMP2 = 13, RUN = 7.2, ACCEL = 32, FRICTION = 26;

// ------------------------------------------------------------------ level generation
function generate(level) {
  const Wt = 150 + level * 35, grid = new Uint8Array(Wt * ROWS), coins = [], enemies = [], movers = [];
  const set = (x, y, v) => { if (x >= 0 && x < Wt && y >= 0 && y < ROWS) grid[y * Wt + x] = v; };
  const column = (x, top) => { for (let y = top; y < ROWS; y++) set(x, y, GROUND); };
  let x = 0, g = 11;
  for (; x < 10; x++) column(x, g);
  const arc = (x0, y0, n) => { for (let i = 0; i < n; i++) coins.push({ x: x0 + i + 0.5, y: y0 - Math.sin((i / Math.max(1, n - 1)) * Math.PI) * 1.6 + 0.5 }); };
  const kinds = ['flat', 'gap', 'step', 'blocks', 'tower', 'clouds', 'foes', 'foes', 'blocks'];
  while (x < Wt - 16) {
    const k = pick(kinds), hard = Math.min(level, 4);
    if (k === 'flat') { const n = 4 + (rand() * 4 | 0); for (let i = 0; i < n; i++) column(x + i, g); if (rand() < 0.6) arc(x + 1, g - 2, Math.min(4, n - 1)); x += n; }
    else if (k === 'gap') { const n = 2 + (rand() * (1 + hard * 0.6) | 0); arc(x - 1, g - 2, n + 2); x += n; for (let i = 0; i < 3; i++) column(x + i, g); x += 3; }
    else if (k === 'step') { const up = rand() < 0.5 || g > 10 ? -1 - (rand() * 2 | 0) : 1; g = clamp(g + up, 8, 12); const n = 4 + (rand() * 3 | 0); for (let i = 0; i < n; i++) column(x + i, g); x += n; }
    else if (k === 'blocks') {
      for (let i = 0; i < 7; i++) column(x + i, g);
      const by = g - 4;
      [BRICK, CRYSTAL, BRICK, CRYSTAL, BRICK].forEach((v, i) => set(x + 1 + i, by, v));
      if (rand() < 0.5) set(x + 3, by - 4, CRYSTAL);
      if (rand() < 0.5 + hard * 0.1) enemies.push({ type: 'grumble', x: x + 5.5, y: g - 0.5 });
      x += 7;
    } else if (k === 'tower') { for (let i = 0; i < 6; i++) column(x + i, g); const h = 2 + (rand() * 2 | 0); for (let y = g - h; y < g; y++) set(x + 3, y, TOWER); coins.push({ x: x + 3.5, y: g - h - 1.5 }); x += 6; }
    else if (k === 'clouds') {
      const n = 5 + (rand() * 3 | 0);
      for (let c = 0; c < Math.ceil(n / 3); c++) {
        const cx = x + c * 3, cy = g - 2 - (c % 2) * 2;
        if (rand() < 0.35 && level > 0) movers.push({ x: cx, y: cy, w: 3, x0: cx, range: 2, t: rand(TAU) });
        else for (let i = 0; i < 2; i++) set(cx + i, cy, CLOUD);
        coins.push({ x: cx + 1, y: cy - 1 });
      }
      x += n; for (let i = 0; i < 3; i++) column(x + i, g); x += 3;
    } else { // foes
      const n = 8; for (let i = 0; i < n; i++) column(x + i, g);
      enemies.push({ type: 'grumble', x: x + 3.5, y: g - 0.5 });
      if (level >= 1 && rand() < 0.6) enemies.push({ type: level >= 2 && rand() < 0.5 ? 'spiky' : 'grumble', x: x + 6, y: g - 0.5 });
      x += n;
    }
  }
  for (; x < Wt; x++) column(x, 11);
  return { Wt, grid, coins: coins.map((c) => ({ ...c, got: false })), enemies, movers, goal: Wt - 7 };
}

// ------------------------------------------------------------------ tile art (pre-rendered per tile size)
const tileArt = new Map();
function tileSprite(type, T, top) {
  const key = `${type}|${top ? 1 : 0}|${T | 0}|${app.dpr}`;
  let c = tileArt.get(key);
  if (c) return c;
  const d = app.dpr || 1; c = document.createElement('canvas');
  c.width = c.height = Math.ceil(T * d) + 2;
  const x = c.getContext('2d'); x.scale(d, d);
  if (type === GROUND) {
    const g = x.createLinearGradient(0, 0, 0, T); g.addColorStop(0, '#5a3d8a'); g.addColorStop(1, '#2a1a4e');
    x.fillStyle = g; x.fillRect(0, 0, T, T);
    x.strokeStyle = 'rgba(160,255,230,0.25)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(T * 0.2, T * 0.4); x.lineTo(T * 0.35, T * 0.7); x.lineTo(T * 0.3, T); x.stroke();
    if (top) {
      const gr = x.createLinearGradient(0, 0, 0, T * 0.35); gr.addColorStop(0, '#9dffcf'); gr.addColorStop(1, '#2fae94');
      x.fillStyle = gr; x.beginPath(); x.moveTo(0, 0); x.lineTo(T, 0); x.lineTo(T, T * 0.28);
      for (let i = 4; i >= 0; i--) x.lineTo((i / 4) * T, T * (0.28 + (i % 2) * 0.1));
      x.closePath(); x.fill();
    }
  } else if (type === BRICK) {
    x.fillStyle = '#b06bd9'; x.fillRect(0, 0, T, T);
    x.strokeStyle = '#6a2f8f'; x.lineWidth = 2;
    x.strokeRect(1, 1, T - 2, T - 2); x.beginPath(); x.moveTo(0, T / 2); x.lineTo(T, T / 2); x.moveTo(T / 2, 0); x.lineTo(T / 2, T / 2); x.moveTo(T / 4, T / 2); x.lineTo(T / 4, T); x.moveTo(T * 0.75, T / 2); x.lineTo(T * 0.75, T); x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(3, 3, T - 6, 3);
  } else if (type === CRYSTAL || type === USED) {
    const used = type === USED;
    roundRect(x, 1, 1, T - 2, T - 2, T * 0.18);
    const g = x.createLinearGradient(0, 0, T, T); g.addColorStop(0, used ? '#6a6488' : '#fff3a0'); g.addColorStop(1, used ? '#3a3458' : '#f2a91a');
    x.fillStyle = g; x.fill(); x.strokeStyle = used ? '#2a2440' : '#fff'; x.lineWidth = 2; x.stroke();
    if (!used) {
      x.fillStyle = '#ffffff';
      x.beginPath();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2, r = i % 2 ? T * 0.13 : T * 0.3; i ? x.lineTo(T / 2 + Math.cos(a) * r, T / 2 + Math.sin(a) * r) : x.moveTo(T / 2 + Math.cos(a) * r, T / 2 + Math.sin(a) * r); }
      x.closePath(); x.fill();
    }
  } else if (type === TOWER) {
    const g = x.createLinearGradient(0, 0, T, 0); g.addColorStop(0, '#7ff3ff'); g.addColorStop(0.5, '#d9fbff'); g.addColorStop(1, '#3aa8c8');
    x.fillStyle = g; x.fillRect(T * 0.1, 0, T * 0.8, T);
    x.strokeStyle = 'rgba(255,255,255,0.7)'; x.lineWidth = 1.5; x.strokeRect(T * 0.1, 0, T * 0.8, T);
    if (top) { x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(0, T * 0.25); x.lineTo(T / 2, -1); x.lineTo(T, T * 0.25); x.closePath(); x.fill(); }
  } else if (type === CLOUD) {
    x.fillStyle = '#f4f0ff';
    for (const [cx, cy, r] of [[0.2, 0.55, 0.32], [0.5, 0.4, 0.38], [0.8, 0.55, 0.32]]) { x.beginPath(); x.arc(cx * T, cy * T, r * T, 0, TAU); x.fill(); }
    x.fillRect(T * 0.1, T * 0.5, T * 0.8, T * 0.35);
    x.fillStyle = 'rgba(180,160,255,0.35)'; x.fillRect(T * 0.05, T * 0.78, T * 0.9, T * 0.1);
  }
  tileArt.set(key, c);
  if (tileArt.size > 60) tileArt.delete(tileArt.keys().next().value);
  return c;
}

export class KingdomGame extends GameBase {
  constructor() {
    super('kingdom', 'Sky Kingdom');
    this.duration = Infinity; this.maxLives = 3;
    this.allow = { swipe: false, runes: false, faceMagic: false, chimes: false, overlays: true, scatter: false, snapshot: false, gravity: false, puff: false, tilt: false, barrier: false, doubleBlink: false };
    this.cues = [{ cue: 'steer', key: '← →' }, { cue: 'flick', key: '↑ / Space' }, { cue: 'peace', key: 'P' }];
  }

  playCoach() {
    return app.mode === 'camera'
      ? { icon: 'palm', html: '<b>Hand right</b> = run right · <b>flick up</b> = jump<small>Flick again in the air to double jump · ✌ throws a spark when you have the wand</small>' }
      : { icon: 'swipe', html: '<b>← →</b> run · <b>↑</b> or <b>Space</b> jump (twice for a double jump)<small>P throws a spark when you have the wand</small>' };
  }

  reset() { this.level = 0; this.coinsGot = 0; this.startLevel(); }

  startLevel() {
    this.L = generate(this.level);
    this.enemies = this.L.enemies.map((e) => ({ ...e, vx: -1.6, dead: 0, w: 0.8, h: 0.8 }));
    this.items = []; this.sparks = []; this.pops = [];
    this.p = { x: 3, y: 9.5, vx: 0, vy: 0, w: 0.72, h: 0.85, ground: false, jumps: 0, dir: 1, big: false, wand: false, inv: 0, sq: 1, coyote: 0, buffer: 0 };
    this.safe = { x: 3, y: 9.5 };
    this.camX = 0; this.levelTime = 150; this.phase = 'run'; this.phaseT = 0; this.flickCool = 0; this.sparkCool = 0; this.dir = 0;
  }

  get T() { return app.H / 13.4; }
  tile(x, y) { const L = this.L; if (x < 0 || x >= L.Wt) return GROUND; if (y < 0) return AIR; if (y >= ROWS) return AIR; return L.grid[y * L.Wt + x]; }
  solidAt(x, y) { return SOLID.has(this.tile(Math.floor(x), Math.floor(y))); }

  // ------------------------------------------------------------------ input
  readInput(dt) {
    const inp = app.input, fb = inp.fb, W = app.W;
    let dir = 0, jump = false, spark = false;
    const cam = inp.hands.find((h) => h.present);
    if (cam) {
      const dx = (cam.palmX - W / 2) / (W * 0.22);
      dir = Math.abs(dx) < 0.18 ? 0 : Math.sign(dx) * Math.min(1, (Math.abs(dx) - 0.18) / 0.55);
      this.flickCool -= dt;
      if (cam.vy < -950 && this.flickCool <= 0) { jump = true; this.flickCool = 0.28; }
    }
    if (!dir) {
      const kd = (fb.held('ArrowRight') || fb.held('KeyD') ? 1 : 0) - (fb.held('ArrowLeft') || fb.held('KeyA') ? 1 : 0);
      if (kd) dir = kd;
      else if (fb.down && inp.mouseHand.present) { const px = this.p.x * this.T - this.camX; dir = Math.abs(inp.mouseHand.x - px) > 40 ? Math.sign(inp.mouseHand.x - px) : 0; }
      else if (!cam && inp.face.present && Math.abs(inp.vals.tilt) > 0.2) dir = Math.sign(inp.vals.tilt);
    }
    for (const e of inp.events) {
      if (e.type === 'pinchStart' || e.type === 'nod' || (e.type === 'swipe' && e.dir === 'up') || (e.type === 'blink' && e.key)) jump = true;
      if (e.type === 'peace') spark = true;
    }
    this.camHand = cam ? clamp((cam.palmX - W / 2) / (W * 0.22), -1.3, 1.3) : null;
    this.dir = dir;
    return { dir, jump, spark };
  }

  // ------------------------------------------------------------------ physics
  moveBody(b, dt, isPlayer) {
    // X
    b.x += b.vx * dt;
    const top = b.y - b.h, bot = b.y - 0.02;
    if (b.vx > 0) { const fx = b.x + b.w / 2; if (this.solidAt(fx, top + 0.05) || this.solidAt(fx, bot)) { b.x = Math.floor(fx) - b.w / 2 - 0.001; b.vx = isPlayer ? 0 : -b.vx; b.hitWall = true; } }
    else if (b.vx < 0) { const fx = b.x - b.w / 2; if (this.solidAt(fx, top + 0.05) || this.solidAt(fx, bot)) { b.x = Math.floor(fx) + 1 + b.w / 2 + 0.001; b.vx = isPlayer ? 0 : -b.vx; b.hitWall = true; } }
    // Y
    b.vy += GRAV * dt; b.vy = Math.min(b.vy, 22);
    b.y += b.vy * dt;
    const l = b.x - b.w / 2 + 0.04, r = b.x + b.w / 2 - 0.04;
    b.ground = false;
    if (b.vy > 0) {
      if (this.solidAt(l, b.y) || this.solidAt(r, b.y)) { b.y = Math.floor(b.y); b.vy = 0; b.ground = true; }
    } else if (b.vy < 0) {
      const hy = b.y - b.h;
      for (const sx of [l, r, b.x]) {
        if (this.solidAt(sx, hy)) {
          b.y = Math.floor(hy) + 1 + b.h; b.vy = 0;
          if (isPlayer) this.bump(Math.floor(b.x), Math.floor(hy));
          break;
        }
      }
    }
    // moving clouds
    for (const m of this.L.movers) {
      const mx = m.x, my = m.y;
      if (b.vy >= 0 && b.x > mx - 0.1 && b.x < mx + m.w + 0.1 && b.y >= my && b.y - b.vy * dt <= my + 0.15) { b.y = my; b.vy = 0; b.ground = true; b.x += m.dx || 0; }
    }
  }

  bump(tx, ty) {
    const v = this.tile(tx, ty);
    app.audio.thump(0.4);
    if (v !== CRYSTAL) return;
    this.L.grid[ty * this.L.Wt + tx] = USED;
    this.pops.push({ x: tx, y: ty, t: 0 });
    const roll = Math.random();
    if (roll < 0.62) { this.addCoin(tx + 0.5, ty - 0.6); this.items.push({ type: 'coinfx', x: tx + 0.5, y: ty, vy: -9, t: 0 }); }
    else this.items.push({ type: this.p.big ? 'wand' : 'seed', x: tx + 0.5, y: ty - 0.1, rise: 0, t: 0 });
    for (const e of this.enemies) if (!e.dead && Math.abs(e.x - (tx + 0.5)) < 0.8 && Math.abs(e.y - ty) < 0.6) this.killEnemy(e, true);
  }

  addCoin(x, y) {
    this.coinsGot++; this.score += 10;
    app.audio.chime(1318 + (this.coinsGot % 5) * 80, { vel: 0.25, bright: 1, dur: 0.8 });
    const T = this.T;
    app.particles.emit({ x: x * T - this.camX, y: y * T, count: 8, speed: [40, 160], life: [0.3, 0.6], colors: ['#ffe27a', '#ffffff'], raw: true });
  }

  killEnemy(e, byBump = false) {
    e.dead = 0.001; this.score += 100; this.hit();
    const T = this.T, sx = e.x * T - this.camX, sy = (e.y - e.h / 2) * T;
    app.audio.shatter((sx / app.W) * 2 - 1, 0.3);
    app.audio.boom(0.25, (sx / app.W) * 2 - 1);
    app.particles.emit({ x: sx, y: sy, count: 30, speed: [80, 320], life: [0.4, 0.9], colors: e.type === 'spiky' ? ['#ffb46b', '#fff'] : ['#b48cff', '#ffffff', '#ffe27a'], raw: true });
    app.fx.text(sx, sy - 30, byBump ? 'Bonk! +100' : 'Stomp! +100', { color: '#ffe27a', size: 16, font: 'Inter', weight: 700 });
  }

  hurt() {
    const p = this.p;
    if (p.inv > 0 || this.phase !== 'run') return;
    if (p.big) { p.big = false; p.wand = false; p.h = 0.85; p.inv = 1.6; app.audio.miss(); app.fx.flash('#ff7ad9', 0.25); return; }
    this.loseLife(p.x * this.T - this.camX, (p.y - 1.5) * this.T);
    if (this.lives > 0) { p.x = this.safe.x; p.y = this.safe.y; p.vx = p.vy = 0; p.inv = 2; }
  }

  play(dt) {
    const p = this.p, L = this.L, T = this.T;
    if (this.phase === 'clear') {
      this.phaseT += dt;
      if (Math.random() < 0.3) app.particles.emit({ x: rand(app.W), y: rand(app.H * 0.5), count: 30, speed: [100, 340], colors: ['#ff7ad9', '#ffe27a', '#7ff3ff', '#9dff9a'], raw: true });
      p.vx = approach(p.vx, 3, dt, 0.3); p.x += p.vx * dt;
      if (this.phaseT > 3) { this.level++; this.startLevel(); }
      return;
    }
    this.levelTime -= dt;
    if (this.levelTime <= 0) { this.levelTime = 60; this.hurt(); p.big = false; }

    const { dir, jump, spark } = this.readInput(dt);
    // run
    if (dir) { p.vx = approach(p.vx, dir * RUN, dt, 1 / ACCEL * 4); p.dir = Math.sign(dir); }
    else p.vx = Math.abs(p.vx) < 0.2 ? 0 : p.vx - Math.sign(p.vx) * FRICTION * dt;
    // jump with coyote time + buffer + magic double jump
    p.coyote = p.ground ? 0.1 : Math.max(0, p.coyote - dt);
    p.buffer = jump ? 0.15 : Math.max(0, p.buffer - dt);
    if (p.buffer > 0) {
      if (p.coyote > 0) { p.vy = -JUMP; p.jumps = 1; p.buffer = 0; p.coyote = 0; p.sq = 0.7; app.audio.whoosh(1); }
      else if (p.jumps < 2) {
        p.vy = -JUMP2; p.jumps = 2; p.buffer = 0; p.sq = 0.7; app.audio.chime(988, { vel: 0.3, bright: 1, dur: 0.6 });
        app.particles.emit({ x: p.x * T - this.camX, y: p.y * T, count: 16, speed: [60, 200], colors: ['#7ff3ff', '#ffffff'], raw: true });
      }
    }
    if (spark && p.wand && this.sparkCool <= 0 && this.sparks.length < 3) { this.sparks.push({ x: p.x + p.dir * 0.5, y: p.y - p.h / 2, vx: p.dir * 12, vy: -3, t: 0 }); this.sparkCool = 0.3; app.audio.pluck(1046, { vel: 0.4, dur: 0.4, bright: 1 }); }
    this.sparkCool -= dt;

    // moving clouds
    for (const m of L.movers) { m.t += dt; const nx = m.x0 + Math.sin(m.t * 0.9) * m.range; m.dx = nx - m.x; m.x = nx; }

    const wasGround = p.ground;
    this.moveBody(p, dt, true);
    if (p.ground) { p.jumps = 0; if (!wasGround) p.sq = 1.25; }
    p.sq = approach(p.sq, 1, dt, 0.08);
    p.inv = Math.max(0, p.inv - dt);
    p.x = Math.max(0.5, p.x);
    // remember a safe spot to respawn: solid ground under both feet, away from edges
    if (p.ground && this.solidAt(p.x - 0.6, p.y + 0.1) && this.solidAt(p.x + 0.6, p.y + 0.1)) { this.safe.x = p.x; this.safe.y = p.y; }
    if (p.y > ROWS + 1) { p.big = false; p.h = 0.85; p.inv = 0; this.hurt(); }

    // coins
    for (const c of L.coins) if (!c.got && Math.abs(c.x - p.x) < 0.6 && Math.abs(c.y - (p.y - p.h / 2)) < 0.7 + p.h / 2) { c.got = true; this.addCoin(c.x, c.y); }
    // items
    for (const it of this.items) {
      it.t += dt;
      if (it.type === 'coinfx') { it.vy += 30 * dt; it.y += it.vy * dt; if (it.t > 0.5) it.dead = true; continue; }
      if (it.rise < 1) { it.rise += dt * 2; it.y -= dt * 2; }
      if (Math.abs(it.x - p.x) < 0.8 && Math.abs(it.y - (p.y - p.h / 2)) < 0.9) {
        it.dead = true; this.score += 200; app.audio.victory();
        if (it.type === 'seed') { p.big = true; p.h = 1.4; app.fx.text(app.W / 2, app.H * 0.3, 'Star Seed! You grew big', { color: '#9dff9a', size: 22 }); }
        else { p.wand = true; p.big = true; p.h = 1.4; app.fx.text(app.W / 2, app.H * 0.3, 'Spark Wand! ✌ to throw sparks', { color: '#ffe27a', size: 22 }); }
      }
    }
    this.items = this.items.filter((i) => !i.dead);
    // enemies
    for (const e of this.enemies) {
      if (e.dead) { e.dead += dt; continue; }
      if (Math.abs(e.x - p.x) > 26) continue; // sleep far away
      e.hitWall = false;
      this.moveBody(e, dt, false);
      // turn at ledges
      if (e.ground && !this.solidAt(e.x + Math.sign(e.vx) * 0.5, e.y + 0.2)) e.vx = -e.vx;
      if (e.y > ROWS + 1) e.dead = 1;
      // vs player
      if (Math.abs(e.x - p.x) < (e.w + p.w) / 2 && Math.abs((e.y - e.h / 2) - (p.y - p.h / 2)) < (e.h + p.h) / 2) {
        const stomp = p.vy > 2 && p.y - e.y < -e.h * 0.35;
        if (stomp && e.type !== 'spiky') { this.killEnemy(e); p.vy = -11; p.jumps = 1; }
        else this.hurt();
      }
    }
    this.enemies = this.enemies.filter((e) => !(e.dead > 0.6));
    // sparks
    for (const s of this.sparks) {
      s.t += dt; s.vy += GRAV * 0.6 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (this.solidAt(s.x, s.y)) { if (s.vy > 0) { s.y = Math.floor(s.y) - 0.01; s.vy = -7; } else s.dead = true; }
      if (this.solidAt(s.x + Math.sign(s.vx) * 0.2, s.y - 0.2)) s.dead = true;
      for (const e of this.enemies) if (!e.dead && Math.abs(e.x - s.x) < 0.6 && Math.abs(e.y - e.h / 2 - s.y) < 0.6) { this.killEnemy(e); s.dead = true; }
      if (s.t > 2.2) s.dead = true;
    }
    this.sparks = this.sparks.filter((s) => !s.dead);
    for (const pp of this.pops) pp.t += dt;
    this.pops = this.pops.filter((pp) => pp.t < 0.25);

    // goal
    if (p.x >= L.goal) {
      this.phase = 'clear'; this.phaseT = 0;
      const bonus = Math.ceil(this.levelTime) * 5 + 500;
      this.score += bonus; this.hit();
      app.audio.victory(); app.fx.flash('#ffe27a', 0.35);
      app.fx.text(app.W / 2, app.H * 0.32, `WORLD ${this.level + 1} CLEAR!`, { color: '#ffe27a', size: 40, dur: 2.5 });
      app.fx.text(app.W / 2, app.H * 0.32 + 44, `+${bonus} time bonus`, { color: '#ffffff', size: 18, font: 'Inter', dur: 2.5 });
    }
    // camera follows with look-ahead
    const target = clamp(p.x * T - app.W * (0.4 - p.dir * 0.06), 0, L.Wt * T - app.W);
    this.camX = approach(this.camX, target, dt, 0.18);
  }

  resultTitle() { return `REACHED WORLD ${this.level + 1} · ${this.coinsGot} COINS`; }

  // ------------------------------------------------------------------ draw
  drawBackdrop(ctx) {
    const W = app.W, H = app.H, t = app.t, cx = this.camX;
    // soft sky tint so platforms read clearly over the tapestry
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(40, 30, 110, 0.35)'); g.addColorStop(1, 'rgba(255, 140, 200, 0.18)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // big friendly moon
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const mx = W * 0.78 - cx * 0.03, my = H * 0.2;
    ctx.globalAlpha = 0.5; ctx.drawImage(app.particles.spriteCanvas('#fff3c4'), mx - 160, my - 160, 320, 320); ctx.restore();
    ctx.fillStyle = '#fff6dc'; ctx.beginPath(); ctx.arc(mx, my, 46, 0, TAU); ctx.fill();
    // far mountains (parallax 0.15) and floating castles (0.35)
    ctx.fillStyle = 'rgba(70, 50, 140, 0.6)';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 40; x += 40) { const wx = x + cx * 0.15; ctx.lineTo(x, H * 0.62 - Math.abs(Math.sin(wx * 0.004)) * H * 0.2 - Math.sin(wx * 0.011) * 20); }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    for (let k = 0; k < 4; k++) {
      const base = k * 900, x = ((base - cx * 0.35) % (W + 600) + W + 600) % (W + 600) - 300, y = H * (0.28 + (k % 2) * 0.1) + Math.sin(t + k) * 6;
      ctx.fillStyle = 'rgba(200, 180, 255, 0.35)';
      ctx.beginPath(); ctx.ellipse(x, y + 24, 90, 22, 0, 0, TAU); ctx.fill();
      ctx.fillRect(x - 40, y - 30, 80, 50); ctx.fillRect(x - 55, y - 55, 22, 75); ctx.fillRect(x + 33, y - 55, 22, 75);
      ctx.beginPath(); ctx.moveTo(x - 60, y - 55); ctx.lineTo(x - 44, y - 82); ctx.lineTo(x - 28, y - 55); ctx.moveTo(x + 28, y - 55); ctx.lineTo(x + 44, y - 82); ctx.lineTo(x + 60, y - 55); ctx.fill();
    }
  }

  drawBack(ctx) {
    if (this.state === 'intro' || !this.L) return;
    const T = this.T, L = this.L, cx = this.camX, W = app.W, t = app.t;
    this.drawBackdrop(ctx);
    const c0 = Math.max(0, Math.floor(cx / T) - 1), c1 = Math.min(L.Wt - 1, Math.ceil((cx + W) / T) + 1);
    for (let y = 0; y < ROWS; y++) for (let x = c0; x <= c1; x++) {
      const v = L.grid[y * L.Wt + x];
      if (!v) continue;
      const above = y > 0 ? L.grid[(y - 1) * L.Wt + x] : AIR;
      const pop = this.pops.find((pp) => pp.x === x && pp.y === y), lift = pop ? Math.sin((pop.t / 0.25) * Math.PI) * T * 0.25 : 0;
      ctx.drawImage(tileSprite(v, T, !SOLID.has(above) || above === CLOUD), x * T - cx, y * T - lift, T + 1, T + 1);
      if (v === CRYSTAL) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 4 + x); ctx.drawImage(app.particles.spriteCanvas('#ffe27a'), x * T - cx - T * 0.4, y * T - T * 0.4 - lift, T * 1.8, T * 1.8); ctx.restore(); }
    }
    for (const m of L.movers) for (let i = 0; i < m.w; i++) ctx.drawImage(tileSprite(CLOUD, T, true), (m.x + i) * T - cx, m.y * T, T + 1, T + 1);
    // goal: rainbow gate
    const gx = L.goal * T - cx, gy = 11 * T;
    if (gx > -T * 4 && gx < W + T * 4) {
      ctx.save(); ctx.lineCap = 'round';
      for (let k = 0; k < 6; k++) { ctx.strokeStyle = `hsl(${k * 55}, 100%, 65%)`; ctx.lineWidth = T * 0.18; ctx.beginPath(); ctx.arc(gx, gy, T * (2.4 - k * 0.2), Math.PI, TAU); ctx.stroke(); }
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 8; k++) { const a = Math.PI + (k / 7) * Math.PI, s = 10 + Math.sin(t * 6 + k) * 4; ctx.drawImage(app.particles.spriteCanvas('#ffffff'), gx + Math.cos(a) * T * 2.6 - s, gy + Math.sin(a) * T * 2.6 - s, s * 2, s * 2); }
      ctx.restore();
    }
    // coins
    for (const c of L.coins) {
      if (c.got) continue;
      const x = c.x * T - cx, y = c.y * T + Math.sin(t * 3 + c.x) * 3;
      if (x < -T || x > W + T) continue;
      const sw = Math.abs(Math.cos(t * 3 + c.x)) * 0.8 + 0.2;
      ctx.save(); ctx.translate(x, y); ctx.scale(sw, 1);
      ctx.fillStyle = '#ffd36e'; ctx.beginPath(); ctx.arc(0, 0, T * 0.28, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff6c4'; ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2, r = i % 2 ? T * 0.08 : T * 0.18; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
    // items
    for (const it of this.items) {
      const x = it.x * T - cx, y = it.y * T + (it.type === 'coinfx' ? 0 : Math.sin(it.t * 4) * 4);
      if (it.type === 'coinfx') { ctx.fillStyle = '#ffd36e'; ctx.beginPath(); ctx.arc(x, y, T * 0.25, 0, TAU); ctx.fill(); continue; }
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(app.particles.spriteCanvas(it.type === 'seed' ? '#9dff9a' : '#ffe27a'), x - T, y - T, T * 2, T * 2); ctx.restore();
      if (it.type === 'seed') {
        ctx.fillStyle = '#5be37a'; ctx.beginPath(); ctx.ellipse(x, y, T * 0.24, T * 0.32, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#c8ffb0'; ctx.beginPath(); ctx.ellipse(x - T * 0.15, y - T * 0.32, T * 0.16, T * 0.08, -0.6, 0, TAU); ctx.ellipse(x + T * 0.15, y - T * 0.32, T * 0.16, T * 0.08, 0.6, 0, TAU); ctx.fill();
      } else {
        ctx.strokeStyle = '#c98a5a'; ctx.lineWidth = T * 0.1; ctx.beginPath(); ctx.moveTo(x - T * 0.2, y + T * 0.3); ctx.lineTo(x + T * 0.1, y - T * 0.1); ctx.stroke();
        ctx.fillStyle = '#fff6a0'; ctx.beginPath(); ctx.arc(x + T * 0.15, y - T * 0.15, T * 0.15, 0, TAU); ctx.fill();
      }
    }
    // enemies
    for (const e of this.enemies) {
      const x = e.x * T - cx, y = e.y * T;
      if (x < -T * 2 || x > W + T * 2) continue;
      const sq = e.dead ? Math.max(0.15, 1 - e.dead * 3) : 1 + Math.sin(t * 10 + e.x) * 0.05, r = T * 0.42;
      ctx.save(); ctx.translate(x, y); ctx.scale(e.dead ? 1.3 : 1, sq); ctx.translate(0, -r);
      if (e.type === 'spiky') {
        ctx.fillStyle = '#ffb46b';
        for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + t; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); ctx.lineTo(Math.cos(a + 0.2) * r * 1.35, Math.sin(a + 0.2) * r * 1.35); ctx.lineTo(Math.cos(a + 0.4) * r * 0.8, Math.sin(a + 0.4) * r * 0.8); ctx.fill(); }
        ctx.fillStyle = '#ff8a3c';
      } else ctx.fillStyle = '#6a3dbf';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-r * 0.32, -r * 0.1, r * 0.22, 0, TAU); ctx.arc(r * 0.32, -r * 0.1, r * 0.22, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1b1040'; const look = Math.sign(e.vx) * r * 0.08;
      ctx.beginPath(); ctx.arc(-r * 0.32 + look, -r * 0.08, r * 0.1, 0, TAU); ctx.arc(r * 0.32 + look, -r * 0.08, r * 0.1, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#1b1040'; ctx.lineWidth = r * 0.12; ctx.lineCap = 'round'; // grumpy brows
      ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.42); ctx.lineTo(-r * 0.15, -r * 0.3); ctx.moveTo(r * 0.55, -r * 0.42); ctx.lineTo(r * 0.15, -r * 0.3); ctx.stroke();
      ctx.fillStyle = '#3a1a6a'; ctx.beginPath(); ctx.ellipse(-r * 0.4, r * 0.95, r * 0.25, r * 0.12, 0, 0, TAU); ctx.ellipse(r * 0.4, r * 0.95, r * 0.25, r * 0.12, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // sparks
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const s of this.sparks) { const x = s.x * T - cx, y = s.y * T; ctx.drawImage(app.particles.spriteCanvas('#ffe27a'), x - 18, y - 18, 36, 36); }
    ctx.restore();
    // Lumo
    const p = this.p;
    if (!(p.inv > 0 && Math.floor(t * 14) % 2)) {
      const r = T * (p.big ? 0.6 : 0.4), x = p.x * T - cx, y = p.y * T - r * 1.05;
      const sx = 1 / Math.sqrt(p.sq), sy = p.sq;
      drawLumo(ctx, x, y, r, { dir: p.dir, sx, sy, accent: p.wand ? '#ffe27a' : '#7ff3ff', mood: this.phase === 'clear' ? 'wow' : 'happy', crown: p.wand });
      if (p.wand && Math.random() < 0.5) app.particles.spawn(x + rand(-r, r), y + rand(-r, r), 0, -20, 0.5, rand(1, 2.5), '#ffe27a', 5, 0, 0.95, 0);
    }
  }

  drawFront(ctx) {
    if (this.state === 'play' && this.L) {
      glowText(ctx, `WORLD ${this.level + 1}   ·   ★ ${this.coinsGot}   ·   ${Math.max(0, Math.ceil(this.levelTime))}s`, app.W / 2, HUD_SUB_Y, { size: 11, font: 'Inter', weight: 700, spacing: 2, color: 'rgba(255,255,255,0.75)', blur: 0 });
      // progress to the gate
      const w = Math.min(320, app.W * 0.4), x0 = app.W / 2 - w / 2, y = HUD_SUB_Y + 18, k = clamp(this.p.x / this.L.goal);
      ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke();
      ctx.strokeStyle = this.accent; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w * k, y); ctx.stroke();
      ctx.restore();
      // air-joystick ring: shows the hand's lean so the control is self-explaining
      if (this.camHand !== null && this.camHand !== undefined) {
        const jx = app.W / 2, jy = app.H - 112, R = 46;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(jx, jy, R, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(jx - R * 0.18 * 1.2, jy - R, R * 0.36 * 1.2, R * 2);
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(app.particles.spriteCanvas(this.accent), jx + clamp(this.camHand, -1, 1) * R - 18, jy - 18, 36, 36);
        ctx.restore();
      }
    }
    super.drawFront(ctx);
  }
}
