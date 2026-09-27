/* UI Motion Kit — Promos & countdowns: coupons (see SKILL.md). */
(function () {
'use strict';
const { rect, circle, text, path, icon, group, photo, k, enter, exit, pop, popIn, fadeIn, press, cursorLayer, sample, cross, spinner } = UIK.h;

// ── local helpers ──
// an in-place reaction: a quick scale-up that settles (no opacity change)
const bump = (t, to = 1.08) => ({ scale: [[t, t + 0.1, to, 'Power2 Out'], [t + 0.1, t + 0.45, 1, 'Power3 Out']] });
const r1 = (v) => Math.round(v * 10) / 10;
// a ticket perforation: a dotted line across the box at x
const perf = (x, h, o = {}) => path({ id: o.id, x, d: `M0 ${-h / 2} V${h / 2}`, stroke: 'dim', sw: 5, dash: [0.5, 14], k: o.k });
// 24-grid Lucide-style glyphs the icon set lacks
const G = {
  ticket: ['M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z', 'M9 9h.01', 'm15 9-6 6', 'M15 15h.01'],
  scissors: ['M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z', 'M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z', 'M20 4 8.12 15.88', 'M14.47 14.48 20 20', 'M8.12 8.12 12 12'],
  gift: ['M20 12v10H4V12', 'M2 7h20v5H2z', 'M12 22V7', 'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z', 'M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z'],
};

// 1 ─ Scratch-off: the cursor scratches the foil away in four strokes, the prize underneath bumps
(() => {
  const PY = 24, PW = 820, PH = 280, X = 460, BH = 84, CAP = BH / 2, BY = [-105, -35, 35, 105];
  // each stroke turns inside the panel, so ragged foil stays at both edges like a real scratch card
  const SX = [-X, 336, -352, 318], EX = [336, -352, 318, -326];
  const S0 = 1.1, SD = 0.34, GAP = 0.1, E = 'Sine Smooth';
  const ST = BY.map((_, i) => +(S0 + i * (SD + GAP)).toFixed(2)), R = ST[3] + SD;
  UIK.define({
    id: 'coupon-scratch', name: 'Scratch-off coupon', cat: 'promo', T: 3.9, cam: 1.3,
    desc: 'A reward card with a grey foil panel. The cursor presses down and scratches it in four back-and-forth strokes — each foil band wipes away right behind the pointer and ragged bits stay at the edges — uncovering 25% off, which gives a small bump as Use now wakes from dim to ink.',
    build: () => {
      // band i: pinned at the far end, its width shrinks with the cursor's easing so the torn edge
      // follows the pointer; a static pill holds the foil left before the stroke's start point
      const bands = BY.flatMap((y, i) => {
        const d = i % 2 ? -1 : 1, s = SX[i], e = EX[i];
        const main = rect({ id: 'foil' + i, x: d * X, y, pin: d > 0 ? 'r' : 'l', w: X - d * s + CAP, h: BH, r: CAP, fill: 'dim',
          k: { w: [[ST[i], ST[i] + SD, X - d * e, E]] } });
        return i ? [rect({ id: 'foilEdge' + i, x: -d * X, y, pin: d > 0 ? 'l' : 'r', w: X + d * s + CAP, h: BH, r: CAP, fill: 'dim' }), main] : [main];
      });
      const keys = [[0, 560, 380], [0.55, 560, 380], [S0 - 0.08, SX[0], PY + BY[0]]];
      BY.forEach((y, i) => keys.push([ST[i], SX[i], PY + y], [ST[i] + SD, EX[i], PY + y, E]));
      keys.push([R + 0.15, EX[3], PY + BY[3]], [R + 0.8, 560, 330]);
      return [
        rect({ id: 'card', w: 920, h: 600, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, { from: 0.7 }), ch: [
          rect({ id: 'tile', x: -390, y: -218, w: 84, h: 84, r: 24, fill: 'soft', k: enter(0.2, { s: 0.7 }), ch: [icon({ paths: G.ticket, size: 42, sw: 2.4 })] }),
          text({ id: 'title', text: 'Scratch & save', x: -328, y: -236, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.24, { dx: -14, x0: -328 }) }),
          text({ id: 'sub', text: 'A thank-you for order #4821', x: -328, y: -196, ax: 0, size: 24, color: 'muted', k: enter(0.32) }),
          rect({ id: 'panel', y: PY, w: PW, h: PH, r: 28, fill: 'soft', clip: true, k: enter(0.3, { blur: 0, s: 0.97 }), ch: [
            text({ id: 'prize', text: '25% off', y: -22, size: 120, weight: 600, ls: -0.03, color: 'acc', k: bump(R + 0.02) }),
            text({ id: 'prizeSub', text: 'your next order', y: 66, size: 28, color: 'muted' }),
            ...bands,
            group({ id: 'foilLbl', k: exit(ST[0] + 0.06), ch: [
              icon({ icon: 'coin', x: -128, size: 32, sw: 2.4, color: 'ink/60' }),
              text({ text: 'Scratch to reveal', x: -100, ax: 0, size: 28, weight: 600, color: 'ink/60' }),
            ] }),
          ] }),
          text({ id: 'terms', text: 'Valid 7 days · one per order', x: -410, y: 232, ax: 0, size: 24, color: 'muted', k: enter(0.4) }),
          rect({ id: 'useBtn', x: 320, y: 232, w: 180, h: 72, r: 36, fill: 'dim', k: k(fadeIn(0.42), { fill: [[R + 0.1, R + 0.35, 'ink', 'Power2 Out']] }), ch: [
            text({ id: 'useLbl', text: 'Use now', size: 28, weight: 600, color: 'inv' }),
          ] }),
        ] }),
        cursorLayer(keys, [], [[ST[0], R]], { inAt: 0.5 }),
      ];
    },
  });
})();

