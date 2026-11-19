// Fixed-step clock: turns frame time into whole simulation steps.
const MAX_FRAME = 0.1;
const MAX_STEPS = 6;

export function advanceClock(clock, frameDt, step = 1 / 60) {
  const dt = Math.max(0, Math.min(MAX_FRAME, Number.isFinite(frameDt) ? frameDt : 0));
  clock.acc += dt;
  const steps = Math.min(MAX_STEPS, Math.floor((clock.acc + 1e-9) / step));
  clock.acc = Math.max(0, clock.acc - steps * step);
  if (clock.acc >= step) clock.acc = 0;
  return steps;
}
