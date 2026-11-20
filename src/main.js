// Entry point: game states (menu → playing ⇄ paused → won | lost), loop, input, HUD and save.
import { generateLevel } from './level.js';
import { createGame, stepGame, addSoldiers } from './sim.js';
import { autopilot } from './autopilot.js';
import { createView } from './render/view.js';
import { createUi } from './ui.js';
import { createInput } from './input.js';
import { loadSave, saveSave, MAX_LEVEL } from './storage.js';
import { newPickupAhead } from './discovery.js';
import { advanceClock } from './clock.js';
import { WEAPONS } from './config.js';
import { createAudio } from './audio.js';
import { createHaptics, createWakeLock } from './device.js';
import { registerServiceWorker, setupInstall } from './pwa.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const DEMO = params.has('demo');
const STEP = 1 / 60;

const stageEl = document.getElementById('stage');
const appEl = document.getElementById('app');
const fpsEl = document.getElementById('fps');
fpsEl.hidden = !DEBUG;

const save = loadSave();

const view = createView(stageEl);
const ui = createUi(document);
const input = createInput(stageEl, { width: () => appEl.clientWidth });
ui.setToggles(save);

const audio = createAudio();
const haptics = createHaptics();
const wakeLock = createWakeLock();
function applySettings(s) { audio.enabled = s.sound; haptics.enabled = s.vibe; }
applySettings(save);

// Event → sound and vibration.
const FEEDBACK = {
  barrelDestroyed: ['explode', 'medium'],
  barrelCrash: ['explode', 'heavy'],
  recruitJoined: ['recruit'],
  weapon: ['weapon', 'medium'],
  zombieKilled: ['zombieDown'],
  soldierKilled: ['soldierDown', 'light'],
  bossSpawn: ['bossRoar', 'heavy'],
  bossKilled: ['explode'],
  zombieExploded: ['explode', 'medium'],
  tankJoined: ['weapon', 'heavy'],
  newPickup: ['weapon', 'medium'],
  killReward: ['recruit', 'light'],
  tankShot: ['cannon'],
  tankBlast: ['explode'],
  tankDestroyed: ['explode', 'heavy'],
  shieldBroken: ['hit'],
  bossSummon: ['bossRoar'],
  won: ['win', 'win'],
  lost: ['lose', 'lose'],
};
const hooks = {
  onEvents(events) {
    for (const e of events) {
      let fb = FEEDBACK[e.type];
      if (e.type === 'gate') fb = e.value > 0 ? ['gateGood', 'light'] : e.value < 0 ? ['gateBad', 'heavy'] : null;
      if (!fb) continue;
      audio.play(fb[0]);
      if (fb[1]) haptics.buzz(fb[1]);
    }
  },
  onShots(shots, hits) {
    audio.play('shot');
    if (hits > 0) audio.play('hit');
  },
  onStart() { wakeLock.acquire(); },
  onPause() { wakeLock.release(); },
  onSettings: applySettings,
  onAction(action) { if (action === 'install') installer.install(); },
};
const installer = setupInstall(document);
registerServiceWorker();
document.addEventListener('pointerdown', () => audio.unlock(), { capture: true });
function closeAnnounce() {
  if (announce !== 0) return;
  announce = null;
  ui.hideAnnounce();
  input.reset(game.squad.x);
}
document.addEventListener('pointerup', closeAnnounce);
addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') closeAnnounce(); });

let state = 'menu';
// Seconds left before a tap can close the new-weapon notice; null when no notice is open. The game is frozen meanwhile.
let announce = null;
let game = null;
// ?level=N only picks the operation to play; it never overwrites saved progress.
let levelNumber = params.has('level') ? Math.min(MAX_LEVEL, Math.max(1, Math.floor(Number(params.get('level'))) || 1)) : save.level;
let endTimer = 0;
let lastShots = 0, lastHits = 0, peak = 1;
const clock = { acc: 0 };
let countdown = 0; // seconds left before the run starts (3, 2, 1, VAI!)
let shownCount = null;

function newGame() {
  // Every try draws new weapons (the demo keeps the default draw).
  game = createGame(generateLevel(levelNumber, DEMO ? 0 : 1 + Math.floor(Math.random() * 1e6)));
  const extra = Math.floor(Number(params.get('soldiers')) || 0) - 1;
  if (extra > 0) addSoldiers(game, extra);
  input.reset(0);
  announce = null;
  ui.hideAnnounce();
  clock.acc = 0;
  lastShots = 0;
  lastHits = 0;
  peak = 1;
  endTimer = 0;
  view.load(game);
  if (DEBUG) window.__game = game;
}

function setState(next) {
  state = next;
  if (next === 'menu') ui.show('menu', { level: levelNumber });
  else if (next === 'playing') ui.show(null);
  else if (next === 'paused') ui.show('pause');
  else if (next === 'won') {
    const ratio = game.soldiers.length / peak;
    ui.show('won', { level: game.level.number, soldiers: game.soldiers.length, stars: ratio >= 0.7 ? 3 : ratio >= 0.35 ? 2 : 1 });
  }
  else if (next === 'lost') ui.show('lost', { level: game.level.number });
  if (next === 'playing') hooks.onStart();
  else hooks.onPause();
}

function play() {
  newGame();
  countdown = DEMO ? 0 : 3.6;
  shownCount = null;
  setState('playing');
}

