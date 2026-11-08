// Tiny publish/subscribe bus shared by all modules.
const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}

export function emit(event, payload) {
  listeners.get(event)?.forEach(fn => {
    try { fn(payload); } catch (err) { console.error(`[events] ${event} handler failed`, err); }
  });
}
