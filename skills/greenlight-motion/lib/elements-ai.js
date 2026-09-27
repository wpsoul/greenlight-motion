/* UI Motion Kit — ai elements. */
(function () {
const { rect, circle, ellipse, text, path, icon, group, k, enter, exit, pop, press, cursorLayer, stagger } = UIK.h;

// ── local helpers (plain functions that return ordinary layers / tracks) ──
// the main shape's entrance: pops from `from` with Back Out
const popIn = (t = 0.1, from = 0.65) => ({ scale: [from, [t, t + 0.52, 1, 'Back Out']], opacity: [0, [t, t + 0.12, 1, 'Linear']] });
// a fade-only entry (fields, hairlines — things that should not scale or blur in)
const fadeIn = (t) => enter(t, { blur: 0, s: 1 });
// a closed circle for Trim Paths, starting at 12 o'clock and running clockwise
const ring = (R) => `M0 -${R} A${R} ${R} 0 1 1 0 ${R} A${R} ${R} 0 1 1 0 -${R}`;
// deterministic 0…1 noise (speech bars) — frames stay a pure function of t
const rnd = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
// the moment an eased move a → b over [t0, t1] passes v (highlight hand-offs that follow the cursor)
const cross = (t0, t1, a, b, v, e = 'Power2 Smooth') => {
  const f = UIK.ease(e); let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2, x = a + (b - a) * f(m); if ((b - a) * (v - x) > 0) lo = m; else hi = m; }
  return +(t0 + (t1 - t0) * hi).toFixed(3);
};
// spinner: a faint track ring + a trimmed arc (28 %) turning at a steady rate from t0 to t1
const spinner = (id, o) => group({ id, x: o.x || 0, y: o.y || 0, k: o.k, ch: [
  path({ id: id + 'Track', d: ring(o.R), stroke: o.track || 'line', sw: o.sw || 4 }),
  path({ id: id + 'Arc', d: ring(o.R), stroke: o.color || 'ink', sw: o.sw || 4, trimmed: true, trimE: 28,
    k: { rot: [[o.t0, o.t1, Math.round(400 * (o.t1 - o.t0)), 'Linear']] } }),
] });
// a Lucide 24-grid path drawn at `size` (a custom-SVG shape): scaled about the layer point, stroke compensated
const THUMB_UP = ['M7 10v12', 'M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z'];
const THUMB_DOWN = ['M17 14V2', 'M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z'];
const glyph = (o) => { const s = o.size / 24; return path({ id: o.id, x: -12 * s, y: -12 * s, scale: s, d: o.d, stroke: o.color || 'ink', sw: (o.sw || 2.2) / s, fill: o.fill }); };

// 1 ─ Prompt box: the prompt types in, send morphs into stop, a response area opens with skeleton lines streaming in
UIK.define({
  id: 'ai-prompt-box', name: 'Prompt box', cat: 'ai', T: 4.6,
  cam: { zoom: 1.45, y: -110, k: { zoom: [[1.95, 2.7, 1.3, 'Power2 Smooth']], y: [[1.95, 2.7, 68, 'Power2 Smooth']] } },
  desc: 'A prompt types into the composer and the send button wakes up; the click squeezes it, the arrow flies out and a stop square pops in, while a response area opens below and skeleton lines stream in one after another.',
  build: () => {
    const TY0 = 0.6, TY1 = 1.65, C = 2.05, O = C + 0.12, CY = -110;
    const LW = [880, 820, 856, 540];
    let t = O + 0.42;
    const LT = LW.map((w) => { const a = t, d = +(w / 2300).toFixed(3); t += d + 0.03; return [a, a + d]; });
    return [
      rect({ id: 'composer', y: CY, w: 1000, h: 200, r: 48, fill: 'card', shadow: 1, k: popIn(0.1, 0.65), ch: [
        text({ id: 'placeholder', text: 'Ask anything', x: -440, y: -38, ax: 0, size: 34, color: 'muted', k: k(enter(0.2, { dur: 0.24 }), exit(TY0 - 0.04, { dur: 0.08, blur: 0 })) }),
        text({ id: 'prompt', text: 'Draft a launch plan for our new app', x: -440, y: -38, ax: 0, size: 34, caret: true, caretColor: 'ink', caretFrom: 0.45, caretUntil: C,
          k: { reveal: [0, [TY0, TY1, 1, 'Linear']] } }),
        circle({ id: 'plusBtn', x: -436, y: 50, d: 64, fill: 'card', stroke: 'line', sw: 2, k: fadeIn(0.34),
          ch: [icon({ icon: 'plus', size: 30, color: 'muted', sw: 2.4 })] }),
        rect({ id: 'searchChip', x: -290, y: 50, w: 156, h: 64, r: 32, fill: 'card', stroke: 'line', sw: 2, k: fadeIn(0.38), ch: [
          icon({ icon: 'globe', x: -40, size: 28, color: 'muted', sw: 2.2 }),
          text({ text: 'Search', x: -20, ax: 0, size: 24, weight: 500, color: 'muted' }),
        ] }),
        circle({ id: 'send', x: 436, y: 50, d: 76, fill: 'dim', k: k(fadeIn(0.42), { fill: [[TY0, TY0 + 0.2, 'ink', 'Power2 Out']] }, press(C, { to: 0.86 })), ch: [
          icon({ id: 'sendArrow', icon: 'arrowUp', size: 36, color: 'card', sw: 2.8,
            k: k({ color: [[TY0, TY0 + 0.2, 'inv', 'Power2 Out']], y: [[C, C + 0.16, -26, 'Power2 In']] }, exit(C, { s: 0.5, dur: 0.16 })) }),
          rect({ id: 'stop', w: 26, h: 26, r: 7, fill: 'inv', k: pop(C + 0.08, { from: 0.3, dur: 0.4 }) }),
        ] }),
      ] }),
      rect({ id: 'response', y: CY + 126, pin: 't', chAt: 'pin', w: 1000, h: 0, r: 40, fill: 'card', shadow: 1, clip: true,
        k: { h: [[O, O + 0.6, 330, 'Power4 Out']], opacity: [0, [O, O + 0.1, 1, 'Linear']] }, ch: [
          icon({ id: 'spark', icon: 'sparkle', x: -440, y: 58, size: 36, color: 'acc', k: k(pop(O + 0.18, { from: 0.4 }), { rot: [[O + 0.18, 4.6, 180, 'Linear']] }) }),
          text({ id: 'working', text: 'Working on it', x: -404, y: 58, ax: 0, size: 28, weight: 500, color: 'muted', k: enter(O + 0.24, { dx: -12, x0: -404 }) }),
          ...LW.map((w, i) => rect({ id: 'line' + i, x: -440, y: 124 + 52 * i, pin: 'l', w: 0, h: 20, r: 10, fill: 'skel',
            k: { w: [[LT[i][0], LT[i][1], w, 'Linear']], opacity: [0, [LT[i][0], LT[i][0] + 0.05, 1, 'Linear']] } })),
        ] }),
      cursorLayer([[0, 560, 190], [1.35, 560, 190], [1.95, 446, -52], [2.3, 446, -52], [2.95, 610, 130]], [C], [], { inAt: 1.3 }),
    ];
  },
});

// 2 ─ Streaming answer: lines reveal one after another with a caret riding the newest, then sources pop in
UIK.define({
  id: 'ai-streaming-answer', name: 'Streaming answer', cat: 'ai', T: 4.3, cam: 1.5,
  desc: 'An answer streams in line by line (a Linear reveal per line) with an accent caret riding the newest line; when it finishes the card grows and two source chips pop in beneath.',
  build: () => {
    const Y0 = -230, X0 = -396, LY = [150, 204, 258, 312];
    const L = ['The render stalled because two clips point to', 'files that were moved after you imported them.',
               'Relink both from the Media panel, then export', 'again — it should finish in about a minute.'];
    const S = [0.6, 1.18, 1.76, 2.34], DUR = 0.52, DONE = S[3] + DUR, G = DONE + 0.1;
    const chip = (id, ic, label, x, w, t) => rect({ id, x, y: 408, w, h: 52, r: 26, fill: 'soft', k: pop(t, { from: 0.5 }), ch: [
      icon({ icon: ic, x: -w / 2 + 32, size: 24, color: 'ink', sw: 2.2 }),
      text({ text: label, x: -w / 2 + 54, ax: 0, size: 24, weight: 500 }),
    ] });
    return [
      rect({ id: 'card', y: Y0, pin: 't', chAt: 'pin', origin: [0, 0], w: 900, h: 372, r: 44, fill: 'card', shadow: 1,
        k: k(popIn(0.1, 0.7), { h: [[G, G + 0.5, 468, 'Power3 Out']] }), ch: [
          circle({ id: 'avatar', x: X0 + 30, y: 70, d: 60, fill: 'ink', k: enter(0.24, { blur: 0, s: 0.7 }),
            ch: [icon({ icon: 'sparkle', size: 30, color: 'inv', sw: 2.2 })] }),
          text({ id: 'name', text: 'Assistant', x: X0 + 78, y: 70, ax: 0, size: 30, weight: 600, ls: -0.01, k: enter(0.3, { dx: -12, x0: X0 + 78 }) }),
          text({ id: 'time', text: 'now', x: -X0, y: 70, ax: 1, size: 24, color: 'muted', k: enter(0.36) }),
          ...L.map((s, i) => text({ id: 'line' + i, text: s, x: X0, y: LY[i], ax: 0, size: 32, caret: true, caretColor: 'acc',
            caretFrom: S[i], caretUntil: i < 3 ? S[i + 1] : DONE + 0.12, k: { reveal: [0, [S[i], S[i] + DUR, 1, 'Linear']] } })),
          text({ id: 'srcLbl', text: 'Sources', x: X0, y: 408, ax: 0, size: 24, color: 'muted', k: enter(G + 0.06) }),
          chip('srcDocs', 'file', 'docs', X0 + 174, 130, G + 0.16),
          chip('srcNotes', 'pencil', 'notes', X0 + 321, 140, G + 0.28),
        ] }),
    ];
  },
});

// 3 ─ Thinking steps: a Thinking row grows a step at a time (spinner → check), then folds to "Thought for 4s"
UIK.define({
  id: 'ai-thinking-steps', name: 'Thinking steps', cat: 'ai', T: 4.5,
  cam: { zoom: 1.75, y: -144, k: { zoom: [[0.7, 2.9, 1.55, 'Power2 Smooth'], [3.3, 3.95, 2.2, 'Power2 Smooth']], y: [[0.7, 2.9, -12, 'Power2 Smooth'], [3.3, 3.95, -144, 'Power2 Smooth']],
                                      x: [[3.3, 3.95, -224, 'Power2 Smooth']] } },
  desc: 'A Thinking row with an accent spinner grows downward one step at a time; each step spins, then swaps to a check and dims. When all three are done the card folds up and narrows into a compact "Thought for 4s" chip with a chevron.',
  build: () => {
    const Y0 = -200, SX = -356, TX = -320, RY = [170, 246, 322];
    const E = [0.7, 1.5, 2.3], H = [224, 300, 376], D = [1.42, 2.22, 3.0], K = 3.3;
    const steps = [['Searching the docs', '12 results'], ['Reading 3 pages', '4.2k words'], ['Writing the answer', '']];
    // pinned top-left so the fold narrows it from the right; the inner group keeps centre-based x values
    return [
      rect({ id: 'card', x: -410, y: Y0, pin: 'tl', chAt: 'pin', origin: [0, 0], w: 820, h: 112, r: 36, fill: 'card', shadow: 1, clip: true,
        k: k(popIn(0.1, 0.7), { h: [...E.map((e, i) => [e, e + 0.5, H[i], 'Power4 Out']), [K, K + 0.55, 112, 'Power4 Out']], w: [[K, K + 0.6, 372, 'Power4 Out']] }), ch: [group({ id: 'inner', x: 410, ch: [
          spinner('hdSpin', { x: SX, y: 56, R: 15, color: 'acc', t0: 0.2, t1: K + 0.2, k: k(enter(0.22, { blur: 0, s: 0.6 }), exit(K, { s: 0.5 })) }),
          icon({ id: 'hdSpark', icon: 'sparkle', x: SX, y: 56, size: 32, color: 'muted', sw: 2.2, k: pop(K + 0.08) }),
          text({ id: 'thinking', text: 'Thinking…', x: TX, y: 56, ax: 0, size: 30, weight: 500, k: k(enter(0.26, { dx: -12, x0: TX }), exit(K)) }),
          text({ id: 'thought', text: 'Thought for 4s', x: TX, y: 56, ax: 0, size: 30, weight: 500, k: enter(K + 0.04, { dx: -12, x0: TX }) }),
          icon({ id: 'chevron', icon: 'chevronRight', x: TX + 228, y: 57, size: 28, color: 'muted', sw: 2.6, k: enter(K + 0.16, { dx: -10, x0: TX + 228 }) }),
          text({ id: 'elapsed', x: 370, y: 56, ax: 1, size: 26, color: 'muted', num: { suf: 's', floor: true },
            k: k(enter(0.3), { value: [[0.3, K, 4, 'Linear']] }, exit(K)) }),
          rect({ id: 'divider', y: 112, w: 820, h: 2, fill: 'line', k: k(fadeIn(E[0]), exit(K, { dur: 0.12, blur: 0 })) }),
          rect({ id: 'rail', x: SX, y: RY[0], pin: 't', w: 2, h: 0, fill: 'line',
            k: { h: [[E[1] + 0.05, E[1] + 0.5, 76, 'Power3 Out'], [E[2] + 0.05, E[2] + 0.5, 152, 'Power3 Out']], opacity: [[K, K + 0.12, 0, 'Power2 In']] } }),
          ...steps.map(([s, meta], i) => {
            const a = E[i] + 0.08, d = D[i];
            return group({ id: 'step' + i, y: RY[i], k: k(enter(a, { dx: -14, x0: 0 }), exit(K, { dur: 0.16 })), ch: [
              circle({ id: 'slot' + i, x: SX, d: 42, fill: 'card' }),
              spinner('stepSpin' + i, { x: SX, R: 13, sw: 3.5, t0: a, t1: d + 0.2, k: exit(d, { s: 0.5, dur: 0.12 }) }),
              icon({ id: 'stepCheck' + i, icon: 'check', x: SX, size: 28, color: 'ink', sw: 3, k: pop(d + 0.04) }),
              text({ id: 'stepLbl' + i, text: s, x: TX, ax: 0, size: 28, weight: 500, k: { color: [[d, d + 0.3, 'muted', 'Power2 Out']] } }),
              ...(meta ? [text({ id: 'stepMeta' + i, text: meta, x: 370, ax: 1, size: 24, color: 'muted', k: enter(d) })] : []),
            ] });
          }),
        ] })] }),
    ];
  },
});

// 4 ─ Model picker: the composer's model pill opens a tier menu upward; the pick swaps the pill label
UIK.define({
  id: 'ai-model-picker', name: 'Model picker', cat: 'ai', T: 4.0,
  cam: { zoom: 1.45, y: 60, k: { zoom: [[1.0, 1.6, 1.4, 'Power2 Smooth'], [2.62, 3.3, 1.5, 'Power2 Smooth']], y: [[1.0, 1.6, -10, 'Power2 Smooth'], [2.62, 3.3, 150, 'Power2 Smooth']] } },
  desc: 'A click on the model pill opens a tier menu upward out of the composer; a highlight glides after the cursor from Fast to Deep, the check hops to the pick, the menu folds away and the pill widens to Deep with an accent dot.',
  build: () => {
    const CY = 150, C1 = 0.95, O = C1 + 0.08, C2 = 2.38, X = 2.6, PX = -456, MB = 36, RB = [-242, -150, -58];
    const tiers = [['Fast', 'Quick answers for everyday tasks', 'zap'], ['Balanced', 'Good for most work', 'sliders'], ['Deep', 'Thinks longer on hard problems', 'sparkle']];
    const wy = (i) => MB + RB[i];   // row centre in world y
    const P = [[1.55, -196], [1.95, -106], [2.28, -14]];
    const h1 = cross(P[0][0], P[1][0], P[0][1], P[1][1], (wy(0) + wy(1)) / 2, 'Sine Smooth');
    const h2 = cross(P[1][0], P[2][0], P[1][1], P[2][1], (wy(1) + wy(2)) / 2, 'Sine Smooth');
    const glide = (t, to) => ({ y: [[t, t + 0.3, to, 'Power4 Out']], h: [[t, t + 0.1, 100, 'Power2 Out'], [t + 0.1, t + 0.34, 84, 'Power3 Out']] });
    return [
      rect({ id: 'composer', y: CY, w: 1000, h: 190, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.65), ch: [
        text({ id: 'placeholder', text: 'Ask anything', x: -440, y: -36, ax: 0, size: 34, color: 'muted', k: enter(0.24) }),
        rect({ id: 'pill', x: PX, y: 44, pin: 'l', chAt: 'pin', origin: [0, 0], w: 138, h: 60, r: 30, fill: 'soft',
          k: k(fadeIn(0.32), press(C1, { to: 0.94 }), { w: [[X + 0.05, X + 0.55, 174, 'Power4 Out']] }), ch: [
            text({ id: 'pillFast', text: 'Fast', x: 24, ax: 0, size: 28, weight: 500, k: exit(X + 0.05) }),
            circle({ id: 'pillDot', x: 30, d: 14, fill: 'acc', k: pop(X + 0.28, { from: 0.2 }) }),
            text({ id: 'pillDeep', text: 'Deep', x: 48, ax: 0, size: 28, weight: 500, k: enter(X + 0.1, { dx: -10, x0: 48 }) }),
            icon({ id: 'pillChevron', icon: 'chevronDown', x: 103, size: 24, color: 'muted', sw: 2.6,
              k: { x: [[X + 0.05, X + 0.55, 140, 'Power4 Out']], rot: [[C1, C1 + 0.4, 180, 'Power3 Out'], [X, X + 0.4, 0, 'Power3 Out']] } }),
          ] }),
        circle({ id: 'send', x: 436, y: 44, d: 72, fill: 'dim', k: fadeIn(0.36), ch: [icon({ icon: 'arrowUp', size: 34, color: 'card', sw: 2.8 })] }),
      ] }),
      rect({ id: 'menu', x: PX, y: MB, pin: 'bl', chAt: 'pin', w: 560, h: 0, r: 30, fill: 'card', shadow: 2, clip: true,
        k: { h: [[O, O + 0.5, 300, 'Power4 Out'], [X, X + 0.3, 0, 'Power3 Out']], opacity: [0, [O, O + 0.1, 1, 'Linear'], [X + 0.14, X + 0.3, 0, 'Linear']] }, ch: [
          rect({ id: 'highlight', x: 280, y: RB[0], w: 536, h: 84, r: 20, fill: 'soft',
            k: k({ opacity: [0, [P[0][0] - 0.12, P[0][0] + 0.04, 1, 'Power2 Out']] }, glide(h1, RB[1]), glide(h2, RB[2]), press(C2, { to: 0.97 })) }),
          ...tiers.map(([name, sub, ic], i) => group({ id: 'tier' + i, y: RB[i], k: enter(O + 0.04 + (2 - i) * 0.05, { dy: 10, y0: RB[i], blur: 6 }), ch: [
            icon({ icon: ic, x: 44, size: 28, color: 'muted', sw: 2.2 }),
            text({ text: name, x: 80, y: -17, ax: 0, size: 30, weight: 500 }),
            text({ text: sub, x: 80, y: 19, ax: 0, size: 23, color: 'muted' }),
            ...(i === 0 ? [icon({ id: 'checkFast', icon: 'check', x: 516, size: 28, color: 'ink', sw: 3, k: exit(C2, { s: 0.5 }) })] : []),
            ...(i === 2 ? [icon({ id: 'checkDeep', icon: 'check', x: 516, size: 28, color: 'ink', sw: 3, k: pop(C2 + 0.04) })] : []),
          ] })),
        ] }),
      cursorLayer([[0, 520, 360], [0.4, 520, 360], [0.85, -380, 204], [C1 + 0.15, -380, 204], [P[0][0], -250, P[0][1]], [P[1][0], -236, P[1][1]],
        [P[2][0], -230, P[2][1]], [C2 + 0.2, -230, P[2][1]], [3.2, 320, 380]], [C1, C2], [], { inAt: 0.35 }),
    ];
  },
});

