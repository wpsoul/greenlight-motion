/* UI Motion Kit — text elements. */
(function () {
const { rect, circle, ellipse, text, path, icon, group, k, enter, exit, pop, press, cursorLayer, stagger } = UIK.h;

// ── local helpers ──
// Word widths below are measured in Helvetica (the stage font = the Video Editor's) at the given size /
// weight / letter-spacing (measured on the stage itself), so words that sit side by side as
// separate layers keep natural spacing.
// the kit's opening beat: the main shape pops in from empty
const popIn = (t = 0.1, from = 0.65) => ({ scale: [from, [t, t + 0.52, 1, 'Back Out']], opacity: [0, [t, t + 0.12, 1, 'Linear']] });
// fade only (rules, tracks, backdrops)
const fadeIn = (t, dur = 0.3) => ({ opacity: [0, [t, t + dur, 1, 'Power2 Out']] });
// time u (0…1) at which a VE easing reaches progress p — to key events on a line that draws with one easing
const invEase = (name, p) => {
  const f = UIK.ease(name); let a = 0, b = 1;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (f(m) < p) a = m; else b = m; }
  return (a + b) / 2;
};
// a mask reveal: a clip rect (no fill) whose child text rises from below its bottom edge
const rise = (t, from, o = {}) => ({ y: [(o.y0 || 0) + from, [t, t + (o.dur ?? 0.75), o.y0 || 0, o.e || 'Power4 Out']] });

// 1 ─ Headline rise: every word rises from behind its own mask, then the key word wipes to the accent
UIK.define({
  id: 'headline-rise', name: 'Headline rise', cat: 'text', T: 3.0,
  cam: { zoom: 1.42, y: -10, k: { zoom: [[0, 2.5, 1.5, 'Power2 Smooth']] } },
  desc: 'A two-line headline: each word rises from behind its own mask on a stagger with a slight swing, then an accent copy of the key word wipes across it left to right while the camera eases in.',
  build: () => {
    const S = 120, MH = 172, SP = 29.8, W = 1.6;
    const lines = [
      { y: -66, t: 0.22, words: [['Great', 297.6], ['motion', 378.1], ['is', 88.2]] },
      { y: 66, t: 0.5, words: [['felt', 197.4, 167.6], ['not', 175.9], ['seen.', 288.7]] },
    ];
    const out = [];
    let felt = null;
    for (const L of lines) {
      const tot = L.words.reduce((a, w) => a + w[1], 0) + SP * (L.words.length - 1);
      let x = -tot / 2;
      L.words.forEach(([s, w, core], i) => {
        const t = L.t + i * 0.08, hw = w / 2;
        const ch = core
          // "felt," — the word and its comma are separate layers so only the word takes the accent
          ? [text({ id: 'w_' + s, text: s, x: -hw, ax: 0, size: S, weight: 600, ls: -0.03, k: k(rise(t, MH), { rot: [4, [t, t + 0.75, 0, 'Power4 Out']], color: [[W + 0.6, 'acc']] }) }),
             text({ id: 'w_comma', text: ',', x: -hw + core, ax: 0, size: S, weight: 600, ls: -0.03, k: rise(t + 0.02, MH) })]
          : [text({ id: 'w_' + s.replace('.', ''), text: s, x: -hw, ax: 0, size: S, weight: 600, ls: -0.03, k: k(rise(t, MH), { rot: [4, [t, t + 0.75, 0, 'Power4 Out']] }) })];
        out.push(rect({ id: 'm_' + s.replace(/\W/g, ''), x: x + hw, y: L.y, w: w + 28, h: MH, clip: true, ch }));
        if (core) felt = { x, y: L.y, w: core };
        x += w + SP;
      });
    }
    return [
      text({ id: 'eyebrow', text: 'Principle 01', y: -172, size: 28, weight: 600, ls: 0.16, upper: true, color: 'muted', k: enter(0.1, { dy: 12, y0: -172 }) }),
      ...out,
      // the accent copy sits in a clip pinned to the word's left edge; growing w wipes it on
      rect({ id: 'wipe', x: felt.x - 10, y: felt.y, pin: 'l', chAt: 'pin', w: 0, h: MH, clip: true, k: { w: [[W, W + 0.55, felt.w + 20, 'Power3 Out']] }, ch: [
        text({ id: 'feltAcc', text: 'felt', x: 10, ax: 0, size: S, weight: 600, ls: -0.03, color: 'acc' }),
      ] }),
    ];
  },
});

// 2 ─ Marker highlight: a tinted marker sweeps behind one phrase (it turns bold), an underline draws under another
UIK.define({
  id: 'marker-highlight', name: 'Marker highlight', cat: 'text', T: 3.4, cam: { zoom: 1.45, y: 4 },
  desc: 'A three-line statement settles in muted. An accent-tinted marker sweeps in behind one phrase while it swaps to bold ink, then an accent underline writes on under a second phrase as it darkens.',
  build: () => {
    const S = 64, X0 = -433, Y = [-92, 0, 92], M = 1.05, U = 2.0;
    const base = { size: S, weight: 500, ls: -0.02, ax: 0 };
    const SPC = 16.6, px = X0 + 244.5 + SPC, ux = X0 + 107.6 + SPC, uw = 639.4, uy = Y[2] + 44;
    return [
      rect({ id: 'marker', x: px - 10, y: Y[1] + 3, pin: 'l', w: 0, h: 70, r: 12, rot: -0.8, fill: 'acc/22', k: { w: [[M, M + 0.55, 392.3 + 20, 'Power3 Out']] } }),
      text(Object.assign({ id: 'line1', text: 'Motion should never decorate.', x: X0, y: Y[0], color: 'muted', k: enter(0.15, { dy: 20, y0: Y[0] }) }, base)),
      text(Object.assign({ id: 'line2a', text: 'It should', x: X0, y: Y[1], color: 'muted', k: enter(0.25, { dy: 20, y0: Y[1] }) }, base)),
      text(Object.assign({ id: 'phraseReg', text: 'guide the eye', x: px, y: Y[1], color: 'muted', k: k(enter(0.25, { dy: 20, y0: Y[1] }), { opacity: [[M + 0.12, M + 0.3, 0, 'Power2 Out']] }) }, base)),
      text(Object.assign({}, base, { id: 'phraseBold', text: 'guide the eye', x: px, y: Y[1], weight: 700, color: 'ink', k: { opacity: [0, [M + 0.12, M + 0.34, 1, 'Power2 Out']] } })),
      text(Object.assign({ id: 'line3a', text: 'and', x: X0, y: Y[2], color: 'muted', k: enter(0.35, { dy: 20, y0: Y[2] }) }, base)),
      text(Object.assign({ id: 'phrase2', text: 'explain what changed.', x: ux, y: Y[2], color: 'muted', k: k(enter(0.35, { dy: 20, y0: Y[2] }), { color: [[U, U + 0.35, 'ink', 'Power2 Out']] }) }, base)),
      path({ id: 'underline', d: `M${ux} ${uy} Q${ux + uw / 2} ${uy + 12} ${ux + uw} ${uy - 3}`, stroke: 'acc', sw: 7, trimmed: true, k: { trimE: [0, [U, U + 0.6, 100, 'Power3 Out']] } }),
    ];
  },
});

// 3 ─ Quote card: accent quote marks pop, the quote enters line by line with blur, the attribution slides in
UIK.define({
  id: 'quote-card', name: 'Quote card', cat: 'text', T: 3.3,
  cam: { zoom: 1.3, k: { zoom: [[0.3, 2.9, 1.35, 'Sine Smooth']] } },
  desc: 'A card pops in, big accent quotation marks pop and settle, the quote unblurs in line by line, a hairline draws and the attribution (avatar, name, role) slides in before a quiet hold.',
  build: () => {
    const X0 = -390, LY = [-100, -26, 48], A = 1.5;
    const lines = ['Motion is the difference', 'between a screen that works', 'and one that feels alive.'];
    return [
      rect({ id: 'card', w: 1000, h: 620, r: 48, fill: 'card', shadow: 1, k: popIn(0.08, 0.7), ch: [
        text({ id: 'quoteMark', text: '“', x: X0 - 8, y: -190, ax: 0, size: 220, weight: 700, color: 'acc', tnum: false,
          k: k(pop(0.28, { from: 0.4, dur: 0.5 }), { rot: [-10, [0.28, 0.78, 0, 'Power3 Out']] }) }),
        ...lines.map((s, i) => text({ id: 'q' + i, text: s, x: X0, y: LY[i], ax: 0, size: 60, weight: 500, ls: -0.02,
          k: enter(0.55 + i * 0.17, { dy: 18, y0: LY[i], blur: 14, dur: 0.42, s: 1 }) })),
        rect({ id: 'rule', x: X0, y: 124, pin: 'l', w: 0, h: 2, fill: 'line', k: { w: [[A - 0.15, A + 0.45, 780, 'Power3 Out']] } }),
        circle({ id: 'avatar', x: X0 + 36, y: 196, d: 72, fill: 'ink', k: pop(A, { from: 0.5 }), ch: [text({ text: 'ME', size: 24, weight: 600, color: 'inv' })] }),
        text({ id: 'name', text: 'Mara Ellison', x: X0 + 96, y: 178, ax: 0, size: 32, weight: 600, ls: -0.01, k: enter(A + 0.06, { dx: -18, x0: X0 + 96 }) }),
        text({ id: 'role', text: 'Design lead · Studio Fold', x: X0 + 96, y: 216, ax: 0, size: 26, color: 'muted', k: enter(A + 0.14, { dx: -18, x0: X0 + 96 }) }),
      ] }),
    ];
  },
});

// 4 ─ Lower third: an accent bar grows, a plate wipes open from it, name + role slide out from its edge, then it all closes
UIK.define({
  id: 'lower-third', name: 'Lower third', cat: 'text', T: 4.0, cam: 1.1,
  desc: 'Over a video frame, an accent bar grows, a white plate wipes open from it and the name and role slide out from behind its edge. It holds, then everything retracts in reverse and the frame is left clean.',
  build: () => {
    const BX = -640, BY = 250, PW = 690, PH = 166, C = 2.6;
    return [
      rect({ id: 'frame', w: 1500, h: 844, r: 32, fill: 'dim', clip: true, k: fadeIn(0.02, 0.3), ch: [
        // an out-of-focus subject: head and shoulders
        circle({ id: 'head', x: 250, y: -80, d: 240, fill: 'ink/7' }),
        ellipse({ id: 'shoulders', x: 250, y: 310, w: 680, h: 400, fill: 'ink/7' }),
        rect({ id: 'bar', x: BX, y: BY, w: 12, h: 0, r: 3, fill: 'acc', k: { h: [[0.32, 0.8, PH, 'Power4 Out'], [C + 0.55, C + 0.85, 0, 'Power2 In']] } }),
        rect({ id: 'plate', x: BX + 6, y: BY, pin: 'l', chAt: 'pin', w: 0, h: PH, radii: '0 18px 18px 0', fill: 'card', shadow: 1, clip: true,
          k: { w: [[0.55, 1.2, PW, 'Expo Out'], [C + 0.22, C + 0.6, 0, 'Power2 In']] }, ch: [
            text({ id: 'name', text: 'Lena Ortiz', x: 44, y: -26, ax: 0, size: 68, weight: 600, ls: -0.02,
              k: { x: [-360, [0.68, 1.35, 44, 'Power4 Out'], [C + 0.06, C + 0.36, -360, 'Power2 In']] } }),
            text({ id: 'role', text: 'Head of Motion Design', x: 46, y: 38, ax: 0, size: 36, color: 'muted',
              k: { x: [-410, [0.78, 1.45, 46, 'Power4 Out'], [C, C + 0.3, -410, 'Power2 In']] } }),
          ] }),
      ] }),
    ];
  },
});

// 5 ─ Stat callout: a huge 3× scales in while the digit rolls up, a rule draws, the label and source follow
UIK.define({
  id: 'stat-callout', name: 'Stat callout', cat: 'text', T: 2.8, cam: { zoom: 1.45, y: 26 },
  desc: 'A huge 3× scales in while the digit rolls up from 0 in its window (with a touch of speed blur) and the accent × slides in; a thin rule draws out from the centre, the label rises in and a small source caption fades up.',
  build: () => {
    const H = 360, SZ = 320;
    return [
      group({ id: 'number', y: -80, k: { scale: [0.82, [0.1, 0.9, 1, 'Power3 Out']], opacity: [0, [0.1, 0.25, 1, 'Linear']] }, ch: [
        // a COUNTER placeholder (Odometer): 0 rolls up to 3
        text({ id: 'digit', text: '{{{COUNTER:0-3; start=0.15; duration=0.9; easing=power4_out; turns=0}}}', x: -64, size: SZ, weight: 600, ls: -0.04 }),
        text({ id: 'times', text: '×', x: 116, y: 12, size: 230, weight: 500, color: 'acc', tnum: false, k: enter(0.72, { dx: -26, x0: 116, s: 0.8 }) }),
      ] }),
      rect({ id: 'rule', y: 142, w: 0, h: 4, r: 2, fill: 'ink', k: { w: [[1.05, 1.65, 720, 'Power3 Out']] } }),
      text({ id: 'label', text: 'faster renders on every export', y: 214, size: 52, weight: 500, ls: -0.02, k: enter(1.25, { dy: 18, y0: 214 }) }),
      text({ id: 'source', text: 'Source: internal benchmark, Sep 2026', y: 280, size: 27, color: 'muted', k: enter(1.7, { blur: 0, s: 1, dy: 8, y0: 280 }) }),
    ];
  },
});

// 6 ─ Word rotator: the word in the ink pill rolls to the next one while the pill resizes to fit it
UIK.define({
  id: 'word-rotator', name: 'Word rotator', cat: 'text', T: 3.6, cam: { zoom: 1.55, y: 20 },
  desc: 'Build [faster]: the word inside an ink pill rolls up to better, then together, while the pill resizes to fit each word and the line re-centres in the same beat; the last word arrives on an accent row, so the fill changes on the roll edge.',
  build: () => {
    const PH = 150, PAD = 46, BW = 250.1, GAP = 28, R1 = 1.35, R2 = 2.35;
    const W = [283.7, 293.9, 419.8].map((w) => w + 2 * PAD);
    const gx = W.map((w) => -(BW + GAP + w) / 2);
    const roll = (t) => [t, t + 0.6, 0, 'Power4 Out'];
    const mblur = (t) => [[t, t + 0.08, 5, 'Power2 Out'], [t + 0.08, t + 0.4, 0, 'Power2 Out']];
    const word = (s, i, color) => text({ id: 'word' + i, text: s, x: PAD, y: i * PH, ax: 0, size: 110, weight: 600, ls: -0.03, color });
    return [
      group({ id: 'line', x: gx[0], k: { x: [[R1, R1 + 0.6, gx[1], 'Power4 Out'], [R2, R2 + 0.6, gx[2], 'Power4 Out']] }, ch: [
        text({ id: 'build', text: 'Build', ax: 0, size: 110, weight: 600, ls: -0.03, k: enter(0.1, { dx: -20, x0: 0 }) }),
        rect({ id: 'pill', x: BW + GAP, pin: 'l', chAt: 'pin', w: W[0], h: PH, r: PH / 2, fill: 'ink', clip: true,
          k: k(popIn(0.2, 0.6), { w: [[R1, R1 + 0.6, W[1], 'Power4 Out'], [R2, R2 + 0.6, W[2], 'Power4 Out']] }), ch: [
            group({ id: 'column', y: PH, k: { y: [[0.34, 0.94, 0, 'Power4 Out'], [R1, R1 + 0.6, -PH, 'Power4 Out'], [R2, R2 + 0.6, -2 * PH, 'Power4 Out']], blur: [...mblur(R1), ...mblur(R2)] }, ch: [
              rect({ id: 'accRow', x: 300, y: 2 * PH, w: 600, h: PH, fill: 'acc' }),
              word('faster', 0, 'inv'), word('better', 1, 'inv'), word('together', 2, '#FFFFFF'),
            ] }),
          ] }),
      ] }),
      text({ id: 'sub', text: 'with a motion system your whole team can share', y: 142, size: 36, color: 'muted', k: enter(0.5, { dy: 12, y0: 142 }) }),
    ];
  },
});

// 7 ─ Numbered list: each number rolls in, a hairline draws, the item slides in; finished items dim and get a check
UIK.define({
  id: 'numbered-list', name: 'Numbered list', cat: 'text', T: 3.6, cam: { zoom: 1.45, y: 4 },
  desc: 'A title settles, then each item arrives in turn: its accent number rolls up from 00 in a digit window, a hairline draws across under it and the text slides in from the left. The previous item dims and a small check pops at its end.',
  build: () => {
    const X0 = -440, RY = [-96, 40, 176], DH = 70, S = RY.map((_, i) => 0.45 + i * 0.85);
    const items = ['Start from a still frame', 'Move one thing at a time', 'Hold the final state'];
    return [
      text({ id: 'title', text: 'Three rules for motion', x: X0, y: -228, ax: 0, size: 48, weight: 600, ls: -0.02, k: enter(0.12, { dx: -18, x0: X0 }) }),
      ...RY.map((y, i) => rect({ id: 'rule' + i, x: X0, y: y + 68, pin: 'l', w: 0, h: 2, fill: 'line', k: { w: [[S[i], S[i] + 0.7, 880, 'Power3 Out']] } })),
      ...RY.map((y, i) => {
        const s = S[i], dim = S[i + 1];
        return group({ id: 'item' + i, y, k: dim ? { opacity: [[dim + 0.05, dim + 0.4, 0.3, 'Power2 Out']] } : undefined, ch: [
          group({ id: 'num' + i, k: enter(s, { dy: 14, y0: 0, blur: 0, s: 1 }), ch: [
            // a zero-padded COUNTER placeholder (Odometer): 00 rolls up to the item's number
            text({ id: 'n' + i, text: `{{{COUNTER:00-0${i + 1}; start=${+(s + 0.08).toFixed(3)}; duration=0.72; easing=power4_out; turns=0}}}`, x: X0, ax: 0, size: 52, weight: 600, ls: -0.02, color: 'acc' }),
          ] }),
          text({ id: 'text' + i, text: items[i], x: X0 + 120, ax: 0, size: 50, weight: 500, ls: -0.02, k: enter(s + 0.14, { dx: -26, x0: X0 + 120 }) }),
        ] });
      }),
      ...[0, 1].map((i) => icon({ id: 'done' + i, icon: 'check', x: X0 + 856, y: RY[i], size: 34, sw: 2.8, color: 'muted', k: pop(S[i + 1] + 0.15) })),
    ];
  },
});

// 8 ─ Definition: the word types in large, an accent underline draws, phonetics + part of speech follow, then the meaning
UIK.define({
  id: 'definition', name: 'Definition card', cat: 'text', T: 3.1, cam: 1.35,
  desc: 'A dictionary card: the word types in large with a caret, an accent underline writes on beneath it, the phonetic line fades in and a noun chip pops, then the definition rises in line by line while a small easing curve draws itself in a tile.',
  build: () => {
    const X0 = -470, WY = -122, U = 1.0;
    const ux = X0 + 2, uy = WY + 94;
    return [
      rect({ id: 'card', w: 1060, h: 540, r: 44, fill: 'card', shadow: 1, k: popIn(0.08, 0.7), ch: [
        text({ id: 'word', text: 'easing', x: X0, y: WY, ax: 0, size: 150, weight: 600, ls: -0.035,
          caret: true, caretColor: 'ink', caretFrom: 0.28, caretUntil: 1.15, k: { reveal: [0, [0.35, 0.95, 1, 'Linear']] } }),
        path({ id: 'underline', d: `M${ux} ${uy} Q${ux + 220} ${uy + 10} ${ux + 440} ${uy - 4}`, stroke: 'acc', sw: 9, trimmed: true, k: { trimE: [0, [U, U + 0.5, 100, 'Power3 Out']] } }),
        text({ id: 'phonetic', text: 'ee·zing', x: X0 + 480, y: WY + 26, ax: 0, size: 38, color: 'muted', k: enter(U + 0.12, { dx: -14, x0: X0 + 480 }) }),
        rect({ id: 'pos', x: X0 + 480 + 122.5 + 22 + 54, y: WY + 26, w: 108, h: 50, r: 25, fill: 'soft', k: pop(U + 0.3, { from: 0.5 }),
          ch: [text({ text: 'noun', size: 28, weight: 500 })] }),
        text({ id: 'def0', text: 'The rate at which a motion speeds up', x: X0, y: 34, ax: 0, size: 40, ls: -0.01, k: enter(1.6, { dy: 16, y0: 34 }) }),
        text({ id: 'def1', text: 'or slows down over time.', x: X0, y: 88, ax: 0, size: 40, ls: -0.01, k: enter(1.7, { dy: 16, y0: 88 }) }),
        text({ id: 'example', text: '“Every exit gets a gentle easing.”', x: X0, y: 170, ax: 0, size: 30, color: 'muted', k: enter(1.9) }),
        rect({ id: 'tile', x: 380, y: 92, w: 200, h: 200, r: 32, fill: 'soft', k: enter(1.45, { blur: 0, s: 0.9 }), ch: [
          path({ id: 'axes', d: 'M-62 -66 L-62 62 L66 62', stroke: 'dim', sw: 3, k: fadeIn(1.5) }),
          path({ id: 'curve', d: 'M-62 62 C-10 62 6 -62 66 -62', stroke: 'ink', sw: 6, trimmed: true, k: { trimE: [0, [1.75, 2.45, 100, 'Power2 Smooth']] } }),
          circle({ id: 'c0', x: -62, y: 62, d: 16, fill: 'ink', k: pop(1.7) }),
          circle({ id: 'c1', x: 66, y: -62, d: 16, fill: 'ink', k: pop(2.4) }),
        ] }),
      ] }),
    ];
  },
});

// 9 ─ Strike & correct: a line strikes "slow", "fast" appears above in accent, then drops into its place as the sentence re-flows
UIK.define({
  id: 'strike-correction', name: 'Strike & correct', cat: 'text', T: 3.6, cam: { zoom: 1.18, y: -10 },
  desc: 'A sentence rises in. A line strikes through "slow" and it dims; "fast" rises in above it in accent like an editor’s correction, then "slow" drops away while "fast" settles into its place and the rest of the line closes up.',
  build: () => {
    const S = 84, Y = 30, XA = -590.8, XS = -4.3, XB0 = 192.6, XB1 = 165.1, ST = 0.95, F = 1.55, M = 2.3;
    const base = { size: S, weight: 600, ls: -0.03, ax: 0 };
    return [
      text(Object.assign({ id: 'head', text: 'Editing video is', x: XA, y: Y, k: enter(0.12, { dy: 24, y0: Y }) }, base)),
      group({ id: 'slowG', k: { opacity: [[ST + 0.45, ST + 0.75, 0.4, 'Power2 Out'], [M, M + 0.28, 0, 'Power2 In']], y: [[M, M + 0.3, 44, 'Power2 In']], blur: [[M, M + 0.3, 8, 'Power2 In']] }, ch: [
        text(Object.assign({ id: 'slow', text: 'slow', x: XS, y: Y, k: enter(0.2, { dy: 24, y0: Y }) }, base)),
        path({ id: 'strike', d: `M${XS - 3} ${Y + 6} L${XS + 179 + 3} ${Y + 2}`, stroke: 'ink', sw: 7, trimmed: true, k: { trimE: [0, [ST, ST + 0.38, 100, 'Power3 Out']] } }),
      ] }),
      text(Object.assign({ id: 'fast', text: 'fast', x: XS, color: 'acc',
        k: { opacity: [0, [F, F + 0.3, 1, 'Power2 Out']], blur: [10, [F, F + 0.35, 0, 'Power2 Out']],
             y: [Y - 64, [F, F + 0.55, Y - 104, 'Power3 Out'], [M + 0.12, M + 0.72, Y, 'Power4 Out']],
             scale: [0.68, [M + 0.12, M + 0.72, 1, 'Power4 Out']] } }, base)),
      text(Object.assign({ id: 'tail', text: 'by default.', x: XB0, y: Y, k: k(enter(0.28, { dy: 24, y0: Y }), { x: [[M + 0.12, M + 0.72, XB1, 'Power4 Out']] }) }, base)),
    ];
  },
});

// 10 ─ Tag cloud: keywords pop in centre-out at mixed sizes, the camera drifts, one keyword takes the accent
UIK.define({
  id: 'tag-cloud', name: 'Tag cloud', cat: 'text', T: 3.6,
  cam: { zoom: 1.1, x: -62, y: 6, k: { zoom: [[0.6, 3.2, 1.17, 'Sine Smooth']], x: [[0.6, 3.2, -24, 'Sine Smooth']], y: [[0.6, 3.2, -6, 'Sine Smooth']] } },
  desc: 'Twelve keywords pop in from the centre outward at mixed sizes and weights while the camera slowly drifts in; then an accent pill grows behind the key word, it turns white and the rest of the cloud recedes.',
  build: () => {
    const H = 2.15;
    const T = [
      ['Motion', 0, 0, 130, 700, 'ink', -0.03], ['Keyframes', 200, -176, 70, 600, 'ink', -0.02], ['Springs', -420, 22, 54, 600, 'ink', -0.02],
      ['Masks', 362, -30, 38, 500, 'muted'], ['Rhythm', 140, 176, 58, 600, 'ink', -0.02], ['Easing', -330, -170, 64, 600, 'ink', -0.02],
      ['Typography', -330, 182, 50, 500, 'ink', -0.01], ['Color', 562, 42, 48, 600, 'ink', -0.02], ['Contrast', 482, 192, 44, 500, 'muted'],
      ['Timing', 560, -200, 44, 500, 'muted'], ['Depth', -636, -40, 36, 400, 'muted'], ['Layers', -612, -214, 40, 400, 'muted'],
    ];
    return [
      rect({ id: 'hlPill', w: 421.2 + 84, h: 172, r: 86, fill: 'acc', k: { scale: [0.8, [H, H + 0.5, 1, 'Power3 Out']], opacity: [0, [H, H + 0.16, 1, 'Power2 Out']] } }),
      ...T.map(([s, x, y, size, weight, color, ls], i) => {
        const t = 0.18 + i * 0.075;
        return text({ id: 'tag_' + s, text: s, x, y, size, weight, color, ls,
          k: k({ scale: [0.6, [t, t + 0.45, 1, 'Back Out']], opacity: [0, [t, t + 0.14, 1, 'Power2 Out']], blur: [8, [t, t + 0.3, 0, 'Power2 Out']] },
            i === 0 ? { color: [[H + 0.04, H + 0.28, '#FFFFFF', 'Power2 Out']] } : { opacity: [[H, H + 0.4, 0.35, 'Power2 Out']] }) });
      }),
    ];
  },
});

// 11 ─ Split title: the title rises in whole, an accent blade slices it, the halves part vertically around a subtitle
UIK.define({
  id: 'split-title', name: 'Split title', cat: 'text', T: 3.3, cam: 1.05,
  desc: 'A big title rises in behind a mask. An accent blade swipes across its middle, then the top and bottom halves (two clips holding the same text, letters kept aligned) part vertically; the subtitle tracks in inside the gap and the halves ease back onto its edges, locking up as one title.',
  build: () => {
    const S = 180, C = 2, HH = 124, B = 1.1, SP = B + 0.2, OPEN = 66, LOCK = 42, CL = SP + 0.95;
    const half = (id, top) => group({ id, k: { y: [[SP, SP + 0.7, top ? -OPEN : OPEN, 'Power4 Out'], [CL, CL + 0.55, top ? -LOCK : LOCK, 'Power3 Out']] }, ch: [
      rect({ id: id + 'Clip', y: C + (top ? -HH / 2 : HH / 2), w: 1320, h: HH, clip: true, ch: [
        text({ id: id + 'Text', text: 'Make it move', y: top ? HH / 2 : -HH / 2, size: S, weight: 700, ls: -0.03, upper: true, k: rise(0.15, 250, { dur: 0.8, y0: top ? HH / 2 : -HH / 2 }) }),
      ] }),
    ] });
    return [
      half('top', true),
      half('bottom', false),
      path({ id: 'blade', d: `M-690 ${C} L690 ${C}`, stroke: 'acc', sw: 5, trimmed: true,
        k: { trimE: [0, [B, B + 0.32, 100, 'Power3 Out']], trimS: [0, [B + 0.22, B + 0.56, 100, 'Power2 In']] } }),
      text({ id: 'subtitle', text: 'A motion kit for product videos', y: C, size: 30, weight: 500, ls: 0.16, upper: true,
        k: { opacity: [0, [SP + 0.15, SP + 0.5, 1, 'Power2 Out']], blur: [8, [SP + 0.15, SP + 0.5, 0, 'Power2 Out']], ls: [0.42, [SP + 0.15, SP + 0.95, 0.16, 'Power3 Out']] } }),
    ];
  },
});

// 12 ─ Callout arrow: a label types, a curved arrow draws from it to a button, a hand-drawn loop circles the button
UIK.define({
  id: 'callout-arrow', name: 'Callout arrow', cat: 'text', T: 3.6, cam: { zoom: 1.4, x: -82, y: 4 },
  desc: 'A mock editor window settles. Beside it a label types in, a curved accent arrow draws from the label to the Export button (its head writes on last), then a hand-drawn loop circles the button and the button gives a small nudge.',
  build: () => {
    const WX = -300, WY = 10, BX = WX + 290, BY = WY - 218, A0 = 1.3, CI = 2.02;
    // the arrow: one cubic from the label to just outside the loop; the head is rotated to the end tangent
    const P0 = [214, 88], P1 = [232, -40], P2 = [164, -136], P3 = [104, -172];
    const ang = Math.atan2(P3[1] - P2[1], P3[0] - P2[0]) * 180 / Math.PI;
    // hand-drawn loop: a slightly tilted ellipse that overshoots its start (≈ 1.1 turns)
    const loop = [], RX = 94, RY = 44, TILT = -4 * Math.PI / 180;
    for (let i = 0; i <= 64; i++) {
      const u = i / 64, a = Math.PI * 1.05 + u * Math.PI * 2.2, g = 1 + 0.07 * u;
      const ex = Math.cos(a) * RX * g, ey = Math.sin(a) * RY * g;
      loop.push(`${(BX + ex * Math.cos(TILT) - ey * Math.sin(TILT)).toFixed(1)} ${(BY + ex * Math.sin(TILT) + ey * Math.cos(TILT)).toFixed(1)}`);
    }
    const skel = (id, x, y, w, t) => rect({ id, x, y, pin: 'l', w, h: 16, r: 8, fill: 'skel', k: fadeIn(t) });
    return [
      rect({ id: 'window', x: WX, y: WY, w: 780, h: 520, r: 28, fill: 'card', shadow: 1, k: popIn(0.08, 0.7), ch: [
        ...[0, 1, 2].map((i) => circle({ id: 'wdot' + i, x: -354 + i * 26, y: -218, d: 14, fill: 'dim' })),
        text({ id: 'wtitle', text: 'Untitled project', x: -80, y: -218, size: 24, weight: 500, color: 'muted', k: fadeIn(0.22) }),
        rect({ id: 'share', x: 118, y: -218, w: 112, h: 52, r: 26, fill: 'soft', k: fadeIn(0.26), ch: [text({ text: 'Share', size: 24, weight: 500 })] }),
        rect({ id: 'export', x: 290, y: -218, w: 144, h: 52, r: 26, fill: 'ink', k: k(fadeIn(0.28), { scale: [[CI + 0.5, CI + 0.64, 1.08, 'Power2 Out'], [CI + 0.64, CI + 0.95, 1, 'Power3 Out']] }), ch: [
          icon({ icon: 'upload', x: -38, size: 24, sw: 2.6, color: 'inv' }),
          text({ text: 'Export', x: 14, size: 24, weight: 600, color: 'inv' }),
        ] }),
        rect({ id: 'hair', y: -184, w: 780, h: 2, fill: 'line', k: fadeIn(0.24) }),
        rect({ id: 'preview', x: -100, y: 0, w: 540, h: 290, r: 20, fill: 'panel', k: fadeIn(0.3), ch: [icon({ icon: 'play', size: 56, sw: 2.6, color: 'dim' })] }),
        skel('sk0', 196, -120, 150, 0.34), skel('sk1', 196, -86, 110, 0.36), skel('sk2', 196, -52, 160, 0.38), skel('sk3', 196, -18, 90, 0.4),
        rect({ id: 'track', y: 200, w: 740, h: 44, r: 12, fill: 'soft', k: fadeIn(0.42), ch: [
          rect({ x: -270, w: 170, h: 28, r: 8, fill: 'skel' }), rect({ x: -50, w: 230, h: 28, r: 8, fill: 'skel' }), rect({ x: 190, w: 150, h: 28, r: 8, fill: 'skel' }),
        ] }),
      ] }),
      text({ id: 'label', text: 'New export button', x: 168, y: 130, ax: 0, size: 42, weight: 600, ls: -0.02,
        caret: true, caretColor: 'ink', caretFrom: 0.55, caretUntil: 1.45, k: { reveal: [0, [0.65, 1.25, 1, 'Linear']] } }),
      path({ id: 'arrow', d: `M${P0} C${P1} ${P2} ${P3}`, stroke: 'acc', sw: 6, trimmed: true, k: { trimE: [0, [A0, A0 + 0.55, 100, 'Power2 Smooth']] } }),
      path({ id: 'head', x: P3[0], y: P3[1], rot: +ang.toFixed(2), d: 'M-22 -13 L0 0 L-22 13', stroke: 'acc', sw: 6, trimmed: true, k: { trimE: [0, [A0 + 0.52, A0 + 0.68, 100, 'Power2 Out']] } }),
      path({ id: 'loop', d: 'M' + loop.join(' L'), stroke: 'acc', sw: 6, trimmed: true, k: { trimE: [0, [CI, CI + 0.6, 100, 'Power2 Smooth']] } }),
    ];
  },
});

// 13 ─ Karaoke caption: words light up one by one while an accent pill glides from word to word
UIK.define({
  id: 'karaoke-caption', name: 'Karaoke caption', cat: 'text', T: 3.6, cam: { zoom: 1.55, y: -50 },
  desc: 'A two-line caption plate sits low in frame. As each word is spoken an accent pill glides to it (stretching in flight), the word turns white on the pill and ink once passed while the words to come stay muted; at the line break the pill shrinks away and a second one pops on the next line.',
  build: () => {
    const G = 22, LY = [-42, 42], PH = 70, PAD = 12;
    const L = [[['Good', 140.7], ['motion', 179.8], ['guides', 171.6], ['the', 81.7], ['eye', 90]],
               [['and', 96.2], ['explains', 211.8], ['every', 138.7], ['change.', 204.8]]];
    const TW = [0.65, 0.9, 1.18, 1.44, 1.62, 1.98, 2.2, 2.52, 2.78];
    const W = [];
    L.forEach((line, li) => {
      const tot = line.reduce((a, w) => a + w[1], 0) + G * (line.length - 1);
      let x = -tot / 2;
      for (const [s, w] of line) { W.push({ s, w, cx: x + w / 2, y: LY[li], li }); x += w + G; }
    });
    // one pill per line: it glides word to word inside its line (each glide ends before the next word
    // starts, so segments never overlap) and stretches in flight; the line-1 pill shrinks away at the break
    const pill = (li) => {
      const js = W.map((w, j) => j).filter((j) => W[j].li === li), j0 = js[0], x = [], w = [];
      for (const j of js.slice(1)) {
        const t = TW[j], a = W[j - 1], pwj = W[j].w + 2 * PAD, d = Math.min(0.34, (TW[j + 1] ?? 9) - t - 0.01), m = +(t + d * 0.32).toFixed(3);
        x.push([t, t + d, W[j].cx, 'Power4 Out']);
        w.push([t, m, Math.max(a.w, W[j].w) + 2 * PAD + 0.3 * Math.abs(W[j].cx - a.cx), 'Power2 Out'], [m, t + d, pwj, 'Power3 Out']);
      }
      const end = li === 0 ? TW[js[js.length - 1] + 1] : null;
      return rect({ id: 'pill' + li, x: W[j0].cx, y: W[j0].y, w: W[j0].w + 2 * PAD, h: PH, r: PH / 2, fill: 'acc',
        k: { x, w, scale: [0.6, [TW[j0], TW[j0] + 0.35, 1, 'Back Out']].concat(end ? [[end, end + 0.16, 0.5, 'Power2 In']] : []),
             opacity: [0, [TW[j0], TW[j0] + 0.1, 1, 'Power2 Out']].concat(end ? [[end + 0.04, end + 0.16, 0, 'Power2 In']] : []) } });
    };
    return [
      rect({ id: 'plate', w: 940, h: 236, r: 36, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        pill(0), pill(1),
        ...W.map((w, j) => text({ id: 'w' + j + '_' + w.s.replace('.', ''), text: w.s, x: w.cx, y: w.y, size: 56, weight: 600, ls: -0.02, color: 'muted',
          k: k(enter(0.26 + w.li * 0.08, { blur: 8, s: 1 }), { color: [[TW[j] + 0.04, TW[j] + 0.14, '#FFFFFF', 'Power2 Out']].concat(j < W.length - 1 ? [[TW[j + 1] - 0.03, TW[j + 1] + 0.07, 'ink', 'Power2 Out']] : []) }) })),
        rect({ id: 'speaker', x: -470 + 40 + 86, y: -118, w: 172, h: 46, r: 23, fill: 'ink', k: pop(0.3, { from: 0.5 }), ch: [
          circle({ x: -60, d: 12, fill: 'acc' }),
          text({ text: 'Ava · Host', x: 10, size: 22, weight: 600, color: 'inv' }),
        ] }),
      ] }),
    ];
  },
});

