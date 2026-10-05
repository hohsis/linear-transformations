// Run with:  node tests/run.js
// Loads the browser scripts into a sandbox and checks the maths, library, classifier and marking.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = vm.createContext({ console, Math });
for (const f of ['js/matrix.js', 'js/library.js', 'js/classify.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'public', f), 'utf8'), ctx, { filename: f });
}
const UT = ctx.UT;
const { parse, same } = UT.M;
const { Lib, classify, Mark } = UT;

let pass = 0, fail = 0;
function check(name, cond, info) {
  if (cond) pass++;
  else { fail++; console.log('FAIL', name, info !== undefined ? info : ''); }
}

// seeded random so failures are reproducible
function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }

const ALL = { rotations: true, surds: true, originDilations: true };

// ---- parser ----
const near = (a, b) => Math.abs(a - b) < 1e-9;
for (const s of ['0.5', '1/2', 'sin(pi/6)', '.5', 'cos(60°)', '2/4', '1 / 2', 'sin(π/6)']) check(`parse ${s}`, near(parse(s), 0.5), parse(s));
for (const s of ['√3/2', 'sqrt(3)/2', 'cos(pi/6)', 'sqrt3/2', '√(3)/2', 'sin(60°)']) check(`parse ${s}`, near(parse(s), Math.sqrt(3) / 2), parse(s));
for (const s of ['-√2/2', '−sqrt(2)/2', '-1/√2', '−1/sqrt(2)', '-sin(pi/4)']) check(`parse ${s}`, near(parse(s), -Math.SQRT1_2), parse(s));
check('parse -3', parse('-3') === -3);
check('parse 2pi', near(parse('2pi'), 2 * Math.PI));
check('parse 2^3', parse('2^3') === 8);
check('parse 2√3', near(parse('2√3'), 2 * Math.sqrt(3)));
for (const s of ['', '  ', 'alert(1)', '2+', '(1', '1)', '2 3', 'x', '1/0', 'constructor', 'Math.PI', '__proto__', '1;2', '"1"', 'sqrt(-1)']) {
  check(`reject ${JSON.stringify(s)}`, Number.isNaN(parse(s)), parse(s));
}

// ---- library round trip: classify(matrix(description)) === description ----
const entries = Lib.allEntries(ALL);
check('library has 39 entries with every option on', entries.length === 39, entries.length);
for (const e of entries) {
  const c = classify(e.matrix);
  check(`round trip: ${e.description}`, c.description === e.description, c.description);
}
// shear factor 1 is included
check('shear k = 1 in library', entries.some(e => e.description === 'shear of factor 1 parallel to the x-axis'));
check('no dilation k = −1', !entries.some(e => e.type === 'dilation' && Math.abs(e.k) === 1));
check('no k = 1 dilation', !entries.some(e => e.type === 'dilation' && e.k === 1));
// spot-check exact wording
const wording = [
  [[2, 0, 0, 1], 'dilation of factor 2 from the y-axis'],
  [[1, 0, 0, 0.5], 'dilation of factor 1/2 from the x-axis'],
  [[3, 0, 0, 3], 'dilation of factor 3 from the origin'],
  [[1, 0, 0, -1], 'reflection in the x-axis'],
  [[0, -1, -1, 0], 'reflection in the line y = −x'],
  [[1, 0, -1, 1], 'shear of factor −1 parallel to the y-axis'],
  [[0, -1, 1, 0], 'rotation of 90° anticlockwise about the origin'],
  [[-1, 0, 0, -1], 'rotation of 180° anticlockwise about the origin'],
  [[2, 1, 1, 1], 'a transformation not in our list'],
  [[1, 0, 0, 1], 'the identity transformation']
];
for (const [m, d] of wording) check(`wording ${d}`, classify(m).description === d, classify(m).description);
// surd rotation from typed entries
const typed30 = ['√3/2', '-1/2', 'sin(pi/6)', 'cos(pi/6)'].map(parse);
check('typed 30° rotation', classify(typed30).description === 'rotation of 30° anticlockwise about the origin', classify(typed30).description);

// ---- settings ----
check('rotations off', !Lib.allEntries({ rotations: false }).some(e => e.type === 'rotation'));
check('surds off by default', !Lib.allEntries({}).some(e => e.theta === 45));
check('origin dilations off by default', !Lib.allEntries({}).some(e => e.axis === 'origin'));

// ---- pools ----
check('basic pool has no rotations', !Lib.allEntries(Lib.BASIC).some(e => e.type === 'rotation'));
check('basic pool has no origin dilations', !Lib.allEntries(Lib.BASIC).some(e => e.axis === 'origin'));
check('advanced pool has 30/45/60 rotations', [30, 45, 60].every(t => Lib.allEntries(Lib.ADVANCED).some(e => e.theta === t)));
check('advanced pool has origin dilations', Lib.allEntries(Lib.ADVANCED).some(e => e.axis === 'origin'));