// 5 ─ Tool call: a web search gathers five sources, then the tiles shrink into a favicon stack as the card folds
UIK.define({
  id: 'ai-tool-call', name: 'Tool call', cat: 'ai', T: 4.3,
  cam: { zoom: 1.45, y: -100, k: { zoom: [[0.95, 1.6, 1.4, 'Power2 Smooth'], [2.75, 3.45, 1.5, 'Power2 Smooth']], y: [[0.95, 1.6, -15, 'Power2 Smooth'], [2.75, 3.45, -152, 'Power2 Smooth']] } },
  desc: 'A "Searching the web" card types its query while an accent spinner turns; five source tiles pop in on a stagger as the card grows, the header swaps to "Found 5 sources", then each tile shrinks into a favicon that flies into a stack on the header row as the card folds to one line.',
  build: () => {
    const Y0 = -210, G = 1.0, F = 2.05, M = 2.75, TY = 285, H0 = 220, H1 = 390, HC = 116;
    const TX = [-360, -180, 0, 180, 360];
    const src = [['K', 'ink', 'inv'], ['D', 'dim', 'ink'], ['T', 'muted', 'card'], ['S', 'ink', 'inv'], ['Q', 'dim', 'ink']];
    return [
      rect({ id: 'card', y: Y0, pin: 't', chAt: 'pin', origin: [0, 0], w: 980, h: H0, r: 40, fill: 'card', shadow: 1,
        k: k(popIn(0.1, 0.7), { h: [[G, G + 0.55, H1, 'Power4 Out'], [M + 0.08, M + 0.75, HC, 'Expo Out']] }), ch: [
          rect({ id: 'globeTile', x: -432, y: 58, w: 72, h: 72, r: 20, fill: 'soft', k: enter(0.22, { blur: 0, s: 0.7 }),
            ch: [icon({ icon: 'globe', size: 38, color: 'ink', sw: 2.4 })] }),
          text({ id: 'searching', text: 'Searching the web', x: -380, y: 58, ax: 0, size: 32, weight: 600, ls: -0.01, k: k(enter(0.26, { dx: -14, x0: -380 }), exit(F)) }),
          text({ id: 'found', text: 'Found 5 sources', x: -380, y: 58, ax: 0, size: 32, weight: 600, ls: -0.01, k: enter(F + 0.02, { dx: -14, x0: -380 }) }),
          spinner('spin', { x: 440, y: 58, R: 15, color: 'acc', t0: 0.25, t1: F + 0.2, k: k(enter(0.3, { blur: 0, s: 0.6 }), exit(F, { s: 0.5 })) }),
          icon({ id: 'doneCheck', icon: 'check', x: 440, y: 58, size: 30, color: 'ink', sw: 3, k: pop(F + 0.06) }),
          rect({ id: 'query', x: -466, y: 150, pin: 'l', chAt: 'pin', w: 420, h: 60, r: 30, fill: 'soft', k: k(fadeIn(0.3), exit(M, { dur: 0.16 })), ch: [
            icon({ icon: 'search', x: 34, size: 26, color: 'muted', sw: 2.4 }),
            text({ id: 'queryText', text: 'quiet mechanical keyboards', x: 62, ax: 0, size: 26, k: { reveal: [0, [0.42, 0.95, 1, 'Linear']] } }),
          ] }),
          ...src.map(([ch, f, c], i) => {
            const m = M + 0.02 * i, SX = 244 + 34 * i;
            return group({ id: 'tile' + i, x: TX[i], y: TY, k: k(pop(G + 0.05 + 0.1 * i, { from: 0.5 }),
              { x: [[m, m + 0.7, SX, 'Expo Out']], y: [[m, m + 0.7, 58, 'Expo Out']] }), ch: [
                rect({ id: 'tileBg' + i, w: 164, h: 130, r: 22, fill: 'panel', k: { w: [[m, m + 0.4, 44, 'Expo Out']], h: [[m, m + 0.4, 44, 'Expo Out']] } }),
                group({ id: 'tileBars' + i, k: exit(M - 0.04, { dur: 0.1, blur: 4 }), ch: [
                  rect({ x: -64, y: 22, pin: 'l', w: 120, h: 12, r: 6, fill: 'skel' }),
                  rect({ x: -64, y: 44, pin: 'l', w: 76, h: 12, r: 6, fill: 'skel' }),
                ] }),
                circle({ id: 'fav' + i, x: -46, y: -26, d: 44, fill: f, stroke: 'card', sw: 0,
                  k: { x: [[m, m + 0.4, 0, 'Expo Out']], y: [[m, m + 0.4, 0, 'Expo Out']], sw: [[m, m + 0.3, 4, 'Power2 Out']] },
                  ch: [text({ text: ch, size: 22, weight: 600, color: c })] }),
              ] });
          }),
        ] }),
    ];
  },
});

