// Steering input: relative drag (first finger only) plus arrow keys / A-D for desktop testing.
import { ROAD_HALF, DRAG_GAIN, KEY_SPEED } from './config.js';

const clamp = (v) => Math.max(-ROAD_HALF, Math.min(ROAD_HALF, v));
const LEFT = new Set(['ArrowLeft', 'a', 'A']);
const RIGHT = new Set(['ArrowRight', 'd', 'D']);
const UP = new Set(['ArrowUp', 'w', 'W']);
const DOWN = new Set(['ArrowDown', 's', 'S']);
// Forward/back target (boss fight), in road units, kept in a generous range; the game clamps it further.
const FWD_LIMIT = 20;
const clampFwd = (v) => Math.max(-FWD_LIMIT, Math.min(FWD_LIMIT, v));

export function createInput(el, { width, keyTarget = globalThis } = {}) {
  let target = 0, fwd = 0;
  let pointer = null; // { id, anchorPx, anchorTarget, anchorPy, anchorFwd }
  const held = { left: false, right: false, up: false, down: false };

  const down = (e) => {
    if (pointer) return;
    pointer = { id: e.pointerId, anchorPx: e.clientX, anchorTarget: target, anchorPy: e.clientY ?? 0, anchorFwd: fwd };
    try { el.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
  };
  const move = (e) => {
    if (!pointer || e.pointerId !== pointer.id) return;
    pointer.lastPy = e.clientY ?? 0;
    const perPx = (2 * ROAD_HALF * DRAG_GAIN) / Math.max(1, width());
    target = clamp(pointer.anchorTarget + (e.clientX - pointer.anchorPx) * perPx);
    fwd = clampFwd(pointer.anchorFwd - ((e.clientY ?? 0) - pointer.anchorPy) * perPx);
  };
  const up = (e) => {
    if (pointer && e.pointerId === pointer.id) pointer = null;
  };
  const key = (pressed) => (e) => {
    if (LEFT.has(e.key)) held.left = pressed;
    if (RIGHT.has(e.key)) held.right = pressed;
    if (UP.has(e.key)) held.up = pressed;
    if (DOWN.has(e.key)) held.down = pressed;
  };
  const keydown = key(true), keyup = key(false);

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
  keyTarget.addEventListener('keydown', keydown);
  keyTarget.addEventListener('keyup', keyup);

  return {
    update(dt) {
      const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      if (dir) target = clamp(target + dir * KEY_SPEED * dt);
      const vdir = (held.up ? 1 : 0) - (held.down ? 1 : 0);
      if (vdir) fwd = clampFwd(fwd + vdir * KEY_SPEED * dt);
      return target;
    },
    forward() { return fwd; },
    resetForward() {
      fwd = 0;
      // Re-anchor a finger already on the screen, so the target starts from where it is now.
      if (pointer) { pointer.anchorFwd = 0; pointer.anchorPy = pointer.lastPy ?? pointer.anchorPy; }
    },
    reset(x) { target = clamp(x); fwd = 0; pointer = null; held.left = held.right = held.up = held.down = false; },
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
