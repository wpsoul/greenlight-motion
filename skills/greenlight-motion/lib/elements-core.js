/* UI Motion Kit — core exemplars. Read these before writing new elements: they show the style
   (warm canvas, black/white components, one accent, Helvetica, big type) and every engine feature. */
(function () {
const { rect, circle, text, path, icon, group, k, enter, exit, pop, press, cursorLayer } = UIK.h;

// 1 ─ Toggle switch: click → knob stretches across, track + icon tile recolour, subtitle swaps
UIK.define({
  id: 'toggle', name: 'Toggle switch', cat: 'controls', T: 3.0, cam: 1.5,
  desc: 'Click flips the switch: the knob stretches while it travels, the track and icon tile recolour, the subtitle swaps with a blur.',
  build: () => {
    const C = 1.25;
    return [
      rect({ id: 'card', w: 820, h: 220, r: 56, fill: 'card', shadow: 1,
        k: { scale: [0.6, [0.1, 0.62, 1, 'Back Out']], opacity: [0, [0.1, 0.22, 1, 'Linear']] },
        ch: [
          rect({ id: 'iconTile', x: -300, w: 108, h: 108, r: 32, fill: 'soft', k: { fill: [[C + 0.05, C + 0.35, 'ink', 'Power2 Out']] },
            ch: [icon({ id: 'moon', icon: 'moon', size: 52, color: 'ink', k: { color: [[C + 0.05, C + 0.35, 'inv', 'Power2 Out']], rot: [[C + 0.05, C + 0.6, -20, 'Back Out']] } })] }),
          text({ id: 'title', text: 'Dark mode', x: -214, y: -24, ax: 0, size: 48, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -214 }) }),
          text({ id: 'subOff', text: 'Off', x: -214, y: 32, ax: 0, size: 30, color: 'muted', k: k(enter(0.3), exit(C + 0.02)) }),
          text({ id: 'subOn', text: 'On · follows system', x: -214, y: 32, ax: 0, size: 30, color: 'muted', k: enter(C + 0.02) }),
          rect({ id: 'track', x: 262, w: 180, h: 104, r: 52, fill: 'dim', k: k({ fill: [[C, C + 0.25, 'acc', 'Power2 Out']] }, press(C, { to: 0.95 })),
            ch: [rect({ id: 'knob', x: -38, w: 80, h: 80, r: 40, fill: '#FFFFFF', shadow: 3,
              k: { x: [[C, C + 0.45, 38, 'Power4 Out']], w: [[C, C + 0.13, 112, 'Power2 Out'], [C + 0.13, C + 0.5, 80, 'Power3 Out']] } })] }),
        ] }),
      cursorLayer([[0, 500, 290], [0.55, 500, 290], [1.12, 282, 16], [1.9, 282, 16], [2.7, 360, 150]], [C], [], { inAt: 0.35 }),
    ];
  },
});

// 2 ─ Segmented control: a liquid indicator (stretches while travelling), difference-blend labels
UIK.define({
  id: 'segmented', name: 'Segmented control', cat: 'controls', T: 3.3, cam: { zoom: 1.45, y: -20 },
  desc: 'A black indicator jumps between segments and stretches in flight. Labels use the difference blend mode, so they invert over the indicator.',
  build: () => {
    const X = [-352.5, -117.5, 117.5, 352.5], W = 227, C1 = 1.2, C2 = 2.3;
    return [
      text({ id: 'caption', text: 'Reasoning effort', x: -480, y: -118, ax: 0, size: 30, color: 'muted', k: enter(0.2) }),
      rect({ id: 'seg', w: 960, h: 124, r: 62, fill: 'card', shadow: 1,
        k: { scale: [0.6, [0.08, 0.6, 1, 'Back Out']], opacity: [0, [0.08, 0.2, 1, 'Linear']] },
        ch: [
          rect({ id: 'indicator', x: X[0], w: W, h: 104, r: 52, fill: 'ink',
            k: { x: [[C1, C1 + 0.5, X[2], 'Power4 Out'], [C2, C2 + 0.45, X[3], 'Power4 Out']],
                 w: [[C1, C1 + 0.18, W + 250, 'Power2 Out'], [C1 + 0.18, C1 + 0.6, W, 'Power3 Out'], [C2, C2 + 0.15, W + 120, 'Power2 Out'], [C2 + 0.15, C2 + 0.5, W, 'Power3 Out']] } }),
          ...['Low', 'Medium', 'High', 'Max'].map((s, i) => text({ id: 'lbl' + i, text: s, x: X[i], size: 36, weight: 500, color: '#FFFFFF', blend: 'difference' })),
        ] }),
      cursorLayer([[0, 560, 300], [0.5, 560, 300], [1.08, 140, 20], [1.6, 140, 20], [2.18, 372, 24], [2.6, 372, 24], [3.2, 440, 170]], [C1, C2], [], { inAt: 0.3 }),
    ];
  },
});

