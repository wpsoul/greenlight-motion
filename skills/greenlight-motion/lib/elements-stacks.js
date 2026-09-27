/* UI Motion Kit — stacks elements. */
(function () {
const { rect, circle, ellipse, text, path, icon, group, photo, k, enter, exit, pop, press, cursorLayer, stagger } = UIK.h;

// ── local helpers (plain functions that return ordinary layers / tracks) ──
// the main shape's pop-in from empty
const popIn = (t = 0.1, from = 0.7) => ({ scale: [from, [t, t + 0.52, 1, 'Back Out']], opacity: [0, [t, t + 0.12, 1, 'Linear']] });
// a fade-only entry (backgrounds, tracks, pictures that should not scale or blur in)
const fadeIn = (t, dur = 0.3) => enter(t, { blur: 0, s: 1, dur });
const r2 = (n) => +n.toFixed(2);

// the value of a track [init, [t0, t1, v, e] | [t, v] …] at time t (to derive one layer's keys from another's motion)
const trackAt = (tr, t) => {
  let v = Array.isArray(tr[0]) ? 0 : tr[0];
  for (const s of tr) {
    if (!Array.isArray(s)) continue;
    const [t0, t1, to, e] = s.length === 2 ? [s[0], s[0], s[1], 'Hold'] : s;
    if (t < t0) break;
    if (t >= t1) { v = to; continue; }
    return v + (to - v) * UIK.ease(e || 'Power3 Out')((t - t0) / (t1 - t0));
  }
  return v;
};
// fn(t) over [t0, t1] as the fewest Linear segments that stay within `tol` of it — for a value that depends on
// another layer's eased motion (a wheel item's look, a cube face's width). Segments that change nothing are dropped.
const fitted = (t0, t1, fn, tol, dt = 0.02) => {
  const n = Math.max(2, Math.round((t1 - t0) / dt)), P = [];
  for (let j = 0; j <= n; j++) { const t = t0 + (t1 - t0) * j / n; P.push([t, fn(t)]); }
  const out = [];
  for (let a = 0, b; a < n; a = b) {
    b = a + 1;
    for (let c = b + 1; c <= n; c++) {
      const [ta, va] = P[a], [tc, vc] = P[c];
      let ok = true;
      for (let m = a + 1; m < c && ok; m++) ok = Math.abs(va + (vc - va) * (P[m][0] - ta) / (tc - ta) - P[m][1]) <= tol;
      if (!ok) break;
      b = c;
    }
    if (Math.abs(P[b][1] - P[a][1]) > 1e-4) out.push([r2(P[a][0]), r2(P[b][0]), +P[b][1].toFixed(3), 'Linear']);
  }
  return out;
};

// ── the phone (no device branding): an ink bezel round a clipped screen.
//    Screen coordinates: centre 0,0 — top edge −500, bottom +500, sides ±250. ──
const PW = 500, PH = 1000, PR = 64, BZ = 14, PHONE_CAM = 0.86;
const phone = (o) => group({ id: 'phone', k: o.k || popIn(0.1, 0.72), ch: [
  rect({ id: 'bezel', w: PW + 2 * BZ, h: PH + 2 * BZ, r: PR + BZ, fill: 'ink', shadow: 1 }),
  rect({ id: 'glass', w: PW + 4, h: PH + 4, r: PR + 2, fill: 'dim' }),
  rect({ id: 'screen', w: PW, h: PH, r: PR, fill: o.fill || 'card', clip: true, ch: o.ch }),
] });

// 1 ─ Stack swipe: the top card is dragged and flung, the next rises; Like, then Pass
UIK.define({
  id: 'stack-swipe', name: 'Stack swipe', cat: 'gallery', T: 4.1, cam: { zoom: 1.0, y: 40 },
  desc: 'The cursor drags the top card of a stack to the right: it tilts round the grab point, a Like stamp fades in and the heart button swells, then it is flung off while the next card rises to the top. The second card is dragged and flung left with a Pass stamp.',
  build: () => {
    const W = 520, H = 680, CY = -50, LY = 40, LS = 0.05;
    const G = [1.05, 2.45], D = [[1.1, 1.6], [2.5, 3.0]], DIR = [1, -1], FL = 0.5;
    const GRAB = [[40, 110], [-40, 110]];          // grab point relative to the card centre
    const DX = 270, DY = 26, ROT = 12;
    const cards = [
      { v: 1, title: 'Alpine cabin', meta: 'Tessin · 3 nights', price: '$240' },
      { v: 8, title: 'Courtyard house', meta: 'Seville · 5 nights', price: '$185' },
      { v: 3, title: 'Harbour loft', meta: 'Lisbon · 4 nights', price: '$160' },
      { v: 5, title: 'Lake house', meta: 'Annecy · 2 nights', price: '$210' },
      { v: 7, title: 'Garden studio', meta: 'Kyoto · 6 nights', price: '$130' },
    ];
    // level of card i: 0 = top. It steps up one level when each card in front of it is flung.
    const levelK = (i) => {
      const y = [CY + LY * i], sc = [1 - LS * i], op = [i <= 2 ? 1 : 0];
      D.forEach(([, d1], j) => {
        if (j >= i) return;
        const lv = i - j - 1, a = d1 - 0.05, b = d1 + 0.45;
        y.push([a, b, CY + LY * lv, 'Power3 Out']); sc.push([a, b, 1 - LS * lv, 'Power3 Out']);
        if (lv === 2) op.push([a, a + 0.25, 1, 'Power2 Out']);
      });
      return { y, scale: sc, opacity: op };
    };
    const stamp = (id, label, x, rot, col, t0, t1) => rect({ id, x, y: -250, w: 172, h: 74, r: 18, fill: 'card', stroke: col, sw: 5, rot,
      k: { opacity: [0, [t0, t1, 1, 'Power2 Out']], scale: [1.25, [t0, t1, 1, 'Power3 Out']] },
      ch: [text({ text: label, y: 1, size: 36, weight: 700, ls: 0.1, color: col })] });
    const card = (c, i) => {
      const flung = i < 2, [d0, d1] = flung ? D[i] : [0, 0], dir = DIR[i] || 1, [gx, gy] = GRAB[i] || [0, 0];
      const face = { x: [0], y: [0], rot: [0] };
      if (flung) {
        face.x.push([d0, d1, DX * dir, 'Power2 Smooth'], [d1, d1 + FL, 880 * dir, 'Power2 Out']);
        face.y.push([d0, d1, DY, 'Power2 Smooth'], [d1, d1 + FL, 90, 'Power2 Out']);
        face.rot.push([d0, d1, ROT * dir, 'Power2 Smooth'], [d1, d1 + FL, 24 * dir, 'Power2 Out']);
        face.opacity = [[d1 + 0.04, d1 + 0.28, 0, 'Power2 Out']];
      }
      return group({ id: 'card' + i, k: levelK(i), ch: [
        rect({ id: 'face' + i, w: W, h: H, r: 44, fill: 'card', shadow: 1, origin: [gx / W, gy / H], offscreen: flung, k: flung ? face : null, ch: [
          photo({ id: 'photo' + i, y: -66, w: W - 40, h: 508, r: 30, v: c.v }),
          text({ text: c.title, x: -230, y: 244, ax: 0, size: 38, weight: 600, ls: -0.02 }),
          text({ text: c.meta, x: -230, y: 290, ax: 0, size: 26, color: 'muted' }),
          text({ text: c.price, x: 230, y: 244, ax: 1, size: 32, weight: 600 }),
          text({ text: 'night', x: 230, y: 290, ax: 1, size: 24, color: 'muted' }),
          ...(i === 0 ? [stamp('likeStamp', 'LIKE', -120, -14, 'acc', d0 + 0.12, d1 - 0.08)] : []),
          ...(i === 1 ? [stamp('passStamp', 'PASS', 120, 14, 'ink', d0 + 0.12, d1 - 0.08)] : []),
        ] }),
      ] });
    };
    const swell = (j) => ({ scale: [[D[j][0], D[j][1], 1.14, 'Power2 Smooth'], [D[j][1], D[j][1] + 0.4, 1, 'Power3 Out']] });
    const BY = 440;
    return [
      group({ id: 'stack', k: popIn(0.1, 0.7), ch: cards.map(card).reverse() }),
      circle({ id: 'passBtn', x: -86, y: BY, d: 104, fill: 'card', shadow: 3, k: k(enter(0.4, { dy: 16, y0: BY, blur: 0 }), swell(1)),
        ch: [icon({ icon: 'x', size: 42, sw: 3 })] }),
      circle({ id: 'likeBtn', x: 86, y: BY, d: 104, fill: 'card', shadow: 3, k: k(enter(0.46, { dy: 16, y0: BY, blur: 0 }), swell(0)), ch: [
        icon({ id: 'heartLine', icon: 'heart', size: 42, sw: 3 }),
        icon({ id: 'heartFill', icon: 'heart', size: 42, sw: 3, color: 'acc', filled: true, fill: 'acc',
          k: { opacity: [0, [D[0][0] + 0.2, D[0][1], 1, 'Power2 Out'], [D[0][1] + 0.3, D[0][1] + 0.6, 0, 'Power2 Out']] } }),
      ] }),
      cursorLayer([[0, 560, 470], [0.55, 560, 470], [G[0], GRAB[0][0], CY + GRAB[0][1]],
        [D[0][0], GRAB[0][0], CY + GRAB[0][1]], [D[0][1], GRAB[0][0] + DX, CY + GRAB[0][1] + DY, 'Power2 Smooth'], [D[0][1] + 0.22, GRAB[0][0] + DX + 40, CY + GRAB[0][1] + DY - 6, 'Power2 Out'],
        [G[1], GRAB[1][0], CY + GRAB[1][1]], [D[1][0], GRAB[1][0], CY + GRAB[1][1]],
        [D[1][1], GRAB[1][0] - DX, CY + GRAB[1][1] + DY, 'Power2 Smooth'], [D[1][1] + 0.22, GRAB[1][0] - DX - 40, CY + GRAB[1][1] + DY - 6, 'Power2 Out'],
        [3.75, -300, 380]], [], D, { inAt: 0.5 }),
    ];
  },
});

// 2 ─ Deck shuffle: the deck splits in two, the halves riffle back together bottom cards first, the top card is dealt
{
const D0 = 2.8, D1 = 3.3;
UIK.define({
  id: 'deck-shuffle', name: 'Deck shuffle', cat: 'gallery', T: 4.1,
  cam: { zoom: 1.3, y: 30, k: { x: [[D0, D1 + 0.2, 190, 'Power2 Smooth']] } },
  desc: 'Shuffle is clicked: the deck splits into two tilted halves, then the halves riffle back together — bottom cards first, alternating sides, each landing a little askew on the growing pile — the pile squares up and the cursor deals the top card out to the right as the view follows.',
  build: () => {
    const CW = 300, CH = 400, PY = -40, TH = 5, HX = 330;
    const C = 0.85, S = 0.95, R = 1.5, GAP = 0.09, Q = 2.5;
    // DOM order a0 b0 a1 b1 … : even = left half, odd = right half. Riffling drops them in DOM order, so each
    // landing card is painted above the previous one; the last one (b3) ends on top and is dealt.
    const V = [2, 5, 7, 1, 9, 3, 8, 0];
    const JX = [7, -8, 4, -6, 8, -4, 5, 0], JR = [-3, 2.5, -1.5, 3, -2, 1.5, -2.5, 0];
    const GY = 60;                                        // grab point below the top card's centre
    const card = (v, j) => {
      const side = j % 2 ? 1 : -1, h = j >> 1, tj = +(R + j * GAP).toFixed(2), top = j === V.length - 1;
      const kk = {
        x: [0, [S, S + 0.5, side * HX, 'Power4 Out'], [tj, tj + 0.36, JX[j], 'Power3 Out']],
        y: [PY - j * TH, [S, S + 0.5, PY - h * TH, 'Power4 Out'], [tj, tj + 0.36, PY - j * TH, 'Power3 Out']],
        rot: [0, [S, S + 0.5, side * 6, 'Power4 Out'], [tj, tj + 0.36, JR[j], 'Power3 Out']],
      };
      if (JX[j]) { kk.x.push([Q, Q + 0.3, 0, 'Power3 Out']); kk.rot.push([Q, Q + 0.3, 0, 'Power3 Out']); }
      if (top) {
        kk.x.push([D0, D1, 380, 'Power2 Smooth']);
        kk.y.push([D0, D1, PY - j * TH + 70, 'Power2 Smooth']);
        kk.rot.push([D0, D0 + 0.3, 5, 'Power2 Out'], [D1 - 0.05, D1 + 0.4, 0, 'Power3 Out']);
        kk.scale = [[D0 - 0.05, D0 + 0.2, 1.05, 'Power3 Out'], [D1, D1 + 0.35, 1, 'Power3 Out']];
      }
      return group({ id: 'card' + j, k: kk, ch: [
        ...(top ? [rect({ id: 'liftShadow', w: CW, h: CH, r: 24, fill: 'card', shadow: 2, k: { opacity: [0, [D0 - 0.05, D0 + 0.2, 1, 'Power2 Out'], [D1, D1 + 0.35, 0, 'Power2 Out']] } })] : []),
        rect({ id: 'face' + j, w: CW, h: CH, r: 24, fill: 'card', shadow: 3, ch: [photo({ id: 'photo' + j, w: CW - 28, h: CH - 28, r: 14, v })] }),
      ] });
    };
    const shuffle = ['M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22', 'm18 2 4 4-4 4', 'M2 6h1.9c1.5 0 2.9.9 3.6 2.2', 'M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8', 'm18 14 4 4-4 4'];
    const BY = 300;
    return [
      group({ id: 'deck', k: popIn(0.1, 0.7), ch: V.map(card) }),
      rect({ id: 'shuffleBtn', y: BY, w: 232, h: 84, r: 42, fill: 'ink', k: k(enter(0.36, { dy: 14, y0: BY, blur: 0 }), press(C)), ch: [
        icon({ paths: shuffle, x: -62, size: 30, sw: 2.6, color: 'inv' }),
        text({ text: 'Shuffle', x: -34, ax: 0, size: 30, weight: 600, color: 'inv' }),
      ] }),
      cursorLayer([[0, 500, 380], [0.4, 500, 380], [C - 0.1, 40, BY + 12], [C + 0.3, 40, BY + 12], [1.5, 120, 260],
        [D0 - 0.08, 0, PY - 35 + GY], [D0, 0, PY - 35 + GY], [D1, 380, PY - 35 + GY + 70, 'Power2 Smooth'], [D1 + 0.35, 400, PY + 150]],
        [C], [[D0, D1]], { inAt: 0.35 }),
    ];
  },
});
}

// 3 ─ Fan spread: a closed stack fans out round a rivet at its bottom corner; the cursor pulls one card out
UIK.define({
  id: 'fan-spread', name: 'Fan spread', cat: 'gallery', T: 3.0, cam: 1.35,
  desc: 'A closed stack of photo cards fans open round a rivet at its bottom-left corner, each card rotating a little further than the one below. The cursor pulls the middle card up out of the fan: it slides along its own axis and grows while its neighbours part to let it through.',
  build: () => {
    const CW = 280, CH = 380, RV = 26, PX = -46, PY = 196, O = 0.55, L = 1.75, LD = 0.55, LIFT = 140;
    const ANG = [-52, -32, -12, 8, 28], PART = [-57, -39, -12, 15, 32], V = [2, 1, 0, 5, 7];
    const card = (v, i) => group({ id: 'fan' + i, x: PX, y: PY,
      k: { rot: [0, [O + i * 0.04, O + i * 0.04 + 0.6, ANG[i], 'Power4 Out'], ...(PART[i] !== ANG[i] ? [[L, L + LD, PART[i], 'Power3 Out']] : [])] }, ch: [
        ...(i === 2 ? [rect({ id: 'liftShadow', x: CW / 2 - RV, y: -CH / 2 + RV, w: CW, h: CH, r: 22, fill: 'card', shadow: 2,
          k: { y: [[L, L + LD, -CH / 2 + RV - LIFT, 'Power3 Out']], scale: [[L, L + LD, 1.05, 'Power3 Out']], opacity: [0, [L, L + 0.25, 1, 'Power2 Out']] } })] : []),
        rect({ id: 'card' + i, x: CW / 2 - RV, y: -CH / 2 + RV, w: CW, h: CH, r: 22, fill: 'card', shadow: 3,
          k: i === 2 ? { y: [[L, L + LD, -CH / 2 + RV - LIFT, 'Power3 Out']], scale: [[L, L + LD, 1.05, 'Power3 Out']] } : null,
          ch: [photo({ id: 'photo' + i, w: CW - 24, h: CH - 24, r: 13, v })] }),
      ] });
    // the grab point on the middle card, in its own (rotated) frame round the rivet → world; the lift runs along the card's axis
    const a = ANG[2] * Math.PI / 180, W = (lx, ly) => [Math.round(PX + lx * Math.cos(a) - ly * Math.sin(a)), Math.round(PY + lx * Math.sin(a) + ly * Math.cos(a))];
    const [GX, GY] = W(70, -300), [LX, LY] = W(68, -300 - LIFT - 7);
    return [
      group({ id: 'fan', k: popIn(0.1, 0.7), ch: [
        ...V.map(card),
        circle({ id: 'rivet', x: PX, y: PY, d: 34, fill: 'ink', shadow: 3, ch: [circle({ d: 12, fill: 'card' })] }),
      ] }),
      cursorLayer([[0, 460, 330], [1.1, 460, 330], [L - 0.1, GX, GY], [L, GX, GY], [L + LD, LX, LY, 'Power3 Out'], [2.75, LX + 40, LY - 10]],
        [], [[L, L + LD]], { inAt: 1.05 }),
    ];
  },
});

// 4 ─ Stack cycle: the front card is pulled down and tucks to the back of the pile, three times
UIK.define({
  id: 'stack-cycle', name: 'Stack cycle', cat: 'gallery', T: 4.4, cam: 1.28,
  desc: 'A pile of four photos, the older ones peeking above. The cursor pulls the front photo down: it slides out below the pile, then rises behind it into the last slot while the others step forward one place. Three cycles, the caption under the pile swapping each time.',
  build: () => {
    const W = 640, H = 400, Y0 = -106, LY = 44, LS = 0.06, SC = 0.84, DIP = 340, DDY = 70, DRAG = 0.22, SW = 0.5;
    const TS = [1.0, 1.95, 2.9];
    const lv = (d) => ({ y: Y0 - LY * d, s: 1 - LS * d });
    const C = { A: { v: 3, t: 'Lisbon', n: 1 }, B: { v: 1, t: 'Dolomites', n: 2 }, D: { v: 7, t: 'Kew Gardens', n: 4 }, Cc: { v: 5, t: 'Biarritz', n: 3 } };
    // levels over time for one copy: start level, then [t, level] steps (moving one place forward), optional tuck time / appear time
    const copy = (id, c, d0, steps, o = {}) => {
      const y = [lv(d0).y], sc = [lv(d0).s], op = [o.appear != null ? 0 : 1];
      if (o.appear != null) {                     // the back copy takes over below the pile, then rises into the last slot
        const a = o.appear;
        y[0] = Y0 + DIP; sc[0] = SC;
        op.push([a, 1]);
        y.push([a, a + 0.5, lv(3).y, 'Power3 Out']); sc.push([a, a + 0.5, lv(3).s, 'Power3 Out']);
      }
      for (const [t, d] of steps) { y.push([t + 0.45, t + 0.95, lv(d).y, 'Power3 Out']); sc.push([t + 0.45, t + 0.95, lv(d).s, 'Power3 Out']); }
      if (o.tuck != null) {                        // dragged down with the cursor, then slides out below the pile
        const t = o.tuck;
        y.push([t, t + DRAG, Y0 + DDY, 'Power2 In'], [t + DRAG, t + SW, Y0 + DIP, 'Power3 Out']);
        sc.push([t + DRAG, t + SW, SC, 'Power3 Out']);
        op.push([t + SW, 0]);
      }
      return photo({ id, y: y[0], w: W, h: H, r: 34, v: c.v, shadow: 1, k: { y, scale: sc, opacity: op } });
    };
    const [t0, t1, t2] = TS;
    const caption = (c, i) => {
      const a = i ? TS[i - 1] + 0.5 : null, b = TS[i] != null ? TS[i] + 0.12 : null;
      return group({ id: 'caption' + i, k: k(a == null ? enter(0.3, { dy: 12, y0: 0 }) : enter(a, { dy: 12, y0: 0 }), b != null ? exit(b) : null), ch: [
        text({ text: c.t, y: Y0 + 272, size: 40, weight: 600, ls: -0.02 }),
        text({ text: `${c.n} of 4 · Saved trips`, y: Y0 + 318, size: 26, color: 'muted' }),
      ] });
    };
    const GX = 150, GY = Y0 + 90;
    const keys = [[0, 520, 340], [0.5, 520, 340]];
    TS.forEach((t, i) => keys.push([t - 0.1, GX, GY], [t, GX, GY], [t + DRAG, GX, GY + DDY, 'Power2 In'], [t + DRAG + 0.25, GX + 10, GY + DDY + 24, 'Power2 Out']));
    keys.push([4.0, 380, 330]);
    return [
      group({ id: 'captions', ch: [C.A, C.B, C.Cc, C.D].map(caption) }),
      group({ id: 'pile', k: popIn(0.1, 0.7), ch: [
        copy('photoC2', C.Cc, 3, [], { appear: t2 + SW }),
        copy('photoB2', C.B, 3, [[t2, 2]], { appear: t1 + SW }),
        copy('photoA2', C.A, 3, [[t1, 2], [t2, 1]], { appear: t0 + SW }),
        copy('photoD', C.D, 3, [[t0, 2], [t1, 1], [t2, 0]]),
        copy('photoC', C.Cc, 2, [[t0, 1], [t1, 0]], { tuck: t2 }),
        copy('photoB', C.B, 1, [[t0, 0]], { tuck: t1 }),
        copy('photoA', C.A, 0, [], { tuck: t0 }),
      ] }),
      cursorLayer(keys, [], TS.map((t) => [t, t + DRAG]), { inAt: 0.45 }),
    ];
  },
});

// 5 ─ Polaroid scatter: polaroids drop onto the table askew; one is picked up, straightened and enlarged
UIK.define({
  id: 'polaroid-scatter', name: 'Polaroid scatter', cat: 'gallery', T: 3.2, cam: 1.2,
  desc: 'Five polaroids drop onto the table one after another, each settling at its own angle and overlapping the last. The cursor picks one half-buried in the pile: it comes to the front (a quick cross-fade to a copy above the others), straightens and grows to the centre while the table dims behind it.',
  build: () => {
    const PWd = 300, PHd = 356, C = 1.72, M = C + 0.08;
    const P = [
      { x: -330, y: -110, rot: -10, v: 1, cap: 'Dolomites' },
      { x: -40, y: -150, rot: 7, v: 8, cap: 'Old town' },
      { x: 280, y: -90, rot: -5, v: 3, cap: 'Harbour' },
      { x: -210, y: 160, rot: 5, v: 5, cap: 'Day three' },
      { x: 130, y: 150, rot: -9, v: 7, cap: 'Garden' },
    ];
    const pol = (id, p, kk) => rect({ id, x: p.x, y: p.y, rot: p.rot, w: PWd, h: PHd, r: 6, fill: 'card', shadow: 2, k: kk, ch: [
      photo({ id: id + 'Photo', y: -28, w: 268, h: 268, r: 3, v: p.v }),
      text({ id: id + 'Cap', text: p.cap, y: 140, size: 28, weight: 500 }),
    ] });
    const drop = (p, i) => {
      const t = 0.15 + i * 0.12;
      return { scale: [1.35, [t, t + 0.5, 1, 'Power4 Out']], opacity: [0, [t, t + 0.12, 1, 'Linear']],
               rot: [p.rot + (i % 2 ? -12 : 12), [t, t + 0.5, p.rot, 'Power4 Out']], y: [p.y - 40, [t, t + 0.5, p.y, 'Power4 Out']] };
    };
    const pick = P[1];
    return [
      ...P.map((p, i) => pol('polaroid' + i, p, i === 1 ? k(drop(p, i), { opacity: [[C + 0.02, C + 0.16, 0, 'Linear']] }) : drop(p, i))),
      rect({ id: 'dim', w: 1600, h: 900, fill: 'shade/30', k: { opacity: [0, [C, C + 0.45, 1, 'Power2 Out']] } }),
      pol('picked', pick, {
        opacity: [0, [C + 0.02, C + 0.16, 1, 'Linear']],
        x: [[M, M + 0.7, 0, 'Power4 Out']], y: [[M, M + 0.7, -10, 'Power4 Out']],
        rot: [[M, M + 0.7, 0, 'Power4 Out']], scale: [[C - 0.06, C, 0.97, 'Power2 Out'], [M, M + 0.75, 1.5, 'Power4 Out']] }),
      cursorLayer([[0, 500, 380], [1.15, 500, 380], [C - 0.1, pick.x + 10, pick.y - 110], [C + 0.2, pick.x + 10, pick.y - 110], [C + 0.9, 470, 330]],
        [C], [], { inAt: 1.1 }),
    ];
  },
});

// 6 ─ Hover spread: a tidy stack of four photos spreads into a row on hover and gathers back on leave
UIK.define({
  id: 'stack-hover-spread', name: 'Hover spread', cat: 'gallery', T: 3.8,
  cam: { zoom: 1.45, y: 34, k: { zoom: [[1.0, 1.6, 1.0, 'Power3 Out'], [2.62, 3.2, 1.45, 'Power3 Out']] } },
  desc: 'A tidy, slightly askew stack of four photos. The cursor hovers it and the photos spread into a row with small tilts (the view pulls back to hold them); the photo under the cursor lifts, and when the cursor leaves they gather back into the stack.',
  build: () => {
    const W = 300, H = 380, HV = 1.0, LV = 2.62, LIFT = 1.9;
    const REST = [[-10, 6, -7], [8, -4, 5], [-4, 2, -3], [0, 0, 0]];
    const SPREAD = [[-495, 22, -5], [-165, -6, -2], [165, -6, 2], [495, 22, 5]];
    const V = [5, 7, 2, 8];
    const ph = (v, i) => {
      const d = Math.abs(i - 1.5) - 0.5, a = HV + d * 0.05, b = LV + (1 - d) * 0.04;   // inner pair first on the way out, outer pair first on the way back
      const kk = {
        x: [REST[i][0], [a, a + 0.6, SPREAD[i][0], 'Power4 Out'], [b, b + 0.55, REST[i][0], 'Power3 Out']],
        y: [REST[i][1], [a, a + 0.6, SPREAD[i][1], 'Power4 Out'], [b, b + 0.55, REST[i][1], 'Power3 Out']],
        rot: [REST[i][2], [a, a + 0.6, SPREAD[i][2], 'Power4 Out'], [b, b + 0.55, REST[i][2], 'Power3 Out']],
      };
      if (i === 2) {
        kk.scale = [[LIFT, LIFT + 0.35, 1.05, 'Power3 Out'], [LV - 0.05, LV + 0.3, 1, 'Power3 Out']];
        kk.y.splice(2, 0, [LIFT, LIFT + 0.35, SPREAD[i][1] - 14, 'Power3 Out']);
      }
      return photo({ id: 'photo' + i, x: REST[i][0], y: REST[i][1], rot: REST[i][2], w: W, h: H, r: 26, v, shadow: 1, k: kk });
    };
    return [
      group({ id: 'stack', k: popIn(0.1, 0.7), ch: V.map(ph) }),
      text({ id: 'title', text: 'Weekend in Porto', y: 272, size: 40, weight: 600, ls: -0.02, k: enter(0.3, { dy: 12, y0: 272 }) }),
      text({ id: 'count', text: '4 photos', y: 318, size: 26, color: 'muted', k: enter(0.36) }),
      cursorLayer([[0, 420, 330], [0.45, 420, 330], [HV, 40, 60], [LIFT - 0.1, 190, 20], [LV - 0.1, 200, 30], [LV + 0.3, 330, 300], [3.6, 360, 310]],
        [], [], { inAt: 0.4 }),
    ];
  },
});

// 7 ─ Story viewer: full-screen stories; a tap on the right edge slides the next one in and advances the segment
UIK.define({
  id: 'story-viewer', name: 'Story viewer', cat: 'gallery', T: 4.0, cam: PHONE_CAM,
  desc: 'A full-screen story plays under a segmented progress bar. Two taps on the right edge: each completes the current segment, slides the next photo in from the right and starts the next segment filling, while the posted-time label swaps. A reply field sits at the bottom.',
  build: () => {
    const T1 = 1.45, T2 = 2.65, SLIDE = 0.55, SEGW = 148, SX = [-156, 0, 156], SY = -466, END = 3.55;
    const STORIES = [{ v: 2, t: '2h' }, { v: 1, t: '48m' }, { v: 3, t: '12m' }];
    // segment i plays from `a` (Linear), and on the tap `b` snaps full
    const seg = (i, a, b, part) => {
      const w = [0, [a, b, +(SEGW * part).toFixed(1), 'Linear']];
      if (b !== END) w.push([b, b + 0.15, SEGW, 'Power2 Out']);
      return group({ id: 'seg' + i, x: SX[i], y: SY, ch: [
        rect({ id: 'segTrack' + i, w: SEGW, h: 6, r: 3, fill: 'ink/25' }),
        rect({ id: 'segFill' + i, x: -SEGW / 2, pin: 'l', w: 0, h: 6, r: 3, fill: 'ink', k: { w } }),
      ] });
    };
    const TX = -14, TY = -418;
    const time = (s, i) => {
      const a = i ? [T1, T2][i - 1] + 0.1 : null, b = i < 2 ? [T1, T2][i] + 0.04 : null;
      return text({ id: 'time' + i, text: s.t, x: TX, y: TY, ax: 0, size: 24, weight: 500, color: 'ink/60',
        k: k(a == null ? enter(0.4) : enter(a, { dx: 10, x0: TX }), b == null ? null : exit(b)) });
    };
    const TAPX = 172, TAPY = 40;
    return [
      phone({ fill: 'shade', ch: [
        group({ id: 'stories', k: { x: [[T1, T1 + SLIDE, -PW, 'Power4 Out'], [T2, T2 + SLIDE, -2 * PW, 'Power4 Out']] },
          ch: STORIES.map((st, i) => photo({ id: 'story' + i, x: i * PW, w: PW, h: PH, r: 0, v: st.v, k: i ? null : fadeIn(0.2) })) }),
        circle({ id: 'tapRipple', x: TAPX, y: TAPY, d: 150, fill: 'ink/12',
          k: { scale: [0.3, [T1, T1 + 0.4, 1, 'Power3 Out'], [T2 - 0.01, 0.3], [T2, T2 + 0.4, 1, 'Power3 Out']],
               opacity: [0, [T1, T1 + 0.06, 1, 'Linear'], [T1 + 0.12, T1 + 0.45, 0, 'Power2 Out'], [T2, T2 + 0.06, 1, 'Linear'], [T2 + 0.12, T2 + 0.45, 0, 'Power2 Out']] } }),
        group({ id: 'segments', k: fadeIn(0.3), ch: [seg(0, 0.35, T1, 0.58), seg(1, T1 + 0.15, T2, 0.52), seg(2, T2 + 0.15, END, 0.38)] }),
        group({ id: 'header', k: enter(0.34), ch: [
          circle({ id: 'ring', x: -196, y: TY, d: 64, stroke: 'acc', sw: 3 }),
          photo({ id: 'avatar', x: -196, y: TY, w: 52, h: 52, r: 26, v: 2 }),
          text({ id: 'name', text: 'maya.chen', x: -152, y: TY, ax: 0, size: 24, weight: 600 }),
          icon({ id: 'close', icon: 'x', x: 208, y: TY, size: 34, sw: 2.6 }),
        ] }),
        ...STORIES.map(time),
        group({ id: 'reply', k: enter(0.44, { dy: 14, y0: 0 }), ch: [
          rect({ id: 'replyField', x: -40, y: 436, w: 380, h: 76, r: 38, fill: 'card/90', ch: [
            text({ text: 'Send message', x: -164, ax: 0, size: 26, color: 'muted' }),
            icon({ icon: 'send', x: 150, size: 30, sw: 2.4 }),
          ] }),
          circle({ id: 'heartBtn', x: 196, y: 436, d: 72, fill: 'card/90', ch: [icon({ icon: 'heart', size: 32, sw: 2.6 })] }),
        ] }),
      ] }),
      cursorLayer([[0, 430, 430], [0.6, 430, 430], [T1 - 0.1, TAPX, TAPY], [T1 + 0.3, TAPX, TAPY], [T2 - 0.1, TAPX + 6, TAPY + 10], [T2 + 0.3, TAPX + 6, TAPY + 10], [3.5, 400, 300]],
        [T1, T2], [], { inAt: 0.55 }),
    ];
  },
});

// 8 ─ Reels swipe: a vertical feed of full-height video cards, swiped up twice; each new card's like count ticks
UIK.define({
  id: 'reels-swipe', name: 'Reels swipe', cat: 'gallery', T: 4.5, cam: PHONE_CAM,
  desc: 'A vertical feed of full-screen video cards with a play button, an action rail and a caption panel. The cursor drags the feed up and releases: the next card snaps into place, its play button fades as it starts, and its like count ticks up twice. Then once more to the third card.',
  build: () => {
    const S = [1.0, 2.45], DR = 0.3, UP = 170, SNAP = 0.55;
    const R = S.map((t) => t + DR), LAND = [0.3, R[0] + SNAP, R[1] + SNAP];
    const CARDS = [
      { v: 5, user: '@nora.sails', cap: 'Low tide at six', likes: ['8,205'], cm: '96' },
      { v: 1, user: '@leo.park', cap: 'First light on the ridge', likes: ['2,481', '2,482', '2,483'], cm: '41' },
      { v: 8, user: '@ines.walks', cap: 'Old town, quiet hours', likes: ['13,960', '13,961', '13,962'], cm: '208' },
    ];
    const CH = 30;
    const card = (c, i) => {
      const land = LAND[i], ticks = [land + 0.2, land + 0.48];
      return group({ id: 'reel' + i, y: i * PH, ch: [
        photo({ id: 'video' + i, w: PW, h: PH, r: 0, v: c.v }),
        circle({ id: 'play' + i, d: 132, fill: 'shade/35', k: k(i ? null : pop(0.32, { from: 0.6 }), exit(i ? land + 0.12 : 0.78, { s: 1.3, dur: 0.25 })),
          ch: [icon({ icon: 'play', x: 4, size: 52, sw: 2, color: '#FFFFFF', filled: true, fill: '#FFFFFF' })] }),
        rect({ id: 'rail' + i, x: 196, y: 150, w: 84, h: 290, r: 42, fill: 'card/90', ch: [
          icon({ icon: 'heart', y: -96, size: 36, sw: 2.4, color: 'acc', filled: true, fill: 'acc' }),
          rect({ id: 'likes' + i, y: -56, w: 84, h: CH, clip: true, ch: [
            group({ id: 'likesCol' + i, k: c.likes.length > 1 ? { y: ticks.map((t, j) => [t, t + 0.32, -CH * (j + 1), 'Power3 Out']) } : null,
              ch: c.likes.map((n, j) => text({ text: n, y: j * CH, size: 20, weight: 600 })) }),
          ] }),
          icon({ icon: 'message', y: 6, size: 34, sw: 2.4 }),
          text({ text: c.cm, y: 44, size: 20, weight: 600 }),
          icon({ icon: 'send', y: 104, size: 32, sw: 2.4 }),
        ] }),
        rect({ id: 'caption' + i, x: -48, y: 404, w: 384, h: 124, r: 30, fill: 'card/90', ch: [
          photo({ id: 'avatar' + i, x: -150, y: -24, w: 44, h: 44, r: 22, v: 2 }),
          text({ text: c.user, x: -118, y: -24, ax: 0, size: 22, weight: 600 }),
          text({ text: c.cap, x: -168, y: 24, ax: 0, size: 22, color: 'ink/70' }),
        ] }),
      ] });
    };
    const feed = [];
    S.forEach((t, j) => feed.push([t, R[j], -j * PH - UP, 'Power2 In'], [R[j], R[j] + SNAP, -(j + 1) * PH, 'Power3 Out']));
    const GX = 30, GY = 250;
    const keys = [[0, 440, 430], [0.5, 440, 430]];
    S.forEach((t, j) => keys.push([t - 0.08, GX, GY], [t, GX, GY], [R[j], GX, GY - UP, 'Power2 In'], [R[j] + 0.25, GX + 14, GY - UP - 60, 'Power2 Out']));
    keys.push([4.0, 380, 360]);
    return [
      phone({ fill: 'shade', ch: [
        group({ id: 'feed', k: { y: feed }, ch: CARDS.map(card) }),
        group({ id: 'topBar', k: fadeIn(0.3), ch: [
          text({ id: 'reelsTitle', text: 'Reels', x: -208, y: -430, ax: 0, size: 34, weight: 700, ls: -0.02 }),
          icon({ id: 'camera', icon: 'video', x: 204, y: -430, size: 36, sw: 2.4 }),
        ] }),
      ] }),
      cursorLayer(keys, [], S.map((t, j) => [t, R[j]]), { inAt: 0.45 }),
    ];
  },
});

// 9 ─ Book flip: the right page turns over the spine (scale X 1 → 0, then its back 0 → 1) onto the next spread
UIK.define({
  id: 'book-flip', name: 'Book flip', cat: 'gallery', T: 3.0, cam: { zoom: 1.15, y: 30 },
  desc: 'An open photo book. The cursor takes the right page by its edge and turns it: the page squeezes into the spine (scale X 1 → 0) darkening and lifting slightly, then its back opens over the left page (0 → 1) while the page beneath comes out of shadow, and the page count swaps.',
  build: () => {
    const PGW = 600, PGH = 760, F0 = 1.3, FM = 1.74, F1 = 2.2;
    const page = (id, o, side, kk, extra) => rect({ id, x: o.x ?? 0, pin: o.pin, w: PGW, h: PGH, fill: 'card',
      radii: side === 'L' ? '28px 6px 6px 28px' : '6px 28px 28px 6px', k: kk, ch: [
        photo({ id: id + 'Photo', y: -74, w: 520, h: 520, r: 14, v: o.v }),
        text({ text: o.title, x: -260, y: 234, ax: 0, size: 32, weight: 600, ls: -0.01 }),
        text({ text: o.sub, x: -260, y: 276, ax: 0, size: 24, color: 'muted' }),
        text({ text: String(o.n), x: side === 'L' ? -260 : 260, y: 340, ax: side === 'L' ? 0 : 1, size: 20, color: 'muted' }),
        ...(extra || []),
      ] });
    const shade = (id, op) => rect({ id, w: PGW, h: PGH, fill: 'shade', k: { opacity: op } });
    const P2 = { v: 3, title: 'Lisbon', sub: 'Day one · the harbour', n: 2 };
    const P3 = { v: 8, title: 'Alfama', sub: 'Morning walk', n: 3 };
    const P4 = { v: 1, title: 'Sintra', sub: 'Day two · into the hills', n: 4 };
    const P5 = { v: 7, title: 'Monserrate', sub: 'The palace gardens', n: 5 };
    const GY = 250;
    return [
      group({ id: 'book', k: popIn(0.1, 0.72), ch: [
        rect({ id: 'cover', w: 2 * PGW + 36, h: PGH + 28, r: 34, fill: 'dim', shadow: 1 }),
        page('pageL', { ...P2, x: -PGW / 2 }, 'L', fadeIn(0.22)),
        page('pageR2', { ...P5, x: PGW / 2 }, 'R', null, [shade('pageR2Shade', [0.3, [F0, F1 + 0.1, 0, 'Power2 Out']])]),
        page('flipFront', { ...P3, pin: 'l' }, 'R', { sx: [[F0, FM, 0, 'Power2 In']], sy: [[F0, FM, 1.04, 'Power2 In']] },
          [shade('flipFrontShade', [0, [F0, FM, 0.35, 'Power2 In']])]),
        page('flipBack', { ...P4, pin: 'r' }, 'L', { sx: [0, [FM, F1, 1, 'Power2 Out']], sy: [1.04, [FM, F1, 1, 'Power2 Out']] },
          [shade('flipBackShade', [0.35, [FM, F1, 0, 'Power2 Out']])]),
        rect({ id: 'spine', w: 3, h: PGH, fill: 'line' }),
      ] }),
      text({ id: 'countA', text: 'Pages 2–3 of 24', y: 440, size: 26, color: 'muted', k: k(enter(0.4), exit(FM)) }),
      text({ id: 'countB', text: 'Pages 4–5 of 24', y: 440, size: 26, color: 'muted', k: enter(FM) }),
      cursorLayer([[0, 740, 420], [0.7, 740, 420], [F0 - 0.1, PGW - 30, GY], [F0, PGW - 30, GY],
        [FM, 0, Math.round(GY * 1.04), 'Power2 In'], [F1, -(PGW - 30), GY, 'Power2 Out'], [2.75, -560, 390]], [], [[F0, F1]], { inAt: 0.65 }),
    ];
  },
});

// 10 ─ Cube turn: two turns of a faux cube — the front face squeezes to its left edge as the next grows beside it
UIK.define({
  id: 'cube-turn', name: 'Cube turn', cat: 'gallery', T: 3.7, cam: 1.3,
  desc: 'A photo cube, flicked left twice. Each turn squeezes the front face toward its left edge (scale X = cos θ) while the next face grows from the shared edge (sin θ), so the pair widens mid-turn like a real cube; the face turning away darkens, the incoming one comes out of shadow, and the caption and dots follow.',
  build: () => {
    const W = 600, CY = -40, S = [1.0, 2.25], PULL = 0.2, TURN = 0.85;
    const FACES = [{ v: 1, t: 'Morning' }, { v: 5, t: 'Noon' }, { v: 3, t: 'Evening' }];
    // θ for turn j: the flick pulls it a little (Power2 In), then it runs out with Power3 Out
    const th = S.map((t) => [0, [t, t + PULL, 16, 'Power2 In'], [t + PULL, t + TURN, 90, 'Power3 Out']]);
    const rad = (d) => d * Math.PI / 180, h = W / 2;
    // one hinge group per turn, sitting on the shared edge x = (W/2)(cos θ − sin θ): the front face hangs off it to the
    // left (pin 'r', scale X = cos θ), the incoming face to the right (pin 'l', scale X = sin θ) — one x track, no seam
    const turn = (j) => {
      const tr = th[j], t0 = S[j], t1 = t0 + TURN, a = (t) => rad(trackAt(tr, t));
      const face = (f, id, pin, fn, shadeFn, kk) => photo({ id, pin, w: W, h: W, r: 4, v: f.v,
        k: k({ sx: [r2(fn(t0)), ...fitted(t0, t1, fn, 0.015)] }, kk), ch: [
          rect({ id: id + 'Shade', w: W, h: W, fill: 'shade', k: { opacity: [r2(shadeFn(t0)), ...fitted(t0, t1, shadeFn, 0.04)] } }),
        ] });
      const first = j === 0, last = j === S.length - 1;
      return group({ id: 'hinge' + j, x: h, y: CY, k: { x: [h, ...fitted(t0, t1, (t) => h * (Math.cos(a(t)) - Math.sin(a(t))), 3)] }, ch: [
        // the front face of turn j; from the second turn on it takes over from the previous turn's incoming copy at rest
        face(FACES[j], 'face' + j + (first ? '' : 'b'), 'r', (t) => Math.cos(a(t)), (t) => 0.5 * (1 - Math.cos(a(t))), first ? null : { opacity: [0, [t0, 1]] }),
        face(FACES[j + 1], 'face' + (j + 1), 'l', (t) => Math.sin(a(t)), (t) => 0.5 * (1 - Math.sin(a(t))), last ? null : { opacity: [[S[j + 1], 0]] }),
      ] });
    };
    const caption = (f, i) => {
      const a = i ? S[i - 1] + 0.3 : null, b = i < S.length ? S[i] + 0.05 : null;
      return text({ id: 'cap' + i, text: f.t, y: 312, size: 36, weight: 600, ls: -0.02,
        k: k(a == null ? enter(0.36) : enter(a, { dx: 16, x0: 0 }), b == null ? null : exit(b)) });
    };
    // page dots: pin 'l'; the active one is a 36-wide pill that hands over leading edge first
    const DL = [[-46, 10, 34], [-46, -22, 34], [-46, -22, 2]], DW = [[44, 12, 12], [12, 44, 12], [12, 12, 44]];
    const dotK = (i) => {
      const x = [DL[0][i]], w = [DW[0][i]], fill = [];
      S.forEach((t, j) => {
        const a = t + 0.3;
        if (DL[j + 1][i] !== DL[j][i]) x.push([a, a + 0.45, DL[j + 1][i], 'Power4 Out']);
        if (DW[j + 1][i] !== DW[j][i]) { w.push([a, a + 0.45, DW[j + 1][i], 'Power4 Out']); fill.push([a, a + 0.25, DW[j + 1][i] > 12 ? 'ink' : 'dim', 'Power2 Out']); }
      });
      return k(fadeIn(0.42), { x, w }, fill.length ? { fill } : null);
    };
    const keys = [[0, 470, 360], [0.5, 470, 360]];
    S.forEach((t) => keys.push([t - 0.1, 190, 60], [t, 190, 60], [t + PULL, 90, 56, 'Power2 In'], [t + PULL + 0.3, -120, 40, 'Power2 Out']));
    keys.push([3.35, 330, 330]);
    return [
      group({ id: 'cube', k: popIn(0.1, 0.72), ch: S.map((_, j) => turn(j)) }),
      ...FACES.map(caption),
      ...[0, 1, 2].map((i) => rect({ id: 'dot' + i, x: DL[0][i], y: 366, pin: 'l', w: DW[0][i], h: 12, r: 6, fill: i ? 'dim' : 'ink', k: dotK(i) })),
      cursorLayer(keys, [], S.map((t) => [t, t + PULL]), { inAt: 0.45 }),
    ];
  },
});

// 11 ─ Wheel picker: iOS-style wheels; items scale and fade with their distance from the selection band
UIK.define({
  id: 'wheel-picker', name: 'Wheel picker', cat: 'gallery', T: 3.9, cam: 1.4,
  desc: 'A date-and-time picker of three wheels in a clipped window, the items shrinking, squashing and fading with their distance from the centre band. The cursor flicks the date wheel (a short pull, then momentum settles five days on) and then the hour wheel; the summary line swaps to the new value.',
  build: () => {
    const ROW = 70, WH = 5 * ROW, WY = 52;
    const F = [1.0, 2.3], PULL = [0.18, 0.16], PD = [40, 30];
    const COLS = [
      { id: 'date', x: -170, items: ['Mon 22 Sep', 'Tue 23 Sep', 'Wed 24 Sep', 'Today', 'Fri 26 Sep', 'Sat 27 Sep', 'Sun 28 Sep', 'Mon 29 Sep', 'Tue 30 Sep', 'Wed 1 Oct', 'Thu 2 Oct'], sel: 3, to: 8, f: 0, run: 1.0, e: 'Expo Out' },
      { id: 'hour', x: 120, items: ['06', '07', '08', '09', '10', '11', '12', '13', '14', '15'], sel: 3, to: 6, f: 1, run: 0.8, e: 'Power4 Out' },
      { id: 'min', x: 250, items: ['15', '20', '25', '30', '35', '40', '45'], sel: 3 },
    ];
    // distance d (in rows) from the band → look of an item
    const look = (d) => { const a = Math.min(Math.abs(d), 3); return { s: 1 - 0.07 * a, sy: Math.cos(Math.min(a * 0.42, 1.45)), o: Math.max(0, 1 - 0.34 * a) }; };
    const col = (c) => {
      const y = [-c.sel * ROW];
      if (c.to != null) {
        const t = F[c.f], p = PULL[c.f];
        y.push([t, t + p, -c.sel * ROW - PD[c.f], 'Power2 In'], [t + p, t + p + c.run, -c.to * ROW, c.e]);
      }
      const colY = (t) => trackAt(y, t);
      const item = (s, j) => {
        const kk = {}, d0 = (j * ROW + y[0]) / ROW, L0 = look(d0);
        let s0 = L0.s, sy0 = L0.sy, o0 = L0.o;
        kk.scale = [r2(s0)]; kk.sy = [r2(sy0)]; kk.opacity = [r2(o0)];
        if (c.to != null) {
          const t0 = F[c.f], t1 = t0 + PULL[c.f] + c.run;
          const lk = (t) => look((j * ROW + colY(t)) / ROW);
          kk.scale.push(...fitted(t0, t1, (t) => lk(t).s, 0.015));
          kk.sy.push(...fitted(t0, t1, (t) => lk(t).sy, 0.04));
          kk.opacity.push(...fitted(t0, t1, (t) => lk(t).o, 0.04));
        }
        return text({ id: c.id + j, text: s, y: j * ROW, size: 36, weight: 500, tnum: c.id !== 'date', k: kk });
      };
      // only the items that are ever inside the window (the pull moves the column a little further first)
      const seen = (j) => { const d0 = j - c.sel, d1 = j - (c.to ?? c.sel); return Math.max(d0, d1) > -2.6 && Math.min(d0, d1) - 0.6 < 2.6; };
      return group({ id: c.id + 'Col', x: c.x, k: { y }, ch: c.items.map((it, j) => (seen(j) ? item(it, j) : null)).filter(Boolean) });
    };
    const SUM = ['Today at 09:30', 'Tue 30 Sep at 09:30', 'Tue 30 Sep at 12:30'];
    const sumAt = [null, F[0] + PULL[0] + 0.45, F[1] + PULL[1] + 0.35];
    return [
      rect({ id: 'card', w: 860, h: 580, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'title', text: 'Remind me', x: -380, y: -214, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.22, { dx: -14, x0: -380 }) }),
        ...SUM.map((s, i) => text({ id: 'summary' + i, text: s, x: -380, y: -166, ax: 0, size: 28, color: 'muted',
          k: k(i ? enter(sumAt[i], { dx: -10, x0: -380 }) : enter(0.3), i < 2 ? exit(sumAt[i + 1] - 0.05) : null) })),
        text({ id: 'done', text: 'Done', x: 380, y: -214, ax: 1, size: 32, weight: 600, color: 'acc', k: enter(0.3) }),
        rect({ id: 'wheel', y: WY, w: 780, h: WH, r: 24, fill: 'card', clip: true, k: fadeIn(0.3), ch: [
          rect({ id: 'band', w: 780, h: ROW, r: 18, fill: 'soft' }),
          ...COLS.map(col),
        ] }),
      ] }),
      cursorLayer([[0, 520, 330], [0.5, 520, 330], [F[0] - 0.08, -150, WY + 60], [F[0], -150, WY + 60], [F[0] + PULL[0], -150, WY + 60 - PD[0], 'Power2 In'],
        [F[0] + PULL[0] + 0.3, -140, WY - 60, 'Power2 Out'], [F[1] - 0.08, 130, WY + 56], [F[1], 130, WY + 56], [F[1] + PULL[1], 130, WY + 56 - PD[1], 'Power2 In'],
        [F[1] + PULL[1] + 0.3, 140, WY - 50, 'Power2 Out'], [3.6, 360, 300]], [], [[F[0], F[0] + PULL[0]], [F[1], F[1] + PULL[1]]], { inAt: 0.45 }),
    ];
  },
});

