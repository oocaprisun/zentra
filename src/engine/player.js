// Plays one scene file: scenes/<id>.json -> { "id", "steps": [ {...}, ... ] }
// Each step may contain several keys; they run in this order:
// bg+pan, actors, music(+musicVolume), sfx(+sfxVolume), fx, stamp(+stampStyle), say(+text,style), rover (card reveal), puzzle(+config), wait
// musicVolume without music fades the current track (musicFade ms, default 800).
import { reveal } from '../cards.js';
import * as ui from './ui.js';
import * as audio from './audio.js';
import * as fx from './fx.js';
import { runPuzzle } from './puzzle-host.js';

export async function playScene(id) {
  const res = await fetch(`scenes/${id}.json`);
  if (!res.ok) throw new Error(`Scene not found: scenes/${id}.json`);
  const scene = await res.json();
  ui.state.skipping = false;
  ui.state.scene = id;
  ui.state.lines = 0;
  autoCast(scene.steps, scene.suits);
  for (const step of scene.steps) await runStep(step);
  ui.hideDialog();
  ui.state.scene = null;
}

// Auto cast: every character who speaks before the next "bg" change is put on screen
// (art/chars/<name>.png), spread evenly. A step with "actors" still overrides by hand.
const SLOTS = { 1: [50], 2: [30, 70], 3: [22, 50, 78], 4: [14, 38, 62, 86] };
// "suits": true on a scene = everyone is cast in art/chars/<name>_astronaut.png
function autoCast(steps, suits) {
  let start = 0;
  const flush = (end) => {
    const seg = steps.slice(start, end);
    if (!seg.length || seg.some((s) => s.actors)) return;
    const names = [...new Set(seg.filter((s) => s.say && !s.style).map((s) => s.say.toLowerCase()))].slice(0, 4);
    seg[0].actors = names.map((n, i) => ({ img: `art/chars/${n}${suits ? '_astronaut' : ''}.png`, x: SLOTS[names.length][i] }));
  };
  steps.forEach((s, i) => { if ('bg' in s && i > start) { flush(i); start = i; } });
  flush(steps.length);
}

async function runStep(s) {
  if ('bg' in s) ui.setBg(s.bg, s.pan);
  if (s.actors) ui.setActors(s.actors);
  if ('music' in s) audio.music(s.music, s.musicVolume ?? 1);
  else if ('musicVolume' in s) audio.musicGain(s.musicVolume, s.musicFade ?? 800);
  if (s.sfx && !ui.state.skipping) audio.sfx(s.sfx, s.sfxVolume ?? 1);
  if (s.fx) await fx.run(s.fx);
  if (s.stamp) await ui.stamp(s.stamp, s.stampStyle);
  if (s.say !== undefined) await ui.say(s.say, s.text, s.style, s);
  if (s.rover) await reveal(s.rover);
  if (s.puzzle) await runPuzzle(s.puzzle, s.config);
  if (s.wait && !ui.state.skipping) await ui.sleep(s.wait);
}

// "Skip scene" button: fast-forward to the end of the current scene
document.getElementById('skip').addEventListener('click', () => {
  ui.state.skipping = true;
  ui.pressAdvance();
});
