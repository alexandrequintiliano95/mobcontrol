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

// Bazooka rockets land all the time with a big squad: one soft boom every 2 seconds is enough.
export const GAPS = {
  shot: 0.07, hit: 0.05, zombieDown: 0.06, soldierDown: 0.08, recruit: 0.05, rocketBoom: 2,
  // Shot sounds per weapon: the gap sets how often the squad's fire is heard (fast guns rattle, heavy ones thump).
  shot_rifle: 0.09, shot_smg: 0.06, shot_ak47: 0.075, shot_minigun: 0.045,
  shot_sniper: 0.4, shot_shotgun: 0.28, shot_bazooka: 0.45,
};
const SHOTS = new Set(['rifle', 'smg', 'ak47', 'minigun', 'sniper', 'shotgun', 'bazooka']);
// Name of the shot sound for a weapon (falls back to the generic one).
export const shotSound = (weapon) => (SHOTS.has(weapon) ? `shot_${weapon}` : 'shot');

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

  // Rising band-passed noise: something leaving fast.
  function whoosh(dur, vol) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    f.type = 'bandpass';
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2200, t + dur);
    f.Q.value = 2;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  const SOUNDS = {
    shot: () => { noise(0.05, 0.18, 3800, 2); tone('square', 900, 300, 0.04, 0.04); },
    // Rifle: the classic short crack.
    shot_rifle: () => { noise(0.05, 0.18, 3800, 2); tone('square', 900, 300, 0.04, 0.04); },
    // SMG: lighter, higher tick.
    shot_smg: () => { noise(0.035, 0.13, 5200, 2); tone('square', 1300, 600, 0.03, 0.03); },
    // AK-47: deeper, punchier bang.
    shot_ak47: () => { noise(0.07, 0.22, 2400, 1.5); tone('square', 420, 140, 0.06, 0.06); },
    // Minigun: fast low buzz that blends into a "brrrt".
    shot_minigun: () => { noise(0.03, 0.12, 1800, 1); tone('sawtooth', 160, 110, 0.03, 0.04); },
    // Sniper: a loud dry crack with a short echo.
    shot_sniper: () => { noise(0.09, 0.35, 6500, 1); tone('square', 1500, 200, 0.06, 0.07); noise(0.3, 0.08, 1400, 0.7, 0.08); },
    // Shotgun: a fat "pá" with a low thump.
    shot_shotgun: () => { noise(0.18, 0.32, 1500, 0.8); tone('sine', 150, 60, 0.14, 0.18); },
    // Bazooka: "fuup", a whoosh of the rocket leaving the tube (the blast is rocketBoom).
    shot_bazooka: () => { whoosh(0.35, 0.16); tone('sine', 110, 70, 0.12, 0.1); },
    hit: () => tone('triangle', 520, 380, 0.04, 0.05),
    cannon: () => { noise(0.25, 0.45, 900, 1.2); tone('sine', 90, 45, 0.25, 0.3); },
    // Soft, low "tuumm": a deep sine drop with a muffled rumble.
    rocketBoom: () => { tone('sine', 85, 38, 0.55, 0.22); noise(0.45, 0.14, 420, 0.8); },
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
