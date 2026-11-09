// World Explorer 3D — application bootstrap and orchestration.
import { geoInterpolate } from 'd3-geo';
import { APP, CDN, COLORS } from './config.js';
import { on } from './core/events.js';
import { detectCapabilities, applyQualityOverride, measureFps } from './core/tiers.js';
import { prefs, favourites, visited, resetAll } from './storage/prefs.js';
import { loadReference, loadWorld, joinFeatures, allRecords, smallDots, pickFeature, viewFor } from './data/world.js';
import { content, flattenEvents, flattenPlaces, fmtYear } from './data/content.js';
import { basemapIndex, snapshotFor, loadSnapshot } from './data/history.js';
import { createGlobe3D } from './globe/globe3d.js';
import { createGlobe2D } from './globe/globe2d.js';
import * as panel from './ui/panel.js';
import * as V from './ui/views.js';
import { toast } from './ui/toast.js';
import { initStars } from './ui/stars.js';

const $ = s => document.querySelector(s);
const S = {
  ref: null, f110: null, f50: null, records: [], engine: null, mode: null, caps: null,
  selected: null, view: null, countryTab: 'overview',
  content: {}, events: [], places: [], periods: [], periodNote: '', routes: [], stories: {},
  scene: 'explore',          // 'explore' | 'time'
  tempMarker: null,
  time: { year: 117, periodId: 'classical', showBorders: true, compare: true,
          snapshot: null, overlay: null, loading: false, error: null, highlight: null, req: 0, focusEvent: null, focusRoute: null }
};

boot().catch(fatal);

async function boot() {
  initStars();
  panel.initPanel();
  const p = prefs.get();
  S.caps = applyQualityOverride(detectCapabilities(), p.quality);
  const forceLite = new URLSearchParams(location.search).has('lite');
  S.mode = (!S.caps.webgl || p.mode === 'lite' || forceLite) ? 'lite' : '3d';

  setLoader('Loading the world map…');
  const [ref, f110] = await Promise.all([loadReference(), loadWorld(CDN.world110), loadContent()]);
  S.ref = ref; S.f110 = f110;
  joinFeatures(ref, f110, 'f110');
  for (const a3 of Object.keys(S.content)) { const r = ref.byA3.get(a3); if (r) r.hasContent = true; }
  S.records = allRecords(ref);

  setLoader(S.mode === '3d' ? 'Rendering the Earth…' : 'Drawing the globe…');
  await startEngine();
  wireUI();
  new ResizeObserver(layout).observe($('#stage'));
  layout();
  updateScene();
  route();
  addEventListener('hashchange', route);

  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 1200));
  idle(loadDetail, { timeout: 4000 });
  idle(() => basemapIndex().catch(() => {}), { timeout: 8000 });
}

async function loadContent() {
  try {
    const [countries, periods, routes] = await Promise.all([
      content.allCountries(), content.periods(), content.routes()
    ]);
    S.content = countries;
    S.events = flattenEvents(countries);
    S.places = flattenPlaces(countries);
    S.periods = periods.periods; S.periodNote = periods.note;
    S.routes = routes.routes.map(r => ({ ...r, pts: densify(r.stops) }));
  } catch (err) {
    console.warn('[content] unavailable', err);
  }
}

// Great-circle densification so 3D paths hug the globe (and cross the antimeridian cleanly).
function densify(stops) {
  const out = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = [stops[i].lng, stops[i].lat], b = [stops[i + 1].lng, stops[i + 1].lat];
    const interp = geoInterpolate(a, b);
    const n = 24;
    for (let k = 0; k < n; k++) out.push(interp(k / n));
  }
  const last = stops[stops.length - 1];
  out.push([last.lng, last.lat]);
  return out;
}

