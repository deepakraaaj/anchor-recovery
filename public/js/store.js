// Settings and profile live only in this browser. Nothing is stored on the server.
const KEY = 'anchor.v1';
const DEFAULTS = { settings: { role: 'self', language: 'en', country: 'IN' }, profile: {} };

export function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return {
      settings: { ...DEFAULTS.settings, ...saved.settings },
      profile: { ...saved.profile },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: nothing to clear.
  }
  return structuredClone(DEFAULTS);
}
