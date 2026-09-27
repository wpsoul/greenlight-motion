/* UI Motion Kit — commerce elements. */
(function () {
const { rect, circle, ellipse, text, path, icon, group, k, enter, exit, pop, press, cursorLayer, stagger } = UIK.h;

// ── local helpers ──
// the main shape's pop-in from empty (same as the exemplars)
const popIn = (t = 0.1, from = 0.65) => ({ scale: [from, [t, t + 0.52, 1, 'Back Out']], opacity: [0, [t, t + 0.12, 1, 'Linear']] });
// fade-only entry for fields, tracks and hairlines
const fadeIn = (t) => enter(t, { blur: 0, s: 1 });
// a closed circle for Trim Paths, starting at 12 o'clock and running clockwise
const ring = (R) => `M0 -${R} A${R} ${R} 0 1 1 0 ${R} A${R} ${R} 0 1 1 0 -${R}`;
// liquid indicator for a pin 'l' rect: the leading edge travels fast, the trailing edge follows late
const edges = (t, L0, R0, L1, R1, o = {}) => {
  const right = (L1 + R1) > (L0 + R0), fast = o.fast ?? 0.32, slow = o.slow ?? 0.48, lag = o.lag ?? 0.08, n = o.n ?? 10;
  const f = UIK.ease('Power3 Out'), at = (tt, a, b, t0, d) => a + (b - a) * f(Math.min(1, Math.max(0, (tt - t0) / d)));
  const Lf = (tt) => (right ? at(tt, L0, L1, t + lag, slow) : at(tt, L0, L1, t, fast));
  const Rf = (tt) => (right ? at(tt, R0, R1, t, fast) : at(tt, R0, R1, t + lag, slow));
  const end = t + lag + slow, w = [];
  for (let j = 1; j <= n; j++) { const a = t + (end - t) * (j - 1) / n, b = t + (end - t) * j / n; w.push([+a.toFixed(3), +b.toFixed(3), +(Rf(b) - Lf(b)).toFixed(2), 'Linear']); }
  return { x: [right ? [t + lag, t + lag + slow, L1, 'Power3 Out'] : [t, t + fast, L1, 'Power3 Out']], w };
};

// product "photos": token-coloured still lifes, designed in a ~400×320 box around (0, 0)
const floor = (w, y = 128) => ellipse({ y, w, h: 22, fill: 'ink/10' });
const ART = {
  bottle: () => [
    floor(170),
    rect({ y: -104, w: 58, h: 44, r: 12, fill: 'muted' }),
    rect({ y: 16, w: 120, h: 220, r: 38, fill: 'ink' }),
    rect({ y: 30, w: 120, h: 56, fill: 'dim' }),
  ],
  headphones: () => [
    floor(250),
    path({ d: 'M-100 40 V0 A100 100 0 0 1 100 0 V40', stroke: 'ink', sw: 20 }),
    rect({ x: -100, y: 62, w: 66, h: 116, r: 28, fill: 'ink' }),
    rect({ x: 100, y: 62, w: 66, h: 116, r: 28, fill: 'ink' }),
    rect({ x: -62, y: 62, w: 14, h: 80, r: 7, fill: 'muted' }),
    rect({ x: 62, y: 62, w: 14, h: 80, r: 7, fill: 'muted' }),
  ],
};
const art = (kind, s = 1, o = {}) => group(Object.assign({ scale: s, ch: ART[kind]() }, o));
// four views of one mug for the gallery, designed in the 800×580 main tile
const VIEWS = [
  { bg: 'soft', ch: () => [
    ellipse({ y: 166, w: 330, h: 30, fill: 'ink/10' }),
    path({ x: 70, d: 'M0 -58 A64 64 0 0 1 0 70', stroke: 'ink', sw: 28 }),
    rect({ x: -46, y: 20, w: 250, h: 280, r: 44, fill: 'ink' }),
    rect({ x: -46, y: -78, w: 250, h: 24, fill: 'dim' }),
  ] },
  { bg: 'skel', ch: () => [
    rect({ x: 200, w: 110, h: 40, r: 20, fill: 'ink' }),
    circle({ d: 350, fill: 'ink' }),
    circle({ d: 286, fill: 'muted' }),
  ] },
  { bg: 'soft', ch: () => [
    rect({ x: 150, y: 150, w: 720, h: 660, r: 160, fill: 'ink' }),
    rect({ x: 150, y: -90, w: 720, h: 40, fill: 'dim' }),
  ] },
  { bg: 'dim', ch: () => [
    ellipse({ y: 180, w: 500, h: 30, fill: 'ink/12' }),
    path({ x: 214, y: 6, d: 'M0 -44 A50 50 0 0 1 0 56', stroke: 'muted', sw: 22 }),
    rect({ x: 130, y: 10, w: 180, h: 210, r: 32, fill: 'muted' }),
    path({ x: 12, y: 42, d: 'M0 -50 A56 56 0 0 1 0 62', stroke: 'ink', sw: 24 }),
    rect({ x: -96, y: 48, w: 220, h: 250, r: 38, fill: 'ink' }),
  ] },
];
// payment method glyphs drawn as paths at the icon line weight (≈ 36 px icons, 2.4 px strokes)
const GLYPH = {
  card: ['M-15 -11 H15 A3 3 0 0 1 18 -8 V8 A3 3 0 0 1 15 11 H-15 A3 3 0 0 1 -18 8 V-8 A3 3 0 0 1 -15 -11 Z', 'M-18 -3 H18', 'M-11 5 H-4'],
  wallet: ['M-14 -12 H14 A3 3 0 0 1 17 -9 V9 A3 3 0 0 1 14 12 H-14 A3 3 0 0 1 -17 9 V-9 A3 3 0 0 1 -14 -12 Z', 'M17 -4 H9 A4 4 0 0 0 9 4 H17'],
  bank: ['M-17 -6 L0 -15 L17 -6 Z', 'M-11 -2 V9', 'M-4 -2 V9', 'M4 -2 V9', 'M11 -2 V9', 'M-17 14 H17'],
};

// 1 ─ Add to bag: the button morphs to a check, a copy of the product flies into the bag, the badge pops
UIK.define({
  id: 'add-to-cart', name: 'Add to bag', cat: 'commerce', T: 3.2, cam: { zoom: 1.2, x: 20 },
  desc: 'A click on Add to bag: the button contracts into a circle and writes a check, a copy of the product tile lifts off, shrinks and arcs up into the bag icon in the corner, which bumps as its badge pops in with 1.',
  build: () => {
    const C = 1.15, F = C + 1.0, P1 = C + 0.42, CX = -120, CY = 20, TY = -130, BX = 400, BY = -300;
    return [
      rect({ id: 'card', x: CX, y: CY, w: 560, h: 720, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        rect({ id: 'tile', y: TY, w: 480, h: 380, r: 32, fill: 'soft', clip: true, k: enter(0.22, { blur: 0, s: 0.96 }), ch: [art('bottle', 1.05)] }),
        text({ id: 'name', text: 'Everyday Bottle', x: -240, y: 112, ax: 0, size: 38, weight: 600, ls: -0.02, k: enter(0.3, { dx: -16, x0: -240 }) }),
        text({ id: 'price', text: '$32', x: 240, y: 112, ax: 1, size: 38, weight: 600, ls: -0.02, tnum: false, k: enter(0.34) }),
        text({ id: 'variant', text: 'Stone · 750 ml', x: -240, y: 154, ax: 0, size: 26, color: 'muted', k: enter(0.38) }),
        rect({ id: 'btn', y: 280, w: 480, h: 96, r: 48, fill: 'ink', k: k(fadeIn(0.44), press(C), { w: [[C + 0.06, C + 0.6, 96, 'Expo Out']] }), ch: [
          group({ id: 'btnLabel', k: exit(C + 0.02), ch: [
            icon({ icon: 'bag', x: -94, size: 30, color: 'inv', sw: 2.4 }),
            text({ text: 'Add to bag', x: -66, ax: 0, size: 32, weight: 600, color: 'inv' }),
          ] }),
          path({ id: 'tick', d: 'M-16 1 L-5 12 L16 -10', stroke: 'inv', sw: 6, trimmed: true, k: { trimE: [0, [C + 0.3, C + 0.62, 100, 'Power3 Out']] } }),
        ] }),
      ] }),
      // the copy lifts off the tile, arcs up past the bag and drops in behind it (painted under the bag button)
      group({ id: 'flyer', x: CX, y: CY + TY, k: {
          x: [[P1, F, BX, 'Power2 Smooth']],
          y: [[C + 0.1, P1, CY + TY - 70, 'Power3 Out'], [P1, P1 + 0.4, BY - 34, 'Power2 Out'], [P1 + 0.4, F, BY, 'Power2 In']],
          scale: [1, [C + 0.1, P1, 0.44, 'Power3 Out'], [P1, F, 0.12, 'Power2 In']],
          rot: [[P1, P1 + 0.3, -8, 'Power2 Out'], [P1 + 0.3, F, 0, 'Power2 Smooth']],
          opacity: [0, [C + 0.1, 1], [F - 0.1, F, 0, 'Power2 In']],
        }, ch: [rect({ id: 'copy', w: 480, h: 380, r: 32, fill: 'soft', shadow: 2, clip: true, ch: [art('bottle', 1.05)] })] }),
      rect({ id: 'bagBtn', x: BX, y: BY, w: 104, h: 104, r: 32, fill: 'card', shadow: 1,
        k: k(popIn(0.2, 0.6), { scale: [[F, F + 0.1, 1.12, 'Power2 Out'], [F + 0.1, F + 0.45, 1, 'Power3 Out']] }),
        ch: [icon({ id: 'bagIcon', icon: 'bag', size: 48, color: 'ink', sw: 2.4 })] }),
      group({ id: 'badge', x: BX + 40, y: BY - 40, k: pop(F + 0.04, { from: 0.3 }), ch: [
        circle({ id: 'badgeRim', d: 50, fill: 'card' }),
        circle({ id: 'badgeDisc', d: 40, fill: 'acc', ch: [text({ text: '1', size: 24, weight: 600, color: '#FFFFFF', tnum: false })] }),
      ] }),
      cursorLayer([[0, 600, 380], [0.5, 600, 380], [C - 0.1, CX + 24, CY + 292], [C + 0.25, CX + 24, CY + 292], [C + 1.0, 240, 380]], [C], [], { inAt: 0.45 }),
    ];
  },
});

// 2 ─ Cart summary: a promo code types in, Apply, a discount line slides in, the total rolls down
UIK.define({
  id: 'cart-summary', name: 'Cart summary', cat: 'commerce', T: 4.1, cam: { zoom: 1.08, y: 20 },
  desc: 'A bag with two items: the promo field focuses and SAVE25 types in, Apply turns into a check, the card grows as a discount line slides in, and the total (a COUNTER placeholder) rolls its digits down from $164 to $123.',
  build: () => {
    const TOP = -380, H0 = 720, G = 56, F = 1.05, A = 2.05, D = A + 0.18, SZ = 44;
    const rows = [['Everyday Bottle', 'Stone · 750 ml', '$32.00', 'bottle'], ['Studio Headphones', 'Graphite', '$132.00', 'headphones']];
    const RY = [-212, -92];
    return [
      group({ id: 'bag', k: popIn(0.1, 0.7), ch: [
        rect({ id: 'card', y: TOP, pin: 't', w: 900, h: H0, r: 44, fill: 'card', shadow: 1, k: { h: [[D, D + 0.5, H0 + G, 'Power3 Out']] } }),
        text({ id: 'title', text: 'Your bag', x: -400, y: -316, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -400 }) }),
        text({ id: 'count', text: '2 items', x: 400, y: -316, ax: 1, size: 26, color: 'muted', k: enter(0.3) }),
        ...rows.map(([n, v, p, a], i) => group({ id: 'row' + i, y: RY[i], k: enter(0.34 + i * 0.09, { dx: -18, x0: 0 }), ch: [
          rect({ id: 'thumb' + i, x: -348, w: 104, h: 104, r: 24, fill: 'soft', clip: true, ch: [art(a, 0.3)] }),
          text({ id: 'name' + i, text: n, x: -270, y: -18, ax: 0, size: 32, weight: 600, ls: -0.01 }),
          text({ id: 'var' + i, text: v, x: -270, y: 20, ax: 0, size: 24, color: 'muted' }),
          text({ id: 'price' + i, text: p, x: 400, y: -18, ax: 1, size: 30, weight: 600 }),
          text({ id: 'qty' + i, text: 'Qty 1', x: 400, y: 20, ax: 1, size: 24, color: 'muted' }),
        ] })),
        rect({ id: 'rule', y: -20, w: 800, h: 2, fill: 'line', k: fadeIn(0.5) }),
        rect({ id: 'field', x: -100, y: 60, w: 600, h: 88, r: 22, fill: 'card', stroke: 'line', sw: 2,
          k: k(fadeIn(0.52), { stroke: [[F, F + 0.2, 'ink', 'Power2 Out'], [A + 0.1, A + 0.35, 'line', 'Power2 Out']], sw: [[F, F + 0.2, 2.5, 'Power2 Out'], [A + 0.1, A + 0.35, 2, 'Power2 Out']] }), ch: [
            text({ id: 'placeholder', text: 'Promo code', x: -272, ax: 0, size: 28, color: 'muted', k: k(enter(0.56), exit(F + 0.12, { dur: 0.1 })) }),
            text({ id: 'code', text: 'SAVE25', x: -272, ax: 0, size: 28, weight: 600, ls: 0.06, caret: true, caretColor: 'ink', caretFrom: F + 0.1, caretUntil: A,
              k: { reveal: [0, [F + 0.2, F + 0.75, 1, 'Linear']] } }),
          ] }),
        rect({ id: 'apply', x: 310, y: 60, w: 180, h: 88, r: 44, fill: 'ink', k: k(fadeIn(0.56), press(A)), ch: [
          text({ id: 'applyLbl', text: 'Apply', size: 28, weight: 600, color: 'inv', k: exit(A + 0.02) }),
          icon({ id: 'applied', icon: 'check', size: 32, color: 'inv', sw: 3, k: pop(A + 0.08) }),
        ] }),
        text({ id: 'subLbl', text: 'Subtotal', x: -400, y: 150, ax: 0, size: 28, color: 'muted', k: enter(0.6) }),
        text({ id: 'subVal', text: '$164.00', x: 400, y: 150, ax: 1, size: 28, weight: 500, k: enter(0.62) }),
        group({ id: 'discount', y: 150 + G, k: enter(D + 0.1, { dx: -24, x0: 0 }), ch: [
          text({ id: 'discLbl', text: 'Discount · SAVE25', x: -400, ax: 0, size: 28, color: 'muted' }),
          text({ id: 'discVal', text: '−$41.00', x: 400, ax: 1, size: 28, weight: 600, color: 'acc' }),
        ] }),
        group({ id: 'totalBlock', k: { y: [[D, D + 0.5, G, 'Power3 Out']] }, ch: [
          rect({ id: 'rule2', y: 200, w: 800, h: 2, fill: 'line', k: fadeIn(0.64) }),
          text({ id: 'totalLbl', text: 'Total', x: -400, y: 262, ax: 0, size: 36, weight: 600, ls: -0.02, k: enter(0.66) }),
          group({ id: 'totalVal', y: 262, k: enter(0.68), ch: [
            // ONE text: a COUNTER placeholder (Odometer) — the tens roll 6 → 2, the ones 4 → 3
            text({ id: 'total', text: `$\{{{COUNTER:164-123; start=${D + 0.3}; duration=0.75; turns=0; cascade=30}}}.00`, x: 400, ax: 1, size: SZ, weight: 600, ls: -0.02 }),
          ] }),
        ] }),
      ] }),
      cursorLayer([[0, 600, 470], [0.55, 600, 470], [F - 0.1, -170, 72], [F + 0.25, -170, 72], [A - 0.1, 318, 72], [A + 0.3, 318, 72], [A + 1.0, 560, 330]], [F, A], [], { inAt: 0.5 }),
    ];
  },
});

