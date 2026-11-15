// Visual effects. Usage in a scene step: "fx": "shake" or "fx": ["alarm", "shake"]
import { $, sleep, state, hideDialog } from './ui.js';

// slow black fades: the picture darkens / comes back over SLOW ms
const SLOW = 6000;
async function slowFade(on) {
  const f = $('#fade');
  f.style.transition = state.skipping ? '' : `opacity ${SLOW}ms ease-in-out`;
  f.classList.toggle('on', on);
  if (!state.skipping) await sleep(SLOW);
  f.style.transition = '';
}

const effects = {
  alarm: () => { $('#fx').className = 'alarm'; },
  clear: () => { $('#fx').className = ''; },
  flash: () => { const f = $('#fx'); f.className = ''; void f.offsetWidth; f.className = 'flash'; },
  // continuous heavy shaking until "calm"
  rumble: () => $('#stage').classList.add('rumble'),
  calm: () => $('#stage').classList.remove('rumble'),
  dream: () => $('#stage').classList.add('dream'),
  undream: () => $('#stage').classList.remove('dream'),
  shake: () => { const s = $('#stage'); s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake'); },
  fadeOut: async () => { $('#fade').classList.add('on'); if (!state.skipping) await sleep(900); },
  // full white flashbang; the next "fadeIn" slowly fades back from white
  whiteout: async () => { const f = $('#fade'); f.classList.add('white', 'on'); if (!state.skipping) await sleep(150); },
  // instant full black (no fade), e.g. the first step of a scene before its title card
  black: () => { const f = $('#fade'); f.style.transition = 'none'; f.classList.remove('white'); f.classList.add('on'); void f.offsetWidth; f.style.transition = ''; },
  // hide the subtitle box (e.g. before a silent pause)
  hideDialog: () => hideDialog(),
  // subtitles show above a black "fadeOut" screen (e.g. a last line on black); cleared by "textBelow"
  textOnTop: () => $('#stage').classList.add('text-top'),
  textBelow: () => $('#stage').classList.remove('text-top'),
  // fade to full black over 6 s, then hide the subtitle
  fadeOutSlow: async () => { await slowFade(true); hideDialog(); },
  // blend the black screen back into the picture over 6 s
  fadeInSlow: () => slowFade(false),
  fadeIn: async () => {
    const f = $('#fade');
    const white = f.classList.contains('white');
    f.classList.remove('on');
    if (!state.skipping) await sleep(white ? 1800 : 900);
    f.classList.remove('white');
  },
};

export async function run(names) {
  for (const n of [].concat(names)) {
    if (!effects[n]) { console.warn('Unknown fx:', n); continue; }
    await effects[n]();
  }
}
