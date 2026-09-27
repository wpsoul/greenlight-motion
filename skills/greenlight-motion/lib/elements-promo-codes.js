/* UI Motion Kit — Promos & countdowns: codes (see SKILL.md). */
(function () {
'use strict';
const { rect, circle, text, path, icon, group, photo, k, enter, exit, pop, popIn, fadeIn, press, cursorLayer } = UIK.h;

// ── local helpers ──
// Lucide glyphs the icon set lacks (24-grid stroke paths)
const TAG = ['M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z', 'M7.5 7.5h.01'];
// a decaying horizontal shake (wrong input), starting at t
const shake = (t, a = 24) => [[t, t + 0.06, -a, 'Power2 Out'], [t + 0.06, t + 0.15, a * 0.84, 'Sine Smooth'], [t + 0.15, t + 0.24, -a * 0.58, 'Sine Smooth'],
  [t + 0.24, t + 0.33, a * 0.38, 'Sine Smooth'], [t + 0.33, t + 0.42, -a * 0.17, 'Sine Smooth'], [t + 0.42, t + 0.52, 0, 'Sine Smooth']];

// 1 ─ Expired code → retry: the first code shakes red, the suggested one jumps into the field and applies
UIK.define({
  id: 'code-expired', name: 'Expired code → retry', cat: 'promo', T: 4.6, cam: { zoom: 1.35, y: -20 },
  desc: 'SPRING15 types into the promo field and Apply is clicked: the field shakes with decaying swings, its border turns red and "SPRING15 has expired" slides in as the card makes room. The cursor picks the suggested SUMMER20 chip, the code jumps from the chip into the field, Apply turns into a check and the total (a COUNTER placeholder) rolls down from $145 to $116.',
  build: () => {
    const TOP = -300, H0 = 500, G = 58, F = 0.9, A = 1.55, S = A + 0.08, C2 = 2.45, R = C2 + 0.06, A2 = 3.1, FY = -8, MY = 74;
    const FX = -100, TX = FX - 252;                    // field centre, typed-code left edge (world x)
    const CH = { l: 144, w: 236 }, TRY = CH.l + 20, CX = TRY + 45;   // suggestion chip: "Try" + the code (148 px at 0.857)
    return [
      group({ id: 'bag', k: popIn(0.1, { from: 0.7 }), ch: [
        rect({ id: 'card', y: TOP, pin: 't', w: 860, h: H0, r: 44, fill: 'card', shadow: 1, k: { h: [[S + 0.06, S + 0.56, H0 + G, 'Power3 Out']] } }),
        text({ id: 'title', text: 'Order summary', x: -380, y: -240, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -380 }) }),
        text({ id: 'count', text: '2 items', x: 380, y: -240, ax: 1, size: 24, color: 'muted', k: enter(0.28) }),
        ...[['Subtotal', '$145.00', -162], ['Shipping', 'Free', -114]].map(([l, v, y], i) => group({ id: 'line' + i, y, k: enter(0.32 + i * 0.07, { dx: -16, x0: 0 }), ch: [
          text({ text: l, x: -380, ax: 0, size: 28, color: 'muted' }),
          text({ text: v, x: 380, ax: 1, size: 28, weight: 500 }),
        ] })),
        rect({ id: 'rule', y: -72, w: 760, h: 2, fill: 'line', k: fadeIn(0.44) }),
        group({ id: 'fieldRow', x: FX, y: FY, k: { x: [FX, ...shake(S).map(([a, b, v, e]) => [a, b, FX + v, e])] }, ch: [
          rect({ id: 'field', w: 560, h: 88, r: 22, fill: 'card', stroke: 'line', sw: 2,
            k: k(fadeIn(0.46), {
              stroke: [[F, F + 0.2, 'ink', 'Power2 Out'], [S, S + 0.15, 'bad', 'Power2 Out'], [R, R + 0.25, 'ink', 'Power2 Out'], [A2 + 0.1, A2 + 0.35, 'line', 'Power2 Out']],
              sw: [[F, F + 0.2, 2.5, 'Power2 Out'], [S, S + 0.15, 3, 'Power2 Out'], [R, R + 0.25, 2.5, 'Power2 Out'], [A2 + 0.1, A2 + 0.35, 2, 'Power2 Out']] }), ch: [
              text({ id: 'placeholder', text: 'Promo code', x: -252, ax: 0, size: 28, color: 'muted', k: k(enter(0.5), exit(F + 0.1, { dur: 0.1 })) }),
              text({ id: 'codeOld', text: 'SPRING15', x: -252, ax: 0, size: 28, weight: 600, ls: 0.06, caret: true, caretColor: 'ink', caretFrom: F + 0.08, caretUntil: A,
                k: k({ reveal: [0, [F + 0.15, F + 0.6, 1, 'Linear']] }, exit(R, { dur: 0.12 })) }),
            ] }),
        ] }),
        rect({ id: 'apply', x: 290, y: FY, w: 180, h: 88, r: 44, fill: 'ink', k: k(fadeIn(0.5), press(A), press(A2)), ch: [
          text({ id: 'applyLbl', text: 'Apply', size: 28, weight: 600, color: 'inv', k: exit(A2 + 0.02) }),
          icon({ id: 'applied', icon: 'check', size: 32, color: 'inv', sw: 3, k: pop(A2 + 0.08) }),
        ] }),
        // the error line and the suggested code — they give way to the success line in the same slot
        group({ id: 'error', y: MY, k: k(enter(S + 0.1, { dy: -12, y0: MY }), exit(R, { dur: 0.16 })), ch: [
          icon({ icon: 'alert', x: -366, size: 26, color: 'bad', sw: 2.4 }),
          text({ text: 'SPRING15 has expired', x: -340, ax: 0, size: 26, weight: 500, color: 'bad' }),
        ] }),
        group({ id: 'suggest', x: CH.l + CH.w / 2, y: MY, k: k(pop(S + 0.3, { from: 0.6 }), press(C2, { to: 0.94 }), exit(R + 0.04, { dur: 0.16, s: 0.9 })), ch: [
          rect({ id: 'chip', w: CH.w, h: 50, r: 25, fill: 'soft' }),
          text({ id: 'try', text: 'Try', x: TRY - (CH.l + CH.w / 2), ax: 0, size: 24, weight: 500, color: 'muted' }),
        ] }),
        group({ id: 'success', y: MY, k: enter(A2 + 0.12, { dy: -12, y0: MY }), ch: [
          icon({ icon: 'check', x: -366, size: 28, color: 'acc', sw: 3 }),
          text({ text: 'SUMMER20 applied', x: -340, ax: 0, size: 26, weight: 500 }),
          text({ text: '−$29.00', x: 380, ax: 1, size: 26, weight: 600, color: 'acc' }),
        ] }),
        group({ id: 'totalBlock', k: { y: [[S + 0.06, S + 0.56, G, 'Power3 Out']] }, ch: [
          rect({ id: 'rule2', y: 72, w: 760, h: 2, fill: 'line', k: fadeIn(0.52) }),
          text({ id: 'totalLbl', text: 'Total', x: -380, y: 136, ax: 0, size: 36, weight: 600, ls: -0.02, k: enter(0.56) }),
          group({ id: 'totalVal', y: 136, k: enter(0.6), ch: [
            // ONE text: a COUNTER placeholder (Odometer) — the tens roll 4 → 1, the ones 5 → 6
            text({ id: 'total', text: `$\{{{COUNTER:145-116; start=${A2 + 0.25}; duration=0.75; turns=0; cascade=30}}}.00`, x: 380, ax: 1, size: 44, weight: 600, ls: -0.02 }),
          ] }),
        ] }),
        // the suggested code: sits in the chip, then jumps into the field (scale 24/28 → 1 about its left edge)
        text({ id: 'codeNew', text: 'SUMMER20', x: CX, y: MY, ax: 0, size: 28, weight: 600, ls: 0.06,
          k: k(pop(S + 0.3, { from: 0.51, to: 0.857 }), {
            x: [[R, R + 0.55, TX, 'Power3 Out']], y: [[R, R + 0.4, FY, 'Power4 Out']], scale: [[R, R + 0.5, 1, 'Power3 Out']] }) }),
      ] }),
      cursorLayer([[0, 560, 330], [0.4, 560, 330], [F - 0.1, -150, 6], [F + 0.2, -150, 6], [A - 0.1, 300, 6], [A + 0.25, 300, 6],
        [C2 - 0.1, 256, MY + 8], [C2 + 0.2, 256, MY + 8], [A2 - 0.1, 304, 4], [A2 + 0.25, 304, 4], [A2 + 0.9, 560, 330]], [F, A, C2, A2], [], { inAt: 0.4 }),
    ];
  },
});