// 3 ─ Checkout steps: each Continue stretches the underline to the next step and swaps the form body
UIK.define({
  id: 'checkout-steps', name: 'Checkout steps', cat: 'commerce', T: 3.9, cam: 1.2,
  desc: 'Continue is clicked twice: the accent underline stretches from Shipping to Payment to Review (leading edge first), the finished step gets a check, and the form body slides out left and blurs while the next one slides in from the right.',
  build: () => {
    const C1 = 1.25, C2 = 2.55, SEG = 860 / 3, L = -430, X = [0, 1, 2].map((i) => L + SEG * (i + 0.5)), BY = -236;
    const NAMES = ['Shipping', 'Payment', 'Review'], HALF = [66, 58, 50];
    const field = (id, x, y, w, s, o = {}) => rect({ id, x, y, w, h: 84, r: 20, fill: 'card', stroke: 'line', sw: 2, ch: [text({ text: s, x: -w / 2 + 28, ax: 0, size: 30, ls: o.ls || 0 })] });
    const lbl = (s, x, y) => text({ text: s, x, y, ax: 0, size: 22, weight: 500, color: 'muted' });
    const out = (t) => k(exit(t + 0.04, { dur: 0.2 }), { x: [[t + 0.04, t + 0.24, -36, 'Power2 In']] });
    const inn = (t) => enter(t + 0.14, { dx: 36, x0: 0 });
    return [
      rect({ id: 'card', w: 960, h: 700, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        ...NAMES.map((s, i) => text({ id: 'step' + i, text: s, x: X[i], y: -276, size: 30, weight: 600, color: i ? 'muted' : 'ink',
          k: k(enter(0.24 + i * 0.06), i ? { color: [[[C1, C2][i - 1] + 0.1, [C1, C2][i - 1] + 0.35, 'ink', 'Power2 Out']] } : null) })),
        ...[0, 1].map((i) => icon({ id: 'done' + i, icon: 'check', x: X[i] - HALF[i] - 24, y: -276, size: 26, color: 'ink', sw: 3, k: pop([C1, C2][i] + 0.12) })),
        rect({ id: 'track', y: BY, w: 860, h: 2, fill: 'line', k: fadeIn(0.34) }),
        rect({ id: 'underline', x: L, y: BY, pin: 'l', w: SEG, h: 4, r: 2, fill: 'acc',
          k: k(fadeIn(0.4), edges(C1 + 0.04, L, L + SEG, L + SEG, L + 2 * SEG), edges(C2 + 0.04, L + SEG, L + 2 * SEG, L + 2 * SEG, L + 3 * SEG)) }),
        group({ id: 'shipping', k: k(enter(0.42, { d: 0 }), out(C1)), ch: [
          text({ text: 'Where should it go?', x: -430, y: -168, ax: 0, size: 40, weight: 600, ls: -0.02 }),
          lbl('Full name', -430, -104), field('fName', 0, -52, 860, 'Ana Reyes'),
          lbl('Address', -430, 26), field('fAddr', 0, 78, 860, '21 Harbour Street, Lisbon'),
        ] }),
        group({ id: 'payment', k: k(inn(C1), out(C2)), ch: [
          text({ text: 'How will you pay?', x: -430, y: -168, ax: 0, size: 40, weight: 600, ls: -0.02 }),
          lbl('Card number', -430, -104), field('fCard', 0, -52, 860, '•••• •••• •••• 4821', { ls: 0.04 }),
          lbl('Expiry', -430, 26), field('fExp', -222, 78, 416, '08 / 28'),
          lbl('CVC', 14, 26), field('fCvc', 222, 78, 416, '•••', { ls: 0.08 }),
        ] }),
        group({ id: 'review', k: inn(C2), ch: [
          text({ text: 'Review your order', x: -430, y: -168, ax: 0, size: 40, weight: 600, ls: -0.02 }),
          text({ text: 'Everyday Bottle', x: -430, y: -96, ax: 0, size: 30 }),
          text({ text: '$32.00', x: 430, y: -96, ax: 1, size: 30, weight: 500 }),
          text({ text: 'Studio Headphones', x: -430, y: -42, ax: 0, size: 30 }),
          text({ text: '$132.00', x: 430, y: -42, ax: 1, size: 30, weight: 500 }),
          text({ text: 'Ships to 21 Harbour St · Card •••• 4821', x: -430, y: 12, ax: 0, size: 24, color: 'muted' }),
          rect({ y: 56, w: 860, h: 2, fill: 'line' }),
          text({ text: 'Total', x: -430, y: 104, ax: 0, size: 34, weight: 600 }),
          text({ text: '$164.00', x: 430, y: 104, ax: 1, size: 34, weight: 600 }),
        ] }),
        group({ id: 'back', k: enter(C1 + 0.2), ch: [
          icon({ icon: 'chevronLeft', x: -418, y: 262, size: 26, color: 'muted', sw: 2.6 }),
          text({ text: 'Back', x: -398, y: 262, ax: 0, size: 28, weight: 500, color: 'muted' }),
        ] }),
        rect({ id: 'continue', x: 285, y: 262, w: 290, h: 88, r: 44, fill: 'ink', k: k(fadeIn(0.5), press(C1), press(C2)), ch: [
          text({ id: 'contLbl', text: 'Continue', size: 30, weight: 600, color: 'inv', k: exit(C2 + 0.1) }),
          text({ id: 'placeLbl', text: 'Place order', size: 30, weight: 600, color: 'inv', k: enter(C2 + 0.1) }),
        ] }),
      ] }),
      cursorLayer([[0, 640, 400], [0.6, 640, 400], [C1 - 0.1, 300, 274], [C1 + 0.3, 300, 274], [C2 - 0.1, 314, 280], [C2 + 0.3, 314, 280], [C2 + 0.95, 450, 370]],
        [C1, C2], [], { inAt: 0.55 }),
    ];
  },
});

