// Steering input: relative drag (first finger only) plus arrow keys / A-D for desktop testing.
import { ROAD_HALF, DRAG_GAIN, KEY_SPEED } from './config.js';

const clamp = (v) => Math.max(-ROAD_HALF, Math.min(ROAD_HALF, v));
const LEFT = new Set(['ArrowLeft', 'a', 'A']);
const RIGHT = new Set(['ArrowRight', 'd', 'D']);

export function createInput(el, { width, keyTarget = globalThis } = {}) {
  let target = 0;
  let pointer = null; // { id, anchorPx, anchorTarget }
  const held = { left: false, right: false };

  const down = (e) => {
    if (pointer) return;
    pointer = { id: e.pointerId, anchorPx: e.clientX, anchorTarget: target };
    try { el.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
  };
  const move = (e) => {
    if (!pointer || e.pointerId !== pointer.id) return;
    const perPx = (2 * ROAD_HALF * DRAG_GAIN) / Math.max(1, width());
    target = clamp(pointer.anchorTarget + (e.clientX - pointer.anchorPx) * perPx);
  };
  const up = (e) => {
    if (pointer && e.pointerId === pointer.id) pointer = null;
  };
  const key = (pressed) => (e) => {
    if (LEFT.has(e.key)) held.left = pressed;
    if (RIGHT.has(e.key)) held.right = pressed;
  };
  const keydown = key(true), keyup = key(false);

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  keyTarget.addEventListener('keydown', keydown);
  keyTarget.addEventListener('keyup', keyup);

  return {
    update(dt) {
      const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      if (dir) target = clamp(target + dir * KEY_SPEED * dt);
      return target;
    },
    reset(x) { target = clamp(x); pointer = null; held.left = held.right = false; },
    dispose() {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      keyTarget.removeEventListener('keydown', keydown);
      keyTarget.removeEventListener('keyup', keyup);
    },
  };
}