// 6 ─ Agent plan: four steps run in order — pending dot → spinning accent ring → ink check — and the fraction rolls
UIK.define({
  id: 'ai-agent-plan', name: 'Agent plan', cat: 'ai', T: 4.4, cam: 1.45,
  desc: 'An agent works through a four-step plan: a soft highlight glides to each running step, its dim dot becomes a spinning accent ring and then an ink check, the label darkens, a duration lands, and the header fraction rolls 0/4 → 4/4.',
  build: () => {
    const RY = [-60, 24, 108, 192], S = [0.8, 1.5, 2.2, 2.9], DU = 0.62, SX = -370, TX = -334;
    const D = S.map((s) => +(s + DU).toFixed(2));
    const steps = [['Read the pricing brief', '2s'], ['Draft three plan cards', '6s'], ['Build the comparison table', '9s'], ['Run the layout checks', '3s']];
    const glide = (t, to) => ({ y: [[t, t + 0.45, to, 'Power4 Out']], h: [[t, t + 0.1, 92, 'Power2 Out'], [t + 0.1, t + 0.45, 76, 'Power3 Out']] });
    return [
      rect({ id: 'card', w: 900, h: 540, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'title', text: 'Launch the new pricing', x: -390, y: -206, ax: 0, size: 38, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -390 }) }),
        text({ id: 'sub', text: 'Agent plan · 4 steps', x: -390, y: -162, ax: 0, size: 26, color: 'muted', k: k(enter(0.3), exit(D[3] + 0.1)) }),
        text({ id: 'subDone', text: 'All steps done', x: -390, y: -162, ax: 0, size: 26, weight: 500, k: enter(D[3] + 0.12) }),
        rect({ id: 'fracRoll', x: 331, y: -200, w: 34, h: 56, clip: true, k: enter(0.3), ch: [
          group({ id: 'fracCol', k: { y: D.map((d, i) => [d, d + 0.42, -56 * (i + 1), 'Power3 Out']) },
            ch: '01234'.split('').map((c, i) => text({ text: c, y: i * 56, size: 44, weight: 600, tnum: false })) }),
        ] }),
        text({ id: 'fracDen', text: '/4', x: 390, y: -200, ax: 1, size: 44, weight: 600, color: 'muted', tnum: false, k: enter(0.34) }),
        rect({ id: 'divider', y: -114, w: 900, h: 2, fill: 'line', k: fadeIn(0.3) }),
        rect({ id: 'highlight', y: RY[0], w: 844, h: 76, r: 20, fill: 'panel',
          k: k({ opacity: [0, [S[0] - 0.05, S[0] + 0.15, 1, 'Power2 Out'], [D[3], D[3] + 0.35, 0, 'Power2 Out']] }, glide(S[1], RY[1]), glide(S[2], RY[2]), glide(S[3], RY[3])) }),
        ...steps.map(([s, dur], i) => group({ id: 'step' + i, y: RY[i], k: enter(0.34 + 0.07 * i, { dx: -14, x0: 0 }), ch: [
          circle({ id: 'pending' + i, x: SX, d: 14, fill: 'dim', k: exit(S[i], { s: 0.3, dur: 0.12, blur: 0 }) }),
          spinner('run' + i, { x: SX, R: 16, color: 'acc', track: 'acc/20', t0: S[i], t1: D[i] + 0.15,
            k: k(pop(S[i] + 0.02, { from: 0.5, dur: 0.35 }), exit(D[i], { s: 0.6, dur: 0.12 })) }),
          icon({ id: 'done' + i, icon: 'check', x: SX, size: 30, color: 'ink', sw: 3, k: pop(D[i] + 0.04) }),
          text({ id: 'stepLbl' + i, text: s, x: TX, ax: 0, size: 30, weight: 500, color: 'muted', k: { color: [[S[i], S[i] + 0.2, 'ink', 'Power2 Out']] } }),
          text({ id: 'stepDur' + i, text: dur, x: 384, ax: 1, size: 24, color: 'muted', k: enter(D[i] + 0.02) }),
        ] })),
      ] }),
    ];
  },
});

