// Shared page helpers: progress and locks, matrix input, static matrix display, feedback.
(function (UT) {
  'use strict';
  const { parse, fmt, fmtIn } = UT.M;

  const $ = id => document.getElementById(id);

  // ---------- storage (always optional) ----------
  function store(kind) {
    return {
      get(key) {
        try { const v = window[kind].getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
      },
      set(key, val) {
        try { window[kind].setItem(key, JSON.stringify(val)); } catch (e) { /* storage unavailable */ }
      }
    };
  }
  const local = store('localStorage');
  const session = store('sessionStorage');

  // ---------- progress: which sections are open and which have crowns ----------
  // Sections unlock in this order; each needs the one before it to have been opened.
  // Advanced needs a crown (a perfect set of 5) in all three practice sections.
  const ORDER = ['explore', 'name', 'describe', 'match', 'advanced'];
  const TITLES = { explore: 'Explore', name: 'Name the transformation', describe: 'Description → matrix', match: 'Match the target', advanced: 'Advanced' };
  const CROWNED = ['name', 'describe', 'match'];
  const PROGRESS_KEY = 'ut-progress';

  const storageWorks = (() => {
    try { localStorage.setItem('ut-test', '1'); localStorage.removeItem('ut-test'); return true; } catch (e) { return false; }
  })();

  const progress = {
    load() {
      return Object.assign({ opened: {}, crowns: {}, unlockAll: false }, local.get(PROGRESS_KEY));
    },
    save(p) { local.set(PROGRESS_KEY, p); },
    reset() { try { localStorage.removeItem(PROGRESS_KEY); } catch (e) { /* storage unavailable */ } },
    crownCount(p = progress.load()) { return CROWNED.filter(k => p.crowns[k]).length; },
    isUnlocked(key, p = progress.load()) {
      // without storage nothing could ever stay unlocked, so open everything
      if (!storageWorks || p.unlockAll || key === 'explore') return true;
      if (key === 'advanced') return progress.crownCount(p) === CROWNED.length;
      return !!p.opened[ORDER[ORDER.indexOf(key) - 1]];
    },
    // Teachers: add ?unlock to any address to open every section on this device.
    checkUnlockParam() {
      if (/[?&]unlock\b/.test(location.search)) { const p = progress.load(); p.unlockAll = true; progress.save(p); }
    },
    // Call at the top of each section page: sends locked visitors home, otherwise records the visit.
    enter(key) {
      progress.checkUnlockParam();
      if (!progress.isUnlocked(key)) { location.replace('index.html'); return false; }
      const p = progress.load();
      p.opened[key] = true;
      progress.save(p);
      return true;
    },
    addCrown(key) { const p = progress.load(); p.crowns[key] = true; progress.save(p); },
    hasCrown(key) { return !!progress.load().crowns[key]; }
  };

  const CROWN_SVG = '<svg class="crown" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18 L2 7 L7.5 11 L12 4 L16.5 11 L22 7 L21 18 Z"/><rect x="3" y="19" width="18" height="2.4" rx="1"/></svg>';
  const LOCK_SVG = '<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11 V8 a4 4 0 0 1 8 0 V11" fill="none" stroke-width="2.2"/></svg>';

  // ---------- matrix input ----------
  // Builds four fields in a bracketed 2 × 2 grid inside `host`.
  function matrixInput(host, { onEnter, onInput, label = 'Your matrix' } = {}) {
    host.classList.add('matrix');
    host.setAttribute('role', 'group');
    host.setAttribute('aria-label', label);
    const names = ['row 1 column 1', 'row 1 column 2', 'row 2 column 1', 'row 2 column 2'];
    const inputs = names.map((n, i) => {
      const el = document.createElement('input');
      el.type = 'text';
      el.setAttribute('aria-label', n);
      el.setAttribute('inputmode', 'text');
      el.autocomplete = 'off';
      el.spellcheck = false;
      el.setAttribute('autocapitalize', 'off');
      el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); onEnter && onEnter(); } });
      el.addEventListener('input', () => { el.classList.remove('bad'); el.removeAttribute('aria-invalid'); onInput && onInput(i, el.value); });
      host.appendChild(el);
      return el;
    });
    return {
      inputs,
      read() {
        const m = inputs.map(el => parse(el.value));
        const bad = [];
        m.forEach((v, i) => {
          const isBad = Number.isNaN(v);
          inputs[i].classList.toggle('bad', isBad);
          if (isBad) { inputs[i].setAttribute('aria-invalid', 'true'); bad.push(i); }
          else inputs[i].removeAttribute('aria-invalid');
        });
        return { ok: bad.length === 0, m, bad };
      },
      set(m) { inputs.forEach((el, i) => { el.value = fmtIn(m[i]); el.classList.remove('bad'); el.removeAttribute('aria-invalid'); }); },
      clear() { inputs.forEach(el => { el.value = ''; el.classList.remove('bad'); el.removeAttribute('aria-invalid'); }); },
      focus() { (inputs.find(el => el.classList.contains('bad')) || inputs.find(el => !el.value) || inputs[0]).focus(); },
      disable(b) { inputs.forEach(el => { el.readOnly = b; }); }
    };
  }

  const BAD_ENTRY = 'Check the highlighted entry: try a number like 2, −1/2, 0.5, √3/2 or sin(pi/6).';

  // ---------- static matrix display ----------
  function matrixHTML(m) {
    return `<span class="sm" role="img" aria-label="matrix with rows ${fmt(m[0])}, ${fmt(m[1])} and ${fmt(m[2])}, ${fmt(m[3])}" style="grid-template-columns:repeat(2,auto)">` +
      m.map(v => `<span aria-hidden="true">${fmt(v)}</span>`).join('') + '</span>';
  }

  // feedback text in the aria-live region
  function feedback(html, kind) {
    const el = $('feedback');
    el.className = 'feedback' + (kind ? ' ' + kind : '');
    el.innerHTML = nowrap(html);
    el.hidden = !html;
  }

  const capitalise = s => s.charAt(0).toUpperCase() + s.slice(1);
  // stop "y-axis" and "y = −x" breaking across lines
  const nowrap = html => html.replace(/\b[xy]-axis\b|y = −?x/g, m => `<span class="nw">${m}</span>`);

  UT.ui = { $, local, session, progress, ORDER, TITLES, CROWNED, CROWN_SVG, LOCK_SVG, matrixInput, matrixHTML, feedback, capitalise, nowrap, BAD_ENTRY };
})(globalThis.UT = globalThis.UT || {});
