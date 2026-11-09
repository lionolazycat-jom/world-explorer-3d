// Loads the researched content (country profiles, periods, routes, stories).
// Everything is static JSON in /data/content so new countries can be added
// by dropping in a file and listing it in index.json.
import { fetchJSON } from './world.js';

const BASE = './data/content';
const cache = new Map();

function load(path) {
  if (!cache.has(path)) cache.set(path, fetchJSON(`${BASE}/${path}`).catch(err => { cache.delete(path); throw err; }));
  return cache.get(path);
}

export const content = {
  index: () => load('index.json'),
  country: a3 => load(`countries/${a3}.json`),
  periods: () => load('periods.json'),
  routes: () => load('routes.json'),
  story: id => load(`stories/${id}.json`),

  async allCountries() {
    const idx = await this.index();
    const out = {};
    await Promise.all(idx.countries.map(async a3 => {
      try { out[a3] = await this.country(a3); } catch (e) { console.warn('[content] missing', a3, e); }
    }));
    return out;
  }
};

// Year helpers: negative = BCE, no year zero (historians' convention).
export function fmtYear(y) {
  if (y == null) return '';
  const r = Math.round(y);
  if (r < 0) return `${(-r).toLocaleString('en')} BCE`;
  return r < 1000 ? `${r} CE` : String(r);
}

export const CONFIDENCE = {
  established: { label: 'Established', hint: 'Widely accepted by historians and supported by solid evidence.' },
  probable: { label: 'Probable', hint: 'Generally accepted, but details or dates are uncertain.' },
  debated: { label: 'Debated', hint: 'Historians or archaeologists disagree; see the note.' },
  legend: { label: 'Legend', hint: 'A traditional story, not established history.' },
  debunked: { label: 'Debunked', hint: 'Shown by evidence to be false or a forgery.' },
  schematic: { label: 'Schematic', hint: 'A simplified drawing of a route, not an exact path.' }
};

// Flatten events and places from all loaded countries.
export function flattenEvents(countries) {
  const out = [];
  for (const [a3, c] of Object.entries(countries)) {
    for (const e of c.history) out.push({ ...e, country: a3, _src: c.sources });
  }
  return out.sort((a, b) => a.y - b.y);
}
export function flattenPlaces(countries) {
  const out = [];
  for (const [a3, c] of Object.entries(countries)) {
    for (const p of c.places) out.push({ ...p, country: a3, _src: c.sources });
  }
  return out;
}