// 14 ─ Timeline milestones: the line draws across, year dots pop as it reaches them, cards alternate above and below
UIK.define({
  id: 'timeline-milestones', name: 'Timeline milestones', cat: 'text', T: 2.9, cam: 1.15,
  desc: 'A start dot pops and a horizontal line draws across (Sine Smooth); each year dot pops the moment the tip reaches it, a stub grows and a milestone card slides away from the line, alternating above and below. The last dot is accent and a thin accent ring pops round it.',
  build: () => {
    const X0 = -660, X1 = 660, D0 = 0.2, DUR = 2.0, CY = 164;
    const M = [['2019', 'First prototype'], ['2021', 'Public beta'], ['2023', 'One million users'], ['2026', 'Version 3.0']];
    const xs = [-495, -165, 165, 495];
    const at = xs.map((x) => +(D0 + DUR * invEase('Sine Smooth', (x - X0) / (X1 - X0))).toFixed(3));
    return [
      circle({ id: 'start', x: X0, d: 14, fill: 'ink', k: pop(0.1) }),
      path({ id: 'line', d: `M${X0} 0 L${X1} 0`, stroke: 'ink', sw: 4, trimmed: true, k: { trimE: [0, [D0, D0 + DUR, 100, 'Sine Smooth']] } }),
      circle({ id: 'halo', x: xs[3], d: 50, stroke: 'acc', sw: 3, k: pop(at[3] + 0.12, { from: 0.4, dur: 0.5 }) }),
      ...M.map(([year, label], i) => {
        const up = i % 2 === 0, t = at[i], last = i === M.length - 1, cy = up ? -CY : CY;
        return group({ id: 'm' + i, x: xs[i], ch: [
          rect({ id: 'stub' + i, y: up ? -16 : 16, pin: up ? 'b' : 't', w: 2, h: 0, fill: 'ink/25', k: { h: [[t + 0.04, t + 0.4, CY - 64 - 16, 'Power3 Out']] } }),
          circle({ id: 'dot' + i, d: 26, fill: last ? 'acc' : 'ink', k: pop(t, { from: 0.3 }) }),
          rect({ id: 'card' + i, y: cy, w: 290, h: 128, r: 24, fill: 'card', shadow: 1, k: enter(t + 0.12, { dy: up ? 28 : -28, y0: cy, s: 0.96 }), ch: [
            text({ id: 'year' + i, text: year, x: -117, y: -22, ax: 0, size: 34, weight: 600, ls: -0.02, color: last ? 'acc' : 'ink', tnum: false }),
            text({ id: 'label' + i, text: label, x: -117, y: 24, ax: 0, size: 26, color: 'muted' }),
          ] }),
        ] });
      }),
    ];
  },
});