async function startEngine() {
  const container = $('#globe');
  let markReady;
  const ready = new Promise(res => { markReady = res; });
  const common = { caps: S.caps, prefs: prefs.get(), features: S.f110, onPick: handlePick, onReady: () => markReady() };

  if (S.mode === '3d') {
    try {
      S.engine = await createGlobe3D(container, { ...common, onContextLost });
    } catch (err) {
      console.warn('[3D] falling back to Lite mode:', err);
      container.innerHTML = '';
      S.mode = 'lite';
      S.engine = createGlobe2D(container, common);
      toast('3D graphics could not start on this connection or device, so Lite mode is on. Everything else works the same.', { duration: 8000 });
    }
  } else {
    S.engine = createGlobe2D(container, common);
  }
  $('#modeBadge').hidden = S.mode !== 'lite';
  layout();
  await Promise.race([ready, new Promise(r => setTimeout(r, 10000))]);
  hideLoader();
  if (S.mode === '3d') setTimeout(probeFps, 2500);
}

async function probeFps() {
  const fps = await measureFps(3000);
  if (fps < 22 && S.mode === '3d' && prefs.get().mode !== '3d') {
    toast(`The 3D globe is running at about ${Math.round(fps)} frames per second here. Lite mode will feel smoother.`, {
      action: 'Use Lite mode', duration: 14000,
      onAction: () => { prefs.set({ mode: 'lite' }); location.reload(); }
    });
  }
}

function onContextLost() {
  toast('The device paused 3D graphics.', { action: 'Reload', duration: 0, onAction: () => location.reload() });
}

async function loadDetail() {
  try {
    S.f50 = await loadWorld(CDN.world50);
    joinFeatures(S.ref, S.f50, 'f50');
    for (const a3 of Object.keys(S.content)) { const r = S.ref.byA3.get(a3); if (r) r.hasContent = true; }
    S.records = allRecords(S.ref);
    updateScene();
    if (S.view === 'country' && S.selected) {
      showCountry(S.selected, { fly: !!S.pendingFly, keepSheet: true });
      S.pendingFly = false;
    }
    if (S.view === 'search') runSearch($('#searchInput')?.value || '');
  } catch (err) {
    console.warn('[data] 1:50m detail unavailable; continuing with 1:110m', err);
  }
}

function layout() {
  const r = $('#stage').getBoundingClientRect();
  S.engine?.resize(Math.round(r.width), Math.round(r.height));
}

// ---------- Scene composition ----------
function timeWindow() {
  const t = S.time;
  const p = S.periods.find(x => x.id === t.periodId);
  if (p) return [p.start, p.end];
  const y = t.year, span = y < -3000 ? 2000 : y < 500 ? 300 : y < 1500 ? 150 : 40;
  return [y - span, y + span];
}
const overlaps = (a1, a2, b1, b2) => a1 <= b2 && b1 <= a2;
function eventsInWindow() {
  const [a, b] = timeWindow();
  return S.events.filter(e => overlaps(e.y, e.y2 ?? e.y, a, b));
}
function routesInWindow() {
  const [a, b] = timeWindow();
  return S.routes.filter(r => overlaps(r.start, r.end, a, b));
}
const EVENT_COLOR = { established: '#f3d38a', probable: '#f3d38a', debated: '#ffab66', legend: '#c7a6ff', debunked: '#ff7a8a' };

function updateScene() {
  if (!S.engine) return;
  const markers = [];
  if (S.scene === 'explore') {
    for (const d of smallDots(S.ref)) {
      const sel = d.rec === S.selected;
      markers.push({ kind: 'dot', lat: d.lat, lng: d.lng, r: sel ? 0.4 : 0.3, alt: 0.012, color: sel ? COLORS.goldBright : COLORS.gold, label: d.rec.name, rec: d.rec });
    }
    for (const p of S.places) {
      const sel = S.selected?.a3 === p.country;
      markers.push({ kind: 'place', lat: p.lat, lng: p.lng, r: sel ? 0.5 : 0.38, alt: sel ? 0.03 : 0.02, color: sel ? '#aee6ff' : '#5fb8e6', label: p.name, place: p });
    }
    if (S.tempMarker) markers.push(S.tempMarker);
    S.engine.setScene({ overlay: null, compare: S.time.compare, markers, paths: [] });
    updateTimeChip();
    return;
  }
  // Time travel
  const evs = S.time.focusEvent ? [S.time.focusEvent, ...eventsInWindow().filter(e => e.id !== S.time.focusEvent.id)] : eventsInWindow();
  for (const e of evs) {
    if (!e.location) continue;
    const focus = S.time.focusEvent?.id === e.id;
    markers.push({ kind: 'event', lat: e.location.lat, lng: e.location.lng, r: focus ? 0.7 : 0.45, alt: focus ? 0.06 : 0.035, color: focus ? '#ffffff' : EVENT_COLOR[e.confidence], label: `${e.display} · ${e.title}`, event: e });
  }
  const routes = S.time.focusRoute ? S.routes.filter(r => r.id === S.time.focusRoute) : routesInWindow();
  const paths = routes.map(r => ({ id: r.id, name: r.name, color: r.color, pts: r.pts }));
  const overlay = S.time.showBorders ? S.time.overlay : null;
  S.engine.setScene({ overlay, compare: S.time.compare, markers, paths });
  updateTimeChip();
}

