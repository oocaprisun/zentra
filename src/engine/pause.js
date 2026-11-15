// Pause menu: Esc opens/closes. Freezes dialogue, timers and CSS animations; holds volume settings.
import { $, state } from './ui.js';
import * as audio from './audio.js';

const KEY = 'zentra2-settings';
try { Object.assign(audio.volume, JSON.parse(localStorage.getItem(KEY)) || {}); } catch {}

const sliders = [
  ['music', 'Music'],
  ['sfx', 'Sound effects'],
  ['text', 'Subtitle sounds'],
];

const menu = document.createElement('div');
menu.id = 'pause';
menu.hidden = true;
menu.setAttribute('role', 'dialog');
menu.setAttribute('aria-label', 'Paused');
menu.innerHTML = `<div class="pause-box"><h2>Paused</h2>${sliders.map(([k, label]) =>
  `<label class="pause-row"><span>${label}</span><input type="range" min="0" max="100" data-k="${k}"><output></output></label>`).join('')}
  <button id="resume">Resume</button><button id="to-menu" type="button">Main menu</button><small>Esc to resume</small></div>`;
$('#stage').append(menu);

for (const input of menu.querySelectorAll('input')) {
  const out = input.nextElementSibling;
  const sync = () => (out.textContent = input.value);
  input.value = Math.round(audio.volume[input.dataset.k] * 100);
  sync();
  input.addEventListener('input', () => {
    audio.volume[input.dataset.k] = input.value / 100;
    audio.applyVolume();
    sync();
    try { localStorage.setItem(KEY, JSON.stringify(audio.volume)); } catch {}
  });
  input.addEventListener('change', () => { if (input.dataset.k === 'text') audio.pop(); if (input.dataset.k === 'sfx') audio.sfx('audio/button-ui.wav'); });
}

let lastFocus = null;
export function setPaused(p) {
  if (!$('#start').classList.contains('gone')) return; // nothing to pause yet
  state.paused = p;
  menu.hidden = !p;
  $('#stage').classList.toggle('paused', p);
  audio.pauseMusic(p);
  if (p) { lastFocus = document.activeElement; $('#resume').focus(); }
  else lastFocus?.focus?.();
}

$('#resume').addEventListener('click', () => setPaused(false));
// progress is saved at the start of every scene, so the menu's "Resume mission" picks up from this scene
$('#to-menu').addEventListener('click', () => location.replace(location.pathname));
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    if (document.getElementById('achievements')?.hidden === false) return; // achievements.js closes it
    if (document.getElementById('garage')?.hidden === false) return; // garage.js handles Esc
    setPaused(!state.paused);
  }
}, true);
