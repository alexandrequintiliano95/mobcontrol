// DOM interface: HUD, menus and toasts. Buttons carry data-action attributes.
import { WEAPONS } from './config.js';

export function createUi(doc) {
  const $ = (id) => doc.getElementById(id);
  const screens = { menu: $('screen-menu'), pause: $('screen-pause'), won: $('screen-won'), lost: $('screen-lost') };
  const hud = $('hud');
  const toastEl = $('hud-toast');
  let toastTimer = 0;
  let handler = () => {};
  const last = {};

  doc.addEventListener('click', (e) => {
    const btn = e.target.closest?.('[data-action]');
    if (btn) handler(btn.dataset.action);
  });

  const setText = (id, text) => {
    if (last[id] === text) return;
    last[id] = text;
    $(id).textContent = text;
  };

  return {
    onAction(fn) { handler = fn; },
    show(screen, data = {}) {
      for (const [name, el] of Object.entries(screens)) el.hidden = name !== screen;
      hud.hidden = screen === 'menu';
      if (screen === 'menu') $('menu-level').textContent = `Operação ${data.level ?? 1}`;
      if (screen === 'won') {
        $('won-title').textContent = `OPERAÇÃO ${data.level} CONCLUÍDA!`;
        $('won-detail').textContent = `${data.soldiers} soldados sobreviveram`;
      }
      if (screen === 'lost') $('lost-detail').textContent = `Operação ${data.level}`;
    },
    hud(state) {
      setText('hud-count', String(state.count));
      setText('hud-level', `Operação ${state.level}`);
      setText('hud-weapon', WEAPONS[state.weapon]?.label ?? '');
      const pct = `${Math.round(Math.max(0, Math.min(1, state.progress)) * 100)}%`;
      if (last.progress !== pct) { last.progress = pct; $('hud-progress').style.width = pct; }
      $('hud-boss').hidden = state.bossHp == null;
      if (state.bossHp != null) $('hud-boss-fill').style.width = `${Math.max(0, state.bossHp) * 100}%`;
    },
    toast(text, tone = 'info') {
      toastEl.textContent = text;
      toastEl.className = `show ${tone}`;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastEl.className = tone; }, 900);
    },
    setToggles({ sound, vibe }) {
      $('btn-sound').textContent = `SOM: ${sound ? 'LIGADO' : 'DESLIGADO'}`;
      $('btn-vibe').textContent = `VIBRAÇÃO: ${vibe ? 'LIGADA' : 'DESLIGADA'}`;
    },
  };
}
