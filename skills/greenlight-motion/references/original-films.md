# Brand-new films: art direction first

Read this before you write scene pages: when the brief asks for brand-new motion graphics (`look.source: "new"`),
for a mix, when the user asks for something original or "not the library look", and in quick mode.

**The bar.** You are the creative director and the lead animator of a top motion studio, and this film goes
into the studio's reel. A viewer must not be able to tell it came from a kit. A library scene with new
colours, a UI card floating on grey, or the library's pop-in timing is a failed brief, however clean it is.

## What a brand-new film is

| | Library scenes | Your scene pages |
|---|---|---|
| Subject | UI cards, controls, screens | The idea: type, shapes, the product, a visual metaphor. UI only where the product must be shown |
| Colour | Theme colours, grey canvas, one accent | The brand's own palette as real values: `colors`, `accent`, `background` (any hex), read through `--gl-*` |
| Type | Helvetica Neue, 44–64 px titles | A display face (`font`, or any Google font the page loads), display sizes 140–320 px, words used as objects |
| Motion | Calm springs, one preset for the film | Its own motion language: a signature move, easing contrast, rhythm |
| Toolbox | 275 finished scenes | Everything a browser draws: HTML and CSS, SVG, canvas, three.js, gradients, blend modes, filters, masks, video |

Still binding: the scene-page contract ([scenes.md](scenes.md): the film's colours through variables, editable
words, pictures through `images` or project files), the clean-intro rule (no warps over the title while it is read),
copy that fits, and the user's facts (never invent prices or claims).

## 1. Concept before pixels

1. Find the one thing the viewer must feel or understand. Read the brief, the site capture and the story.
2. **Write three concepts**, each a one-line visual idea plus why it fits this product. The first idea that
   comes to mind is the one every other video has; keep it only if nothing beats it.
3. Pick the strongest. A concept is a visual mechanism, not a mood:
   - Generic: "UI cards float in and show the features."
   - Concept: "The app turns clutter into one clean line: every scene starts crowded, and the product's
     mark sweeps it into a single stroke that becomes the next scene."
   - Concept: "Time is a physical ribbon: it folds into each feature, and the last fold spells the name."
4. In the storyboard, each variant is a **different concept** (another idea, another direction), never the
   same idea with other scenes or colours.

## 2. Write the direction before you build

Write it into `scenario.json → direction` right after the story, and set the real values it names:

```json
"direction": {
  "idea": "Clutter becomes one clean line: every scene starts crowded, the brand's stroke sweeps it into a single line that becomes the next scene.",
  "references": ["Apple product films: one light, macro detail", "Swiss poster typography: huge type, strict grid"],
  "look": "Near-black ground, warm off-white type, one hot orange for the stroke. Full-bleed, asymmetric, big negative space.",
  "type": "Unbounded 700 at 180–260 px, tight tracking; Inter 400 at 36 px for the one small line per scene.",
  "motion": "Hard Expo Out attacks (0.3 s), long Spring Smooth settles; every entrance travels along the stroke's 12° diagonal.",
  "signature": "The orange stroke: it draws on (Trim Paths), sweeps the clutter away, and is the match cut into every next scene."
}
```

Then set `background`, `accent`, `colors` (token values), `font` and `motion` so the film really looks that way.
The scenario card shows the direction under the story, so in guided mode the user approves the concept together
with the story; in quick mode it is your plan and the stills must prove it.

## 3. The craft

**Typography is the hero.**
- Display type 140–320 px on a 1920 frame, tight tracking (letter-spacing −0.02 to −0.04 em), at most two weights.
- Words are objects: build a line as one element per word (or per letter for short words) so they can be
  revealed through masks, staggered 40–80 ms, scaled against each other, or cropped by the frame edge.
- Reveal type through a mask sliding over it (`clip-path`, a line box with `overflow: hidden`), not by fading a whole paragraph in.
- Never three centred lines of 40 px text in the middle of the frame.

