// HTML templates for each panel view. Pure functions: data in, markup out.
import { CDN, APP } from '../config.js';
import { CONFIDENCE, fmtYear } from '../data/content.js';
import { PRECISION_TEXT } from '../data/history.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICON = {
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.1 1.2 6L12 16.4 6.6 19.4l1.2-6L3.3 9.3l6.1-.7z"/></svg>',
  target: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>'
};

function flagImg(rec, cls, w = 160) {
  const src = CDN.flag(rec?.a2, w);
  if (!src) return `<span class="${cls} flag-ph" aria-hidden="true"></span>`;
  return `<img class="${cls}" src="${src}" alt="" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">`;
}

export function badge(conf) {
  const c = CONFIDENCE[conf] || CONFIDENCE.established;
  return `<span class="conf conf-${esc(conf)}" title="${esc(c.hint)}">${esc(c.label)}</span>`;
}

function sourceList(ids, dict) {
  const items = (ids || []).map(id => (typeof id === 'string' ? dict?.[id] : id)).filter(Boolean);
  if (!items.length) return '';
  return `<ul class="src-list">${items.map(s => `<li>${s.url
    ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}
    <span class="muted"> — ${esc(s.publisher)}${s.accessed ? `, accessed ${esc(s.accessed)}` : ''}</span></li>`).join('')}</ul>`;
}

const fmtNum = n => Number(n).toLocaleString('en');

// ---------- Country ----------
export function countryView(rec, { isFav, reviewed, content, tab = 'overview' }) {
  const codes = [rec.a2, rec.a3.startsWith('X') ? null : rec.a3, rec.n].filter(Boolean).join(' · ');
  const capital = rec.cap
    ? `${esc(rec.cap)}${rec.capNote ? `<small>${esc(rec.capNote)}</small>` : ''}`
    : `<span class="muted">None</span>${rec.capNote ? `<small>${esc(rec.capNote)}</small>` : ''}`;
  const neighbours = rec.neighbours.length
    ? `<div class="chips">${rec.neighbours.map(n => `<button class="chip" data-country="${esc(n.a3)}">${flagImg(n, '', 40)}${esc(n.name)}</button>`).join('')}</div>`
    : `<p class="muted small">No shared land border in the Natural Earth outlines — ${rec.region === 'Antarctica' ? 'an isolated polar territory' : 'an island or maritime territory'}.</p>`;

  const hero = `
    <div class="c-hero">
      ${flagImg(rec, 'c-flag', 320).replace('alt=""', `alt="Flag of ${esc(rec.name)}"`)}
      <div>
        <p class="eyebrow">${esc(rec.sub)}${rec.sub !== rec.region ? ` · ${esc(rec.region)}` : ''}</p>
        <h2 id="cTitle">${esc(rec.name)}</h2>
        ${rec.sov ? `<p class="c-sov">Territory · ${esc(rec.sov)}</p>` : ''}
      </div>
    </div>
    <div class="c-actions">
      <button class="btn ${isFav ? 'is-on' : ''}" data-action="fav" data-id="${esc(rec.a3)}" aria-pressed="${isFav}">${ICON.star}<span>${isFav ? 'Saved' : 'Save'}</span></button>
      <button class="btn" data-action="centre" data-id="${esc(rec.a3)}">${ICON.target}<span>Centre</span></button>
      <button class="btn" data-action="share" data-id="${esc(rec.a3)}">${ICON.link}<span>Copy link</span></button>
    </div>`;

  const basics = `
    <dl class="facts">
      <div class="fact wide"><dt>Capital</dt><dd>${capital}</dd></div>
      ${content ? statFacts(content) : ''}
      <div class="fact"><dt>Region</dt><dd>${esc(rec.region)}</dd></div>
      <div class="fact"><dt>ISO codes</dt><dd>${codes ? esc(codes) : '<span class="muted">Not assigned</span>'}</dd></div>
    </dl>
    ${rec.note ? `<p class="callout"><b>Status note.</b> ${esc(rec.note)}</p>` : ''}`;

  const baseSources = `
      <li>Shape &amp; land borders: Natural Earth admin-0 countries (public domain), de facto boundaries.</li>
      <li>Capital, codes &amp; region: ISO 3166-1 and UN M49 reference list, reviewed ${esc(reviewed)}.</li>
      ${rec.a2 ? '<li>Flag image: flagcdn.com.</li>' : ''}`;

  if (!content) {
    return `<article class="country" aria-labelledby="cTitle">${hero}${basics}
      <h3 class="section">Land borders</h3>${neighbours}
      <p class="muted small" style="margin-top:18px">A full profile with history and famous places is available for Malaysia, the Philippines, Japan, Egypt and Italy so far.</p>
      <footer class="sources"><h4>Sources</h4><ul>${baseSources}</ul></footer></article>`;
  }

  const tabs = [['overview', 'Overview'], ['history', 'History'], ['places', 'Places']];
  const tabBar = `<div class="tabs" role="tablist">${tabs.map(([id, label]) =>
    `<button role="tab" data-action="tab" data-tab="${id}" aria-selected="${tab === id}">${label}</button>`).join('')}</div>`;

  let body = '';
  if (tab === 'overview') body = overviewTab(rec, content, basics, neighbours, baseSources);
  else if (tab === 'history') body = historyTab(rec, content);
  else body = placesTab(rec, content);

  return `<article class="country" aria-labelledby="cTitle">${hero}${tabBar}<div class="tab-body">${body}</div></article>`;
}