function setScene(mode) {
  S.enteredTime = mode === 'time' && S.scene !== 'time';
  if (S.scene === mode) return;
  S.scene = mode;
  document.body.classList.toggle('time-mode', mode === 'time');
  if (mode === 'explore') { S.time.focusEvent = null; S.time.focusRoute = null; }
  else { S.selected = null; S.engine.setSelected(null); }
  updateScene();
}

function updateTimeChip() {
  const chip = $('#timeChip');
  if (S.scene !== 'time') { chip.hidden = true; return; }
  chip.hidden = false;
  const t = S.time;
  let txt = fmtYear(t.year);
  if (t.showBorders) txt += t.loading ? ' · loading borders…' : t.snapshot ? ` · borders c. ${fmtYear(t.snapshot.year)} (approximate)` : '';
  $('#timeChipText').textContent = txt;
}

// Load (or reuse) the border snapshot for the current year.
async function refreshOverlay({ highlight = null } = {}) {
  const t = S.time;
  const req = ++t.req;
  if (!t.showBorders) { t.overlay = null; updateScene(); return; }
  t.error = null;
  try {
    const snap = await snapshotFor(t.year);
    if (req !== t.req) return;
    if (!snap) throw new Error('none');
    const sameSnap = t.snapshot && t.snapshot.file === snap.file && t.overlay;
    const hlKey = highlight ? String(highlight) : null;
    if (sameSnap && t.overlay._hl === hlKey) { updateScene(); return; }
    t.loading = !sameSnap; t.snapshot = snap; updateTimeChip(); rerenderTimeView();
    const feats = await loadSnapshot(snap);
    if (req !== t.req) return;
    t.overlay = { features: feats, highlight, yearLabel: fmtYear(snap.year), _hl: hlKey };
  } catch (err) {
    if (req !== t.req) return;
    console.warn('[history] overlay failed', err);
    t.overlay = null;
    t.error = 'Historical borders could not be downloaded right now. Events and routes still work.';
  }
  t.loading = false;
  updateScene();
  rerenderTimeView();
}

// ---------- Picking & navigation ----------
function handlePick({ record, lat, lng, polity, route, marker }) {
  if (marker) {
    if (marker.kind === 'dot') return openCountry(marker.rec);
    if (marker.kind === 'place') return go(`#/place/${marker.place.country}/${marker.place.id}`);
    if (marker.kind === 'event') return go(`#/event/${marker.event.id}`);
    return;
  }
  if (route) return go(`#/route/${route}`);
  if (S.scene === 'time') {
    let f = polity;
    if (!f && S.time.overlay && S.time.showBorders && Number.isFinite(lat)) f = pickFeature(S.time.overlay.features, lng, lat);
    if (f) { S.view = 'polity'; panel.show(V.polityView(f), { sheet: 'half' }); }
    return;
  }
  let rec = null;
  if (Number.isFinite(lat) && Number.isFinite(lng)) rec = pickFeature(S.f50 || S.f110, lng, lat)?.properties._rec || null;
  if (!rec && record) rec = record;
  if (rec) openCountry(rec);
  else if (S.view === 'country' || S.view === 'place') goHome();
}

