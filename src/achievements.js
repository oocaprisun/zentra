// Achievements: one per rover card collected (rovers.json "achievement"), plus the
// "unlocked" popup. Opened from the main menu and the Esc menu (yellow trophy button).
import { rovers, collected } from './cards.js';

// 16x16 pixel icons, drawn with rects so they stay crisp at any size
const px = (rects) => rects.map(([x, y, w, h, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"${c ? ` fill="${c}"` : ''}/>`).join('');
export const TROPHY = `<svg class="ico-trophy" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true" fill="currentColor">${px([
  [3, 1, 10, 2], [1, 2, 2, 1], [13, 2, 2, 1], [1, 3, 1, 2], [14, 3, 1, 2], [2, 5, 2, 1], [12, 5, 2, 1],
  [4, 3, 8, 4], [5, 7, 6, 1], [6, 8, 4, 1], [7, 9, 2, 2], [5, 11, 6, 1], [4, 12, 8, 2],
  [5, 3, 1, 3, 'rgba(255,255,255,.55)'], [4, 13, 8, 1, 'rgba(0,0,0,.28)'], [10, 3, 2, 4, 'rgba(0,0,0,.18)'],
])}</svg>`;
const LOCK = `<svg class="ico-lock" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true" fill="currentColor">${px([
  [5, 2, 6, 1], [4, 3, 1, 4], [11, 3, 1, 4], [3, 7, 10, 7], [7, 9, 2, 3, '#0c1226'],
])}</svg>`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- the tab ----
const panel = document.createElement('div');
panel.id = 'achievements';
panel.hidden = true;
panel.setAttribute('role', 'dialog');
panel.setAttribute('aria-label', 'Achievements');
document.getElementById('stage').append(panel);
let returnFocus = null;

// compact: the smaller list shown in place of the pause panel, closed with an X
export async function openAchievements(compact = false) {
  const data = await rovers();
  const got = new Set(collected());
  const ids = Object.keys(data);
  const done = ids.filter((id) => got.has(id)).length;
  const tile = (id) => {
    const r = data[id], a = r.achievement || { title: r.name, text: '' };
    const on = got.has(id);
    const secret = !on && r.rank === 'unreal'; // "The end?" stays a mystery until found
    return `<li class="ach ach-${r.rank} ${on ? 'is-on' : 'is-off'}">
      <span class="ach-ico">${on ? TROPHY : LOCK}</span>
      <span class="ach-txt"><b>${secret ? '???' : esc(a.title)}</b><small>${secret ? 'Keep going.' : esc(a.text)}</small></span>
      <span class="ach-rank">${r.rank === 'unreal' ? 'Unreal' : 'Legendary'}</span>
    </li>`;
  };
  panel.classList.toggle('is-compact', compact);
  panel.innerHTML = `<div class="ach-box">
    <header class="ach-head">
      <span class="ach-head-ico">${TROPHY}</span>
      <h2>Achievements</h2>
      <span class="ach-count">${done} of ${ids.length}${compact ? '' : ' unlocked'}</span>
      ${compact ? '<button type="button" class="ach-close ach-x" aria-label="Back to the pause menu">&times;</button>' : ''}
    </header>
    <div class="ach-meter" style="--p:${(done / ids.length) * 100}%"></div>
    <ul class="ach-list">${ids.map(tile).join('')}</ul>
    ${compact ? '' : '<footer><small>Esc to close</small><button type="button" class="ach-close">Close</button></footer>'}
  </div>`;
  document.getElementById('pause')?.classList.toggle('ach-swap', compact); // hide the pause panel behind it
  panel.querySelector('.ach-close').addEventListener('click', closeAchievements);
  returnFocus = document.activeElement;
  panel.hidden = false;
  panel.querySelector('.ach-close').focus();
}

// returns true if it was open (so Esc closes this instead of toggling the pause menu)
export function closeAchievements() {
  if (panel.hidden) return false;
  panel.hidden = true;
  document.getElementById('pause')?.classList.remove('ach-swap');
  returnFocus?.focus?.();
  return true;
}
panel.addEventListener('click', (e) => { if (e.target === panel) closeAchievements(); });

// ---- "achievement unlocked" popup ----
export async function toast(id) {
  const r = (await rovers())[id];
  if (!r?.achievement) return;
  const t = document.createElement('div');
  t.className = `ach-toast ach-${r.rank}`;
  t.setAttribute('role', 'status');
  t.innerHTML = `<span class="ach-ico">${TROPHY}</span><span class="ach-txt"><small>Achievement unlocked</small><b>${esc(r.achievement.title)}</b></span>`;
  document.getElementById('stage').append(t);
  requestAnimationFrame(() => t.classList.add('is-in'));
  setTimeout(() => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 500); }, 3800);
}

addEventListener('rover-collected', (e) => toast(e.detail));
addEventListener('keydown', (e) => { if (e.key === 'Escape' && closeAchievements()) e.preventDefault(); });

// ---- trophy buttons: main menu + Esc menu ----
function button(id, compact) {
  const b = document.createElement('button');
  b.type = 'button';
  b.id = id;
  b.className = 'ach-open';
  b.innerHTML = `${TROPHY}<span>Achievements</span>`;
  b.addEventListener('click', () => openAchievements(compact));
  return b;
}
document.querySelector('#start .menu-actions')?.append(button('menu-ach', false));
// the pause menu is built by engine/pause.js, which loads before this module
document.querySelector('.pause-box #resume')?.after(button('pause-ach', true));
