// The transformation library, VCE descriptions and the random question generators.
(function (UT) {
  'use strict';
  const { near, same, rotation, fmt, cross } = UT.M;

  const DILATION_K = [-3, -2, 0.5, 2, 3];            // k = 1 and k = −1 left out
  const SHEAR_K = [-3, -2, -1, 0.5, 1, 2, 3];
  const ROT_BASIC = [90, 180, 270];
  const ROT_SURD = [30, 45, 60];
  const REFLECTION_LINES = ['x-axis', 'y-axis', 'y=x', 'y=-x'];

  const LINE_TEXT = { 'x-axis': 'the x-axis', 'y-axis': 'the y-axis', 'y=x': 'the line y = x', 'y=-x': 'the line y = −x' };

  function matrixOf(e) {
    switch (e.type) {
      case 'dilation':
        if (e.axis === 'y') return [e.k, 0, 0, 1];
        if (e.axis === 'x') return [1, 0, 0, e.k];
        return [e.k, 0, 0, e.k];
      case 'reflection':
        return { 'x-axis': [1, 0, 0, -1], 'y-axis': [-1, 0, 0, 1], 'y=x': [0, 1, 1, 0], 'y=-x': [0, -1, -1, 0] }[e.line];
      case 'shear':
        return e.axis === 'x' ? [1, e.k, 0, 1] : [1, 0, e.k, 1];
      case 'rotation':
        return rotation(e.theta);
      case 'identity':
        return [1, 0, 0, 1];
    }
    return null;
  }

  const angleText = th => (Number.isInteger(th) ? String(th) : fmt(+th.toFixed(2), true)) + '°';

  // wrap(field, text) lets callers emphasise parts of the wording (e.g. bold the axis that differs).
  function describe(e, wrap = (f, s) => s) {
    switch (e.type) {
      case 'dilation':
        return `dilation of factor ${wrap('k', fmt(e.k))} from the ${wrap('axis', e.axis === 'origin' ? 'origin' : e.axis + '-axis')}`;
      case 'reflection':
        return `reflection in ${wrap('line', LINE_TEXT[e.line])}`;
      case 'shear':
        return `shear of factor ${wrap('k', fmt(e.k))} parallel to the ${wrap('axis', e.axis + '-axis')}`;
      case 'rotation':
        return `rotation of ${wrap('theta', angleText(e.theta))} anticlockwise about the origin`;
      case 'identity':
        return 'the identity transformation';
    }
    return e.description || 'a transformation not in our list';
  }

  function make(e) {
    e.matrix = matrixOf(e);
    e.description = describe(e);
    return e;
  }

  // Every entry the current settings allow, grouped by category.
  function pool(settings = {}) {
    const s = Object.assign({}, BASIC, settings);
    const groups = { dilation: [], reflection: [], shear: [] };
    const axes = s.originDilations ? ['y', 'x', 'origin'] : ['y', 'x'];
    for (const axis of axes) for (const k of DILATION_K) groups.dilation.push(make({ type: 'dilation', axis, k }));
    for (const line of REFLECTION_LINES) groups.reflection.push(make({ type: 'reflection', line }));
    for (const axis of ['x', 'y']) for (const k of SHEAR_K) groups.shear.push(make({ type: 'shear', axis, k }));
    if (s.rotations) {
      groups.rotation = ROT_BASIC.concat(s.surds ? ROT_SURD : []).map(theta => make({ type: 'rotation', theta }));
    }
    return groups;
  }

  const allEntries = settings => Object.values(pool(settings)).flat();

  const pick = (arr, rnd = Math.random) => arr[Math.floor(rnd() * arr.length)];
  function shuffle(arr, rnd = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // A random library transformation: pick a category first so each kind turns up equally often.
  // `avoid` is an entry or a list of entries (e.g. the rest of the current set) not to repeat.
  function randomEntry(settings, avoid, rnd = Math.random) {
    const groups = pool(settings);
    const cats = Object.keys(groups);
    const used = new Set([].concat(avoid || []).map(a => a.description));
    for (let tries = 0; tries < 200; tries++) {
      const e = pick(groups[pick(cats, rnd)], rnd);
      if (!used.has(e.description)) return e;
    }
    return pick(groups[pick(cats, rnd)], rnd);
  }

  // ---------- Mode 1 distractors ----------
  const okDilationK = k => !near(k, 0) && !near(Math.abs(k), 1);
  const otherOf = (list, v) => list.filter(x => x !== v);
  const inList = (list, k) => list.some(x => near(x, k));

  function relatedTo(e, rnd) {
    const first = [], second = [];
    if (e.type === 'dilation') {
      for (const axis of otherOf(['x', 'y', 'origin'], e.axis)) {
        if (axis !== 'origin' || e.axis === 'origin') first.push({ type: 'dilation', axis, k: e.k });
      }
      for (const k of shuffle([1 / e.k, -e.k].concat(shuffle(otherOf(DILATION_K, e.k), rnd).slice(0, 2)), rnd)) {
        if (okDilationK(k) && inList(DILATION_K, k)) second.push({ type: 'dilation', axis: e.axis, k });
      }
    } else if (e.type === 'shear') {
      first.push({ type: 'shear', axis: e.axis === 'x' ? 'y' : 'x', k: e.k });
      for (const k of shuffle([-e.k, 1 / e.k].concat(shuffle(otherOf(SHEAR_K, e.k), rnd).slice(0, 2)), rnd)) {
        if (inList(SHEAR_K, k)) second.push({ type: 'shear', axis: e.axis, k });
      }
    } else if (e.type === 'reflection') {
      const partner = { 'x-axis': 'y-axis', 'y-axis': 'x-axis', 'y=x': 'y=-x', 'y=-x': 'y=x' }[e.line];
      first.push({ type: 'reflection', line: partner });
      for (const line of shuffle(otherOf(REFLECTION_LINES, e.line), rnd)) second.push({ type: 'reflection', line });
    } else if (e.type === 'rotation') {
      if (e.theta === 180) {
        first.push({ type: 'rotation', theta: pick([90, 270], rnd) });
      } else {
        first.push({ type: 'rotation', theta: 360 - e.theta });
      }
      const more = { 30: [60, 330], 60: [30, 300], 45: [135, 315] }[e.theta] || [];
      for (const theta of shuffle(more.concat([90, 180, 270]), rnd)) second.push({ type: 'rotation', theta });
    }
    return { first: first.map(make), second: second.map(make) };
  }

  // Four options in random order: the answer plus three distractors, none equivalent to each other.
  function makeOptions(answer, settings, rnd = Math.random) {
    const chosen = [answer];
    const fits = e => !chosen.some(c => same(c.matrix, e.matrix) || c.description === e.description);
    const add = e => { if (e && chosen.length < 4 && fits(e)) { chosen.push(e); return true; } return false; };

    const { first, second } = relatedTo(answer, rnd);
    first.some(add);
    second.some(add);
    // one transformation of a different type
    const groups = pool(settings);
    const otherCats = shuffle(Object.keys(groups).filter(c => c !== answer.type), rnd);
    for (const c of otherCats) if (add(pick(groups[c], rnd))) break;
    // fill any gaps
    for (const e of shuffle(first.concat(second), rnd)) add(e);
    for (const e of shuffle(allEntries(settings), rnd)) add(e);
    return shuffle(chosen, rnd);
  }

  // ---------- Mode 2 targets ----------
  const randInt = (lo, hi, rnd) => lo + Math.floor(rnd() * (hi - lo + 1));

  // `previous` is one matrix or a list of matrices not to repeat.
  function targetOk(m, previous) {
    const prevs = !previous ? [] : typeof previous[0] === 'number' ? [previous] : previous;
    const [a, b, c, d] = m;
    if ((a === 0 && c === 0) || (b === 0 && d === 0)) return false;   // a column is zero
    if (cross(m) === 0) return false;                                 // columns parallel: square squashed flat
    if (same(m, [1, 0, 0, 1])) return false;
    if (prevs.some(p => same(m, p))) return false;
    const pts = [[a, c], [a + b, c + d], [b, d]];
    return pts.every(([x, y]) => Math.abs(x) <= 5 && Math.abs(y) <= 5);
  }

  function randomTarget(difficulty, previous, rnd = Math.random) {
    for (;;) {
      let m;
      if (difficulty === 'easy') {
        m = [0, 1, 2, 3].map(() => randInt(0, 2, rnd));
        // at least one column lies along an axis
        const onAxis = ([x, y]) => (x === 0) !== (y === 0);
        if (!onAxis([m[0], m[2]]) && !onAxis([m[1], m[3]])) continue;
      } else {
        m = [0, 1, 2, 3].map(() => randInt(-3, 3, rnd));
      }
      if (targetOk(m, previous)) return m;
    }
  }

  // Main sections leave out rotations and dilations from the origin; Advanced has everything.
  const BASIC = { rotations: false, surds: false, originDilations: false };
  const ADVANCED = { rotations: true, surds: true, originDilations: true };

  UT.Lib = { BASIC, ADVANCED, DILATION_K, SHEAR_K, ROT_BASIC, ROT_SURD, matrixOf, describe, make, pool, allEntries, randomEntry, makeOptions, randomTarget, targetOk, shuffle, pick };
})(globalThis.UT = globalThis.UT || {});