// 4 ─ Card flip: the number types into the card, Next flips it (sx 1 → 0 → 1) to the back, the CVV types in
UIK.define({
  id: 'card-flip', name: 'Card flip', cat: 'commerce', T: 4.3, cam: 1.25,
  desc: 'The four number groups type into the card face one after another, replacing their dots. Next is clicked: the card lifts, squeezes to an edge (scale X 1 → 0), swaps to its back face and opens again, then the CVV types into its accent-ringed box.',
  build: () => {
    const TY = [0.7, 1.02, 1.34, 1.66], TD = 0.26, N = 2.3, M = N + 0.08, SW = M + 0.2, CV = M + 0.72, CY = -60;
    const GX = [-320, -148, 24, 196], NUM = ['4821', '0937', '5518', '2046'];
    return [
      group({ id: 'flip', y: CY, k: {
          scale: [0.7, [0.1, 0.62, 1, 'Back Out'], [M - 0.04, SW, 1.05, 'Power2 Out'], [SW, M + 0.6, 1, 'Power3 Out']],
          opacity: [0, [0.1, 0.22, 1, 'Linear']],
          sx: [[M, SW, 0, 'Power2 In'], [SW, M + 0.52, 1, 'Power3 Out']],
          y: [[M - 0.04, SW, CY - 14, 'Power2 Out'], [SW, M + 0.6, CY, 'Power3 Out']],
        }, ch: [
          rect({ id: 'front', w: 760, h: 480, r: 36, fill: 'ink', shadow: 2, k: { opacity: [[SW, 0]] }, ch: [
            rect({ id: 'chip', x: -284, y: -84, w: 92, h: 70, r: 14, fill: 'inv/22', k: enter(0.26, { blur: 0 }) }),
            text({ id: 'brand', text: 'debit', x: 330, y: -176, ax: 1, size: 30, weight: 600, color: 'inv/80', k: enter(0.3) }),
            ...GX.map((x, i) => text({ id: 'dots' + i, text: '••••', x, y: 44, ax: 0, size: 50, ls: 0.06, color: 'inv/30', k: k(enter(0.32 + i * 0.04), exit(TY[i], { dur: 0.08, blur: 0 })) })),
            ...GX.map((x, i) => text({ id: 'group' + i, text: NUM[i], x, y: 44, ax: 0, size: 50, weight: 500, ls: 0.04, color: 'inv', tnum: false,
              caret: true, caretColor: 'inv', caretFrom: TY[i] - 0.02, caretUntil: TY[i] + TD + (i === 3 ? 0.5 : 0.04), k: { reveal: [0, [TY[i], TY[i] + TD, 1, 'Linear']] } })),
            text({ id: 'holder', text: 'Ana Reyes', x: -320, y: 162, ax: 0, size: 28, weight: 500, color: 'inv/70', k: enter(0.4) }),
            text({ id: 'expiry', text: '08/28', x: 330, y: 162, ax: 1, size: 28, weight: 500, color: 'inv/70', k: enter(0.44) }),
          ] }),
          rect({ id: 'back', w: 760, h: 480, r: 36, fill: 'ink', shadow: 2, k: { opacity: [0, [SW, 1]] }, ch: [
            rect({ id: 'strip', y: -132, w: 760, h: 84, fill: 'inv/28' }),
            rect({ id: 'signature', x: -84, y: 24, w: 468, h: 76, r: 12, fill: 'inv/85' }),
            text({ id: 'cvvLbl', text: 'CVV', x: 250, y: -38, size: 22, weight: 600, color: 'inv/60' }),
            rect({ id: 'cvvBox', x: 250, y: 24, w: 150, h: 76, r: 12, fill: 'card', ch: [
              text({ id: 'cvv', text: '382', size: 40, weight: 600, ls: 0.08, tnum: false, caret: true, caretColor: 'ink', caretFrom: M + 0.5, k: { reveal: [0, [CV, CV + 0.36, 1, 'Linear']] } }),
            ] }),
            rect({ id: 'cvvRing', x: 250, y: 24, w: 166, h: 92, r: 18, stroke: 'acc', sw: 3, k: pop(M + 0.46, { from: 0.8, dur: 0.35 }) }),
            text({ id: 'fine', text: 'Not valid unless signed', x: -318, y: 160, ax: 0, size: 22, color: 'inv/45' }),
          ] }),
        ] }),
      text({ id: 'capA', text: 'Card number', x: -380, y: 254, ax: 0, size: 30, weight: 600, k: k(enter(0.36), exit(N + 0.04)) }),
      text({ id: 'capB', text: 'Security code', x: -380, y: 254, ax: 0, size: 30, weight: 600, k: enter(N + 0.04) }),
      text({ id: 'stepA', text: 'Step 1 of 2', x: -380, y: 294, ax: 0, size: 24, color: 'muted', k: k(enter(0.42), exit(N + 0.08)) }),
      text({ id: 'stepB', text: 'Step 2 of 2', x: -380, y: 294, ax: 0, size: 24, color: 'muted', k: enter(N + 0.08) }),
      rect({ id: 'next', x: 280, y: 272, w: 200, h: 84, r: 42, fill: 'ink', k: k(popIn(0.4, 0.7), press(N)), ch: [
        text({ id: 'nextLbl', text: 'Next', size: 30, weight: 600, color: 'inv', k: exit(N + 0.06) }),
        text({ id: 'saveLbl', text: 'Save card', size: 28, weight: 600, color: 'inv', k: enter(N + 0.06) }),
      ] }),
      cursorLayer([[0, 620, 380], [1.5, 620, 380], [N - 0.1, 290, 284], [N + 0.3, 290, 284], [N + 0.95, 520, 350]], [N], [], { inAt: 1.45 }),
    ];
  },
});