function statFacts(c) {
  const s = c.overview.stats;
  const out = [];
  if (s.population) out.push(`<div class="fact"><dt>Population</dt><dd>${fmtNum(s.population.value)}<small>World Bank, ${esc(s.population.year)} estimate</small></dd></div>`);
  if (s.land_area_km2) out.push(`<div class="fact"><dt>Land area</dt><dd>${fmtNum(s.land_area_km2.value)} km²<small>World Bank, ${esc(s.land_area_km2.year)}</small></dd></div>`);
  out.push(`<div class="fact"><dt>Currency</dt><dd>${esc(c.overview.currency.name)}<small>${esc(c.overview.currency.code)}</small></dd></div>`);
  return out.join('');
}

function overviewTab(rec, c, basics, neighbours, baseSources) {
  const o = c.overview;
  const list = arr => `<ul class="bullets">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  return `
    <p class="lede big">${esc(o.summary)}</p>
    ${basics}
    <h3 class="section">Languages</h3>${list(o.languages)}
    <h3 class="section">Government</h3><p class="body">${esc(o.government)}</p>
    <h3 class="section">Geography</h3>${list(o.geography)}
    <h3 class="section">Climate</h3><p class="body">${esc(o.climate)}</p>
    <h3 class="section">Culture</h3>${list(o.culture)}
    <h3 class="section">Land borders</h3>${neighbours}
    <footer class="sources"><h4>Sources</h4><ul>${baseSources}</ul>${sourceList(o.sources, c.sources)}</footer>`;
}

function historyTab(rec, c) {
  return `
    <p class="muted small legend-row">Each entry is labelled: ${['established', 'probable', 'debated', 'legend', 'debunked'].map(badge).join(' ')}</p>
    <ol class="events">${c.history.map(e => `
      <li class="event" id="ev-${esc(e.id)}">
        <div class="ev-date">${esc(e.display)}</div>
        <div class="ev-card">
          <p class="ev-era">${esc(e.era)} ${badge(e.confidence)}</p>
          <h4>${esc(e.title)}</h4>
          <p>${esc(e.text)}</p>
          ${e.note ? `<p class="ev-note"><b>Note:</b> ${esc(e.note)}</p>` : ''}
          <div class="ev-actions">
            ${e.location ? `<button class="btn btn-sm" data-action="show-event" data-id="${esc(e.id)}">${ICON.pin}<span>Show on globe</span></button>` : ''}
            <button class="btn btn-sm" data-route="#/event/${esc(e.id)}">${ICON.clock}<span>Open in timeline</span></button>
            ${e.route ? `<button class="btn btn-sm" data-route="#/route/${esc(e.route)}">Trace the route</button>` : ''}
          </div>
          <details class="ev-src"><summary>Sources</summary>${sourceList(e.sources, c.sources)}</details>
        </div>
      </li>`).join('')}</ol>
    ${c.id === 'ITA' ? `<button class="btn btn-gold wide" data-route="#/story/roman-empire/0">Watch Rome grow and fall, step by step</button>` : ''}`;
}

function placesTab(rec, c) {
  return `<p class="muted small">Blue pins on the globe mark these places. Tap a pin or a name to explore it.</p>
    <ul class="list places">${c.places.map(p => `
      <li><button data-route="#/place/${esc(c.id)}/${esc(p.id)}">
        <span class="place-ico" aria-hidden="true">${ICON.pin}</span>
        <span class="li-main"><b>${esc(p.name)}</b><span>${esc(p.type)}</span></span>
      </button></li>`).join('')}</ul>`;
}

// ---------- Place ----------
export function placeView(place, country, rec) {
  return `
  <article aria-labelledby="pTitle">
    <button class="btn btn-sm back" data-route="#/country/${esc(country.id)}/places">${ICON.back}<span>${esc(rec?.name || country.id)}</span></button>
    <p class="eyebrow">${esc(place.type)}</p>
    <h2 class="view-title" id="pTitle">${esc(place.name)}</h2>
    <p class="lede big">${esc(place.summary)}</p>
    ${place.unesco ? `<p class="unesco"><span>UNESCO World Heritage</span> inscribed ${esc(place.unesco.year)} · <a href="https://whc.unesco.org/en/list/${esc(place.unesco.id)}" target="_blank" rel="noopener">site no. ${esc(place.unesco.id)}</a></p>` : ''}
    ${place.details.map(d => `<p class="body">${esc(d)}</p>`).join('')}
    <div class="c-actions">
      <button class="btn" data-action="fly-place" data-id="${esc(country.id)}/${esc(place.id)}">${ICON.target}<span>Centre on globe</span></button>
    </div>
    <footer class="sources"><h4>Sources</h4>${sourceList(place.sources, country.sources)}</footer>
  </article>`;
}

// ---------- Timeline ----------
export function timelineView({ periods, note, year, periodId, events, routes, snapshot, showBorders, compare, loading, error }) {
  const period = periods.find(p => p.id === periodId);
  return `
  <section aria-labelledby="tTitle" class="timeline">
    <p class="eyebrow">Time traveller</p>
    <h2 class="view-title" id="tTitle">${esc(fmtYear(year))}</h2>
    <div class="year-ctl">
      <button class="btn btn-sm" data-action="year-step" data-dir="-1" aria-label="Earlier">${ICON.prev}</button>
      <input type="range" id="yearSlider" min="0" max="1000" step="1" aria-label="Year" aria-valuetext="${esc(fmtYear(year))}">
      <button class="btn btn-sm" data-action="year-step" data-dir="1" aria-label="Later">${ICON.next}</button>
    </div>
    <div class="year-scale" aria-hidden="true"><span>10,000 BCE</span><span>500 BCE</span><span>1500</span><span>Today</span></div>
    <div class="chips periods">${periods.map(p => `<button class="chip ${p.id === periodId ? 'is-on' : ''}" data-action="period" data-id="${esc(p.id)}">${esc(p.label)}</button>`).join('')}</div>
    ${period ? `<p class="body"><b>${esc(period.label)}</b> (${esc(fmtYear(period.start))} – ${esc(fmtYear(period.end))}). ${esc(period.blurb)}</p>` : ''}
    <div class="toggles">
      <label class="switch">Historical borders <input type="checkbox" data-time="showBorders" ${showBorders ? 'checked' : ''}></label>
      <label class="switch">Compare with modern borders <input type="checkbox" data-time="compare" ${compare ? 'checked' : ''}></label>
    </div>
    ${showBorders ? `<p class="callout small">${loading ? 'Loading historical borders…' : error ? esc(error) : snapshot
      ? `Showing borders reconstructed for <b>${esc(fmtYear(snapshot.year))}</b>, the nearest available map. These are <b>approximate reconstructions</b> from the open historical-basemaps project — pre-modern borders were rarely fixed lines. Tap a coloured area to learn more.`
      : ''}</p>` : ''}
    <h3 class="section">Stories</h3>
    <button class="btn wide" data-route="#/story/roman-empire/0">The rise and fall of Rome</button>
    <h3 class="section">Trade routes</h3>
    ${routes.length ? `<div class="chips">${routes.map(r => `<button class="chip" data-route="#/route/${esc(r.id)}"><i class="dot" style="background:${esc(r.color)}"></i>${esc(r.name)}</button>`).join('')}</div>` : '<p class="muted small">No mapped routes in this period yet.</p>'}
    <h3 class="section">Events${period ? ' in this period' : ' nearby in time'}</h3>
    ${events.length ? `<ul class="list">${events.map(e => `
      <li><button data-route="#/event/${esc(e.id)}">
        <span class="ev-yr">${esc(e.display)}</span>
        <span class="li-main"><b>${esc(e.title)}</b><span>${esc(e.countryName)} · ${esc(CONFIDENCE[e.confidence]?.label || '')}</span></span>
      </button></li>`).join('')}</ul>` : '<p class="muted small">No events from the five researched countries fall in this window yet.</p>'}
    <p class="muted small" style="margin-top:16px">${esc(note)}</p>
  </section>`;
}

export function eventView(e, country, rec) {
  return `
  <article aria-labelledby="eTitle">
    <button class="btn btn-sm back" data-route="#/timeline">${ICON.back}<span>Timeline</span></button>
    <p class="eyebrow">${esc(e.display)} · ${esc(rec?.name || e.country)}</p>
    <h2 class="view-title" id="eTitle">${esc(e.title)}</h2>
    <p>${badge(e.confidence)} <span class="muted small">${esc(CONFIDENCE[e.confidence]?.hint || '')}</span></p>
    <p class="body">${esc(e.text)}</p>
    ${e.note ? `<p class="callout small"><b>Note.</b> ${esc(e.note)}</p>` : ''}
    <div class="c-actions">
      <button class="btn" data-route="#/country/${esc(e.country)}">${flagImg(rec, 'mini-flag', 40)}<span>${esc(rec?.name || e.country)} history</span></button>
      ${e.route ? `<button class="btn" data-route="#/route/${esc(e.route)}">Trace the route</button>` : ''}
    </div>
    <footer class="sources"><h4>Sources</h4>${sourceList(e.sources, country.sources)}</footer>
  </article>`;
}

export function storyView(story, i, { loading, error, snapshot }) {
  const s = story.steps[i];
  return `
  <article aria-labelledby="stTitle" class="story">
    <button class="btn btn-sm back" data-route="#/timeline">${ICON.back}<span>Timeline</span></button>
    <p class="eyebrow">${esc(story.title)} · step ${i + 1} of ${story.steps.length}</p>
    <h2 class="view-title" id="stTitle">${esc(s.label)}: ${esc(s.title)}</h2>
    <div class="step-dots" role="tablist">${story.steps.map((st, j) =>
      `<button role="tab" aria-selected="${i === j}" aria-label="${esc(st.label)}" data-route="#/story/${esc(story.id)}/${j}"></button>`).join('')}</div>
    <p class="body">${esc(s.text)}</p>
    <div class="story-nav">
      <button class="btn" data-route="#/story/${esc(story.id)}/${Math.max(0, i - 1)}" ${i === 0 ? 'disabled' : ''}>${ICON.prev}<span>Earlier</span></button>
      <button class="btn btn-gold" data-route="#/story/${esc(story.id)}/${Math.min(story.steps.length - 1, i + 1)}" ${i === story.steps.length - 1 ? 'disabled' : ''}><span>Later</span>${ICON.next}</button>
    </div>
    <p class="callout small">${loading ? 'Loading the map for this step…' : error ? esc(error)
      : `Gold areas: Roman territory as reconstructed for ${esc(snapshot ? fmtYear(snapshot.year) : s.label)}. ${esc(story.intro)}`}</p>
    <footer class="sources"><h4>Sources</h4>${sourceList(story.sources)}</footer>
  </article>`;
}

export function routeView(r) {
  return `
  <article aria-labelledby="rTitle">
    <button class="btn btn-sm back" data-route="#/timeline">${ICON.back}<span>Timeline</span></button>
    <p class="eyebrow">${esc(r.display)} · ${badge('schematic')}</p>
    <h2 class="view-title" id="rTitle">${esc(r.name)}</h2>
    <p class="lede big">${esc(r.summary)}</p>
    ${r.details.map(d => `<p class="body">${esc(d)}</p>`).join('')}
    <h3 class="section">Stops</h3>
    <ol class="list stops">${r.stops.map((s, i) => `
      <li><button data-action="fly-stop" data-route-id="${esc(r.id)}" data-i="${i}">
        <span class="stop-n">${i + 1}</span>
        <span class="li-main"><b>${esc(s.name)}</b><span>${esc(s.note)}</span></span>
      </button></li>`).join('')}</ol>
    <footer class="sources"><h4>Sources</h4>${sourceList(r.sources)}</footer>
  </article>`;
}

export function polityView(f) {
  const p = f.properties;
  return `
  <article aria-labelledby="poTitle">
    <button class="btn btn-sm back" data-action="back-time">${ICON.back}<span>Back</span></button>
    <p class="eyebrow">Historical map · ${esc(fmtYear(p._year))}</p>
    <h2 class="view-title" id="poTitle">${esc(p.NAME)}</h2>
    ${p.SUBJECTO && p.SUBJECTO !== p.NAME ? `<p class="body">Under the authority of: <b>${esc(p.SUBJECTO)}</b></p>` : ''}
    ${p.PARTOF && p.PARTOF !== p.NAME ? `<p class="body">Part of the wider cultural area: <b>${esc(p.PARTOF)}</b></p>` : ''}
    <p class="callout small"><b>Border precision ${esc(p.BORDERPRECISION)} of 3.</b> ${esc(PRECISION_TEXT[p.BORDERPRECISION] || PRECISION_TEXT[1])}</p>
    <p class="muted small">Names and shapes come from historical-basemaps, a community "work in progress" dataset. Its authors advise checking against other sources before relying on it, and some labels may be anachronistic.</p>
    <footer class="sources"><h4>Sources</h4>${sourceList([{ title: 'historical-basemaps (A. Ourednik et al.), GPL-3.0', publisher: 'GitHub', url: 'https://github.com/aourednik/historical-basemaps', accessed: '2026-11-09' }])}</footer>
  </article>`;
}

// ---------- Search / saved / settings / credits ----------
export function searchView() {
  return `
  <section aria-labelledby="sTitle">
    <p class="eyebrow">Find a place</p>
    <h2 class="view-title" id="sTitle">Search</h2>
    <div class="search-box">${ICON.search}
      <input id="searchInput" type="search" placeholder="Country, capital, landmark or code…" autocomplete="off" spellcheck="false"
             aria-label="Search countries and places" aria-controls="searchResults" role="combobox" aria-expanded="true">
    </div>
    <ul class="list" id="searchResults" role="listbox" aria-label="Results"></ul>
  </section>`;
}

export function resultItems(items, activeIndex = -1) {
  if (!items.length) return '<li class="empty">No matches. Try a capital (e.g. “Manila”), a landmark (e.g. “Colosseum”) or a code (e.g. “MYS”).</li>';
  return items.map((it, i) => {
    const act = i === activeIndex;
    if (it.kind === 'place') {
      return `<li role="option" aria-selected="${act}"><button data-route="#/place/${esc(it.country)}/${esc(it.id)}" class="${act ? 'is-active' : ''}" tabindex="-1">
        <span class="place-ico" aria-hidden="true">${ICON.pin}</span>
        <span class="li-main"><b>${esc(it.name)}</b><span>${esc(it.type)}</span></span></button></li>`;
    }
    const r = it;
    return `<li role="option" aria-selected="${act}"><button data-country="${esc(r.a3)}" class="${act ? 'is-active' : ''}" tabindex="-1">
        ${flagImg(r, '', 80)}
        <span class="li-main"><b>${esc(r.name)}${r.hasContent ? ' <i class="full">Full profile</i>' : ''}</b><span>${esc(r.cap || r.sub)}${r.cap ? ' · ' + esc(r.sub) : ''}</span></span>
      </button></li>`;
  }).join('');
}

export function savedView({ favs, recent, explored, total }) {
  const pct = total ? Math.round(explored / total * 100) : 0;
  const list = (items, empty) => items.length
    ? `<ul class="list">${resultItems(items)}</ul>` : `<p class="empty">${empty}</p>`;
  return `
  <section aria-labelledby="fTitle">
    <p class="eyebrow">Your journey</p>
    <h2 class="view-title" id="fTitle">Saved &amp; progress</h2>
    <p class="lede">Saved on this device only — nothing is uploaded.</p>
    <div class="stat-row">
      <div class="stat"><b>${explored}</b><span>places explored</span></div>
      <div class="stat"><b>${favs.length}</b><span>saved</span></div>
    </div>
    <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="World explored"><i style="width:${pct}%"></i></div>
    <p class="muted small">${pct}% of the ${total} countries and territories on the map.</p>
    <h3 class="section">Saved</h3>
    ${list(favs, 'Tap <b>Save</b> on any country to keep it here.')}
    <h3 class="section">Recently explored</h3>
    ${list(recent, 'Countries you open will appear here.')}
  </section>`;
}

export function settingsView(p, caps, mode) {
  const seg = (key, options, current) => `<div class="seg" role="group">${options.map(([v, label]) =>
    `<button data-setting="${key}" data-value="${v}" aria-pressed="${current === v}">${label}</button>`).join('')}</div>`;
  const tierName = { A: 'High', B: 'Standard', C: 'Low', D: 'No 3D support' }[caps.tier];
  return `
  <section aria-labelledby="setTitle">
    <p class="eyebrow">Preferences</p>
    <h2 class="view-title" id="setTitle">Settings</h2>
    <div class="setting">
      <span class="s-label">Display mode</span>
      <p>Lite mode draws a lighter 2D globe for older phones. Changing mode reloads the page.</p>
      ${seg('mode', [['auto', 'Automatic'], ['3d', '3D globe'], ['lite', 'Lite']], p.mode)}
      <p class="small" style="margin-top:8px">Now showing: <b>${mode === '3d' ? '3D globe' : 'Lite mode'}</b>${caps.webgl ? '' : ' — this device cannot run 3D graphics.'}</p>
    </div>
    <div class="setting">
      <span class="s-label">3D quality</span>
      <p>Lower quality uses smaller textures and fewer pixels for smoother motion. Reloads the page.</p>
      ${seg('quality', [['auto', 'Automatic'], ['high', 'High'], ['low', 'Low']], p.quality)}
      <p class="small" style="margin-top:8px">Detected device level: ${tierName}${caps.maxTex ? ` · max texture ${caps.maxTex}px` : ''}</p>
    </div>
    <div class="setting">
      <span class="s-label">Earth imagery</span>
      <p>NASA daytime Blue Marble or night-time city lights (3D only).</p>
      ${seg('texture', [['day', 'Day'], ['night', 'Night lights']], p.texture)}
    </div>
    <div class="setting"><label class="switch">Slowly rotate when idle <input type="checkbox" data-toggle="autoRotate" ${p.autoRotate ? 'checked' : ''}></label></div>
    <div class="setting"><label class="switch">Show latitude/longitude grid <input type="checkbox" data-toggle="graticules" ${p.graticules ? 'checked' : ''}></label></div>
    <div class="setting">
      <span class="s-label">Your data</span>
      <p>Saved countries and progress live in this browser only.</p>
      <button class="btn" data-action="reset-data">Clear saved data</button>
    </div>
    <div class="setting" style="border:0">
      <button class="btn" data-route="#/credits">Sources &amp; credits</button>
      <p class="small" style="margin-top:10px">Version ${APP.version}</p>
    </div>
  </section>`;
}

export function creditsView(meta) {
  return `
  <section aria-labelledby="crTitle" class="credits">
    <p class="eyebrow">Transparency</p>
    <h2 class="view-title" id="crTitle">Sources &amp; credits</h2>
    <p class="lede">${esc(meta.borders_note)}</p>
    <dl>
      <dt>How accuracy is handled</dt><dd>Every historical claim lists its sources and carries a label: established, probable, debated, legend or debunked. Dates marked “c.” are approximate. Historical borders are approximate reconstructions and are drawn as such.</dd>
      <dt>Country shapes</dt><dd>Natural Earth admin-0 countries, 1:110m and 1:50m (public domain), via the world-atlas TopoJSON package (ISC licence).</dd>
      <dt>Historical borders</dt><dd>historical-basemaps by André Ourednik and contributors (GPL-3.0), loaded on demand. A community work in progress; shapes are approximate.</dd>
      <dt>Statistics</dt><dd>Population (SP.POP.TOTL) and land area (AG.LND.TOTL.K2) from World Bank Open Data (CC BY 4.0), with the year of each figure shown.</dd>
      <dt>History &amp; places</dt><dd>Written for this app from Encyclopaedia Britannica, UNESCO World Heritage Centre listings, national museums and peer-reviewed research, cited on each item.</dd>
      <dt>Earth imagery</dt><dd>NASA Blue Marble and Black Marble (Visible Earth / Earth Observatory), as packaged in the three-globe examples. Imagery: NASA.</dd>
      <dt>Country reference data</dt><dd>Capitals, ISO 3166-1 codes and UN M49 regions. ${esc(meta.review_status)}</dd>
      <dt>Flags</dt><dd>Images served by flagcdn.com.</dd>
      <dt>Software</dt><dd>globe.gl and three-globe (MIT) by Vasco Asturiano; three.js (MIT); d3-geo (ISC); topojson-client (ISC).</dd>
      <dt>Typefaces</dt><dd>Cormorant Garamond and Inter (SIL Open Font Licence), via Google Fonts.</dd>
    </dl>
  </section>`;
}
