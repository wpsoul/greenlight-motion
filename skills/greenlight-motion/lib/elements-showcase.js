/* GL Motion — Product showcase: the user's app screens (desktop windows, phone screens) choreographed
 * for product overviews and tutorials. Each item re-designs the motion idea of one reelfolio loop (studied
 * in html/reel-labs) for product screens and a 4–8 s beat: every screen is a photo slot (v 'desktop' /
 * 'phone' stand-ins) the user fills with a real screenshot. Easing roles live in one E table per item. */

/* Product showcase — Screens tour (grid family, after the reelfolio loop "Panel" / gridzoomstrip). */
(function () {
const { photo, text, k, invEase } = UIK.h;
const E = { enter: 'Spring Out', move: 'Spring Out', travel: 'Spring Smooth', exit: 'Power2 In', pop: 'Spring Pop', fade: 'Spring Out', drift: 'Linear' };   // the spring feel (references/easing.md)
const r3 = (v) => Math.round(v * 1000) / 1000;

// ── the grid family (shared with grid-spotlight): a 3×3 wall of 16:10 desktop screens ──
// Every screen is built at hero size (1180 × 737.5) and drawn at S0 in the wall, so a screen that grows into a
// hero stays ONE picture slot and all screens carry the same (scaled) shadow and corner.
const TW = 400, TH = 250, GAP = 32, PX = TW + GAP, PY = TH + GAP, R = 14;   // the wall, as seen
const HW = 1180, HH = HW * TH / TW, S0 = TW / HW;                           // the screens, as built
const cellX = (c) => (c - 1) * PX, cellY = (r) => (r - 1) * PY;
// the entrance: a diagonal wave, each screen fades up out of a soft blur and settles from 90 %
const IN0 = 0.12, IN_GAP = 0.07;
const tileIn = (t, y0) => ({
  opacity: [0, [r3(t), r3(t + 0.3), 1, E.fade]],
  blur: [r3(6 / S0), [r3(t), r3(t + 0.3), 0, E.fade]],
  scale: [r3(0.9 * S0), [r3(t), r3(t + 0.6), r3(S0), E.enter]],
  y: [y0 + 24, [r3(t), r3(t + 0.6), y0, E.enter]],
});
const screen = (i, x, y, tracks, o = {}) => photo({ id: 'screen' + (i + 1), v: 'desktop', x, y, w: HW, h: HH, r: r3(R / S0), scale: S0, shadow: 2, ...o,
  k: k(tileIn(IN0 + ((i % 3) + Math.floor(i / 3)) * IN_GAP, y), tracks) });

// The reference unfolds its grid by sliding every row along into row 1's line (row-major order) while the
// camera zooms 2× onto the first card. Here the middle row stays put: the top row slides left and the bottom
// row right by three screens (the leading screen a beat ahead, so each row stretches and relaxes), and each
// screen drops into the line the moment it has cleared the middle row — no screen ever crosses another.
const ZS = 1.8, CY = 14;                          // strip zoom (screens 720 × 450 on screen); framing lifted for the labels
const X0 = 1.05, DX = 0.7, XS = 0.03, DY = 0.6;   // unzip: slide out, then drop in
const C0 = 1.45, C1 = 2.35;                       // camera dives onto the head of the strip (screen 2 centred)
const L0 = 2.12, LS = 0.04, LO = 4.33;            // step labels: in once the line has formed, out before the fold
const P0 = 2.5, P1 = 4.35;                        // camera tours the strip to its tail (screen 8 centred)
const H0 = 4.42, H1 = 5.4;                        // camera pulls back to the grid
const F0 = 4.58, DFY = 0.45, DFX = 0.62;          // fold: step out of the line, then slide home
const M = 10;                                     // clearance kept between screens (px)
const NAMES = ['Overview', 'Projects', 'Board', 'Timeline', 'Inbox', 'Reports', 'Files', 'Team', 'Settings'];
// the time fraction at which a move with easing e reaches progress p
const at = (p, e = E.travel) => invEase(e, Math.min(0.999, Math.max(0.001, p)));

UIK.define({
  id: 'screens-tour', name: 'Screens tour', cat: 'showcase', T: 6.0,
  desc: 'A 3×3 wall of app screens builds in; the top row slides out left and the bottom row right, each screen dropping into the middle row’s line, the camera dives onto the head of the strip and tours it screen by screen to the tail under short step labels, then pulls back as the rows fold home into the grid.',
  cam: { zoom: 1, x: 0, y: 0, k: {
    zoom: [[C0, C1, ZS, E.travel], [H0, H1, 1, E.travel]],
    x: [[C0, C1, -3 * PX, E.travel], [P0, P1, 3 * PX, E.travel], [H0, H1, 0, E.travel]],
    y: [[C0, C1, CY, E.travel], [H0, H1, 0, E.travel]],
  } },
  build: () => {
    const screens = [], labels = [];
    // vertical progress a screen may make while it still overlaps the middle row horizontally
    const yFree = (PY - TH - M) / PY;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const i = r * 3 + c, x = cellX(c), y = cellY(r);
      let tr = {};
      if (r !== 1) {
        const dir = r === 0 ? -1 : 1, D = 3 * PX;
        const inner = r === 0 ? c : 2 - c;      // 2 = the screen next to the middle row's end
        // out: the outer screen leads (the row stretches, then relaxes); each screen starts to drop as soon
        // as its near edge will have cleared the middle row's end before the drop has covered yFree
        const xs = X0 + inner * XS;
        const ys = xs + DX * at((PX + TW + M - dir * x) / D) - DY * at(yFree);
        // home: the rows step out of the line together, then slide home inner screen first, starting when
        // the inner screen is clear of the middle row vertically
        const xh = F0 + DFY * at(1 - yFree) - DFX * at((D - 2 * PX - TW - M) / D) + (2 - inner) * XS;
        tr = {
          x: [[r3(xs), r3(xs + DX), x + dir * D, E.travel], [r3(xh), r3(xh + DFX), x, E.travel]],
          y: [[r3(ys), r3(ys + DY), 0, E.travel], [F0, r3(F0 + DFY), y, E.travel]],
        };
      }
      screens.push(screen(i, x, y, tr, { offscreen: true }));   // the tour pans every screen out of frame
      // the step label sits under the screen's place in the strip; it only shows while the strip holds still
      const lx = (i - 4) * PX, ly = TH / 2 + 30, a = r3(L0 + i * LS);
      labels.push(text({ id: 'label' + (i + 1), text: NAMES[i], x: lx, y: ly, size: 17, weight: 600, offscreen: true,
        k: { opacity: [0, [a, r3(a + 0.3), 1, E.fade], [LO, r3(LO + 0.14), 0, E.exit]], y: [ly + 8, [a, r3(a + 0.4), ly, E.enter]] } }));
    }
    return [...labels, ...screens];
  },
});
})();