function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
function openCountry(rec) { go(`#/country/${rec.a3}`); }
function goHome() { if (location.hash && location.hash !== '#/') location.hash = '#/'; else route(); }

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const [view = '', a = '', b = ''] = parts;
  setNav(view);
  const timeViews = ['timeline', 'event', 'story', 'route'];
  setScene(timeViews.includes(view) ? 'time' : 'explore');
  if (view !== 'country' && view !== 'place') {
    S.selected = null; S.engine.setSelected(null); S.tempMarker = null;
    document.title = `${APP.name} — Interactive World History & Geography`;
  }
  if (view !== 'event') S.time.focusEvent = null;
  if (view !== 'route') S.time.focusRoute = null;

  switch (view) {
    case 'country': {
      const rec = S.ref.byA3.get(a.toUpperCase());
      if (!rec || !(rec.f110 || rec.f50)) {
        if (rec && !S.f50) { S.pendingFly = true; S.countryTab = 'overview'; showCountry(rec, { fly: false }); break; }
        toast('That place isn’t on the map.'); location.replace('#/'); break;
      }
      const tab = ['overview', 'history', 'places'].includes(b) ? b : (S.selected === rec ? S.countryTab : 'overview');
      S.countryTab = tab;
      showCountry(rec, { fly: S.selected !== rec || !b });
      break;
    }
    case 'place': return showPlace(a.toUpperCase(), b);
    case 'search': showSearch(); break;
    case 'favourites': showSaved(); break;
    case 'settings': showSettings(); break;
    case 'credits': S.view = 'credits'; panel.show(V.creditsView(S.ref.meta), { sheet: 'full' }); break;
    case 'timeline': showTimeline(); break;
    case 'event': showEvent(a); break;
    case 'story': showStory(a, parseInt(b, 10) || 0); break;
    case 'route': showRoute(a); break;
    default: S.view = null; panel.close(); updateScene();
  }
}