// 15 ─ Title card count: the 3 rolls up from 0, "things to know" types beside it, the title lifts and three chips line up
UIK.define({
  id: 'title-card-count', name: '3 things to know', cat: 'text', T: 3.4, cam: { zoom: 1.5, y: -18 },
  desc: 'An intro title: the accent 3 rolls up from 0 in its digit window with a touch of speed blur, "things to know" types in beside it, then the whole title lifts and three numbered chips pop into a row below it.',
  build: () => {
    const H = 280, SU = 1.9, TY = 49;
    const chips = [['Timing', 105.8, -271.5], ['Easing', 105.8, -22.1], ['Hierarchy', 150, 249.4]];
    return [
      group({ id: 'title', k: { y: [[SU, SU + 0.6, -100, 'Power4 Out']] }, ch: [
        group({ id: 'numG', k: { opacity: [0, [0.12, 0.26, 1, 'Linear']], scale: [0.85, [0.12, 0.8, 1, 'Power3 Out']] }, ch: [
          text({ id: 'three', text: '{{{COUNTER:0-3; start=0.18; duration=0.87; easing=power4_out; turns=0}}}', x: -343, size: 240, weight: 700, ls: -0.04, color: 'acc' }),
        ] }),
        text({ id: 'things', text: 'things to know', x: -234, y: TY, ax: 0, size: 96, weight: 600, ls: -0.03,
          caret: true, caretColor: 'ink', caretFrom: 0.8, caretUntil: 1.8, k: { reveal: [0, [0.88, 1.55, 1, 'Linear']] } }),
      ] }),
      ...chips.map(([s, w, x], i) => {
        const t = SU + 0.25 + i * 0.1, cw = 84 + w + 34;
        return rect({ id: 'chip' + i, x, y: 116, w: cw, h: 84, r: 42, fill: 'card', shadow: 1, k: enter(t, { dy: 26, y0: 116, blur: 6 }), ch: [
          circle({ id: 'n' + i, x: -cw / 2 + 42, d: 54, fill: 'ink', k: pop(t + 0.1, { from: 0.4 }), ch: [text({ text: String(i + 1), size: 26, weight: 600, color: 'inv', tnum: false })] }),
          text({ id: 'chipLbl' + i, text: s, x: -cw / 2 + 84, ax: 0, size: 34, weight: 500 }),
        ] });
      }),
    ];
  },
});

})();