/* Product showcase — Grid spotlight (grid family, after the reelfolio loop "Spot" / spotlightzoom). */
(function () {
const { photo, text, k } = UIK.h;
const E = { enter: 'Spring Out', move: 'Spring Out', travel: 'Spring Smooth', exit: 'Power2 In', pop: 'Spring Pop', fade: 'Spring Out', drift: 'Linear' };   // the spring feel (references/easing.md)
const r3 = (v) => Math.round(v * 1000) / 1000;

// ── the grid family (shared with screens-tour): a 3×3 wall of 16:10 desktop screens ──
// Every screen is built at hero size (1180 × 737.5) and drawn at S0 in the wall, so a screen that grows into a
// hero stays ONE picture slot and all screens carry the same (scaled) shadow and corner.
const TW = 400, TH = 250, GAP = 32, PX = TW + GAP, PY = TH + GAP, R = 14;   // the wall, as seen
const HW = 1180, HH = HW * TH / TW, S0 = TW / HW;                           // the screens, as built
const cellX = (c) => (c - 1) * PX, cellY = (r) => (r - 1) * PY;
// the entrance: a diagonal wave, each screen fades up out of a soft blur and settles from 90 %
const IN0 = 0.12, IN_GAP = 0.07;
const tileIn = (t, y0) => ({
  opacity: [0, [r3(t), r3(t + 0.3), 1, E.fade]],
  blur: [r3(6 / S0), [r3(t), r3(t + 0.3), 0, E.fade]],
  scale: [r3(0.9 * S0), [r3(t), r3(t + 0.6), r3(S0), E.enter]],
  y: [y0 + 24, [r3(t), r3(t + 0.6), y0, E.enter]],
});
const screen = (i, x, y, tracks, o = {}) => photo({ id: 'screen' + (i + 1), v: 'desktop', x, y, w: HW, h: HH, r: r3(R / S0), scale: S0, shadow: 2, ...o,
  k: k(tileIn(IN0 + ((i % 3) + Math.floor(i / 3)) * IN_GAP, y), tracks) });

// The reference grows each card in turn from its cell to the whole grid box (a twin painted above the wall).
// Here one screen is chosen: it is built at hero size and starts scaled down to its cell, so the grid tile and
// the hero are ONE picture slot; it grows to the centre while the rest of the wall steps back (shrinks toward
// the centre and fades, in a ripple outward from the chosen screen) and the camera eases in on it.
const PICK = 5;                                     // the chosen screen (row-major, 0 = top left)
const HY = -24;                                     // the hero sits a little above centre, for its label
const RH = 24;                                      // the hero's corner radius (≈ 26 on screen at the end)
const SEL = 1.3;                                    // the choice: the rest of the wall dims, the chosen screen lifts
const DIM = 0.4, LIFT = 1.04;
const G = 1.75, DG = 0.9;                           // the chosen screen grows
const BS = 0.05, BK = 0.9;                          // the wall's ripple per cell of distance, and how far it steps back
const ZH = 1.1, Z0 = G - 0.15, Z1 = 3.9;            // the camera eases in on the hero
const LB = G + 0.72;                                // the feature label

UIK.define({
  id: 'grid-spotlight', name: 'Grid spotlight', cat: 'showcase', T: 4.5,
  desc: 'A 3×3 wall of app screens builds in; the rest of the wall dims as one screen lifts, then it grows out of its cell into a centred hero while the others step back and fade in a ripple from it, the camera eases in, and a short feature label rises under the hero.',
  cam: { zoom: 1, k: { zoom: [[Z0, Z1, ZH, E.travel]] } },
  build: () => {
    const pc = PICK % 3, pr = Math.floor(PICK / 3);
    const wall = [];
    let hero = null;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const i = r * 3 + c, x = cellX(c), y = cellY(r);
      if (i === PICK) {
        hero = screen(i, x, y, {
          scale: [[SEL, SEL + 0.4, r3(S0 * LIFT), E.enter], [G, G + DG, 1, E.move]],
          x: [[G, G + DG, 0, E.move]], y: [[G, G + DG, HY, E.move]], r: [[G, G + DG, RH, E.move]],
        });
        continue;
      }
      const d = r3(Math.hypot(c - pc, r - pr) * BS), a = r3(SEL + d), b = r3(G - 0.06 + d);
      wall.push(screen(i, x, y, {
        opacity: [[a, r3(a + 0.35), DIM, E.fade], [b, r3(b + 0.42), 0, E.fade]],
        x: [[b, r3(b + 0.7), r3(x * BK), E.move]], y: [[b, r3(b + 0.7), r3(y * BK), E.move]], scale: [[b, r3(b + 0.7), r3(S0 * BK), E.move]],
      }));
    }
    const ly = HY + HH / 2 + 38;
    return [
      ...wall,
      hero,
      text({ id: 'label', text: 'Reports', y: ly, size: 28, weight: 600,
        k: { opacity: [0, [LB, r3(LB + 0.3), 1, E.fade]], y: [ly + 12, [LB, r3(LB + 0.5), ly, E.enter]] } }),
    ];
  },
});
})();

