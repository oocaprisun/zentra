// Rover cards: the "new rover found" reveal (card flies in from the right, name slams in
// from the left, impact), then the card floats in the centre until the player collects it.
// Use in a scene step: { "rover": "sojourner" }  (ids and card data live in rovers.json)
// Preview without playing: index.html?card=sojourner  or  ?card=all
import { state } from './engine/ui.js';
import * as audio from './engine/audio.js';

const COLLECTED = 'zentra-rovers';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let data = null;

export async function rovers() {
  // whole-line "// notes" are allowed in rovers.json; they are stripped before parsing
  data ??= JSON.parse((await (await fetch('rovers.json')).text()).replace(/^\s*\/\/.*$/gm, ''));
  return data;
}
export function collected() {
  try { return JSON.parse(localStorage.getItem(COLLECTED)) || []; } catch { return []; }
}
// wipe every collected card (= all achievements); used by "Start a new mission"
export function resetCollected() {
  try { localStorage.removeItem(COLLECTED); } catch {}
  dispatchEvent(new Event('rovers-reset')); // orrery.js clears the planet crosses
}
function collect(id) {
  const list = collected();
  if (list.includes(id)) return;
  list.push(id);
  try { localStorage.setItem(COLLECTED, JSON.stringify(list)); } catch {}
  dispatchEvent(new CustomEvent('rover-collected', { detail: id })); // achievements.js shows the popup
}

const wait = async (ms) => {
  await new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 150) : ms));
  while (state.paused) await new Promise((r) => setTimeout(r, 100));
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function cardHTML(id, r) {
  const age = new Date().getFullYear() - r.year;
  const stats = Object.entries(r.stats || {}).slice(0, 3).map(([k, v]) =>
    `<li><span>${esc(k)}</span><b style="--v:${Math.max(0, Math.min(100, v))}"></b><em>${v}</em></li>`).join('');
  const code = `ZN-${r.year}-${id.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase()}`;
  return `<article class="card card-${r.rank}" data-planet="${r.planet}">
    <div class="card-frame">
      <header>
        <div class="card-tag"><span class="card-rank">${r.rank === 'unreal' ? 'Unreal' : 'Legendary'}</span><span class="card-code">${code}</span></div>
        <h3>${esc(r.name)}</h3>
      </header>
      <div class="card-art">
        <span class="card-grid"></span><span class="card-beam"></span><span class="card-pad"></span>
        <img alt="${esc(r.name)}" src="${esc(r.img)}">
        <span class="card-scan"></span><span class="card-hud"></span>
        <span class="card-missing">Art coming soon</span>
      </div>
      <div class="card-id"><span>&ldquo;${esc(r.nickname)}&rdquo;</span><span>${age} years old</span></div>
      <ul class="card-stats">${stats}</ul>
      <footer><span>${esc(r.mission)}, ${r.year}</span><i class="card-bars"></i></footer>
    </div>
    <div class="card-shine"></div>
  </article>`;
}

// ---- timing (ms from the start of the reveal); sound and visuals both follow it ----
const T = { name: 40, card: 520, hit: 780, hop: 980, step: 75 };

// ---- sound: whoosh, impact, a blip per hopping letter, shimmer (or a file from rovers.json "sfx") ----
let ac = null;
// coin "ding" for an extra item popping out (e.g. Voyager's Golden Record)
function coinSound() {
  try { ac ??= new AudioContext(); ac.resume(); } catch { return; }
  const t = ac.currentTime, out = ac.createGain();
  out.gain.value = 0.35 * audio.volume.sfx;
  out.connect(ac.destination);
  [[1318, 0], [1976, 0.07], [2637, 0.5]].forEach(([f, d]) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.6, t + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.5);
    o.connect(g).connect(out); o.start(t + d); o.stop(t + d + 0.55);
  });
}
function synth(rank, letters) {
  try { ac ??= new AudioContext(); ac.resume(); } catch { return; }
  const out = ac.createGain();
  out.gain.value = 0.55 * audio.volume.sfx;
  out.connect(ac.destination);
  const t = ac.currentTime, at = (ms) => t + ms / 1000;
  const noise = (dur) => {
    const b = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ac.createBufferSource(); s.buffer = b; return s;
  };
  const whoosh = (start, dur, from, to, vol) => {
    const w = noise(dur), bp = ac.createBiquadFilter(), g = ac.createGain();
    bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(from, start); bp.frequency.exponentialRampToValueAtTime(to, start + dur * 0.9);
    g.gain.setValueAtTime(0.0001, start); g.gain.exponentialRampToValueAtTime(vol, start + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    w.connect(bp).connect(g).connect(out); w.start(start);
  };
  const thump = (start, f0, f1, dur, vol) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(f0, start); o.frequency.exponentialRampToValueAtTime(f1, start + dur * 0.8);
    g.gain.setValueAtTime(vol, start); g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(out); o.start(start); o.stop(start + dur + 0.05);
  };
  whoosh(at(T.name), 0.38, 2600, 400, 0.7);          // name rushes in from the left
  whoosh(at(T.card - 200), 0.3, 300, 3400, 0.9);     // card rushes in from the right
  const hit = at(T.hit);                             // the clash
  thump(hit, 160, 32, 0.7, 1.4);
  thump(hit, 70, 28, 0.9, 0.9);
  const c = noise(0.3), cf = ac.createBiquadFilter(), cg = ac.createGain();
  cf.type = 'highpass'; cf.frequency.value = 900;
  cg.gain.setValueAtTime(0.9, hit); cg.gain.exponentialRampToValueAtTime(0.0001, hit + 0.28);
  c.connect(cf).connect(cg).connect(out); c.start(hit);
  for (let i = 0; i < letters; i++) {                // hop wave: rising blips
    const s = at(T.hop + i * T.step), o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(330 * Math.pow(2, i / 12 * 1.6), s);
    o.frequency.exponentialRampToValueAtTime(660 * Math.pow(2, i / 12 * 1.6), s + 0.06);
    g.gain.setValueAtTime(0.06, s); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.09);
    o.connect(g).connect(out); o.start(s); o.stop(s + 0.1);
  }
  const settle = at(T.hop + letters * T.step + 700);  // shimmer when the card takes the centre
  const notes = rank === 'unreal' ? [622, 784, 988, 1245, 1568] : [784, 988, 1175, 1568, 1976];
  notes.forEach((f, i) => {
    const s = settle + i * 0.07, osc = ac.createOscillator(), g = ac.createGain();
    osc.type = 'triangle'; osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.16, s + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, s + 1.4);
    osc.connect(g).connect(out); osc.start(s); osc.stop(s + 1.5);
  });
}

