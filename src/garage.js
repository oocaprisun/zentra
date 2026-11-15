// Hangar: a "Hangar" button (bottom-left) during the moon, mars and rocket-breaks scenes.
// It can be pressed whenever nobody is talking. It pauses the mission and opens the garage:
// art/bg/garage.png, one rover from rovers.json in the centre, arrows to cycle, click the rover
// for its info window. "Back to mission" resumes.
import { $, state } from './engine/ui.js';
import * as audio from './engine/audio.js';
import { rovers, collected } from './cards.js';

const SCENES = ['moon', 'mars', 'rocket-breaks'];
const BG = 'art/bg/garage.png';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ARROW = (dir) => `<svg viewBox="0 0 12 16" shape-rendering="crispEdges" aria-hidden="true" fill="currentColor">${
  dir === 'left'
    ? '<rect x="6" y="0" width="3" height="2"/><rect x="4" y="2" width="3" height="2"/><rect x="2" y="4" width="3" height="2"/><rect x="0" y="6" width="3" height="4"/><rect x="2" y="10" width="3" height="2"/><rect x="4" y="12" width="3" height="2"/><rect x="6" y="14" width="3" height="2"/>'
    : '<rect x="3" y="0" width="3" height="2"/><rect x="5" y="2" width="3" height="2"/><rect x="7" y="4" width="3" height="2"/><rect x="9" y="6" width="3" height="4"/><rect x="7" y="10" width="3" height="2"/><rect x="5" y="12" width="3" height="2"/><rect x="3" y="14" width="3" height="2"/>'
}</svg>`;
export const DOOR = `<svg viewBox="0 0 16 14" shape-rendering="crispEdges" aria-hidden="true" fill="currentColor"><rect x="6" y="0" width="4" height="2"/><rect x="3" y="2" width="10" height="2"/><rect x="0" y="4" width="16" height="2"/><rect x="1" y="6" width="2" height="8"/><rect x="13" y="6" width="2" height="8"/><rect x="4" y="7" width="8" height="1"/><rect x="4" y="9" width="8" height="1"/><rect x="4" y="11" width="8" height="1"/><rect x="4" y="13" width="8" height="1"/></svg>`;

// ---- the Hangar button ----
const btn = document.createElement('button');
btn.id = 'hangar-btn';
btn.type = 'button';
btn.hidden = true;
btn.innerHTML = `${DOOR}<span>Hangar</span>`;
$('#stage').append(btn);

// ---- the garage screen ----
const g = document.createElement('div');
g.id = 'garage';
g.hidden = true;
g.setAttribute('role', 'dialog');
g.setAttribute('aria-label', 'Hangar');
g.innerHTML = `
  <img class="gar-bg" alt="">
  <button type="button" class="gar-back">Back to mission</button>
  <button type="button" class="gar-arrow gar-prev" aria-label="Previous rover">${ARROW('left')}</button>
  <div class="gar-bay"><div class="gar-floor"></div></div>
  <button type="button" class="gar-arrow gar-next" aria-label="Next rover">${ARROW('right')}</button>
  <div class="gar-plate" aria-live="polite"><h2></h2><p></p><span class="gar-count"></span></div>
  <div class="gar-info" hidden></div>`;
$('#stage').append(g);
const bgImg = g.querySelector('.gar-bg');
bgImg.onerror = () => { bgImg.onerror = null; bgImg.removeAttribute('src'); }; // falls back to the CSS hangar gradient
const bay = g.querySelector('.gar-bay');
const plate = g.querySelector('.gar-plate');
const info = g.querySelector('.gar-info');

let list = [], data = {}, idx = 0, current = null, busy = false, wasPaused = false, lastFocus = null, fromMenu = false;

function canOpen() {
  return SCENES.includes(state.scene) && state.lines > 0 && !state.talking && !state.skipping && !state.paused
    && $('#start').classList.contains('gone') && $('#fade') && !$('#fade').classList.contains('on');
}
setInterval(() => {
  // shows up only after the scene's first line, so the opening of each scene stays clean
  btn.hidden = !SCENES.includes(state.scene) || state.lines < 1 || !g.hidden;
  const ok = canOpen();
  btn.disabled = !ok;
  btn.title = ok ? 'Open the hangar' : 'Wait until they finish talking';
}, 150);

function roverEl(id) {
  const r = data[id];
  // unlocked = its card was collected (Collect button) during the mission
  const open = collected().includes(id);
  const slot = document.createElement('div'); // rover + its extra item (if any); slides as one
  slot.className = 'gar-slot';
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `gar-rover gar-${r.rank}${open ? '' : ' is-locked'}`;
  el.setAttribute('aria-label', open ? `${r.name}: open info` : 'Locked rover');
  if (!open) el.setAttribute('aria-disabled', 'true');
  el.innerHTML = `${open ? '<span class="gar-bubble">Click me!</span>' : ''}<img alt="" src="${esc(r.img)}"><span class="gar-noart">${open ? esc(r.name) : '???'}<small>${open ? 'Art coming soon' : 'Locked'}</small></span>`;
  const img = el.querySelector('img');
  img.onerror = () => el.classList.add('no-art');
  el.addEventListener('click', () => { if (open) openInfo(roverInfo(r), el); });
  slot.append(el);
  // extra item (Voyager's Golden Record): floats beside the rover once the rover is unlocked
  const x = r.extra;
  if (open && x) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gar-extra';
    b.setAttribute('aria-label', `${x.name}: open info`);
    b.innerHTML = `<img alt="" src="${esc(x.img)}"><span class="gar-extra-name">${esc(x.name)}</span>
      <span class="gar-extra-tip" role="tooltip">${esc(x.tip || '')}</span>`;
    b.addEventListener('click', () => openInfo({ name: x.name, sub: x.sub || '', badge: 'Artifact', rank: 'legendary', info: x.info }, b));
    slot.append(b);
  }
  return slot;
}
const roverInfo = (r) => ({ name: r.name, sub: `${r.mission}, ${r.year}`, badge: r.rank === 'unreal' ? 'Unreal' : 'Legendary', rank: r.rank, info: r.info });