// 2 ─ Show code: the blurred code sharpens while the Show code pill collapses into a round Copy button that docks in the box
UIK.define({
  id: 'code-reveal', name: 'Show code → Copy', cat: 'promo', T: 3.6,
  cam: { zoom: 1.4, y: 13, k: { zoom: [[1.05, 1.95, 1.55, 'Power2 Smooth']], y: [[1.05, 1.95, -51, 'Power2 Smooth']] } },
  desc: 'A deal card holds a blurred code. Show code is clicked: the pill collapses into a circle from its left edge and rises into the code box as a Copy button while the code sharpens and settles, and the card closes up behind it. A click on Copy pops an accent check and a Copied tooltip.',
  build: () => {
    const TOP = -262, H0 = 550, H1 = 422, C = 1.2, K = 2.55, BY = 60, BTN = 196, DX = 346, CX = -49;
    return [
      group({ id: 'deal', k: popIn(0.1, { from: 0.7 }), ch: [
        rect({ id: 'card', y: TOP, pin: 't', w: 900, h: H0, r: 44, fill: 'card', shadow: 1, k: { h: [[C + 0.18, C + 0.72, H1, 'Power3 Out']] } }),
        rect({ id: 'brandTile', x: -366, y: -182, w: 72, h: 72, r: 22, fill: 'soft', k: enter(0.2, { blur: 0, s: 0.7 }), ch: [icon({ icon: 'bag', size: 34, sw: 2.4 })] }),
        text({ id: 'brand', text: 'Fieldnote', x: -314, y: -196, ax: 0, size: 30, weight: 600, ls: -0.01, k: enter(0.24, { dx: -14, x0: -314 }) }),
        text({ id: 'store', text: 'Online store', x: -314, y: -162, ax: 0, size: 22, color: 'muted', k: enter(0.3) }),
        rect({ id: 'ends', x: 317, y: -182, w: 170, h: 48, r: 24, fill: 'soft', k: enter(0.3, { blur: 0, s: 0.8 }), ch: [text({ text: 'Ends Sunday', size: 22, weight: 500 })] }),
        text({ id: 'offer', text: 'Extra 25% off', x: -402, y: -84, ax: 0, size: 64, weight: 600, ls: -0.03, k: enter(0.3, { dx: -16, x0: -402 }) }),
        text({ id: 'terms', text: 'On orders over $80 · online only', x: -402, y: -30, ax: 0, size: 28, color: 'muted', k: enter(0.36) }),
        rect({ id: 'codeBox', y: BY, w: 804, h: 112, r: 28, fill: 'panel', stroke: 'dim', sw: 3, dash: true, k: fadeIn(0.4), ch: [
          // the masked code: legible shape, unreadable — it sharpens, settles and slides left of the docked button
          text({ id: 'code', text: 'EXTRA25', size: 48, weight: 600, ls: 0.12, k: {
            opacity: [0, [0.46, 0.76, 0.55, 'Power2 Out'], [C + 0.1, C + 0.45, 1, 'Power2 Out']],
            blur: [16, [C + 0.08, C + 0.58, 0, 'Power2 Out']],
            scale: [0.94, [C + 0.08, C + 0.62, 1, 'Power3 Out']],
            x: [[C + 0.1, C + 0.62, CX, 'Power4 Out']] } }),
        ] }),
        // Show code → Copy: pinned at its right edge, the pill collapses leftwards into a circle and rises into the box
        rect({ id: 'showBtn', x: 402, y: BTN, pin: 'r', w: 804, h: 96, r: 48, fill: 'ink',
          k: k(fadeIn(0.46), press(C, { to: 0.97 }), press(K, { to: 0.9 }), {
            w: [[C + 0.02, C + 0.55, 84, 'Expo Out']], h: [[C + 0.02, C + 0.55, 84, 'Expo Out']], r: [[C + 0.02, C + 0.55, 42, 'Expo Out']],
            x: [[C + 0.1, C + 0.6, DX + 42, 'Power3 Out']], y: [[C + 0.12, C + 0.62, BY, 'Power4 Out']] }), ch: [
            group({ id: 'showLbl', k: exit(C + 0.02, { dur: 0.12 }), ch: [
              icon({ icon: 'eye', x: -100, size: 32, color: 'inv', sw: 2.4 }),
              text({ text: 'Show code', x: -72, ax: 0, size: 30, weight: 600, color: 'inv' }),
            ] }),
            icon({ id: 'copyIc', icon: 'copy', size: 32, color: 'inv', sw: 2.4, k: k(pop(C + 0.42, { from: 0.4 }), exit(K + 0.02, { s: 0.6 })) }),
            circle({ id: 'okDisc', d: 84, fill: 'acc', k: pop(K + 0.04, { from: 0.4, dur: 0.36 }), ch: [icon({ icon: 'check', size: 36, color: 'white', sw: 3 })] }),
          ] }),
        // the tooltip grows from its arrow tip, just above the button
        group({ id: 'tip', x: DX, y: BY - 52, k: pop(K + 0.1, { from: 0.5, dur: 0.36 }), ch: [
          rect({ id: 'tipArrow', y: -10, w: 16, h: 16, r: 3, rot: 45, fill: 'ink' }),
          rect({ id: 'tipBg', y: -40, w: 136, h: 56, r: 16, fill: 'ink', ch: [text({ text: 'Copied', size: 24, weight: 600, color: 'inv' })] }),
        ] }),
      ] }),
      cursorLayer([[0, 560, 360], [0.5, 560, 360], [C - 0.1, 120, BTN + 8], [C + 0.25, 120, BTN + 8], [K - 0.1, DX + 8, BY + 10], [K + 0.25, DX + 8, BY + 10], [K + 0.85, 500, 230]], [C, K], [], { inAt: 0.45 }),
    ];
  },
});