/* GL Motion — Product showcase: Feature relay (reference: reelfolio "focusshift" / Relay). */
(function () {
const { rect, text, photo, group } = UIK.h;

// easing roles — the only easing names in this file
const E = { enter: 'Spring Out', move: 'Spring Out', travel: 'Spring Smooth', exit: 'Power2 In', pop: 'Spring Pop', fade: 'Spring Out', drift: 'Linear' };   // the spring feel (references/easing.md)

// fade + un-blur + settle (the kit's enter(), on the E table); dx/dy travel in to x0/y0
const enterE = (t, o = {}) => {
  const a = t + (o.d ?? 0), b = a + (o.dur ?? 0.3), out = { opacity: [0, [a, b, 1, E.fade]] };
  if ((o.blur ?? 10) > 0) out.blur = [o.blur ?? 10, [a, b, 0, E.fade]];
  if ((o.s ?? 0.94) !== 1) out.scale = [o.s ?? 0.94, [a, b + 0.08, 1, E.enter]];
  if (o.dy) out.y = [(o.y0 ?? 0) + o.dy, [a, b + 0.08, o.y0 ?? 0, E.enter]];
  if (o.dx) out.x = [(o.x0 ?? 0) + o.dx, [a, b + 0.08, o.x0 ?? 0, E.enter]];
  return out;
};
const merge = (...parts) => UIK.h.k(...parts);
const r3 = (n) => +n.toFixed(3);

// 1 ─ Feature relay: a big desktop screen beside a column of four step cards. The focus ring steps down the
// list; each time, the active step's thumbnail grows out of its card into the main view (on top), while the
// screen it replaces shrinks back into its own card's thumbnail.
//
// Reference decode (focusshift, 10 s = 6 beats × 1.667 s): a big portrait left, a column of thumbs right;
// every beat the TOP thumb grows into the big slot while the old big shrinks into the BOTTOM slot and the
// others step up one place — a pure rect lerp (all four edges on one progress), Power2 Smooth over the first
// 0.667 s of the beat; the picture keeps its big-card layout and is only scaled/cropped (one texture per
// picture); paint order: incoming big on top, outgoing big under it, thumbs below.
// Here: a tutorial's steps keep their order, so the list never rotates — the old main goes home to its own
// card instead of the bottom slot, and a step's thumbnail stays in its card while a copy of the same picture
// (one media slot, src shared) grows out of it. Focus only moves DOWN the list, so each incoming screen is
// later in paint order than the one it replaces: a static order works, no re-stacking.
UIK.define({
  id: 'feature-relay', name: 'Feature relay', cat: 'showcase', T: 5.5, cam: 1,
  desc: 'A large desktop screen beside a column of four step cards; an accent ring steps down the list and each time the chosen step\'s thumbnail grows out of its card to take over the main view, while the screen it replaces shrinks back into its own card.',
  build: () => {
    // layout: main 1008 × 630 (16:10) left; 40 px to its right a column of 4 cards (400 × 142.5, 20 apart)
    const MW = 1008, MH = 630, MX = -220, MY = 0, MR = 22;
    const CW = 400, CH = 142.5, CX = 524, GAP = 20, CR = 24, PAD = 12;
    const CY = [0, 1, 2, 3].map((i) => -MH / 2 + CH / 2 + i * (CH + GAP));
    const TH = CH - 2 * PAD, TW = TH * MW / MH, ST = TW / MW, TX = -CW / 2 + PAD + TW / 2, TR = 10 / ST;   // thumb: the main screen scaled by ST
    const LX = -CW / 2 + PAD + TW + 24;                                                                  // label column (card-local, left edge)
    const STEPS = ['Connect', 'Design', 'Review', 'Publish'];
    // beats: the ring moves at TM[j]; the new screen sets off LAG later (DUR), the old one BACK after that (BDUR)
    const TM = [1.4, 2.6, 3.8], LAG = 0.12, DUR = 0.85, BACK = 0.14, BDUR = 0.8;
    const thumbPose = (i) => ({ x: r3(CX + TX), y: r3(CY[i]), s: r3(ST), r: r3(TR) });
    const mainPose = { x: MX, y: MY, s: 1, r: MR };
    // a screen copy's move between two poses (all on one progress, like the reference's rect lerp)
    const go = (t0, P, d = DUR) => ({ x: [[t0, t0 + d, P.x, E.travel]], y: [[t0, t0 + d, P.y, E.travel]], scale: [[t0, t0 + d, P.s, E.travel]], r: [[t0, t0 + d, P.r, E.travel]] });

    // the main-view copies: copy i sits on thumb i (hidden) until it is called, grows into the main view,
    // and when the next step is called shrinks back onto thumb i, where it hides — thumb and copy share src.
    // The old screen leaves BACK s after the new one sets off: the new one leads (bigger, on top) and the
    // old one slips out from under it, so the two never travel as a same-size stack (adjacent cards would
    // otherwise put their paths only half a card apart).
    const copy = (i) => {
      const inAt = i ? TM[i - 1] + LAG : null, outAt = TM[i] != null ? TM[i] + LAG : null;
      const P0 = i ? thumbPose(i) : mainPose;
      const kk = i ? merge({ opacity: [0, [inAt, 1]] }, go(inAt, mainPose))
                   : merge(enterE(0.1, { dur: 0.42, dy: 28, y0: MY, s: 0.96 }));
      const back = outAt != null ? merge(go(outAt + BACK, thumbPose(i), BDUR), { opacity: [[outAt + BACK + BDUR, 0]] }) : null;
      return photo({ id: 'screen' + (i + 1), src: 'step' + (i + 1), v: 'desktop', x: P0.x, y: P0.y, scale: P0.s, w: MW, h: MH, r: P0.r, shadow: 2,
        k: merge(kk, back) });
    };
    // label colour per beat: ink when its step is active, muted otherwise
    const labelK = (i) => {
      const c = [i === 0 ? 'ink' : 'muted'];
      TM.forEach((t, j) => { if (j === i) c.push([t + 0.04, t + 0.34, 'muted', E.fade]); if (j + 1 === i) c.push([t + 0.04, t + 0.34, 'ink', E.fade]); });
      return { color: c };
    };
    const card = (s, i) => {
      const t = 0.22 + i * 0.07;
      return rect({ id: 'card' + (i + 1), x: CX, y: r3(CY[i]), w: CW, h: CH, r: CR, fill: 'card', shadow: 1,
        k: enterE(t, { dur: 0.36, dx: 28, x0: CX, s: 0.97 }), ch: [
          photo({ id: 'thumb' + (i + 1), src: 'step' + (i + 1), v: 'desktop', x: r3(TX), w: MW, h: MH, scale: r3(ST), r: r3(TR), shadow: 2 }),
          text({ id: 'num' + (i + 1), text: 'Step ' + (i + 1), x: r3(LX), y: -20, ax: 0, size: 22, weight: 500, color: 'muted' }),
          text({ id: 'step' + (i + 1), text: s, x: r3(LX), y: 15, ax: 0, size: 30, weight: 600, ls: -0.01, k: labelK(i) }),
        ] });
    };
    // the focus ring: pops round card 1, then steps down with a liquid stretch (leading edge first)
    const RH = CH + 14, ringY = [CY[0]], ringH = [RH];
    TM.forEach((t, j) => {
      ringY.push([t, t + 0.5, r3(CY[j + 1]), E.move]);
      ringH.push([t, t + 0.18, RH + 64, E.move], [t + 0.18, t + 0.6, RH, E.enter]);
    });
    return [
      ...STEPS.map(card),
      // the group carries the travel, the ring the stretch — one animated value each, so both convert exactly
      group({ id: 'focus', x: CX, y: r3(CY[0]), k: { y: ringY }, ch: [
        rect({ id: 'focusRing', w: CW + 14, h: RH, r: CR + 7, stroke: 'acc', sw: 3,
          k: { h: ringH, opacity: [0, [0.78, 0.98, 1, E.fade]], scale: [1.06, [0.78, 1.18, 1, E.enter]] } }),
      ] }),
      ...STEPS.map((_, i) => copy(i)),
    ];
  },
});
})();

