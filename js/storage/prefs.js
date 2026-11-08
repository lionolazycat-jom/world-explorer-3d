// Local persistence (localStorage). Everything stays on the device.
import { APP } from '../config.js';

const P = APP.storagePrefix;
const DEFAULTS = {
  mode: 'auto',        // 'auto' | '3d' | 'lite'
  quality: 'auto',     // 'auto' | 'high' | 'low'
  texture: 'day',      // 'day' | 'night'
  autoRotate: true,
  graticules: false
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(P + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(P + key, JSON.stringify(value)); return true; }
  catch { return false; }
}

export const prefs = {
  get() { return { ...DEFAULTS, ...read('prefs', {}) }; },
  set(patch) { const next = { ...this.get(), ...patch }; write('prefs', next); return next; }
};

export const favourites = {
  list() { return read('favs', []); },
  has(id) { return this.list().includes(id); },
  toggle(id) {
    const list = this.list();
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.unshift(id);
    write('favs', list);
    return i < 0;
  }
};

// Countries the user has opened, most recent first, with first-visit time.
export const visited = {
  list() { return read('visited', []); },
  add(id) {
    const list = this.list().filter(v => v.id !== id);
    const prev = this.list().find(v => v.id === id);
    list.unshift({ id, first: prev?.first || Date.now(), last: Date.now() });
    write('visited', list.slice(0, 400));
  },
  count() { return this.list().length; }
};

export function resetAll() {
  try {
    Object.keys(localStorage).filter(k => k.startsWith(P)).forEach(k => localStorage.removeItem(k));
    return true;
  } catch { return false; }
}
