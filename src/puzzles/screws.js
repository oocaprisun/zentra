// Puzzle "screws": tighten the 4 hatch screws criss-cross: any screw first, then the one
// diagonally opposite, then the other diagonal pair (either one first).
// Index layout: 0 top-left, 1 top-right, 2 bottom-right, 3 bottom-left.
const NAMES = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
const POS = [[0, 0], [0, 1], [1, 1], [1, 0]]; // [row, col] per index
const KEYS = { KeyW: 'ArrowUp', KeyS: 'ArrowDown', KeyA: 'ArrowLeft', KeyD: 'ArrowRight' };

export default function (el, config, api) {
  const need = config.turns || 3;
  const turns = [0, 0, 0, 0];
  const done = []; // screws fully tightened, in order
  let cur = -1;    // screw being turned right now (must be finished first)
  let busy = false;
  let failed = false;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  el.innerHTML = '';
  const panel = document.createElement('div');
  panel.className = 'screws-panel';
  const guide = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  guide.setAttribute('class', 'screws-guide');
  guide.setAttribute('viewBox', '0 0 100 100');
  guide.innerHTML = '<path d="M16 16 L84 84 M84 16 L16 84"/>';
  const label = document.createElement('div');
  label.className = 'screws-label';
  label.textContent = config.doneLabel || 'SEALED';
  panel.append(guide, label);

  const btns = NAMES.map((name, i) => {
    const slot = document.createElement('div');
    slot.className = 'screws-slot screws-slot-' + i;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'screws-screw';
    b.dataset.idx = i;
    b.innerHTML = '<span class="screws-slit"></span>';
    const pips = document.createElement('div');
    pips.className = 'screws-pips';
    for (let k = 0; k < need; k++) pips.append(Object.assign(document.createElement('i'), { className: 'screws-pip' }));
    slot.append(b, pips);
    panel.append(slot);
    return b;
  });
  el.append(panel);

  function draw() {
    btns.forEach((b, i) => {
      const t = turns[i];
      b.style.setProperty('--t', t);
      b.style.setProperty('--p', t / need);
      b.classList.toggle('screws-done', t >= need);
      b.setAttribute('aria-label', `${NAMES[i]} screw, ${t} of ${need} turns`);
      [...b.parentNode.querySelectorAll('.screws-pip')].forEach((p, k) => p.classList.toggle('screws-on', k < t));
    });
  }

  function reset() {
    turns.fill(0);
    done.length = 0;
    cur = -1;
    draw();
  }

  function turn(i) {
    if (busy || turns[i] >= need) return;
    const ok = cur !== -1 ? i === cur
      : done.length % 2 ? i === (done[done.length - 1] + 2) % 4 // finish the diagonal
      : true; // start a new diagonal anywhere
    if (!ok) {
      busy = true;
      failed = true;
      panel.classList.add('screws-warp', 'screws-hint');
      api.fail();
      setTimeout(() => {
        panel.classList.remove('screws-warp');
        reset();
        busy = false;
      }, reduce ? 300 : 500);
      return;
    }
    turns[i]++;
    cur = i;
    if (turns[i] >= need) { done.push(i); cur = -1; }
    draw();
    if (done.length >= 4) {
      busy = true;
      panel.classList.add('screws-sealed');
      setTimeout(() => api.solve(), 800);
    }
  }

  panel.addEventListener('click', (e) => {
    const b = e.target.closest('.screws-screw');
    if (b) turn(+b.dataset.idx);
  });

  panel.addEventListener('keydown', (e) => {
    const b = e.target.closest('.screws-screw');
    if (!b) return;
    const key = KEYS[e.code] || e.key;
    const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[key];
    if (!d) return;
    e.preventDefault();
    const [r, c] = POS[+b.dataset.idx];
    const to = POS.findIndex(([pr, pc]) => pr === Math.min(1, Math.max(0, r + d[0])) && pc === Math.min(1, Math.max(0, c + d[1])));
    if (to >= 0) btns[to].focus();
  });

  draw();
  if (failed) panel.classList.add('screws-hint');
}

export const controls = [
  'Click a screw to turn it',
  'Or: W A S D / arrow keys to pick a screw, Enter or Space to turn it',
];