// 3 ─ Code boxes merge: letters stamp into seven boxes, then the boxes close up into one ink chip with an accent check
UIK.define({
  id: 'code-merge', name: 'Code boxes → chip', cat: 'promo', T: 3.8,
  cam: { zoom: 1.38, k: { zoom: [[2.15, 2.95, 1.52, 'Power2 Smooth']] } },
  desc: 'A click focuses the first of seven boxes and HELLO25 stamps in letter by letter behind a stepping caret. On the last letter the boxes slide together and fade while one ink chip forms over them: the letters close up into a word, shrink and turn white, an accent check pops at the chip’s end and the caption confirms 25% off.',
  build: () => {
    const CODE = 'HELLO25', BY = 30, BW = 100, BH = 128, P = 114, CL = 0.8, M = 2.3, EZ = 'Power4 Out', MD = 0.55;
    const X = [...CODE].map((_, i) => (i - 3) * P);
    const D = X.map((_, i) => +(1.05 + i * 0.14).toFixed(2));
    // measured prefix widths of HELLO25 at 42 px / 600 / 0.04 em — each letter's centre in the closed-up word
    const PRE = [0, 32.8, 61.7, 88.3, 114.9, 149.2, 174.3, 199.3], LS = 1.68, WW = PRE[7] - LS, PW = 340, WC = -PW / 2 + 44 + WW / 2;
    const WX = X.map((_, i) => +(WC - WW / 2 + (PRE[i] + PRE[i + 1] - LS) / 2).toFixed(1));
    return [
      rect({ id: 'card', w: 980, h: 420, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, { from: 0.7 }), ch: [
        text({ id: 'title', text: 'Redeem a code', y: -148, size: 46, weight: 600, ls: -0.02, k: enter(0.22) }),
        text({ id: 'sub', text: 'Enter the 7-character code from your card', y: -100, size: 28, color: 'muted', k: k(enter(0.3), exit(M + 0.05)) }),
        text({ id: 'subDone', text: '25% off your next order is ready', y: -100, size: 28, weight: 500, k: enter(M + 0.3) }),
        ...X.map((x, i) => rect({ id: 'box' + i, x, y: BY, w: BW, h: BH, r: 24, fill: 'panel', stroke: 'line', sw: 2,
          k: k(enter(0.34 + i * 0.04, { dy: 14, y0: BY, blur: 0 }), { x: [[M, M + MD, Math.round(x * 0.25), EZ]], opacity: [[M, M + 0.3, 0, 'Power2 Out']] }) })),
        // the chip forms over the boxes as they close up (fading in, so no colour tween on a big surface)
        rect({ id: 'chip', y: BY, w: 784, h: BH, r: 24, fill: 'ink', k: {
          opacity: [0, [M, M + 0.2, 1, 'Power2 Out']], w: [[M, M + MD, PW, EZ]], h: [[M, M + MD, 100, EZ]], r: [[M, M + MD, 50, EZ]] } }),
        rect({ id: 'caret', x: X[0], y: BY, w: 4, h: 60, r: 2, fill: 'ink', k: {
          opacity: [0, [CL + 0.02, CL + 0.1, 1, 'Linear'], [D[6], D[6] + 0.06, 0, 'Linear']],
          x: D.slice(0, 6).map((t, i) => [t, X[i + 1]]) } }),
        ...X.map((x, i) => text({ id: 'ch' + i, text: CODE[i], x, y: BY, size: 56, weight: 600, k: {
          opacity: [0, [D[i], D[i] + 0.08, 1, 'Linear']], blur: [6, [D[i], D[i] + 0.2, 0, 'Power2 Out']],
          scale: [1.5, [D[i], D[i] + 0.28, 1, 'Power3 Out'], [M, M + MD, 0.75, EZ]],
          x: [[M, M + MD, WX[i], EZ]], color: [[M + 0.04, M + 0.2, 'inv', 'Power2 Out']] } })),
        circle({ id: 'okDisc', x: PW / 2 - 24 - 28, y: BY, d: 56, fill: 'acc', k: pop(M + 0.42, { from: 0.3 }), ch: [icon({ icon: 'check', size: 28, color: 'white', sw: 3 })] }),
        text({ id: 'hint', text: 'Codes are not case-sensitive', y: 150, size: 24, color: 'muted', k: k(enter(0.5), exit(M + 0.05)) }),
        text({ id: 'valid', text: 'Valid until Dec 31', y: 150, size: 24, color: 'muted', k: enter(M + 0.36) }),
      ] }),
      cursorLayer([[0, 520, 300], [0.35, 520, 300], [CL - 0.1, X[0] + 12, BY + 22], [CL + 0.25, X[0] + 12, BY + 22], [CL + 0.9, 470, 290]], [CL], [], { inAt: 0.3 }),
    ];
  },
});

