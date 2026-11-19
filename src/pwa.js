// Service worker registration and the install button (Android) / install hint (iPhone).
export async function registerServiceWorker(loc = location, nav = navigator) {
  if (!('serviceWorker' in nav)) return false;
  const local = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
  if (local && !new URLSearchParams(loc.search).has('sw')) return false;
  try {
    await nav.serviceWorker.register('./sw.js', { scope: './' });
    return true;
  } catch {
    return false;
  }
}

function isInstalled() {
  return (
    matchMedia('(display-mode: fullscreen)').matches ||
    matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone === true
  );
}

export function setupInstall(doc = document) {
  const button = doc.getElementById('btn-install');
  const hint = doc.getElementById('ios-hint');
  let deferred = null;
  if (isInstalled()) return { install: async () => {} };

  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) hint.hidden = false;

  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    button.hidden = false;
  });
  addEventListener('appinstalled', () => {
    deferred = null;
    button.hidden = true;
    hint.hidden = true;
  });

  return {
    async install() {
      if (!deferred) return;
      deferred.prompt();
      try { await deferred.userChoice; } catch { /* ignore */ }
      deferred = null;
      button.hidden = true;
    },
  };
}