ui.onAction((action) => {
  audio.unlock();
  audio.play('click');
  switch (action) {
    case 'play': play(); break;
    case 'pause': if (state === 'playing') setState('paused'); break;
    case 'resume': if (state === 'paused') setState('playing'); break;
    case 'restart': play(); break;
    case 'next': levelNumber = save.level; play(); break;
    case 'menu': levelNumber = save.level; newGame(); setState('menu'); break;
    case 'toggle-sound': save.sound = !save.sound; saveSave(save); ui.setToggles(save); hooks.onSettings?.(save); break;
    case 'toggle-vibe': save.vibe = !save.vibe; saveSave(save); ui.setToggles(save); hooks.onSettings?.(save); break;
    default: hooks.onAction?.(action);
  }
});

function pauseIfPlaying() {
  if (state === 'playing') setState('paused');
  input.reset(input.update(0));
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseIfPlaying(); else audio.unlock(); });
addEventListener('pagehide', pauseIfPlaying);
addEventListener('blur', pauseIfPlaying);
addEventListener('resize', () => view.resize());
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p') {
    if (state === 'playing') setState('paused');
    else if (state === 'paused') setState('playing');
  }
});

function step(dt) {
  const target = DEMO ? autopilot(game).targetX : input.update(dt);
  stepGame(game, dt, { targetX: target, targetDz: DEMO ? 0 : input.forward() });
}

function afterSteps(events) {
  if (game.shots > lastShots) { hooks.onShots(game.shots - lastShots, game.hits - lastHits); }
  lastShots = game.shots;
  lastHits = game.hits;
  for (const e of events) {
    if (e.type === 'gate') ui.toast(e.value > 0 ? `+${e.value}` : String(e.value), e.value > 0 ? 'good' : 'bad');
    if (e.type === 'weapon') ui.toast(`${WEAPONS[game.squad.weapon].label.toUpperCase()}!`, 'info');
    if (e.type === 'killReward') ui.toast('+1 SOLDADO', 'good');
    if (e.type === 'bossSpawn') { input.resetForward(); ui.toast('CHEFÃO! ARRASTE ↑↓ PARA DESVIAR', 'bad'); }
    if (e.type === 'tankJoined') ui.toast('TANQUE! ZUMBIS MAIS RÁPIDOS!', 'info');
    if (e.type === 'tankDestroyed') ui.toast('TANQUE DESTRUÍDO!', 'bad');
  }
  const fresh = DEMO ? null : newPickupAhead(game, save.seen);
  if (fresh) { save.seen.push(fresh); saveSave(save); ui.announce(fresh); announce = 0.7; hooks.onEvents([{ type: 'newPickup' }], game); }
  hooks.onEvents(events, game);
  if ((game.phase === 'won' || game.phase === 'lost') && !endTimer) {
    if (game.phase === 'won') {
      save.level = Math.max(save.level, game.level.number + 1);
      levelNumber = save.level;
      saveSave(save);
    }
    endTimer = game.phase === 'won' ? 1.2 : 1;
  }
}

function updateHud() {
  peak = Math.max(peak, game.soldiers.length);
  ui.hud({
    count: game.soldiers.length,
    level: game.level.number,
    progress: game.phase === 'run' ? game.squad.z / game.level.length : 1,
    weapon: game.squad.weapon,
    bossHp: game.phase === 'boss' || (game.phase === 'won' && game.boss.maxHp) ? Math.max(0, game.boss.hp / game.boss.maxHp) : null,
  });
}

let last = performance.now();
function frame(now) {
  const frameDt = Math.max(0, Math.min(0.1, (now - last) / 1000));
  last = now;
  let events = [];
  if (state === 'playing' && game && countdown > 0) {
    countdown -= frameDt;
    const label = countdown > 0.6 ? String(Math.ceil(countdown - 0.6)) : 'VAI!';
    if (label !== shownCount) {
      shownCount = label;
      ui.countdown(label);
      audio.play(label === 'VAI!' ? 'weapon' : 'click');
    }
    if (countdown <= 0) ui.countdown(null);
    updateHud();
  } else if (state === 'playing' && game && announce !== null) {
    announce = Math.max(0, announce - frameDt);
    ui.announceReady(announce === 0);
  } else if (state === 'playing' && game) {
    const steps = advanceClock(clock, frameDt);
    for (let i = 0; i < steps; i++) step(STEP);
    events = game.events.splice(0);
    afterSteps(events);
    updateHud();
    if (endTimer > 0) {
      endTimer -= frameDt;
      if (endTimer <= 0) setState(game.phase === 'won' ? 'won' : 'lost');
    }
  }
  view.render(game, events, state === 'paused' || announce !== null ? 0 : frameDt);
  if (DEBUG) fpsEl.textContent = `${Math.round(view.fps)} fps · ${game.soldiers.length} soldados`;
  requestAnimationFrame(frame);
}

newGame();
setState('menu');
if (DEMO) play();
requestAnimationFrame(frame);

// Debug hook: advance the game without requestAnimationFrame (hidden tabs do not animate).
if (DEBUG) {
  window.__advance = (seconds, targetX = null) => {
    countdown = 0;
    ui.countdown(null);
    let events = [];
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      if (state !== 'playing') break;
      stepGame(game, STEP, { targetX: targetX ?? autopilot(game).targetX });
      const ev = game.events.splice(0);
      afterSteps(ev);
      events = events.concat(ev);
      if (endTimer > 0) { endTimer -= STEP; if (endTimer <= 0) setState(game.phase === 'won' ? 'won' : 'lost'); }
    }
    updateHud();
    view.render(game, events.slice(-200), STEP);
    return { t: game.time, z: game.squad.z, n: game.soldiers.length, phase: game.phase, state };
  };
}
