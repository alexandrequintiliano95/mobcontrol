// Provisional entry: demo mode (autopilot plays). Replaced by the full game loop in task 11.
import { generateLevel } from './level.js';
import { createGame, stepGame } from './sim.js';
import { autopilot } from './autopilot.js';
import { createView } from './render/view.js';

const params = new URLSearchParams(location.search);
const levelNumber = Math.max(1, Number(params.get('level')) || 1);
const view = createView(document.getElementById('stage'));
const fpsEl = document.getElementById('fps');
fpsEl.hidden = !params.has('debug');

let game;
function start() {
  game = createGame(generateLevel(levelNumber));
  view.load(game);
  if (params.has('debug')) window.__game = game;
}
start();
addEventListener('resize', () => view.resize());

let last = performance.now(), acc = 0, restartAt = 0;
function frame(now) {
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
  last = now;
  acc += dt;
  while (acc >= 1 / 60) { stepGame(game, 1 / 60, autopilot(game)); acc -= 1 / 60; }
  const events = game.events.splice(0);
  view.render(game, events, dt);
  if ((game.phase === 'won' || game.phase === 'lost') && !restartAt) restartAt = now + 2500;
  if (restartAt && now > restartAt) { restartAt = 0; start(); }
  if (!fpsEl.hidden) fpsEl.textContent = `${Math.round(view.fps)} fps · ${game.soldiers.length} soldados`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug hook: advance the game without requestAnimationFrame (hidden tabs do not animate).
if (params.has('debug')) {
  window.__advance = (seconds) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) stepGame(game, 1 / 60, autopilot(game));
    view.render(game, game.events.splice(0), 1 / 60);
    return { t: game.time, z: game.squad.z, n: game.soldiers.length, phase: game.phase };
  };
}
