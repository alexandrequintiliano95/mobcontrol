// Progress and settings saved on the device. Never throws (private mode, blocked storage).
export const SAVE_KEY = 'esquadrao-z/save/v1';
const DEFAULTS = Object.freeze({ level: 1, sound: true, vibe: true });

function defaultStorage() {
  try { return globalThis.localStorage; } catch { return undefined; }
}

export function loadSave(storage = defaultStorage()) {
  let data = null;
  try { data = JSON.parse(storage?.getItem(SAVE_KEY) ?? 'null'); } catch { data = null; }
  if (!data || typeof data !== 'object') return { ...DEFAULTS };
  const level = Number.isInteger(data.level) && data.level >= 1 ? data.level : DEFAULTS.level;
  return {
    level,
    sound: typeof data.sound === 'boolean' ? data.sound : DEFAULTS.sound,
    vibe: typeof data.vibe === 'boolean' ? data.vibe : DEFAULTS.vibe,
  };
}

export function saveSave(save, storage = defaultStorage()) {
  try { storage?.setItem(SAVE_KEY, JSON.stringify({ level: save.level, sound: save.sound, vibe: save.vibe })); } catch { /* ignore */ }
}
