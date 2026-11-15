// Screen elements: background, actors, dialogue, stamp. No game logic here.
import * as audio from './audio.js';
export const $ = (s) => document.querySelector(s);
const rawSleep = (ms) => new Promise((r) => setTimeout(r, ms));
// scene: id of the scene playing; talking: a line (or stamp) is still being typed
// lines: dialogue lines finished in the current scene
export const state = { skipping: false, paused: false, scene: null, talking: false, lines: 0 };
// sleep that holds while the pause menu is open
export async function sleep(ms) { await rawSleep(ms); while (state.paused) await rawSleep(100); }
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- "press to continue" ----
let advance = null;
export function waitAdvance() { return new Promise((r) => (advance = () => { advance = null; r(); })); }
export function pressAdvance() { if (!state.paused) advance?.(); }
addEventListener('keydown', (e) => {
  if ((e.code === 'Space' || e.code === 'Enter') && advance && !e.target.closest?.('button')) { e.preventDefault(); pressAdvance(); }
});
$('#dialog').addEventListener('click', pressAdvance);

// ---- missing art -> visible placeholder so scenes work before art exists ----
function placeholder(src) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="100%" height="100%" fill="#1b2140"/><text x="50%" y="50%" fill="#ffb000" font-family="monospace" font-size="14" text-anchor="middle">missing: ${src}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function loadImg(img, src) {
  img.onerror = () => {
    // no <name>_astronaut.png yet (e.g. Emily)? fall back to the normal <name>.png first
    if (/_astronaut\.png$/.test(src)) { const plain = src.replace('_astronaut', ''); img.onerror = () => { img.onerror = null; img.src = placeholder(plain); }; img.src = plain; return; }
    img.onerror = null; img.src = placeholder(src);
  };
  img.src = src;
}

export function setBg(src, pan) {
  const cam = $('#cam');
  cam.className = '';
  void cam.offsetWidth; // restart animation
  if (pan) cam.className = 'pan-' + pan;
  if (src) loadImg($('#bg'), src); else $('#bg').removeAttribute('src');
}

// actors: [{ img, x (0-100 %), flip, h (px height), y, float, delay,
//            from (start x %, glides to x), enter (glide seconds, default 10), fadeOut (seconds) }]
// An actor listed exactly the same as in the previous step stays on screen untouched
// (no restart of its float animation); only "fadeOut" may be added to it.
export function setActors(list) {
  const box = $('#actors');
  const old = [...box.children];
  const keyOf = (a) => JSON.stringify({ ...a, fadeOut: undefined });
  const keep = new Set();
  const out = list.map((a) => {
    let img = old.find((o) => !keep.has(o) && o.dataset.key === keyOf(a));
    if (img) keep.add(img);
    else img = makeActor(a);
    if (a.fadeOut) {
      img.style.transition = `opacity ${a.fadeOut}s ease-in, filter .25s`;
      requestAnimationFrame(() => requestAnimationFrame(() => (img.style.opacity = 0)));
    }
    return img;
  });
  old.forEach((o) => { if (!keep.has(o)) o.remove(); });
  out.forEach((img) => { if (!img.isConnected) box.append(img); });
}

function makeActor(a) {
  const img = document.createElement('img');
  img.alt = '';
  img.dataset.key = JSON.stringify({ ...a, fadeOut: undefined });
  img.style.left = (a.x ?? 50) + '%';
  if (a.h) img.style.height = a.h + 'px';
  if (a.flip) img.className = 'flip';
  if (a.y != null) img.style.bottom = a.y + 'px';   // height above screen bottom
  const anims = [];
  if (a.from != null) { img.style.setProperty('--from', a.from + '%'); anims.push(`enter ${a.enter ?? 10}s cubic-bezier(.2,.55,.25,1) both`); }
  if (a.float) { img.classList.add('float'); anims.push(`drift 7s ease-in-out ${a.delay ?? 0}s infinite alternate`); }
  if (anims.length) img.style.animation = anims.join(', ');
  img.dataset.name = (a.img.split('/').pop() || '').replace(/\.\w+$/, '').toLowerCase();
  img.dataset.x = a.x ?? 50;
  loadImg(img, a.img);
  return img;
}

