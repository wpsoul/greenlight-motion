/* UI Motion Kit — controls elements. */
(function () {
const { rect, circle, text, path, icon, group, k, enter, exit, pop, press, cursorLayer, stagger } = UIK.h;

// ── local helpers (plain functions that return ordinary layers / tracks) ──
// the main shape's entrance: pops from `s` with Back Out
const IN = (t = 0.1, s = 0.65) => ({ scale: [s, [t, t + 0.52, 1, 'Back Out']], opacity: [0, [t, t + 0.12, 1, 'Linear']] });
// the moment an eased move a → b over [t0, t1] passes v (hover fills, highlight hand-offs that follow the cursor)
const cross = (t0, t1, a, b, v, e = 'Power2 Smooth') => {
  const f = UIK.ease(e); let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2, x = a + (b - a) * f(m); if ((b - a) * (v - x) > 0) lo = m; else hi = m; }
  return +(t0 + (t1 - t0) * hi).toFixed(3);
};
// slot roll: a clipped window whose column of values rolls UP one slot at each time in `ts`
const roll = ({ id, x = 0, y = 0, w, h, vals, ts, dur = 0.45, e = 'Power3 Out', size, weight = 600, color = 'ink' }) =>
  rect({ id, x, y, w, h, clip: true, ch: [group({ id: id + 'Col', k: { y: ts.map((t, i) => [t, t + dur, -h * (i + 1), e]) },
    ch: vals.map((s, i) => text({ text: s, y: i * h, size, weight, color })) })] });
// liquid indicator for a pin 'l' rect: the leading edge travels fast, the trailing edge follows late.
// x (= left edge) is one eased segment; w (= right − left) is sampled into short linear segments.
const edges = (t, L0, R0, L1, R1, o = {}) => {
  const right = (L1 + R1) > (L0 + R0), fast = o.fast ?? 0.34, slow = o.slow ?? 0.5, lag = o.lag ?? 0.08, n = o.n ?? 10;
  const f = UIK.ease('Power3 Out'), at = (tt, a, b, t0, d) => a + (b - a) * f(Math.min(1, Math.max(0, (tt - t0) / d)));
  const Lf = (tt) => (right ? at(tt, L0, L1, t + lag, slow) : at(tt, L0, L1, t, fast));
  const Rf = (tt) => (right ? at(tt, R0, R1, t, fast) : at(tt, R0, R1, t + lag, slow));
  const end = t + lag + slow, w = [];
  for (let j = 1; j <= n; j++) { const a = t + (end - t) * (j - 1) / n, b = t + (end - t) * j / n; w.push([+a.toFixed(3), +b.toFixed(3), +(Rf(b) - Lf(b)).toFixed(2), 'Linear']); }
  return { x: [right ? [t + lag, t + lag + slow, L1, 'Power3 Out'] : [t, t + fast, L1, 'Power3 Out']], w };
};

// 1 ─ Checklist: the cursor ticks three tasks; box fills, check writes on, label dims + strikes, counter rolls
UIK.define({
  id: 'checkbox-list', name: 'Checklist', cat: 'controls', T: 3.8, cam: 1.35,
  desc: 'The cursor ticks three tasks in turn: each box fills ink with a pop, the check writes on, the label dims and strikes through, and the header count rolls while the progress bar advances.',
  build: () => {
    const C = [1.05, 1.7, 2.35], Y = [-44, 72, 188], BX = -392, LX = -336;
    const rows = [['Write the release notes', 'Today', 360.8], ['Record the demo video', 'Tomorrow', 359.3], ['Ship to production', 'Friday', 287.2]];
    return [
      rect({ id: 'card', w: 960, h: 580, r: 44, fill: 'card', shadow: 1, k: IN(0.1), ch: [
        text({ id: 'title', text: 'Launch checklist', x: -420, y: -206, ax: 0, size: 46, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -420 }) }),
        group({ id: 'counter', k: enter(0.3), ch: [
          roll({ id: 'count', x: 283, y: -206, w: 22, h: 40, vals: ['0', '1', '2', '3'], ts: C.map((c) => c + 0.06), size: 28, weight: 600 }),
          text({ id: 'countLbl', text: 'of 3 done', x: 420, y: -206, ax: 1, size: 28, weight: 500, color: 'muted' }),
        ] }),
        rect({ id: 'barTrack', y: -146, w: 840, h: 10, r: 5, fill: 'line', k: enter(0.34, { blur: 0 }) }),
        rect({ id: 'barFill', x: -420, y: -146, pin: 'l', w: 0, h: 10, r: 5, fill: 'acc', k: { w: C.map((c, i) => [c + 0.05, c + 0.6, 280 * (i + 1), 'Power4 Out']) } }),
        rect({ id: 'rule0', y: (Y[0] + Y[1]) / 2, w: 840, h: 2, fill: 'line', k: enter(0.46, { blur: 0, s: 1 }) }),
        rect({ id: 'rule1', y: (Y[1] + Y[2]) / 2, w: 840, h: 2, fill: 'line', k: enter(0.54, { blur: 0, s: 1 }) }),
        ...rows.map(([s, due, tw], i) => group({ id: 'row' + i, y: Y[i], k: enter(0.4 + i * 0.08, { dx: -18 }), ch: [
          group({ id: 'box' + i, x: BX, k: press(C[i], { to: 0.86 }), ch: [
            rect({ id: 'boxLine' + i, w: 56, h: 56, r: 16, fill: 'card', stroke: 'dim', sw: 3 }),
            rect({ id: 'boxFill' + i, w: 56, h: 56, r: 16, fill: 'ink', k: pop(C[i], { from: 0.5, dur: 0.36 }) }),
            path({ id: 'tick' + i, d: 'M-12 1 L-4 9 L13 -9', stroke: 'inv', sw: 5, trimmed: true, k: { trimE: [0, [C[i] + 0.08, C[i] + 0.36, 100, 'Power3 Out']] } }),
          ] }),
          text({ id: 'task' + i, text: s, x: LX, ax: 0, size: 34, weight: 500, color: 'ink', k: { color: [[C[i] + 0.08, C[i] + 0.4, 'muted', 'Power2 Out']] } }),
          path({ id: 'strike' + i, x: LX, y: 3, d: `M0 0 L${tw} 0`, stroke: 'muted', sw: 3, trimmed: true, k: { trimE: [0, [C[i] + 0.12, C[i] + 0.5, 100, 'Power3 Out']] } }),
          text({ id: 'due' + i, text: due, x: 420, ax: 1, size: 26, color: 'muted' }),
        ] })),
      ] }),
      cursorLayer([[0, 540, 330], [0.55, 540, 330], [C[0] - 0.1, BX + 6, Y[0] + 8], [C[0] + 0.15, BX + 6, Y[0] + 8], [C[1] - 0.1, BX + 6, Y[1] + 8],
        [C[1] + 0.15, BX + 6, Y[1] + 8], [C[2] - 0.1, BX + 6, Y[2] + 8], [C[2] + 0.3, BX + 6, Y[2] + 8], [C[2] + 0.9, 330, 330]], C, [], { inAt: 0.5 }),
    ];
  },
});

