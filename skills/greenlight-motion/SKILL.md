---
name: greenlight-motion
description: "GreenLight Motion (GL Motion), the motion design engine for agents. Build short animated films out of its items — 260+ animated interface elements (buttons, toggles, cards, charts, checkouts, coupons, countdowns, notifications, chats, galleries, titles) in one clean style — plus new items made in the same style, or real 3D scenes (three.js) with its 3D engine. Plans a scenario from the user's brief and assets, shows every item as a gallery, builds a player preview where the user edits the design tokens and the elements (with controls you design for them), adds a voice-over and sound effects (from the GreenLight Dash Sound Library), renders MP4 / WebM alpha / ProRes with its own frame-exact HTML render engine, and exports to the GreenLight Dash Video Editor (every layer editable, or one HTML clip per scene) or After Effects. Use when the user wants a product promo, feature explainer, UI animation, app demo, sale or coupon video, countdown, launch teaser, social clip or any motion graphics built from interface elements, or mentions GreenLight Motion, GL Motion, the UI Motion Kit or this skill's path."
---

# GreenLight Motion (GL Motion)

You turn a brief into a finished motion film made of animated UI elements. Everything runs from this
skill's folder (the directory holding this file — call it `SKILL`): `node SKILL/tools/<tool>.mjs`.
Needs Node 18+. Under a GreenLight Dash board nothing else: the app captures websites, takes stills and
renders with its own browser and ffmpeg. Standalone, capture screenshots, stills and renders need Python 3 +
Playwright and ffmpeg: run `node SKILL/tools/doctor.mjs` once before the first of them. It says what works
and prints the install commands for the rest. **Never search the disk for a Python, a browser or ffmpeg, and
never install them yourself.** If doctor lists something missing, tell the user what it is for and show its
commands; everything else (scenario, gallery, storyboard, preview, exports) works without them.

**Work as an exceptional motion designer.** Treat every film as the piece that goes into your portfolio
when you apply for a senior motion designer job: a hiring director will watch it frame by frame. Every
beat has a reason, every move has the right easing and timing, and spacing and type are exact.
Nothing is left at a default just because it was easier. Look at your stills and previews the way
that director would, and fix what they would notice before you show anything.

The library is `SKILL/lib/` (the engine plus 260+ items) and `SKILL/registry.json` (every item: id, name,
category, length, description, its editable texts, its photo slots). A film is a **project folder**
with a `scenario.json` ([scenario.md](references/scenario.md)): scenes that each play one item, with the
user's copy and pictures swapped in.