// ---- sets of 5 never repeat a question ----
for (const pool of [Lib.BASIC, Lib.ADVANCED]) {
  const r = rng(5);
  let ok = true;
  for (let t = 0; t < 500 && ok; t++) {
    const used = [], targets = [];
    for (let i = 0; i < 5; i++) { used.push(Lib.randomEntry(pool, used, r)); targets.push(Lib.randomTarget('standard', targets, r)); }
    if (new Set(used.map(e => e.description)).size !== 5) ok = false;
    if (new Set(targets.map(m => m.join())).size !== 5) ok = false;
  }
  check('a set of 5 has no repeated questions', ok);
}

// ---- generator avoids repeats ----
{
  const r = rng(7);
  let prev = null, repeat = false;
  for (let i = 0; i < 2000; i++) { const e = Lib.randomEntry(ALL, prev, r); if (prev && e.description === prev.description) repeat = true; prev = e; }
  check('randomEntry never repeats the previous question', !repeat);
}

// ---- Mode 1 options ----
for (const settings of [ALL, {}, { rotations: false }]) {
  const r = rng(11);
  let ok = true, info = '';
  for (let i = 0; i < 3000 && ok; i++) {
    const ans = Lib.randomEntry(settings, null, r);
    const opts = Lib.makeOptions(ans, settings, r);
    const hasAnswer = opts.filter(o => o.description === ans.description).length === 1;
    let distinct = true;
    for (let a = 0; a < opts.length; a++) for (let b = a + 1; b < opts.length; b++) {
      if (same(opts[a].matrix, opts[b].matrix) || opts[a].description === opts[b].description) distinct = false;
    }
    const offList = opts.some(o => (o.type === 'dilation' && !Lib.DILATION_K.includes(o.k)) || (o.type === 'shear' && !Lib.SHEAR_K.includes(o.k)));
    if (opts.length !== 4 || !hasAnswer || !distinct || offList) { ok = false; info = ans.description + ' -> ' + opts.map(o => o.description).join(' | '); }
  }
  check(`mode 1 options valid (${JSON.stringify(settings)})`, ok, info);
}

// ---- Mode 2 targets and marking ----
for (const diff of ['standard', 'easy']) {
  const r = rng(3);
  let ok = true, info = '', prev = null;
  for (let i = 0; i < 3000 && ok; i++) {
    const m = Lib.randomTarget(diff, prev, r);
    const [a, b, c, d] = m;
    const inRange = diff === 'easy' ? m.every(v => v >= 0 && v <= 2) : m.every(v => v >= -3 && v <= 3 && Number.isInteger(v));
    const verts = [[a, c], [a + b, c + d], [b, d]].every(([x, y]) => Math.abs(x) <= 5 && Math.abs(y) <= 5);
    const notFlat = a * d - b * c !== 0;
    const axis = diff !== 'easy' || ((a === 0) !== (c === 0)) || ((b === 0) !== (d === 0));
    if (!inRange || !verts || !notFlat || same(m, [1, 0, 0, 1]) || (prev && same(m, prev)) || !axis) { ok = false; info = m; }
    prev = m;
  }
  check(`mode 2 targets valid (${diff})`, ok, info);
}
{
  const T = [2, 1, 1, 3];
  check('match correct', Mark.markMatch([2, 1, 1, 3], T).correct);
  const sw = Mark.markMatch([1, 2, 3, 1], T);
  check('match swapped is wrong', !sw.correct && sw.kind === 'swapped');
  check('match swap message', sw.text === 'Your shape matches, but A′ and C′ are swapped. Which column says where i goes?', sw.text);
  const c2 = Mark.markMatch([2, 2, 1, 1], [2, 1, 1, 3]);
  check('match column 2 message', c2.text === 'The first column is right. The second column sends j to (2, 1), but C′ is at (1, 3).', c2.text);
}

// ---- Mode 3 feedback ----
{
  const ans = Lib.make({ type: 'dilation', axis: 'y', k: 2 });
  const t = Mark.explainAttempt([1, 0, 0, 2], ans);
  check('mode 3 names the axis', t === 'Your matrix is a dilation of factor 2 from the <strong>x-axis</strong>.', t);
  const ans2 = Lib.make({ type: 'shear', axis: 'y', k: -1 });
  for (const s of [['1', '0', '-1', '1'], ['1', '0', '−1', '1'], ['1', '0', '-sin(pi/2)', '1']]) {
    check('mode 3 accepts ' + s.join(','), same(s.map(parse), ans2.matrix));
  }
  const half = Lib.make({ type: 'dilation', axis: 'x', k: 0.5 });
  for (const v of ['0.5', '1/2', 'sin(pi/6)']) check('mode 3 accepts ' + v, same(['1', '0', '0', v].map(parse), half.matrix));
}

// ---- no banned words in student-facing files ----
{
  const files = [];
  const walk = dir => {
    for (const f of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = path.join(dir, f.name);
      if (f.isDirectory()) { if (!['tests', '.git', 'node_modules'].includes(f.name)) walk(rel); }
      else if (/\.(html|js|css)$/.test(f.name)) files.push(rel);
    }
  };
  walk('public');
  const banned = /\b(determinant|det|inverse|eigen\w*)\b|area scale/i;
  for (const f of files) {
    const text = fs.readFileSync(path.join(root, f), 'utf8');
    const m = text.match(banned);
    check(`no banned words in ${f}`, !m, m && m[0]);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
