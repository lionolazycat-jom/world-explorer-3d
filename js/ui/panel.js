// Side panel on desktop, three-stop bottom sheet (peek / half / full) on mobile.
import { emit } from '../core/events.js';

const mq = matchMedia('(max-width: 899px)');
export const isMobile = () => mq.matches;

let panel, body, grip;
let state = 'closed';

export function initPanel() {
  panel = document.getElementById('panel');
  body = document.getElementById('panelBody');
  grip = document.getElementById('sheetGrip');
  setupDrag();
  grip.addEventListener('click', () => { if (!dragMoved) setState(state === 'full' ? 'half' : 'full'); });
  grip.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setState(state === 'full' ? 'half' : 'full'); }
  });
  mq.addEventListener?.('change', () => setState(state));
  // Scrolling to the top of the content while in "peek" expands the sheet.
  body.addEventListener('click', () => { if (state === 'peek' && isMobile()) setState('half'); });
}

export function getState() { return state; }

export function setState(next) {
  state = next;
  if (!isMobile() && (next === 'peek' || next === 'half' || next === 'full')) next = 'open';
  panel.dataset.state = next;
  panel.setAttribute('aria-hidden', String(next === 'closed'));
  document.body.classList.toggle('panel-open', next !== 'closed' && !isMobile());
  document.body.dataset.sheet = isMobile() ? state : (state === 'closed' ? 'closed' : 'open');
  emit('layout');
}

export function show(html, { sheet = 'half', focus = false } = {}) {
  body.innerHTML = html;
  body.scrollTop = 0;
  body.classList.remove('enter'); void body.offsetWidth; body.classList.add('enter');
  setState(isMobile() ? sheet : 'open');
  if (focus) body.focus({ preventScroll: true });
}

// Re-render content in place (keeps scroll position, no entrance animation).
export function update(html) {
  const top = body.scrollTop;
  const active = document.activeElement;
  const activeId = active && body.contains(active) ? active.id : null;
  body.innerHTML = html;
  body.scrollTop = top;
  if (activeId) document.getElementById(activeId)?.focus({ preventScroll: true });
}

export function close() { setState('closed'); }
export function bodyEl() { return body; }

// ---- drag-to-resize for the mobile sheet ----
let dragMoved = false;
function setupDrag() {
  let startY = 0, startH = 0, active = false;
  const onDown = e => {
    if (!isMobile()) return;
    active = true; dragMoved = false;
    startY = e.clientY; startH = panel.getBoundingClientRect().height;
    panel.classList.add('dragging');
    grip.setPointerCapture?.(e.pointerId);
  };
  const onMove = e => {
    if (!active) return;
    const dy = startY - e.clientY;
    if (Math.abs(dy) > 4) dragMoved = true;
    const maxH = window.innerHeight * 0.92;
    panel.style.height = Math.max(80, Math.min(maxH, startH + dy)) + 'px';
  };
  const onUp = () => {
    if (!active) return;
    active = false;
    panel.classList.remove('dragging');
    const h = panel.getBoundingClientRect().height;
    panel.style.height = '';
    if (!dragMoved) return;
    const vh = window.innerHeight;
    const stops = [['closed', 40], ['peek', 150], ['half', vh * 0.46], ['full', vh * 0.85]];
    let best = stops[0], bestD = Infinity;
    for (const s of stops) { const d = Math.abs(s[1] - h); if (d < bestD) { bestD = d; best = s; } }
    if (best[0] === 'closed') emit('panel:dismiss'); else setState(best[0]);
  };
  grip.addEventListener('pointerdown', onDown);
  grip.addEventListener('pointermove', onMove);
  grip.addEventListener('pointerup', onUp);
  grip.addEventListener('pointercancel', onUp);
}