function setNav(view) {
  const map = { credits: 'settings', country: 'explore', place: 'explore', '': 'explore', event: 'timeline', story: 'timeline', route: 'timeline' };
  const key = map[view] ?? view;
  document.querySelectorAll('.nav [data-nav]').forEach(b => {
    if (b.dataset.nav === key) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

// ---------- Explore views ----------
function showCountry(rec, { fly = true, keepSheet = false } = {}) {
  const wasSame = S.selected === rec;
  S.selected = rec; S.view = 'country';
  if (!wasSame) S.tempMarker = null;
  S.engine.setSelected(rec.a3);
  updateScene();
  if (!wasSame) visited.add(rec.a3);
  const sheet = keepSheet ? panel.getState() : (panel.getState() === 'full' ? 'full' : 'half');
  const html = V.countryView(rec, { isFav: favourites.has(rec.a3), reviewed: APP.dataReviewed, content: S.content[rec.a3], tab: S.countryTab });
  if (wasSame && panel.getState() !== 'closed') panel.update(html);
  else panel.show(html, { sheet: sheet === 'closed' || sheet === 'peek' ? 'half' : sheet });
  document.title = `${rec.name} · ${APP.name}`;
  if (fly) flyToRecord(rec);
}

function flyToRecord(rec) {
  const v = viewFor(rec);
  if (v) S.engine.flyTo(panel.isMobile() ? { ...v, altitude: Math.min(2.6, v.altitude * 1.3 + 0.1) } : v);
}
function flyToPoint(lat, lng, altitude = 0.45) {
  S.engine.flyTo({ lat, lng, altitude: panel.isMobile() ? altitude * 1.3 + 0.1 : altitude });
}

function showPlace(a3, id) {
  const c = S.content[a3];
  const place = c?.places.find(p => p.id === id);
  if (!place) { toast('That place could not be found.'); location.replace('#/'); return; }
  const rec = S.ref.byA3.get(a3);
  S.view = 'place';
  if (rec) { S.selected = rec; S.engine.setSelected(a3); }
  S.tempMarker = null;
  updateScene();
  panel.show(V.placeView(place, c, rec), { sheet: 'half' });
  document.title = `${place.name} · ${APP.name}`;
  flyToPoint(place.lat, place.lng, 0.35);
}

function showSearch() {
  S.view = 'search';
  panel.show(V.searchView(), { sheet: 'full' });
  const input = $('#searchInput');
  runSearch('');
  input.addEventListener('input', () => runSearch(input.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = searchState.results.length;
      if (!n) return;
      searchState.active = (searchState.active + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
      renderResults();
      $('#searchResults .is-active')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      const r = searchState.results[Math.max(0, searchState.active)];
      if (!r) return;
      if (r.kind === 'place') go(`#/place/${r.country}/${r.id}`); else openCountry(r);
    } else if (e.key === 'Escape') { goHome(); }
  });
  setTimeout(() => input.focus({ preventScroll: true }), 60);
}

const searchState = { results: [], active: -1 };
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function runSearch(q) {
  const nq = norm(q);
  let results;
  if (!nq) results = S.records;
  else {
    const scored = [];
    for (const r of S.records) {
      const name = norm(r.name);
      let s = -1;
      if ([r.a2, r.a3].some(c => c && c.toLowerCase() === nq)) s = 0;
      else if (name.startsWith(nq)) s = 1;
      else if (name.split(/[\s-]/).some(w => w.startsWith(nq))) s = 2;
      else if (r.aka.some(a => norm(a).startsWith(nq))) s = 3;
      else if (name.includes(nq)) s = 4;
      else if (r.cap && norm(r.cap).startsWith(nq)) s = 5;
      if (s >= 0) scored.push([s, r]);
    }
    for (const p of S.places) {
      const name = norm(p.name);
      let s = -1;
      if (name.startsWith(nq)) s = 2;
      else if (name.split(/[\s,()&-]+/).some(w => w.startsWith(nq))) s = 3;
      else if (name.includes(nq)) s = 5;
      if (s >= 0) scored.push([s + 0.5, { ...p, kind: 'place' }]);
    }
    results = scored.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name)).map(x => x[1]);
  }
  searchState.results = results;
  searchState.active = nq && results.length ? 0 : -1;
  renderResults();
}
function renderResults() {
  const ul = $('#searchResults');
  if (ul) ul.innerHTML = V.resultItems(searchState.results, searchState.active);
}

function showSaved() {
  S.view = 'favourites';
  const get = id => S.ref.byA3.get(id);
  const valid = visited.list().map(v => get(v.id)).filter(r => r && (r.f110 || r.f50));
  panel.show(V.savedView({
    favs: favourites.list().map(get).filter(Boolean),
    recent: valid.slice(0, 8),
    explored: valid.length,
    total: S.records.length
  }), { sheet: 'full' });
}

function showSettings() {
  S.view = 'settings';
  panel.show(V.settingsView(prefs.get(), S.caps, S.mode), { sheet: 'full' });
}

// ---------- Time views ----------
const YEAR_KNOTS = [[0, -10000], [150, -3000], [300, -500], [450, 500], [650, 1500], [820, 1800], [1000, 2026]];
function posToYear(pos) {
  for (let i = 1; i < YEAR_KNOTS.length; i++) {
    const [p1, y1] = YEAR_KNOTS[i - 1], [p2, y2] = YEAR_KNOTS[i];
    if (pos <= p2) { const y = y1 + (y2 - y1) * (pos - p1) / (p2 - p1); return roundYear(y); }
  }
  return 2026;
}
function yearToPos(year) {
  for (let i = 1; i < YEAR_KNOTS.length; i++) {
    const [p1, y1] = YEAR_KNOTS[i - 1], [p2, y2] = YEAR_KNOTS[i];
    if (year <= y2) return Math.round(p1 + (p2 - p1) * (year - y1) / (y2 - y1));
  }
  return 1000;
}
function roundYear(y) {
  const step = y < -3000 ? 100 : y < 0 ? 10 : y < 1500 ? 5 : 1;
  let r = Math.round(y / step) * step;
  if (r === 0) r = y < 0 ? -1 : 1;
  return r;
}

function timelineHTML() {
  const t = S.time;
  const events = eventsInWindow().map(e => ({ ...e, countryName: S.ref.byA3.get(e.country)?.name || e.country }));
  return V.timelineView({
    periods: S.periods, note: S.periodNote, year: t.year, periodId: t.periodId,
    events, routes: routesInWindow(), snapshot: t.snapshot, showBorders: t.showBorders, compare: t.compare,
    loading: t.loading, error: t.error
  });
}

function showTimeline() {
  S.view = 'timeline';
  S.time.focusEvent = null; S.time.focusRoute = null;
  panel.show(timelineHTML(), { sheet: panel.getState() === 'full' ? 'full' : 'half' });
  bindSlider();
  if (S.enteredTime) {
    const p = S.periods.find(x => x.id === S.time.periodId);
    const v = p?.view || { lat: 30, lng: 40, altitude: 2.4 };
    S.engine.flyTo(panel.isMobile() ? { ...v, altitude: Math.min(3.2, v.altitude * 1.2) } : v);
  }
  document.title = `Timeline · ${APP.name}`;
  refreshOverlay();
  updateScene();
}

function rerenderTimeView() {
  if (S.view === 'timeline') { panel.update(timelineHTML()); bindSlider(); }
  else if (S.view === 'story' && S.story) panel.update(V.storyView(S.story.data, S.story.i, S.time));
}

function bindSlider() {
  const sl = $('#yearSlider');
  if (!sl) return;
  sl.value = yearToPos(S.time.year);
  const live = () => {
    const y = posToYear(+sl.value);
    $('#tTitle').textContent = fmtYear(y);
    sl.setAttribute('aria-valuetext', fmtYear(y));
  };
  sl.addEventListener('input', live);
  sl.addEventListener('change', () => setYear(posToYear(+sl.value)));
}

function setYear(y, { keepPeriod = false } = {}) {
  const t = S.time;
  t.year = y;
  if (!keepPeriod) {
    const p = S.periods.find(x => x.id === t.periodId);
    if (!p || y < p.start || y > p.end) t.periodId = null;
  }
  if (S.view === 'timeline') { panel.update(timelineHTML()); bindSlider(); }
  updateScene();
  refreshOverlay();
}

async function stepSnapshot(dir) {
  try {
    const list = await basemapIndex();
    const cur = S.time.year;
    const next = dir > 0 ? list.find(e => e.year > cur) : [...list].reverse().find(e => e.year < cur);
    if (next) setYear(next.year);
  } catch {
    setYear(roundYear(S.time.year + dir * 100));
  }
}

function showEvent(id) {
  const e = S.events.find(x => x.id === id);
  if (!e) { toast('That event could not be found.'); location.replace('#/timeline'); return; }
  S.view = 'event';
  S.time.focusEvent = e;
  S.time.year = e.y;
  const p = S.periods.filter(x => e.y >= x.start && e.y <= x.end).sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
  S.time.periodId = p?.id || null;
  const c = S.content[e.country];
  panel.show(V.eventView(e, c, S.ref.byA3.get(e.country)), { sheet: 'half' });
  document.title = `${e.title} · ${APP.name}`;
  if (e.location) flyToPoint(e.location.lat, e.location.lng, 0.6);
  updateScene();
  refreshOverlay();
}

async function showStory(id, i) {
  try {
    const data = S.stories[id] || (S.stories[id] = await content.story(id));
    i = Math.max(0, Math.min(data.steps.length - 1, i));
    S.view = 'story'; S.story = { data, i };
    const step = data.steps[i];
    S.time.year = step.year; S.time.periodId = null;
    if (!S.time.showBorders) S.time.showBorders = true;
    panel.show(V.storyView(data, i, S.time), { sheet: 'half' });
    document.title = `${data.title} · ${APP.name}`;
    S.engine.flyTo(panel.isMobile() ? { ...step.view, altitude: step.view.altitude * 1.25 + 0.1 } : step.view);
    updateScene();
    refreshOverlay({ highlight: new RegExp(data.match) });
  } catch (err) {
    console.warn(err); toast('This story could not be loaded.'); location.replace('#/timeline');
  }
}

function showRoute(id) {
  const r = S.routes.find(x => x.id === id);
  if (!r) { toast('That route could not be found.'); location.replace('#/timeline'); return; }
  S.view = 'route';
  S.time.focusRoute = id;
  panel.show(V.routeView(r), { sheet: 'half' });
  document.title = `${r.name} · ${APP.name}`;
  const mid = r.stops[Math.floor(r.stops.length / 2)];
  S.engine.flyTo({ lat: mid.lat, lng: mid.lng, altitude: panel.isMobile() ? 2.6 : 2.0 });
  updateScene();
}

// ---------- Events ----------
function wireUI() {
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-route],[data-country],[data-action],[data-setting]');
    if (!t || t.disabled) return;
    if (t.dataset.route) go(t.dataset.route);
    else if (t.dataset.country) { const rec = S.ref.byA3.get(t.dataset.country); if (rec) openCountry(rec); }
    else if (t.dataset.setting) applySetting(t.dataset.setting, t.dataset.value);
    else doAction(t.dataset.action, t);
  });

  document.addEventListener('change', e => {
    const key = e.target.dataset?.toggle;
    if (key) {
      prefs.set({ [key]: e.target.checked });
      if (key === 'autoRotate') S.engine.setAutoRotate(e.target.checked);
      if (key === 'graticules') S.engine.setGraticules(e.target.checked);
      return;
    }
    const tk = e.target.dataset?.time;
    if (tk) {
      S.time[tk] = e.target.checked;
      if (tk === 'showBorders') refreshOverlay(); else updateScene();
      rerenderTimeView();
    }
  });

  on('panel:dismiss', goHome);

  document.addEventListener('keydown', e => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); location.hash = '#/search'; return; }
    if (e.key === 'Escape') { if (panel.getState() !== 'closed') goHome(); return; }
    const onGlobe = e.target === document.body || e.target.id === 'globe';
    if (!onGlobe) return;
    const step = 12 * Math.min(1, S.engine.getAltitude());
    const k = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (k) { e.preventDefault(); S.engine.rotateBy(k[0], k[1]); }
    else if (e.key === '+' || e.key === '=') S.engine.zoomBy(0.7);
    else if (e.key === '-' || e.key === '_') S.engine.zoomBy(1.4);
    else if (e.key === 'Enter' && e.target.id === 'globe') {
      const c = S.engine.getCenter();
      if (S.scene === 'time') { handlePick({ lat: c.lat, lng: c.lng }); return; }
      const rec = pickFeature(S.f50 || S.f110, c.lng, c.lat)?.properties._rec;
      if (rec) openCountry(rec); else toast('Open ocean here — rotate onto a country and press Enter.');
    }
  });
}

