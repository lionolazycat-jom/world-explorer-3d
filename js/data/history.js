// Historical border snapshots from aourednik/historical-basemaps (GPL-3.0),
// loaded at runtime from jsDelivr. Every polygon is an APPROXIMATE
// reconstruction; BORDERPRECISION (1–3) is shown to the user.
import { geoArea } from 'd3-geo';
import { CDN } from '../config.js';
import { fetchJSON, prepareFeature } from './world.js';

let indexPromise = null;
const snapCache = new Map();

export function basemapIndex() {
  if (!indexPromise) {
    indexPromise = fetchJSON(CDN.basemapIndex, { timeout: 30000 })
      .then(d => (d.years || []).map(e => ({ year: e.year, file: e.filename })).sort((a, b) => a.year - b.year))
      .catch(err => { indexPromise = null; throw err; });
  }
  return indexPromise;
}

export async function snapshotFor(year) {
  const list = await basemapIndex();
  if (!list.length) return null;
  let pick = list[0];
  for (const e of list) if (e.year <= year) pick = e;
  return pick;
}

// Ensure exterior rings are clockwise for d3-geo (RFC 7946 files use the opposite).
function rewindPolygon(rings) {
  const a = geoArea({ type: 'Polygon', coordinates: rings });
  return a > 2 * Math.PI ? rings.map(r => r.slice().reverse()) : rings;
}
function rewind(geom) {
  if (!geom) return geom;
  if (geom.type === 'Polygon') return { ...geom, coordinates: rewindPolygon(geom.coordinates) };
  if (geom.type === 'MultiPolygon') return { ...geom, coordinates: geom.coordinates.map(rewindPolygon) };
  return geom;
}

export function loadSnapshot(entry) {
  if (!snapCache.has(entry.file)) {
    const p = fetchJSON(CDN.basemapFile(entry.file), { timeout: 60000 }).then(fc => {
      const feats = [];
      (fc.features || []).forEach((f, i) => {
        if (!f.geometry || !f.properties?.NAME) return;
        const g = rewind(f.geometry);
        const feat = { type: 'Feature', geometry: g, properties: {
          NAME: f.properties.NAME,
          SUBJECTO: f.properties.SUBJECTO || null,
          PARTOF: f.properties.PARTOF || null,
          BORDERPRECISION: Number(f.properties.BORDERPRECISION) || 1,
          _hist: true, _key: `${entry.year}:${i}`, _year: entry.year
        } };
        prepareFeature(feat);
        if (feat.properties._ok) feats.push(feat);
      });
      return feats;
    }).catch(err => { snapCache.delete(entry.file); throw err; });
    snapCache.set(entry.file, p);
  }
  return snapCache.get(entry.file);
}

// Stable colour per polity name; opacity follows border precision.
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function polityColor(f, { highlight = null } = {}) {
  const p = f.properties;
  const name = p.SUBJECTO || p.NAME;
  if (highlight) {
    return highlight.test(p.NAME) ? 'rgba(243,211,138,0.62)' : 'rgba(150,165,190,0.10)';
  }
  const hue = hash(name) % 360;
  const a = p.BORDERPRECISION >= 3 ? 0.5 : p.BORDERPRECISION === 2 ? 0.4 : 0.3;
  return `hsla(${hue}, 48%, 58%, ${a})`;
}

export const PRECISION_TEXT = {
  1: 'Approximate — the extent is a rough estimate.',
  2: 'Moderately precise — based on known features but still reconstructed.',
  3: 'Precise — a border defined by international law.'
};