// 4 ─ Newsletter → code: the email types in, Subscribe spins, the form gives way to the code, a tap copies it and a toast rises
UIK.define({
  id: 'code-newsletter', name: 'Newsletter → code', cat: 'promo', T: 4.6,
  cam: { zoom: 1.4, y: -38, k: { y: [[3.05, 3.8, 30, 'Power2 Smooth']] } },
  desc: 'A sign-up card: the email types into the field and Subscribe squeezes into a spinner. The form blurs away as the card grows into the reward: an accent check pops, "You’re in! Here’s 15% off" rises and the WELCOME15 code pops into its dashed box. A tap on the code outlines it and a Code copied toast rises from below.',
  build: () => {
    const TOP = -250, HA = 422, HB = 450, F = 0.85, S = 1.6, R = 2.3, C = 3.3, FY = 80, CY = 34, TY = 280;
    return [
      group({ id: 'signup', k: popIn(0.1, { from: 0.7 }), ch: [
        rect({ id: 'card', y: TOP, pin: 't', w: 860, h: HA, r: 44, fill: 'card', shadow: 1, k: { h: [[R, R + 0.5, HB, 'Power3 Out']] } }),
        group({ id: 'form', k: exit(R, { dur: 0.2 }), ch: [
          rect({ id: 'tile', x: -342, y: -162, w: 80, h: 80, r: 24, fill: 'soft', k: enter(0.2, { blur: 0, s: 0.7 }), ch: [icon({ icon: 'mail', size: 38, sw: 2.4 })] }),
          text({ id: 'title', text: 'Get 15% off your first order', x: -382, y: -64, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.24, { dx: -16, x0: -382 }) }),
          text({ id: 'sub', text: 'Join the list for early drops and offers.', x: -382, y: -18, ax: 0, size: 28, color: 'muted', k: enter(0.3) }),
          rect({ id: 'field', x: -122, y: FY, w: 520, h: 88, r: 22, fill: 'card', stroke: 'line', sw: 2,
            k: k(fadeIn(0.36), { stroke: [[F, F + 0.2, 'ink', 'Power2 Out'], [S, S + 0.2, 'line', 'Power2 Out']], sw: [[F, F + 0.2, 2.5, 'Power2 Out'], [S, S + 0.2, 2, 'Power2 Out']] }), ch: [
              text({ id: 'placeholder', text: 'Your email', x: -232, ax: 0, size: 28, color: 'muted', k: k(enter(0.4), exit(F + 0.08, { dur: 0.1 })) }),
              text({ id: 'email', text: 'mia@fieldnote.co', x: -232, ax: 0, size: 28, caret: true, caretColor: 'ink', caretFrom: F + 0.06, caretUntil: S,
                k: { reveal: [0, [F + 0.12, F + 0.72, 1, 'Linear']] } }),
            ] }),
          rect({ id: 'subscribe', x: 275, y: FY, w: 214, h: 88, r: 44, fill: 'ink', k: k(fadeIn(0.4), press(S), { w: [[S + 0.04, S + 0.45, 88, 'Expo Out']] }), ch: [
            text({ id: 'subLbl', text: 'Subscribe', size: 28, weight: 600, color: 'inv', k: exit(S + 0.02, { dur: 0.1 }) }),
            path({ id: 'spin', d: 'M0 -18 A18 18 0 1 1 0 18 A18 18 0 1 1 0 -18', stroke: 'inv', sw: 4, trimmed: true, trimE: 30,
              k: { opacity: [0, [S + 0.2, S + 0.3, 1, 'Power2 Out']], rot: [[S + 0.2, R + 0.2, 400, 'Linear']] } }),
          ] }),
        ] }),
        // the reward: centred, entering on a stagger once the form has gone
        circle({ id: 'okDisc', y: -168, d: 84, fill: 'acc', k: pop(R + 0.12, { from: 0.3 }), ch: [icon({ icon: 'check', size: 40, color: 'white', sw: 3 })] }),
        text({ id: 'title2', text: 'You’re in! Here’s 15% off', y: -80, size: 44, weight: 600, ls: -0.02, k: enter(R + 0.2, { dy: 14, y0: -80 }) }),
        rect({ id: 'codeBox', y: CY, w: 520, h: 116, r: 28, fill: 'panel', stroke: 'dim', sw: 3, dash: true,
          k: k(enter(R + 0.26, { blur: 0, s: 0.9 }), press(C, { to: 0.97 }), { stroke: [[C, C + 0.2, 'ink', 'Power2 Out']] }), ch: [
            text({ id: 'code', text: 'WELCOME15', size: 48, weight: 600, ls: 0.1, k: pop(R + 0.36, { from: 0.6 }) }),
          ] }),
        text({ id: 'caption', text: 'Tap the code to copy it · valid 7 days', y: 136, size: 24, color: 'muted', k: enter(R + 0.42) }),
      ] }),
      group({ id: 'toast', y: TY, k: enter(C + 0.1, { dy: 60, y0: TY, s: 0.92, dur: 0.35 }), ch: [
        rect({ id: 'toastBg', w: 276, h: 80, r: 40, fill: 'ink', shadow: 2 }),
        icon({ id: 'toastIc', icon: 'check', x: -94, size: 30, color: 'inv', sw: 3 }),
        text({ id: 'toastLbl', text: 'Code copied', x: -68, ax: 0, size: 28, weight: 600, color: 'inv' }),
      ] }),
      cursorLayer([[0, 540, 280], [0.4, 540, 280], [F - 0.1, -200, FY + 8], [F + 0.2, -200, FY + 8], [S - 0.1, 284, FY + 8], [S + 0.25, 284, FY + 8],
        [S + 0.85, 500, 262], [C - 0.55, 500, 262], [C - 0.1, 70, CY + 16], [C + 0.25, 70, CY + 16], [C + 0.9, 470, 330]], [F, S, C], [], { inAt: 0.35 }),
    ];
  },
});

