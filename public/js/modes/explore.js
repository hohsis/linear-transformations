// Explore: the original unit-square widget, running on the shared modules.
(function (UT) {
  'use strict';
  if (!UT.ui.progress.enter('explore')) return;
  const { I, lerp, fmt, parse, rotation } = UT.M;
  const { $, matrixInput, capitalise } = UT.ui;

  let target = I.slice();   // the matrix in the inputs
  let t = 1;                // morph amount

  const plane = UT.createPlane($('cv'), { R: 4, zoom: $('zoom') });
  const S = plane.state;

  const syncShow = () => plane.setShow({
    grid: $('tgGrid').checked, basis: $('tgBasis').checked, square: $('tgSquare').checked,
    ghost: $('tgGhost').checked, labels: $('tgLabels').checked, coords: true
  });
  document.querySelectorAll('.checks input').forEach(c => c.addEventListener('change', syncShow));
  syncShow();

  const mat = matrixInput($('mat'), {
    label: 'Matrix entries',
    onInput(i, value) {
      const v = parse(value);
      if (Number.isNaN(v)) { mat.inputs[i].classList.add('bad'); return; }
      const m = target.slice(); m[i] = v;
      setTarget(m, { fromInputs: true, animate: true });
    }
  });
  mat.inputs.forEach(el => el.setAttribute('inputmode', 'text'));

  function sm(rows, headers) {
    const cols = rows[0].length;
    let h = `<span class="sm" style="grid-template-columns:repeat(${cols},auto)">`;
    if (headers) h += headers.map(x => `<span class="h">${x}</span>`).join('');
    for (const r of rows) h += r.map(v => `<span>${v}</span>`).join('');
    return h + '</span>';
  }

  function updateFacts() {
    const m = target;
    const kind = capitalise(UT.classify(m, { explore: true }).description);
    $('fKind').textContent = kind;
    const [a, b, c, d] = m;
    $('product').innerHTML = sm([[fmt(a), fmt(b)], [fmt(c), fmt(d)]]) + sm([['0', '1', '1', '0'], ['0', '0', '1', '1']], ['O', 'A', 'B', 'C']) + '<span>=</span>' +
      sm([['0', fmt(a), fmt(a + b), fmt(b)], ['0', fmt(c), fmt(c + d), fmt(d)]], ['O′', 'A′', 'B′', 'C′']);
    $('live').textContent = `${kind}.`;
  }

  function setBusy(b) { ['play', 'reset'].forEach(id => { $(id).disabled = b; }); }

  function setTarget(m, { fromInputs = false, keepPreset = false, animate = false } = {}) {
    target = m.slice();
    if (!fromInputs) mat.set(target);
    if (!keepPreset) { $('preset').value = 'custom'; $('paramWrap').hidden = true; }
    t = 1; $('tslider').value = 1;
    updateFacts();
    if (animate) plane.animateTo(target, { dur: UT.DUR_CHANGE });
    else plane.setMatrix(target);
  }

  // presets
  const PARAM = { dily: ['k =', '2'], dilx: ['k =', '2'], dilo: ['k =', '2'], shx: ['k =', '1'], shy: ['k =', '1'], rot: ['θ =', '90'] };
  function presetMatrix(p, k) {
    switch (p) {
      case 'identity': return [1, 0, 0, 1];
      case 'dily': return [k, 0, 0, 1];
      case 'dilx': return [1, 0, 0, k];
      case 'dilo': return [k, 0, 0, k];
      case 'refx': return [1, 0, 0, -1];
      case 'refy': return [-1, 0, 0, 1];
      case 'refyx': return [0, 1, 1, 0];
      case 'refynx': return [0, -1, -1, 0];
      case 'rot': return rotation(k);
      case 'shx': return [1, k, 0, 1];
      case 'shy': return [1, 0, k, 1];
      case 'proj': return [1, 0, 0, 0];
    }
    return target;
  }
  function applyPreset() {
    const p = $('preset').value;
    if (p === 'custom') return;
    const pw = $('paramWrap');
    if (PARAM[p]) { pw.hidden = false; $('paramLabel').textContent = PARAM[p][0]; }
    else pw.hidden = true;
    const k = parse($('param').value);
    if (Number.isNaN(k)) { $('param').classList.add('bad'); return; }
    $('param').classList.remove('bad');
    setTarget(presetMatrix(p, k), { keepPreset: true, animate: true });
  }
  $('preset').addEventListener('change', () => {
    const p = $('preset').value;
    if (PARAM[p]) $('param').value = PARAM[p][1];
    applyPreset();
  });
  $('param').addEventListener('input', applyPreset);

  $('play').addEventListener('click', () => {
    t = 1; $('tslider').value = 1;
    setBusy(true);
    plane.animateTo(target, { from: I, dur: UT.DUR_PLAY }).then(() => setBusy(false));
  });
  $('tslider').addEventListener('input', e => {
    if (S.animating) return;
    t = +e.target.value;
    plane.cancel(); S.m = lerp(I, target, t); plane.draw();
  });
  $('reset').addEventListener('click', () => {
    $('preset').value = 'identity'; $('paramWrap').hidden = true;
    setTarget(I, { keepPreset: true, animate: true });
  });

  // dragging the basis tips
  const cv = $('cv');
  let drag = null;
  const pos = ev => { const r = cv.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
  const tips = () => [[0, S.m[0], S.m[2]], [1, S.m[1], S.m[3]]];
  cv.addEventListener('pointerdown', ev => {
    if (S.animating || !S.show.basis) return;
    const [px, py] = pos(ev);
    let best = null, bd = 22;
    for (const [k, x, y] of tips()) { const d = Math.hypot(plane.sx(x) - px, plane.sy(y) - py); if (d < bd) { bd = d; best = k; } }
    if (best === null) return;
    drag = best; cv.setPointerCapture(ev.pointerId); ev.preventDefault();
    if (t !== 1) { t = 1; $('tslider').value = 1; }
  });
  cv.addEventListener('pointermove', ev => {
    const [px, py] = pos(ev);
    if (drag === null) {
      if (S.animating || !S.show.basis) { cv.style.cursor = 'default'; return; }
      const hit = tips().some(([, x, y]) => Math.hypot(plane.sx(x) - px, plane.sy(y) - py) < 22);
      cv.style.cursor = hit ? 'grab' : 'default';
      return;
    }
    cv.style.cursor = 'grabbing';
    let x = plane.wx(px), y = plane.wy(py);
    if (!ev.shiftKey) { x = Math.round(x * 4) / 4; y = Math.round(y * 4) / 4; }
    const m = target.slice();
    if (drag === 0) { m[0] = x; m[2] = y; } else { m[1] = x; m[3] = y; }
    setTarget(m);
  });
  const endDrag = () => { drag = null; cv.style.cursor = 'default'; };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  mat.set(target);
  updateFacts();
  plane.draw();
})(globalThis.UT);