// 7 ─ Image generation: four pulsing placeholders blur-resolve into compositions; the picked one grows to fill the frame
UIK.define({
  id: 'ai-image-gen', name: 'Image generation', cat: 'ai', T: 4.6,
  cam: { zoom: 1.3, y: -15, k: { zoom: [[2.72, 3.52, 1.45, 'Power2 Smooth']], y: [[2.72, 3.52, -20, 'Power2 Smooth']] } },
  desc: 'Under a prompt chip, four skeleton tiles pulse, then each one blur-resolves into a simple abstract composition on a stagger. The cursor picks one: it grows to fill the frame (size + camera) while the others and the chip fall away.',
  build: () => {
    const S = 280, P = [[-151, -121], [151, -121], [-151, 181], [151, 181]], R = [1.35, 1.55, 1.75, 1.95], C = 2.7, G = C + 0.02, PICK = 1, SC = 1.85;
    // compositions: [clip fill, shapes…] — token colours only, one accent sun on the pick
    const comp = [
      ['panel', [circle({ x: -34, y: -22, d: 170, fill: 'dim' }), rect({ y: 100, w: 300, h: 100, fill: 'ink' }), circle({ x: 84, y: -84, d: 38, fill: 'ink' })]],
      ['ink', [circle({ x: 48, y: -46, d: 104, fill: 'acc' }), ellipse({ x: -76, y: 166, w: 380, h: 210, fill: 'muted' }), ellipse({ x: 112, y: 184, w: 340, h: 180, fill: 'dim' })]],
      ['dim', [rect({ y: -18, w: 150, h: 196, r: 14, fill: 'card' }), rect({ y: -18, w: 150, h: 5, fill: 'dim' }), rect({ y: -18, w: 5, h: 196, fill: 'dim' }),
               rect({ y: 118, w: 300, h: 52, fill: 'ink' }), circle({ x: -92, y: 66, d: 44, fill: 'muted' })]],
      ['panel', [rect({ x: -14, y: -64, w: 250, h: 58, r: 29, fill: 'ink', rot: -18 }), rect({ x: 10, y: 4, w: 210, h: 58, r: 29, fill: 'muted', rot: -18 }),
                 rect({ x: 32, y: 72, w: 170, h: 58, r: 29, fill: 'dim', rot: -18 })]],
    ];
    const pulse = (i) => {
      const o = [1];
      for (let t = 0.62 + i * 0.08; t + 0.6 <= R[i] + 0.05; t += 0.6) o.push([t, t + 0.3, 0.5, 'Sine Smooth'], [t + 0.3, t + 0.6, 1, 'Sine Smooth']);
      o.push([R[i] + 0.25, R[i] + 0.45, 0, 'Power2 Out']);
      return o;
    };
    const tile = (i) => {
      const [bg, shapes] = comp[i], pick = i === PICK, j = [0, 2, 3].indexOf(i);
      const kk = pick
        ? k(pop(0.25 + 0.07 * i, { from: 0.7 }), { scale: [[C - 0.07, C, 0.96, 'Power2 Out'], [G, G + 0.8, SC, 'Expo Out']],
            x: [[G, G + 0.8, 0, 'Expo Out']], y: [[G, G + 0.8, -20, 'Expo Out']] })
        : k(pop(0.25 + 0.07 * i, { from: 0.7 }), exit(G + 0.04 * j, { dur: 0.26, s: 0.9, blur: 10 }));
      return group({ id: 'tile' + i, x: P[i][0], y: P[i][1], k: kk, ch: [
        rect({ id: 'sk' + i, w: S, h: S, r: 28, fill: 'skel', k: { opacity: pulse(i) } }),
        rect({ id: 'img' + i, w: S, h: S, r: 28, fill: bg, clip: true,
          k: k({ opacity: [0, [R[i], R[i] + 0.3, 1, 'Power2 Out']], blur: [24, [R[i], R[i] + 0.6, 0, 'Power2 Out']] }, pick ? { r: [[G, G + 0.6, 17, 'Power3 Out']] } : null), ch: [
            group({ id: 'art' + i, k: { scale: [1.12, [R[i], R[i] + 0.7, 1, 'Power3 Out']] }, ch: shapes }),
          ] }),
      ] });
    };
    return [
      rect({ id: 'prompt', y: -319, w: 430, h: 64, r: 32, fill: 'card', shadow: 1, k: k(popIn(0.1, 0.7), exit(G, { dur: 0.2 })), ch: [
        icon({ icon: 'sparkle', x: -179, size: 28, color: 'acc', sw: 2.2 }),
        text({ text: 'A calm desk at golden hour', x: -153, ax: 0, size: 26, weight: 500, k: enter(0.2) }),
      ] }),
      tile(0), tile(2), tile(3), tile(1),
      text({ id: 'caption', text: 'Variation 2 of 4', y: 290, size: 26, color: 'muted', k: enter(G + 0.5, { dy: 12, y0: 290 }) }),
      cursorLayer([[0, 600, 340], [2.0, 600, 340], [2.6, 190, -80], [C + 0.12, 190, -80], [3.4, 440, 240]], [C], [], { inAt: 1.95 }),
    ];
  },
});

