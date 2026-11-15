// Puzzle "wires": click a plug on the left, then the terminal of the same color on the right.
const PAL = { red: '#e04848', blue: '#4f8ff7', yellow: '#f2c641', green: '#4cc46a', white: '#f5f7fc', orange: '#f08a3c', purple: '#a46ee0' };
const NS = 'http://www.w3.org/2000/svg';

export default function (el, config, api) {
  const colors = (config.colors || ['red', 'blue', 'yellow', 'green']).slice(0, 6);
  const n = colors.length;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let perm = colors.map((_, i) => i); // perm[row] = color index shown in right row
  do {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
  } while (n > 1 && perm.every((v, i) => v === i));
  const conn = new Array(n).fill(-1); // conn[leftRow] = rightRow
  let sel = -1;
  let busy = false;

  el.innerHTML = '';
  const board = document.createElement('div');
  board.className = 'wires-board';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'wires-svg');
  svg.setAttribute('aria-hidden', 'true');
  const mkCol = (cls) => {
    const c = document.createElement('div');
    c.className = 'wires-col ' + cls;
    return c;
  };
  const L = mkCol('wires-left');
  const R = mkCol('wires-right');
  board.append(L, svg, R);
  el.append(board);

  function mk(ci, side) {
    const name = colors[ci];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'wires-node wires-' + side;
    b.style.setProperty('--c', PAL[name] || '#f5f7fc');
    b.setAttribute('aria-label', name + (side === 'plug' ? ' wire' : ' terminal'));
    const s = document.createElement('span');
    s.className = 'wires-letter';
    s.textContent = name[0].toUpperCase();
    b.append(s);
    return b;
  }
  const plugs = colors.map((_, i) => mk(i, 'plug'));
  const terms = perm.map((ci) => mk(ci, 'term'));
  L.append(...plugs);
  R.append(...terms);

  const paths = {};
  function pt(btn, edge) {
    const sc = board.getBoundingClientRect().width / board.offsetWidth || 1;
    const b = board.getBoundingClientRect();
    const r = btn.getBoundingClientRect();
    return [((edge === 'r' ? r.right : r.left) - b.left) / sc, (r.top + r.height / 2 - b.top) / sc];
  }
  function draw(li) {
    const ri = conn[li];
    paths[li]?.remove();
    delete paths[li];
    if (ri < 0) return;
    const [x1, y1] = pt(plugs[li], 'r');
    const [x2, y2] = pt(terms[ri], 'l');
    const mx = x1 + (x2 - x1) * (0.3 + 0.4 * ((li * 5 + 2) % n) / Math.max(n - 1, 1));
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'wires-wire');
    g.style.setProperty('--c', PAL[colors[li]] || '#f5f7fc');
    for (const k of ['wires-outline', 'wires-line']) {
      const p = document.createElementNS(NS, 'polyline');
      p.setAttribute('class', k);
      p.setAttribute('points', `${x1},${y1} ${mx},${y1} ${mx},${y2} ${x2},${y2}`);
      g.append(p);
    }
    svg.append(g);
    paths[li] = g;
  }
  function refresh() {
    plugs.forEach((p, i) => {
      p.classList.toggle('wires-selected', i === sel);
      p.classList.toggle('wires-linked', conn[i] >= 0);
      p.setAttribute('aria-pressed', i === sel ? 'true' : 'false');
    });
    terms.forEach((t, r) => t.classList.toggle('wires-linked', conn.includes(r)));
  }

  function check() {
    if (conn.some((r) => r < 0)) return;
    const bad = conn.map((r, i) => perm[r] !== i);
    busy = true;
    if (!bad.some(Boolean)) {
      Object.values(paths).forEach((g) => g.classList.add('wires-blink'));
      setTimeout(() => api.solve(), reduce ? 300 : 700);
      return;
    }
    bad.forEach((b, i) => b && paths[i].classList.add('wires-bad'));
    api.fail();
    setTimeout(() => {
      bad.forEach((b, i) => { if (b) { conn[i] = -1; draw(i); } });
      busy = false;
      refresh();
    }, reduce ? 300 : 650);
  }

  L.addEventListener('click', (e) => {
    const i = plugs.indexOf(e.target.closest('.wires-node'));
    if (i < 0 || busy) return;
    if (conn[i] >= 0) { conn[i] = -1; draw(i); sel = -1; }
    else sel = sel === i ? -1 : i;
    refresh();
  });
  R.addEventListener('click', (e) => {
    const r = terms.indexOf(e.target.closest('.wires-node'));
    if (r < 0 || busy || sel < 0) return;
    const old = conn.indexOf(r);
    if (old >= 0) { conn[old] = -1; draw(old); }
    conn[sel] = r;
    draw(sel);
    sel = -1;
    refresh();
    check();
  });

  board.addEventListener('keydown', (e) => {
    const btn = e.target.closest('.wires-node');
    if (!btn) return;
    const k = { KeyW: 'ArrowUp', KeyS: 'ArrowDown', KeyA: 'ArrowLeft', KeyD: 'ArrowRight' }[e.code] || e.key;
    if (!/^Arrow/.test(k)) return;
    e.preventDefault();
    const col = btn.classList.contains('wires-plug') ? plugs : terms;
    const i = col.indexOf(btn);
    if (k === 'ArrowUp' || k === 'ArrowDown') col[Math.max(0, Math.min(n - 1, i + (k === 'ArrowUp' ? -1 : 1)))].focus();
    else (k === 'ArrowLeft' ? plugs : terms)[i].focus();
  });

  // Draw wires correctly once layout/scale is known.
  addEventListener('resize', () => conn.forEach((_, i) => draw(i)));
  refresh();
}

export const controls = [
  'Click a wire plug, then the terminal of the same color',
  'Keyboard: W / S or ↑ / ↓ move, A / D or ← / → switch side, Enter or Space selects',
];
