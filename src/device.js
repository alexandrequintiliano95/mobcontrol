// Phone features: vibration and keeping the screen awake.
const PATTERNS = { light: 12, medium: 25, heavy: [40, 30, 40], win: [30, 60, 30, 60, 80], lose: [120, 80, 200] };

export function createHaptics(nav = globalThis.navigator) {
  let lastLight = -Infinity;
  const haptics = {
    enabled: true,
    buzz(kind) {
      if (!haptics.enabled || typeof nav?.vibrate !== 'function') return;
      if (kind === 'light') {
        const now = globalThis.performance?.now?.() ?? Date.now();
        if (now - lastLight < 100) return;
        lastLight = now;
      }
      try { nav.vibrate(PATTERNS[kind] ?? 10); } catch { /* ignore */ }
    },
  };
  return haptics;
}

export function createWakeLock(nav = globalThis.navigator, doc = globalThis.document) {
  let sentinel = null, wanted = false;
  async function request() {
    try {
      if (!nav?.wakeLock || sentinel) return;
      sentinel = await nav.wakeLock.request('screen');
      sentinel.addEventListener?.('release', () => { sentinel = null; });
    } catch { sentinel = null; }
  }
  doc?.addEventListener?.('visibilitychange', () => {
    if (wanted && doc.visibilityState === 'visible') request();
  });
  return {
    async acquire() { wanted = true; await request(); },
    async release() {
      wanted = false;
      try { await sentinel?.release(); } catch { /* ignore */ }
      sentinel = null;
    },
  };
}
