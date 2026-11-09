// Loads Natural Earth TopoJSON + the country reference list and joins them.
// Picking is done with d3-geo's spherical geoContains so it is correct across
// the antimeridian and near the poles, independent of the renderer.
import { feature, neighbors } from 'topojson-client';
import { geoContains, geoArea, geoCentroid, geoBounds } from 'd3-geo';

const FOUR_PI = 4 * Math.PI;

export async function fetchJSON(url, { timeout = 20000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

export async function loadReference(url = './data/countries.json') {
  const data = await fetchJSON(url);
  const byNum = new Map(), byA3 = new Map(), byMapName = new Map();
  for (const c of data.countries) {
    const rec = { ...c, aka: c.aka || [], f110: null, f50: null, neighbours: [] };
    if (c.n) byNum.set(c.n, rec);
    if (c.mapName) byMapName.set(c.mapName, rec);
    byA3.set(c.a3, rec);
  }
  return { meta: data.meta, byNum, byA3, byMapName };
}

// Returns prepared GeoJSON features for one resolution.
export async function loadWorld(url) {
  const topo = await fetchJSON(url);
  const obj = topo.objects.countries;
  const fc = feature(topo, obj);
  const nb = neighbors(obj.geometries);
  fc.features.forEach((f, i) => {
    f.properties = f.properties || {};
    f.properties._nb = nb[i] || [];
    prepareFeature(f);
  });
  return fc.features;
}

function polygonArea(geom) {
  const a = geoArea(geom);
  return Math.min(a, FOUR_PI - a); // guard against inverted winding
}

function largestPolygon(f) {
  const g = f.geometry;
  if (!g) return null;
  if (g.type === 'Polygon') return g;
  if (g.type !== 'MultiPolygon') return g;
  let best = null, bestA = -1;
  for (const coords of g.coordinates) {
    const p = { type: 'Polygon', coordinates: coords };
    const a = polygonArea(p);
    if (a > bestA) { bestA = a; best = p; }
  }
  return best;
}

function lonSpan(b) {
  const [[w], [e]] = b;
  return e >= w ? e - w : e + 360 - w;
}

export function prepareFeature(f) {
  const p = f.properties;
  if (!f.geometry) { p._ok = false; return; }
  p._ok = true;
  p._bbox = geoBounds(f);
  // Countries whose parts are far apart (France + French Guiana, USA + Alaska,
  // Russia across the antimeridian) are framed on their largest landmass.
  const spread = lonSpan(p._bbox) > 50 || (p._bbox[1][1] - p._bbox[0][1]) > 50;
  const framing = spread ? largestPolygon(f) : f.geometry;
  const fb = geoBounds(framing);
  p._center = geoCentroid(framing);
  const midLat = (fb[0][1] + fb[1][1]) / 2;
  const span = Math.max(lonSpan(fb) * Math.cos(midLat * Math.PI / 180), fb[1][1] - fb[0][1]);
  p._span = span;
  p._area = polygonArea(f.geometry);
}

function inBBox(b, lon, lat, pad = 0.6) {
  const [[w, s], [e, n]] = b;
  if (lat < s - pad || lat > n + pad) return false;
  if (w <= e) return lon >= w - pad && lon <= e + pad;
  return lon >= w - pad || lon <= e + pad; // crosses antimeridian
}

export function pickFeature(features, lon, lat) {
  if (!features) return null;
  let hit = null;
  for (const f of features) {
    const p = f.properties;
    if (!p._ok || !inBBox(p._bbox, lon, lat)) continue;
    if (geoContains(f, [lon, lat])) {
      // Prefer the smallest containing feature (enclaves such as Vatican City, Lesotho).
      if (!hit || p._area < hit.properties._area) hit = f;
    }
  }
  return hit;
}

// Camera framing for a record: centre + altitude in globe radii.
export function viewFor(rec) {
  const f = rec?.f50 || rec?.f110;
  if (!f || !f.properties._ok) return null;
  const [lng, lat] = f.properties._center;
  const altitude = Math.min(2.4, Math.max(0.38, f.properties._span / 38));
  return { lat, lng, altitude };
}

// Attach features to records; create minimal records for unmatched shapes.
export function joinFeatures(ref, features, key) {
  const fallbackRecs = [];
  for (const f of features) {
    const num = f.id != null ? String(f.id).padStart(3, '0') : null;
    let rec = (num && ref.byNum.get(num)) || ref.byMapName.get(f.properties.name);
    if (!rec) {
      const name = f.properties.name || 'Unnamed territory';
      const a3 = 'X' + name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() + (fallbackRecs.length % 10);
      rec = { a3, a2: null, n: num, name, cap: null, region: '—', sub: '—', aka: [], f110: null, f50: null, neighbours: [], unlisted: true };
      ref.byA3.set(a3, rec);
      if (num) ref.byNum.set(num, rec);
      ref.byMapName.set(name, rec);
      fallbackRecs.push(rec);
    }
    rec[key] = f;
    f.properties._rec = rec;
  }
  // Land neighbours from shared topology arcs.
  features.forEach(f => {
    const rec = f.properties._rec;
    const list = f.properties._nb.map(i => features[i]?.properties._rec).filter(Boolean);
    if (key === 'f50' || !rec.neighbours.length) rec.neighbours = [...new Set(list)];
  });
  return fallbackRecs;
}

export function allRecords(ref) {
  return [...ref.byA3.values()].filter(r => r.f110 || r.f50)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Small countries visible only at 1:50m become tappable dots.
export function smallDots(ref) {
  return [...ref.byA3.values()]
    .filter(r => r.f50 && !r.f110 && r.f50.properties._ok)
    .map(r => ({ rec: r, lng: r.f50.properties._center[0], lat: r.f50.properties._center[1] }));
}