// 2 ─ Clip-out coupon: scissors cut round the dashed line, the flyer falls away, the coupon lifts out
(() => {
  const W = 800, H = 250, RR = 28, CY = 172, C0 = 0.95, C1 = 2.45, L = C1 + 0.12;
  // the dashed outline as one path, clockwise from the top-left corner's end — the cut follows it
  const OUT = `M${-W / 2 + RR} ${-H / 2} H${W / 2 - RR} A${RR} ${RR} 0 0 1 ${W / 2} ${-H / 2 + RR} V${H / 2 - RR} A${RR} ${RR} 0 0 1 ${W / 2 - RR} ${H / 2} `
    + `H${-W / 2 + RR} A${RR} ${RR} 0 0 1 ${-W / 2} ${H / 2 - RR} V${-H / 2 + RR} A${RR} ${RR} 0 0 1 ${-W / 2 + RR} ${-H / 2} Z`;
  const SW = W - 2 * RR, SH = H - 2 * RR, ARC = (Math.PI / 2) * RR, P = 2 * SW + 2 * SH + 4 * ARC;
  // point + heading at arclength s along the outline (past the end it runs on along the top edge)
  const along = (s) => {
    if (s >= P) return [-W / 2 + RR + (s - P), -H / 2, 360];
    const legs = [[SW, 0], [ARC, 1], [SH, 0], [ARC, 1], [SW, 0], [ARC, 1], [SH, 0], [ARC, 1]];
    const starts = [[-W / 2 + RR, -H / 2], [W / 2 - RR, -H / 2 + RR], [W / 2, -H / 2 + RR], [W / 2 - RR, H / 2 - RR], [W / 2 - RR, H / 2], [-W / 2 + RR, H / 2 - RR], [-W / 2, H / 2 - RR], [-W / 2 + RR, -H / 2 + RR]];
    for (let i = 0; i < 8; i++) {
      const [len, isArc] = legs[i], q = Math.floor(i / 2), head = q * 90;
      if (s > len && i < 7) { s -= len; continue; }
      if (!isArc) { const d = [[1, 0], [0, 1], [-1, 0], [0, -1]][q]; return [starts[i][0] + d[0] * s, starts[i][1] + d[1] * s, head]; }
      const phi = (head - 90) * Math.PI / 180 + s / RR, c = starts[i];
      return [c[0] + RR * Math.cos(phi), c[1] + RR * Math.sin(phi), head + (s / RR) * 180 / Math.PI];
    }
    return [-W / 2 + RR, -H / 2, 360];
  };
  const sAt = (t) => (P * (t - C0)) / (C1 - C0);
  UIK.define({
    id: 'coupon-scissors', name: 'Clip-out coupon', cat: 'promo', T: 4.1,
    cam: { zoom: 1.2, k: { zoom: [[L, L + 0.8, 1.55, 'Power2 Smooth']] } },
    desc: 'A market flyer with a dashed coupon at the bottom. Scissors cut all the way round the dashed line at a steady pace, turning at every corner and snipping as they go while a solid cut line follows them; then the flyer drops away and the cut-out coupon lifts, tilts and settles as the camera closes in and a Saved to wallet chip pops.',
    build: () => {
      const T1 = C1 + 0.12;
      const f = (j) => (t) => along(sAt(t))[j];
      const snips = [];
      for (let t = C0 + 0.04; t < C1 - 0.1; t += 0.25) snips.push([+t.toFixed(3), +(t + 0.1).toFixed(3), 0.7, 'Power2 Out'], [+(t + 0.1).toFixed(3), +(t + 0.24).toFixed(3), 1, 'Power2 Out']);
      return [
        // one parent pops the whole sheet in, so the coupon and its lines scale with the flyer
        group({ id: 'sheet', k: popIn(0.1, { from: 0.7 }), ch: [
          group({ id: 'page', k: { opacity: [[L, L + 0.4, 0, 'Power2 In']], y: [[L, L + 0.5, 60, 'Power2 In']] }, ch: [
            rect({ id: 'flyer', w: 1000, h: 700, r: 36, fill: 'card', shadow: 1 }),
            text({ id: 'title', text: 'Weekend market', x: -440, y: -290, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.22, { dx: -14, x0: -440 }) }),
            text({ id: 'dates', text: 'Flyer · Sat 12 – Sun 13 Oct', x: -440, y: -246, ax: 0, size: 26, color: 'muted', k: enter(0.3) }),
            circle({ id: 'bagTile', x: 400, y: -270, d: 88, fill: 'soft', k: enter(0.3, { s: 0.7 }), ch: [icon({ icon: 'bag', size: 40, sw: 2.4 })] }),
            photo({ id: 'pic', x: -270, y: -110, w: 340, h: 180, r: 22, v: 7, k: enter(0.34, { blur: 0, s: 0.96 }) }),
            text({ id: 'pitch', text: 'Fresh this weekend', x: -60, y: -160, ax: 0, size: 32, weight: 600, k: enter(0.4) }),
            text({ id: 'body', text: 'Local produce, bread and flowers from forty stalls.', x: -60, y: -96, ax: 0, size: 26, color: 'muted', wrap: 480, lh: 1.3, k: enter(0.46) }),
          ] }),
          // the coupon itself: invisible against the flyer until it lifts off with its own shadow
          group({ id: 'piece', y: CY, k: {
              y: [[L, L + 0.75, 0, 'Power3 Out']],
              rot: [[L, L + 0.3, -2.5, 'Power2 Out'], [L + 0.3, L + 0.95, 0, 'Power3 Out']],
              scale: [[L, L + 0.3, 1.03, 'Power2 Out'], [L + 0.3, L + 0.9, 1, 'Power3 Out']],
            }, ch: [
            rect({ id: 'lift', w: W, h: H, r: RR, fill: 'card', shadow: 2, k: { opacity: [0, [L, L + 0.3, 1, 'Power2 Out']] } }),
            rect({ id: 'pieceBg', w: W, h: H, r: RR, fill: 'card', ch: [
              text({ id: 'value', text: '$10 off', x: -350, y: -32, ax: 0, size: 96, weight: 600, ls: -0.03, color: 'acc', k: enter(0.5, { dx: -14, x0: -350 }) }),
              text({ id: 'min', text: 'your weekend shop over $50', x: -348, y: 50, ax: 0, size: 26, color: 'muted', k: enter(0.56) }),
              path({ id: 'divider', x: 140, d: 'M0 -80 V80', stroke: 'line', sw: 2, k: fadeIn(0.58) }),
              text({ id: 'codeCap', text: 'Code', x: 270, y: -52, size: 22, color: 'muted', k: enter(0.6) }),
              text({ id: 'code', text: 'MARKET10', x: 270, y: -10, size: 32, weight: 600, ls: 0.06, k: enter(0.64) }),
              text({ id: 'valid', text: 'Valid till Oct 31', x: 270, y: 40, size: 22, color: 'muted', k: enter(0.68) }),
            ] }),
          ] }),
          // the dashed line and the cut belong to the flyer: painted above the coupon, they go with it
          group({ id: 'lines', y: CY, k: { opacity: [[L - 0.02, L + 0.1, 0, 'Power2 Out']] }, ch: [
            path({ id: 'dashed', d: OUT, stroke: 'muted', sw: 3, dash: [12, 10], cap: 'butt', k: fadeIn(0.5) }),
            path({ id: 'cut', d: OUT, stroke: 'ink', sw: 3, trimmed: true, k: { trimE: [0, [C0, C1, 100, 'Linear']] } }),
          ] }),
          icon({ id: 'scissors', paths: G.scissors, x: -W / 2 + RR, y: CY - H / 2, size: 72, sw: 2.8, color: 'ink',
            k: k(pop(0.62, { from: 0.4 }), {
              x: sample(f(0), C0, T1, { tol: 0.8 }).map((g) => (g[2] = r1(g[2]), g)),
              y: sample((t) => CY + f(1)(t), C0, T1, { tol: 0.8 }).map((g) => (g[2] = r1(g[2]), g)),
              rot: sample(f(2), C0, T1, { tol: 0.5 }),
              sy: snips,
            }, exit(C1 - 0.04, { dur: 0.14 })) }),
        ] }),
        rect({ id: 'saved', y: 186, w: 270, h: 64, r: 32, fill: 'ink', k: pop(L + 0.62, { from: 0.5 }), ch: [
          icon({ icon: 'check', x: -98, size: 26, sw: 3, color: 'inv' }),
          text({ text: 'Saved to wallet', x: -76, ax: 0, size: 26, weight: 600, color: 'inv' }),
        ] }),
      ];
    },
  });
})();