/* GL Motion — Product showcase: Zoom through (reference: reelfolio "scale01", the nested-card tunnel). */
(function () {
const { group, photo } = UIK.h;

// easing roles — the only easing names in this file
const E = { enter: 'Spring Out', move: 'Spring Out', travel: 'Spring Smooth', exit: 'Power2 In', pop: 'Spring Pop', fade: 'Spring Out', drift: 'Linear' };   // the spring feel (references/easing.md)

// fade + un-blur + settle (the kit's enter(), on the E table); dy/dx travel in to y0/x0
const enterE = (t, o = {}) => {
  const a = t + (o.d ?? 0), b = a + (o.dur ?? 0.3), out = o.fade === false ? {} : { opacity: [0, [a, b, 1, E.fade]] };
  if ((o.blur ?? 10) > 0) out.blur = [o.blur ?? 10, [a, b, 0, E.fade]];
  if ((o.s ?? 0.94) !== 1) out.scale = [o.s ?? 0.94, [a, b + 0.08, 1, E.enter]];
  if (o.dy) out.y = [(o.y0 ?? 0) + o.dy, [a, b + 0.08, o.y0 ?? 0, E.enter]];
  return out;
};
// f(t) over [t0, t1] as the fewest drift (Linear) segments whose RELATIVE error stays within tol — a scale
// that runs 1 → 24 needs the same precision on screen at every size, so the error is measured as a ratio
const fitRel = (f, t0, t1, tol, dt = 1 / 120) => {
  const n = Math.max(2, Math.round((t1 - t0) / dt)), P = [];
  for (let j = 0; j <= n; j++) { const t = t0 + (t1 - t0) * j / n; P.push([t, f(t)]); }
  const out = [];
  for (let a = 0, b; a < n; a = b) {
    b = a + 1;
    for (let c = b + 1; c <= n; c++) {
      const [ta, va] = P[a], [tc, vc] = P[c];
      let ok = true;
      for (let m = a + 1; m < c && ok; m++) ok = Math.abs((va + (vc - va) * (P[m][0] - ta) / (tc - ta)) / P[m][1] - 1) <= tol;
      if (!ok) break;
      b = c;
    }
    out.push([+P[a][0].toFixed(3), +P[b][0].toFixed(3), +P[b][1].toFixed(4), E.drift]);
  }
  return out;
};

// 1 ─ Zoom through: a desktop screen holds a smaller screen, which holds a smaller one still. The whole
// nest zooms (ONE scale track on one group) into the middle screen until it fills the frame, breathes,
// then on into the innermost one, which lands exactly full-frame as its corners square off.
//
// Reference decode (scale01, 4 s): a new card is born every 0.5 s at the centre and grows 0 → frame in
// 2.5 s on cubic-bezier(.86,.14,.14,.86); neighbouring cards differ ×4 in size mid-frame, one level passes
// in 0.5 s (log-rate ≈ 2.7/s, ×15 per second), and each card BRAKES hard as it reaches the frame (its
// log-rate falls from ≈ 4.8/s at half size to ≈ 0.3/s at 0.9) while the next one is already coming.
// Here: about the same nesting (×3.5, ×4) and the same "brake at the frame, then go on" — but as a rigid
// camera move (a pure scale about one fixed point, so screens never slide against each other), log-space
// motion at a constant cruise rate (the zoom reads as constant speed at every size), slower (≈ 1.7/s,
// ×5 per second) so the screens can be read, two levels, ending on the last screen full-frame.
UIK.define({
  id: 'zoom-through', name: 'Zoom through', cat: 'showcase', T: 4.0, cam: 1,
  desc: 'A desktop screen floats in with a smaller screen inside it; the view dives into that screen at a steady zoom until it fills the frame, eases for a breath as a third screen appears inside it, then dives on and lands with the last screen exactly full-frame, its corners squaring off.',
  build: () => {
    // Nest in world px at zoom 1: A 1344×756 (16:9, so the last screen can fill a 16:9 frame exactly),
    // B = A/3.5, C = B/4 (≈ the reference's ×4 nesting). Zoom 1 → ZD (B full-frame + 4 % overscan so its
    // round corners sit outside the frame during the breath) → ZE = 20 (C = 1920 × 1080). B and C have
    // whole-pixel half-sizes: the browser snaps a box's layout offset to whole local pixels, which a ×20
    // zoom would turn into a visible gap at the frame edge (a 45-px-tall C landed 12 px low).
    const AW = 1344, AH = 756, BW = 384, BH = 216, CW = 96, CH = 54, ZD = (1920 / BW) * 1.04, ZE = 1920 / CW;
    // One fixed point Q for the whole move: a point p is centred at zoom z when p = Q(z − 1)/z, so placing
    // B at Q(ZD − 1)/ZD and C at Q(ZE − 1)/ZE centres each one exactly when it fills the frame, and the
    // group only needs a scale track (its origin sits on Q; nothing else moves).
    const Q = [300, 132];
    const at = (z) => Q.map((q) => +(q * (z - 1) / z).toFixed(3));
    const B = at(ZD), C = at(ZE);
    // Log-zoom speed profile (per second of ln z): ramp up, cruise, dip to 35 % at B (the reference's
    // brake at the frame), cruise, land. Cosine ramps, so position eases smoothly into each phase.
    const T0 = 1.0, UP = 0.4, DIP = 0.3, DOWN = 0.62, M = 0.35, TEND = 3.5;
    const D1 = Math.log(ZD), D2 = Math.log(ZE / ZD);
    const s1 = UP / 2 + DIP * (1 + M) / 2, s2 = DIP * (1 + M) / 2 + DOWN / 2;   // area of the ramps at speed 1
    const cruise = TEND - T0 - UP - 2 * DIP - DOWN;                              // c1 + c2
    const V = (D1 + D2) / (s1 + s2 + cruise), c1 = D1 / V - s1, c2 = cruise - c1;
    const TD = T0 + UP + c1 + DIP;                                               // the breath: B fills the frame
    const cosr = (u) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, u)))) / 2;
    const speed = (t) => {
      if (t <= T0 || t >= TEND) return 0;
      if (t < T0 + UP) return V * cosr((t - T0) / UP);
      if (t < TD - DIP) return V;
      if (t < TD) return V * (1 - (1 - M) * cosr((t - (TD - DIP)) / DIP));
      if (t < TD + DIP) return V * (M + (1 - M) * cosr((t - TD) / DIP));
      if (t < TEND - DOWN) return V;
      return V * (1 - cosr((t - (TEND - DOWN)) / DOWN));
    };
    // ln z(t) by integration (fine steps), normalised so it lands exactly on ln ZE
    const STEP = 1 / 960, LN = [0];
    for (let t = T0; t < TEND - 1e-9; t += STEP) LN.push(LN[LN.length - 1] + (speed(t) + speed(t + STEP)) * STEP / 2);
    const norm = Math.log(ZE) / LN[LN.length - 1];
    const lnZ = (t) => { const x = (t - T0) / STEP; if (x <= 0) return 0; if (x >= LN.length - 1) return Math.log(ZE); const i = Math.floor(x), f = x - i; return (LN[i] + (LN[i + 1] - LN[i]) * f) * norm; };
    const zoom = (t) => Math.exp(lnZ(t));
    const tAt = (z) => { let a = T0, b = TEND; for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if (zoom(m) < z) a = m; else b = m; } return +((a + b) / 2).toFixed(3); };
    const scale = [1, ...fitRel(zoom, T0, TEND, 0.0025)];
    scale[scale.length - 1][2] = ZE;                                              // exact: C = 1920 × 1080

    // when B covers the whole frame (round corners included), A is hidden — nothing of it can show
    const rB = 6;
    const covers = (z, cx, cy, w, h, r) => {                                      // screen rect of a nested box at zoom z
      const sx = Q[0] + z * (cx - Q[0]), sy = Q[1] + z * (cy - Q[1]), hw = w * z / 2, hh = h * z / 2, rr = r * z;
      return [[-960, -540], [960, -540], [-960, 540], [960, 540]].every(([px, py]) => {
        const dx = Math.abs(px - sx) - (hw - rr), dy = Math.abs(py - sy) - (hh - rr);
        return Math.abs(px - sx) <= hw && Math.abs(py - sy) <= hh && (dx <= 0 || dy <= 0 || dx * dx + dy * dy <= rr * rr);
      });
    };
    let tHideA = TEND; for (let t = T0; t < TEND; t += 0.005) if (covers(zoom(t), B[0], B[1], BW, BH, rB)) { tHideA = +t.toFixed(3); break; }
    const tRevealC = tAt(2.0);                                                   // C appears once B is ~770 px wide

    return [
      // the intro settle (rise + scale about the first screen's centre) on the outer group; its fade is on
      // screenA alone, so the inner screens' own fades convert exactly instead of being multiplied through
      group({ id: 'screens', k: enterE(0.1, { dur: 0.42, dy: 36, y0: 0, s: 0.95, blur: 0, fade: false }), ch: [
        group({ id: 'nest', x: Q[0], y: Q[1], k: { scale }, ch: [
          photo({ id: 'screenA', v: 'desktop', x: -Q[0], y: -Q[1], w: AW, h: AH, r: 20, shadow: 2, offscreen: true,
            k: { opacity: [0, [0.1, 0.52, 1, E.fade], [tHideA, 0]], blur: [10, [0.1, 0.52, 0, E.fade]] } }),
          photo({ id: 'screenB', v: 'desktop', x: +(B[0] - Q[0]).toFixed(3), y: +(B[1] - Q[1]).toFixed(3), w: BW, h: BH, r: rB, shadow: 2, offscreen: true,
            k: { ...enterE(0.36, { dur: 0.34, dy: 14, y0: +(B[1] - Q[1]).toFixed(3), s: 0.9, blur: 6 }), opacity: [0, [0.36, 0.7, 1, E.fade], [TEND, 0]] } }),
          photo({ id: 'screenC', v: 'desktop', x: +(C[0] - Q[0]).toFixed(3), y: +(C[1] - Q[1]).toFixed(3), w: CW, h: CH, r: 1.5, shadow: 3,
            k: { ...enterE(tRevealC, { dur: 0.34, s: 0.9, blur: 1.5 }), r: [[TEND - 0.5, TEND, 0, E.fade]] } }),
        ] }),
      ] }),
    ];
  },
});
})();