// 2 ─ Radio group: the dot shrinks out of the old ring and pops into the new one; the ink row ring slides
UIK.define({
  id: 'radio-group', name: 'Radio group', cat: 'controls', T: 3.6, cam: 1.4,
  desc: 'Two clicks change the delivery option: the accent dot shrinks out of the old ring and pops into the new one while the ink row outline slides down and stretches in flight.',
  build: () => {
    const RY = [-96, 44, 184], C = [1.15, 2.3], RX = -354;
    const opts = [['Standard', 'Arrives in 5–7 days', 'Free'], ['Express', 'Arrives in 2 days', '$9'], ['Overnight', 'Arrives tomorrow by 10 am', '$24']];
    const dotK = (i) => {
      const s = i === 0 ? [0, [0.62, 1.02, 1, 'Back Out']] : [0, [C[i - 1] + 0.1, C[i - 1] + 0.52, 1, 'Back Out']];
      if (i < 2) s.push([C[i], C[i] + 0.16, 0, 'Power2 In']);
      return { scale: s };
    };
    const ringK = (i) => {
      const o = i === 0 ? [1] : [0, [C[i - 1] + 0.05, C[i - 1] + 0.25, 1, 'Power2 Out']];
      if (i < 2) o.push([C[i], C[i] + 0.2, 0, 'Power2 Out']);
      return { opacity: o };
    };
    const slide = (c, to) => ({ y: [[c, c + 0.5, to, 'Power4 Out']], h: [[c, c + 0.14, 172, 'Power2 Out'], [c + 0.14, c + 0.55, 124, 'Power3 Out']] });
    return [
      rect({ id: 'card', w: 900, h: 600, r: 44, fill: 'card', shadow: 1, k: IN(0.1), ch: [
        text({ id: 'title', text: 'Delivery speed', x: -410, y: -226, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -410 }) }),
        text({ id: 'step', text: 'Step 2 of 3', x: 410, y: -226, ax: 1, size: 26, color: 'muted', k: enter(0.3) }),
        ...opts.map(([t, s, p], i) => rect({ id: 'opt' + i, y: RY[i], w: 820, h: 124, r: 28, fill: 'card', stroke: 'line', sw: 2,
          k: k(enter(0.32 + i * 0.08, { dy: 16, y0: RY[i] }), i ? press(C[i - 1], { to: 0.98 }) : null), ch: [
            circle({ id: 'radio' + i, x: RX, d: 44, fill: 'card', stroke: 'dim', sw: 3 }),
            circle({ id: 'ring' + i, x: RX, d: 44, stroke: 'ink', sw: 3, k: ringK(i) }),
            circle({ id: 'dot' + i, x: RX, d: 20, fill: 'acc', k: dotK(i) }),
            text({ id: 'optTitle' + i, text: t, x: -312, y: -18, ax: 0, size: 32, weight: 600 }),
            text({ id: 'optSub' + i, text: s, x: -312, y: 22, ax: 0, size: 26, color: 'muted' }),
            text({ id: 'price' + i, text: p, x: 370, ax: 1, size: 32, weight: 500 }),
          ] })),
        rect({ id: 'selRing', y: RY[0], w: 820, h: 124, r: 28, stroke: 'ink', sw: 2.5, k: k(enter(0.4, { blur: 0 }), slide(C[0], RY[1]), slide(C[1], RY[2])) }),
      ] }),
      cursorLayer([[0, 560, 340], [0.6, 560, 340], [C[0] - 0.1, -130, RY[1] + 10], [C[0] + 0.2, -130, RY[1] + 10], [C[1] - 0.1, -112, RY[2] + 10],
        [C[1] + 0.25, -112, RY[2] + 10], [C[1] + 0.85, 250, 336]], C, [], { inAt: 0.55 }),
    ];
  },
});

// 3 ─ Slider: grab, drag, release. Fill, value bubble and header value all ride the same keys as the cursor.
UIK.define({
  id: 'slider-drag', name: 'Slider', cat: 'controls', T: 3.5, cam: 1.35,
  desc: 'The cursor grabs the knob and drags it past the target, then eases back: the fill, the value bubble and the header value follow on the same keys, and the knob grows while held and settles on release.',
  build: () => {
    const G = 1.15, M = 1.95, R = 2.45, TY = 84, HY = -96, X = (v) => -440 + 8.8 * v, V = [30, 86, 68], PS = 'Power2 Smooth';
    const mv = (f) => [[G, M, f(V[1]), PS], [M, R, f(V[2]), PS]];
    return [
      rect({ id: 'card', w: 1000, h: 380, r: 44, fill: 'card', shadow: 1, k: IN(0.1), ch: [
        icon({ id: 'volIcon', icon: 'volume', x: -418, y: HY, size: 44, sw: 2.6, k: enter(0.22) }),
        text({ id: 'label', text: 'Volume', x: -382, y: HY, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.26, { dx: -14, x0: -382 }) }),
        text({ id: 'value', x: 440, y: HY, ax: 1, size: 40, weight: 600, ls: -0.02, num: { suf: '%' }, k: k(enter(0.3), { value: [V[0], ...mv((v) => v)] }) }),
        rect({ id: 'track', y: TY, w: 880, h: 12, r: 6, fill: 'dim', k: enter(0.34, { blur: 0 }) }),
        rect({ id: 'fill', x: -440, y: TY, pin: 'l', w: X(V[0]) + 440, h: 12, r: 6, fill: 'ink', k: k(enter(0.34, { blur: 0, s: 1 }), { w: mv((v) => X(v) + 440) }) }),
        circle({ id: 'knob', x: X(V[0]), y: TY, d: 60, fill: '#FFFFFF', stroke: 'ink', sw: 4, shadow: 3,
          k: k(pop(0.42, { from: 0.4 }), { x: mv(X) }, { scale: [[G - 0.05, G + 0.15, 1.22, 'Power3 Out'], [R + 0.05, R + 0.45, 1, 'Back Out']] }) }),
        group({ id: 'bubble', x: X(V[0]), y: TY - 30 * 1.22 - 14, k: k(pop(G, { from: 0.5, dur: 0.4 }), exit(R + 0.3, { s: 0.85 }), { x: mv(X) }), ch: [
          rect({ id: 'bubbleTip', y: -4, w: 18, h: 18, r: 3, rot: 45, fill: 'ink' }),
          rect({ id: 'bubbleBox', pin: 'b', y: -6, w: 104, h: 62, r: 18, fill: 'ink', ch: [
            text({ id: 'bubbleVal', size: 30, weight: 600, color: 'inv', num: {}, k: { value: [V[0], ...mv((v) => v)] } }),
          ] }),
        ] }),
      ] }),
      cursorLayer([[0, 520, 300], [0.55, 520, 300], [G - 0.12, X(V[0]) + 4, TY + 8], [G, X(V[0]) + 4, TY + 8], [M, X(V[1]) + 4, TY + 8], [R, X(V[2]) + 4, TY + 8],
        [R + 0.15, X(V[2]) + 4, TY + 8], [R + 0.75, 470, 262]], [], [[G, R]], { inAt: 0.5 }),
    ];
  },
});

