# scenario.json

A project folder holds one `scenario.json` and whatever it points at:

```
greenlight-motion/spring-drop/
  scenario.json
  scenes/       the scene pages you write (scenes/hook.html …)
  assets/       the user's pictures (png, jpg, webp, gif, svg) and anything your pages load
  audio/        voice-over clips (written by tools/voiceover.mjs)
  exports/ renders/   written by the tools
```

A scene is one of two things:
- **a page you write**: `{ "html": "scenes/hook.html" }`, any HTML, CSS, SVG, canvas or three.js, animated any way
  a web page can be ([scenes.md](scenes.md));
- **a library scene**: `{ "item": "coupon-ticket" }`, one of the 275 ready-made animated scenes in
  `registry.json`, re-worded and re-pictured with the film's copy.

A film mixes them freely.

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
    "alternatives": { "3": ["coupon-scratch"] }
  },
  "scenes": [
    { "html": "scenes/hook.html", "title": "Hook", "duration": 3.2,
      "voice": { "take": ["The spring drop is live, and it won't last.", "Linen shirts, from thirty-nine dollars,", "and SPRING50 takes half off."] } },
    { "html": "scenes/arrivals.html", "title": "New arrivals", "duration": 4.2, "transition": "fade",
      "images": { "hero": "assets/hero.png" } },
    { "item": "coupon-ticket", "title": "The code", "transition": "fade",
      "text": { "offer": "50% off", "code": "SPRING50" } }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `name` | The film's title (cards, projects, files). `id` (optional) is its slug; default from the name. |
| `size` | Frame in px: 1920×1080, 1080×1920, 1080×1080 … A page is the frame. Library scenes are laid out 1:1 around the centre, designed for 1920×1080; a vertical frame fits most cards, wide ones (carousels, dashboards) overflow — look at the stills. |
| `fps` | 24–60. Default 30. |
| `theme` | `light` or `dark`: the film's colours ([Colours](#colours)). |
| `accent` | One accent colour (hex). Default `#FF5A1F`. |
| `motion` | The motion feel of the library scenes: `spring` (default: calm springs), `snappy`, `gentle`, `playful`, `elastic`, or `authored` (each scene as designed). A scene can set its own. See [easing.md](easing.md). |
| `background` | Behind every scene: a CSS colour, `"theme"` (the theme's `bg`, `#E9E7E2` light / `#121211` dark), or `null` / omitted = transparent (WebM alpha / ProRes 4444 renders keep it). |
| `colors` | The film's colours by name: values for the theme's (`{ "ink": "#111111", "card": "#FFF4E0" }`) and names of the film's own (`{ "brand-2": "#FFD400" }`). Every page gets them as `--gl-<name>`; library scenes use the theme's. |
| `recolor` | Library colours: a literal colour swapped wherever a library scene uses it, `{ "#FFFFFF": "#111111" }`. |
| `font` | The film's font (`--gl-font` in a page, the type of every library scene): `Helvetica Neue` (default), `Inter`, `Geist`, `Manrope`, `DM Sans`, `Fraunces`, or a display face: `Space Grotesk`, `Bricolage Grotesque`, `Syne`, `Unbounded`, `Sora`, `Outfit`, `Archivo`, `Instrument Sans`, `Playfair Display`. They load from Google Fonts (renders wait for them); After Effects needs the font installed. A page can load any other Google font itself. |
| `edits` | The user's changes from the preview, on top of all of this. See [Edits](#edits). |
| `direction` | A brand-new film's art direction, written after the story and before any scene: `{ idea, references, look, type, motion, signature }`, the values set for real in `colors`, `accent`, `background`, `font`, `motion`. The scenario card shows it. See [original-films.md](original-films.md). |
| `story` | The scenario in words, written before any scene: `logline` + `acts: [{ title, beats: [{ title, idea }] }]` (or a flat `beats`). See [Story](#story). |
| `scenes[]` | In order. See below. |
| `gallery.brief` | One line under the gallery's title (else the logline). |
| `gallery.alternatives` | Scene number → other library scenes offered for it. |
| `voiceover` | Written by `tools/voiceover.mjs` — don't write it by hand. |
| `sfx` | Sound effects: `{ cues: [...], duck, loudness }`, written by `tools/sfx.mjs --auto` and yours to edit — see [sound.md](sound.md). |

### A scene

| Field | Meaning |
| --- | --- |
| `html` | The scene's page, relative to the project ([scenes.md](scenes.md)). |
| `item` | Or a library scene's id from `registry.json`. |
| `title` | The beat's name (scene bar, cards). |
| `duration` | Seconds on screen. A page: default 4. A library scene: its own length; longer holds the last frame, shorter cuts it. |
| `transition` | Into this scene: `cut` (default) or `fade` (0.35 s: the new scene fades in over the end of the last one). |
| `text` | New words. A page: element id → text (`{ "4": "Order" }`, the element's `data-gl`). A library scene: its text ids from the registry (`texts`, `numbers`). |
| `images` | Pictures, path (relative to the project) or URL. A page: key → file for its `data-image="key"` elements and `glImage(key)`, or an element id → file. A library scene: each `key` from the registry's `images` (its id, or the shared picture name `src` that fills every copy; `"#1"`, `"#2"` … fill one slot). A picture fills its box (cover). |
| `style` | Per element: `{ "4": { "color": "acc", "size": 120 } }` — `color`, `fill`, `stroke`, `size` (px), `weight`, `ls` (em), `upper`, `italic`, `font`, `r` (corner radius, px), `x`, `y` (px, added to its own motion), `scale`, `rotate` (deg), `hide`. A key is an element id (a page's `data-gl`, a library scene's layer id or `~0.2.1`). A colour is any CSS colour or a film colour by name (`acc`, `ink`, `acc/40` = 40 %). These win over the scene's own values. |
| `params` | The scene's effects: a page's `GLScene` params, or a library scene's (the registry lists them), e.g. `{ "glow": 20 }`. |
| `voice` | The voice-over. Usually a long take started on this scene: `{ "take": [part, …] }`, part k spoken over scene +k (the scenes inside a take have no `voice`). Or, for a standalone beat, one line or a list of `{ text, at }` (at = seconds into the scene). See [voiceover.md](voiceover.md). |
| `motion` | A library scene's motion preset, overriding the film's (one `elastic` moment). |
| `ui` | Panels for the preview on a library scene, see [Controls for the preview](#controls-for-the-preview). |

Timing is computed: scene *n* starts where scene *n − 1* ends. Every scene runs on its own clock from 0; nothing
from one scene leaks into the next.

## Colours

The film's colours, by name. Every page gets each one as `--gl-<name>`; library scenes are drawn in them.

| Name | Light | Dark | Use |
| --- | --- | --- | --- |
| `bg` | `#E9E7E2` | `#121211` | the canvas (`background: "theme"`) |
| `card` / `panel` | `#FFFFFF` / `#F4F2EE` | `#1D1C1A` / `#191816` | surfaces |
| `ink` / `inv` | `#0B0B0B` / `#FFFFFF` | `#F4F2EE` / `#0B0B0B` | text, text on the accent |
| `muted` | `#8A8782` | `#8F8B84` | secondary text |
| `line` / `skel` / `soft` / `dim` | hairlines, skeletons, soft and dim fills | | |
| `acc` | the film's `accent` | | the one accent |
| `bad`, `shade`, `white` | error red, near-black, white | | |

`colors` sets any of them for the film and adds names of its own.

## Controls for the preview

The preview's **Elements** tab shows your panels for what is on screen, and every option of whatever the user
clicks (a click works on any element of any scene). A panel is a small editor for one thing in the film, named in
the film's words. In a page, name the element: `data-ui-label="Headline" data-ui="text,color,size"`
([scenes.md](scenes.md#editable-elements)); its effects are its `GLScene` params. For a library scene, list its
panels in `ui`:

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
- A control is a property (`"text"` alone means the anchor's own) or `{ prop, layer, label, min, max, step, unit }`.
  Props: `text`, `color` (a text's colour, a shape's fill), `fill`, `stroke`, `size`, `weight`, `case`, `tracking`,
  `radius`, `image`, `move`. `{ "param": "glow" }` puts one of the scene's params in the panel.
- Choose what matters to this film: its words, its brand colours, its picture. Leave out text whose width the scene
  measured (a pill that hugs a word, a masked line): a longer word gets cut.

## Edits

What the user changed in the preview, kept apart from what you wrote so both stay visible (the preview shows a
green dot on each changed field and can reset it):

```json
"edits": {
  "film": { "accent": "#FF5A1F", "colors": { "card": "#FFF4E0" }, "recolor": { "#FFFFFF": "#111111" }, "font": "Inter" },
  "scenes": {
    "1": { "text": { "4": "Order" }, "style": { "4": { "color": "acc", "size": 150, "x": 40 } } },
    "6": { "text": { "price": "$9" }, "style": { "stickerDisc": { "fill": "#3E63DD" } }, "params": { "tilt": 20 } }
  }
}
```

Scenes are keyed by number (from 1), elements by id (a page's `data-gl`, a library scene's layer id); each part has
the same shape as the film's and scene's own fields, and wins over them. Every tool applies them (preview, render,
stills, GLEA, the After Effects package). Under a board they are saved on the preview card; preview.mjs, render.mjs,
export.mjs and edits.mjs pull them into scenario.json first.
`node tools/edits.mjs <project>` lists them; `--fold` makes them the film's own values (do it before you rebuild
or reorder scenes); `--clear` drops them.

## Finding library scenes

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
work, play, carousel, gallery, showcase (the product's own screens, choreographed).

Good openers: `text` titles, `promo` countdowns, a `morph` that opens into the product. Good middles:
`data` charts and counters, `content` cards, `gallery` / `carousel` for pictures, `ai` chats. Good
closers: `promo` coupons and codes, a CTA `controls` button with a cursor click, `text` end titles.

## Copy

- Keep a library scene's words near the original length: a card is sized for its copy. Look at the stills.
- A text id that isn't in the scene is reported (`! scene 2: … has no text layer "x"`).

## Numbers

In a library scene, counters and timers are placeholder tokens inside a text: `{{{COUNTER:0-2,480; start=0.45}}}`,
`{{{TIMER:05:00-00:00}}}`. To change the number, copy the scene's token from `numbers` in the registry
and change only the range, keeping every option — `start=` and `kf=` tie it to the scene's own motion:

```json
"text": { "number": "{{{COUNTER:0-12,400; start=0.45}}}", "claimed": "{{{COUNTER:0-60; style=count; kf=2}}}% claimed" }
```

Range format is literal: separators, decimals and zero-padding come out as typed (`0-1,250.50`,
`100-0` counts down, `05:00-00:00` for a timer). Options: `style` odometer | roll | count, `duration`,
`easing` (`power3_out`, `expo_out`, `linear`…), `turns`, `lands`, `cascade`, `direction`.

## Galleries drawn in code

Library galleries drawn in code (`imageList: true` in the registry) take an image LIST instead of photo slots:
`images: ["assets/a.jpg", "assets/b.jpg", …]` (or `'#1'`, `'#2'` …), in order.

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
- No scene pages, library ids, text fields or timings: those come with the shots (the storyboard's scenes).

## Storyboard

Before the preview, show 2–3 directions for the approved story (SKILL.md step 3). Variants go in
`storyboard.variants`. Size, theme, accent and background are shared, and each variant has its own
`scenes` (and `motion`):

```json
"storyboard": {
  "variants": [
    { "id": "a", "name": "One clean line", "note": "Clutter swept into one stroke.",
      "scenes": [ { "html": "scenes/a-hook.html", "title": "Everything in one place", "duration": 3 }, … ] },
    { "id": "b", "name": "Screens tour", "motion": "snappy", "scenes": [ { "item": "screen-wall", "title": "Everything in one place" }, … ] }
  ]
}
```

- Make the variants different in idea, structure and motion, not just in colour or copy. Each variant's pages are
  its own files (`scenes/a-hook.html`, `scenes/b-hook.html`).
- A scene can set `"keyframe"`: seconds into the scene for its storyboard frame. The default is 72 %
  of the scene, where most moves have settled.
- `node SKILL/tools/storyboard.mjs <project> --pick b` copies variant B's scenes and motion into the
  scenario and records `storyboard.picked`. The variants stay for reference.

## Pictures

- A page shows pictures through `images` (`data-image="key"`, `glImage(key)`) or files it names itself
  ([scenes.md](scenes.md#what-every-page-gets)). A library scene takes pictures in its photo slots only (the registry
  lists them): cropped to the slot (cover), with its corners and its own motion (zoom, pan, reveal).
- Pictures travel with every output: inlined in artifacts and scene pages, uploaded to the board, bundled into
  GLEA and the After Effects package.