// 12 ─ Vertical ticker: headlines roll up one at a time in a single-line window; the category chip rolls and resizes with them
UIK.define({
  id: 'vertical-ticker', name: 'Vertical ticker', cat: 'gallery', T: 4.0, cam: 1.3,
  desc: 'A single-line news ticker: each headline holds, then the column rolls up to the next inside a clipped window. The category chip beside it rolls its label in step and stretches or shrinks to fit the new word; the live dot pulses.',
  build: () => {
    const ROWH = 64, CHH = 52, RS = [1.25, 2.15, 3.05], RD = 0.5, CX = -376, HX = -222, HW = 722;
    const ITEMS = [
      ['Markets', 124, 'Stocks close higher for a third day'],
      ['Science', 124, 'Battery cell charges in six minutes'],
      ['Sport', 98, 'City marathon opens a record entry list'],
      ['Weather', 132, 'Rain clears by Friday afternoon'],
    ];
    const pulse = [];
    for (let t = 0.6; t < 3.4; t += 0.8) pulse.push([+t.toFixed(2), +(t + 0.4).toFixed(2), 0.55, 'Power2 Smooth'], [+(t + 0.4).toFixed(2), +(t + 0.8).toFixed(2), 1, 'Power2 Smooth']);
    return [
      rect({ id: 'bar', w: 1120, h: 128, r: 64, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        group({ id: 'live', k: enter(0.24), ch: [
          circle({ id: 'liveDot', x: -506, d: 16, fill: 'acc', k: { scale: [1, ...pulse] } }),
          text({ text: 'Live', x: -486, ax: 0, size: 28, weight: 600 }),
        ] }),
        rect({ id: 'divider', x: -400, w: 2, h: 56, fill: 'line', k: fadeIn(0.3) }),
        rect({ id: 'chip', x: CX, pin: 'l', chAt: 'pin', w: ITEMS[0][1], h: CHH, r: CHH / 2, fill: 'ink', clip: true,
          k: k(enter(0.3, { blur: 0, s: 0.9 }), { w: RS.map((t, j) => [t, t + RD, ITEMS[j + 1][1], 'Power4 Out']) }), ch: [
            group({ id: 'chipCol', k: { y: RS.map((t, j) => [t, t + RD, -CHH * (j + 1), 'Power3 Out']) },
              ch: ITEMS.map((it, j) => text({ text: it[0], x: 20, y: j * CHH, ax: 0, size: 24, weight: 600, color: 'inv' })) }),
          ] }),
        rect({ id: 'window', x: HX + HW / 2, w: HW, h: ROWH, clip: true, ch: [
          group({ id: 'headlines', k: k(enter(0.36, { dy: 20, y0: 0, blur: 0, s: 1 }), { y: RS.map((t, j) => [t + 0.04, t + 0.04 + RD, -ROWH * (j + 1), 'Power3 Out']) }),
            ch: ITEMS.map((it, j) => text({ id: 'headline' + j, text: it[2], x: -HW / 2, y: j * ROWH, ax: 0, size: 32, weight: 500, ls: -0.01 })) }),
        ] }),
        icon({ id: 'next', icon: 'chevronRight', x: 516, size: 32, sw: 2.6, color: 'muted', k: enter(0.4) }),
      ] }),
    ];
  },
});

})();
