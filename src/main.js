// Entry: scales the stage, shows start screen, plays scenes in the order from scenes.json.
// Dev shortcut: index.html?scene=moon starts directly at that scene.
import { playScene } from './engine/player.js';
import { $ } from './engine/ui.js';
import './engine/pause.js';
import './achievements.js';
import { sfx } from './engine/audio.js';
import { resetCollected } from './cards.js';
import './orrery.js';
import { openGarage, DOOR } from './garage.js';
import { collected } from './cards.js';

// click sound for UI buttons only (menus, pause, collect, skip); not for puzzle pieces
const isUiButton = (t) => t.closest?.('button') && !t.closest('.pz-body');
addEventListener('pointerdown', (e) => { if (isUiButton(e.target)) sfx('audio/button-ui.wav', 0.6); }, true);
addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && isUiButton(e.target)) sfx('audio/button-ui.wav', 0.6);
}, true);

function fit() {
  const s = Math.min(innerWidth / 1920, innerHeight / 1080);
  $('#stage').style.transform = `translate(-50%, -50%) scale(${s})`;
}
addEventListener('resize', fit);
fit();

const order = await (await fetch('scenes.json')).json();
const jump = new URLSearchParams(location.search).get('scene');

// ---- progress: saved at the start of every scene, cleared when the story ends ----
const SAVE = 'zentra-progress';
const NAMES = { // what the resume line calls each scene
  opening: 'the engine fire', flashback1: 'six months earlier', flashback2: 'before the launch',
  moon: 'the Moon', 'rocket-breaks': 'the breakdown', mars: 'Mars',
  'back-to-opening': 'back on the burning ship', ending: 'the ending', earth_final: 'back on Earth',
};
const load = () => { try { return localStorage.getItem(SAVE); } catch { return null; } };
const save = (id) => { try { id ? localStorage.setItem(SAVE, id) : localStorage.removeItem(SAVE); } catch {} };
const saved = order.indexOf(load());

async function play(from) {
  $('#start').classList.add('gone');
  for (let i = from; i < order.length; i++) {
    save(order[i]);
    try { await playScene(order[i]); }
    catch (e) { console.error(e); }
  }
  save(null);
  // story finished: back to a fresh main menu after 5 seconds (drops any ?scene= jump)
  setTimeout(() => location.replace(location.pathname), 5000);
}

const go = $('#go');
const resume = $('#resume-game');
if (saved > 0 && !jump) {
  const where = $('#resume-where');
  where.textContent = `Chapter ${saved + 1} of ${order.length}: ${NAMES[order[saved]] || order[saved]}`;
  where.hidden = resume.hidden = false;
  go.textContent = 'Start a new mission';
  go.parentElement.classList.add('has-save');
  resume.addEventListener('click', () => { resume.blur(); play(saved); }, { once: true });
  resume.focus();
} else go.focus();

// Garage button on the main menu, once a mission has been started (saved progress or collected cards)
let started = saved >= 0;
try { started ||= collected().length > 0; } catch {}
if (started) {
  const gb = document.createElement('button');
  gb.type = 'button';
  gb.id = 'menu-garage';
  gb.className = 'ach-open';
  gb.innerHTML = `${DOOR}<span>Garage</span>`;
  gb.addEventListener('click', () => openGarage(true));
  $('#start .menu-actions').append(gb);
}

// Card preview: index.html?card=sojourner (one card) or ?card=all (every card in rovers.json)
const card = new URLSearchParams(location.search).get('card');
if (card) {
  const { reveal, rovers } = await import('./cards.js');
  go.textContent = 'Preview card';
  go.addEventListener('click', async (e) => {
    e.stopImmediatePropagation();
    go.blur();
    $('#start').hidden = true;
    for (const id of card === 'all' ? Object.keys(await rovers()) : [card]) await reveal(id);
    $('#start').hidden = false;
    go.focus();
  });
} else go.addEventListener('click', () => {
  go.blur();
  if (!jump) resetCollected(); // a new mission starts with no cards and no achievements (?scene= dev jumps keep them)
  play(Math.max(0, jump ? order.indexOf(jump) : 0));
}, { once: true });