/* Device fold — one screen reshapes phone → tablet → desktop ("works on every device").
 * Reference: reelfolio flip / Fold — one rounded card whose width is a crop window (the corners stay
 * round), a quick in-out change with the card sinking a little at the moment the picture swaps. */
(function () {
const { rect, text, icon, group, photo, k } = UIK.h;
const E = { enter: 'Spring Out', move: 'Spring Out', travel: 'Spring Smooth', exit: 'Power2 In', pop: 'Spring Pop', fade: 'Spring Out', drift: 'Linear' };   // the spring feel (references/easing.md)

// the kit's intro / swap helpers, written against E (so a new easing table reaches every key)
const popIn = (t, from = 0.6) => ({ scale: [from, [t, t + 0.52, 1, E.pop]] });
const fadeUp = (t) => ({ opacity: [0, [t, t + 0.12, 1, E.fade]] });
const inn = (t, o = {}) => {
  const a = t + (o.d ?? 0.07), b = a + (o.dur ?? 0.3), out = { opacity: [0, [a, b, 1, E.fade]] };
  if ((o.blur ?? 10) > 0) out.blur = [o.blur ?? 10, [a, b, 0, E.fade]];
  if (o.dy) out.y = [(o.y0 ?? 0) + o.dy, [a, b + 0.08, o.y0 ?? 0, E.enter]];
  return out;
};
const out = (t, o = {}) => ({ opacity: [[t, t + (o.dur ?? 0.14), 0, E.exit]], blur: [[t, t + (o.dur ?? 0.14), o.blur ?? 8, E.exit]] });

// Lucide device glyphs (24 grid)
const GLYPH = {
  phone: ['M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z', 'M12 18h.01'],
  tablet: ['M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z', 'M12 18h.01'],
  desktop: ['M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M8 21h8', 'M12 17v4'],
};

UIK.define({
  id: 'device-fold', name: 'Device fold', cat: 'showcase', T: 4.9, cam: 1.12,
  desc: 'One screen reshapes from a phone to a tablet to a desktop window, stretching as it goes, while its screenshot swaps inside and the device row below follows.',
  build: () => {
    const M = [1.4, 2.9];                                  // the two morphs
    const FY = -34, LY = 392;                               // screen centre, device row
    const D = [                                             // phone · tablet · desktop
      { id: 'phone', label: 'Phone', v: 'phone', w: 330, h: 714, r: 50, ow: 22, oh: 18, lw: 118 },
      { id: 'tablet', label: 'Tablet', v: 'desktop', w: 520, h: 694, r: 34, ow: 22, oh: 18, lw: 132 },
      { id: 'desktop', label: 'Desktop', v: 'desktop', w: 1040, h: 650, r: 24, ow: 40, oh: 24, lw: 150 },
    ];
    // the shape: w leads and stretches past its size, h trails and dips under it, both relax
    const seg = (i, key) => {                              // morph i (into device i + 1) on one prop
      const t = M[i], s = D[i + 1];
      if (key === 'w') return [[t, t + 0.42, s.w + s.ow, E.move], [t + 0.42, t + 0.9, s.w, E.travel]];
      if (key === 'h') return [[t + 0.05, t + 0.47, s.h - s.oh, E.move], [t + 0.47, t + 0.9, s.h, E.travel]];
      return [[t, t + 0.5, s.r, E.enter]];
    };
    const track = (key, from, idx) => [D[from][key], ...idx.flatMap((i) => seg(i, key))];
    const morph = { w: track('w', 0, [0, 1]), h: track('h', 0, [0, 1]), r: track('r', 0, [0, 1]) };
    // the fold's sink: the card dips a little while the picture swaps
    const sink = { scale: M.flatMap((t) => [[t, t + 0.24, 0.965, E.travel], [t + 0.24, t + 0.78, 1, E.travel]]) };

    // one screenshot slot per device. Each picture is built at the largest box it shows in (its width
    // plus the stretch), so the w / h tracks only ever crop it: an incoming screen rides the shape from
    // the start; an outgoing one keeps its width and only follows the shape's height while it leaves.
    const SW = { out: -0.08, odur: 0.14, in: 0.05, dur: 0.3 };    // swap: the old screen blurs out as the shape starts, the new one blurs in riding it
    const box = [
      { h: track('h', 0, [0]) },                                                    // phone: leaves at M0
      { w: track('w', 0, [0]), h: morph.h, r: track('r', 0, [0]) },                  // tablet: rides M0, leaves at M1
      morph,                                                                         // desktop: rides both
    ];
    const screens = D.map((s, i) => photo({ id: s.id + 'Screen', v: s.v, w: s.w + (i ? s.ow : 0), h: s.h, r: s.r,
      k: k(box[i], i === 0 ? inn(0.2, { blur: 6 }) : inn(M[i - 1] + SW.in, { d: 0, dur: SW.dur, blur: 8 }), i < 2 ? out(M[i] + SW.out, { dur: SW.odur }) : null) }));

    // device row: icon + word per device, the active one in ink, an underline gliding under it
    const GAP = 64, total = D.reduce((a, s) => a + s.lw, 0) + GAP * 2;
    let left = -total / 2;
    const X = D.map((s) => { const c = left + s.lw / 2; left += s.lw + GAP; return c; });
    const tone = (i) => {
      const tr = [i === 0 ? 'ink' : 'muted'];
      M.forEach((t, j) => { if (j + 1 === i) tr.push([t + 0.05, t + 0.35, 'ink', E.fade]); if (j === i) tr.push([t, t + 0.3, 'muted', E.fade]); });
      return tr;
    };
    const row = D.map((s, i) => group({ id: s.id + 'Item', x: X[i], y: LY, k: inn(0.34 + i * 0.07, { dy: 14, y0: LY, blur: 0 }), ch: [
      icon({ id: s.id + 'Icon', paths: GLYPH[s.id], x: -s.lw / 2 + 15, size: 30, sw: 2.4, color: i === 0 ? 'ink' : 'muted', k: { color: tone(i) } }),
      text({ id: s.id + 'Label', text: s.label, x: -s.lw / 2 + 40, ax: 0, size: 28, weight: 500, color: i === 0 ? 'ink' : 'muted', k: { color: tone(i) } }),
    ] }));
    const UL = { x: [X[0]], w: [0, [0.62, 1.0, D[0].lw, E.enter]] };
    M.forEach((t, i) => {
      UL.x.push([t, t + 0.5, X[i + 1], E.move]);
      UL.w.push([t, t + 0.16, D[i + 1].lw + 80, E.fade], [t + 0.16, t + 0.6, D[i + 1].lw, E.enter]);
    });

    return [
      group({ id: 'device', y: FY, k: k(popIn(0.1, 0.7), sink), ch: [   // scale only: the fades stay on the layers
        rect({ id: 'frame', w: D[0].w, h: D[0].h, r: D[0].r, fill: 'card', shadow: 2, k: k(morph, fadeUp(0.1)) }),
        ...screens,
        // a hairline rim over the screens keeps the edge crisp on any screenshot and in the dark theme
        rect({ id: 'rim', w: D[0].w, h: D[0].h, r: D[0].r, stroke: 'ink/10', sw: 2, k: k(morph, fadeUp(0.1)) }),
      ] }),
      ...row,
      rect({ id: 'underline', x: X[0], y: LY + 34, w: 0, h: 4, r: 2, fill: 'acc', k: UL }),     // the one accent: the active device
    ];
  },
});
})();