// 4 ─ Range slider: two knobs, the accent span tracks both, histogram bars outside the range dim
UIK.define({
  id: 'range-slider', name: 'Range slider', cat: 'controls', T: 4.1, cam: 1.3,
  desc: 'The cursor drags the minimum knob right, then the maximum knob left: the accent span tracks both edges, histogram bars dim as they fall outside, and both fields count.',
  build: () => {
    const TY = 70, X = (v) => -400 + 0.8 * v, A0 = 1.05, A1 = 1.75, B0 = 2.35, B1 = 3.05, PS = 'Power2 Smooth';
    const L = [120, 280], R = [880, 640];
    const HS = [22, 34, 48, 66, 90, 112, 128, 146, 150, 136, 120, 104, 96, 82, 70, 56, 44, 34, 26, 18];
    const bars = HS.map((h, i) => {
      const x = -380 + 40 * i, on = x >= X(L[0]) && x <= X(R[0]), kk = { h: [0, [0.35 + i * 0.025, 0.95 + i * 0.025, h, 'Power4 Out']] };
      if (on && x < X(L[1])) { const t = cross(A0, A1, X(L[0]), X(L[1]), x); kk.fill = [[t, t + 0.2, 'dim', 'Power2 Out']]; }
      if (on && x > X(R[1])) { const t = cross(B0, B1, X(R[0]), X(R[1]), x); kk.fill = [[t, t + 0.2, 'dim', 'Power2 Out']]; }
      return rect({ id: 'bar' + i, x, y: TY - 30, pin: 'b', w: 26, h: 0, r: 7, fill: on ? 'ink' : 'dim', k: kk });
    });
    const knob = (id, v0, v1, t0, t1) => circle({ id, x: X(v0), y: TY, d: 52, fill: '#FFFFFF', stroke: 'acc', sw: 4, shadow: 3,
      k: k(pop(0.55, { from: 0.4 }), { x: [[t0, t1, X(v1), PS]] }, { scale: [[t0 - 0.05, t0 + 0.15, 1.18, 'Power3 Out'], [t1 + 0.05, t1 + 0.45, 1, 'Back Out']] }) });
    const field = (i, x, lbl, v, t0, t1) => rect({ id: 'field' + i, x, y: 196, w: 390, h: 96, r: 24, fill: 'card', stroke: 'line', sw: 2, k: enter(0.5 + i * 0.08, { dy: 14, y0: 196 }), ch: [
      rect({ id: 'fieldFocus' + i, w: 390, h: 96, r: 24, stroke: 'ink', sw: 2.5, k: { opacity: [0, [t0 - 0.05, t0 + 0.1, 1, 'Power2 Out'], [t1 + 0.1, t1 + 0.35, 0, 'Power2 Out']] } }),
      text({ id: 'fieldLbl' + i, text: lbl, x: -165, y: -18, ax: 0, size: 22, weight: 500, color: 'muted' }),
      text({ id: 'fieldVal' + i, x: -165, y: 16, ax: 0, size: 32, weight: 600, num: { pre: '$' }, k: { value: [v[0], [t0, t1, v[1], PS]] } }),
    ] });
    return [
      rect({ id: 'card', w: 1000, h: 600, r: 44, fill: 'card', shadow: 1, k: IN(0.1), ch: [
        text({ id: 'title', text: 'Price range', x: -400, y: -226, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -400 }) }),
        text({ id: 'sub', text: 'Nightly price, before fees', x: -400, y: -182, ax: 0, size: 26, color: 'muted', k: enter(0.3) }),
        ...bars,
        rect({ id: 'track', y: TY, w: 800, h: 10, r: 5, fill: 'dim', k: enter(0.4, { blur: 0 }) }),
        rect({ id: 'span', x: X(L[0]), y: TY, pin: 'l', w: X(R[0]) - X(L[0]), h: 10, r: 5, fill: 'acc',
          k: k(enter(0.45, { blur: 0, s: 1 }), { x: [[A0, A1, X(L[1]), PS]], w: [[A0, A1, X(R[0]) - X(L[1]), PS], [B0, B1, X(R[1]) - X(L[1]), PS]] }) }),
        knob('knobMin', L[0], L[1], A0, A1),
        knob('knobMax', R[0], R[1], B0, B1),
        field(0, -205, 'Minimum', L, A0, A1),
        field(1, 205, 'Maximum', R, B0, B1),
      ] }),
      cursorLayer([[0, 540, 330], [0.5, 540, 330], [A0 - 0.12, X(L[0]) + 4, TY + 8], [A0, X(L[0]) + 4, TY + 8], [A1, X(L[1]) + 4, TY + 8], [A1 + 0.12, X(L[1]) + 4, TY + 8],
        [B0 - 0.12, X(R[0]) + 4, TY + 8], [B0, X(R[0]) + 4, TY + 8], [B1, X(R[1]) + 4, TY + 8], [B1 + 0.15, X(R[1]) + 4, TY + 8], [B1 + 0.7, 470, 330]],
        [], [[A0, A1], [B0, B1]], { inAt: 0.45 }),
    ];
  },
});

// 5 ─ Stepper: + twice; the quantity and the total roll digit by digit; free shipping unlocks
UIK.define({
  id: 'stepper', name: 'Stepper', cat: 'controls', T: 3.3, cam: 1.35,
  desc: 'The cursor taps plus twice: the quantity rolls up one slot per tap, the total rolls digit by digit a beat later, the minus wakes up, and a free-shipping badge pops once the total passes the threshold.',
  build: () => {
    const C = [1.1, 1.8], PY = -80, SX = 280, TY = 136;
    return [
      rect({ id: 'card', w: 1000, h: 440, r: 44, fill: 'card', shadow: 1, k: IN(0.1), ch: [
        rect({ id: 'thumb', x: -390, y: PY, w: 150, h: 150, r: 34, fill: 'soft', k: pop(0.22, { from: 0.7 }), ch: [icon({ id: 'bagIcon', icon: 'bag', size: 66, sw: 3 })] }),
        text({ id: 'name', text: 'Canvas tote', x: -286, y: PY - 22, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.28, { dx: -14, x0: -286 }) }),
        text({ id: 'unit', text: 'Natural · $18 each', x: -286, y: PY + 24, ax: 0, size: 26, color: 'muted', k: enter(0.36) }),
        rect({ id: 'stepper', x: SX, y: PY, w: 300, h: 104, r: 52, fill: 'soft', k: enter(0.4), ch: [
          circle({ id: 'minus', x: -98, d: 80, fill: 'card', shadow: 3, ch: [icon({ id: 'minusIcon', icon: 'minus', size: 34, sw: 2.8, color: 'dim', k: { color: [[C[0] + 0.1, C[0] + 0.35, 'ink', 'Power2 Out']] } })] }),
          roll({ id: 'qty', w: 44, h: 64, vals: ['1', '2', '3'], ts: C, size: 44, weight: 600 }),
          circle({ id: 'plus', x: 98, d: 80, fill: 'ink', k: k(press(C[0], { to: 0.88 }), press(C[1], { to: 0.88 })), ch: [icon({ id: 'plusIcon', icon: 'plus', size: 34, sw: 2.8, color: 'inv' })] }),
        ] }),
        rect({ id: 'rule', y: 50, w: 900, h: 2, fill: 'line', k: enter(0.46, { blur: 0, s: 1 }) }),
        text({ id: 'totalLbl', text: 'Total', x: -450, y: TY, ax: 0, size: 34, weight: 500, k: enter(0.5) }),
        rect({ id: 'freeShip', x: -261, y: TY, w: 190, h: 46, r: 23, fill: 'acc', k: pop(C[1] + 0.35, { from: 0.5 }), ch: [text({ id: 'freeShipLbl', text: 'Free shipping', size: 22, weight: 600, color: '#FFFFFF' })] }),
        group({ id: 'price', y: TY, k: enter(0.5), ch: [
          text({ id: 'priceCur', text: '$', x: 332.5, ax: 1, size: 44, weight: 600 }),
          roll({ id: 'priceTens', x: 346, w: 30, h: 60, vals: ['1', '3', '5'], ts: C.map((c) => c + 0.04), size: 44, weight: 600 }),
          roll({ id: 'priceUnits', x: 373, w: 30, h: 60, vals: ['8', '6', '4'], ts: C.map((c) => c + 0.1), size: 44, weight: 600 }),
          text({ id: 'priceCents', text: '.00', x: 450, ax: 1, size: 44, weight: 600 }),
        ] }),
      ] }),
      cursorLayer([[0, 520, 300], [0.5, 520, 300], [C[0] - 0.1, SX + 104, PY + 8], [C[1] + 0.25, SX + 104, PY + 8], [C[1] + 0.85, 470, 262]], C, [], { inAt: 0.45 }),
    ];
  },
});