// 5 ─ Payment method: Wallet is picked, Pay enables, the press runs a spinner and lands on Paid
UIK.define({
  id: 'payment-method', name: 'Payment method', cat: 'commerce', T: 4.2, cam: 1.1,
  desc: 'The cursor picks Wallet: its radio fills with a pop and the row outline darkens, the Pay button wakes from dim to ink. Pay is pressed: a spinner runs with Processing, then an accent fill spreads out from the centre and Paid lands with a check.',
  build: () => {
    const RY = [-150, -14, 122], W = 1.2, P = 2.1, S1 = P + 1.1, BY = 276;
    const M = [
      ['card', 'Debit card', '•••• 4821 · expires 08/28'],
      ['wallet', 'Wallet balance', '$120.00 available'],
      ['bank', 'Bank transfer', 'Clears in 1–2 days'],
    ];
    return [
      rect({ id: 'card', w: 860, h: 760, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'title', text: 'Payment method', x: -390, y: -310, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -390 }) }),
        text({ id: 'sub', text: 'Order #48213 · 2 items', x: -390, y: -264, ax: 0, size: 26, color: 'muted', k: enter(0.3) }),
        ...M.map(([g, t, s], i) => rect({ id: 'row' + i, y: RY[i], w: 780, h: 116, r: 28, fill: 'card', stroke: 'line', sw: 2,
          k: k(enter(0.32 + i * 0.08, { dy: 16, y0: RY[i] }), i === 1 ? press(W, { to: 0.98 }) : null,
                i === 1 ? { stroke: [[W, W + 0.2, 'ink', 'Power2 Out']], sw: [[W, W + 0.2, 3, 'Power2 Out']] } : null), ch: [
            circle({ id: 'radio' + i, x: -334, d: 40, fill: 'card', stroke: 'dim', sw: 3 }),
            ...(i === 1 ? [circle({ id: 'radioOn', x: -334, d: 40, fill: 'ink', k: pop(W + 0.02, { from: 0.3, dur: 0.4 }), ch: [circle({ d: 14, fill: 'inv' })] })] : []),
            rect({ id: 'tile' + i, x: -262, w: 72, h: 72, r: 20, fill: 'soft', ch: [path({ d: GLYPH[g], stroke: 'ink', sw: 2.4 })] }),
            text({ id: 'mTitle' + i, text: t, x: -206, y: -18, ax: 0, size: 30, weight: 600 }),
            text({ id: 'mSub' + i, text: s, x: -206, y: 20, ax: 0, size: 24, color: 'muted' }),
          ] })),
        rect({ id: 'pay', y: BY, w: 780, h: 104, r: 52, fill: 'dim', k: k(fadeIn(0.56), { fill: [[W + 0.1, W + 0.4, 'ink', 'Power2 Out']] }, press(P, { to: 0.97 })), ch: [
          text({ id: 'payLbl', text: 'Pay $49.00', size: 34, weight: 600, color: 'card', k: k({ color: [[W + 0.1, W + 0.4, 'inv', 'Power2 Out']] }, exit(P + 0.02)) }),
          group({ id: 'processing', k: k(enter(P + 0.06, { d: 0 }), exit(S1 - 0.02, { dur: 0.12 })), ch: [
            path({ id: 'spinner', x: -100, d: ring(17), stroke: 'inv', sw: 5, trimmed: true, trimE: 72, k: { rot: [[P + 0.06, S1, 620, 'Linear']] } }),
            text({ id: 'procLbl', text: 'Processing', x: -68, ax: 0, size: 32, weight: 600, color: 'inv' }),
          ] }),
          rect({ id: 'paidFill', w: 104, h: 104, r: 52, fill: 'acc', k: { opacity: [0, [S1, S1 + 0.1, 1, 'Linear']], w: [[S1, S1 + 0.6, 780, 'Expo Out']] } }),
          group({ id: 'paid', k: enter(S1 + 0.12, { d: 0 }), ch: [
            icon({ id: 'paidCheck', icon: 'check', x: -48, size: 34, color: '#FFFFFF', sw: 3, k: pop(S1 + 0.16) }),
            text({ id: 'paidLbl', text: 'Paid', x: -22, ax: 0, size: 34, weight: 600, color: '#FFFFFF' }),
          ] }),
        ] }),
      ] }),
      cursorLayer([[0, 600, 430], [0.62, 600, 430], [W - 0.1, -190, -4], [W + 0.3, -190, -4], [P - 0.1, 70, 290], [P + 0.3, 70, 290], [P + 1.0, 520, 400]], [W, P], [], { inAt: 0.55 }),
    ];
  },
});

// 6 ─ Confirm sheet: Buy now raises a bottom sheet in a phone, Confirm runs a face scan that becomes a check
UIK.define({
  id: 'confirm-sheet', name: 'Confirm sheet', cat: 'commerce', T: 4.7, cam: 0.85,
  desc: 'Inside a phone, Buy now raises a bottom sheet while the page behind shrinks back and dims. Confirm is pressed: the order details blur away, four corner brackets frame a face while a scan line sweeps, then they contract, retract and an accent check writes on.',
  build: () => {
    const PW = 520, PH = 1000, B = 0.95, S0 = B + 0.06, C = 2.05, SC = C + 0.2, K0 = SC + 0.95, K1 = K0 + 0.35, FY = 252, FR = 100, FR1 = 58;
    const corners = [[-1, -1, 0], [1, -1, 90], [1, 1, 180], [-1, 1, 270]];
    return [
      group({ id: 'phone', k: popIn(0.1, 0.7), ch: [
        rect({ id: 'screen', w: PW, h: PH, r: 76, fill: 'panel', shadow: 1, clip: true, ch: [
          group({ id: 'page', k: { opacity: [[S0, S0 + 0.5, 0.4, 'Power2 Out']], scale: [[S0, S0 + 0.6, 0.94, 'Power3 Out']] }, ch: [
            icon({ id: 'backIcon', icon: 'chevronLeft', x: -208, y: -378, size: 30, color: 'ink', sw: 2.6, k: enter(0.26) }),
            text({ id: 'pageTitle', text: 'Shop', y: -378, size: 28, weight: 600, k: enter(0.26) }),
            icon({ id: 'pageBag', icon: 'bag', x: 208, y: -378, size: 30, color: 'ink', sw: 2.4, k: enter(0.26) }),
            rect({ id: 'hero', y: -190, w: 440, h: 300, r: 32, fill: 'soft', clip: true, k: enter(0.3, { blur: 0 }), ch: [art('bottle', 0.82)] }),
            text({ id: 'pName', text: 'Steel Bottle', x: -220, y: 0, ax: 0, size: 36, weight: 600, ls: -0.02, k: enter(0.36, { dx: -14, x0: -220 }) }),
            text({ id: 'pPrice', text: '$32.00 · Stone', x: -220, y: 44, ax: 0, size: 26, color: 'muted', k: enter(0.42) }),
            rect({ id: 'buy', y: 150, w: 440, h: 96, r: 48, fill: 'ink', k: k(fadeIn(0.46), press(B)), ch: [text({ text: 'Buy now', size: 32, weight: 600, color: 'inv' })] }),
          ] }),
          group({ id: 'sheet', k: { y: [560, [S0, S0 + 0.6, 0, 'Power4 Out']] }, ch: [
            rect({ id: 'sheetBg', y: 20, pin: 't', w: PW, h: 520, radii: '44px 44px 0 0', fill: 'card', shadow: 2 }),
            rect({ id: 'handle', y: 44, w: 64, h: 8, r: 4, fill: 'dim' }),
            group({ id: 'order', k: k(enter(S0 + 0.2, { d: 0 }), exit(C + 0.08, { dur: 0.2 })), ch: [
              text({ id: 'sTitle', text: 'Confirm purchase', x: -212, y: 100, ax: 0, size: 34, weight: 600, ls: -0.02 }),
              icon({ id: 'close', icon: 'x', x: 208, y: 100, size: 28, color: 'muted', sw: 2.6 }),
              rect({ id: 'oTile', x: -176, y: 196, w: 88, h: 88, r: 22, fill: 'soft', clip: true, ch: [art('bottle', 0.24)] }),
              text({ id: 'oName', text: 'Steel Bottle', x: -114, y: 178, ax: 0, size: 28, weight: 600 }),
              text({ id: 'oSub', text: 'Stone · Qty 1', x: -114, y: 214, ax: 0, size: 22, color: 'muted' }),
              text({ id: 'oPrice', text: '$32.00', x: 212, y: 178, ax: 1, size: 28, weight: 600 }),
              rect({ id: 'oRule', y: 268, w: 440, h: 2, fill: 'line' }),
              text({ id: 'tLbl', text: 'Total', x: -212, y: 312, ax: 0, size: 28, color: 'muted' }),
              text({ id: 'tVal', text: '$32.00', x: 212, y: 312, ax: 1, size: 30, weight: 600 }),
              rect({ id: 'confirm', y: 412, w: 440, h: 96, r: 48, fill: 'ink', k: press(C), ch: [text({ text: 'Confirm', size: 32, weight: 600, color: 'inv' })] }),
            ] }),
            // face scan: four brackets frame a face, contract, retract, and an accent check writes on
            group({ id: 'scan', y: FY, k: k(enter(SC, { d: 0, dur: 0.3, s: 1 }), { scale: [1.25, [SC, SC + 0.45, 1, 'Power3 Out']] }), ch: [
              group({ id: 'face', k: exit(K0, { dur: 0.2 }), ch: [
                rect({ x: -30, y: -18, w: 10, h: 26, r: 5, fill: 'muted' }),
                rect({ x: 30, y: -18, w: 10, h: 26, r: 5, fill: 'muted' }),
                path({ d: 'M-30 26 Q0 50 30 26', stroke: 'muted', sw: 7 }),
              ] }),
              rect({ id: 'scanLine', y: -76, w: 170, h: 4, r: 2, fill: 'ink/30',
                k: { y: [[SC + 0.2, SC + 0.55, 76, 'Sine Smooth'], [SC + 0.55, SC + 0.9, -76, 'Sine Smooth']], opacity: [0, [SC + 0.2, SC + 0.3, 1, 'Linear'], [SC + 0.8, SC + 0.9, 0, 'Linear']] } }),
              ...corners.map(([sx, sy, rot], i) => path({ id: 'corner' + i, x: sx * FR, y: sy * FR, rot, d: 'M0 46 V16 A16 16 0 0 1 16 0 H46', stroke: 'ink', sw: 9, trimmed: true,
                k: { x: [[K0, K0 + 0.35, sx * FR1, 'Power4 Out']], y: [[K0, K0 + 0.35, sy * FR1, 'Power4 Out']], trimS: [[K1, K1 + 0.22, 100, 'Power2 In']] } })),
              path({ id: 'okTick', d: 'M-40 2 L-12 30 L42 -26', stroke: 'acc', sw: 14, trimmed: true, k: { trimE: [0, [K1 + 0.08, K1 + 0.45, 100, 'Power3 Out']] } }),
            ] }),
            text({ id: 'hold', text: 'Hold still…', y: 408, size: 30, color: 'muted', k: k(enter(SC + 0.1), exit(K1)) }),
            text({ id: 'done', text: 'Payment confirmed', y: 400, size: 32, weight: 600, ls: -0.01, k: enter(K1 + 0.1, { dy: 12, y0: 400 }) }),
            text({ id: 'doneSub', text: '$32.00 · receipt sent', y: 442, size: 24, color: 'muted', k: enter(K1 + 0.2, { dy: 10, y0: 442 }) }),
          ] }),
          // the status bar belongs to the device, so it stays crisp while the page recedes
          text({ id: 'clock', text: '9:41', x: -196, y: -448, size: 24, weight: 600, k: enter(0.22) }),
          rect({ id: 'island', y: -448, w: 116, h: 34, r: 17, fill: 'ink' }),
          rect({ id: 'battery', x: 192, y: -448, w: 40, h: 20, r: 6, stroke: 'ink', sw: 2.5, k: enter(0.22), ch: [rect({ x: -15, pin: 'l', w: 24, h: 12, r: 3, fill: 'ink' })] }),
        ] }),
        rect({ id: 'bezel', w: PW, h: PH, r: 76, stroke: 'ink', sw: 12 }),
      ] }),
      cursorLayer([[0, 480, 560], [0.45, 480, 560], [B - 0.1, 40, 162], [B + 0.3, 40, 162], [C - 0.1, 40, 424], [C + 0.3, 40, 424], [C + 0.95, 430, 560]], [B, C], [], { inAt: 0.4 }),
    ];
  },
});