// 3 ─ One shape, three states: pill → card → button. The reference's signature move.
UIK.define({
  id: 'pill-card-morph', name: 'Pill → card → button', cat: 'morph', T: 4.8,
  cam: { zoom: 1.9, k: { zoom: [[1.5, 2.4, 1.35, 'Power2 Smooth'], [3.2, 4.1, 1.8, 'Power2 Smooth']] } },
  desc: 'One shape never cuts: it morphs size, corners and colour between states while the content swaps with a blur. Ends on a clicked call to action.',
  build: () => {
    const M1 = 1.5, M2 = 3.2, C = 4.0;
    return [
      rect({ id: 'shape', w: 560, h: 128, r: 64, fill: 'ink', shadow: 1,
        k: k({ scale: [0.55, [0.12, 0.66, 1, 'Back Out']], opacity: [0, [0.12, 0.24, 1, 'Linear']],
               w: [[M1, M1 + 0.7, 1000, 'Expo Out'], [M2, M2 + 0.7, 560, 'Expo Out']],
               h: [[M1, M1 + 0.7, 380, 'Expo Out'], [M2, M2 + 0.7, 128, 'Expo Out']],
               r: [[M1, M1 + 0.5, 48, 'Power3 Out'], [M2, M2 + 0.5, 64, 'Power3 Out']],
               fill: [[M1, M1 + 0.3, 'card', 'Power2 Out'], [M2, M2 + 0.3, 'acc', 'Power2 Out']] }, press(C, { to: 0.96 })),
        ch: [
          group({ id: 'pillContent', k: k(enter(0.3, { d: 0 }), exit(M1)), ch: [
            icon({ id: 'spark', icon: 'sparkle', x: -198, size: 44, color: 'acc' }),
            text({ id: 'pillLabel', text: 'New release', x: -162, ax: 0, size: 48, weight: 600, ls: -0.02, color: 'inv' }),
            rect({ id: 'badge', x: 194, w: 76, h: 48, r: 24, fill: 'acc', k: pop(0.62), ch: [text({ text: 'v2', size: 26, weight: 600, color: '#FFFFFF' })] }),
          ] }),
          group({ id: 'cardContent', k: k(enter(M1 + 0.05), exit(M2)), ch: [
            rect({ id: 'tile', x: -330, w: 230, h: 230, r: 48, fill: 'acc', k: pop(M1 + 0.18, { from: 0.6 }), ch: [icon({ icon: 'zap', size: 112, color: '#FFFFFF', sw: 6.5 })] }),
            text({ id: 'cardTitle', text: 'Faster exports', x: -170, y: -52, ax: 0, size: 64, weight: 600, ls: -0.03, k: enter(M1 + 0.22, { dx: -20, x0: -170 }) }),
            text({ id: 'cardSub', text: 'Renders finish up to 3× sooner', x: -168, y: 12, ax: 0, size: 32, color: 'muted', k: enter(M1 + 0.34) }),
            rect({ id: 'chip', x: -48, y: 78, w: 244, h: 52, r: 26, fill: 'soft', k: enter(M1 + 0.46),
              ch: [text({ text: 'Available today', size: 24, weight: 500 })] }),
          ] }),
          group({ id: 'ctaContent', k: enter(M2 + 0.05), ch: [
            text({ id: 'ctaLabel', text: 'Update now', x: -40, size: 46, weight: 600, ls: -0.02, color: '#FFFFFF' }),
            icon({ id: 'ctaArrow', icon: 'arrow', x: 150, size: 44, color: '#FFFFFF', sw: 2.6,
              k: { x: [[C, C + 0.2, 168, 'Power2 Out'], [C + 0.2, C + 0.55, 150, 'Power3 Out']] } }),
          ] }),
        ] }),
      cursorLayer([[0, 470, 250], [3.3, 470, 250], [3.88, 96, 30], [4.5, 96, 30], [4.8, 140, 110]], [C], [], { inAt: 3.2 }),
    ];
  },
});

