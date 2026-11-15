// Puzzle "dial": tune a value to the target, then lock in.
export default function (el, config, api) {
  const { min, max, target, tolerance = 0, unit = '', step = 1, label = '', lockLabel = 'Lock in' } = config;
  const SEGS = 12, SWEEP = 270, START = -135;
  const span = max - min;
  let value = min + Math.round(span * 0.5 / step) * step;
  let done = false, dragging = false;

  const ticks = Array.from({ length: 11 }, (_, i) => {
    const a = START + (SWEEP * i) / 10;
    return `<rect x="-3" y="-112" width="6" height="${i % 5 ? 10 : 18}" transform="rotate(${a})"/>`;
  }).join('');

  el.innerHTML = `
    <div class="dial-wrap">
      <div class="dial-knob-box" tabindex="0" role="slider" aria-label="${label || 'Dial'}"
           aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${value}" aria-valuetext="${value} ${unit}">
        <svg class="dial-svg" viewBox="-130 -130 260 260" shape-rendering="crispEdges" aria-hidden="true">
          <circle class="dial-rim" r="124"/><circle class="dial-face" r="104"/>
          <g class="dial-ticks">${ticks}</g>
          <g class="dial-needle"><rect x="-5" y="-96" width="10" height="62"/><rect x="-14" y="-14" width="28" height="28"/></g>
        </svg>
      </div>
      <div class="dial-side">
        <div class="dial-readout"><span class="dial-num"></span><span class="dial-unit">${unit}</span></div>
        ${label ? `<div class="dial-label">${label}</div>` : ''}
        <div class="dial-meter" aria-hidden="true">${'<i></i>'.repeat(SEGS)}</div>
        <button type="button" class="dial-lock">${lockLabel}</button>
      </div>
    </div>`;

  const $ = (s) => el.querySelector(s);
  const knob = $('.dial-knob-box'), needle = $('.dial-needle'), num = $('.dial-num');
  const readout = $('.dial-readout'), segs = [...el.querySelectorAll('.dial-meter i')], btn = $('.dial-lock');

  const clamp = (v) => Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));
  const dec = (String(step).split('.')[1] || '').length;

  function render() {
    num.textContent = value.toFixed(dec);
    needle.setAttribute('transform', `rotate(${START + SWEEP * ((value - min) / span)})`);
    knob.setAttribute('aria-valuenow', value);
    knob.setAttribute('aria-valuetext', `${value.toFixed(dec)} ${unit}`);
    const closeness = done ? 1 : Math.max(0, 1 - Math.abs(value - target) / span * 2.2);
    const lit = Math.round(closeness * SEGS);
    segs.forEach((s, i) => {
      s.className = i < lit ? (i >= SEGS - 3 ? 'on hot' : i >= SEGS - 7 ? 'on mid' : 'on') : '';
    });
  }
  function set(v) { if (done) return; value = clamp(v); render(); }

  function fromPointer(e) {
    const r = knob.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
    let a = (Math.atan2(x, -y) * 180) / Math.PI; // 0 = up, clockwise positive
    a = Math.max(START, Math.min(START + SWEEP, a < START ? (a < START - (360 - SWEEP) / 2 ? a + 360 : a) : a));
    set(min + ((a - START) / SWEEP) * span);
  }
  knob.addEventListener('pointerdown', (e) => { dragging = true; knob.setPointerCapture(e.pointerId); knob.focus(); fromPointer(e); e.preventDefault(); });
  knob.addEventListener('pointermove', (e) => dragging && fromPointer(e));
  knob.addEventListener('pointerup', () => (dragging = false));
  knob.addEventListener('pointercancel', () => (dragging = false));
  knob.addEventListener('wheel', (e) => { e.preventDefault(); set(value + (e.deltaY < 0 ? 1 : -1) * step * (e.shiftKey ? 10 : 1)); }, { passive: false });
  knob.addEventListener('keydown', (e) => {
    const m = e.shiftKey ? 10 : 1;
    const dir = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, KeyD: 1, KeyW: 1, KeyA: -1, KeyS: -1 }[e.key.startsWith('Arrow') ? e.key : e.code];
    if (dir) { e.preventDefault(); set(value + dir * step * m); }
    else if (e.key === 'Home') { e.preventDefault(); set(min); }
    else if (e.key === 'End') { e.preventDefault(); set(max); }
  });

  setTimeout(() => knob.focus(), 0);
  btn.addEventListener('click', () => {
    if (done) return;
    if (Math.abs(value - target) <= tolerance) {
      done = true; btn.disabled = true;
      readout.classList.add('dial-ok'); render();
      setTimeout(() => api.solve(), 700);
    } else {
      knob.classList.remove('dial-shake'); void knob.offsetWidth; knob.classList.add('dial-shake');
      api.fail();
    }
  });
  knob.addEventListener('animationend', () => knob.classList.remove('dial-shake'));
  render();
}

export const controls = ["Drag the dial or scroll to turn it", "A / D or ← / → to fine-tune, hold Shift for big steps", "Lock in when the meter is full"];