// 3 ─ Coupon fan: three coupons fan out round a pivot, one is picked, lifted and flipped to its terms
(() => {
  const TW = 560, TH = 250, NX = 120, PV = 820, CY = -10, F = 0.55, C = 1.45, FL = 2.0, SWP = FL + 0.2;
  const face = (id, value, cap, ic, o = {}) => rect({ id, y: o.y || 0, w: TW, h: TH, r: 26, fill: 'card', shadow: o.shadow ?? 3, notches: [{ at: NX, r: 22 }], k: o.k, ch: [
    text({ id: id + 'Val', text: value, x: -240, y: -30, ax: 0, size: 72, weight: 600, ls: -0.03, color: o.acc ? 'acc' : 'ink' }),
    text({ id: id + 'Cap', text: cap, x: -238, y: 36, ax: 0, size: 24, color: 'muted' }),
    perf(NX, 180),
    circle({ id: id + 'Tile', x: 200, d: 76, fill: 'soft', ch: [icon({ icon: ic.icon, paths: ic.paths, size: 36, sw: 2.4 })] }),
  ] });
  UIK.define({
    id: 'coupon-fan', name: 'Coupon fan', cat: 'promo', T: 3.9,
    cam: { zoom: 1.24, k: { zoom: [[C + 0.05, C + 0.75, 1.6, 'Power2 Smooth']], y: [[C + 0.05, C + 0.75, CY - 24, 'Power2 Smooth']] } },
    desc: 'A tidy stack of three coupons fans out round a pivot below it. The cursor clicks the top one: the other two fold back and sink away while it lifts and the camera closes in, then it flips over (scale X 1 → 0 → 1) to its dark back with the terms and its code.',
    build: () => {
      const side = (id, a0, a1, value, cap, ic) => group({ id, y: CY + PV, k: {
          rot: [a0, [F, F + 0.6, a1, 'Power4 Out'], [C + 0.05, C + 0.5, a0 * 2, 'Power3 Out']],
          y: [[C + 0.05, C + 0.55, CY + PV + 150, 'Power3 Out']],
          opacity: [[C + 0.06, C + 0.3, 0, 'Power2 Out']] }, ch: [face(id + 'Face', value, cap, ic, { y: -PV })] });
      return [
        group({ id: 'fan', k: popIn(0.1, { from: 0.7 }), ch: [
          side('left', -2, -17, '10% off', 'Bags · all week', { icon: 'bag' }),
          side('right', 2, 17, '$5 off', 'Orders over $40', { icon: 'coin' }),
          group({ id: 'pick', y: CY, k: {
              y: [[C + 0.05, C + 0.55, CY - 24, 'Power3 Out']],
              scale: [[C - 0.07, C, 0.97, 'Power2 Out'], [C + 0.02, C + 0.5, 1.04, 'Power3 Out'], [FL - 0.04, SWP, 1.1, 'Power2 Out'], [SWP, FL + 0.6, 1.04, 'Power3 Out']],
              sx: [[FL, SWP, 0, 'Power2 In'], [SWP, FL + 0.55, 1, 'Power3 Out']] }, ch: [
            rect({ id: 'lift', w: TW, h: TH, r: 26, fill: 'card', shadow: 2, notches: [{ at: NX, r: 22 }], k: { opacity: [0, [C, C + 0.3, 1, 'Power2 Out'], [SWP, 0]] } }),
            face('front', '15% off', 'Shoes · ends Sunday', { paths: G.ticket }, { acc: true, k: { opacity: [[SWP, 0]] } }),
            // the back: the perforation and the bites mirror, as on a real ticket
            rect({ id: 'back', w: TW, h: TH, r: 26, fill: 'ink', shadow: 2, notches: [{ at: -NX, r: 22 }], k: { opacity: [0, [SWP, 1]] }, ch: [
              path({ x: -NX, d: 'M0 -90 V90', stroke: 'inv/30', sw: 5, dash: [0.5, 14] }),
              text({ id: 'codeCap', text: 'Code', x: -200, y: -22, size: 20, weight: 500, color: 'inv/60', k: enter(SWP + 0.08) }),
              text({ id: 'code', text: 'SHOE15', x: -200, y: 14, size: 28, weight: 600, color: 'inv', k: enter(SWP + 0.12) }),
              text({ id: 'termsCap', text: 'Terms', x: -84, y: -74, ax: 0, size: 22, weight: 600, color: 'inv/60', k: enter(SWP + 0.1) }),
              text({ id: 'minSpend', text: 'Min. spend $60', x: -84, y: -30, ax: 0, size: 32, weight: 600, color: 'inv', k: enter(SWP + 0.16, { dx: -12, x0: -84 }) }),
              text({ id: 'ends', text: 'Ends Sunday, 11:59 pm', x: -84, y: 22, ax: 0, size: 24, color: 'inv/70', k: enter(SWP + 0.22) }),
              text({ id: 'once', text: 'One use per customer', x: -84, y: 60, ax: 0, size: 24, color: 'inv/70', k: enter(SWP + 0.28) }),
            ] }),
          ] }),
        ] }),
        cursorLayer([[0, 560, 380], [0.95, 560, 380], [C - 0.1, -150, CY + 20], [C + 0.2, -150, CY + 20], [C + 0.8, 390, 180]], [C], [], { inAt: 0.9 }),
      ];
    },
  });
})();

