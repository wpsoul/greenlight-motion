# scenario.json

A project folder holds one `scenario.json` and whatever it points at:

```
greenlight-motion/spring-drop/
  scenario.json
  assets/       the user's pictures (png, jpg, webp, gif, svg)
  items/        items built new for this film (UIK.define files, optional)
  audio/        voice-over clips (written by tools/voiceover.mjs)
  exports/ renders/   written by the tools
```

## Fields

```json
{
  "name": "Spring drop",
  "size": { "w": 1920, "h": 1080 },
  "fps": 30,
  "theme": "light",
  "accent": "#3E63DD",
  "background": "theme",
  "story": {
    "logline": "The spring collection is here, and the code makes it yours for less.",
    "acts": [{ "title": "The drop", "beats": [
      { "title": "Hook", "idea": "The sale clock starts: spring is on." },
      { "title": "New arrivals", "idea": "Linen shirts from $39." },
      { "title": "The code", "idea": "SPRING50 at checkout." } ] }]
  },
  "gallery": {
    "brief": "A 15-second promo for the spring collection.",
    "alternatives": { "1": ["countdown-launch", "countdown-webinar"], "3": ["coupon-scratch"] }
  },
  "scenes": [
    { "item": "countdown-flash-sale", "title": "Hook",
      "text": { "title": "Spring drop", "sub": "Up to 50% off the new collection" },
      "voice": { "take": ["The spring drop is live, and it won't last.", "Linen shirts, from thirty-nine dollars,", "and SPRING50 takes half off."] } },
    { "item": "kenburns-crossfade", "title": "New arrivals", "duration": 4.2, "transition": "fade",
      "text": { "title0": "Linen shirts", "sub0": "From $39" },
      "images": { "slide0": "assets/hero.png" } },
    { "item": "coupon-ticket", "title": "The code", "transition": "fade",
      "text": { "offer": "50% off", "code": "SPRING50" } }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `name` | The film's title (cards, projects, files). `id` (optional) is its slug; default from the name. |
| `size` | Frame in px. Items are laid out 1:1 around the centre, designed for 1920×1080; a vertical 1080×1920 frame fits most cards, wide items (carousels, dashboards) overflow — check the gallery. |
| `fps` | 24–60. Default 30. |
| `engine` | `default` (or omitted): scenes are items (layers, with 3D space). `3d`: the 3D engine, every scene an HTML page (`"html": "scenes/…html"` instead of `item`), no After Effects export. See [3d-engine.md](3d-engine.md). |
| `theme` | `light` or `dark` — the item palette. |
| `accent` | One accent colour (hex). Default the library's orange `#FF5A1F`. |
| `motion` | The motion feel: `spring` (default: calm springs), `snappy`, `gentle`, `playful`, `elastic`, or `authored` (each item's own easing). A scene can set its own. See [easing.md](easing.md). |
| `background` | Behind the items: a CSS colour, `"theme"` (the theme's canvas, `#E9E7E2` light / `#121211` dark), or `null` / omitted = transparent (renders as WebM alpha / ProRes 4444 keep it). |
| `colors` | The film's own values for theme tokens: `{ "ink": "#111111", "card": "#FFF4E0" }` (token names: [engine-api.md](engine-api.md) → theme). Every layer on that token follows. |
| `recolor` | Item colours: a literal colour swapped wherever an item uses it, `{ "#FFFFFF": "#111111" }`. |
| `font` | The film's font: `Helvetica Neue` (default, the Video Editor's), `Inter`, `Geist`, `Manrope`, `DM Sans` or `Fraunces`. Web fonts load from Google Fonts (renders wait for them); After Effects needs the font installed. Items that measure their words may need re-fitting. |
| `edits` | The user's changes from the preview, on top of all of this. See [Edits](#edits). |
| `story` | The scenario in words, written before any scene: `logline` + `acts: [{ title, beats: [{ title, idea }] }]` (or a flat `beats`). See [Story](#story). |
| `scenes[]` | In order. See below. |
| `gallery.brief` | One line under the gallery's and the script's title (else the logline). |
| `gallery.alternatives` | Scene number → other item ids offered for that scene. |
| `voiceover` | Written by `tools/voiceover.mjs` — don't write it by hand. |
| `sfx` | Sound effects: `{ cues: [...], duck, loudness }`, written by `tools/sfx.mjs --auto` and yours to edit — see [sound.md](sound.md). |

### A scene

| Field | Meaning |
| --- | --- |
| `item` | An item id from `registry.json` (or one of `items/*.js`). A 3D-engine film has `html` instead: the scene's page ([3d-engine.md](3d-engine.md)). |
| `title` | The beat's name (scene bar, cards). |
| `duration` | Seconds on screen. Default: the item's own length. Longer holds the last frame; shorter cuts it. |
| `transition` | Into this scene: `cut` (default) or `fade` (0.35 s: the new scene fades in over the end of the last one, which then fades out). |
| `text` | Text-layer id → new text. Ids are in the item's registry entry (`texts`, `numbers`). |
| `images` | Picture → path (relative to the project) or URL. Use each entry's `key` from the registry's `images`: its `id`, or the shared picture name (`src`) when several layers show one picture (a thumbnail and its big screen, a loop's twin copies — `copies` counts them). One entry fills every copy. `"#1"`, `"#2"` … (the slot numbers) fill a single layer. The picture fills its box (cover). |
| `voice` | The voice-over. Usually a long take started on this scene: `{ "take": [part, …] }`, part k spoken over scene +k (the scenes inside a take have no `voice`). Or, for a standalone beat, one line or a list of `{ text, at }` (at = seconds into the scene). See [voiceover.md](voiceover.md). |
| `motion` | This scene's motion preset, overriding the film's (e.g. one `elastic` moment). |
| `params` | The item's own parameters (an item that declares `params`: the registry lists them), e.g. `{ "glow": 20 }`. |
| `style` | Per layer: `{ "price": { "color": "#111", "size": 120 } }` — `color` / `fill` / `stroke`, `size`, `weight`, `upper`, `italic`, `ls` (em), `r`, `sw`, `text`. A key is a layer id (or `~0.2.1`, a layer without one: child indexes). A colour recolours the layer's resting colour and its keyframes of that colour; an object swaps colours on it (`"color": { "acc": "#F00" }`: the accent a title turns to); a size scales its keyframes. |
| `ui` | Controls for the preview on a library item: panels, see [Controls for the preview](#controls-for-the-preview). Not drawn. |

Timing is computed: scene *n* starts where scene *n − 1* ends. Each scene's keyframes, typing,
counters and camera moves are shifted to its start; nothing from one scene leaks into the next.

## Controls for the preview

The preview's **Elements** tab shows your panels for what is on screen, and every option of whatever the user
clicks. A panel is a small editor for one thing in the film, named in the film's words. For items you build,
put `ui` on the layer and `params` on the item ([building-items.md](building-items.md#controls-for-the-user)).
For a library item, list the scene's panels in `ui`:

```json
"ui": [
  { "layer": "card", "label": "Poll", "controls": [
    { "layer": "q", "prop": "text", "label": "Question" },
    { "layer": "q", "prop": "size", "label": "Question size", "min": 28, "max": 56 },
    { "layer": "bar1", "prop": "fill", "label": "Winning bar" }
  ] }
]
```

- `layer` anchors the panel: it shows while that layer is on screen, and a click on anything inside it opens it.
- A control is a property (`"text"` alone means the anchor's own) or `{ prop, layer, label, min, max, step, unit }`;
  `layer` can list several ids that change together (`["title", "subtitle"]` for one colour). Props: `text`, `color`
  (a text's or icon's colour, a shape's fill, a line's stroke), `fill`, `stroke`, `size`, `weight`, `case`, `tracking`,
  `radius`, `width`, `image`. `{ "param": "glow" }` puts one of the item's params in the panel.
- Choose what matters to this film: its words, its brand colours, its picture. Leave out text whose width the item
  measured (a pill that hugs a word, a masked line): a longer word gets cut.

## Edits

What the user changed in the preview, kept apart from what you wrote so both stay visible (the preview shows a
green dot on each changed field and can reset it):

```json
"edits": {
  "film": { "accent": "#FF5A1F", "colors": { "card": "#FFF4E0" }, "recolor": { "#FFFFFF": "#111111" }, "font": "Inter" },
  "scenes": { "6": { "text": { "price": "$9" }, "style": { "stickerDisc": { "fill": "#3E63DD" } }, "params": { "tilt": 20 } } }
}
```

Scenes are keyed by number (from 1); each part has the same shape as the film's and scene's own fields, and wins
over them. Every tool applies them (preview, render, stills, Video Editor, After Effects). Under a board they are
saved on the preview card; preview.mjs, render.mjs, export.mjs and edits.mjs pull them into scenario.json first.
`node tools/edits.mjs <project>` lists them; `--fold` makes them the film's own values (do it before you rebuild
or reorder scenes); `--clear` drops them.

## Finding items

```
node SKILL/tools/registry.mjs --search "coupon code" [--cat promo] [--limit 20]
```

prints id, length, category and description. Then read the entry in `registry.json`:

```json
{ "id": "coupon-ticket", "name": "Coupon ticket", "category": "commerce", "duration": 3.1,
  "texts": [{ "id": "offer", "text": "20% off" }, { "id": "code", "text": "SPRING24" }, …],
  "numbers": [], "images": [] }
```

Categories: controls, feedback, data, content, morph (shapes that morph into other UI), ai, commerce,
promo (countdowns, coupons, codes), social, system, mobile, text (titles, typography), everyday,
work, play, carousel, gallery.

Good openers: `text` titles, `promo` countdowns, a `morph` that opens into the product. Good middles:
`data` charts and counters, `content` cards, `gallery` / `carousel` for pictures, `ai` chats. Good
closers: `promo` coupons and codes, a CTA `controls` button with a cursor click, `text` end titles.

## Copy

- Keep overrides near the original length — a card is sized for its copy. Check in the gallery.
- A text id that isn't in the item is reported (`! scene 2: … has no text layer "x"`).

## Numbers

Counters and timers are placeholder tokens inside a text: `{{{COUNTER:0-2,480; start=0.45}}}`,
`{{{TIMER:05:00-00:00}}}`. To change the number, copy the item's token from `numbers` in the registry
and change only the range, keeping every option — `start=` and `kf=` tie it to the item's own motion:

```json
"text": { "number": "{{{COUNTER:0-12,400; start=0.45}}}", "claimed": "{{{COUNTER:0-60; style=count; kf=2}}}% claimed" }
```

Range format is literal: separators, decimals and zero-padding come out as typed (`0-1,250.50`,
`100-0` counts down, `05:00-00:00` for a timer). Options: `style` odometer | roll | count, `duration`,
`easing` (`power3_out`, `expo_out`, `linear`…), `turns`, `lands`, `cascade`, `direction`.

## HTML-only items

Some items are marked HTML only (`formats: ['html']` — in `registry.json` and the gallery): as editable
Video Editor layers they would be too heavy (`editorCost` in the registry). They play everywhere like
any item; only the exports differ: in **GLEA with layers** that scene is one HTML clip (the other scenes
stay editable layers), and in **After Effects** it is pre-rendered ProRes footage. Prefer an item that
keeps layers when the user wants to edit the scene frame by frame.

HTML-only galleries drawn in code (`imageList: true` in the registry) take an image LIST instead of
photo slots: `images: ["assets/a.jpg", "assets/b.jpg", …]` (or `'#1'`, `'#2'` …), in order.

## Story

The scenario, written first, in words only (SKILL.md step 2): what the film says before how it looks.
`tools/story.mjs` shows it as the scenario card; the user approves it before any scene is written.

```json
"story": {
  "logline": "Your community asks, votes and watches it ship, then everything the plugin gives you, free.",
  "acts": [
    { "title": "First half · the loop: ask, vote, ship", "beats": [
      { "title": "Build together", "idea": "Forums and roadmaps, together with your community." },
      { "title": "Users vote", "idea": "Your users vote on what gets built next." } ] },
    { "title": "Second half · the product", "beats": [
      { "title": "No monthly fees", "idea": "No vendor lock-in. Fully self-hosted." },
      { "title": "Download for Free", "idea": "The logo and the call to action." } ] }
  ]
}
```

- **logline**: one sentence, who it is for and what they get.
- **beats**: in order, 3–8. A beat's `title` becomes its scene's title; `idea` is one sentence of what
  happens and why it matters. Acts are optional (a flat `"beats": [...]` works); use them when the film
  has halves or turns.
- No item ids, text fields or timings: those are the script (the scenes).

## Storyboard

Before the preview, show 2–3 directions for the approved story (SKILL.md step 4). Variants go in
`storyboard.variants`. Size, theme, accent and background are shared, and each variant has its own
`scenes` (and `motion`):

```json
"storyboard": {
  "variants": [
    { "id": "a", "name": "Calm product tour", "note": "Screens first, then the steps.", "motion": "spring",
      "scenes": [ { "item": "screen-wall", "title": "Everything in one place", "duration": 4 }, … ] },
    { "id": "b", "name": "Punchy launch", "motion": "snappy", "scenes": [ … ] }
  ]
}
```

- Make the variants different in structure and motion (item picks, pacing, preset), not just in
  colour or copy.
- A scene can set `"keyframe"`: seconds into the scene for its storyboard frame. The default is 72 %
  of the scene, where most items have settled.
- `node SKILL/tools/storyboard.mjs <project> --pick b` copies variant B's scenes and motion into the
  scenario and records `storyboard.picked`. The variants stay for reference.

## Pictures

- Only photo slots take pictures (the registry lists them). The picture is cropped to the slot
  (cover), with the slot's rounded corners; the slot's own motion (zoom, pan, reveal) applies.
- Logos: pick an item with a photo slot of a similar shape, or build a small item with
  `image({ img, w, h, fit: 'contain' })` ([building-items.md](building-items.md)).
- Pictures travel with every output: inlined in artifacts and scene pages, uploaded to the board,
  bundled into GLEA and After Effects exports.