**Composition.**
- Full-bleed and asymmetric. One focal point per frame; everything else supports it.
- Scale contrast: something huge against something small. Let big things run off the frame.
- Negative space is a choice: leave a third of the frame empty on purpose.
- A card floating in the middle of a plain ground is the library's look, not yours.

**Motion language.**
- One **signature move** that recurs and transforms across the film: it is what people remember.
- **Easing contrast**: a fast attack (`Expo Out` or `Power4 Out`, 0.25–0.45 s), then a long settle
  (`Spring Smooth` 0.8–1.4 s). Linear only for continuous drift.
- **Overlap and follow-through**: nothing starts or stops together; children trail their parents by 40–120 ms,
  and a big move overshoots a little and settles.
- **Anticipation** before a big move (a 3–6 % pull back), **arcs** rather than straight lines for travel.
- **Depth**: CSS 3D (`perspective`, `transform-style: preserve-3d`) or three.js for real objects and a camera,
  foreground layers that move faster than the background, blur for depth of field.
- **Speed**: stretch a fast-moving shape along its path and blur it a little for the frames it travels.

**Transitions carry the motion.**
- Match cuts: a shape at the end of one scene becomes the frame, the mask or the first shape of the next.
- Wipes along the signature direction, pushes through the camera, zooms through a letter or a shape.
- Plan each scene's last frame together with the next scene's first. A fade between two unrelated scenes is the
  last resort.

**Rhythm.**
- Vary shot lengths (1.2–4 s). Build to one hero moment about 70 % of the way in, then a clean final hold.
- Land the big changes on the voice-over's words and the sound hits.
- No dead time, but give the reader time: at least 2.5 words per second of on-screen copy.

**Colour and light.**
- Two or three colours plus neutrals; the accent is rare and means something.
- Light, gradients and texture are yours to use: big soft shapes in the accent (`filter: blur(80–200px)`,
  `mix-blend-mode: screen`) drifting slowly, a grain, a lit gradient ground. Use them for the idea, not as decoration.
- Check contrast: every word must read on its ground.

**Life in every frame.** Give each scene a quiet secondary motion (a drift, a light sweep, a slow parallax) so
no frame looks frozen. It never competes with the focal point.

## 4. Never

- A library scene in a brand-new film, or a library scene's layout with new colours (`check.mjs` flags library
  scenes when the brief says brand-new).
- UI cards on a grey canvas as the default subject.
- Everything fading up from below with the same timing; the same scene structure three times in a row.
- The kit's palette or Helvetica just because they are the defaults.
- Stock moves: confetti, sparkles, lens flares, bouncing emoji, "glassmorphism" blobs, a spinning logo end card.
- Stock copy: "Introducing…", "Meet the future of…", "Say goodbye to…".
- Turbulence or ripple warps over the title while it is read.

## 5. Build it

- Every scene is a page in `<project>/scenes/` written for this film ([scenes.md](scenes.md)). Don't open the
  library's files for patterns: they pull you back to the kit.
- The toolbox is the web: HTML and CSS for type and layout (`clip-path` and masks for reveals, CSS 3D for depth),
  SVG for lines that draw on (`stroke-dashoffset`) and shapes that morph, canvas for generative systems, three.js
  (`GLScene`) for real 3D objects, lights and particles, `<video>` for footage.
- Give the user controls: `data-ui-label` on the few elements they will want to change, `params` for the effects.

## 6. Review like a creative director

Before the storyboard (or, in quick mode, before the preview):

1. Stills of every scene at 6–8 moments (`node SKILL/tools/stills.mjs <project> --scene <n> --n 8`) and the
   whole film (`--film`).
2. Score each scene 1–5 on: **idea** (does it show the concept?), **typography**, **composition**, **motion**
   (easing, overlap, rhythm), **originality** (would anyone guess it came from a kit?), **craft** (alignment,
   spacing, text that fits, nothing cut off).
3. Rebuild every scene that scores under 4 anywhere. Do at least one full improvement pass on the whole film
   before the user sees it.
4. Watch the transitions in the preview: the cut from each scene to the next is where films look cheap.