// 4 ─ Coupon drag: a coupon is dragged from the wallet onto the order, docks in the slot, the total rolls down
(() => {
  const WX = -300, SX = 300, RY = [-95, 41, 177], TW = 460, TH = 118, NX = 120, SY = -2, G0 = 1.2, D0 = 1.26, D1 = 2.06;
  const GX = -130, GY = 8;   // where the cursor holds the coupon, from its centre
  const ticket = (id, value, cap, o = {}) => rect({ id, w: TW, h: TH, r: 24, fill: 'card', shadow: o.shadow ?? 3, notches: [{ at: NX, r: 18 }], k: o.k, ch: [
    text({ id: id + 'Val', text: value, x: -196, y: -16, ax: 0, size: 36, weight: 600, ls: -0.02 }),
    text({ id: id + 'Cap', text: cap, x: -196, y: 24, ax: 0, size: 22, color: 'muted' }),
    perf(NX, 84),
    ...(o.stub || [circle({ x: 175, d: 48, fill: 'soft', ch: [icon({ icon: 'plus', size: 24, sw: 2.4, color: 'muted' })] })]),
  ] });
  UIK.define({
    id: 'coupon-drag', name: 'Apply by drag', cat: 'promo', T: 3.8, cam: 1.15,
    desc: 'A coupon wallet beside an order summary. The cursor lifts the 20% off coupon (it tilts and gains a deeper shadow) and drags it into the dashed slot, which darkens as it arrives; the coupon docks, its plus turns into a check, the rest of the wallet closes the gap and the total (a COUNTER placeholder) rolls down from $80 to $64.',
    build: () => [
      rect({ id: 'wallet', x: WX, w: 520, h: 620, r: 40, fill: 'panel', shadow: 1, k: popIn(0.1, { from: 0.7 }), ch: [
        text({ id: 'wTitle', text: 'My coupons', x: -220, y: -250, ax: 0, size: 36, weight: 600, ls: -0.02, k: enter(0.22, { dx: -14, x0: -220 }) }),
        text({ id: 'wSub', text: 'Drag one onto your order', x: -220, y: -210, ax: 0, size: 24, color: 'muted', k: enter(0.3) }),
        group({ id: 'row1', y: RY[1], k: k(enter(0.42, { dy: 14, y0: RY[1] }), { y: [[D0 + 0.3, D0 + 0.8, RY[0], 'Power3 Out']] }), ch: [ticket('t1', '$5 off', 'Orders over $40')] }),
        group({ id: 'row2', y: RY[2], k: k(enter(0.5, { dy: 14, y0: RY[2] }), { y: [[D0 + 0.38, D0 + 0.88, RY[1], 'Power3 Out']] }), ch: [ticket('t2', 'Free delivery', 'Next 3 orders')] }),
      ] }),
      rect({ id: 'summary', x: SX, w: 540, h: 620, r: 40, fill: 'card', shadow: 1, k: popIn(0.16, { from: 0.7 }), ch: [
        text({ id: 'sTitle', text: 'Order summary', x: -230, y: -250, ax: 0, size: 36, weight: 600, ls: -0.02, k: enter(0.28, { dx: -14, x0: -230 }) }),
        text({ id: 'subLbl', text: 'Subtotal', x: -230, y: -176, ax: 0, size: 26, color: 'muted', k: enter(0.36) }),
        text({ id: 'subVal', text: '$80.00', x: 230, y: -176, ax: 1, size: 26, weight: 500, k: enter(0.38) }),
        text({ id: 'shipLbl', text: 'Shipping', x: -230, y: -128, ax: 0, size: 26, color: 'muted', k: enter(0.4) }),
        text({ id: 'shipVal', text: 'Free', x: 230, y: -128, ax: 1, size: 26, weight: 500, k: enter(0.42) }),
        rect({ id: 'slot', y: SY, w: TW + 16, h: TH + 16, r: 30, fill: 'soft', stroke: 'dim', sw: 3, dash: true,
          k: k(fadeIn(0.46), { stroke: [[D1 - 0.3, D1 - 0.1, 'ink', 'Power2 Out']], opacity: [[D1 + 0.08, D1 + 0.3, 0, 'Power2 Out']] }), ch: [
            group({ id: 'slotLbl', k: exit(D1 - 0.32), ch: [
              icon({ paths: G.ticket, x: -126, size: 30, sw: 2.4, color: 'muted' }),
              text({ text: 'Drop a coupon here', x: -100, ax: 0, size: 24, color: 'muted' }),
            ] }),
          ] }),
        rect({ id: 'rule', y: 110, w: 460, h: 2, fill: 'line', k: fadeIn(0.5) }),
        text({ id: 'totalLbl', text: 'Total', x: -230, y: 172, ax: 0, size: 34, weight: 600, ls: -0.02, k: enter(0.52) }),
        group({ id: 'totalG', y: 172, k: enter(0.54), ch: [
          // ONE text: a COUNTER placeholder — the tens roll 8 → 6, the ones 0 → 4
          text({ id: 'total', text: '$' + `{{{COUNTER:80-64; start=${(D1 + 0.24).toFixed(2)}; duration=0.8; turns=0; cascade=30}}}` + '.00', x: 230, ax: 1, size: 40, weight: 600, ls: -0.02 }),
        ] }),
        text({ id: 'saving', text: 'You save $16.00', x: 230, y: 222, ax: 1, size: 24, weight: 600, color: 'acc', k: enter(D1 + 0.8, { dy: -10, y0: 222 }) }),
      ] }),
      // the dragged coupon rides above both cards; its root copies the wallet's pop so it enters with it
      group({ id: 'dragRoot', x: WX, k: popIn(0.1, { from: 0.7 }), ch: [
        group({ id: 'drag', y: RY[0], k: k(enter(0.34, { dy: 14, y0: RY[0] }), {
            x: [[D0, D1, SX - WX, 'Power2 Smooth']], y: [[D0, D1, SY, 'Power2 Smooth']],
            rot: [[G0, G0 + 0.25, 3, 'Power3 Out'], [D1 - 0.06, D1 + 0.3, 0, 'Power3 Out']],
            scale: [[G0, G0 + 0.25, 1.04, 'Power3 Out'], [D1 - 0.06, D1 + 0.3, 1, 'Power3 Out']] }), ch: [
          rect({ id: 'dragLift', w: TW, h: TH, r: 24, fill: 'card', shadow: 2, notches: [{ at: NX, r: 18 }], k: { opacity: [0, [G0, G0 + 0.2, 1, 'Power2 Out'], [D1, D1 + 0.3, 0, 'Power2 Out']] } }),
          ticket('t0', '20% off', 'Sitewide · ends Sun', { stub: [
            circle({ id: 'plusDisc', x: 175, d: 48, fill: 'soft', k: exit(D1 + 0.06), ch: [icon({ icon: 'plus', size: 24, sw: 2.4, color: 'muted' })] }),
            circle({ id: 'okDisc', x: 175, d: 48, fill: 'ink', k: pop(D1 + 0.1, { from: 0.4 }), ch: [icon({ icon: 'check', size: 24, sw: 3, color: 'inv' })] }),
          ] }),
        ] }),
      ] }),
      cursorLayer([[0, 620, 400], [0.6, 620, 400], [G0 - 0.1, WX + GX, RY[0] + GY], [D0, WX + GX, RY[0] + GY],
        [D1, SX + GX, SY + GY, 'Power2 Smooth'], [D1 + 0.25, SX + GX, SY + GY], [D1 + 0.9, 560, 380]], [], [[G0, D1]], { inAt: 0.55 }),
    ],
  });
})();