// 8 ─ Voice mode: the ink orb breathes with the speech, five bars dance, the transcript types, the mic toggles off
UIK.define({
  id: 'ai-voice-orb', name: 'Voice mode', cat: 'ai', T: 4.5, cam: { zoom: 1.2, y: 37 },
  desc: 'Voice mode: a big ink orb breathes with the speech while five bars under it rise and fall and the transcript types beneath. The cursor taps the mic: it turns ink with a slash drawn across, the bars settle to dots and the orb shrinks and dims.',
  build: () => {
    const OY = -110, BY = 120, TY = 232, KY = 350, V0 = 0.8, V1 = 3.0, C = 3.35, OFF = C + 0.05;
    const orbS = [0.6, [0.1, 0.62, 1, 'Back Out']];
    for (let t = V0, j = 0; t + 0.28 <= V1; t += 0.28, j++) orbS.push([t, t + 0.14, 1.025 + 0.05 * rnd(j + 3), 'Sine Smooth'], [t + 0.14, t + 0.28, 1, 'Sine Smooth']);
    orbS.push([OFF, OFF + 0.5, 0.86, 'Power3 Out']);
    const ENV = [0.5, 0.82, 1, 0.82, 0.5];
    const bar = (j) => {
      const h = [30];
      let s = 0;
      for (let t = V0 + j * 0.03; t + 0.14 <= V1; t += 0.14, s++) h.push([t, t + 0.14, Math.round(30 + 76 * ENV[j] * (0.25 + 0.75 * rnd(j * 31 + s * 7))), 'Sine Smooth']);
      h.push([V1, V1 + 0.25, 30, 'Power3 Out']);
      return rect({ id: 'bar' + j, x: -108 + 54 * j, y: BY, w: 30, h: 30, r: 15, fill: 'ink', k: k(pop(0.35 + 0.04 * j, { from: 0.4 }), { h, fill: [[OFF, OFF + 0.3, 'dim', 'Power2 Out']] }) });
    };
    return [
      group({ id: 'status', y: -318, ch: [
        circle({ id: 'liveDot', x: -66, d: 14, fill: 'acc', k: k(pop(0.3), exit(OFF, { s: 0.4 })) }),
        text({ id: 'speaking', text: 'Speaking', x: -49, ax: 0, size: 28, weight: 500, k: k(enter(0.32, { dx: -10, x0: -49 }), exit(OFF)) }),
        text({ id: 'micOff', text: 'Mic off', size: 28, weight: 500, color: 'muted', k: enter(OFF + 0.04) }),
      ] }),
      circle({ id: 'orb', y: OY, d: 280, fill: 'ink', k: { scale: orbS, opacity: [0, [0.1, 0.22, 1, 'Linear']], fill: [[OFF, OFF + 0.4, 'dim', 'Power2 Out']] } }),
      ...[0, 1, 2, 3, 4].map(bar),
      text({ id: 'transcript', text: 'Sure — I moved your 3 pm call to Friday.', y: TY, size: 36, weight: 500, k: { reveal: [0, [0.9, 2.9, 1, 'Linear']] } }),
      circle({ id: 'micBtn', x: -80, y: KY, d: 104, fill: 'soft', k: k(fadeIn(0.4), press(C, { to: 0.9 }), { fill: [[C, C + 0.2, 'ink', 'Power2 Out']] }), ch: [
        icon({ id: 'mic', icon: 'mic', size: 44, color: 'ink', sw: 2.6, k: { color: [[C, C + 0.2, 'inv', 'Power2 Out']] } }),
        path({ id: 'slashGap', d: 'M-22 -22 L22 22', stroke: 'ink', sw: 11, trimmed: true, k: { trimE: [0, [OFF, OFF + 0.26, 100, 'Power3 Out']] } }),
        path({ id: 'slash', d: 'M-22 -22 L22 22', stroke: 'inv', sw: 4.4, trimmed: true, k: { trimE: [0, [OFF, OFF + 0.26, 100, 'Power3 Out']] } }),
      ] }),
      circle({ id: 'closeBtn', x: 80, y: KY, d: 104, fill: 'soft', k: fadeIn(0.46), ch: [icon({ icon: 'x', size: 40, color: 'ink', sw: 2.6 })] }),
      cursorLayer([[0, 480, 450], [2.5, 480, 450], [3.25, -68, 362], [C + 0.25, -68, 362], [4.1, 300, 420]], [C], [], { inAt: 2.45 }),
    ];
  },
});

// 9 ─ Suggestions: three chips slide up over an empty composer; the clicked one flies into the field and becomes its text
UIK.define({
  id: 'ai-suggestions', name: 'Prompt suggestions', cat: 'ai', T: 3.7, cam: { zoom: 1.4, y: 10 },
  desc: 'Three suggestion chips slide up over an empty composer on a stagger. The cursor clicks one: it flies down into the field (x, y and scale on different easings, so it arcs), its pill and icon dissolve on the way, the label lands as the input text and the send button wakes up.',
  build: () => {
    const CY = 70, CHY = -80, C = 1.7, F0 = C + 0.1, F1 = F0 + 0.6, TX = -380, SC = 32 / 26, PICK = 1;
    const raw = [['Summarize this page', 'file', 253.4], ['Draft a reply', 'pencil', 148.6], ['Plan my week', 'calendar', 168.1]];
    const W = raw.map((c) => 94 + c[2]), total = W.reduce((a, b) => a + b, 0) + 32;
    let x = -total / 2;
    const CX = W.map((w) => { const c = x + w / 2; x += w + 16; return +c.toFixed(1); });
    const lbl = (i) => -W[i] / 2 + 66;
    const gx = +(TX - SC * lbl(PICK)).toFixed(1);
    const chip = (i) => {
      const [label, ic] = raw[i], w = W[i], pick = i === PICK, j = i < PICK ? i : i - 1;
      const kk = pick
        ? k(enter(0.5 + 0.1 * i, { dy: 36, y0: CHY }), { scale: [[C - 0.07, C, 0.95, 'Power2 Out'], [F0, F1, SC, 'Power3 Out']],
            x: [[F0, F1, gx, 'Power3 Out']], y: [[F0, F1, CY, 'Power2 Smooth']] })
        : k(enter(0.5 + 0.1 * i, { dy: 36, y0: CHY }), exit(C + 0.01 + 0.05 * j, { dur: 0.16, s: 0.92 }));
      return group({ id: 'chip' + i, x: CX[i], y: CHY, k: kk, ch: [
        rect({ id: 'chipBg' + i, w, h: 64, r: 32, fill: 'card', shadow: 3, k: pick ? { opacity: [1, [F0, F0 + 0.4, 0, 'Power2 Out']] } : undefined }),
        icon({ id: 'chipIcon' + i, icon: ic, x: -w / 2 + 41, size: 26, color: 'muted', sw: 2.2, k: pick ? { opacity: [1, [F0, F0 + 0.15, 0, 'Power2 Out']] } : undefined }),
        text({ id: 'chipLbl' + i, text: label, x: lbl(i), ax: 0, size: 26, weight: 500, k: pick ? { opacity: [1, [F1, 0]] } : undefined }),
      ] });
    };
    return [
      rect({ id: 'composer', y: CY, w: 1000, h: 120, r: 60, fill: 'card', shadow: 1, k: popIn(0.1, 0.65), ch: [
        icon({ id: 'plus', icon: 'plus', x: -432, size: 34, color: 'muted', sw: 2.4, k: enter(0.22) }),
        text({ id: 'placeholder', text: 'Ask anything', x: TX, ax: 0, size: 32, color: 'muted', k: k(enter(0.26), exit(F0 + 0.22, { dur: 0.14, blur: 0 })) }),
        text({ id: 'input', text: 'Draft a reply', x: TX, ax: 0, size: 32, caret: true, caretColor: 'acc', caretFrom: F1, k: { opacity: [0, [F1, 1]] } }),
        circle({ id: 'send', x: 440, d: 76, fill: 'dim', k: k(fadeIn(0.3), { fill: [[F1 - 0.05, F1 + 0.15, 'ink', 'Power2 Out']] }),
          ch: [icon({ icon: 'arrowUp', size: 36, color: 'card', sw: 2.8, k: { color: [[F1 - 0.05, F1 + 0.15, 'inv', 'Power2 Out']] } })] }),
      ] }),
      chip(0), chip(2), chip(1),
      cursorLayer([[0, 520, 330], [1.0, 520, 330], [1.6, 60, -66], [C + 0.25, 60, -66], [2.55, 430, 300]], [C], [], { inAt: 0.95 }),
    ];
  },
});

