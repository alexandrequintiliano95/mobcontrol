// Ties the 3D pieces together and follows the squad with the camera.
import { createStage } from './stage.js';
import { buildWorld } from './world.js';
import { createActors } from './actors.js';

export function createView(container) {
  const stage = createStage(container);
  const { renderer, scene, camera } = stage;
  let world = null, actors = null, extras = [];
  let time = 0, camX = 0;
  // Frame-rate watchdog: lower the pixel ratio when the device struggles.
  let slowFor = 0, avg = 1 / 60;

  function load(game) {
    world?.dispose();
    actors?.dispose();
    for (const e of extras) e.dispose?.();
    world = buildWorld(scene, game.level);
    actors = createActors(scene);
    extras = view.extraFactories.map((make) => make(scene, game));
    camX = game.squad.x * 0.4;
  }

  function placeCamera(game, dt) {
    const target = game.squad.x * 0.4;
    camX += (target - camX) * Math.min(1, dt * 4);
    let shakeX = 0, shakeY = 0;
    for (const e of extras) {
      if (e.shake > 0) {
        shakeX += (Math.random() - 0.5) * e.shake;
        shakeY += (Math.random() - 0.5) * e.shake;
      }
    }
    camera.position.set(camX + shakeX, 12.5 + shakeY, -game.squad.z + 14);
    camera.lookAt(camX, 0, -game.squad.z - 7);
  }

  function watchFps(dt) {
    if (dt <= 0 || dt > 0.5) return;
    avg += (dt - avg) * 0.05;
    if (avg > 1 / 45) slowFor += dt; else slowFor = 0;
    if (slowFor > 2 && stage.pixelRatioCap > 1) {
      stage.setPixelRatioCap(stage.pixelRatioCap > 1.5 ? 1.5 : 1);
      slowFor = 0;
    }
  }

  function render(game, events, dt) {
    time += dt;
    watchFps(dt);
    placeCamera(game, dt);
    actors?.sync(game, time, camera);
    for (const e of extras) {
      for (const ev of events) e.handle?.(ev);
      e.sync?.(game, time, camera);
      e.update?.(dt, camera);
    }
    renderer.render(scene, camera);
  }

  const view = {
    load,
    render,
    resize: stage.resize,
    get fps() { return 1 / avg; },
    // Later pieces (props, effects) register here: (scene, game) => { handle?, sync?, update?, shake?, dispose }.
    extraFactories: [],
  };
  return view;
}
