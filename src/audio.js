// Synthesized sound effects (WebAudio), no audio files.
export function createLimiter(gaps) {
  const lastAt = new Map();
  return (name, now) => {
    const gap = gaps[name];
    if (!gap) return true;
    const prev = lastAt.get(name);
    if (prev !== undefined && now - prev < gap) return false;
    lastAt.set(name, now);
    return true;
  };
}

const GAPS = { shot: 0.07, hit: 0.05, zombieDown: 0.06, soldierDown: 0.08, recruit: 0.05 };

export function createAudio() {
  let ctx = null, master = null, noiseBuf = null;
  const allow = createLimiter(GAPS);
  const audio = { enabled: true };

  audio.unlock = () => {
    try {
      if (!ctx) {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (ctx.state !== 'running') ctx.resume();
    } catch { /* audio unavailable */ }
  };

  function tone(type, f0, f1, dur, vol, delay = 0) {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq, q = 1, delay = 0) {
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, freq / 6), t + dur);
    f.Q.value = q;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  const SOUNDS = {
    shot: () => { noise(0.05, 0.18, 3800, 2); tone('square', 900, 300, 0.04, 0.04); },
    hit: () => tone('triangle', 520, 380, 0.04, 0.05),
    cannon: () => { noise(0.25, 0.45, 900, 1.2); tone('sine', 90, 45, 0.25, 0.3); },
    explode: () => { noise(0.5, 0.6, 1600, 0.7); tone('sine', 120, 40, 0.4, 0.35); },
    recruit: () => { tone('triangle', 660, 990, 0.09, 0.12); tone('triangle', 990, 1320, 0.09, 0.1, 0.07); },
    gateGood: () => [523, 659, 784, 1046].forEach((f, i) => tone('square', f, f, 0.09, 0.07, i * 0.06)),
    gateBad: () => { tone('sawtooth', 300, 90, 0.35, 0.16); noise(0.2, 0.15, 700); },
    soldierDown: () => tone('square', 220, 110, 0.08, 0.06),
    zombieDown: () => { noise(0.1, 0.12, 900, 3); tone('sine', 180, 90, 0.08, 0.08); },
    weapon: () => { tone('square', 330, 660, 0.12, 0.1); tone('square', 495, 990, 0.14, 0.1, 0.1); },
    bossRoar: () => { tone('sawtooth', 110, 55, 0.9, 0.25); noise(0.8, 0.2, 500, 2); },
    win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone('triangle', f, f, 0.18, 0.12, i * 0.12)),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone('sawtooth', f, f * 0.97, 0.25, 0.1, i * 0.18)),
    click: () => tone('square', 700, 700, 0.03, 0.05),
  };

  audio.play = (name) => {
    if (!audio.enabled || !ctx || ctx.state !== 'running') return;
    if (!allow(name, ctx.currentTime)) return;
    try { SOUNDS[name]?.(); } catch { /* ignore */ }
  };

  return audio;
}