/* Isometric screens — an exploded "how it's built" stack of app screens.
 * Reference: reelfolio isometric / Iso Cascade — cards seen through a parallel (no-perspective)
 * isometric camera, stacked along their normal at an even step, each a slightly different depth tone.
 * Isometric = a rotated plane inside a vertically squashed group (a shear). */
(function () {
const { rect, text, path, group, photo } = UIK.h;
const E = { enter: 'Spring Out', move: 'Spring Out', travel: 'Spring Smooth', exit: 'Power2 In', pop: 'Spring Pop', fade: 'Spring Out', drift: 'Linear' };   // the spring feel (references/easing.md)

const ROT = -45, SQ = 0.577;                  // isometric: turn the plane 45°, squash it to cos 54.7°
const D2R = Math.PI / 180;
// where a plate-space point lands on screen (turn, then squash)
const iso = (x, y) => { const c = Math.cos(ROT * D2R), s = Math.sin(ROT * D2R); return [x * c - y * s, (x * s + y * c) * SQ]; };

UIK.define({
  id: 'iso-screens', name: 'Isometric screens', cat: 'showcase', T: 4.8,
  cam: { zoom: 1.2, x: 0, y: 0, k: { zoom: [[1.4, 2.3, 1.0, E.move], [2.3, 4.3, 1.03, E.drift]], x: [[1.4, 2.3, 160, E.move]] } },
  desc: 'An app screen lands in an isometric view and three layers slide out from beneath it; the stack then opens into evenly spaced layers as the view pulls back, each layer gets a label, and the view drifts in on the hold.',
  build: () => {
    const PW = 680, PH = 425, R = 22, N = 4;
    const G = 24, S = 138, X = 1.4;           // compact gap, exploded step (screen px), explode start
    const labels = ['Data', 'Integrations', 'Workflows', 'Interface'];   // bottom → top
    const [vx, vy] = iso(PW / 2, PH / 2);    // the plate's right-hand vertex (the screen's bottom-right corner)
    const out = [];
    for (let i = 0; i < N; i++) {
      const yc = -(i - (N - 1) / 2) * G, ye = -(i - (N - 1) / 2) * S;
      const a = i === N - 1 ? 0.1 : 0.34 + (N - 2 - i) * 0.12, go = X + (N - 1 - i) * 0.05;   // top first; open top-first
      const top = i === N - 1;
      out.push(group({ id: 'layer' + i, y: yc,
        // the interface lands first; each layer under it then slides out from beneath the one above,
        // so a fading layer is always tucked under an opaque one
        k: top ? { y: [yc - 56, [a, a + 0.6, yc, E.enter], [go, go + 0.9, ye, E.move]], opacity: [0, [a, a + 0.24, 1, E.fade]] }
          : { y: [yc - G, [a, a + 0.5, yc, E.enter], [go, go + 0.9, ye, E.move]], opacity: [0, [a, a + 0.16, 1, E.fade]] }, ch: [
        group({ id: 'layer' + i + 'Squash', sy: SQ, ch: [
          group({ id: 'layer' + i + 'Turn', rot: ROT, ch: [
            photo({ id: 'screen' + i, v: 'desktop', w: PW, h: PH, r: R, shadow: 2, stroke: 'ink/12', sw: 2, ch: top ? [] : [
              // depth: a lower layer sits in the shade of the ones above; the shade lifts as they part
              rect({ id: 'screen' + i + 'Depth', w: PW + 4, h: PH + 4, fill: 'shade', opacity: 0.16,
                k: { opacity: [0.16, [go, go + 0.9, 0.03 * (N - 1 - i), E.move]] } }),
            ] }),
          ] }),
        ] }),
      ] }));
    }
    // a label per layer at its opened position, level with the plate's right vertex: a hairline draws on, the name follows
    for (let i = N - 1; i >= 0; i--) {
      const ye = -(i - (N - 1) / 2) * S, t = X + 0.4 + (N - 1 - i) * 0.09, y = ye + vy;
      out.push(path({ id: 'lead' + i, d: `M${(vx + 22).toFixed(1)} ${y.toFixed(1)} H${(vx + 96).toFixed(1)}`, stroke: 'ink/30', sw: 2, trimmed: true,
        k: { trimE: [0, [t, t + 0.4, 100, E.enter]] } }));
      out.push(text({ id: 'label' + i, text: labels[i], x: vx + 116, y, ax: 0, size: 32, weight: 500,
        k: { opacity: [0, [t + 0.12, t + 0.42, 1, E.fade]], x: [vx + 98, [t + 0.12, t + 0.5, vx + 116, E.enter]] } }));
    }
    return out;
  },
});
})();