function showPlate() {
  const r = data[list[idx]];
  const open = collected().includes(list[idx]);
  plate.classList.toggle('is-locked', !open);
  plate.querySelector('h2').textContent = open ? r.name : '???';
  plate.querySelector('p').textContent = open ? `“${r.nickname}”, ${r.year}` : 'Collect its card on the mission to unlock it';
  plate.querySelector('.gar-count').textContent = `${idx + 1} of ${list.length}`;
}

// dir: +1 = next (old drives off left, new rolls in from the right), -1 = previous
async function cycle(dir) {
  if (busy || !list.length || !info.hidden) return;
  busy = true;
  idx = (idx + dir + list.length) % list.length;
  const old = current;
  current = roverEl(list[idx]);
  bay.append(current);
  showPlate();
  if (!reduced) {
    const off = 1100 * dir;
    const ease = 'cubic-bezier(.55,.05,.35,1)';
    const out = old.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-off}px) rotate(${-4 * dir}deg)`, opacity: 0 }],
      { duration: 520, easing: ease, fill: 'forwards' });
    const inn = current.animate([
      { transform: `translateX(${off}px) rotate(${3 * dir}deg)`, opacity: 0 },
      { transform: `translateX(${-24 * dir}px) rotate(0deg)`, opacity: 1, offset: .78 },
      { transform: 'translateX(0) translateY(-10px)', offset: .9 },
      { transform: 'translateX(0) translateY(0)' },
    ], { duration: 640, easing: 'ease-out' });
    await Promise.all([out.finished, inn.finished]);
  }
  old.remove();
  busy = false;
}

// item: { name, sub, badge, rank, info: { text: [], photos: [] } }; from: element to refocus on close
let infoFrom = null;
function openInfo(r, from) {
  infoFrom = from;
  const photos = r.info?.photos || [];
  const text = r.info?.text || [];
  info.innerHTML = `<div class="gar-info-box gar-${r.rank}">
    <header>
      <div><h2>${esc(r.name)}</h2><p>${esc(r.sub)}</p></div>
      <span class="gar-rank">${esc(r.badge)}</span>
    </header>
    <div class="gar-info-body">
      ${photos.length ? `<div class="gar-photos">${photos.map((p) => `<img alt="${esc(r.name)}" src="${esc(p)}" loading="lazy">`).join('')}</div>` : ''}
      <div class="gar-text" tabindex="0">${text.length ? text.map((t) => `<p>${esc(t)}</p>`).join('') : '<p class="gar-soon">More coming soon.</p>'}</div>
    </div>
    <footer><small>Esc to close</small><button type="button" class="gar-close">Close</button></footer>
  </div>`;
  info.querySelectorAll('.gar-photos img').forEach((im) => (im.onerror = () => im.remove()));
  info.querySelector('.gar-close').addEventListener('click', closeInfo);
  info.hidden = false;
  info.querySelector('.gar-close').focus();
}
function closeInfo() {
  if (info.hidden) return false;
  info.hidden = true;
  (infoFrom || current?.querySelector('.gar-rover'))?.focus();
  return true;
}

// menu: true when opened from the main menu (no mission running behind it)
export async function openGarage(menu = false) {
  if (!menu && !canOpen()) return;
  fromMenu = menu;
  g.querySelector('.gar-back').textContent = menu ? 'Back to menu' : 'Back to mission';
  data = await rovers();
  list = Object.keys(data);
  if (!list.length) return;
  lastFocus = document.activeElement;
  wasPaused = state.paused;
  if (!fromMenu) {
    state.paused = true;             // freezes dialogue, timers and scene animations
    $('#stage').classList.add('paused', 'in-garage');
    audio.pauseMusic(true);
  }
  if (!bgImg.getAttribute('src')) bgImg.src = BG;
  bay.querySelector('.gar-slot')?.remove();
  idx = 0;
  current = roverEl(list[idx]);
  bay.append(current);
  showPlate();
  info.hidden = true;
  g.hidden = false;
  g.querySelector('.gar-back').focus();
}
function close() {
  if (g.hidden) return;
  info.hidden = true;
  g.hidden = true;
  if (!fromMenu) {
    state.paused = wasPaused;
    $('#stage').classList.remove('paused', 'in-garage');
    audio.pauseMusic(false);
  }
  lastFocus?.focus?.();
  btn.blur();
}

btn.addEventListener('click', () => openGarage());
g.querySelector('.gar-back').addEventListener('click', close);
g.querySelector('.gar-prev').addEventListener('click', () => cycle(-1));
g.querySelector('.gar-next').addEventListener('click', () => cycle(1));
info.addEventListener('click', (e) => { if (e.target === info) closeInfo(); }); // click outside the box
addEventListener('keydown', (e) => {
  if (g.hidden) return;
  if (e.key === 'Escape') { e.preventDefault(); if (!closeInfo()) close(); }
  else if (info.hidden && e.key === 'ArrowLeft') cycle(-1);
  else if (info.hidden && e.key === 'ArrowRight') cycle(1);
});