// 5 ─ Prize wheel: Spin is clicked, the wheel winds back and spins down onto 20% off, the coupon rises
(() => {
  const R = 290, WY = 20, C = 1.0, S0 = C + 0.18, L = C + 2.2, WIN = 2, ROT = 990 + 8;
  const LBL = ['10%', '5%', '20%', '15%', '30%', '5%', '25%', '10%'];
  const deg = (a) => (a * Math.PI) / 180;
  const wedge = (i, fill) => {
    const a0 = deg(-90 + 45 * i - 22.5), a1 = deg(-90 + 45 * i + 22.5);
    return `M0 0 L${r1(R * Math.cos(a0))} ${r1(R * Math.sin(a0))} A${R} ${R} 0 0 1 ${r1(R * Math.cos(a1))} ${r1(R * Math.sin(a1))} Z`;
  };
  const label = (i, color, o = {}) => {
    const a = -90 + 45 * i;
    return text({ id: o.id, text: LBL[i], x: r1(206 * Math.cos(deg(a))), y: r1(206 * Math.sin(deg(a))), rot: a + 90, size: 36, weight: 600, ls: -0.02, color });
  };
  UIK.define({
    id: 'coupon-wheel', name: 'Prize wheel', cat: 'promo', T: 4.5, cam: 1.3,
    desc: 'A prize wheel of eight discounts. The cursor clicks Spin: the wheel winds back a little, then spins three turns and slows (Power4 Out) while the pointer ticks against the last few slices. It lands on 20% off, the slice lights up in the accent, the wheel shrinks up out of the way and the won coupon rises in below it.',
    build: () => {
      // the last pointer ticks: when a slice edge (every 45°, offset 22.5°) passes the pointer
      const ticks = [];
      for (let v = ROT - ((ROT - 22.5) % 45); v > 0; v -= 45) {
        const t = cross(S0, L, -10, ROT, v, 'Power4 Out');
        if (ticks.length && ticks[ticks.length - 1] - t < 0.24) break;
        ticks.push(t);
        if (ticks.length >= 5) break;
      }
      const tick = ticks.reverse().flatMap((t) => [[t, t + 0.05, -16, 'Power2 Out'], [t + 0.05, t + 0.24, 0, 'Power3 Out']]);
      const Z = L + 0.35;
      return [
        group({ id: 'wheelG', y: WY, k: k(popIn(0.1, { from: 0.7 }), { scale: [[Z, Z + 0.6, 0.52, 'Power3 Out']], y: [[Z, Z + 0.6, -145, 'Power3 Out']] }), ch: [
          circle({ id: 'base', d: 2 * R + 40, fill: 'card', shadow: 1 }),
          group({ id: 'spin', k: { rot: [[C + 0.02, S0, -10, 'Power2 Out'], [S0, L, ROT, 'Power4 Out']] }, ch: [
            ...LBL.map((_, i) => path({ id: 'slice' + i, d: wedge(i), fill: i % 2 ? 'soft' : 'ink' })),
            // the won slice fills with the accent from the hub outwards (a fade over ink would pass through brown)
            path({ id: 'winSlice', d: wedge(WIN), fill: 'acc', k: { scale: [0.3, [L + 0.02, L + 0.4, 1, 'Power3 Out']], opacity: [0, [L + 0.02, L + 0.06, 1, 'Linear']] } }),
            ...LBL.map((_, i) => label(i, i % 2 ? 'ink' : 'inv', { id: 'lbl' + i })),
            group({ id: 'winLbl', k: { opacity: [0, [L + 0.14, L + 0.3, 1, 'Power2 Out']] }, ch: [label(WIN, '#FFFFFF')] }),
            ...LBL.map((_, i) => { const a = deg(-90 + 45 * i + 22.5); return circle({ id: 'stud' + i, x: r1((R + 10) * Math.cos(a)), y: r1((R + 10) * Math.sin(a)), d: 10, fill: 'dim' }); }),
          ] }),
          circle({ id: 'hub', d: 150, fill: 'card', shadow: 2, k: press(C), ch: [
            text({ id: 'hubLbl', text: 'Spin', size: 34, weight: 600, ls: -0.02 }),
          ] }),
          group({ id: 'pointer', y: -R - 36, k: { rot: tick }, ch: [
            path({ id: 'pin', d: 'M-22 -6 A22 22 0 0 1 22 -6 L0 44 Z', fill: 'ink' }),
            circle({ id: 'pinDot', y: -4, d: 12, fill: 'card' }),
          ] }),
        ] }),
        rect({ id: 'prize', y: 210, w: 760, h: 220, r: 30, fill: 'card', shadow: 1, notches: [{ at: 210, r: 22 }],
          k: enter(Z + 0.18, { dy: 60, y0: 210, blur: 0, dur: 0.4 }), ch: [
            text({ id: 'won', text: 'You won', x: -330, y: -58, ax: 0, size: 24, color: 'muted' }),
            text({ id: 'wonVal', text: '20% off', x: -334, y: -4, ax: 0, size: 72, weight: 600, ls: -0.03, color: 'acc' }),
            text({ id: 'wonCode', text: 'Code SPIN20 · valid 48 h', x: -330, y: 60, ax: 0, size: 24, color: 'muted' }),
            perf(210, 160),
            rect({ id: 'claim', x: 295, w: 120, h: 60, r: 30, fill: 'ink', ch: [text({ text: 'Claim', size: 26, weight: 600, color: 'inv' })] }),
          ] }),
        cursorLayer([[0, 560, 380], [0.45, 560, 380], [C - 0.1, 20, WY + 18], [C + 0.2, 20, WY + 18], [C + 0.85, 480, 330]], [C], [], { inAt: 0.4 }),
      ];
    },
  });
})();