// 10 ─ Diff accept: Accept collapses the removed line, the added lines lose their tint, an Applied chip pops
UIK.define({
  id: 'ai-diff-accept', name: 'Diff accept', cat: 'ai', T: 3.9, cam: { zoom: 1.35, y: 10, k: { y: [[2.0, 2.6, -21, 'Power2 Smooth']] } },
  desc: 'A suggested edit: one removed line on a red tint and two added lines on an accent tint. The cursor clicks Accept: the removed line collapses to nothing inside its clip while everything below slides up, the tints and plus signs fade to plain code and an Applied chip pops in place of the buttons.',
  build: () => {
    const Y0 = -270, W = 1040, C = 1.9, A = C + 0.1, RH = 62, RT = 120, NX = -452, SGX = -420, CX = -392, IND = 34;
    const rows = [
      { t: 'ctx', n: '12', s: 'function Hero({ title }) {', ind: 0 },
      { t: 'del', n: '13', s: 'return <h1>{title}</h1>;', ind: 1 },
      { t: 'add', n: '13', s: 'return <Heading size="xl">', ind: 1 },
      { t: 'add', n: '14', s: '{title}</Heading>;', ind: 2 },
      { t: 'ctx', n: '15', s: '}', ind: 0 },
    ];
    const cy = (i) => RT + i * RH + RH / 2;
    const line = (r) => [
      text({ text: r.n, x: NX, ax: 1, size: 24, color: 'muted' }),
      text({ text: r.s, x: CX + r.ind * IND, ax: 0, size: 28 }),
    ];
    const shift = (y) => ({ y: [[A, A + 0.5, y - RH, 'Power4 Out']] });
    return [
      rect({ id: 'card', y: Y0, pin: 't', chAt: 'pin', origin: [0, 0], w: W, h: 560, r: 40, fill: 'card', shadow: 1,
        k: k(popIn(0.1, 0.7), { h: [[A, A + 0.5, 560 - RH, 'Power4 Out']] }), ch: [
          icon({ id: 'fileIcon', icon: 'file', x: -466, y: 52, size: 30, color: 'ink', sw: 2.2, k: enter(0.22) }),
          text({ id: 'fileName', text: 'Hero.jsx', x: -436, y: 52, ax: 0, size: 28, weight: 600, k: enter(0.24, { dx: -12, x0: -436 }) }),
          text({ id: 'suggested', text: 'Suggested edit', x: 480, y: 52, ax: 1, size: 24, color: 'muted', k: enter(0.3) }),
          rect({ id: 'hairline', y: 100, w: W, h: 2, fill: 'line', k: fadeIn(0.28) }),
          group({ id: 'row0', y: cy(0), k: enter(0.34, { dx: -14, x0: 0 }), ch: line(rows[0]) }),
          rect({ id: 'delRow', y: RT + RH, pin: 't', chAt: 'pin', w: W, h: RH, fill: 'bad/12', clip: true,
            k: k(enter(0.41, { dx: -14, x0: 0, blur: 0 }), { h: [[A, A + 0.5, 0, 'Power4 Out']] }), ch: [
              group({ id: 'delContent', y: RH / 2, k: exit(A, { dur: 0.16, blur: 4 }), ch: [
                text({ text: '−', x: SGX, size: 30, weight: 500, color: 'bad' }),
                ...line(rows[1]),
              ] }),
            ] }),
          ...[2, 3].map((i) => group({ id: 'row' + i, y: cy(i), k: k(enter(0.34 + 0.07 * i, { dx: -14, x0: 0 }), shift(cy(i))), ch: [
            rect({ id: 'addTint' + i, w: W, h: RH, fill: 'acc/12', k: { fill: [[A + 0.3, A + 0.75, 'acc/0', 'Power2 Out']] } }),
            text({ id: 'plus' + i, text: '+', x: SGX, size: 30, weight: 500, color: 'acc', k: exit(A + 0.3, { dur: 0.25, blur: 4 }) }),
            ...line(rows[i]),
          ] })),
          group({ id: 'row4', y: cy(4), k: k(enter(0.62, { dx: -14, x0: 0 }), shift(cy(4))), ch: line(rows[4]) }),
          group({ id: 'footer', y: 492, k: k(enter(0.66), shift(492)), ch: [
            text({ text: '1 file · +2 −1', x: -466, ax: 0, size: 24, color: 'muted' }),
            rect({ id: 'reject', x: 223, w: 150, h: 68, r: 34, fill: 'soft', k: exit(A + 0.02, { dur: 0.16, s: 0.9 }),
              ch: [text({ text: 'Reject', size: 26, weight: 500 })] }),
            rect({ id: 'accept', x: 390, w: 180, h: 68, r: 34, fill: 'ink', k: k(press(C, { to: 0.93 }), exit(A + 0.34, { dur: 0.14 })),
              ch: [text({ text: 'Accept', size: 26, weight: 600, color: 'inv' })] }),
            rect({ id: 'applied', x: 390, w: 180, h: 68, r: 34, fill: 'soft', k: pop(A + 0.38, { from: 0.6 }), ch: [
              icon({ icon: 'check', x: -51, size: 26, color: 'ink', sw: 3 }),
              text({ text: 'Applied', x: -28, ax: 0, size: 26, weight: 500 }),
            ] }),
          ] }),
        ] }),
      cursorLayer([[0, 540, 330], [0.95, 540, 330], [1.8, 400, 232], [C + 0.25, 400, 232], [2.8, 560, 320]], [C], [], { inAt: 0.9 }),
    ];
  },
});

// 11 ─ Summarize: the document's lines collapse together and the page morphs into a compact summary card
UIK.define({
  id: 'ai-summarize', name: 'Summarize', cat: 'ai', T: 4.1,
  cam: { zoom: 1.05, k: { zoom: [[1.68, 2.48, 1.4, 'Power2 Smooth']] } },
  desc: 'A long document with a Summarize button: on the click its skeleton lines squeeze together and vanish while the page itself morphs (width, height, corners) into a compact summary card and the camera moves in; three bullet points then enter one by one.',
  build: () => {
    const C = 1.5, M = C + 0.1, MS = M + 0.08, LW = [600, 560, 590, 500, 580, 550, 600, 420, 520];
    const bullets = ['Revenue grew 18% on the new plans', 'Churn fell to 2.1% after onboarding fixes', 'Next up: ship the mobile app in November'];
    const BY = [-30, 40, 110], BT = [M + 0.62, M + 0.96, M + 1.3];
    return [
      rect({ id: 'doc', w: 720, h: 800, r: 36, fill: 'card', shadow: 1,
        k: k(popIn(0.1, 0.7), { w: [[MS, MS + 0.75, 920, 'Expo Out']], h: [[MS, MS + 0.75, 360, 'Expo Out']], r: [[MS, MS + 0.5, 44, 'Power3 Out']] }), ch: [
          text({ id: 'docTitle', text: 'Q3 Product Review', x: -300, y: -320, ax: 0, size: 44, weight: 600, ls: -0.02, k: k(enter(0.22, { dx: -16, x0: -300 }), exit(M)) }),
          text({ id: 'docMeta', text: '12 pages · 4,210 words', x: -300, y: -272, ax: 0, size: 26, color: 'muted', k: k(enter(0.3), exit(M)) }),
          ...LW.map((w, i) => rect({ id: 'docLine' + i, x: -300, y: -196 + 50 * i, pin: 'l', w, h: 18, r: 9, fill: 'skel',
            k: k(fadeIn(0.34 + 0.035 * i), { y: [[M, M + 0.5, (i - 4) * 5, 'Expo Out']], w: [[M, M + 0.5, Math.round(w * 0.6), 'Expo Out']], x: [[M, M + 0.5, -Math.round(w * 0.3), 'Expo Out']],
                   opacity: [[M + 0.16, M + 0.42, 0, 'Power2 In']], blur: [[M + 0.1, M + 0.42, 6, 'Power2 In']] }) })),
          rect({ id: 'summarizeBtn', y: 318, w: 250, h: 72, r: 36, fill: 'ink',
            k: k(fadeIn(0.5), { scale: [[C - 0.07, C, 0.95, 'Power2 Out'], [M, M + 0.16, 0.8, 'Power2 In']] }, exit(M, { dur: 0.16 })), ch: [
              icon({ icon: 'sparkle', x: -81, size: 28, color: 'acc', sw: 2.2 }),
              text({ text: 'Summarize', x: -55, ax: 0, size: 28, weight: 600, color: 'inv' }),
            ] }),
          icon({ id: 'sumSpark', icon: 'sparkle', x: -402, y: -110, size: 32, color: 'acc', sw: 2.2, k: pop(M + 0.42, { from: 0.4 }) }),
          text({ id: 'sumTitle', text: 'Summary', x: -370, y: -110, ax: 0, size: 36, weight: 600, ls: -0.02, k: enter(M + 0.4, { dx: -14, x0: -370 }) }),
          text({ id: 'sumFrom', text: 'From 12 pages', x: 410, y: -110, ax: 1, size: 24, color: 'muted', k: enter(M + 0.48) }),
          ...bullets.map((s, i) => group({ id: 'bullet' + i, y: BY[i], k: enter(BT[i], { dx: -16, x0: 0 }), ch: [
            circle({ x: -398, d: 12, fill: 'ink' }),
            text({ text: s, x: -372, ax: 0, size: 30 }),
          ] })),
        ] }),
      cursorLayer([[0, 560, 440], [0.85, 560, 440], [1.4, 30, 330], [C + 0.25, 30, 330], [2.4, 380, 300]], [C], [], { inAt: 0.8 }),
    ];
  },
});