// 7 ─ Order tracking: the line fills down stage by stage, a delivery dot rides its tip, the ETA swaps
UIK.define({
  id: 'order-tracking', name: 'Order tracking', cat: 'commerce', T: 4.1, cam: 1.3,
  desc: 'A vertical tracker: the ink line fills downward one leg at a time while an accent delivery dot rides its tip; each node it reaches fills ink and its label darkens. At Delivered the dot merges into an accent disc with a check and the ETA swaps.',
  build: () => {
    const NX = -300, NY = [-76, 30, 136, 242], LEGS = [[1.05, 1.6], [1.85, 2.4], [2.65, 3.2]], EZ = 'Power3 Out', END = LEGS[2][1];
    const ST = [['Ordered', 'Sep 22 · 9:14 am'], ['Shipped', 'Sep 23 · 6:40 pm'], ['Out for delivery', 'Today · 8:05 am'], ['Delivered', 'By 6 pm']];
    const reach = [0.88, LEGS[0][1] - 0.04, LEGS[1][1] - 0.04, END];
    return [
      rect({ id: 'card', w: 760, h: 620, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'title', text: 'Order #48213', x: -330, y: -240, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -330 }) }),
        text({ id: 'sub', text: '2 items · $164.00', x: -330, y: -196, ax: 0, size: 26, color: 'muted', k: enter(0.3) }),
        text({ id: 'etaLblA', text: 'Estimated arrival', x: 330, y: -244, ax: 1, size: 24, color: 'muted', k: k(enter(0.3), exit(END + 0.14)) }),
        text({ id: 'etaA', text: 'Today, 4–6 pm', x: 330, y: -204, ax: 1, size: 30, weight: 600, k: k(enter(0.34), exit(END + 0.14)) }),
        text({ id: 'etaLblB', text: 'Delivered', x: 330, y: -244, ax: 1, size: 24, color: 'muted', k: enter(END + 0.14) }),
        text({ id: 'etaB', text: 'Today, 2:14 pm', x: 330, y: -204, ax: 1, size: 30, weight: 600, k: enter(END + 0.2, { dy: 10, y0: -204 }) }),
        rect({ id: 'rule', y: -150, w: 680, h: 2, fill: 'line', k: fadeIn(0.36) }),
        rect({ id: 'track', x: NX, y: NY[0], pin: 't', w: 6, h: NY[3] - NY[0], r: 3, fill: 'dim', k: fadeIn(0.38) }),
        rect({ id: 'fill', x: NX, y: NY[0], pin: 't', w: 6, h: 0, r: 3, fill: 'ink', k: { h: LEGS.map(([a, b], i) => [a, b, NY[i + 1] - NY[0], EZ]) } }),
        ...NY.map((y, i) => circle({ id: 'node' + i, x: NX, y, d: 34, fill: 'card', stroke: 'dim', sw: 4,
          k: k(enter(0.4 + i * 0.06, { blur: 0, s: 0.6 }), i < 3 ? { fill: [[reach[i], reach[i] + 0.18, 'ink', 'Power2 Out']], stroke: [[reach[i], reach[i] + 0.18, 'ink', 'Power2 Out']],
            scale: [[reach[i], reach[i] + 0.08, 1.18, 'Power2 Out'], [reach[i] + 0.08, reach[i] + 0.4, 1, 'Power3 Out']] } : null) })),
        circle({ id: 'arrived', x: NX, y: NY[3], d: 52, fill: 'acc', k: pop(END - 0.02, { from: 0.4 }), ch: [icon({ icon: 'check', size: 28, color: '#FFFFFF', sw: 3.2 })] }),
        circle({ id: 'courier', x: NX, y: NY[0], d: 22, fill: 'acc', stroke: 'card', sw: 4,
          k: { y: LEGS.map(([a, b], i) => [a, b, NY[i + 1], EZ]), scale: [0, [0.9, 1.3, 1, 'Back Out'], [END - 0.04, END + 0.08, 0, 'Power2 In']], opacity: [0, [0.9, 1.0, 1, 'Linear']] } }),
        ...ST.map(([t, s], i) => group({ id: 'stage' + i, y: NY[i], k: enter(0.42 + i * 0.07, { dx: -16, x0: 0 }), ch: [
          text({ id: 'sName' + i, text: t, x: -254, ax: 0, size: 30, weight: 600, color: 'muted', k: { color: [[reach[i], reach[i] + 0.25, 'ink', 'Power2 Out']] } }),
          text({ id: 'sTime' + i, text: s, x: 330, ax: 1, size: 24, color: 'muted', k: i === 3 ? exit(END + 0.05) : undefined }),
          ...(i === 3 ? [text({ id: 'sTimeDone', text: 'Today · 2:14 pm', x: 330, ax: 1, size: 24, color: 'muted', k: enter(END + 0.05) })] : []),
        ] })),
      ] }),
    ];
  },
});

// 8 ─ Coupon ticket: the code types in, Copy is clicked, the code selects and the button says Copied
UIK.define({
  id: 'coupon-ticket', name: 'Coupon ticket', cat: 'commerce', T: 3.1, cam: 1.4,
  desc: 'A ticket with a dotted perforation and two notches: the promo code types into its dashed box, the cursor clicks Copy, the code gets a soft accent selection and the button swaps to a check and Copied.',
  build: () => {
    const PX = 240, SX = 370, C = 1.95;
    return [
      // the notches are real bites out of the ticket (transparent), not circles painted over it
      rect({ id: 'ticket', w: 1000, h: 340, r: 36, fill: 'card', shadow: 1, clip: true, notches: [{ at: PX, r: 32 }], k: popIn(0.1, 0.7), ch: [
        path({ id: 'perf', x: PX, d: 'M0 -126 V126', stroke: 'dim', sw: 6, dash: [0.5, 16], k: fadeIn(0.3) }),
        rect({ id: 'pct', x: -392, y: -52, w: 116, h: 116, r: 30, fill: 'acc', k: pop(0.24, { from: 0.5 }), ch: [text({ text: '%', size: 56, weight: 600, color: '#FFFFFF' })] }),
        text({ id: 'offer', text: '20% off', x: -304, y: -76, ax: 0, size: 54, weight: 600, ls: -0.03, tnum: false, k: enter(0.28, { dx: -16, x0: -304 }) }),
        text({ id: 'terms', text: 'Spring sale · ends Apr 30', x: -304, y: -26, ax: 0, size: 26, color: 'muted', k: enter(0.34) }),
        rect({ id: 'codeBox', x: -202, y: 84, w: 500, h: 92, r: 22, fill: 'panel', stroke: 'dim', sw: 3, dash: true, k: k(fadeIn(0.4), { stroke: [[C, C + 0.2, 'ink', 'Power2 Out']] }), ch: [
          rect({ id: 'selection', x: -122, pin: 'l', w: 0, h: 58, r: 12, fill: 'acc/18', k: { w: [[C + 0.02, C + 0.32, 244, 'Power3 Out']] } }),
          text({ id: 'code', text: 'SPRING24', size: 38, weight: 600, ls: 0.12, caret: true, caretColor: 'ink', caretFrom: 0.6, caretUntil: C,
            k: { reveal: [0, [0.75, 1.35, 1, 'Linear']] } }),
        ] }),
        text({ id: 'stubCap', text: 'Promo code', x: SX, y: -86, size: 22, weight: 500, color: 'muted', k: enter(0.36) }),
        rect({ id: 'copyBtn', x: SX, y: 0, w: 196, h: 84, r: 42, fill: 'ink', k: k(fadeIn(0.42), press(C)), ch: [
          group({ id: 'copyLbl', k: exit(C + 0.04), ch: [
            icon({ icon: 'copy', x: -40, size: 28, color: 'inv', sw: 2.4 }),
            text({ text: 'Copy', x: -16, ax: 0, size: 28, weight: 600, color: 'inv' }),
          ] }),
          group({ id: 'copiedLbl', k: enter(C + 0.04, { d: 0.04 }), ch: [
            icon({ icon: 'check', x: -50, size: 28, color: 'inv', sw: 3, k: pop(C + 0.08) }),
            text({ text: 'Copied', x: -26, ax: 0, size: 28, weight: 600, color: 'inv' }),
          ] }),
        ] }),
        text({ id: 'expires', text: 'Expires in 5 days', x: SX, y: 86, size: 22, color: 'muted', k: enter(0.46) }),
      ] }),
      cursorLayer([[0, 560, 330], [1.05, 560, 330], [C - 0.1, 384, 12], [C + 0.3, 384, 12], [C + 0.85, 540, 300]], [C], [], { inAt: 1.0 }),
    ];
  },
});