// 6 ─ Button states: one shape morphs pill → spinner circle → accent success circle → pill
UIK.define({
  id: 'button-states', name: 'Button: submit → loading → done', cat: 'morph', T: 4.2,
  cam: { zoom: 2.1, k: { zoom: [[1.05, 1.7, 2.45, 'Power2 Smooth'], [2.95, 3.6, 2.1, 'Power2 Smooth']] } },
  desc: 'A click squeezes the submit pill into a circle with a spinning trimmed ring; the ring closes, the circle turns accent and a check writes on, then the shape widens back into an "Order placed" pill.',
  build: () => {
    const C = 1.0, S = 2.3, W = 3.0, RING = 'M0 -30 A30 30 0 1 1 0 30 A30 30 0 1 1 0 -30';
    return [
      rect({ id: 'btn', w: 560, h: 128, r: 64, fill: 'ink', shadow: 1,
        k: k(IN(0.12, 0.55), press(C, { to: 0.96 }), {
          scale: [[S, S + 0.12, 1.07, 'Power2 Out'], [S + 0.12, S + 0.5, 1, 'Power3 Out']],
          w: [[C + 0.06, C + 0.6, 128, 'Expo Out'], [W, W + 0.65, 500, 'Expo Out']],
          fill: [[S + 0.3, 'acc']] }),
        ch: [
          group({ id: 'idle', k: k(enter(0.3, { d: 0 }), exit(C + 0.02, { dur: 0.12 })), ch: [
            text({ id: 'submitLbl', text: 'Submit order', x: -30, size: 44, weight: 600, ls: -0.02, color: 'inv' }),
            icon({ id: 'submitArrow', icon: 'arrow', x: 150, size: 40, sw: 2.6, color: 'inv' }),
          ] }),
          circle({ id: 'accDisc', d: 128, fill: 'acc', k: { scale: [0.2, [S - 0.02, S + 0.28, 1, 'Power3 Out']], opacity: [0, [S - 0.02, S + 0.06, 1, 'Linear'], [S + 0.32, 0]] } }),
          path({ id: 'spinner', d: RING, stroke: 'inv', sw: 6, trimmed: true, k: {
            opacity: [0, [C + 0.3, C + 0.45, 1, 'Power2 Out'], [S - 0.02, S + 0.14, 0, 'Power2 In']],
            trimE: [8, [C + 0.3, C + 0.9, 70, 'Power3 Out'], [S - 0.3, S - 0.02, 100, 'Power2 Out']],
            rot: [[C + 0.3, S, 560, 'Linear']],
            scale: [[S - 0.02, S + 0.16, 1.9, 'Power2 Out']] } }),
          path({ id: 'check', d: 'M-17 1 L-6 12 L17 -12', stroke: '#FFFFFF', sw: 7, trimmed: true,
            k: { trimE: [0, [S + 0.12, S + 0.45, 100, 'Power3 Out']], x: [[W, W + 0.65, -142, 'Expo Out']] } }),
          text({ id: 'doneLbl', text: 'Order placed', x: -106, ax: 0, size: 44, weight: 600, ls: -0.02, color: '#FFFFFF', k: enter(W + 0.15, { dx: -14, x0: -106 }) }),
        ] }),
      cursorLayer([[0, 380, 210], [0.4, 380, 210], [C - 0.1, 70, 20], [C + 0.2, 70, 20], [C + 0.8, 230, 150]], [C], [], { inAt: 0.35 }),
    ];
  },
});

// 7 ─ Like: heart pops filled accent, the pill tints, the count rolls 128 → 129
UIK.define({
  id: 'like-button', name: 'Like', cat: 'controls', T: 3.0, cam: 1.7,
  desc: 'On a post card the cursor taps Like: the outline heart shrinks away as a filled accent heart pops in with a clean scale overshoot, the pill tints and the count rolls from 128 to 129.',
  build: () => {
    const C = 1.55, FY = 104, LX = -250;
    return [
      rect({ id: 'card', w: 760, h: 380, r: 40, fill: 'card', shadow: 1, k: IN(0.1), ch: [
        circle({ id: 'avatar', x: -306, y: -100, d: 76, fill: 'soft', k: pop(0.22, { from: 0.6 }), ch: [icon({ id: 'avatarIcon', icon: 'user', size: 36, sw: 2.6, color: 'muted' })] }),
        text({ id: 'name', text: 'Lena Park', x: -252, y: -118, ax: 0, size: 32, weight: 600, k: enter(0.26, { dx: -14, x0: -252 }) }),
        text({ id: 'meta', text: '2h · Shared a draft', x: -252, y: -80, ax: 0, size: 24, color: 'muted', k: enter(0.32) }),
        rect({ id: 'line0', x: -344, y: -12, pin: 'l', w: 688, h: 18, r: 9, fill: 'skel', k: enter(0.36, { blur: 0, dx: -12, x0: -344 }) }),
        rect({ id: 'line1', x: -344, y: 22, pin: 'l', w: 470, h: 18, r: 9, fill: 'skel', k: enter(0.42, { blur: 0, dx: -12, x0: -344 }) }),
        rect({ id: 'likePill', x: LX, y: FY, w: 184, h: 84, r: 42, fill: 'soft', k: k(enter(0.48), press(C, { to: 0.93 }), { fill: [[C + 0.06, C + 0.4, 'acc/12', 'Power2 Out']] }), ch: [
          icon({ id: 'heartLine', icon: 'heart', x: -37, size: 40, sw: 2.6, k: { scale: [[C, C + 0.12, 0.6, 'Power2 In']], opacity: [[C, C + 0.12, 0, 'Linear']] } }),
          icon({ id: 'heartFill', icon: 'heart', x: -37, size: 40, sw: 2.6, color: 'acc', filled: true, fill: 'acc',
            k: { scale: [0.4, [C + 0.06, C + 0.24, 1.24, 'Power2 Out'], [C + 0.24, C + 0.62, 1, 'Power3 Out']], opacity: [0, [C + 0.06, C + 0.14, 1, 'Linear']] } }),
          text({ id: 'countHead', text: '12', x: -3, ax: 0, size: 32, weight: 600 }),
          roll({ id: 'countUnit', x: 46, w: 22, h: 44, vals: ['8', '9'], ts: [C + 0.1], size: 32, weight: 600 }),
        ] }),
        rect({ id: 'commentPill', x: -67, y: FY, w: 150, h: 84, r: 42, fill: 'soft', k: enter(0.54), ch: [
          icon({ id: 'commentIcon', icon: 'message', x: -24, size: 36, sw: 2.6 }),
          text({ id: 'commentCount', text: '24', x: 4, ax: 0, size: 32, weight: 600 }),
        ] }),
        icon({ id: 'sendIcon', icon: 'send', x: 246, y: FY, size: 38, sw: 2.6, k: enter(0.58) }),
        icon({ id: 'saveIcon', icon: 'bookmark', x: 318, y: FY, size: 38, sw: 2.6, k: enter(0.62) }),
      ] }),
      cursorLayer([[0, 430, 280], [0.6, 430, 280], [C - 0.1, LX - 32, FY + 10], [C + 0.3, LX - 32, FY + 10], [C + 0.9, 200, 272]], [C], [], { inAt: 0.55 }),
    ];
  },
});

