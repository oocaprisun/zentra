// Loads src/puzzles/<type>.js (+ optional <type>.css), handles hint / skip / "learn" card.
// Puzzle contract: export default function (el, config, api) { ... api.solve() / api.fail() }
import { $, state, hideDialog, waitAdvance } from './ui.js';
import * as audio from './audio.js';

function loadCss(type) {
  if (document.querySelector(`link[data-pz="${type}"]`)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = `src/puzzles/${type}.css`;
  l.dataset.pz = type;
  document.head.append(l);
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export async function runPuzzle(type, config = {}) {
  if (state.skipping) return;
  hideDialog();
  loadCss(type);
  const mod = await import(`../puzzles/${type}.js`);
  const root = $('#puzzle');
  root.innerHTML = '';
  root.hidden = false;

  const head = el('div', 'pz-head');
  head.append(el('h2', '', config.title || ''), el('p', '', config.prompt || ''));
  const body = el('div', 'pz-body');
  const foot = el('div', 'pz-foot');
  const hint = el('p', 'pz-hint');
  const skip = el('button', 'pz-skip', 'Skip puzzle');
  skip.hidden = true;
  foot.append(hint, skip);
  root.append(head, body, foot);
  if (mod.controls) {
    const help = el('div', 'pz-controls');
    for (const line of [].concat(mod.controls)) help.append(el('div', '', line));
    root.append(help);
  }

  let fails = 0;
  await new Promise((resolve) => {
    const api = {
      solve: () => { if (config.sfxSolve) audio.sfx(config.sfxSolve, config.sfxVolume ?? 1); resolve(); },
      fail: () => {
        fails++;
        if (config.sfxFail) audio.sfx(config.sfxFail, config.sfxVolume ?? 1);
        if (config.hint) hint.textContent = 'HINT: ' + config.hint;
        if (fails >= 3) skip.hidden = false;
      },
    };
    skip.onclick = resolve;
    mod.default(body, config, api);
  });

  if (config.learn) {
    root.innerHTML = '';
    const card = el('div', 'learn');
    card.append(el('h3', '', config.learnTitle || 'Why it worked'), el('p', '', config.learn));
    const btn = el('button', '', 'Continue');
    root.append(card, btn);
    btn.focus();
    await new Promise((r) => (btn.onclick = r));
  }
  root.hidden = true;
  root.innerHTML = '';
}
