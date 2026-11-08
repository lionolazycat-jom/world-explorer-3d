import { esc } from './views.js';

export function toast(message, { action, onAction, duration = 5000 } = {}) {
  const host = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<p>${esc(message)}</p>${action ? `<button class="btn btn-gold">${esc(action)}</button>` : ''}`;
  host.appendChild(el);
  const remove = () => el.remove();
  if (action) el.querySelector('button').addEventListener('click', () => { remove(); onAction?.(); });
  if (duration) setTimeout(remove, duration);
  return remove;
}