// 8 ─ Star rating: the cursor sweeps, stars fill accent one by one, a click commits and the label swaps
UIK.define({
  id: 'star-rating', name: 'Star rating', cat: 'controls', T: 3.4, cam: 1.55,
  desc: 'The cursor sweeps across five outline stars: each one it reaches pops filled in accent, up to four. A click on the fourth commits the rating and the hint swaps to "Great".',
  build: () => {
    const SX = [-240, -120, 0, 120, 240], SY = 12, S0 = 1.0, S1 = 1.95, C = 2.1, CX0 = -350, CX1 = 126;
    const fillT = SX.slice(0, 4).map((x) => cross(S0, S1, CX0, CX1, x - 26));
    return [
      rect({ id: 'card', w: 860, h: 400, r: 44, fill: 'card', shadow: 1, k: IN(0.1), ch: [
        text({ id: 'title', text: 'How was your stay?', y: -112, size: 46, weight: 600, ls: -0.02, k: enter(0.22) }),
        ...SX.map((x, i) => group({ id: 'star' + i, x, y: SY, k: k(enter(0.3 + i * 0.05, { dy: 14, y0: SY }), i === 3 ? press(C, { to: 0.9 }) : null), ch: [
          icon({ id: 'starLine' + i, icon: 'star', size: 88, sw: 3.2, color: 'dim' }),
          ...(i < 4 ? [icon({ id: 'starFill' + i, icon: 'star', size: 88, sw: 3.2, color: 'acc', filled: true, fill: 'acc', k: pop(fillT[i], { from: 0.3, dur: 0.4 }) })] : []),
        ] })),
        text({ id: 'hint', text: 'Tap to rate', y: 128, size: 30, color: 'muted', k: k(enter(0.5), exit(C + 0.02)) }),
        text({ id: 'verdict', text: 'Great', y: 128, size: 34, weight: 600, k: enter(C + 0.04, { dy: 10, y0: 128 }) }),
      ] }),
      cursorLayer([[0, -420, 300], [0.5, -420, 300], [S0, CX0, SY + 14], [S1, CX1, SY + 14], [C + 0.3, CX1, SY + 14], [C + 0.9, 360, 284]], [C], [], { inAt: 0.45 }),
    ];
  },
});

// 9 ─ Select menu: the menu grows open from the field, a highlight glides with the cursor, the pick lands in the field
UIK.define({
  id: 'dropdown', name: 'Select menu', cat: 'controls', T: 4.0,
  cam: { zoom: 1.9, y: -190, k: { zoom: [[0.95, 1.55, 1.5, 'Power2 Smooth'], [2.8, 3.45, 1.9, 'Power2 Smooth']], y: [[0.95, 1.55, 0, 'Power2 Smooth'], [2.8, 3.45, -190, 'Power2 Smooth']] } },
  desc: 'A click opens the menu: it grows down from the field while the camera eases out, a highlight row glides after the cursor, and the chosen plan lands in the field as the menu folds away and the chevron turns back.',
  build: () => {
    const FY = -180, C1 = 1.0, O = 1.1, C2 = 2.5, X = 2.72, MT = FY + 52 + 14, MH = 376, EZ = 'Power4 Out';
    const RY = [56, 144, 232, 320];   // row centres, measured down from the menu's top edge
    const opts = [['Starter', 'Free'], ['Plus', '$12/mo'], ['Pro', '$24/mo'], ['Team', '$48/mo']];
    const P0 = 1.62, P1 = 2.32, cy = (i) => MT + RY[i] + 8;
    const h1 = cross(P0, P1, cy(0), cy(2), MT + 100, 'Sine Smooth'), h2 = cross(P0, P1, cy(0), cy(2), MT + 188, 'Sine Smooth');
    const glide = (t, to) => ({ y: [[t, t + 0.3, to, 'Power4 Out']], h: [[t, t + 0.1, 96, 'Power2 Out'], [t + 0.1, t + 0.34, 80, 'Power3 Out']] });
    return [
      text({ id: 'fieldLbl', text: 'Plan', x: -320, y: FY - 84, ax: 0, size: 26, weight: 500, color: 'muted', k: enter(0.2) }),
      rect({ id: 'field', y: FY, w: 640, h: 104, r: 26, fill: 'card', shadow: 1, k: k(IN(0.1), press(C1, { to: 0.98 })), ch: [
        rect({ id: 'focus', w: 640, h: 104, r: 26, stroke: 'ink', sw: 2.5, k: { opacity: [0, [C1, C1 + 0.2, 1, 'Power2 Out'], [X + 0.1, X + 0.4, 0, 'Power2 Out']] } }),
        text({ id: 'placeholder', text: 'Choose a plan', x: -284, ax: 0, size: 34, color: 'muted', k: k(enter(0.28), exit(X + 0.05)) }),
        text({ id: 'valName', text: 'Pro', x: -284, ax: 0, size: 34, weight: 600, k: enter(X + 0.1, { dx: -12, x0: -284 }) }),
        text({ id: 'valPrice', text: '$24 / month', x: -212, ax: 0, size: 30, color: 'muted', k: enter(X + 0.16) }),
        icon({ id: 'chevron', icon: 'chevronDown', x: 272, size: 36, sw: 2.6, k: k(enter(0.3), { rot: [[C1, C1 + 0.4, 180, 'Power3 Out'], [X, X + 0.4, 0, 'Power3 Out']] }) }),
      ] }),
      rect({ id: 'menu', y: MT, pin: 't', w: 640, h: 0, r: 26, fill: 'card', shadow: 2, clip: true, k: {
        h: [[O, O + 0.5, MH, EZ], [X, X + 0.32, 0, 'Power3 Out']],
        opacity: [0, [O, O + 0.1, 1, 'Linear'], [X + 0.18, X + 0.32, 0, 'Linear']] }, ch: [
        group({ id: 'menuBody', k: { y: [0, [O, O + 0.5, -MH / 2, EZ], [X, X + 0.32, 0, 'Power3 Out']] }, ch: [
          rect({ id: 'highlight', y: RY[0], w: 616, h: 80, r: 18, fill: 'soft',
            k: k({ opacity: [0, [P0 - 0.14, P0 + 0.04, 1, 'Power2 Out']] }, glide(h1, RY[1]), glide(h2, RY[2]), press(C2, { to: 0.97 })) }),
          ...opts.map(([t, p], i) => group({ id: 'opt' + i, y: RY[i], k: enter(O + 0.02 + i * 0.045, { dy: -10, y0: RY[i], blur: 6 }), ch: [
            text({ id: 'optName' + i, text: t, x: -244, ax: 0, size: 32, weight: 500 }),
            text({ id: 'optPrice' + i, text: p, x: 284, ax: 1, size: 28, color: 'muted' }),
            ...(i === 2 ? [icon({ id: 'selCheck', icon: 'check', x: -280, size: 30, sw: 3, color: 'acc', k: pop(C2 + 0.04) })] : []),
          ] })),
        ] }),
      ] }),
      cursorLayer([[0, 380, 40], [0.45, 380, 40], [C1 - 0.1, 120, FY + 8], [C1 + 0.15, 120, FY + 8], [P0, 60, cy(0)], [P1, 80, cy(2)], [C2 + 0.2, 80, cy(2)], [C2 + 0.8, 380, 30]],
        [C1, C2], [], { inAt: 0.4 }),
    ];
  },
});