// 9 ─ Price drop: a line strikes the old price, it slides down and dims, the new price drops in above
UIK.define({
  id: 'price-drop', name: 'Price drop', cat: 'commerce', T: 2.9, cam: 1.08,
  desc: 'A line draws through the old $129 (Trim Paths), then the struck price slides down, shrinks and greys while the new $89 drops in above it in the accent and a −30% badge pops on the product photo.',
  build: () => {
    const S = 1.0, M = 1.48, PY = 236, PX = -270;
    return [
      rect({ id: 'card', w: 620, h: 760, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        rect({ id: 'tile', y: -150, w: 540, h: 420, r: 32, fill: 'soft', clip: true, k: enter(0.2, { blur: 0, s: 0.96 }), ch: [art('headphones', 1.2, { y: -6 })] }),
        rect({ id: 'badge', x: -186, y: -316, w: 128, h: 56, r: 28, fill: 'ink', k: pop(M + 0.32, { from: 0.4 }), ch: [text({ text: '−30%', size: 26, weight: 600, color: 'inv' })] }),
        text({ id: 'name', text: 'Studio Headphones', x: PX, y: 106, ax: 0, size: 36, weight: 600, ls: -0.02, k: enter(0.3, { dx: -16, x0: PX }) }),
        text({ id: 'variant', text: 'Wireless · Graphite', x: PX, y: 148, ax: 0, size: 26, color: 'muted', k: enter(0.36) }),
        group({ id: 'old', x: PX, y: PY, k: k(enter(0.42), { y: [[M, M + 0.55, PY + 66, 'Power4 Out']], scale: [[M, M + 0.55, 0.56, 'Power4 Out']] }), ch: [
          text({ id: 'oldPrice', text: '$129', ax: 0, size: 64, weight: 600, ls: -0.03, tnum: false, k: { color: [[M, M + 0.3, 'muted', 'Power2 Out']] } }),
          path({ id: 'strike', d: 'M-6 4 H152', stroke: 'ink', sw: 5, trimmed: true, k: { trimE: [0, [S, S + 0.36, 100, 'Power3 Out']], stroke: [[M, M + 0.3, 'muted', 'Power2 Out']] } }),
        ] }),
        text({ id: 'newPrice', text: '$89', x: PX, y: PY, ax: 0, size: 64, weight: 600, ls: -0.03, tnum: false, color: 'acc', k: enter(M + 0.06, { dy: -44, y0: PY }) }),
        rect({ id: 'bagBtn', x: 216, y: 262, w: 96, h: 96, r: 48, fill: 'ink', k: enter(0.46, { blur: 0, s: 0.7 }), ch: [icon({ icon: 'bag', size: 38, color: 'inv', sw: 2.4 })] }),
      ] }),
    ];
  },
});

// 10 ─ Size picker: a hover ring follows the cursor from S to M (stretching), the click commits it
UIK.define({
  id: 'size-picker', name: 'Size picker', cat: 'commerce', T: 3.2, cam: 1.35,
  desc: 'A faint hover ring sits on S under the cursor, then slides to M stretching between the chips (leading edge first). The click commits it to a solid ink ring, the status line swaps and Add to bag wakes from dim to ink. XL is sold out: struck and greyed.',
  build: () => {
    const X = [-306, -102, 102, 306], CY = -30, RW = 192, H0 = 1.0, HM = 1.26, C = 1.72;
    return [
      rect({ id: 'card', w: 900, h: 520, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'title', text: 'Size', x: -400, y: -190, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -400 }) }),
        text({ id: 'guide', text: 'Size guide', x: 400, y: -190, ax: 1, size: 26, weight: 500, color: 'muted', k: enter(0.28) }),
        text({ id: 'hint', text: 'Choose one to continue', x: -400, y: -144, ax: 0, size: 26, color: 'muted', k: k(enter(0.32), exit(C + 0.04)) }),
        text({ id: 'picked', text: 'M · ships tomorrow', x: -400, y: -144, ax: 0, size: 26, weight: 500, k: enter(C + 0.04) }),
        ...['S', 'M', 'L', 'XL'].map((s, i) => rect({ id: 'chip' + i, x: X[i], y: CY, w: 180, h: 120, r: 28, fill: i === 3 ? 'panel' : 'card', stroke: 'line', sw: 2,
          k: k(enter(0.34 + i * 0.06, { dy: 14, y0: CY }), i === 1 ? press(C, { to: 0.95 }) : null), ch: [
            text({ id: 'chipLbl' + i, text: s, size: 40, weight: 600, color: i === 3 ? 'dim' : 'ink' }),
            ...(i === 3 ? [path({ id: 'soldOut', d: 'M-66 42 L66 -42', stroke: 'dim', sw: 3 })] : []),
          ] })),
        rect({ id: 'ring', x: X[0] - RW / 2, y: CY, pin: 'l', w: RW, h: 132, r: 34, stroke: 'ink/30', sw: 3,
          k: k({ opacity: [0, [H0 - 0.02, H0 + 0.14, 1, 'Power2 Out']], stroke: [[C, C + 0.18, 'ink', 'Power2 Out']], sw: [[C, C + 0.18, 3.5, 'Power2 Out']] },
                edges(HM, X[0] - RW / 2, X[0] + RW / 2, X[1] - RW / 2, X[1] + RW / 2)) }),
        rect({ id: 'addBtn', y: 150, w: 800, h: 100, r: 50, fill: 'dim', k: k(fadeIn(0.56), { fill: [[C + 0.1, C + 0.4, 'ink', 'Power2 Out']] }), ch: [
          text({ id: 'addLbl', text: 'Add to bag', size: 34, weight: 600, color: 'card', k: { color: [[C + 0.1, C + 0.4, 'inv', 'Power2 Out']] } }),
        ] }),
      ] }),
      cursorLayer([[0, 560, 330], [0.5, 560, 330], [H0, -296, -16], [1.2, -296, -16], [1.55, -92, -16], [1.95, -92, -16], [2.6, 470, 330]], [C], [], { inAt: 0.45 }),
    ];
  },
});