// 6 ─ Renewed coupon: the date strikes through and the coupon greys out, Renew stamps it back to life
(() => {
  const E = 0.95, C = 1.95, S = C + 0.12, LAND = S + 0.17;
  UIK.define({
    id: 'coupon-renew', name: 'Renewed coupon', cat: 'promo', T: 3.4, cam: 1.35,
    desc: 'A birthday coupon expires: a line strikes through its date, the ticket greys out and an Expired tag pops. The cursor clicks Renew, and an accent RENEWED stamp drops onto the ticket at an angle, squashing as it lands with a small thud; the ticket wakes up, the struck date slides away and the new one drops in.',
    build: () => [
      rect({ id: 'ticket', w: 940, h: 330, r: 32, fill: 'card', shadow: 1, notches: [{ at: -300, r: 26 }],
        k: k(popIn(0.1, { from: 0.7 }), { scale: [[LAND, LAND + 0.07, 0.985, 'Power2 Out'], [LAND + 0.07, LAND + 0.4, 1, 'Power3 Out']] }), ch: [
          perf(-300, 250, { k: fadeIn(0.3) }),
          group({ id: 'faded', k: { opacity: [[E + 0.12, E + 0.42, 0.4, 'Power2 Out'], [LAND, LAND + 0.3, 1, 'Power2 Out']] }, ch: [
            rect({ id: 'giftTile', x: -385, y: -24, w: 92, h: 92, r: 26, fill: 'soft', k: enter(0.2, { s: 0.7 }), ch: [icon({ paths: G.gift, size: 44, sw: 2.4 })] }),
            text({ id: 'stubCap', text: 'Birthday', x: -385, y: 56, size: 22, weight: 500, color: 'muted', k: enter(0.3) }),
            text({ id: 'title', text: 'Free dessert', x: -250, y: -76, ax: 0, size: 56, weight: 600, ls: -0.03, k: enter(0.26, { dx: -14, x0: -250 }) }),
            text({ id: 'sub', text: 'With any main course', x: -250, y: -22, ax: 0, size: 26, color: 'muted', k: enter(0.34) }),
            icon({ id: 'cal', icon: 'calendar', x: -236, y: 58, size: 28, sw: 2.4, k: enter(0.4) }),
            group({ id: 'oldDate', y: 58, k: k(enter(0.42), { y: [[LAND, LAND + 0.3, 72, 'Power2 In']], opacity: [[LAND, LAND + 0.2, 0, 'Power2 In']] }), ch: [
              text({ id: 'oldTxt', text: 'Valid until Sep 30', x: -208, ax: 0, size: 26, weight: 500 }),
              path({ id: 'strike', d: 'M-212 2 H2', stroke: 'bad', sw: 3.5, trimmed: true, k: { trimE: [0, [E, E + 0.3, 100, 'Power3 Out']] } }),
            ] }),
            text({ id: 'newDate', text: 'Valid until Oct 30', x: -208, y: 58, ax: 0, size: 26, weight: 500, k: enter(LAND + 0.14, { dy: -14, y0: 58 }) }),
          ] }),
          rect({ id: 'expired', x: 350, y: -100, w: 136, h: 48, r: 24, fill: 'bad/12', k: k(pop(E + 0.22, { from: 0.5 }), exit(S)), ch: [
            text({ text: 'Expired', size: 22, weight: 600, color: 'bad' }),
          ] }),
          rect({ id: 'renew', x: 330, y: 92, w: 220, h: 76, r: 38, fill: 'ink', k: k(fadeIn(0.44), press(C)), ch: [
            group({ id: 'renewLbl', k: exit(C + 0.04), ch: [
              icon({ icon: 'refresh', x: -60, size: 28, sw: 2.4, color: 'inv' }),
              text({ text: 'Renew', x: -36, ax: 0, size: 28, weight: 600, color: 'inv' }),
            ] }),
            spinner({ id: 'busy', R: 13, sw: 3.5, color: 'inv', t0: C + 0.06, t1: LAND + 0.1, k: k(fadeIn(C + 0.02, 0.1), exit(LAND + 0.02, { dur: 0.1 })) }),
            text({ id: 'useLbl', text: 'Use now', size: 28, weight: 600, color: 'inv', k: enter(LAND + 0.06) }),
          ] }),
          // the stamp: drops from 170 %, squashes on impact, settles at an angle
          group({ id: 'stamp', x: 290, y: -40, rot: -9, k: { scale: [1.7, [S, LAND, 0.94, 'Power2 In'], [LAND, LAND + 0.33, 1, 'Power3 Out']], opacity: [0, [S, S + 0.08, 1, 'Linear']] }, ch: [
            rect({ id: 'stampRing', w: 272, h: 92, r: 16, stroke: 'acc', sw: 5 }),
            text({ id: 'stampTxt', text: 'RENEWED', size: 40, weight: 700, ls: 0.08, color: 'acc' }),
          ] }),
        ] }),
      cursorLayer([[0, 560, 330], [1.2, 560, 330], [C - 0.1, 346, 104], [C + 0.25, 346, 104], [C + 0.9, 560, 330]], [C], [], { inAt: 1.15 }),
    ],
  });
})();
})();