// 10 ─ Tabs: a liquid underline (leading edge first) and panels that swap with a blur
UIK.define({
  id: 'tabs-underline', formats: ['html'], name: 'Tabs', cat: 'controls', T: 3.7, cam: 1.3,
  desc: 'Two tab clicks: the underline stretches toward the new tab with its leading edge first and the trailing edge catching up, labels recolour, and each panel blurs out as a different skeleton layout staggers in.',
  build: () => {
    const TY = -218, UY = -174, C1 = 1.15, C2 = 2.4;
    const L = [-440, -246.4, -78.8], W = [137.6, 111.6, 124.1], R = L.map((l, i) => l + W[i]), NAMES = ['Overview', 'Activity', 'Settings'];
    const col = [['ink', [C1, C1 + 0.25, 'muted', 'Power2 Out']], ['muted', [C2, C2 + 0.25, 'ink', 'Power2 Out']], ['muted', [C1, C1 + 0.25, 'ink', 'Power2 Out'], [C2, C2 + 0.25, 'muted', 'Power2 Out']]];
    const bar = (id, x, y, w, h, fill, t, dy = 12) => rect({ id, x, y, pin: 'l', w, h, r: h / 2, fill, k: enter(t, { dy, y0: y, blur: 6 }) });
    // Overview: three stat tiles + a paragraph
    const overview = group({ id: 'panelOverview', k: exit(C1, { dur: 0.16 }), ch: [
      ...[-305, 0, 305].map((x, i) => rect({ id: 'tile' + i, x, y: -44, w: 290, h: 156, r: 24, fill: 'panel', k: enter(0.42 + i * 0.06, { dy: 14, y0: -44 }), ch: [
        rect({ id: 'tileCap' + i, x: -113, y: -40, pin: 'l', w: 96, h: 14, r: 7, fill: 'skel' }),
        rect({ id: 'tileVal' + i, x: -113, y: 4, pin: 'l', w: [150, 118, 136][i], h: 34, r: 10, fill: 'dim' }),
        rect({ id: 'tileFoot' + i, x: -113, y: 46, pin: 'l', w: 64, h: 12, r: 6, fill: 'skel' }),
      ] })),
      ...[900, 880, 800, 520].map((w, i) => bar('para' + i, -450, 86 + i * 42, w, 18, 'skel', 0.6 + i * 0.05)),
    ] });
    // Settings: three rows with a label, a hint and a switch
    const settings = group({ id: 'panelSettings', k: exit(C2, { dur: 0.16 }), ch: [
      ...[-36, 64, 164].map((y, i) => rect({ id: 'setRule' + i, y, w: 900, h: 2, fill: 'line', k: enter(C1 + 0.14 + i * 0.06, { blur: 0, s: 1 }) })),
      ...[0, 1, 2, 3].map((i) => group({ id: 'setRow' + i, y: -86 + i * 100, k: enter(C1 + 0.08 + i * 0.06, { dy: 14, y0: -86 + i * 100 }), ch: [
        rect({ id: 'setName' + i, x: -450, y: -14, pin: 'l', w: [220, 260, 190, 240][i], h: 20, r: 10, fill: 'dim' }),
        rect({ id: 'setHint' + i, x: -450, y: 18, pin: 'l', w: [380, 320, 360, 300][i], h: 14, r: 7, fill: 'skel' }),
        rect({ id: 'setSwitch' + i, x: 404, w: 92, h: 52, r: 26, fill: i === 0 ? 'acc' : 'dim', ch: [circle({ id: 'setKnob' + i, x: i === 0 ? 20 : -20, d: 42, fill: '#FFFFFF', shadow: 3 })] }),
      ] })),
    ] });
    // Activity: a feed of four rows
    const activity = group({ id: 'panelActivity', ch: [
      ...[-42, 54, 150].map((y, i) => rect({ id: 'actRule' + i, y, w: 900, h: 2, fill: 'line', k: enter(C2 + 0.16 + i * 0.05, { blur: 0, s: 1 }) })),
      ...[0, 1, 2, 3].map((i) => group({ id: 'actRow' + i, y: -90 + i * 96, k: enter(C2 + 0.08 + i * 0.06, { dx: -16 }), ch: [
        circle({ id: 'actAvatar' + i, x: -422, d: 56, fill: 'skel' }),
        rect({ id: 'actName' + i, x: -378, y: -12, pin: 'l', w: [300, 240, 330, 270][i], h: 18, r: 9, fill: 'dim' }),
        rect({ id: 'actText' + i, x: -378, y: 16, pin: 'l', w: [200, 260, 180, 220][i], h: 14, r: 7, fill: 'skel' }),
        rect({ id: 'actTime' + i, x: 450, pin: 'r', w: 60, h: 14, r: 7, fill: 'skel' }),
      ] })),
    ] });
    return [
      rect({ id: 'card', w: 1000, h: 580, r: 44, fill: 'card', shadow: 1, k: IN(0.1), ch: [
        ...NAMES.map((s, i) => text({ id: 'tab' + i, text: s, x: L[i], y: TY, ax: 0, size: 32, weight: 500, color: col[i][0], k: k(enter(0.22 + i * 0.05), { color: col[i].slice(1) }) })),
        circle({ id: 'unread', x: R[1] + 14, y: TY - 12, d: 10, fill: 'acc', k: k(pop(0.5), { scale: [[C2 + 0.1, C2 + 0.3, 0, 'Power2 In']] }) }),
        rect({ id: 'tabRule', y: UY, w: 1000, h: 2, fill: 'line', k: enter(0.3, { blur: 0, s: 1 }) }),
        rect({ id: 'underline', x: L[0], y: UY, pin: 'l', w: W[0], h: 4, r: 2, fill: 'ink',
          k: k(enter(0.36, { blur: 0, s: 1 }), edges(C1, L[0], R[0], L[2], R[2]), edges(C2, L[2], R[2], L[1], R[1])) }),
        overview, settings, activity,
      ] }),
      cursorLayer([[0, 560, 340], [0.55, 560, 340], [C1 - 0.1, (L[2] + R[2]) / 2 + 6, TY + 8], [C1 + 0.2, (L[2] + R[2]) / 2 + 6, TY + 8],
        [C2 - 0.1, (L[1] + R[1]) / 2 + 6, TY + 8], [C2 + 0.25, (L[1] + R[1]) / 2 + 6, TY + 8], [C2 + 0.85, 380, 350]], [C1, C2], [], { inAt: 0.5 }),
    ];
  },
});