/* Product showcase — Phone columns: an app-store hero of phone screens drifting in alternating columns. */
(function () {
const { group, photo } = UIK.h;
const E = { enter: 'Spring Out', move: 'Spring Out', travel: 'Spring Smooth', exit: 'Power2 In', pop: 'Spring Pop', fade: 'Spring Out', drift: 'Linear' };   // the spring feel (references/easing.md)

// Seamless loop (the "Seamless loop" recipe, after grid → columndrift): every column travels exactly one
// period (PICS phone pitches) over T, so the last frame is the first. The period is ≥ the frame height,
// so a column never shows the same screen twice at once, and each column holds only the phones whose
// path over the loop crosses the frame — a picture's copies share its id and src (one media slot).
UIK.define({
  id: 'phone-columns', name: 'Phone columns', cat: 'showcase', T: 8,
  desc: 'Four columns of phone screens drift past in alternating directions — up, down, up, down — at one calm linear speed, bleeding off the top and bottom of the frame; each column moves exactly two screens per loop, so it repeats seamlessly.',
  build: () => {
    const T = 8;
    const PW = 314, PH = 680, R = 44;        // ≈ 9 : 19.5 phone screen
    // paired with screen-wall: the same gap, drift and shadow, and each strip turns over exactly once per
    // loop — ≈ 0.165 of the frame per second along its axis, every screen on view for ≈ 9.5 s
    const GAP = 40, PITCH = PH + GAP;        // 720
    const PICS = 2, P = PICS * PITCH;        // 1440 px per loop ≥ frame height → 180 px/s, one screen every 4 s
    const FH = 540 + 4;                      // frame half-height (+ a hair so no card pops at an edge)
    const CX = PW + GAP;
    // phases (in pitches) stay within 0.28–0.72, where four phones per column cover the frame for the
    // whole loop; same-direction columns sit 0.4 of a phone apart (never side by side), and the first
    // frame is mirror-symmetric: the centre pair level, the outer pair level, 288 px out of step
    const COLS = [
      { dir: -1, ph: 0.3 },
      { dir: 1, ph: 0.7 },
      { dir: -1, ph: 0.7 },
      { dir: 1, ph: 0.3 },
    ];
    return COLS.map((C, c) => {
      const phones = [];
      for (let j = -6; j <= 6; j++) {
        const y = (j + C.ph) * PITCH;
        const lo = y - PH / 2 + Math.min(0, C.dir * P), hi = y + PH / 2 + Math.max(0, C.dir * P);
        if (hi <= -FH || lo >= FH) continue;                           // never on screen during the loop
        const n = c * PICS + (((j % PICS) + PICS) % PICS) + 1;         // picture 1…8
        phones.push(photo({ id: 'phone' + n, src: 'phone' + n, v: 'phone', y, w: PW, h: PH, r: R, shadow: 2, offscreen: true }));
      }
      return group({ id: 'column' + (c + 1), x: (c - (COLS.length - 1) / 2) * CX, offscreen: true,
        k: { y: [0, [0, T, C.dir * P, E.drift]] }, ch: phones });
    });
  },
});
})();

