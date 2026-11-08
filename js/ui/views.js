// HTML templates for each panel view. Pure functions: data in, markup out.
import { CDN, APP } from '../config.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICON = {
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.1 1.2 6L12 16.4 6.6 19.4l1.2-6L3.3 9.3l6.1-.7z"/></svg>',
  target: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>'
};

function flagImg(rec, cls, w = 160) {
  const src = CDN.flag(rec.a2, w);
  if (!src) return `<span class="${cls} flag-ph" aria-hidden="true"></span>`;
  return `<img class="${cls}" src="${src}" alt="" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">`;
}

export function countryView(rec, { isFav, reviewed }) {
  const codes = [rec.a2, rec.a3.startsWith('X') ? null : rec.a3, rec.n].filter(Boolean).join(' · ');
  const capital = rec.cap
    ? `${esc(rec.cap)}${rec.capNote ? `<small>${esc(rec.capNote)}</small>` : ''}`
    : `<span class="muted">None</span>${rec.capNote ? `<small>${esc(rec.capNote)}</small>` : ''}`;
  const neighbours = rec.neighbours.length
    ? `<div class="chips">${rec.neighbours.map(n => `<button class="chip" data-country="${esc(n.a3)}">${flagImg(n, '', 40)}${esc(n.name)}</button>`).join('')}</div>`
    : `<p class="muted small">No shared land border in the Natural Earth outlines — ${rec.region === 'Antarctica' ? 'an isolated polar territory' : 'an island or maritime territory'}.</p>`;

  return `
  <article class="country" aria-labelledby="cTitle">
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
      <button class="btn" data-action="centre" data-id="${esc(rec.a3)}">${ICON.target}<span>Centre on globe</span></button>
      <button class="btn" data-action="share" data-id="${esc(rec.a3)}">${ICON.link}<span>Copy link</span></button>
    </div>
    <dl class="facts">
      <div class="fact wide"><dt>Capital</dt><dd>${capital}</dd></div>
      <div class="fact"><dt>Region</dt><dd>${esc(rec.region)}</dd></div>
      <div class="fact"><dt>ISO codes</dt><dd>${codes ? esc(codes) : '<span class="muted">Not assigned</span>'}</dd></div>
    </dl>
    ${rec.note ? `<p class="callout"><b>Status note.</b> ${esc(rec.note)}</p>` : ''}
    <h3 class="section">Land borders</h3>
    ${neighbours}
    <footer class="sources">
      <h4>Sources</h4>
      <ul>
        <li>Shape &amp; land borders: Natural Earth admin-0 countries (public domain), de facto boundaries.</li>
        <li>Capital, codes &amp; region: ISO 3166-1 and UN M49 reference list, reviewed ${esc(reviewed)}.</li>
        ${rec.a2 ? '<li>Flag image: flagcdn.com.</li>' : ''}
      </ul>
    </footer>
  </article>`;
}

export function searchView() {
  return `
  <section aria-labelledby="sTitle">
    <p class="eyebrow">Find a place</p>
    <h2 class="view-title" id="sTitle">Search</h2>
    <div class="search-box">${ICON.search}
      <input id="searchInput" type="search" placeholder="Country, capital or code…" autocomplete="off" spellcheck="false"
             aria-label="Search countries" aria-controls="searchResults" role="combobox" aria-expanded="true">
    </div>
    <ul class="list" id="searchResults" role="listbox" aria-label="Results"></ul>
  </section>`;
}

export function resultItems(recs, activeIndex = -1) {
  if (!recs.length) return '<li class="empty">No matches. Try a capital (e.g. “Manila”) or a code (e.g. “MYS”).</li>';
  return recs.map((r, i) => `
    <li role="option" aria-selected="${i === activeIndex}">
      <button data-country="${esc(r.a3)}" class="${i === activeIndex ? 'is-active' : ''}" tabindex="-1">
        ${flagImg(r, '', 80)}
        <span class="li-main"><b>${esc(r.name)}</b><span>${esc(r.cap || r.sub)}${r.cap ? ' · ' + esc(r.sub) : ''}</span></span>
      </button>
    </li>`).join('');
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
      <dt>Country shapes</dt><dd>Natural Earth admin-0 countries, 1:110m and 1:50m (public domain), via the world-atlas TopoJSON package (ISC licence).</dd>
      <dt>Earth imagery</dt><dd>NASA Blue Marble and Black Marble (Visible Earth / Earth Observatory), as packaged in the three-globe examples. Imagery: NASA.</dd>
      <dt>Country reference data</dt><dd>Capitals, ISO 3166-1 codes and UN M49 regions. ${esc(meta.review_status)}</dd>
      <dt>Flags</dt><dd>Images served by flagcdn.com.</dd>
      <dt>Software</dt><dd>globe.gl and three-globe (MIT) by Vasco Asturiano; three.js (MIT); d3-geo (ISC); topojson-client (ISC).</dd>
      <dt>Typefaces</dt><dd>Cormorant Garamond and Inter (SIL Open Font Licence), via Google Fonts.</dd>
    </dl>
    <p class="callout">History, landmarks, timelines and audio narration arrive in later milestones. Every historical claim will carry its source and a confidence label (established, debated, legend or debunked).</p>
  </section>`;
}
