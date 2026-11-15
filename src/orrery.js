// Main menu background: a pixel-art solar system drawn at the game's art size (480x270),
// scaled up 4x by CSS. A small ship flies Earth -> Mars now and then: the game's route.
// Stops drawing once the menu is gone. Reduced motion: one still frame.

const W = 480, H = 270;
const SUN = { x: 322, y: 146 };
const TILT = 0.4; // squash orbits into a perspective ellipse

// r: orbit radius (px), s: planet radius, c: colors [light, shadow], a: start angle
const PLANETS = [
  { name: 'mercury', r: 34, s: 1.8, c: ['#b9b2a8', '#6b655e'], a: 1.2 },
  { name: 'venus', r: 52, s: 2.8, c: ['#ecd29a', '#9a7d4a'], a: 4.1 },
  { name: 'earth', r: 74, s: 3.4, c: ['#5ea6ff', '#24427a'], a: 2.3, key: true },
  { name: 'mars', r: 100, s: 2.9, c: ['#e0663a', '#7a2b16'], a: 5.4, key: true },
  { name: 'jupiter', r: 146, s: 8, c: ['#e8c49a', '#7d5a3c'], a: 3.3, bands: '#b98a5c' },
  { name: 'saturn', r: 192, s: 6.4, c: ['#eedcae', '#8a7650'], a: 0.6, ring: '#cbb787' },
  { name: 'uranus', r: 236, s: 4.4, c: ['#9fe3e8', '#3f7f88'], a: 2.0 },
  { name: 'neptune', r: 276, s: 4.4, c: ['#5b7cf0', '#26357a'], a: 4.6 },
];
const EARTH_PERIOD = 46; // seconds per Earth orbit; others follow Kepler (T ~ r^1.5)
for (const p of PLANETS) p.w = (Math.PI * 2 / EARTH_PERIOD) * Math.pow(74 / p.r, 1.5);

// deterministic stars so the sky doesn't reshuffle on reload
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const STARS = Array.from({ length: 260 }, () => ({
  x: Math.floor(rnd() * W), y: Math.floor(rnd() * H),
  b: rnd() < 0.12 ? 2 : rnd() < 0.5 ? 1 : 0, ph: rnd() * 6.28, sp: 0.6 + rnd() * 1.8,
}));

// red cross over Earth (Moon finished) / Mars once every machine there is collected (cards.js saves them)
const MOON_SET = ['eagle', 'surveyor-3', 'lrv'], MARS_SET = ['sojourner', 'opportunity', 'ingenuity'];
let cleared = { moon: false, mars: false }, checkedAt = -1;
function checkCleared(t) {
  if (t - checkedAt < 1) return; // re-read once a second
  checkedAt = t;
  let got = [];
  try { got = JSON.parse(localStorage.getItem('zentra-rovers')) || []; } catch {}
  cleared = { moon: MOON_SET.every((id) => got.includes(id)), mars: MARS_SET.every((id) => got.includes(id)) };
}
// "Start a new mission" wipes the cards: drop the crosses right away
addEventListener('rovers-reset', () => { cleared = { moon: false, mars: false }; checkedAt = -1; });
function cross(cx, cy, r) { // pixel X with a dark rim so it reads on any background
  cx = Math.round(cx); cy = Math.round(cy);
  for (const [c, w] of [['#2a0606', 1], ['#ff3b30', 0]]) {
    ctx.fillStyle = c;
    for (let i = -r; i <= r; i++) for (let o = -w; o <= w; o++) {
      ctx.fillRect(cx + i + o, cy + i, 1, 1);
      ctx.fillRect(cx + i + o, cy - i, 1, 1);
    }
  }
}

const canvas = document.getElementById('orrery');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
const pos = (r, a) => ({ x: SUN.x + Math.cos(a) * r, y: SUN.y + Math.sin(a) * r * TILT });

// shaded pixel disc: lit on the side facing the sun
function disc(cx, cy, r, [lit, dark], bands) {
  const lx = SUN.x - cx, ly = SUN.y - cy, ll = Math.hypot(lx, ly) || 1;
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dy * dy > r * r + r * 0.6) continue;
    const facing = (dx * lx + dy * ly) / ll / r; // -1 far side .. 1 near side
    let c = facing < -0.25 ? dark : lit;
    if (bands && c === lit && (dy + R) % 3 === 0) c = bands;
    px(cx + dx, cy + dy, c);
  }
}

function orbit(r, bright) {
  const n = Math.round(r * 1.4);
  ctx.fillStyle = bright ? 'rgba(174,191,232,.7)' : 'rgba(125,143,189,.32)';
  for (let i = 0; i < n; i += 2) { // every other dot: a dotted pixel line
    const p = pos(r, (i / n) * Math.PI * 2);
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
  }
}