// 4 ─ Terminal: prompt types in, a spinner runs, result rows land, status turns to Done
UIK.define({
  id: 'terminal', name: 'Terminal typing', cat: 'content', T: 5.6, cam: 1.2,
  desc: 'A light terminal window: the prompt types in with a caret, a spinner counts elapsed time, three result rows land, then the status flips to done.',
  build: () => {
    const TY0 = 0.9, TY1 = 2.2, B = 2.55, DONE = 4.55;
    const rows = ['Created pricing.html', 'Added three plan cards', 'Checked the mobile layout'];
    return [
      rect({ id: 'window', w: 1240, h: 700, r: 28, fill: 'panel', shadow: 1,
        k: { scale: [0.7, [0.08, 0.6, 1, 'Back Out']], opacity: [0, [0.08, 0.2, 1, 'Linear']] },
        ch: [
          ...[0, 1, 2].map((i) => circle({ id: 'dot' + i, x: -580 + i * 28, y: -318, d: 16, fill: 'dim' })),
          text({ id: 'winTitle', text: 'agent — ~/site', y: -318, size: 22, color: 'muted' }),
          rect({ id: 'hairline', y: -288, w: 1240, h: 2, fill: 'line' }),
          rect({ id: 'welcome', y: -218, w: 1164, h: 88, r: 18, stroke: 'line', sw: 2, k: enter(0.3), ch: [
            icon({ icon: 'sparkle', x: -538, size: 32, color: 'acc' }),
            text({ text: 'Welcome back', x: -506, ax: 0, size: 29, weight: 500 }),
            text({ text: 'model · fast', x: 552, ax: 1, size: 24, color: 'muted' }),
          ] }),
          text({ id: 'chevron', text: '›', x: -582, y: -110, size: 40, color: 'muted', k: enter(0.5) }),
          text({ id: 'prompt', text: 'Build a pricing page with three plans', x: -552, y: -110, ax: 0, size: 36,
            caret: true, caretColor: 'ink', caretFrom: 0.5, caretUntil: B, k: { reveal: [0, [TY0, TY1, 1, 'Linear']] } }),
          group({ id: 'status', x: -560, y: -20, k: enter(B, { d: 0 }), ch: [
            icon({ id: 'spinner', icon: 'sparkle', size: 34, color: 'acc', k: k({ rot: [[B, DONE, 720, 'Linear']] }, exit(DONE, { s: 0.6 })) }),
            icon({ id: 'doneIcon', icon: 'check', size: 34, color: 'acc', sw: 3, k: pop(DONE + 0.05) }),
            text({ id: 'building', text: 'Building…', x: 34, ax: 0, size: 32, weight: 500, k: exit(DONE) }),
            text({ id: 'elapsed', x: 206, ax: 0, size: 28, color: 'muted', num: { pre: '0:0', sep: false, floor: true }, k: k({ value: [[B, DONE, 4, 'Linear']] }, exit(DONE)) }),
            text({ id: 'done', text: 'Done in 4s', x: 34, ax: 0, size: 32, weight: 500, color: 'acc', k: enter(DONE) }),
          ] }),
          ...rows.map((s, i) => group({ id: 'row' + i, x: -560, y: 60 + i * 64, k: enter(3.15 + i * 0.4, { dx: -18, x0: -560 }), ch: [
            icon({ icon: 'check', size: 30, color: 'muted', sw: 2.6 }),
            text({ text: s, x: 34, ax: 0, size: 30 }),
          ] })),
          text({ id: 'footer', text: 'Enter to send · Esc to stop', x: -580, y: 310, ax: 0, size: 22, color: 'muted', k: enter(0.4) }),
        ] }),
    ];
  },
});