// 12 ─ Translate: the language pill rolls EN → ES and every word swaps with a short blur, left to right
UIK.define({
  id: 'ai-translate', name: 'Translate', cat: 'ai', T: 3.4, cam: 1.25,
  desc: 'A sentence card with a language pill: the click rolls EN to ES inside the pill, then each word of the sentence blurs out and its translation blurs in at its own place, one word after another from left to right.',
  build: () => {
    const C = 1.35, SP = 11.05, X0 = -520, SY = 34, HY = -76;
    const EN = [['The', 77.6], ['new', 89.6], ['studio', 133.2], ['opens', 130.8], ['next week', 221.9]];
    const ES = [['El', 40.8], ['nuevo', 129.2], ['estudio', 159.1], ['abre', 95.4], ['la próxima semana', 400.3]];
    const place = (ws) => { let x = X0; return ws.map(([s, w]) => { const o = { s, x: +x.toFixed(1) }; x += w + SP; return o; }); };
    const en = place(EN), es = place(ES), W = (i) => +(C + 0.16 + 0.08 * i).toFixed(2);
    return [
      rect({ id: 'card', w: 1160, h: 280, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'detected', text: 'Detected · English', x: X0, y: HY, ax: 0, size: 24, color: 'muted', k: k(enter(0.24), exit(W(0))) }),
        icon({ id: 'trSpark', icon: 'sparkle', x: X0 + 12, y: HY, size: 24, color: 'acc', sw: 2.2, k: pop(W(0) + 0.06, { from: 0.4 }) }),
        text({ id: 'translated', text: 'Translated · Spanish', x: X0 + 36, y: HY, ax: 0, size: 24, color: 'muted', k: enter(W(0), { dx: -10, x0: X0 + 36 }) }),
        rect({ id: 'langPill', x: 468, y: HY, w: 128, h: 60, r: 30, fill: 'soft', k: k(fadeIn(0.3), press(C, { to: 0.92 })), ch: [
          icon({ icon: 'globe', x: -30, size: 26, color: 'ink', sw: 2.2 }),
          rect({ id: 'langRoll', x: 18, w: 46, h: 36, clip: true, ch: [
            group({ id: 'langCol', k: { y: [[C + 0.04, C + 0.45, -36, 'Power3 Out']] },
              ch: ['EN', 'ES'].map((s, i) => text({ text: s, y: i * 36, size: 24, weight: 600 })) }),
          ] }),
        ] }),
        ...en.map((w, i) => text({ id: 'en' + i, text: w.s, x: w.x, y: SY, ax: 0, size: 46, weight: 500,
          k: k(enter(0.3 + 0.05 * i, { dy: 14, y0: SY }), exit(W(i), { dur: 0.14, blur: 8 })) })),
        ...es.map((w, i) => text({ id: 'es' + i, text: w.s, x: w.x, y: SY, ax: 0, size: 46, weight: 500, k: enter(W(i), { d: 0.05, dur: 0.3, blur: 10 }) })),
      ] }),
      cursorLayer([[0, 620, 300], [0.65, 620, 300], [1.25, 480, -64], [C + 0.25, 480, -64], [2.2, 640, 250]], [C], [], { inAt: 0.6 }),
    ];
  },
});

// 13 ─ Context meter: three segments fill one bar, Chat grows until the end turns accent; Compact shrinks it back
UIK.define({
  id: 'ai-token-meter', name: 'Context meter', cat: 'ai', T: 4.7, cam: 1.35,
  desc: 'A context bar fills with three segments (System, Files, Chat) while the percentage counts; the Chat segment keeps growing until the bar end turns accent at 82 % and a Compact button pops. The click shrinks Chat back and every number follows it down.',
  build: () => {
    const TW = 940, L = -470, GAP = 4, C = 3.55, K = C + 0.1, WARN = 2.75, BY = 12, LY = 88;
    const pw = (p) => +(TW * p / 100).toFixed(1);
    const chatW = (p) => +(pw(p - 28) - GAP).toFixed(1);
    const PCT = [[0.5, 0.85, 6, 'Power3 Out'], [0.85, 1.3, 28, 'Power3 Out'], [1.4, 1.9, 44, 'Power3 Out'], [2.0, 2.4, 58, 'Power3 Out'], [2.5, 3.0, 82, 'Linear']];
    const chatTrack = { x: L + pw(28), w: [[1.4, 1.9, chatW(44), 'Power3 Out'], [2.0, 2.4, chatW(58), 'Power3 Out'], [2.5, 3.0, chatW(82), 'Linear'], [K, K + 0.7, chatW(38), 'Expo Out']] };
    const accO = [0, [WARN - 0.03, WARN + 0.22, 1, 'Power2 Out'], [K, K + 0.3, 0, 'Power2 Out']];
    const item = (id, x, name, fill, count, extra) => group({ id, x, y: LY, k: enter(0.4 + (x + 470) / 2000, { dx: -12, x0: x }), ch: [
      circle({ x: 7, d: 14, fill }),
      ...(extra || []),
      text({ text: name, x: 24, ax: 0, size: 26, weight: 500 }),
      count,
    ] });
    return [
      rect({ id: 'card', w: 1060, h: 340, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'title', text: 'Context', x: L, y: -104, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: L }) }),
        text({ id: 'subOk', text: 'Plenty of room', x: L, y: -60, ax: 0, size: 26, color: 'muted', k: k(enter(0.3), exit(WARN)) }),
        text({ id: 'subWarn', text: 'Almost full', x: L, y: -60, ax: 0, size: 26, weight: 500, k: k(enter(WARN), exit(K)) }),
        text({ id: 'subDone', text: 'Compacted · 88k freed', x: L, y: -60, ax: 0, size: 26, color: 'muted', k: enter(K + 0.06) }),
        text({ id: 'pct', x: 470, y: -104, ax: 1, size: 48, weight: 600, ls: -0.02, num: { suf: '%', floor: true },
          k: k(enter(0.28), { value: [...PCT, [K, K + 0.7, 38, 'Power3 Out']] }) }),
        text({ id: 'pctOf', text: 'of 200k tokens', x: 470, y: -60, ax: 1, size: 24, color: 'muted', k: enter(0.34) }),
        rect({ id: 'track', y: BY, w: TW, h: 28, r: 14, fill: 'soft', clip: true, k: fadeIn(0.32), ch: [
          rect({ id: 'segSystem', x: L, pin: 'l', w: 0, h: 28, fill: 'ink', k: { w: [[0.5, 0.85, pw(6) - GAP, 'Power3 Out']] } }),
          rect({ id: 'segFiles', x: L + pw(6), pin: 'l', w: 0, h: 28, fill: 'ink/55', k: { w: [[0.85, 1.3, pw(22) - GAP, 'Power3 Out']] } }),
          rect({ id: 'segChat', x: chatTrack.x, pin: 'l', w: 0, h: 28, fill: 'ink/25', k: { w: chatTrack.w } }),
          // the stretch past 70 % turns accent: its left edge sits on the threshold and it grows with the Chat end
          rect({ id: 'segHot', x: L + pw(70) - GAP, pin: 'l', w: 0, h: 28, fill: 'acc', k: { w: [[WARN, 3.0, pw(12), 'Linear'], [K, K + 0.035, 0, 'Linear']] } }),
        ] }),
        item('legSystem', -470, 'System', 'ink', text({ text: '12k', x: 125, ax: 0, size: 26, color: 'muted' })),
        item('legFiles', -250, 'Files', 'ink/55', text({ text: '44k', x: 91, ax: 0, size: 26, color: 'muted' })),
        item('legChat', -60, 'Chat', 'ink/25', text({ id: 'chatCount', x: 91, ax: 0, size: 26, color: 'muted', num: { suf: 'k', floor: true },
          k: { value: [[1.4, 1.9, 32, 'Power3 Out'], [2.0, 2.4, 60, 'Power3 Out'], [2.5, 3.0, 108, 'Linear'], [K, K + 0.7, 20, 'Power3 Out']] } }),
          [circle({ id: 'chatDotHot', x: 7, d: 14, fill: 'acc', k: { opacity: accO } })]),
        rect({ id: 'compact', x: 372, y: LY, w: 196, h: 64, r: 32, fill: 'ink',
          k: k(pop(WARN + 0.35, { from: 0.5, dur: 0.38 }), { scale: [[C - 0.07, C, 0.94, 'Power2 Out'], [K + 0.05, K + 0.2, 0.8, 'Power2 In']] }, exit(K + 0.05, { dur: 0.15 })), ch: [
            icon({ icon: 'layers', x: -61, size: 26, color: 'inv', sw: 2.2 }),
            text({ text: 'Compact', x: -38, ax: 0, size: 26, weight: 600, color: 'inv' }),
          ] }),
      ] }),
      cursorLayer([[0, 560, 330], [2.95, 560, 330], [3.45, 390, 100], [C + 0.25, 390, 100], [4.3, 560, 320]], [C], [], { inAt: 2.9 }),
    ];
  },
});

