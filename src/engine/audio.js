// Music (one looping track) + one-shot sound effects. Missing files fail silently.
// Volumes are 0..1, changed live by the pause menu.
// Player volume (pause menu) x per-sound gain from the scene (0..1, default 1).
let track = null;
let trackGain = 1;
let fadeTimer = null;
export const volume = { music: 0.5, sfx: 0.8, text: 0.5 };

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(+v) ? +v : 1));

export function music(src, gain = 1) {
  clearInterval(fadeTimer);
  if (track) { track.pause(); track = null; }
  trackGain = clamp01(gain);
  if (!src) return;
  track = new Audio(src);
  track.loop = true;
  track.volume = volume.music * trackGain;
  track.play().catch(() => {});
}

// Change the current track's gain without restarting it; fades over `ms`.
export function musicGain(gain, ms = 800) {
  clearInterval(fadeTimer);
  const to = clamp01(gain), from = trackGain, t0 = performance.now();
  if (!track || ms <= 0) { trackGain = to; applyVolume(); return; }
  fadeTimer = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    trackGain = from + (to - from) * k;
    applyVolume();
    if (k === 1) clearInterval(fadeTimer);
  }, 30);
}

export function pauseMusic(p) { if (track) p ? track.pause() : track.play().catch(() => {}); }
export function applyVolume() { if (track) track.volume = Math.min(1, volume.music * trackGain); }

export function sfx(src, gain = 1) {
  const a = new Audio(src);
  a.volume = Math.min(1, volume.sfx * clamp01(gain));
  a.play().catch(() => {});
}

// subtitle "pop": one short tick per word, subtle and slightly varied
const POP = 'audio/pop-noise_subtitles.wav';
const popBase = new Audio(POP);
export function pop() {
  if (!volume.text) return;
  const a = popBase.cloneNode();
  a.volume = Math.min(1, volume.text * 0.35);
  a.playbackRate = 0.92 + Math.random() * 0.16;
  a.play().catch(() => {});
}

// radio static for the whole time a "style": "radio" line is on screen:
// a short louder burst, then a quieter hiss under the words. Returns stop().
// isPaused() is polled so the hiss stops while the pause menu or garage is open.
export function radioLoop(isPaused = () => false) {
  const a = new Audio('audio/radio_static.mp3');
  a.loop = true;
  const t0 = performance.now();
  const level = () => Math.min(1, volume.sfx * (performance.now() - t0 < 600 ? 0.3 : 0.12));
  a.volume = level();
  a.play().catch(() => {});
  const timer = setInterval(() => {
    a.volume = level();
    if (isPaused()) { if (!a.paused) a.pause(); }
    else if (a.paused) a.play().catch(() => {});
  }, 100);
  return () => { clearInterval(timer); a.pause(); };
}

// short burst of radio static
export function radioStatic(ms = 600) {
  const a = new Audio('audio/radio_static.mp3');
  a.volume = Math.min(1, volume.sfx * 0.3);
  a.play().catch(() => {});
  setTimeout(() => { a.pause(); }, ms);
}