// 11 ─ Text input: focus ring grows in, the label floats up, the address types in, a check lands
UIK.define({
  id: 'text-input', name: 'Text input', cat: 'controls', T: 3.6, cam: 1.35,
  desc: 'A click focuses the field: a soft ring grows around it, the placeholder floats up into a small label, the address types in behind a caret, then a check pops at the right end and Continue wakes up.',
  build: () => {
    const F = 1.0, T0 = 1.4, T1 = 2.45, V = 2.6, FY = -10, FW = 780, FH = 116, LX = -356;
    return [
      rect({ id: 'card', w: 960, h: 520, r: 44, fill: 'card', shadow: 1, k: IN(0.1), ch: [
        text({ id: 'title', text: 'Create your account', x: -390, y: -182, ax: 0, size: 46, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -390 }) }),
        text({ id: 'sub', text: 'Start with your work email', x: -390, y: -134, ax: 0, size: 28, color: 'muted', k: enter(0.3) }),
        group({ id: 'fieldGrp', y: FY, k: k(enter(0.36, { dy: 14, y0: FY }), press(F, { to: 0.985 })), ch: [
          rect({ id: 'halo', w: FW, h: FH, r: 32, stroke: 'ink/10', sw: 8,
            k: { w: [[F, F + 0.4, FW + 16, 'Power3 Out']], h: [[F, F + 0.4, FH + 16, 'Power3 Out']], opacity: [0, [F, F + 0.2, 1, 'Power2 Out']] } }),
          rect({ id: 'field', w: FW, h: FH, r: 24, fill: 'card', stroke: 'line', sw: 2 }),
          rect({ id: 'focus', w: FW, h: FH, r: 24, stroke: 'ink', sw: 2.5, k: { opacity: [0, [F, F + 0.2, 1, 'Power2 Out']] } }),
          text({ id: 'label', text: 'Email address', x: LX, ax: 0, size: 32, color: 'muted', k: { y: [[F + 0.02, F + 0.36, -26, 'Power3 Out']], scale: [[F + 0.02, F + 0.36, 0.72, 'Power3 Out']] } }),
          text({ id: 'typed', text: 'lena.park@studio.io', x: LX, y: 18, ax: 0, size: 32, weight: 500, caret: true, caretColor: 'acc', caretFrom: F + 0.3, caretUntil: V,
            k: { reveal: [0, [T0, T1, 1, 'Linear']] } }),
          circle({ id: 'okDisc', x: 344, d: 44, fill: 'acc', k: pop(V, { from: 0.4 }), ch: [
            path({ id: 'okTick', d: 'M-9 1 L-3 7 L9 -6', stroke: '#FFFFFF', sw: 4, trimmed: true, k: { trimE: [0, [V + 0.1, V + 0.38, 100, 'Power3 Out']] } }),
          ] }),
        ] }),
        rect({ id: 'btn', y: 160, w: FW, h: 100, r: 50, fill: 'soft', k: k(enter(0.44, { dy: 14, y0: 160 }), { fill: [[V + 0.15, V + 0.45, 'ink', 'Power2 Out']] }), ch: [
          text({ id: 'btnLbl', text: 'Continue', size: 34, weight: 600, color: 'muted', k: { color: [[V + 0.15, V + 0.45, 'inv', 'Power2 Out']] } }),
        ] }),
      ] }),
      cursorLayer([[0, 560, 330], [0.5, 560, 330], [F - 0.1, 150, FY + 6], [F + 0.25, 150, FY + 6], [F + 0.85, 600, 110]], [F], [], { inAt: 0.45 }),
    ];
  },
});

// 12 ─ Verification code: digits land one by one, the focus ring hops right, then every box turns accent
UIK.define({
  id: 'otp-code', name: 'Verification code', cat: 'controls', T: 3.9, cam: 1.3,
  desc: 'A click focuses the first box; six digits land one by one while the ink focus ring hops right, stretching in flight. On the last digit every box flashes to an accent outline in a quick wave and "Verified" replaces the resend line.',
  build: () => {
    const BX = [-352, -224, -96, 96, 224, 352], BY = 26, BW = 112, BH = 136, CL = 0.85;
    const DIG = ['4', '8', '2', '9', '1', '7'], D = DIG.map((_, i) => +(1.2 + i * 0.25 + (i >= 3 ? 0.06 : 0)).toFixed(2)), V = D[5] + 0.3;
    const ringX = [], ringW = [];
    for (let i = 0; i < 5; i++) {
      ringX.push([D[i] + 0.02, D[i] + 0.26, BX[i + 1], 'Power4 Out']);
      ringW.push([D[i] + 0.02, D[i] + 0.1, BW + 30, 'Power2 Out'], [D[i] + 0.1, D[i] + 0.26, BW, 'Power3 Out']);
    }
    return [
      rect({ id: 'card', w: 1000, h: 500, r: 44, fill: 'card', shadow: 1, k: IN(0.1), ch: [
        text({ id: 'title', text: 'Enter the code', y: -160, size: 46, weight: 600, ls: -0.02, k: enter(0.22) }),
        text({ id: 'sub', text: 'We sent six digits to lena@studio.io', y: -112, size: 28, color: 'muted', k: enter(0.3) }),
        rect({ id: 'dash', y: BY, w: 24, h: 4, r: 2, fill: 'dim', k: enter(0.5, { blur: 0 }) }),
        ...BX.map((x, i) => group({ id: 'cell' + i, x, y: BY,
          k: k(enter(0.34 + i * 0.04, { dy: 14, y0: BY }), { scale: [[V + i * 0.04, V + i * 0.04 + 0.12, 1.05, 'Power2 Out'], [V + i * 0.04 + 0.12, V + i * 0.04 + 0.45, 1, 'Power3 Out']] }), ch: [
            rect({ id: 'box' + i, w: BW, h: BH, r: 24, fill: 'panel', stroke: 'line', sw: 2 }),
            rect({ id: 'boxAcc' + i, w: BW, h: BH, r: 24, stroke: 'acc', sw: 3, k: { opacity: [0, [V + i * 0.04, V + i * 0.04 + 0.16, 1, 'Power2 Out']] } }),
            text({ id: 'digit' + i, text: DIG[i], size: 60, weight: 600, k: enter(D[i], { d: 0, dur: 0.2, dy: 16, blur: 6, s: 0.85 }) }),
          ] })),
        rect({ id: 'focusRing', x: BX[0], y: BY, w: BW, h: BH, r: 24, stroke: 'ink', sw: 3,
          k: { x: ringX, w: ringW, opacity: [0, [CL, CL + 0.15, 1, 'Power2 Out'], [V, V + 0.18, 0, 'Power2 Out']], scale: [1.12, [CL, CL + 0.35, 1, 'Power3 Out']] } }),
        text({ id: 'resend', text: 'Didn’t get it? Resend in 0:24', y: 176, size: 28, color: 'muted', k: k(enter(0.5), exit(V + 0.05)) }),
        group({ id: 'verified', y: 176, k: enter(V + 0.15, { dy: 12, y0: 176 }), ch: [
          icon({ id: 'verifiedIcon', icon: 'check', x: -60, size: 34, sw: 3, color: 'acc' }),
          text({ id: 'verifiedLbl', text: 'Verified', x: -34, ax: 0, size: 30, weight: 600 }),
        ] }),
      ] }),
      cursorLayer([[0, 540, 320], [0.4, 540, 320], [CL - 0.1, BX[0] + 10, BY + 16], [CL + 0.15, BX[0] + 10, BY + 16], [CL + 0.7, -300, 330]], [CL], [], { inAt: 0.35 }),
    ];
  },
});