// the name as single letters on an arch: biggest and highest in the middle, tilted outward at the ends
function nameHTML(name) {
  const chars = [...name];
  const n = chars.length;
  const base = Math.min(132, Math.round(1180 / n));
  let hop = 0;
  return chars.map((ch, i) => {
    if (ch === ' ') return '<span class="l-gap"></span>';
    const u = (i + 0.5) / n;                 // 0..1 across the word
    const bell = Math.sin(Math.PI * u);      // 0 at the ends, 1 in the middle
    const size = Math.round(base * (0.72 + 0.5 * bell));
    const y = Math.round(-70 * bell);
    const rot = (-14 * Math.cos(Math.PI * u)).toFixed(1);
    const c = esc(ch);
    return `<span class="l" style="--i:${hop++};--n:${n};--s:${size}px;--y:${y}px;--r:${rot}deg;--u:${u.toFixed(3)}">` +
      `<span class="l-in"><span class="l-back">${c}</span><span class="l-face">${c}</span></span></span>`;
  }).join('');
}

// ---- the reveal ----
export async function reveal(id) {
  const r = (await rovers())[id];
  if (!r) { console.warn('Unknown rover:', id); return; }
  if (state.skipping) { collect(id); return; } // "Skip scene" still gives the card + achievement
  const letters = [...r.name].filter((c) => c !== ' ').length;

  const root = document.createElement('div');
  root.className = `rv rv-${r.rank}`;
  root.innerHTML = `
    <div class="rv-dim"></div>
    <div class="rv-lines"></div>
    <div class="rv-name" aria-hidden="true">${nameHTML(r.name)}</div>
    <div class="rv-ring"></div>
    <div class="rv-slash"></div>
    <div class="rv-flash"></div>
    <div class="rv-card">${cardHTML(id, r)}${r.extra ? `
      <button type="button" class="rv-extra" aria-describedby="rv-extra-tip">
        <img alt="${esc(r.extra.name)}" src="${esc(r.extra.img)}">
        <span class="rv-extra-tip" id="rv-extra-tip" role="tooltip"><b>${esc(r.extra.name)}</b>${esc(r.extra.tip || '')}<small>Now in your hangar.</small></span>
      </button>` : ''}</div>
    <div class="rv-prompt"><small>New machine found</small><b>${esc(r.name)}</b>
      <button class="rv-get" type="button">Collect</button></div>
    <button class="rv-collect" type="button">Continue</button>`;
  document.getElementById('stage').append(root);
  const img = root.querySelector('.card-art img');
  img.onerror = () => img.closest('.card-art').classList.add('is-missing');
  const click = (sel) => {
    const b = root.querySelector(sel);
    b.focus({ preventScroll: true });
    return new Promise((res) => b.addEventListener('click', res, { once: true }));
  };

  // 1. the find: a Collect button over the scene
  await wait(30);
  root.classList.add('is-prompt');
  await click('.rv-get');
  root.classList.remove('is-prompt');

  // 2. the achievement unlocks first (achievements.js shows the popup)...
  collect(id);
  await wait(1300);

  // 3. ...then the card animation
  if (r.sfx) audio.sfx(r.sfx, r.sfxVolume ?? 1); else synth(r.rank, letters);
  const steps = [
    [T.name, 'is-in'],      // dark + speed lines, letters slam in from the left one by one
    [T.card, 'is-card'],    // card rushes in from the right
    [T.hit, 'is-hit'],      // clash: impact frame, shockwave, slash, heavy shake
    [T.hop, 'is-hop'],      // a hop wave runs over the letters
    [T.hop + letters * T.step + 450, 'is-center'], // name blasts away, card takes the centre
    [T.hop + letters * T.step + 1100, 'is-idle'],  // float + glow, continue button
  ];
  let now = 0;
  if (r.extra) steps.push([steps.at(-1)[0] + 500, 'is-extra']); // the extra item pops out like a coin
  for (const [ms, cls] of steps) {
    await wait(ms - now); now = ms; root.classList.add(cls);
    if (cls === 'is-extra') coinSound();
  }

  await click('.rv-collect');
  root.classList.add('is-out');
  await wait(600);
  root.remove();
}