// 14 ─ Rate a response: copy swaps to a check with a Copied tooltip, then thumbs up fills with a pop
UIK.define({
  id: 'ai-rate-response', name: 'Rate a response', cat: 'ai', T: 3.8, cam: { zoom: 1.45, y: 10 },
  desc: 'Under an answer bubble, the cursor clicks Copy: the icon swaps to a check and a Copied tooltip pops below and leaves again. A hover square glides to the thumbs up; the click swaps the outline for a filled accent thumb that pops with a small tilt.',
  build: () => {
    const AY = 90, AX = [-438, -366, -294, -222], C1 = 1.25, C2 = 2.3, BACK = C1 + 0.65;
    const btn = (i, ch) => group({ id: 'act' + i, x: AX[i], y: AY, k: enter(0.4 + 0.06 * i, { blur: 0, s: 0.8 }), ch });
    return [
      rect({ id: 'bubble', y: -70, w: 940, h: 196, r: 40, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'line0', text: 'Here’s a tighter version of your intro. I cut', x: -420, y: -24, ax: 0, size: 32, k: enter(0.22, { dx: -12, x0: -420 }) }),
        text({ id: 'line1', text: 'the second paragraph and kept the numbers.', x: -420, y: 24, ax: 0, size: 32, k: enter(0.3, { dx: -12, x0: -420 }) }),
      ] }),
      rect({ id: 'hover', x: AX[0], y: AY, w: 64, h: 64, r: 18, fill: 'soft',
        k: { opacity: [0, [1.02, 1.18, 1, 'Power2 Out'], [2.75, 3.0, 0, 'Power2 Out']], x: [[1.87, 2.22, AX[1], 'Power4 Out']],
             w: [[1.87, 1.99, 96, 'Power2 Out'], [1.99, 2.25, 64, 'Power3 Out']] } }),
      btn(0, [
        icon({ id: 'copy', icon: 'copy', size: 30, color: 'muted', sw: 2.2,
          k: { opacity: [1, [C1, C1 + 0.12, 0, 'Power2 In'], [BACK + 0.05, BACK + 0.3, 1, 'Power2 Out']], scale: [1, [C1, C1 + 0.12, 0.6, 'Power2 In'], [BACK + 0.05, BACK + 0.35, 1, 'Power3 Out']] } }),
        icon({ id: 'copied', icon: 'check', size: 30, color: 'ink', sw: 2.8, k: k(pop(C1 + 0.04, { from: 0.5 }), exit(BACK, { s: 0.6, dur: 0.12 })) }),
      ]),
      btn(1, [
        group({ id: 'thumbOutline', k: exit(C2, { s: 0.7, dur: 0.1, blur: 0 }), ch: [glyph({ d: THUMB_UP, size: 30, color: 'muted', sw: 2.2 })] }),
        group({ id: 'thumbFilled', k: k(pop(C2 + 0.02, { from: 0.4 }), { rot: [-18, [C2 + 0.02, C2 + 0.45, 0, 'Back Out']] }),
          ch: [glyph({ d: THUMB_UP, size: 30, color: 'acc', fill: 'acc', sw: 2.2 })] }),
      ]),
      btn(2, [glyph({ d: THUMB_DOWN, size: 30, color: 'muted', sw: 2.2 })]),
      btn(3, [icon({ icon: 'refresh', size: 28, color: 'muted', sw: 2.2 })]),
      text({ id: 'thanks', text: 'Thanks for the feedback', x: -170, y: AY, ax: 0, size: 24, color: 'muted', k: enter(C2 + 0.35, { dx: -10, x0: -170 }) }),
      rect({ id: 'tooltip', x: AX[0], y: AY + 44, pin: 't', w: 116, h: 50, r: 14, fill: 'ink', k: k(pop(C1 + 0.06, { from: 0.6, dur: 0.38 }), exit(BACK - 0.05, { s: 0.9 })), ch: [
        rect({ y: -25, w: 14, h: 14, r: 3, rot: 45, fill: 'ink' }),
        text({ text: 'Copied', size: 22, weight: 500, color: 'inv' }),
      ] }),
      cursorLayer([[0, 440, 330], [0.7, 440, 330], [1.15, -430, 100], [1.75, -430, 100], [2.15, -358, 100], [2.6, -358, 100], [3.2, -100, 320]], [C1, C2], [], { inAt: 0.65 }),
    ];
  },
});

// 15 ─ Inline autocomplete: a phrase types, ghost text offers the rest, Tab accepts and the caret jumps to the end
UIK.define({
  id: 'ai-autocomplete', name: 'Inline autocomplete', cat: 'ai', T: 3.8, cam: 1.3,
  desc: 'A reply is typed with an accent caret; muted ghost text fades in after it with a Tab hint. The Tab keycap presses down, the ink sweeps across the ghost text and the caret jumps to the end of the sentence.',
  build: () => {
    const S = 'Thanks for the notes! I’ll send the final draft by Friday.', N = S.length, TYPED = 'Thanks for the notes! I’ll send'.length;
    const TY0 = 0.5, TY1 = 1.5, GH = 1.72, P = 2.55, X0 = -490, LY2 = 40;
    return [
      rect({ id: 'card', w: 1100, h: 380, r: 40, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'subject', text: 'Reply to Maya', x: X0, y: -128, ax: 0, size: 28, weight: 600, k: enter(0.22, { dx: -12, x0: X0 }) }),
        text({ id: 'saved', text: 'Draft · saved', x: 490, y: -128, ax: 1, size: 24, color: 'muted', k: enter(0.3) }),
        rect({ id: 'hairline', y: -84, w: 1100, h: 2, fill: 'line', k: fadeIn(0.26) }),
        text({ id: 'greeting', text: 'Hi Maya,', x: X0, y: -20, ax: 0, size: 34, k: enter(0.3) }),
        text({ id: 'ghost', text: S, x: X0, y: LY2, ax: 0, size: 34, color: 'muted', k: enter(GH, { d: 0, dur: 0.3, blur: 0, s: 1 }) }),
        text({ id: 'typed', text: S, x: X0, y: LY2, ax: 0, size: 34, caret: true, caretColor: 'acc', caretFrom: 0.36,
          k: { reveal: [0, [TY0, TY1, TYPED / N, 'Linear'], [P + 0.02, P + 0.2, 1, 'Linear']] } }),
        group({ id: 'hint', y: 130, k: k(enter(GH + 0.12, { dy: 10, y0: 130 }), exit(P + 0.5, { dur: 0.16 })), ch: [
          rect({ id: 'lip', x: X0 + 44, y: 5, w: 88, h: 54, r: 14, fill: 'dim' }),
          rect({ id: 'cap', x: X0 + 44, w: 88, h: 54, r: 14, fill: 'card', stroke: 'line', sw: 2,
            k: { y: [[P - 0.06, P, 5, 'Power2 Out'], [P + 0.24, P + 0.46, 0, 'Power3 Out']], fill: [[P - 0.06, P + 0.02, 'ink', 'Power2 Out'], [P + 0.24, P + 0.46, 'card', 'Power2 Out']] },
            ch: [text({ text: 'Tab', size: 22, weight: 600, k: { color: [[P - 0.06, P + 0.02, 'inv', 'Power2 Out'], [P + 0.24, P + 0.46, 'ink', 'Power2 Out']] } })] }),
          text({ text: 'to accept', x: X0 + 104, ax: 0, size: 24, color: 'muted' }),
        ] }),
        group({ id: 'accepted', y: 130, k: enter(P + 0.62, { dx: -12, x0: 0 }), ch: [
          icon({ icon: 'check', x: X0 + 12, size: 24, color: 'muted', sw: 2.8 }),
          text({ text: 'Suggestion accepted', x: X0 + 36, ax: 0, size: 24, color: 'muted' }),
        ] }),
      ] }),
    ];
  },
});
})();