function sun(t) {
  // dithered glow, breathing slowly
  const g = 26 + Math.sin(t * 0.8) * 1.5;
  for (let dy = -g; dy <= g; dy++) for (let dx = -g; dx <= g; dx++) {
    const d = Math.hypot(dx, dy);
    if (d < 13 || d > g) continue;
    const k = 1 - (d - 13) / (g - 13);
    if (((dx + dy) & 1) === 0 && (d < 17 || (dx & 1) === 0 && k > 0.25)) {
      ctx.fillStyle = `rgba(255,150,60,${(0.12 + k * 0.4).toFixed(2)})`;
      ctx.fillRect(SUN.x + dx, SUN.y + dy, 1, 1);
    }
  }
  for (let dy = -13; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) {
    const d = Math.hypot(dx, dy);
    if (d > 13.3) continue;
    px(SUN.x + dx, SUN.y + dy, d < 6 ? '#fff6cf' : d < 10 ? '#ffd35c' : '#ff9a3c');
  }
}

function planet(p, t) {
  const a = p.a + p.w * t;
  const { x, y } = pos(p.r, a);
  if (p.ring) { // Saturn: back half of the ring, planet, front half
    ring(x, y, p, -1);
    disc(x, y, p.s, p.c);
    ring(x, y, p, 1);
  } else disc(x, y, p.s, p.c, p.bands);
  if (p.name === 'earth') { // the Moon, a single bright pixel
    const m = a * 12, mx = x + Math.cos(m) * 7, my = y + Math.sin(m) * 7 * 0.5;
    px(mx, my, '#d9dde8');
    // Moon finished: X sits on Earth itself (on the fast-orbiting Moon pixel it looked like it lagged behind)
    if (cleared.moon) cross(x, y, 5);
  }
  if (p.name === 'mars' && cleared.mars) cross(x, y, 5);
  return { x, y, a };
}
function ring(x, y, p, side) {
  ctx.fillStyle = p.ring;
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const sy = Math.sin(a);
    if ((sy > 0 ? 1 : -1) !== side) continue;
    ctx.fillRect(Math.round(x + Math.cos(a) * 11), Math.round(y + sy * 3), 1, 1);
  }
}

// the ship: leaves Earth on a half-ellipse transfer to Mars' orbit, every so often
const TRIP = 9, GAP = 7; // seconds flying, seconds waiting
const trail = [];
function ship(t, earth) {
  const cyc = t % (TRIP + GAP);
  if (cyc < TRIP) {
    if (!ship.start || ship.cycle !== Math.floor(t / (TRIP + GAP))) {
      ship.cycle = Math.floor(t / (TRIP + GAP));
      ship.start = earth.a;
    }
    const k = cyc / TRIP;
    const e = k * k * (3 - 2 * k); // ease in-out
    const r = 74 + (100 - 74) * (1 - Math.cos(e * Math.PI)) / 2;
    const p = pos(r, ship.start + e * Math.PI);
    trail.push({ x: p.x, y: p.y, life: 1 });
    px(p.x, p.y, '#ffffff');
    px(p.x - 1, p.y, '#ffb36b');
  }
  for (let i = trail.length - 1; i >= 0; i--) {
    const d = trail[i];
    d.life -= 0.012;
    if (d.life <= 0) { trail.splice(i, 1); continue; }
    ctx.fillStyle = `rgba(255,179,107,${(d.life * 0.55).toFixed(2)})`;
    ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 1);
  }
}

function frame(t) {
  checkCleared(t);
  ctx.fillStyle = '#05070f';
  ctx.fillRect(0, 0, W, H);
  for (const s of STARS) {
    const tw = 0.55 + 0.45 * Math.sin(t * s.sp + s.ph);
    const base = [0.25, 0.5, 0.9][s.b];
    ctx.fillStyle = `rgba(220,228,255,${(base * tw).toFixed(2)})`;
    ctx.fillRect(s.x, s.y, 1, 1);
    if (s.b === 2 && tw > 0.85) { // brightest stars flare into a tiny cross
      ctx.fillStyle = `rgba(220,228,255,${((tw - 0.85) * 3).toFixed(2)})`;
      ctx.fillRect(s.x - 1, s.y, 3, 1); ctx.fillRect(s.x, s.y - 1, 1, 3);
    }
  }
  for (const p of PLANETS) orbit(p.r, p.key);
  // planets behind the sun first (upper half of the ellipse), then the sun, then the rest
  const behind = [], front = [];
  for (const p of PLANETS) (Math.sin(p.a + p.w * t) < 0 ? behind : front).push(p);
  let earth;
  for (const p of behind) { const o = planet(p, t); if (p.name === 'earth') earth = o; }
  sun(t);
  for (const p of front) { const o = planet(p, t); if (p.name === 'earth') earth = o; }
  ship(t, earth);
}

const start = document.getElementById('start');
if (matchMedia('(prefers-reduced-motion: reduce)').matches) frame(12);
else {
  const t0 = performance.now();
  const loop = (now) => {
    if (start.classList.contains('gone')) return; // menu closed: stop drawing
    frame((now - t0) / 1000 + 12);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
