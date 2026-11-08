// World Explorer 3D — application bootstrap and orchestration.
import { APP, CDN } from './config.js';
import { on } from './core/events.js';
import { detectCapabilities, applyQualityOverride, measureFps } from './core/tiers.js';
import { prefs, favourites, visited, resetAll } from './storage/prefs.js';
import { loadReference, loadWorld, joinFeatures, allRecords, smallDots, pickFeature, viewFor } from './data/world.js';
import { createGlobe3D } from './globe/globe3d.js';
import { createGlobe2D } from './globe/globe2d.js';
import * as panel from './ui/panel.js';
import * as V from './ui/views.js';
import { toast } from './ui/toast.js';
import { initStars } from './ui/stars.js';

const $ = s => document.querySelector(s);
const S = { ref: null, f110: null, f50: null, records: [], engine: null, mode: null, caps: null, selected: null, view: null };

boot().catch(fatal);

async function boot() {
  initStars();
  panel.initPanel();
  const p = prefs.get();
  S.caps = applyQualityOverride(detectCapabilities(), p.quality);
  const forceLite = new URLSearchParams(location.search).has('lite');
  S.mode = (!S.caps.webgl || p.mode === 'lite' || forceLite) ? 'lite' : '3d';

  setLoader('Loading the world map…');
  const [ref, f110] = await Promise.all([loadReference(), loadWorld(CDN.world110)]);
  S.ref = ref; S.f110 = f110;
  joinFeatures(ref, f110, 'f110');
  S.records = allRecords(ref);

  setLoader(S.mode === '3d' ? 'Rendering the Earth…' : 'Drawing the globe…');
  await startEngine();
  wireUI();
  new ResizeObserver(layout).observe($('#stage'));
  layout();
  route();
  addEventListener('hashchange', route);

  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 1200));
  idle(loadDetail, { timeout: 4000 });
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
    S.records = allRecords(S.ref);
    S.engine.setDots(smallDots(S.ref));
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

// ---------- Picking & navigation ----------
function handlePick({ record, lat, lng }) {
  let rec = null;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    rec = pickFeature(S.f50 || S.f110, lng, lat)?.properties._rec || null;
  }
  if (!rec && record) rec = record;
  if (rec) openCountry(rec);
  else if (S.view === 'country') goHome();
}

function openCountry(rec) {
  const h = `#/country/${rec.a3}`;
  if (location.hash === h) showCountry(rec, { fly: true });
  else location.hash = h;
}

function goHome() { if (location.hash && location.hash !== '#/') location.hash = '#/'; else route(); }

function route() {
  const [view = '', arg = ''] = location.hash.replace(/^#\/?/, '').split('/');
  setNav(view);
  if (view !== 'country') { S.selected = null; S.engine.setSelected(null); document.title = `${APP.name} — Interactive World History & Geography`; }
  switch (view) {
    case 'country': {
      const rec = S.ref.byA3.get(decodeURIComponent(arg).toUpperCase());
      if (rec && (rec.f110 || rec.f50)) showCountry(rec, { fly: true });
      else if (S.f50 || !rec) { toast('That place isn’t on the map.'); location.replace('#/'); }
      else { // 1:50m not loaded yet — show panel now, frame when shapes arrive
        S.pendingFly = true;
        showCountry(rec, { fly: false });
      }
      break;
    }
    case 'search': showSearch(); break;
    case 'favourites': showSaved(); break;
    case 'settings': showSettings(); break;
    case 'credits': S.view = 'credits'; panel.show(V.creditsView(S.ref.meta), { sheet: 'full' }); break;
    default: S.view = null; panel.close();
  }
}

function setNav(view) {
  const key = view === 'credits' ? 'settings' : view === 'country' || !view ? 'explore' : view;
  document.querySelectorAll('.nav [data-nav]').forEach(b => {
    if (b.dataset.nav === key) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

// ---------- Views ----------
function showCountry(rec, { fly = true, keepSheet = false } = {}) {
  const wasSame = S.selected === rec;
  S.selected = rec; S.view = 'country';
  S.engine.setSelected(rec.a3);
  if (!wasSame) visited.add(rec.a3);
  const sheet = keepSheet ? panel.getState() : (panel.getState() === 'full' ? 'full' : 'half');
  panel.show(V.countryView(rec, { isFav: favourites.has(rec.a3), reviewed: APP.dataReviewed }), { sheet: sheet === 'closed' ? 'half' : sheet });
  document.title = `${rec.name} · ${APP.name}`;
  if (fly) {
    const v = viewFor(rec);
    if (v) S.engine.flyTo(panel.isMobile() ? { ...v, altitude: Math.min(2.6, v.altitude * 1.3 + 0.1) } : v);
  }
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
      if (r) openCountry(r);
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

// ---------- Events ----------
function wireUI() {
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-route],[data-country],[data-action],[data-setting]');
    if (!t) return;
    if (t.dataset.route) {
      if (location.hash === t.dataset.route) route(); else location.hash = t.dataset.route;
    } else if (t.dataset.country) {
      const rec = S.ref.byA3.get(t.dataset.country);
      if (rec) openCountry(rec);
    } else if (t.dataset.setting) {
      applySetting(t.dataset.setting, t.dataset.value);
    } else {
      doAction(t.dataset.action, t);
    }
  });

  document.addEventListener('change', e => {
    const key = e.target.dataset?.toggle;
    if (!key) return;
    prefs.set({ [key]: e.target.checked });
    if (key === 'autoRotate') S.engine.setAutoRotate(e.target.checked);
    if (key === 'graticules') S.engine.setGraticules(e.target.checked);
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
    case 'surprise': surprise(); break;
    case 'centre': { const rec = S.ref.byA3.get(el.dataset.id); const v = rec && viewFor(rec); if (v) S.engine.flyTo(panel.isMobile() ? { ...v, altitude: v.altitude * 1.3 + 0.1 } : v); break; }
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