/* Product showcase — Tilted screen wall: rows of desktop app windows slide past on a wall turned −15°. */
(function () {
const { group, photo } = UIK.h;
const E = { enter: 'Spring Out', move: 'Spring Out', travel: 'Spring Smooth', exit: 'Power2 In', pop: 'Spring Pop', fade: 'Spring Out', drift: 'Linear' };   // the spring feel (references/easing.md)

// Seamless loop (the "Seamless loop" recipe, after marquee10 / marquee14): the wall is one group turned
// TILT degrees; every row travels exactly one period (PICS screen pitches) along its own axis over T, so
// the last frame is the first. The period is ≥ the longest stretch of a row the frame shows, so a row
// never shows the same screen twice at once; each row holds only the screens whose path over the loop
// crosses the frame. A picture's copies share its id and src (one media slot).
UIK.define({
  id: 'screen-wall', name: 'Tilted screen wall', cat: 'showcase', T: 8,
  desc: 'A wall of desktop app windows turned −15° fills the frame; its three rows slide along the tilt in alternating directions at one steady linear speed, each moving exactly three windows per loop, so it repeats seamlessly.',
  build: () => {
    const T = 8, TILT = -15;
    const SW = 800, SH = 500, R = 24;        // 16 : 10 app window
    const GAP = 40, PITCH = SW + GAP;        // along a row
    const ROW = SH + GAP;                    // across rows: 3 rows (0, ±540) cover the turned frame
    // paired with phone-columns: the same gap, drift and shadow, and each strip turns over exactly once per
    // loop — ≈ 0.165 of the frame per second along its axis, every screen on view for ≈ 9.5 s
    const PICS = 3, P = PICS * PITCH;        // 2520 px per loop ≥ the longest visible row (≈ 2 120) → 315 px/s
    // the frame (1920 × 1080, + a hair) in the wall's own axes → the x-range a band of rows [y0, y1] shows
    const th = -TILT * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th), HW = 964, HH = 544;
    const FRAME = [[-HW, -HH], [HW, -HH], [HW, HH], [-HW, HH]].map(([x, y]) => [x * cs - y * sn, x * sn + y * cs]);
    const cut = (poly, f) => poly.flatMap((a, i) => {
      const b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b), out = fa >= 0 ? [a] : [];
      if ((fa >= 0) !== (fb >= 0)) { const u = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); }
      return out;
    });
    const span = (y0, y1) => {
      const p = cut(cut(FRAME, (q) => q[1] - y0), (q) => y1 - q[1]);
      return p.length ? [Math.min(...p.map((q) => q[0])), Math.max(...p.map((q) => q[0]))] : null;
    };
    // rows top → bottom (a lower row paints over the shadow of the one above); centre row runs up-right,
    // the outer rows down-left; the outer rows start a third / a sixth of a window out of step (brick bond)
    const ROWS = [
      { y: -ROW, dir: -1, ph: 0.3 },
      { y: 0, dir: 1, ph: 0 },
      { y: ROW, dir: -1, ph: 0.15 },
    ];
    return [
      group({ id: 'wall', rot: TILT, offscreen: true, ch: ROWS.map((W, r) => {
        const [x0, x1] = span(W.y - SH / 2, W.y + SH / 2);
        const screens = [];
        for (let i = -8; i <= 8; i++) {
          const x = (i + W.ph) * PITCH;
          const lo = x - SW / 2 + Math.min(0, W.dir * P), hi = x + SW / 2 + Math.max(0, W.dir * P);
          if (hi <= x0 || lo >= x1) continue;                          // never on screen during the loop
          const n = r * PICS + (((i % PICS) + PICS) % PICS) + 1;        // picture 1…9
          screens.push(photo({ id: 'screen' + n, src: 'screen' + n, v: 'desktop', x, w: SW, h: SH, r: R, shadow: 2, offscreen: true }));
        }
        return group({ id: 'row' + (r + 1), y: W.y, offscreen: true, k: { x: [0, [0, T, W.dir * P, E.drift]] }, ch: screens });
      }) }),
    ];
  },
});
})();
