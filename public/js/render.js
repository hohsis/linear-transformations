// Canvas renderer shared by every page: grid paper, the unit square and its image,
// coloured basis arrows, labels, overlays, wheel/slider zoom and cancellable animation.
(function (UT) {
  'use strict';
  const { I, apply, lerp, fmt } = UT.M;

  const DUR_CHANGE = 1100;   // input changes
  const DUR_PLAY = 1800;     // play from identity
  const ease = s => (s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2);
  const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function createPlane(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    const zoomEl = opts.zoom || null;
    const minR = 1, maxR = 20;
    const state = {
      m: I.slice(),     // matrix currently drawn
      R: opts.R || 4,   // half-width of the view in units
      animating: false,
      show: Object.assign({ grid: false, basis: true, square: true, ghost: true, labels: true, coords: true, tips: true }, opts.show),
      // overlays: {m, style: 'dashed' | 'target', labels?: boolean}
      overlays: []
    };
    let W = 600, dpr = 1, C = {};

    const readColours = () => {
      const cs = getComputedStyle(document.documentElement);
      for (const n of ['panel', 'grid', 'axis', 'ink', 'muted', 'e1', 'e2', 'fill', 'edge', 'ghost', 'tgrid', 'ui', 'math']) {
        C[n] = cs.getPropertyValue('--' + n).trim();
      }
    };

    const sx = x => W / 2 + x * (W / (2 * state.R));
    const sy = y => W / 2 - y * (W / (2 * state.R));
    const wx = px => (px - W / 2) / (W / (2 * state.R));
    const wy = py => (W / 2 - py) / (W / (2 * state.R));

    function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(sx(x1), sy(y1)); ctx.lineTo(sx(x2), sy(y2)); ctx.stroke(); }

    function arrow(x, y, color, width) {
      const X = sx(x), Y = sy(y), O = sx(0), P = sy(0);
      const len = Math.hypot(X - O, Y - P);
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
      if (len < 2) { ctx.beginPath(); ctx.arc(O, P, 4, 0, 7); ctx.fill(); return; }
      const ux = (X - O) / len, uy = (Y - P) / len, h = Math.min(13, len * 0.45);
      ctx.beginPath(); ctx.moveTo(O, P); ctx.lineTo(X - ux * h * 0.8, Y - uy * h * 0.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X, Y);
      ctx.lineTo(X - ux * h - uy * h * 0.5, Y - uy * h + ux * h * 0.5);
      ctx.lineTo(X - ux * h + uy * h * 0.5, Y - uy * h - ux * h * 0.5);
      ctx.closePath(); ctx.fill();
    }

    function quad(m) {
      const A = apply(m, 1, 0), B = apply(m, 1, 1), Cc = apply(m, 0, 1);
      ctx.beginPath(); ctx.moveTo(sx(0), sy(0)); ctx.lineTo(sx(A[0]), sy(A[1])); ctx.lineTo(sx(B[0]), sy(B[1])); ctx.lineTo(sx(Cc[0]), sy(Cc[1])); ctx.closePath();
      return [A, B, Cc];
    }

    function dot(p, color, r = 5, hollow = false) {
      ctx.beginPath(); ctx.arc(sx(p[0]), sy(p[1]), r, 0, 7);
      if (hollow) { ctx.fillStyle = C.panel; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = color; ctx.stroke(); }
      else { ctx.fillStyle = color; ctx.fill(); }
    }

    function labels(m, withCoords) {
      const A = apply(m, 1, 0), B = apply(m, 1, 1), Cc = apply(m, 0, 1);
      const cx = (A[0] + B[0] + Cc[0]) / 4, cy = (A[1] + B[1] + Cc[1]) / 4;
      const pts = [['O', [0, 0], C.ink], ['A′', A, C.e1], ['B′', B, C.edge], ['C′', Cc, C.e2]];
      ctx.font = `600 15px ${C.math}`; ctx.textBaseline = 'middle';
      const placed = [];
      for (const [name, p, colour] of pts) {
        let dx = sx(p[0]) - sx(cx), dy = sy(p[1]) - sy(cy);
        let L = Math.hypot(dx, dy);
        if (L < 1) { dx = -1; dy = 1; L = Math.SQRT2; }
        const X = sx(p[0]) + dx / L * 22;
        let Y = sy(p[1]) + dy / L * 18;
        for (const q of placed) { if (Math.hypot(X - q[0], Y - q[1]) < 18) Y += 18; }
        placed.push([X, Y]);
        const txt = name === 'O' || !withCoords ? name : `${name}(${fmt(p[0], true)}, ${fmt(p[1], true)})`;
        // keep the label inside the canvas
        const w = ctx.measureText(txt).width;
        const left = Math.min(W - 4 - w, Math.max(4, dx >= 0 ? X : X - w));
        Y = Math.min(W - 10, Math.max(10, Y));
        ctx.textAlign = 'left';
        ctx.lineWidth = 4; ctx.strokeStyle = C.panel; ctx.lineJoin = 'round'; ctx.strokeText(txt, left, Y);
        ctx.fillStyle = colour; ctx.fillText(txt, left, Y);
      }
    }

    function drawTarget(m) {
      // faint parallelogram with coloured edges so the student's image can be compared against it
      const [A, B, Cc] = quad(m);
      ctx.globalAlpha = 0.18; ctx.fillStyle = C.edge; ctx.fill(); ctx.globalAlpha = 1;
      ctx.setLineDash([2, 5]); ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      ctx.strokeStyle = C.edge; ctx.beginPath(); ctx.moveTo(sx(A[0]), sy(A[1])); ctx.lineTo(sx(B[0]), sy(B[1])); ctx.lineTo(sx(Cc[0]), sy(Cc[1])); ctx.stroke();
      ctx.strokeStyle = C.e1; line(0, 0, A[0], A[1]);
      ctx.strokeStyle = C.e2; line(0, 0, Cc[0], Cc[1]);
      ctx.setLineDash([]);
      dot(A, C.e1, 4); dot(Cc, C.e2, 4); dot(B, C.edge, 4);
    }

    function drawDashed(m) {
      quad(m);
      ctx.setLineDash([7, 5]); ctx.lineWidth = 2.4; ctx.strokeStyle = C.ink; ctx.stroke(); ctx.setLineDash([]);
    }

    function draw() {
      readColours();
      const m = state.m, R = state.R, show = state.show;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, W);
      ctx.fillStyle = C.panel; ctx.fillRect(0, 0, W, W);
      const N = Math.ceil(R) + 1;

      // grid paper
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
      for (let i = -N; i <= N; i++) { line(i, -N, i, N); line(-N, i, N, i); }
      ctx.strokeStyle = C.axis; ctx.lineWidth = 1.4;
      line(-N, 0, N, 0); line(0, -N, 0, N);
      ctx.fillStyle = C.muted; ctx.font = `12px ${C.ui}`;
      const stepL = R > 12 ? 5 : R > 6 ? 2 : 1;
      for (let i = -N; i <= N; i++) {
        if (i && i % stepL === 0 && Math.abs(i) < R) {
          ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(String(i).replace('-', '−'), sx(i), sy(0) + 4);
          ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(String(i).replace('-', '−'), sx(0) - 5, sy(i));
        }
      }
      ctx.font = `italic 15px ${C.math}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText('x', sx(R) - 10, sy(0) + 4);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('y', sx(0) + 6, sy(R) + 10);

      // transformed grid
      if (show.grid) {
        ctx.strokeStyle = C.tgrid; ctx.lineWidth = 1.2;
        const G = Math.ceil(R * 2) + 6;
        for (let i = -G; i <= G; i++) {
          let p = apply(m, i, -G), q = apply(m, i, G); line(p[0], p[1], q[0], q[1]);
          p = apply(m, -G, i); q = apply(m, G, i); line(p[0], p[1], q[0], q[1]);
        }
      }

      // original unit square
      if (show.ghost) {
        ctx.strokeStyle = C.ghost; ctx.lineWidth = 1.6; ctx.setLineDash([5, 5]);
        ctx.strokeRect(sx(0), sy(1), sx(1) - sx(0), sy(0) - sy(1));
        ctx.setLineDash([]);
      }

      for (const o of state.overlays) if (o.style === 'target') drawTarget(o.m);

      const A = apply(m, 1, 0), Cc = apply(m, 0, 1);
      if (show.square) {
        quad(m);
        ctx.fillStyle = C.fill; ctx.fill();
        ctx.strokeStyle = C.edge; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.stroke();
      }
      if (show.basis) {
        arrow(A[0], A[1], C.e1, 3);
        arrow(Cc[0], Cc[1], C.e2, 3);
        if (show.tips && !state.animating) { dot(A, C.e1, 7, true); dot(Cc, C.e2, 7, true); }
      }

      for (const o of state.overlays) if (o.style === 'dashed') drawDashed(o.m);

      if (show.labels && !state.animating) labels(m, show.coords);
    }

    // ---------- sizing, zoom, theme ----------
    function resize() {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return;
      dpr = window.devicePixelRatio || 1;
      W = r.width;
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
      draw();
    }

    function setR(R) {
      state.R = Math.min(maxR, Math.max(minR, R));
      if (zoomEl) zoomEl.value = state.R;
      draw();
    }
    if (zoomEl) {
      zoomEl.min = minR; zoomEl.max = maxR; zoomEl.step = 0.1; zoomEl.value = state.R;
      zoomEl.addEventListener('input', () => setR(+zoomEl.value));
    }
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      let dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      if (e.ctrlKey) dy *= 3;   // trackpad pinch arrives as ctrl+wheel with small deltas
      setR(state.R * Math.exp(dy * 0.0015));
    }, { passive: false });

    const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    if (mq && mq.addEventListener) mq.addEventListener('change', draw);
    new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
    else window.addEventListener('resize', resize);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);

    // ---------- animation ----------
    let token = 0;
    function cancel() { token++; state.animating = false; }

    // Runs frame(e) with e eased from 0 to 1. Resolves true when finished, false if interrupted.
    function tween(dur, frame) {
      const my = ++token;
      return new Promise(res => {
        if (reduceMotion() || dur <= 0) { state.animating = false; frame(1); draw(); res(true); return; }
        state.animating = true;
        const t0 = performance.now();
        const step = now => {
          if (my !== token) { res(false); return; }
          const s = Math.min(1, (now - t0) / dur);
          frame(ease(s));
          if (s < 1) { draw(); requestAnimationFrame(step); }
          else { state.animating = false; draw(); res(true); }
        };
        requestAnimationFrame(step);
      });
    }

    // Morph the main image. Starts from whatever is drawn now, so interruptions stay smooth.
    function animateTo(to, { from, dur = DUR_CHANGE } = {}) {
      const f = (from || state.m).slice(), t = to.slice();
      return tween(dur, e => { state.m = lerp(f, t, e); });
    }

    function setMatrix(m) { cancel(); state.m = m.slice(); draw(); }
    function setShow(s) { Object.assign(state.show, s); draw(); }

    resize();
    return { state, draw, resize, setR, setMatrix, setShow, animateTo, tween, cancel, sx, sy, wx, wy };
  }

  UT.createPlane = createPlane;
  UT.DUR_CHANGE = DUR_CHANGE;
  UT.DUR_PLAY = DUR_PLAY;
})(globalThis.UT = globalThis.UT || {});