// 13 ─ Filter chips: three chips toggle on, widen for a sliding check, and push their neighbours along
UIK.define({
  id: 'chips-select', name: 'Filter chips', cat: 'controls', T: 3.6, cam: 1.5,
  desc: 'Three clicks toggle chips on: each fills ink and widens while an accent check slides in from its left edge, the chips after it in the row shift over in sync, and the selected count rolls up.',
  build: () => {
    const CH = [['Design', 108.5], ['Motion', 108.5], ['Engineering', 185.6], ['Research', 146.8], ['Writing', 112]];
    const PAD = 36, GAP = 18, ADD = 44, H = 92, X0 = -380, RY = [0, 110], ROW = [0, 0, 0, 1, 1], EZ = 'Power4 Out', D = 0.45;
    const C = [1.0, 1.75, 2.5], SEL = [0, 2, 3];
    const w0 = CH.map(([, tw]) => tw + 2 * PAD);
    const left = []; let cx = X0, row = 0;
    CH.forEach((_, i) => { if (ROW[i] !== row) { row = ROW[i]; cx = X0; } left.push(cx); cx += w0[i] + GAP; });
    const selT = CH.map((_, i) => { const j = SEL.indexOf(i); return j >= 0 ? C[j] : null; });
    const shiftK = (i) => {
      const segs = []; let x = left[i];
      SEL.forEach((s, j) => { if (s < i && ROW[s] === ROW[i]) { x += ADD; segs.push([C[j], C[j] + D, x, EZ]); } });
      return segs.length ? { x: segs } : null;
    };
    const posAt = (i, t) => { let x = left[i]; SEL.forEach((s, j) => { if (s < i && ROW[s] === ROW[i] && C[j] < t) x += ADD; }); return x; };
    const clickXY = (i) => [posAt(i, selT[i]) + w0[i] / 2 + 8, RY[ROW[i]] + 8];
    const chips = CH.map(([name, tw], i) => {
      const t = selT[i];
      return rect({ id: 'chip' + i, x: left[i], y: RY[ROW[i]], pin: 'l', origin: [0, 0], w: w0[i], h: H, r: H / 2, fill: 'soft', clip: true,
        k: k(enter(0.34 + i * 0.05, { dy: 12, y0: RY[ROW[i]] }), shiftK(i), t != null ? { w: [[t, t + D, w0[i] + ADD, EZ]], fill: [[t, t + 0.22, 'ink', 'Power2 Out']] } : null, t != null ? press(t, { to: 0.95 }) : null),
        ch: [
          ...(t != null ? [icon({ id: 'chipCheck' + i, icon: 'check', x: -tw / 2 - 56, size: 30, sw: 3, color: 'acc',
            k: { x: [[t + 0.03, t + D, -tw / 2 - 7, EZ]], opacity: [0, [t + 0.03, t + 0.2, 1, 'Power2 Out']] } })] : []),
          text({ id: 'chipLbl' + i, text: name, size: 34, weight: 500, color: 'ink', k: t != null ? { x: [[t, t + D, ADD / 2, EZ]], color: [[t, t + 0.22, 'inv', 'Power2 Out']] } : null }),
        ] });
    });
    const P = SEL.map(clickXY);
    return [
      rect({ id: 'card', w: 880, h: 440, r: 44, fill: 'card', shadow: 1, k: IN(0.1), ch: [
        text({ id: 'title', text: 'Pick your topics', x: X0, y: -142, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: X0 }) }),
        text({ id: 'sub', text: 'Choose three or more', x: X0, y: -98, ax: 0, size: 26, color: 'muted', k: enter(0.3) }),
        group({ id: 'counter', k: enter(0.3), ch: [
          roll({ id: 'count', x: 253, y: -142, w: 22, h: 40, vals: ['0', '1', '2', '3'], ts: C.map((c) => c + 0.06), size: 28, weight: 600 }),
          text({ id: 'countLbl', text: 'selected', x: 380, y: -142, ax: 1, size: 28, weight: 500, color: 'muted' }),
        ] }),
        group({ id: 'chips', y: 12, ch: chips }),
      ] }),
      cursorLayer([[0, 520, 320], [0.45, 520, 320], [C[0] - 0.1, P[0][0], P[0][1] + 12], [C[0] + 0.2, P[0][0], P[0][1] + 12], [C[1] - 0.1, P[1][0], P[1][1] + 12],
        [C[1] + 0.2, P[1][0], P[1][1] + 12], [C[2] - 0.1, P[2][0], P[2][1] + 12], [C[2] + 0.2, P[2][0], P[2][1] + 12], [C[2] + 0.8, 250, 300]], C, [], { inAt: 0.4 }),
    ];
  },
});

// 14 ─ Accordion: row 2 expands (clip reveal), its chevron turns, row 3 slides down in sync
UIK.define({
  id: 'accordion', name: 'Accordion', cat: 'controls', T: 2.8,
  cam: { zoom: 1.5, k: { zoom: [[1.12, 1.72, 1.36, 'Power2 Smooth']], y: [[1.12, 1.72, 98, 'Power2 Smooth']] } },
  desc: 'The cursor clicks the second question: its body opens with a clip reveal and skeleton lines stagger in, the chevron turns 180°, and the row below and the card edge slide down on the same curve.',
  build: () => {
    const E = 1.1, EZ = 'Power4 Out', DUR = 0.55, TOP = -178, H0 = 356, BODY = 196, RY = [-118, 0, 118], BH = BODY - 8;
    const rows = [['What’s included in Pro?', 'sparkle'], ['How does billing work?', 'coin'], ['Can I cancel anytime?', 'refresh']];
    const head = (i) => [
      rect({ id: 'rowTile' + i, x: -412, w: 64, h: 64, r: 18, fill: 'soft', ch: [icon({ id: 'rowIcon' + i, icon: rows[i][1], size: 30, sw: 2.4 })] }),
      text({ id: 'rowTitle' + i, text: rows[i][0], x: -356, ax: 0, size: 32, weight: 600 }),
      icon({ id: 'chev' + i, icon: 'chevronDown', x: 420, size: 34, sw: 2.6, color: 'muted', k: i === 1 ? { rot: [[E, E + 0.45, 180, 'Power3 Out']], color: [[E, E + 0.3, 'ink', 'Power2 Out']] } : null }),
    ];
    return [
      group({ id: 'accordion', k: IN(0.1), ch: [
        rect({ id: 'card', y: TOP, pin: 't', w: 960, h: H0, r: 36, fill: 'card', shadow: 1, k: { h: [[E, E + DUR, H0 + BODY, EZ]] } }),
        rect({ id: 'hover', y: RY[1], w: 936, h: 104, r: 26, fill: 'panel', k: { opacity: [0, [E - 0.3, E - 0.12, 1, 'Power2 Out'], [E + 0.55, E + 0.85, 0, 'Power2 Out']] } }),
        rect({ id: 'rule0', y: -59, w: 880, h: 2, fill: 'line', k: enter(0.34, { blur: 0, s: 1 }) }),
        group({ id: 'row0', y: RY[0], k: enter(0.26, { dy: 14, y0: RY[0] }), ch: head(0) }),
        group({ id: 'row1', y: RY[1], k: enter(0.34, { dy: 14, y0: RY[1] }), ch: head(1) }),
        rect({ id: 'body', y: RY[1] + 52, pin: 't', w: 880, h: 0, clip: true, k: { h: [[E, E + DUR, BH, EZ]] }, ch: [
          group({ id: 'bodyIn', k: { y: [0, [E, E + DUR, -BH / 2, EZ]] }, ch: [
            ...[780, 740, 520].map((w, i) => rect({ id: 'bodyLine' + i, x: -356, y: 16 + i * 38, pin: 'l', w, h: 18, r: 9, fill: 'skel', k: enter(E + 0.12 + i * 0.06, { dy: 10, y0: 16 + i * 38, blur: 6 }) })),
            rect({ id: 'bodyPill', x: -356, y: 148, pin: 'l', w: 170, h: 48, r: 24, fill: 'soft', k: enter(E + 0.32, { dy: 10, y0: 148, blur: 6 }) }),
          ] }),
        ] }),
        group({ id: 'row2', y: RY[2], k: k(enter(0.42, { dy: 14, y0: RY[2] }), { y: [[E, E + DUR, RY[2] + BODY, EZ]] }), ch: [
          rect({ id: 'rule1', y: -59, w: 880, h: 2, fill: 'line' }),
          ...head(2),
        ] }),
      ] }),
      cursorLayer([[0, 500, 300], [0.5, 500, 300], [E - 0.1, -80, 10], [E + 0.25, -80, 10], [E + 0.85, 560, 290]], [E], [], { inAt: 0.45 }),
    ];
  },
});
})();
