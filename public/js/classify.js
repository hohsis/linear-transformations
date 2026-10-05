// Matrix -> VCE description, plus the marking helpers used by the practice modes.
(function (UT) {
  'use strict';
  const { near, same, cross, fmt, point, col } = UT.M;
  const { make } = UT.Lib;

  const OTHER = 'a transformation not in our list';

  // Returns a library-style entry {type, ..., description}.
  // With {explore: true} the "other" cases get a more detailed description for the Explore page.
  function classify(m, opts = {}) {
    const [a, b, c, d] = m;
    const other = detail => ({ type: 'other', description: opts.explore && detail ? detail : OTHER });

    if (same(m, [1, 0, 0, 1])) return make({ type: 'identity' });
    if (near(b, 0) && near(c, 0)) {
      if (near(a, 0) && near(d, 0)) return other('the zero transformation: every point goes to the origin');
      if (near(a, d)) {
        if (near(a, -1)) return make({ type: 'rotation', theta: 180 });
        return make({ type: 'dilation', axis: 'origin', k: a });
      }
      if (near(d, 1)) {
        if (near(a, -1)) return make({ type: 'reflection', line: 'y-axis' });
        if (!near(a, 0)) return make({ type: 'dilation', axis: 'y', k: a });
      }
      if (near(a, 1)) {
        if (near(d, -1)) return make({ type: 'reflection', line: 'x-axis' });
        if (!near(d, 0)) return make({ type: 'dilation', axis: 'x', k: d });
      }
    }
    if (near(a, 0) && near(d, 0) && near(b, 1) && near(c, 1)) return make({ type: 'reflection', line: 'y=x' });
    if (near(a, 0) && near(d, 0) && near(b, -1) && near(c, -1)) return make({ type: 'reflection', line: 'y=-x' });
    if (near(a, d) && near(b, -c) && near(Math.hypot(a, c), 1)) {
      let th = Math.atan2(c, a) * 180 / Math.PI;
      if (th < 0) th += 360;
      if (near(th, Math.round(th))) th = Math.round(th);
      return make({ type: 'rotation', theta: th });
    }
    if (near(a, 1) && near(d, 1) && near(c, 0)) return make({ type: 'shear', axis: 'x', k: b });
    if (near(a, 1) && near(d, 1) && near(b, 0)) return make({ type: 'shear', axis: 'y', k: c });

    // ---- not in the library: only the Explore page says more ----
    if (!opts.explore) return other();
    if (near(cross(m), 0)) return other('a transformation that squashes the plane onto a line');
    if (near(b, 0) && near(c, 0)) return other(`dilations: factor ${fmt(a)} from the y-axis and factor ${fmt(d)} from the x-axis`);
    if (near(a, d) && near(b, -c)) {
      let th = Math.atan2(c, a) * 180 / Math.PI;
      if (th < 0) th += 360;
      return other(`rotation of ${fmt(+th.toFixed(2), true)}° anticlockwise with dilation of factor ${fmt(Math.hypot(a, c))} from the origin`);
    }
    if (near(a, -d) && near(b, c) && near(a * a + b * b, 1)) {
      const th = Math.atan2(c, a) * 90 / Math.PI;
      return other(`reflection in a line through the origin at ${fmt(+th.toFixed(2), true)}° to the x-axis`);
    }
    return other('a general linear transformation');
  }

  // Mode 2: compare the student's matrix with the target, column by column.
  function markMatch(student, target) {
    if (same(student, target)) return { correct: true, kind: 'correct' };
    const s1 = col(student, 0), s2 = col(student, 1), t1 = col(target, 0), t2 = col(target, 1);
    const eq = (p, q) => near(p[0], q[0]) && near(p[1], q[1]);
    if (eq(s1, t2) && eq(s2, t1)) {
      return { correct: false, kind: 'swapped', text: 'Your shape matches, but A′ and C′ are swapped. Which column says where i goes?' };
    }
    const ok1 = eq(s1, t1), ok2 = eq(s2, t2);
    const say1 = `The first column sends i to ${point(s1)}, but A′ is at ${point(t1)}.`;
    const say2 = `The second column sends j to ${point(s2)}, but C′ is at ${point(t2)}.`;
    let text;
    if (ok1) text = `The first column is right. ${say2}`;
    else if (ok2) text = `${say1} The second column is right.`;
    else text = `${say1} ${say2}`;
    return { correct: false, kind: ok1 ? 'col2' : ok2 ? 'col1' : 'both', text };
  }

  // Mode 3: what does the student's matrix do? Bold the parts that differ from the answer.
  function explainAttempt(student, answer) {
    const e = classify(student);
    if (e.type === 'identity') return 'Your matrix is the identity transformation: it leaves every point where it is.';
    if (e.type === 'other') return `Your matrix is ${OTHER}.`;
    const fields = ['axis', 'line', 'k', 'theta'];
    const differs = f => e.type === answer.type && e[f] !== undefined && !(typeof e[f] === 'number' ? near(e[f], answer[f]) : e[f] === answer[f]);
    const text = UT.Lib.describe(e, (f, s) => (fields.includes(f) && differs(f) ? `<strong>${s}</strong>` : s));
    return `Your matrix is a ${text}.`;
  }

  UT.classify = classify;
  UT.Mark = { markMatch, explainAttempt, OTHER };
})(globalThis.UT = globalThis.UT || {});