// 11 ─ Plan cards: the Popular plan lifts onto a floating shadow, the cursor picks it, the others recede
UIK.define({
  id: 'plan-cards', name: 'Plan cards', cat: 'commerce', T: 3.3, cam: 1.1,
  desc: 'Three plan cards pop in on a stagger; the Popular one lifts and grows onto a floating shadow. The cursor picks it: an ink ring and an accent check badge pop at its corner, its button reads Selected, and the side cards recede.',
  build: () => {
    const X = [-440, 0, 440], L = 1.0, C = 1.95, R = C + 0.1;
    const P = [
      { n: 'Starter', p: '$0', pw: 98, d: 'For side projects', f: ['3 projects', 'Basic analytics', 'Community support'] },
      { n: 'Pro', p: '$18', pw: 130, d: 'For growing teams', f: ['Unlimited projects', 'Advanced analytics', 'Priority support'] },
      { n: 'Team', p: '$48', pw: 142, d: 'For whole studios', f: ['Everything in Pro', 'Shared workspaces', 'SSO and audit log'] },
    ];
    const plan = (o, i) => {
      const mid = i === 1, t0 = 0.1 + i * 0.08;
      return group({ id: 'plan' + i, x: X[i], k: k(popIn(t0, 0.7),
          mid ? { y: [[L, L + 0.6, -26, 'Power3 Out']], scale: [[L, L + 0.6, 1.04, 'Power3 Out']] }
              : { scale: [[R, R + 0.5, 0.95, 'Power3 Out']], opacity: [[R, R + 0.4, 0.55, 'Power2 Out']] }), ch: [
        ...(mid ? [rect({ id: 'lift', w: 400, h: 600, r: 40, fill: 'card', shadow: 2, k: { opacity: [0, [L, L + 0.4, 1, 'Power2 Out']] } })] : []),
        rect({ id: 'face' + i, w: 400, h: 600, r: 40, fill: 'card', shadow: 1 }),
        text({ id: 'pName' + i, text: o.n, x: -156, y: -236, ax: 0, size: 32, weight: 600, k: enter(t0 + 0.16) }),
        ...(mid ? [rect({ id: 'popular', x: 90, y: -236, w: 132, h: 46, r: 23, fill: 'ink', k: enter(t0 + 0.2, { blur: 0, s: 0.7 }), ch: [text({ text: 'Popular', size: 22, weight: 600, color: 'inv' })] })] : []),
        text({ id: 'pPrice' + i, text: o.p, x: -156, y: -152, ax: 0, size: 76, weight: 600, ls: -0.03, tnum: false, k: enter(t0 + 0.2) }),
        text({ id: 'pPer' + i, text: '/mo', x: -156 + o.pw + 10, y: -136, ax: 0, size: 26, color: 'muted', k: enter(t0 + 0.24) }),
        text({ id: 'pDesc' + i, text: o.d, x: -156, y: -84, ax: 0, size: 24, color: 'muted', k: enter(t0 + 0.26) }),
        rect({ id: 'pRule' + i, y: -40, w: 320, h: 2, fill: 'line', k: fadeIn(t0 + 0.28) }),
        ...o.f.flatMap((s, j) => [
          icon({ id: `featIcon${i}_${j}`, icon: 'check', x: -144, y: 10 + j * 52, size: 24, color: 'ink', sw: 2.6, k: enter(t0 + 0.3 + j * 0.05, { dx: -12, x0: -144 }) }),
          text({ id: `feat${i}_${j}`, text: s, x: -118, y: 10 + j * 52, ax: 0, size: 24, k: enter(t0 + 0.3 + j * 0.05, { dx: -12, x0: -118 }) }),
        ]),
        rect({ id: 'pBtn' + i, y: 220, w: 320, h: 80, r: 40, fill: mid ? 'ink' : 'soft', k: k(fadeIn(t0 + 0.34), mid ? press(C) : null), ch: [
          text({ id: 'pBtnLbl' + i, text: 'Choose plan', size: 26, weight: 600, color: mid ? 'inv' : 'ink', k: mid ? exit(C + 0.04) : undefined }),
          ...(mid ? [group({ id: 'selected', k: enter(C + 0.04), ch: [
            icon({ icon: 'check', x: -54, size: 26, color: 'inv', sw: 3 }),
            text({ text: 'Selected', x: -30, ax: 0, size: 26, weight: 600, color: 'inv' }),
          ] })] : []),
        ] }),
        ...(mid ? [
          rect({ id: 'selRing', w: 400, h: 600, r: 40, stroke: 'ink', sw: 3, k: { opacity: [0, [C, C + 0.2, 1, 'Power2 Out']] } }),
          group({ id: 'badge', x: 196, y: -296, k: pop(C + 0.06, { from: 0.3 }), ch: [
            circle({ d: 76, fill: 'card' }),
            circle({ d: 62, fill: 'acc', ch: [icon({ icon: 'check', size: 32, color: '#FFFFFF', sw: 3.2 })] }),
          ] }),
        ] : []),
      ] });
    };
    return [
      plan(P[0], 0), plan(P[2], 2), plan(P[1], 1),
      cursorLayer([[0, 640, 430], [1.15, 640, 430], [C - 0.1, 14, 212], [C + 0.3, 14, 212], [C + 0.9, 300, 420]], [C], [], { inAt: 1.1 }),
    ];
  },
});

// 12 ─ Invoice status: the Due pill morphs into an ink Paid pill, a quiet highlight runs behind the total
UIK.define({
  id: 'invoice-status', name: 'Invoice status', cat: 'commerce', T: 3.0, cam: 1.12,
  desc: 'An invoice lands row by row. The payment clears: the Due pill tightens from its right edge and darkens into an ink Paid pill with a check, a quiet accent highlight bar grows behind the total line, and the footer note swaps.',
  build: () => {
    const P = 1.55, H = P + 0.32;
    const items = [['Brand identity', '$2,400.00'], ['Website design', '$3,800.00'], ['Motion kit', '$1,200.00']];
    return [
      rect({ id: 'card', w: 860, h: 700, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'title', text: 'Invoice #1042', x: -370, y: -272, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -370 }) }),
        text({ id: 'client', text: 'Harbor & Pine Studio', x: -370, y: -226, ax: 0, size: 26, color: 'muted', k: enter(0.3) }),
        rect({ id: 'pill', x: 370, y: -270, pin: 'r', w: 214, h: 58, r: 29, fill: 'soft',
          k: k(pop(0.34, { from: 0.6 }), { w: [[P, P + 0.55, 148, 'Expo Out']], fill: [[P, P + 0.3, 'ink', 'Power2 Out']] },
                { scale: [[P, P + 0.1, 1.06, 'Power2 Out'], [P + 0.1, P + 0.45, 1, 'Power3 Out']] }), ch: [
            group({ id: 'due', k: exit(P, { dur: 0.12 }), ch: [
              circle({ x: -70, d: 12, fill: 'acc' }),
              text({ text: 'Due Sep 30', x: -56, ax: 0, size: 24, weight: 500 }),
            ] }),
            group({ id: 'paid', k: enter(P + 0.06, { d: 0.02 }), ch: [
              icon({ icon: 'check', x: -32, size: 24, color: 'inv', sw: 3, k: pop(P + 0.12) }),
              text({ text: 'Paid', x: -14, ax: 0, size: 24, weight: 600, color: 'inv' }),
            ] }),
          ] }),
        rect({ id: 'rule', y: -176, w: 780, h: 2, fill: 'line', k: fadeIn(0.38) }),
        text({ id: 'colA', text: 'Description', x: -370, y: -130, ax: 0, size: 22, weight: 500, color: 'muted', k: enter(0.4) }),
        text({ id: 'colB', text: 'Amount', x: 370, y: -130, ax: 1, size: 22, weight: 500, color: 'muted', k: enter(0.42) }),
        ...items.map(([s, v], i) => group({ id: 'item' + i, y: -70 + i * 64, k: enter(0.46 + i * 0.08, { dx: -16, x0: 0 }), ch: [
          text({ text: s, x: -370, ax: 0, size: 30 }),
          text({ text: v, x: 370, ax: 1, size: 30, weight: 500 }),
        ] })),
        rect({ id: 'rule2', y: 114, w: 780, h: 2, fill: 'line', k: fadeIn(0.66) }),
        rect({ id: 'highlight', x: -390, y: 180, pin: 'l', w: 0, h: 84, r: 22, fill: 'acc/10', k: { w: [[H, H + 0.6, 780, 'Power4 Out']] } }),
        text({ id: 'totalLbl', text: 'Total', x: -362, y: 180, ax: 0, size: 32, weight: 600, k: enter(0.7) }),
        text({ id: 'totalVal', text: '$7,400.00', x: 362, y: 180, ax: 1, size: 40, weight: 600, ls: -0.02, tnum: false, k: enter(0.74) }),
        text({ id: 'noteA', text: 'Due in 5 days · Bank transfer', x: -370, y: 280, ax: 0, size: 24, color: 'muted', k: k(enter(0.78), exit(P + 0.4)) }),
        text({ id: 'noteB', text: 'Paid Sep 25 · Bank transfer', x: -370, y: 280, ax: 0, size: 24, color: 'muted', k: enter(P + 0.4) }),
      ] }),
    ];
  },
});

// 13 ─ Wallet balance: transactions push in on top, one by one; after each the balance rolls to its new value
UIK.define({
  id: 'wallet-balance', name: 'Wallet balance', cat: 'commerce', T: 4.3, cam: 1.08,
  desc: 'Three transactions arrive one at a time: each slides in on top of the list and pushes the older rows down, then the big balance on the ink card rolls to its new value — up for the income, down for each payment.',
  build: () => {
    const TX = [0.8, 1.8, 2.8], Y = [60, 170, 280], BAL = [2480, 3730, 3643.6, 3633.61];
    const R = [
      { t: 'Salary', s: 'Studio Nine · 9:00 am', a: '+$1,250.00', i: 'coin', inc: true },
      { t: 'Groceries', s: 'Market Hall · 12:40 pm', a: '−$86.40', i: 'bag' },
      { t: 'Streaming', s: 'Monthly plan · 3:15 pm', a: '−$9.99', i: 'play' },
    ];
    return [
      rect({ id: 'card', w: 860, h: 780, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        rect({ id: 'balanceCard', y: -222, w: 780, h: 256, r: 32, fill: 'ink', k: enter(0.2, { blur: 0, s: 0.96 }), ch: [
          text({ id: 'balLbl', text: 'Available balance', x: -340, y: -76, ax: 0, size: 26, color: 'inv/60', k: enter(0.28) }),
          text({ id: 'acct', text: '•••• 8812', x: 340, y: -76, ax: 1, size: 24, color: 'inv/60', k: enter(0.32) }),
          text({ id: 'balance', x: -344, y: 14, ax: 0, size: 96, weight: 600, ls: -0.03, color: 'inv', num: { pre: '$', dec: 2 }, value: BAL[0],
            k: k(enter(0.3), { value: TX.map((t, j) => [t + 0.3, t + 1.0, BAL[j + 1], 'Power3 Out']) }) }),
        ] }),
        text({ id: 'actTitle', text: 'Recent activity', x: -390, y: -30, ax: 0, size: 30, weight: 600, k: enter(0.36) }),
        text({ id: 'seeAll', text: 'See all', x: 390, y: -30, ax: 1, size: 24, weight: 500, color: 'muted', k: enter(0.4) }),
        text({ id: 'empty', text: 'No activity yet today', y: 150, size: 26, color: 'muted', k: k(enter(0.44), exit(TX[0] + 0.04)) }),
        ...R.map((r, j) => {
          const y = [[TX[j] + 0.12, TX[j] + 0.62, Y[0], 'Power3 Out']];
          for (let n = j + 1; n < TX.length; n++) y.push([TX[n], TX[n] + 0.5, Y[n - j], 'Power3 Out']);
          return group({ id: 'tx' + j, y: Y[0], k: k(enter(TX[j] + 0.12, { d: 0, dur: 0.34 }), { y: [Y[0] - 28, ...y] }), ch: [
            rect({ x: -352, w: 76, h: 76, r: 22, fill: 'soft', ch: [icon({ icon: r.i, size: 34, color: 'ink', sw: 2.4 })] }),
            text({ text: r.t, x: -294, y: -18, ax: 0, size: 30, weight: 500 }),
            text({ text: r.s, x: -294, y: 20, ax: 0, size: 22, color: 'muted' }),
            text({ text: r.a, x: 390, ax: 1, size: 30, weight: 600, color: r.inc ? 'acc' : 'ink' }),
          ] });
        }),
      ] }),
    ];
  },
});