// 5 ─ Code decode banner: a dark app banner drops in and the code's letters roll into place like slot reels, left to right
UIK.define({
  id: 'code-decode', name: 'Code decode banner', cat: 'promo', T: 3.2, cam: 1.2,
  desc: 'A dark sale banner drops in from above with a blur. Its code chip decodes SUMMER30: each letter is a reel of random characters (a clip window) that rolls up and lands on its letter, left to right. On the last one an accent outline fades in around the chip as it gives a small settle.',
  build: () => {
    const CODE = 'SUMMER30', D0 = 0.9, GAP = 0.085, DUR = 0.58, H = 62, CXC = 374, SZ = 44;
    // measured prefix widths of SUMMER30 at 44 px / 600 / 0.08 em → each letter's centre and advance
    const PRE = [0, 32.1, 68.2, 111.6, 155.1, 187.1, 222.4, 250.4, 278.4], LS = 3.52, WW = PRE[8] - LS;
    // random characters per reel, each no wider than its letter's advance (so no reel spills into its neighbour)
    const REEL = [['7', 'F', 'Z'], ['X', 'D', 'H'], ['W', 'Q', 'B'], ['A', 'G', 'N'], ['4', 'L', 'T'], ['P', 'K', 'Y'], ['8', '1', '6'], ['5', '9', '2']];
    const reels = [...CODE].map((c, i) => {
      const x = +(-WW / 2 + (PRE[i] + PRE[i + 1] - LS) / 2).toFixed(1), w = +(PRE[i + 1] - PRE[i] + 1).toFixed(1), t = +(D0 + i * GAP).toFixed(3);
      const vals = [...REEL[i], c];
      return rect({ id: 'reel' + i, x, w, h: H, clip: true, ch: [
        group({ id: 'reel' + i + 'Col', k: { y: [H, [t, t + DUR, -H * (vals.length - 1), 'Power3 Out']] },
          ch: vals.map((v, j) => text({ text: v, y: j * H, size: SZ, weight: 600, color: 'inv' })) }),
      ] });
    });
    const END = D0 + 7 * GAP + DUR;
    return [
      rect({ id: 'banner', w: 1200, h: 196, r: 40, fill: 'ink', shadow: 2, k: {
        y: [-110, [0.1, 0.72, 0, 'Power4 Out']], opacity: [0, [0.1, 0.24, 1, 'Linear']], blur: [12, [0.1, 0.5, 0, 'Power2 Out']] }, ch: [
        circle({ id: 'sunDisc', x: -500, d: 104, fill: 'inv/12', k: pop(0.3, { from: 0.4 }), ch: [icon({ icon: 'sun', size: 50, color: 'inv', sw: 2.4 })] }),
        text({ id: 'offer', text: '30% off everything', x: -420, y: -24, ax: 0, size: 40, weight: 600, ls: -0.02, color: 'inv', k: enter(0.36, { dx: -16, x0: -420 }) }),
        text({ id: 'sub', text: 'Summer sale · use the code at checkout', x: -420, y: 22, ax: 0, size: 26, color: 'inv/60', k: enter(0.44) }),
        group({ id: 'chip', x: CXC, k: k(enter(0.5, { blur: 0, s: 0.92 }), { scale: [[END - 0.1, END + 0.02, 1.05, 'Power2 Out'], [END + 0.02, END + 0.4, 1, 'Power3 Out']] }), ch: [
          rect({ id: 'chipBg', w: 356, h: 100, r: 24, fill: 'inv/10', stroke: 'inv/35', sw: 3, dash: true }),
          ...reels,
          // the landed state: a solid accent outline fades in over the dashed one
          rect({ id: 'chipDone', w: 356, h: 100, r: 24, stroke: 'acc', sw: 3, k: { opacity: [0, [END - 0.1, END + 0.15, 1, 'Power2 Out']] } }),
        ] }),
      ] }),
    ];
  },
});

