// Practice sections: sets of 5 random questions. Check is a free preview; Confirm marks the answer once.
// A perfect set (5 out of 5) earns the section's crown. The page's <body data-mode> picks the section.
(function (UT) {
  'use strict';
  const { I, same, apply, point, col } = UT.M;
  const { $, progress, CROWNED, CROWN_SVG, matrixInput, matrixHTML, feedback, nowrap, BAD_ENTRY } = UT.ui;
  const Lib = UT.Lib;

  const SET_SIZE = 5;
  const mode = document.body.dataset.mode;
  if (!progress.enter(mode)) return;

  const pool = mode === 'advanced' ? Lib.ADVANCED : Lib.BASIC;
  const plane = UT.createPlane($('cv'), { R: 5.5, zoom: $('zoom'), show: { labels: false, coords: true } });
  const S = plane.state;
  const area = $('qArea');
  const btn = { check: $('check'), confirm: $('confirm'), hint: $('hint'), next: $('next'), replay: $('replay') };
  const TYPE_NAMES = { name: 'Name the transformation', describe: 'Description → matrix', match: 'Match the target' };

  let seq = [], results = [], index = 0, q = null, confirmed = false;
  let usedEntries = [], usedTargets = [];

  // ---------- shared helpers ----------
  const verts = m => `O, A′${point(apply(m, 1, 0))}, B′${point(apply(m, 1, 1))} and C′${point(apply(m, 0, 1))}`;
  const setCanvasLabel = text => $('cv').setAttribute('aria-label', text);

  // Morph the unit square to m (from the identity); labels appear when it finishes.
  function showImage(m, overlays = []) {
    S.overlays = overlays;
    plane.setShow({ labels: false });
    setCanvasLabel(`The unit square is sent to the parallelogram with vertices ${verts(m)}.`);
    return plane.animateTo(m, { from: I, dur: UT.DUR_PLAY }).then(done => { if (done) plane.setShow({ labels: true }); return done; });
  }

  function whatItIs(m) {
    const e = UT.classify(m);
    if (e.type === 'identity') return 'the identity transformation';
    if (e.type === 'other') return UT.Mark.OTHER;
    return 'a ' + e.description;
  }

  function readMatrix(mat) {
    const r = mat.read();
    if (!r.ok) { feedback(`<p>${BAD_ENTRY}</p>`, 'bad'); mat.focus(); return null; }
    return r.m;
  }

  const confirmTip = '<b>Check</b> is free: it shows what your answer does. <b>Confirm</b> locks your answer in.';

  // ---------- question styles ----------
  function nameQuestion() {
    const entry = Lib.randomEntry(pool, usedEntries);
    usedEntries.push(entry);
    const options = Lib.makeOptions(entry, pool);
    let chosen = -1;

    area.innerHTML = '<h2 id="optsLabel">Which transformation is this?</h2>' +
      '<div class="options" id="options" role="radiogroup" aria-labelledby="optsLabel"></div>' +
      `<p class="small tip">${confirmTip} Use the arrow keys to move between options.</p>`;
    const optsEl = $('options');
    const btns = options.map((o, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'option';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      b.tabIndex = i === 0 ? 0 : -1;
      b.innerHTML = `<span class="txt">${nowrap(o.description)}</span>`;
      b.addEventListener('click', () => select(i));
      optsEl.appendChild(b);
      return b;
    });

    function select(i) {
      if (confirmed) return;
      chosen = i;
      btns.forEach((b, j) => {
        b.setAttribute('aria-checked', String(j === i));
        b.classList.toggle('selected', j === i);
        b.tabIndex = j === i ? 0 : -1;
      });
    }
    optsEl.addEventListener('keydown', e => {
      const i = btns.indexOf(document.activeElement);
      if (i < 0 || confirmed) return;
      let j = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = (i + 1) % btns.length;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = (i - 1 + btns.length) % btns.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = btns.length - 1;
      if (j !== null) { e.preventDefault(); btns[j].focus(); select(j); }
    });

    // dashed outline of the chosen option, morphing over the true image
    function previewChoice() {
      const pick = options[chosen];
      plane.cancel();
      S.m = entry.matrix.slice();
      const o = { m: I.slice(), final: pick.matrix, style: 'dashed' };
      S.overlays = [o];
      plane.setShow({ labels: false });
      plane.tween(UT.DUR_PLAY, e => { o.m = I.map((v, k) => v + (pick.matrix[k] - v) * e); })
        .then(done => { if (done) plane.setShow({ labels: true }); });
    }
    const needChoice = () => { feedback('<p>Choose one of the options first.</p>', 'bad'); (btns[0]).focus(); };

    return {
      focus: () => btns[0].focus(),
      start() {
        S.overlays = [];
        plane.setMatrix(I);
        setCanvasLabel(`The unit square is sent to the parallelogram with vertices ${verts(entry.matrix)}.`);
        this.replay();
      },
      replay() {
        S.overlays.forEach(o => { o.m = o.final.slice(); });
        plane.setShow({ labels: false });
        plane.animateTo(entry.matrix, { from: I, dur: UT.DUR_PLAY }).then(done => { if (done) plane.setShow({ labels: true }); });
      },
      check() {
        if (chosen < 0) return needChoice();
        previewChoice();
        feedback(`<p>The dashed outline shows what a ${options[chosen].description} would do. Does it match the shaded image?</p><p class="small">Press <b>Confirm</b> to lock in your answer, or choose another option.</p>`);
      },
      confirm() {
        if (chosen < 0) { needChoice(); return null; }
        const pick = options[chosen];
        const right = pick === entry;
        btns.forEach((b, j) => {
          b.disabled = true;
          const tag = text => { const t = document.createElement('span'); t.className = 'tag'; t.textContent = text; b.appendChild(t); };
          if (options[j] === entry) { b.classList.add('right'); tag(right ? '✓ Your answer' : '✓ Answer'); }
          else if (j === chosen) { b.classList.add('wrong'); tag('✗ Your answer'); }
        });
        if (right) {
          plane.cancel(); S.m = entry.matrix.slice(); S.overlays = []; plane.setShow({ labels: true });
          feedback(`<p class="mark">✓ Correct.</p><p>It is a ${entry.description}. Its matrix is ${matrixHTML(entry.matrix)}</p>`, 'good');
        } else {
          previewChoice();
          feedback(`<p class="mark">✗ Not quite.</p><p>It is a ${entry.description}, with matrix ${matrixHTML(entry.matrix)}</p>` +
            `<p>The dashed outline shows what your answer, a ${pick.description}, does: its matrix is ${matrixHTML(pick.matrix)}</p>`, 'bad');
        }
        return right;
      }
    };
  }

  function matrixArea(heading, extra) {
    area.innerHTML = heading +
      '<div class="matrow"><span class="mname">T =</span><div id="mat"></div></div>' +
      `<p class="small tip">${extra} Press Enter to check. ${confirmTip}</p>`;
    return matrixInput($('mat'), { onEnter: check });
  }

  function describeQuestion() {
    const entry = Lib.randomEntry(pool, usedEntries);
    usedEntries.push(entry);
    const mat = matrixArea(`<h2>Find the matrix of the</h2><p class="desc" id="desc">${nowrap(entry.description)}</p>`,
      'Entries can be things like <span class="math">−2</span>, <span class="math">1/2</span>, <span class="math">√3/2</span> or <span class="math">cos(pi/6)</span>.');
    return {
      focus: () => mat.focus(),
      start() {
        S.overlays = [];
        plane.setShow({ labels: false });
        plane.setMatrix(I);
        setCanvasLabel('Plane showing the unit square with i in red and j in blue.');
      },
      check() {
        const m = readMatrix(mat);
        if (!m) return;
        showImage(m);
        feedback(`<p>Your matrix is ${whatItIs(m)}.</p><p class="small">Press <b>Confirm</b> to lock in your answer, or change it and check again.</p>`);
      },
      confirm() {
        const m = readMatrix(mat);
        if (!m) return null;
        mat.disable(true);
        const right = same(m, entry.matrix);
        if (right) {
          showImage(m);
          feedback(`<p class="mark">✓ Correct!</p><p>That is the matrix of the ${entry.description}.</p>`, 'good');
        } else {
          showImage(entry.matrix, [{ m, style: 'dashed' }]);
          feedback(`<p class="mark">✗ Not quite.</p><p>${UT.Mark.explainAttempt(m, entry)}</p>` +
            `<p>The answer is ${matrixHTML(entry.matrix)}</p><p class="small">The shaded shape is the answer; the dashed outline is your matrix.</p>`, 'bad');
        }
        return right;
      }
    };
  }

  function matchQuestion() {
    const T = Lib.randomTarget('standard', usedTargets);
    usedTargets.push(T);
    const mat = matrixArea('<h2>Enter the matrix that makes the target</h2>',
      'Read the coordinates of A′ (red) and C′ (blue) off the grid.');
    area.insertAdjacentHTML('beforeend', '<p class="hintbox" id="hintText" hidden>Where does <b>i</b> = (1, 0) land? That\'s the first column.</p>');
    const target = { m: T, style: 'target' };
    return {
      focus: () => mat.focus(),
      hint() { $('hintText').hidden = false; },
      start() {
        S.overlays = [];
        plane.setShow({ labels: true, coords: false });
        plane.setMatrix(T);
        setCanvasLabel(`Target parallelogram with vertices O, A′ at ${point(col(T, 0))}, B′ at ${point(apply(T, 1, 1))} and C′ at ${point(col(T, 1))}. A′ is red and C′ is blue.`);
      },
      check() {
        const m = readMatrix(mat);
        if (!m) return;
        plane.setShow({ coords: true });
        showImage(m, [target]);
        feedback(`<p>Your matrix sends <b>i</b> to ${point(col(m, 0))} and <b>j</b> to ${point(col(m, 1))}.</p><p class="small">The faint outline is the target and the shaded shape is your matrix. Press <b>Confirm</b> when you're happy.</p>`);
      },
      confirm() {
        const m = readMatrix(mat);
        if (!m) return null;
        mat.disable(true);
        $('hintText').hidden = true;
        plane.setShow({ coords: true });
        const res = UT.Mark.markMatch(m, T);
        if (res.correct) {
          showImage(m, [target]);
          feedback(`<p class="mark">✓ Correct!</p><p><b>i</b> goes to A′${point(col(T, 0))} and <b>j</b> goes to C′${point(col(T, 1))}, so the matrix is ${matrixHTML(T)}</p>`, 'good');
        } else {
          showImage(T, [{ m, style: 'dashed' }]);
          feedback(`<p class="mark">✗ Not quite.</p><p>${res.text}</p><p>The answer is ${matrixHTML(T)}</p><p class="small">The shaded shape is the target; the dashed outline is your matrix.</p>`, 'bad');
        }
        return res.correct;
      }
    };
  }

  const MAKERS = { name: nameQuestion, describe: describeQuestion, match: matchQuestion };

  // ---------- the set of 5 ----------
  function renderStatus() {
    $('qNum').textContent = Math.min(index + 1, SET_SIZE);
    const dots = $('dots');
    dots.innerHTML = '';
    for (let i = 0; i < SET_SIZE; i++) {
      const li = document.createElement('li');
      const r = results[i];
      if (r === true) { li.className = 'right'; li.textContent = '✓'; li.setAttribute('aria-label', `Question ${i + 1}: correct`); }
      else if (r === false) { li.className = 'wrong'; li.textContent = '✗'; li.setAttribute('aria-label', `Question ${i + 1}: incorrect`); }
      else { li.className = i === index ? 'current' : ''; li.textContent = i + 1; li.setAttribute('aria-label', `Question ${i + 1}: ${i === index ? 'current' : 'to come'}`); }
      dots.appendChild(li);
    }
    $('crownStatus').innerHTML = progress.hasCrown(mode)
      ? `${CROWN_SVG}<span>Crown earned</span>`
      : '<span>Get all 5 right in a set to earn the crown</span>';
    $('crownStatus').classList.toggle('earned', progress.hasCrown(mode));
  }

  function newSet() {
    seq = mode === 'advanced'
      ? Lib.shuffle(['name', 'describe', 'match', Lib.pick(['name', 'describe', 'match']), Lib.pick(['name', 'describe', 'match'])])
      : Array(SET_SIZE).fill(mode);
    results = []; usedEntries = []; usedTargets = []; index = 0;
    startQuestion();
  }

  function startQuestion() {
    confirmed = false;
    feedback('');
    $('summary').hidden = true;
    q = MAKERS[seq[index]]();
    if ($('qType')) $('qType').textContent = TYPE_NAMES[seq[index]];
    btn.check.disabled = btn.confirm.disabled = false;
    btn.check.hidden = btn.confirm.hidden = false;
    btn.hint.hidden = !q.hint;
    btn.replay.hidden = !q.replay;
    btn.next.hidden = true;
    renderStatus();
    q.start();
  }

  function check() { if (!confirmed) q.check(); }

  function confirm() {
    if (confirmed) return;
    const right = q.confirm();
    if (right === null) return;
    confirmed = true;
    results.push(right);
    btn.check.hidden = btn.confirm.hidden = btn.hint.hidden = true;
    btn.next.hidden = false;
    if (results.length === SET_SIZE) finishSet();
    else btn.next.textContent = 'Next question';
    renderStatus();
    btn.next.focus();
  }

  function finishSet() {
    const n = results.filter(Boolean).length;
    const el = $('summary');
    if (n === SET_SIZE) {
      const isNew = !progress.hasCrown(mode);
      progress.addCrown(mode);
      let msg = `<p class="mark">${CROWN_SVG} Perfect set: 5 out of 5!</p>`;
      msg += isNew ? '<p>You have earned the crown for this section.</p>' : '<p>You already had the crown for this section. Nice work again!</p>';
      if (isNew && CROWNED.includes(mode) && progress.crownCount() === CROWNED.length) msg += '<p><b>Advanced is now unlocked.</b> Head back to the home page to try it.</p>';
      el.innerHTML = msg;
      el.className = 'summary perfect';
    } else {
      el.innerHTML = `<p class="mark">Set complete: ${n} out of 5.</p><p>Get all 5 right in one set to earn the crown.</p>`;
      el.className = 'summary';
    }
    el.hidden = false;
    btn.next.textContent = 'Start a new set';
  }

  btn.check.addEventListener('click', check);
  btn.confirm.addEventListener('click', confirm);
  btn.hint.addEventListener('click', () => q.hint && q.hint());
  btn.replay.addEventListener('click', () => q.replay && q.replay());
  btn.next.addEventListener('click', () => {
    if (results.length === SET_SIZE) newSet();
    else { index++; startQuestion(); }
    q.focus();
  });

  newSet();
})(globalThis.UT);