function doAction(action, el) {
  switch (action) {
    case 'zoom-in': S.engine.zoomBy(0.7); break;
    case 'zoom-out': S.engine.zoomBy(1.4); break;
    case 'home': S.engine.reset(); break;
    case 'close': goHome(); break;
    case 'exit-time': goHome(); break;
    case 'surprise': surprise(); break;
    case 'centre': { const rec = S.ref.byA3.get(el.dataset.id); if (rec) flyToRecord(rec); break; }
    case 'tab': {
      if (!S.selected) break;
      S.countryTab = el.dataset.tab;
      history.replaceState(null, '', `#/country/${S.selected.a3}/${S.countryTab}`);
      showCountry(S.selected, { fly: false, keepSheet: true });
      panel.bodyEl().scrollTop = 0;
      break;
    }
    case 'show-event': {
      const e = S.events.find(x => x.id === el.dataset.id);
      if (!e?.location) break;
      S.tempMarker = { kind: 'temp', lat: e.location.lat, lng: e.location.lng, r: 0.7, alt: 0.06, color: '#ffffff', label: `${e.display} · ${e.location.label}` };
      updateScene();
      flyToPoint(e.location.lat, e.location.lng, 0.5);
      if (panel.isMobile()) panel.setState('peek');
      toast(`📍 ${e.location.label}`, { duration: 3500 });
      break;
    }
    case 'fly-place': {
      const [a3, id] = el.dataset.id.split('/');
      const p = S.content[a3]?.places.find(x => x.id === id);
      if (p) { flyToPoint(p.lat, p.lng, 0.3); if (panel.isMobile()) panel.setState('peek'); }
      break;
    }
    case 'fly-stop': {
      const r = S.routes.find(x => x.id === el.dataset.routeId);
      const s = r?.stops[+el.dataset.i];
      if (s) { flyToPoint(s.lat, s.lng, 0.8); if (panel.isMobile()) panel.setState('peek'); }
      break;
    }
    case 'period': {
      const p = S.periods.find(x => x.id === el.dataset.id);
      if (!p) break;
      S.time.periodId = p.id;
      S.engine.flyTo(panel.isMobile() ? { ...p.view, altitude: Math.min(3.2, p.view.altitude * 1.2) } : p.view);
      setYear(p.snapshot, { keepPeriod: true });
      break;
    }
    case 'year-step': stepSnapshot(+el.dataset.dir); break;
    case 'back-time': route(); break;
    case 'fav': {
      const id = el.dataset.id, onNow = favourites.toggle(id);
      el.classList.toggle('is-on', onNow);
      el.setAttribute('aria-pressed', String(onNow));
      el.querySelector('span').textContent = onNow ? 'Saved' : 'Save';
      break;
    }
    case 'share': share(S.ref.byA3.get(el.dataset.id)); break;
    case 'reset-data': {
      if (el.dataset.armed) { resetAll(); toast('Saved countries, progress and settings were cleared.'); showSettings(); }
      else {
        el.dataset.armed = '1'; el.textContent = 'Tap again to clear everything';
        setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = 'Clear saved data'; } }, 4000);
      }
      break;
    }
  }
}