// 6 ─ Offer → savings: the offer's code chip lifts and flies into the total, the old price strikes out and the savings count up
UIK.define({
  id: 'code-offer', name: 'Offer → savings', cat: 'promo', T: 4.1, cam: 1.3,
  desc: 'An order card with one offer. The cursor taps the SOUND20 chip: it lifts onto a shadow and flies on an arc up into the Total line, where it settles. A line strikes through $210.00, which shrinks and greys aside as $168.00 slides in, and an accent "You saved $42.00" chip pops with its amount counting up (a COUNTER placeholder).',
  build: () => {
    const C = 1.2, L = C + 0.06, D = L + 0.8, TY = -26, OY = 214, CHX = 282, DX = -203, EZ = 'Power4 Out';
    const chip = (id, kk, shadow) => group({ id, k: kk, ch: [
      rect({ w: 160, h: 52, r: 26, fill: 'ink', shadow }),
      text({ text: 'SOUND20', size: 24, weight: 600, ls: 0.06, color: 'inv' }),
    ] });
    return [
      rect({ id: 'card', y: 1, w: 860, h: 602, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, { from: 0.7 }), ch: [
        text({ id: 'title', text: 'Your order', x: -382, y: -237, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -382 }) }),
        text({ id: 'count', text: '1 item', x: 382, y: -237, ax: 1, size: 24, color: 'muted', k: enter(0.28) }),
        group({ id: 'item', y: -147, k: enter(0.3, { dx: -18, x0: 0 }), ch: [
          photo({ id: 'thumb', v: 6, x: -334, w: 96, h: 96, r: 22 }),
          text({ text: 'Studio Speaker', x: -270, y: -18, ax: 0, size: 30, weight: 600, ls: -0.01 }),
          text({ text: 'Sand · Wireless', x: -270, y: 18, ax: 0, size: 24, color: 'muted' }),
          text({ text: '$210.00', x: 382, y: -18, ax: 1, size: 28, weight: 500 }),
          text({ text: 'Qty 1', x: 382, y: 18, ax: 1, size: 24, color: 'muted' }),
        ] }),
        rect({ id: 'rule', y: -83, w: 764, h: 2, fill: 'line', k: fadeIn(0.38) }),
        text({ id: 'totalLbl', text: 'Total', x: -382, y: TY - 1, ax: 0, size: 36, weight: 600, ls: -0.02, k: enter(0.42) }),
        // the old total: struck, then shrinks about its right edge and steps aside for the new one
        group({ id: 'oldTotal', x: 382, y: TY, k: k(enter(0.46), { x: [[D + 0.35, D + 0.8, 222, EZ]], scale: [[D + 0.35, D + 0.8, 0.6, EZ]] }), ch: [
          text({ id: 'oldVal', text: '$210.00', ax: 1, size: 40, weight: 600, ls: -0.02, k: { color: [[D + 0.35, D + 0.6, 'muted', 'Power2 Out']] } }),
          path({ id: 'strike', d: 'M-146 2 H4', stroke: 'ink', sw: 4, trimmed: true, k: { trimE: [0, [D + 0.02, D + 0.32, 100, 'Power3 Out']], stroke: [[D + 0.35, D + 0.6, 'muted', 'Power2 Out']] } }),
        ] }),
        text({ id: 'newVal', text: '$168.00', x: 382, y: TY, ax: 1, size: 40, weight: 600, ls: -0.02, k: enter(D + 0.45, { dx: 28, x0: 382 }) }),
        rect({ id: 'saved', x: 382, y: 38, pin: 'r', chAt: 'pin', w: 230, h: 46, r: 23, fill: 'acc/12', k: pop(D + 0.6, { from: 0.5 }), ch: [
          text({ id: 'savedLbl', text: `You saved $\{{{COUNTER:0-42; start=${+(D + 0.66).toFixed(2)}; duration=0.8; turns=0; width=fit}}}.00`, x: -16, ax: 1, size: 24, weight: 600, color: 'acc' }),
        ] }),
        rect({ id: 'rule2', y: 98, w: 764, h: 2, fill: 'line', k: fadeIn(0.48) }),
        text({ id: 'offersCap', text: 'Offers for you', x: -382, y: 142, ax: 0, size: 24, weight: 500, color: 'muted', k: enter(0.5) }),
        rect({ id: 'offer', y: OY, w: 764, h: 96, r: 24, fill: 'panel', k: enter(0.56, { dy: 14, y0: OY, blur: 0 }), ch: [
          icon({ id: 'tagIc', paths: TAG, x: -340, size: 30, sw: 2.4 }),
          text({ text: '20% off speakers & audio', x: -302, y: -16, ax: 0, size: 26, weight: 500 }),
          text({ text: 'Minimum spend $150', x: -302, y: 18, ax: 0, size: 22, color: 'muted' }),
          chip('chipInRow', { x: CHX, opacity: [[L, 0]] }),
          group({ id: 'appliedLbl', x: CHX, k: enter(L + 0.3), ch: [
            icon({ icon: 'check', x: -46, size: 26, sw: 3, color: 'muted' }),
            text({ text: 'Applied', x: -26, ax: 0, size: 24, weight: 600, color: 'muted' }),
          ] }),
        ] }),
        // the flying chip: steps in over the row copy at the tap, lifts onto a shadow, arcs up into the Total line
        chip('chipFly', { x: [CHX, [L + 0.1, L + 0.8, DX, 'Power2 Smooth']], y: [OY, [L + 0.1, L + 0.8, TY, 'Power3 Out']], opacity: [0, [L, 1]],
          scale: [[L - 0.07, L, 0.95, 'Power2 Out'], [L, L + 0.18, 1.1, 'Power2 Out'], [L + 0.62, L + 0.9, 1, 'Power3 Out']] }, 2),
      ] }),
      cursorLayer([[0, 560, 380], [0.55, 560, 380], [C - 0.1, CHX + 10, OY + 12], [C + 0.2, CHX + 10, OY + 12], [C + 0.9, 540, 370]], [C], [], { inAt: 0.5 }),
    ];
  },
});

})();
