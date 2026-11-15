// Puzzle "order": put cards in the correct order. Click/tap two cards to swap, or keyboard-move.
export default function (el, config, api) {
  const norm = (it) => (typeof it === 'string' ? { text: it } : it);
  const items = (config.items || []).map(norm);
  const row = config.layout === 'row';
  const n = items.length;
  let order = items.map((_, i) => i); // order[pos] = item index
  if (n > 1) {
    do {
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    } while (order.every((v, i) => v === i));
  }
  let sel = -1;
  let busy = false;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'order-wrap';
  const list = document.createElement('div');
  list.className = 'order-list ' + (row ? 'order-row' : 'order-col');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'order-check';
  btn.textContent = config.checkLabel || 'Check order';
  wrap.append(list, btn);
  el.append(wrap);

  const cards = items.map((it, idx) => {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'order-card';
    c.dataset.idx = idx;
    if (it.img) {
      const im = document.createElement('img');
      im.className = 'order-img';
      im.alt = '';
      im.draggable = false;
      im.onerror = () => im.remove();
      im.src = it.img;
      c.append(im);
    }
    if (it.text) {
      const s = document.createElement('span');
      s.className = 'order-text';
      s.textContent = it.text;
      c.append(s);
    }
    return c;
  });

  function render(focusIdx) {
    order.forEach((idx, pos) => {
      const c = cards[idx];
      c.classList.toggle('order-selected', pos === sel);
      c.setAttribute('aria-pressed', pos === sel ? 'true' : 'false');
      list.append(c); // re-appending reorders DOM
    });
    if (focusIdx != null) cards[focusIdx].focus();
  }

  const swap = (a, b) => ([order[a], order[b]] = [order[b], order[a]]);

  function clearMarks() {
    cards.forEach((c) => c.classList.remove('order-ok', 'order-bad', 'order-done'));
  }

  list.addEventListener('click', (e) => {
    const c = e.target.closest('.order-card');
    if (!c || busy) return;
    clearMarks();
    const pos = order.indexOf(+c.dataset.idx);
    if (sel < 0) sel = pos;
    else if (sel === pos) sel = -1;
    else { swap(sel, pos); sel = -1; }
    render(+c.dataset.idx);
  });

  list.addEventListener('keydown', (e) => {
    const c = e.target.closest('.order-card');
    if (!c || busy || sel < 0) return;
    const pos = order.indexOf(+c.dataset.idx);
    const key = { KeyW: 'ArrowUp', KeyS: 'ArrowDown', KeyA: 'ArrowLeft', KeyD: 'ArrowRight' }[e.code] || e.key;
    const d = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -1, ArrowRight: 1 }[key];
    if (!d || (row ? /Up|Down/.test(key) : /Left|Right/.test(key))) return;
    e.preventDefault();
    const to = pos + d;
    if (sel !== pos || to < 0 || to >= n) return;
    clearMarks();
    swap(pos, to);
    sel = to;
    render(+c.dataset.idx);
  });

  btn.addEventListener('click', () => {
    if (busy) return;
    sel = -1;
    render();
    const right = order.map((v, i) => v === i);
    if (right.every(Boolean)) {
      busy = true;
      btn.disabled = true;
      const step = reduce ? 0 : 90;
      order.forEach((idx, pos) => setTimeout(() => cards[idx].classList.add('order-done'), pos * step));
      setTimeout(() => api.solve(), n * step + 700);
      return;
    }
    clearMarks();
    order.forEach((idx, pos) => cards[idx].classList.add(right[pos] ? 'order-ok' : 'order-bad'));
    api.fail();
    setTimeout(() => cards.forEach((c) => c.classList.remove('order-bad')), 500);
  });

  render();
}

export const controls = ["Click two cards to swap them", "Or: Enter to pick a card, then W / S or ↑ / ↓ to move it (A / D or ← / → in a row)"];