// 14 ─ Product gallery: thumbnails drive a horizontal slide, the ring hops thumbs, page dots stretch
UIK.define({
  id: 'product-gallery', name: 'Product gallery', cat: 'commerce', T: 4.0, cam: 1.0,
  desc: 'Clicking thumbnails slides the main photo strip sideways inside its clip (a longer jump carries a touch of motion blur); the ink ring hops between thumbs stretching in flight, the active dot stretches into a pill and the page counter rolls.',
  build: () => {
    const TW = 800, TH = 580, TYc = -84, C1 = 1.15, C2 = 2.45, TX = [-270, -90, 90, 270], THY = 316, RW = 176, DX = [-60, -20, 20, 60];
    // when each slide becomes active / inactive
    const on = (i) => (i === 1 ? C1 : i === 3 ? C2 : null), off = (i) => (i === 0 ? C1 : i === 1 ? C2 : null);
    const dotK = (i) => {
      const w = [], f = [];
      if (off(i) != null) { w.push([off(i) + 0.04, off(i) + 0.5, 12, 'Power3 Out']); f.push([off(i) + 0.04, off(i) + 0.3, 'ink/25', 'Power2 Out']); }
      if (on(i) != null) { w.push([on(i) + 0.08, on(i) + 0.56, 36, 'Power3 Out']); f.push([on(i) + 0.08, on(i) + 0.34, 'ink', 'Power2 Out']); }
      return { w, fill: f };
    };
    const thumbO = (i) => {
      const o = [0, [0.4 + i * 0.06, 0.7 + i * 0.06, i === 0 ? 1 : 0.55, 'Power2 Out']];
      if (off(i) != null) o.push([off(i) + 0.04, off(i) + 0.3, 0.55, 'Power2 Out']);
      if (on(i) != null) o.push([on(i) + 0.04, on(i) + 0.3, 1, 'Power2 Out']);
      return { opacity: o, y: [THY + 14, [0.4 + i * 0.06, 0.78 + i * 0.06, THY, 'Power3 Out']] };
    };
    return [
      rect({ id: 'card', w: 880, h: 820, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        rect({ id: 'stage', y: TYc, w: TW, h: TH, r: 32, fill: 'soft', clip: true, k: enter(0.2, { blur: 0, s: 0.97 }), ch: [
          group({ id: 'strip', k: { x: [[C1 + 0.04, C1 + 0.64, -TW, 'Power4 Out'], [C2 + 0.04, C2 + 0.8, -TW * 3, 'Power4 Out']],
                                    blur: [[C2 + 0.04, C2 + 0.14, 3, 'Power2 Out'], [C2 + 0.14, C2 + 0.6, 0, 'Power2 Out']] },
            ch: VIEWS.map((v, i) => rect({ id: 'slide' + i, x: i * TW, w: TW, h: TH, fill: v.bg, ch: v.ch() })) }),
          ...DX.map((x, i) => rect({ id: 'dot' + i, x, y: 250, w: i ? 12 : 36, h: 12, r: 6, fill: i ? 'ink/25' : 'ink', k: dotK(i) })),
          rect({ id: 'counter', x: 330, y: -244, w: 92, h: 48, r: 24, fill: 'card', clip: true, k: enter(0.4, { blur: 0, s: 0.8 }), ch: [
            group({ id: 'counterCol', k: { y: [[C1 + 0.06, C1 + 0.5, -48, 'Power3 Out'], [C2 + 0.06, C2 + 0.5, -96, 'Power3 Out']] },
              ch: ['1 / 4', '2 / 4', '4 / 4'].map((s, i) => text({ text: s, y: i * 48, size: 22, weight: 600, tnum: false })) }),
          ] }),
        ] }),
        ...VIEWS.map((v, i) => rect({ id: 'thumb' + i, x: TX[i], y: THY, w: 160, h: 120, r: 22, fill: v.bg, clip: true, k: thumbO(i),
          ch: [group({ scale: 0.2, ch: v.ch() })] })),
        rect({ id: 'ring', x: TX[0] - RW / 2, y: THY, pin: 'l', w: RW, h: 136, r: 28, stroke: 'ink', sw: 3,
          k: k(enter(0.6, { blur: 0, s: 1 }), edges(C1 + 0.02, TX[0] - RW / 2, TX[0] + RW / 2, TX[1] - RW / 2, TX[1] + RW / 2),
                edges(C2 + 0.02, TX[1] - RW / 2, TX[1] + RW / 2, TX[3] - RW / 2, TX[3] + RW / 2, { fast: 0.38, slow: 0.56 })) }),
      ] }),
      cursorLayer([[0, 620, 460], [0.55, 620, 460], [C1 - 0.1, -80, 330], [C1 + 0.3, -80, 330], [C2 - 0.1, 280, 330], [C2 + 0.3, 280, 330], [C2 + 0.95, 560, 460]],
        [C1, C2], [], { inAt: 0.5 }),
    ];
  },
});

// 15 ─ Review summary: the score counts up, five stars fill to 4.8, the breakdown bars fill on a stagger
UIK.define({
  id: 'review-summary', name: 'Review summary', cat: 'commerce', T: 2.9, cam: 1.3,
  desc: 'The big score counts up to 4.8 while a clip sweeps across five stars, filling them in the accent and stopping 80 % through the last one; the five breakdown bars fill on a stagger as their counts tick up.',
  build: () => {
    const SC = [-474, -412, -350, -288, -226], SY = 58, CL = -506, HW = 52 * 10 / 24;
    const FILLW = +(SC[4] - HW + 0.8 * 2 * HW - CL).toFixed(1);
    const B = [1090, 132, 38, 14, 10], TOT = 1284, RY = [-164, -82, 0, 82, 164], TW = 320;
    return [
      rect({ id: 'card', w: 1120, h: 520, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'title', text: 'Customer reviews', x: -504, y: -186, ax: 0, size: 34, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -504 }) }),
        text({ id: 'score', x: -508, y: -62, ax: 0, size: 150, weight: 600, ls: -0.04, num: { dec: 1 }, k: k(enter(0.28), { value: [[0.4, 1.5, 4.8, 'Power3 Out']] }) }),
        text({ id: 'outOf', text: 'out of 5', x: -282, y: -14, ax: 0, size: 28, color: 'muted', k: enter(0.36) }),
        ...SC.map((x, i) => icon({ id: 'starOff' + i, icon: 'star', x, y: SY, size: 52, color: 'dim', sw: 2.4, filled: true, fill: 'dim', k: enter(0.34 + i * 0.04, { blur: 0, s: 0.6 }) })),
        rect({ id: 'starClip', x: CL, y: SY, pin: 'l', chAt: 'pin', w: 0, h: 64, clip: true, k: { w: [[0.5, 1.55, FILLW, 'Power3 Out']] },
          ch: SC.map((x, i) => icon({ id: 'starOn' + i, icon: 'star', x: x - CL, size: 52, color: 'acc', sw: 2.4, filled: true, fill: 'acc' })) }),
        text({ id: 'based', text: 'Based on 1,284 reviews', x: -504, y: 132, ax: 0, size: 26, color: 'muted', k: enter(0.42) }),
        rect({ id: 'divider', x: -40, w: 2, h: 400, fill: 'line', k: fadeIn(0.3) }),
        ...B.map((n, i) => {
          const t = 0.55 + i * 0.1;
          return group({ id: 'bar' + i, y: RY[i], k: enter(0.32 + i * 0.05, { dx: -14, x0: 0 }), ch: [
            text({ text: String(5 - i), x: 20, ax: 0, size: 26, weight: 600, tnum: false }),
            icon({ icon: 'star', x: 52, size: 22, color: 'muted', sw: 2, filled: true, fill: 'muted' }),
            rect({ id: 'track' + i, x: 84, pin: 'l', chAt: 'pin', w: TW, h: 14, r: 7, fill: 'skel', clip: true, ch: [
              rect({ id: 'fill' + i, pin: 'l', w: 0, h: 14, r: 7, fill: 'ink', k: { w: [[t, t + 0.7, Math.max(14, +(TW * n / TOT).toFixed(1)), 'Power4 Out']] } }),
            ] }),
            text({ id: 'count' + i, x: 500, ax: 1, size: 26, weight: 500, num: {}, k: { value: [[t, t + 0.9, n, 'Power3 Out']] } }),
          ] });
        }),
      ] }),
    ];
  },
});
})();