**Two engines, one per film** (`scenario.json → engine`, from the brief's `look.engine`):
- **Default**: items as layers, with 3D space (cards that turn, depth, a camera that tilts and dollies).
  Every layer is editable in the Video Editor and After Effects. Use it unless the story needs real 3D objects.
- **3D engine** (`"engine": "3d"`): every scene is an HTML page you write with three.js on WebGL (objects,
  lights, glow, particles). The Video Editor gets each scene as an HTML clip that the user edits as code, and
  there is **no After Effects export**. Read [3d-engine.md](references/3d-engine.md) before you write one;
  the steps below say where it differs.

## Two contexts — the tools detect which

- **Under a GreenLight Dash board** (`GREENLIGHT_API_BASE_URL` is set and the app has a current board): the
  film is a **pipeline** on the board ([board-mode.md](references/board-mode.md) → The pipeline). Its steps
  run in order (Brief, Capture the site, Scenario, Script, Storyboard, Preview, Render & export, Final film),
  and approval gates stop it for the user. Under the steps, a review lane shows every card at full size.
  The tools fill the pipeline themselves. Voice-overs use the board's text-to-speech models, exports create
  **Video Editor projects**, and the render lands in Final film.
- **Standalone** (any agent, any machine): every card is a page. Publish its `*.artifact.html` if you can
  publish artifacts; otherwise open the `.html` in the browser. The preview runs on a local server with
  working Render and Export buttons, and exports are files the user imports into GreenLight Dash (GLEA) or
  runs in After Effects.

Pass `--standalone` to force standalone under a board, or `--api <url> --board <id>` to target one.

## The workflow

Follow these steps in order. Do not skip the confirmations. The user approves four times: the
**scenario** (the story, in words), the **script**, the **storyboard** direction (unless the brief skips
it) and the **preview**. Nothing is rendered before the preview is approved.

**Under a board, the pipeline is the plan.** Create it right after the brief is read:
`node SKILL/tools/pipeline.mjs <project>`. It reads `brief.json`: it adds a Capture step when there is a
website, and a Storyboard step unless the brief skips it. Before you work on a step, mark it running:
`pipeline.mjs <project> --step <key> --status in_progress` (keys: `capture`, `scenario`, `script`,
`storyboard`, `preview`, `render`). Each card tool then puts its card in the step's lane, finishes the step
and opens its gate ("Requires Approval"). Stop there, tell the user the card is in the pipeline, and wait.
When they approve, go on: the next tool marks the gate approved (or run `--approve <key>`). When they want
changes, edit and run the tool again. The card updates in place and the gate stays open. Never run a later
step while a gate is still open.

### 1. Ask what to build and what they have

**Start from the brief.** The task may hand you one: GreenLight Dash's **AI Motion Design** action
(Video Editor ▸ Smart AI) saves a `brief.json` on the board and names it in your prompt. The project
may also already have a `brief.json`. If so, read it ([brief.md](references/brief.md)) and ask only what
it leaves open. Any field set to `"agent"` is your decision; make it and say what you chose.
Standalone with no brief, you can offer the visual onboarding page instead of chat questions:
`node SKILL/tools/brief.mjs <project> --agent`. Run it in the background and give the user the URL. It
writes `<project>/brief.json` when they press Start (the server also prints a `{"event":"brief"}` line);
wait for it, then continue. Always pass `--agent`: without it the page is for someone with no agent
running yet, and ends by copying a prompt for their own agent instead. With `--artifact` it writes a
publishable copy whose last step gives them a prompt with the brief as JSON to paste back to you. Whatever its source, check a brief with
`node SKILL/tools/brief.mjs --check <project>` and ask only about the fields it lists as `open`.

**A website?** If the brief or the user names the product's site, capture it first:
`node SKILL/tools/capture.mjs <project> --url <url>`. That saves desktop and phone screenshots to
`assets/`, and the page's copy, headings, colours and logo to `site.json`. The screenshots fill the
Product showcase items; the copy and colours inform the scenario and the accent. The user's own
pictures (`product.assets`) come before captured ones. Under a board the app's browser takes the
screenshots, and they show at full size in the pipeline's Capture lane. Standalone it is the render engine (Python + Playwright); with neither, the tool reads the
page's HTML alone: `site.json` has the copy, colours and logo but `"via": "html"` and no screenshots. Then
use the user's own pictures, or ask them for screenshots.

Otherwise, one round of questions (use your ask-the-user tool when you have one), only what the brief
leaves open:
- **Default or 3D engine?** Ask only when they want real 3D objects or name 3D. Say the trade: the 3D
  engine has no After Effects export, and its scenes are code in the Video Editor, not layers.
- **Library or brand-new?** Always ask this one (not for the 3D engine: it builds every scene new). The first option is to build the film from the
  ready-made GL Motion library: fast, 260+ proven items in one consistent look, re-worded and
  re-pictured with their copy and assets. The second is to design brand-new motion graphics for this
  film: every scene built from scratch for their brand and story. That is slower but unique. A mix
  works too: library items, plus new ones where nothing fits.
- **The film**: what it is for (promo, feature demo, sale, launch, social post), the key message, the
  call to action, roughly how long (10–30 s is typical), landscape 1920×1080 or vertical 1080×1920.
- **Assets**: logo, product photos, screenshots, brand colours (one accent), the exact copy (names,
  prices, codes, dates), and whether they want a voice-over.
- Light or dark look. The motion feel is `spring` (calm, premium) unless the brief asks for something
  else: energetic, soft, playful, bouncy or elastic ([easing.md](references/easing.md)).

Copy their files into the project's `assets/`. Never invent prices, codes or claims — use theirs, or
mark placeholders clearly in the scenario for them to confirm.

### 2. The scenario: the story, in words

Make the project folder, `greenlight-motion/<film-slug>/` in the working directory (the same under a board: the
tools upload what the board needs). Start `scenario.json` with the film's `name`, `size`, `fps`, `theme`,
`accent` and `motion` (and `"engine": "3d"` for the 3D engine). Then, **before any item or layout, write the story** into `scenario.json → story`
([scenario.md](references/scenario.md#story)):

- a **logline**: one sentence, who it is for and what they get;
- the **beats** in order, grouped into acts when the film has halves or turns (the loop, then the product),
  each beat a title and one sentence of what happens and why it matters. Hook, the product or the feature,
  proof or detail, the offer or the call to action: 3–8 beats.

No item ids, no text fields, no timings yet. This is what the film says, not how it looks.

`node SKILL/tools/story.mjs <project> [--artifact]`

- Board: the scenario card, in the pipeline's Scenario lane. The step waits for the user's approval.
- Standalone: `story.html`, or publish `story.artifact.html`.

Ask the user to approve the story or change it (a beat, the order, the message). Re-run until they approve.

### 3. The script

Turn the approved story into scenes: one scene per beat.

1. Find items: `node SKILL/tools/registry.mjs --search "countdown sale"` (add `--cat promo`, see the
   categories in `registry.json`). Read an item's entry in `registry.json` for its `texts` (ids you can
   re-word), `numbers` (placeholder counters) and `images` (the pictures you can fill: use each entry's
   `key`, which fills all of its `copies`).
   **Brand-new motion graphics** (their answer in step 1): skip the search. Build every scene as a new item
   (point 4), designed for this film. It may leave the library's look behind (their accent, their layout,
   their motion language), but it keeps the engine rules in [building-items.md](references/building-items.md)
   so that preview, render and exports work unchanged.
2. Pick the item that tells each beat: prefer items whose motion tells it (a counter for a number, a coupon
   for a code). For product overviews and tutorials, the `showcase` category choreographs their own app
   screens: a screen wall or phone columns to open, a screens tour, a grid spotlight on one feature,
   feature relay for tutorial steps, device fold for "works everywhere". Each screen is a photo slot, so
   fill `images` with their screenshots.
   `formats` in the registry says how an item exports: HTML-only items (`formats: ['html']`, too heavy
   for editor layers) stay one HTML clip in the Video Editor ([scenario.md](references/scenario.md#html-only-items)).
3. Write the scenes into `scenario.json`: `item`, `title` (the beat's), `text` overrides, `images`,
   `duration`, `transition` (`cut` / `fade`), and the voice-over when the brief wants one. Write the voice-over
   as **long takes** over several scenes, never one short line per scene
   ([voiceover.md](references/voiceover.md#long-takes-the-default)). Add `gallery.alternatives` (2–3 other items
   per scene) so the user can swap.
   **Give the user controls** for what they will want to change in the preview: a scene `ui` panel on a library
   item (its headline, its price, its button colour), in the words of the film ("$0 sticker", "Button"), not
   the layer ids ([scenario.md](references/scenario.md#controls-for-the-preview)). Only what is worth changing:
   2–4 controls per panel, never every layer.
   **3D engine:** no items and no search. Each scene is `"html": "scenes/<name>.html"`, a page you write
   ([3d-engine.md](references/3d-engine.md)): `MUScene({ duration, params, setup, draw })`, the film's tokens
   for every colour, `data-ui-id` on the text the user will edit, 2–4 `params` for the effects worth tuning,
   pictures through `images`. Every frame a pure function of `t`. Run `node SKILL/tools/check.mjs <project>`
   after each page, and look at stills (`stills.mjs`) before you show anything.
4. **Missing an item?** Build it in the same style: write `items/<name>.js` in the project following
   [building-items.md](references/building-items.md) (engine API: [engine-api.md](references/engine-api.md)).
   Reuse the library's helpers and theme tokens; never hard-code colours outside the palette. Project
   items load after the library and show as "Built new". Design its controls as you build it: `ui` panels on
   the layers the user will want to change, and `params` for its effects (blur strength, a tilt, a ripple, a
   toggle for an optional part) that `build(H, P)` reads ([building-items.md](references/building-items.md#controls-for-the-user)).

`node SKILL/tools/script.mjs <project> [--artifact]`

- Board: the script card, in the pipeline's Script lane: every scene with its timing, item, transition, copy
  and voice-over. The Scenario gate is approved and the Script gate waits.
- Standalone: `script.html`, or publish `script.artifact.html`.

Every tool prints `! …` lines for unknown items, text ids or missing pictures. Fix them all. Ask the user to
approve the script or change it (re-word, swap an item, reorder, change lengths), and re-run until they do.

### 4. Storyboard: pick a direction

Skip this step only if the brief says `"storyboard": 0` or the user wants it done in one go.
Otherwise write **2–3 variants** of the approved script into `scenario.json` → `storyboard.variants`
([scenario.md](references/scenario.md#storyboard)). Each variant is a genuinely different approach to
the same story. Vary the item picks, the structure and pacing, and the motion preset, not just the
colours: calm product tour vs punchy launch vs mobile-first, for example. Then run:

`node SKILL/tools/storyboard.mjs <project> [--artifact]`

- Board: the storyboard card, in the pipeline's Storyboard lane. Each variant is a row with one frame per
  shot (the shot at its settled moment); hovering plays a shot, and Play variant plays the whole film.
  For the 3D engine each shot is a still taken by the render engine (its variants' scenes are pages too).
  Under the rows, the **GL Motion items** list shows the directions' items, the alternatives per shot
  and the items built new. The user can ask you to swap any of them in.
- Standalone: `storyboard.html`, or publish `storyboard.artifact.html`.

The user picks one, or mixes them ("B, but shot 3 from A"). Apply the pick with
`node SKILL/tools/storyboard.mjs <project> --pick <id>` (for a mix, edit the scenes afterwards). The pick
becomes the scenario's scenes and motion, and approves the Storyboard step; the variants stay for reference.
Re-run `script.mjs` so the script card shows the picked scenes.

`node SKILL/tools/gallery.mjs <project>` (not for the 3D engine) is optional: every scene playing plus the whole item list, for a
user who wants to browse and swap items, or when there is no storyboard and no board.

### 5. Build the preview

`node SKILL/tools/preview.mjs <project>`

- Board: the preview card, in the pipeline's Preview lane. It shows the film with a scene bar, and a right
  panel: **Scenes**, **Elements** and **Design**. It has no Render or Export buttons under a board: once the
  user approves the preview, you render and export (step 7). Its top bar says so.
- Standalone: run `node SKILL/tools/serve.mjs <project>` (in the background) and give the user the URL.
  There, Render and Export write files into the project. `preview.html` also opens as a plain file (the
  buttons then show the commands), and `--artifact` writes a publishable copy.

**The user can edit the film there.** Tell them so in one line when you hand it over:
- **Elements:** a click on anything in the film pauses it and shows your panel for it plus every option it
  has (text, colour, size, weight, case, tracking; fill, corners, picture). While it plays, the tab shows the
  panels for what is on screen and the scene's effects (your `params`).
- **Design:** the theme, background, accent, every colour the film uses and the font.
- **3D engine:** the Elements tab shows the page's `data-ui` elements and the scene's `params`; clicking the
  film doesn't pick an object.
- Each change is saved as `scenario.json → edits` ([scenario.md](references/scenario.md#edits)): on the card
  under a board, into scenario.json with serve.mjs, in the browser for a file or an artifact (the user sends
  it with **Copy for the agent**; paste it into `edits`).

Ask the user to approve the preview or say what to change. When they approve or say they changed things, read
their changes: `node SKILL/tools/edits.mjs <project>` (under a board it pulls them from the card first) and
say in one line what you will keep. Render, export and stills apply them; you change nothing. Two things are
yours to do:
- **A new font** (`edits.film.font`): some items measure their words (pill widths, masks). Look at stills of
  those scenes and re-fit what the font broke.
- **Before you rebuild or reorder scenes**, run `edits.mjs --fold` (their values become the film's own), since
  edits are keyed by scene number. `--clear` drops them when the user asks to start over.

### 6. After approval: the voice-over

Ask whether they want one (skip if they already said). The lines are in the script: long takes over
several scenes ([voiceover.md](references/voiceover.md)), about 2.5 words per second. Show them the lines,
then record:
- Board: `node SKILL/tools/voiceover.mjs <project> --models` → pick a model with the user (they are
  billed per character, so say so), then `--model <id> [--param voice_id=…] --fit`. A take is one
  generation, so it reads as one continuous voice. Recording is resumable, and `--scenes 2,5` records
  those lines or takes again when the user wants a new take or new words.
- Standalone: their own recordings `--files a.mp3,b.mp3,…` (one file per take or line), or a draft voice on
  macOS `--say --fit`.

`--fit` cuts the picture to each take (every scene ends in the pause after its part) and lengthens scenes
that are shorter than their own line. `--place` re-times the recorded clips after you change an `at`, a
take's parts or a scene length. Re-run `preview.mjs` (and `script.mjs` when timings changed) so they can
hear it. Under a board, the Preview gate asks again.

### 6b. Sound design

Sound effects finish the film: key clicks on typing, pops, whooshes on camera moves, a low hit on the big
reveal ([sound.md](references/sound.md)). Ask once whether they want them (default yes for promos).
- `node SKILL/tools/sfx.mjs <project> --auto` cues the film's own events with sounds from the GreenLight
  Dash Sound Library. Under a board it first checks the library and, when it is empty, installs the
  **Motion Design Pack**; standalone it reads the app's library folder or `--sounds <folder>`.
- Then review the cues like a sound designer: cut clutter, add what the data can't show (toggles,
  results landing, a hit under the logo), swap sounds with `--list <role>`, mark your own `keep: true`,
  `--resolve`. Re-run `preview.mjs` to hear them with the voice.

### 7. Render and export

Only after the user approved the preview (with its voice-over and sound).
- Board: mark the step running (`pipeline.mjs <project> --step render --status in_progress`), then
  `node SKILL/tools/render.mjs <project> [--format mp4|webm-alpha|mov] [--motion-blur 4]` and
  `node SKILL/tools/export.mjs <project> --format glea-layers|glea-html|ae` (3D engine: `glea-html` only). The app renders the film
  with the voice-over and sound effects mixed in (effects ducked under the voice, −16 LUFS). The film lands
  in the pipeline's Final film and the pipeline finishes; Render & export lists every render and export.
- Standalone: from the preview's buttons, or the same tools. The files go to `<project>/renders/` and
  `<project>/exports/`. See [export.md](references/export.md).

Report what was made and where (the pipeline, the project name, file paths).

### 8. Under a board: a more advanced gallery (only when it fits)

Ask this only when all three hold: you run **under a board**, the film has **gallery scenes** (items in
the `gallery` or `carousel` category), and the user wants a **Video Editor project** (they exported
GLEA), not only a rendered video. Then ask once whether to replace those scenes with a more advanced
**MotionFast** gallery template from the app: it has styles and options the user tunes in the editor,
and it takes their pictures. If they say yes, do it with the **greenlight-dash** skill (MotionFast
layers: `references/video-motion.md`): pick a template with an image list close to the scene, put its
layer in the created project at that scene's time window with the scene's pictures, and remove the
scene's own layers. Otherwise leave the project as it is.

## Rules

- **Style:** the items share one look — Helvetica Neue (the Video Editor's text font; a film may pick
  another in `font`), the theme palette, one accent. New items and copy stay inside it. Items are transparent; the film's
  `background` (a colour, or `"theme"`) paints behind them.
- **Motion:** films default to `"motion": "spring"`, the calm spring feel of the GreenLight Dash launch
  films. When the user asks for another feel (snappier, smoother, playful, bouncy, elastic), change the
  preset for the film or for one scene, re-run the gallery or preview, and let them compare. New items
  use the spring curves through one easing table at the top of their file ([easing.md](references/easing.md)).
- **Clean intros:** open the film without shockwave rings, ripple distortion or turbulence warps (SVG
  `feTurbulence` + `feDisplacementMap`, noise-displaced titles). The opening is where the viewer reads the
  product's name. A warp smears those letters while they are read, and it looks like a stock template trick,
  not design. Bring the hook in with clean motion: springs on position, scale and opacity, masks, blur to
  sharp, staggered text. After the export, the same holds for Video Editor effects on the opening scene.
- **The user's edits win:** `scenario.json → edits` overrides your values. When they ask for a change to
  something they edited, change it in `edits` (or `--fold` first), never only underneath it.
- **Copy fits:** keep overrides close to the original text length (the registry shows it); a much
  longer line overflows its card. Re-run the gallery and look.
- **Numbers:** counters and timers are `{{{COUNTER:…}}}` / `{{{TIMER:…}}}` placeholders — override the
  whole text with a new token, e.g. `"number": "{{{COUNTER:0-12,400; style=odometer}}}"`
  ([scenario.md](references/scenario.md#numbers)).
- **3D:** layers that turn or sit at a depth are the default engine's 3D space
  ([engine-api.md](references/engine-api.md#3d-space)); they export to the Video Editor and After Effects.
  The 3D engine is for what layers can't be: models, lights, particles.
- **After Effects:** exports are files. Never run a script in the user's open After Effects without
  asking — a modal dialog there blocks their work.
- **Nothing is published** outside their machine or board unless they ask.