export function hideDialog() { $('#dialog').hidden = true; }

// Talking: while the text types, flip the speaker between <name>.png and <name>_talking.png.
// Skipped if the _talking file is missing or has a different size (it would jump on screen).
const talkCache = {};
function sizeOf(src) {
  return (talkCache[src] ??= new Promise((r) => {
    const im = new Image();
    im.onload = () => r(im.naturalWidth + 'x' + im.naturalHeight);
    im.onerror = () => r(null);
    im.src = src;
  }));
}
async function talk(img) {
  const base = img.dataset.base ??= img.getAttribute('src');
  if (!base || base.startsWith('data:')) return () => {};
  // helmets on: astronaut / space-suit sprites never use the talking animation
  if (/(_astronaut|-space)[^/]*\.png$/i.test(base)) return () => {};
  const alt = base.replace(/\.png$/, '_talking.png');
  const [a, b] = await Promise.all([sizeOf(base), sizeOf(alt)]);
  if (!b || a !== b) return () => {};
  let open = false;
  const timer = setInterval(() => { if (!state.paused) img.src = (open = !open) ? alt : base; }, 140);
  return () => { clearInterval(timer); img.src = base; };
}

// opts.speed = ms per letter (default 28), opts.auto = continue by itself after N ms (no key press)
export async function say(who, text, style, opts = {}) {
  if (state.skipping) return;
  const d = $('#dialog');
  d.hidden = false;
  d.className = style || (who ? '' : 'narration');
  if (style === 'radio') audio.radioStatic();
  $('#who').textContent = who ? who + ':' : '';
  // put the subtitle above the speaking character (if on screen); dim the others
  const actors = [...document.querySelectorAll('#actors img')];
  // emily_crying.png / emily-smiling.png still count as EMILY
  const nm = who.toLowerCase();
  const speaker = who && !style ? actors.find((a) => a.dataset.name === nm || a.dataset.name.split(/[_-]/)[0] === nm) : null;
  for (const a of actors) a.classList.toggle('quiet', !!who && !style && a !== speaker);
  if (speaker) {
    d.classList.add('near');
    d.style.left = Math.min(1500, Math.max(420, (speaker.dataset.x / 100) * 1920)) + 'px';
  } else d.style.left = '';
  const stopTalk = speaker ? await talk(speaker) : () => {};
  const t = $('#words');
  t.textContent = '';
  let pressed = false;
  const press = waitAdvance().then(() => (pressed = true));
  // letters live inside a no-wrap word span, so a word never splits across lines
  let word = null;
  state.talking = true;
  for (const ch of text) {
    if (pressed || state.skipping) break;
    if (ch === ' ') { t.append(' '); word = null; continue; }
    if (!word) {
      word = document.createElement('span');
      word.className = 'word';
      t.append(word);
      audio.pop(); // one pop per word
    }
    const s = document.createElement('span');
    s.className = 'ch';
    s.textContent = ch;
    word.append(s);
    if (!reduced) await sleep(opts.speed ?? 28);
  }
  state.talking = false;
  state.lines++;
  stopTalk();
  if (pressed || state.skipping) t.textContent = text;
  if (opts.auto != null) { if (!pressed) await Promise.race([sleep(opts.auto), press]); advance = null; hideDialog(); return; }
  if (pressed) await waitAdvance(); else await press;
}

// style: optional extra class, e.g. "red" (scene step key "stampStyle")
export async function stamp(lines, style = '') {
  if (state.skipping) return;
  hideDialog();
  const el = $('#stamp');
  el.className = style;
  el.innerHTML = '';
  state.talking = true;
  for (const line of lines) {
    const div = document.createElement('div');
    el.append(div);
    for (const ch of line) { div.textContent += ch; if (!reduced) await sleep(40); }
    await sleep(250);
  }
  state.talking = false;
  await Promise.race([sleep(2200), waitAdvance()]);
  advance = null;
  el.className = (style + ' out').trim();
}