// 5 ─ Bar chart: bars rise on a stagger, the total counts up, hover lifts a tooltip and dims the rest
UIK.define({
  id: 'bar-chart', name: 'Bar chart + tooltip', cat: 'data', T: 3.7, cam: 1.3,
  desc: 'Bars rise on a stagger from a shared baseline while the total counts up. The cursor hovers the peak: it turns accent, the others dim, a tooltip pops.',
  build: () => {
    const HS = [150, 222, 176, 298, 380, 256, 198], D = ['M', 'T', 'W', 'T', 'F', 'S', 'S'], HOV = 2.45, P = 4;
    return [
      rect({ id: 'card', w: 1080, h: 660, r: 40, fill: 'card', shadow: 1,
        k: { scale: [0.7, [0.08, 0.6, 1, 'Back Out']], opacity: [0, [0.08, 0.2, 1, 'Linear']] },
        ch: [
          text({ id: 'title', text: 'Weekly signups', x: -470, y: -250, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.25) }),
          text({ id: 'sub', text: 'Last 7 days', x: -470, y: -204, ax: 0, size: 26, color: 'muted', k: enter(0.33) }),
          text({ id: 'total', x: 470, y: -250, ax: 1, size: 48, weight: 600, ls: -0.02, num: {}, k: k(enter(0.3), { value: [[0.5, 2.0, 1680, 'Power3 Out']] }) }),
          text({ id: 'totalLbl', text: 'total', x: 470, y: -204, ax: 1, size: 26, color: 'muted', k: enter(0.38) }),
          rect({ id: 'baseline', y: 240, w: 940, h: 2, fill: 'line', k: enter(0.3, { blur: 0 }) }),
          ...HS.map((h, i) => rect({ id: 'bar' + i, x: -390 + i * 130, y: 238, pin: 'b', w: 72, h: 0, r: 14, fill: 'ink',
            k: { h: [[0.5 + i * 0.07, 1.3 + i * 0.07, h, 'Power4 Out']], fill: [[HOV, HOV + 0.3, i === P ? 'acc' : 'dim', 'Power2 Out']] } })),
          ...D.map((d, i) => text({ id: 'day' + i, text: d, x: -390 + i * 130, y: 276, size: 24, color: 'muted', k: enter(0.45 + i * 0.05) })),
          rect({ id: 'tooltip', x: -390 + P * 130, y: 238 - 380 - 22, pin: 'b', w: 196, h: 66, r: 18, fill: 'ink', k: pop(HOV + 0.05, { from: 0.5 }),
            ch: [text({ text: 'Fri · 380', size: 27, weight: 500, color: 'inv' })] }),
        ] }),
      cursorLayer([[0, 600, 380], [1.8, 600, 380], [2.38, 150, 40], [3.7, 160, 46]], [], [], { inAt: 1.75 }),
    ];
  },
});

// 6 ─ Success check: ring draws, fills, check draws, the group lifts for the label
UIK.define({
  id: 'success-check', name: 'Success check', cat: 'feedback', T: 2.9, cam: { zoom: 1.7, k: { zoom: [[1.3, 2.0, 1.45, 'Power2 Smooth']] } },
  desc: 'A ring draws itself (Trim Paths), the disc fills with a pop, the check writes on, then the group lifts to make room for the label.',
  build: () => {
    const RING = 'M0 -124 A124 124 0 1 1 0 124 A124 124 0 1 1 0 -124';
    return [
      group({ id: 'mark', k: { y: [[1.3, 1.9, -70, 'Power3 Out']] }, ch: [
        path({ id: 'ring', d: RING, stroke: 'acc', sw: 10, trimmed: true, k: k({ trimE: [0, [0.15, 0.85, 100, 'Power2 Smooth']] }, { opacity: [[1.0, 1.2, 0, 'Linear']] }) }),
        circle({ id: 'disc', d: 258, fill: 'acc', k: pop(0.75, { from: 0.4, dur: 0.5 }) }),
        path({ id: 'tick', d: 'M-54 4 L-16 42 L60 -40', stroke: '#FFFFFF', sw: 20, trimmed: true, k: { trimE: [0, [0.98, 1.4, 100, 'Power3 Out']] } }),
      ] }),
      text({ id: 'label', text: 'Payment complete', y: 150, size: 60, weight: 600, ls: -0.03, k: enter(1.45, { dy: 24, y0: 150 }) }),
      text({ id: 'sub', text: 'A receipt is on its way to your inbox', y: 212, size: 32, color: 'muted', k: enter(1.6, { dy: 16, y0: 212 }) }),
    ];
  },
});
})();
