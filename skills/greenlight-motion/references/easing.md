# Easing and motion feel

Every film has a motion feel. The default is **spring**: the calm, physical motion of the GreenLight
Dash collaboration launch film. Moves leave softly, arrive with a long settle, and nothing bounces.
Change it when the user asks for a different feel ("snappier", "smoother", "more playful", "bouncy",
"elastic"), or when the brand calls for it.

## The film's preset: `motion`

`scenario.json` → `"motion": "spring"` (the default), or per scene `scenes[n].motion`. A preset keeps
every item's timing and swaps each keyframe segment's easing by its role:

| Role | Which segments | What they are |
|---|---|---|
| out | the `… Out` curves (Power1–4, Expo, Cubic, Circ, Sine, Ease Out, Slow Down), and segments with no easing | enters, fades, decisive moves |
| smooth | the `… Smooth` curves (Power1–4, Expo, Cubic, Circ), `Smooth`, `Natural` | travel, morphs, camera, cursor |
| pop | `Back Out` | small pops: badges, dots, knobs, tooltips, `popIn` |

`… In`, `Linear`, `Hold`, `Sine Smooth` (scrubs), the `AE …` curves and anything already bouncy stay as
authored. The scene cross-fades take the preset's smooth curve.

| Preset | out | smooth | pop | Use for |
|---|---|---|---|---|
| **`spring`** (default) | Spring Out | Spring Smooth | Spring Pop | Product films, tutorials, launches: calm and premium |
| `snappy` | Expo Out | Expo Smooth | Back Out | Energetic promos and fast social cuts |
| `gentle` | Sine Out | Natural | Power2 Out | Slow, soft, cinematic. No overshoot at all. |
| `playful` | Back Out | Back Smooth | Overshoot | Friendly consumer apps and kids' brands |
| `elastic` | Smooth Overshoot | Back Smooth | Elastic | When the user asks for elastic or bouncy motion |
| `authored` | — | — | — | Keep each item's own easing (the library as designed) |

`playful` and `elastic` bounce **only transforms** (x, y, scale, sx, sy, rot). Opacity, colour, blur,
trim and counters, and the camera, take the calm spring curves, so nothing flashes or goes off-colour.

When the user asks for a different feel: set `motion`, re-run `gallery.mjs` / `preview.mjs`, and
let them compare. For one bouncy moment in an otherwise calm film, give only that scene its own `motion`.

## The spring curves

These are the kit's own curves (`lib/easings.js`). Each is the collaboration film's closed-form spring,
normalised to where it settles and fitted to one cubic bezier (within 2 %), so the lab, the Video Editor
(a **Custom** key with that bezier) and After Effects (temporal ease from the same handles) all draw the
same motion.

| Curve | Bezier | Shape | Segment length |
|---|---|---|---|
| `Spring Smooth` | 0.374, 0.029, 0.183, 1 | Leaves with zero speed, speed peaks at 27 % of the segment, then a long, slow settle (a spring chasing a spring) | morphs 0.9–1.2 s · camera 1.2–1.6 s · cursor legs 0.6–1 s |
| `Spring Out` | 0.28, 0.35, 0.137, 1 | Soft start, speed peaks at 14 %, long settle | enters 0.5–0.7 s · fades 0.35–0.5 s · moves 0.6–0.9 s |
| `Spring Pop` | 0.289, 0.351, 0.127, 1.163 | Like Spring Out with about 2 % overshoot | pops 0.35–0.5 s |

Springs settle slowly, so give their segments about 20 % more time than a Power curve needs. A
segment that is too short looks cut off at the end.

## Building a new item

New items use the springs by default. Keep the easing roles in ONE table at the top of the item file,
so its feel can change in one place:

```js
const E = { enter: 'Spring Out', move: 'Spring Smooth', travel: 'Spring Smooth', pop: 'Spring Pop',
            fade: 'Spring Out', exit: 'Power2 In', drift: 'Linear', scrub: 'Sine Smooth' };
```

Exits keep an In curve (Power2 In): they leave fast and never linger. Drifts, typing, progress bars
and marquees stay `Linear`.

## Every easing you can name

These are the Video Editor's easing catalogue (`lib/easings.js`) and export exactly as editor keys.
Any segment can use any of them: `[t0, t1, value, 'Expo Out']`.

| Family | Names | Character |
|---|---|---|
| Out (decelerate) | Power1 Out · Power2 Out · Power3 Out · Power4 Out · Expo Out · Cubic Out · Circ Out · Sine Out · Ease Out · Slow Down | Arrivals. Power1/Sine are the softest, Power4/Expo the most decisive. |
| In (accelerate) | Power1–4 In · Expo In · Cubic In · Circ In · Sine In · Ease In | Exits and things leaving the frame |
| Smooth (in-out) | Power1–4 Smooth · Expo Smooth · Cubic Smooth · Circ Smooth · Sine Smooth · Smooth · Natural | Travel between two places. Natural is the After Effects "Easy Ease" feel. |
| AE-style | AE In · AE Smooth · AE Out | After Effects' default-looking curves |
| Overshoot | Back Out (≈10 %) · Back In · Back Smooth · Overshoot (20 %, fast launch) · Smooth Overshoot (16 %, soft launch) · Swing (winds back 20 %, overshoots 10 %) | Pops and playful arrivals |
| Bouncy | Elastic (37 %, rings several times) · Bounce Out (drops and bounces) · Impulse (winds back 20 %, then shoots) | Only when asked: elastic, bouncy, cartoon |
| Mechanical | Linear · Hold (a step) | Drifts, typing, counters, marquees; instant switches |

Rules of thumb:
- Keep bouncy curves on small things (badges, icons, a button). An `Elastic` on a full-width card
  swings 37 % of its travel.
- Never put overshoot on colour or opacity: colours lerp past their target, and opacity just clips.
- A counter or timer token has its own `easing` option (a lowercase key such as `power3_out`) —
  see the Numbers section of [scenario.md](scenario.md#numbers).
- `node -e "…UIK.ease('Spring Out')(0.3)"` (through `tools/kit.mjs`) gives a curve's value when you need
  to time something against it; `UIK.h.invEase(name, p)` gives the time at which it reaches `p`.