function applySetting(key, value) {
  const before = prefs.get()[key];
  prefs.set({ [key]: value });
  if (key === 'texture') { S.engine.setTexture(value); showSettings(); return; }
  if ((key === 'mode' || key === 'quality') && before !== value) {
    toast('Applying…', { duration: 1500 });
    setTimeout(() => {
      const url = new URL(location.href); url.searchParams.delete('lite');
      if (url.toString() !== location.href) location.replace(url.toString());
      else location.reload();
    }, 300);
    return;
  }
  showSettings();
}

function surprise() {
  const seen = new Set(visited.list().map(v => v.id));
  // Half the time, surprise with a researched place or event instead of a country.
  if (S.places.length && Math.random() < 0.5) {
    const pick = Math.random() < 0.5 && S.events.length
      ? S.events[Math.floor(Math.random() * S.events.length)]
      : null;
    if (pick) return go(`#/event/${pick.id}`);
    const p = S.places[Math.floor(Math.random() * S.places.length)];
    return go(`#/place/${p.country}/${p.id}`);
  }
  const pool = S.records.filter(r => !r.unlisted && r.region !== 'Antarctica');
  const fresh = pool.filter(r => !seen.has(r.a3));
  const list = fresh.length ? fresh : pool;
  const rec = list[Math.floor(Math.random() * list.length)];
  if (rec) openCountry(rec);
}

async function share(rec) {
  if (!rec) return;
  const url = `${location.origin}${location.pathname}#/country/${rec.a3}`;
  try {
    if (navigator.share && S.caps.coarse) { await navigator.share({ title: `${rec.name} · ${APP.name}`, url }); return; }
    await navigator.clipboard.writeText(url);
    toast('Link copied.');
  } catch (err) {
    if (err?.name !== 'AbortError') toast(url, { duration: 9000 });
  }
}

// ---------- Loader ----------
function setLoader(text) { $('#loaderText').textContent = text; }
function hideLoader() { $('#loader').classList.add('done'); }
function fatal(err) {
  console.error(err);
  $('#loaderText').textContent = 'The world map could not be loaded.';
  $('#loaderErrorText').textContent = navigator.onLine === false
    ? 'You appear to be offline. Connect to the internet and try again.'
    : 'A map file failed to download. This is usually temporary.';
  $('#loaderError').hidden = false;
  $('#retryBtn').onclick = () => location.reload();
  $('#liteBtn').onclick = () => { prefs.set({ mode: 'lite' }); location.reload(); };
}
