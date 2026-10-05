// Maths helpers, number formatting and the safe expression parser.
// Matrices are stored row by row as [a, b, c, d] for [[a, b], [c, d]].
(function (UT) {
  'use strict';

  const I = [1, 0, 0, 1];
  const TOL = 1e-6;

  const near = (a, b, tol = TOL) => Math.abs(a - b) < tol;
  const same = (A, B, tol = TOL) => A.every((v, i) => near(v, B[i], tol));
  const apply = (m, x, y) => [m[0] * x + m[1] * y, m[2] * x + m[3] * y];
  const lerp = (A, B, s) => A.map((v, i) => v + (B[i] - v) * s);
  const clean = v => (Math.abs(v) < 1e-12 ? 0 : v);
  const col = (m, k) => (k === 0 ? [m[0], m[2]] : [m[1], m[3]]);
  // a*d - b*c, used only to detect squashed (parallel-column) matrices
  const cross = m => m[0] * m[3] - m[1] * m[2];

  function rotation(deg) {
    const r = deg * Math.PI / 180;
    const c = clean(Math.cos(r)), s = clean(Math.sin(r));
    return [c, clean(-s), s, c];
  }

  // ---------- formatting ----------
  const NICE = [[0.5, '1/2'], [Math.SQRT1_2, '√2/2'], [Math.sqrt(3) / 2, '√3/2'], [1 / 3, '1/3'], [2 / 3, '2/3'],
    [0.25, '1/4'], [0.75, '3/4'], [1.5, '3/2'], [Math.sqrt(3), '√3'], [Math.SQRT2, '√2'], [1 / Math.sqrt(3), '√3/3']];

  function fmt(x, plain) {
    if (Math.abs(x) < 1e-9) return '0';
    if (near(x, Math.round(x), 1e-9)) return String(Math.round(x)).replace('-', '−');
    if (!plain) {
      for (const [v, s] of NICE) {
        if (near(Math.abs(x), v, 1e-9)) return (x < 0 ? '−' : '') + s;
      }
    }
    return (+x.toFixed(2)).toString().replace('-', '−');
  }
  const fmtIn = x => fmt(x).replace('−', '-');
  const point = (p, plain) => `(${fmt(p[0], plain)}, ${fmt(p[1], plain)})`;

  // ---------- safe parser ----------
  // Accepts numbers, + − × ÷ * / ^, brackets, pi/π, sqrt/√, sin, cos, tan (radians, or degrees with °).
  // Nothing is ever passed to eval or Function.
  const WORDS = ['sqrt', 'sin', 'cos', 'tan', 'pi'];

  function tokenize(src) {
    const s = String(src).trim()
      .replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi');
    const toks = [];
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (/[0-9.]/.test(ch)) {
        const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
        if (!m) return null;
        toks.push({ t: 'num', v: parseFloat(m[0]) });
        i += m[0].length;
        continue;
      }
      if (/[a-z]/i.test(ch)) {
        const w = /^[a-z]+/i.exec(s.slice(i))[0].toLowerCase();
        if (!WORDS.includes(w)) return null;
        toks.push(w === 'pi' ? { t: 'pi' } : { t: 'fn', v: w });
        i += w.length;
        continue;
      }
      if (ch === '√') { toks.push({ t: 'fn', v: 'sqrt' }); i++; continue; }
      if ('+-*/^()°'.includes(ch)) { toks.push({ t: ch }); i++; continue; }
      return null;
    }
    return toks;
  }

  function parse(src) {
    const toks = tokenize(src);
    if (!toks || !toks.length) return NaN;
    let p = 0;
    const peek = () => toks[p];
    const next = () => toks[p++];
    const fail = () => { throw new Error('parse'); };
    // implicit multiplication: 2pi, 2√3, 3(1/2), √3 pi — but not "2 3"
    const startsImplicit = tk => tk && (tk.t === 'pi' || tk.t === 'fn' || tk.t === '(');

    function expr() {
      let v = term();
      while (peek() && (peek().t === '+' || peek().t === '-')) {
        const op = next().t;
        const r = term();
        v = op === '+' ? v + r : v - r;
      }
      return v;
    }
    function term() {
      let v = unary();
      for (;;) {
        const tk = peek();
        if (tk && (tk.t === '*' || tk.t === '/')) {
          next();
          const r = unary();
          v = tk.t === '*' ? v * r : v / r;
        } else if (startsImplicit(tk)) {
          v *= power();
        } else {
          return v;
        }
      }
    }
    function unary() {
      const tk = peek();
      if (tk && (tk.t === '-' || tk.t === '+')) {
        next();
        const v = unary();
        return tk.t === '-' ? -v : v;
      }
      return power();
    }
    function power() {
      const b = postfix();
      if (peek() && peek().t === '^') { next(); return Math.pow(b, unary()); }
      return b;
    }
    function postfix() {
      let v = atom();
      while (peek() && peek().t === '°') { next(); v *= Math.PI / 180; }
      return v;
    }
    function atom() {
      const tk = next();
      if (!tk) fail();
      if (tk.t === 'num') return tk.v;
      if (tk.t === 'pi') return Math.PI;
      if (tk.t === '(') {
        const v = expr();
        const close = next();
        if (!close || close.t !== ')') fail();
        return v;
      }
      if (tk.t === 'fn') return Math[tk.v](postfix());
      return fail();
    }

    try {
      const v = expr();
      if (p !== toks.length) return NaN;
      return Number.isFinite(v) ? v : NaN;
    } catch (e) {
      return NaN;
    }
  }

  UT.M = { I, TOL, near, same, apply, lerp, clean, col, cross, rotation, fmt, fmtIn, point, parse };
})(globalThis.UT = globalThis.UT || {});
