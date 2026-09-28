---
name: greenlight-motion
description: "GreenLight Motion (GL Motion), an agentic motion engine and workflow: turns a brief into a finished animated film. Every scene is an HTML page you write (HTML, CSS, SVG, canvas or three.js, animated any way a web page can be, frame-exact on its page clock) or one of 275 ready-made library scenes re-worded with the user's copy. Plans the story and art direction, shows a storyboard of stills, builds a player preview where the user clicks any element to change its words, colours, size, picture and position, adds a voice-over and sound effects, renders MP4 / WebM alpha / ProRes with its own HTML render engine, and exports to the GreenLight Dash Video Editor (HTML clips) or an After Effects package an agent builds natively. Use for a product promo, explainer, launch teaser, app demo, social clip, sale video, kinetic typography, a 3D product shot or any motion graphics film, or when the user mentions GreenLight Motion, GL Motion or this skill's path."
---

# GreenLight Motion (GL Motion)

You turn a brief into a finished motion film. Everything runs from this skill's folder (the directory holding this
file — call it `SKILL`): `node SKILL/tools/<tool>.mjs`. Needs Node 18+. Under a GreenLight Dash board nothing else:
the app captures websites, takes stills and renders with its own browser and ffmpeg. Standalone, capture screenshots,
stills and renders need Python 3 + Playwright and ffmpeg: run `node SKILL/tools/doctor.mjs` once before the first of
them. It says what works and prints the install commands for the rest. **Never search the disk for a Python, a browser
or ffmpeg, and never install them yourself.** If doctor lists something missing, tell the user what it is for and show
its commands; everything else (scenario, storyboard words, preview, exports) works without them.

**Work as an exceptional motion designer.** Treat every film as the piece that goes into your portfolio when you apply
for a senior motion designer job: a hiring director will watch it frame by frame. Every beat has a reason, every move
has the right easing and timing, and spacing and type are exact. Nothing is left at a default just because it was
easier. Look at your stills and previews the way that director would, and fix what they would notice before you show
anything.

## The film

A film is a **project folder** with a `scenario.json` ([scenario.md](references/scenario.md)): its scenes in order,
each one of two kinds, mixed freely:

- **A page you write**: `{ "html": "scenes/hook.html" }`. Any web page: HTML and CSS, SVG, canvas, three.js, web
  fonts, pictures, video, animated with CSS, the Web Animations API, `requestAnimationFrame` or timers. The page clock
  makes every frame exact, so the preview scrubs it and the render records it frame by frame. Everything the page
  needs to know is in [scenes.md](references/scenes.md): the film's colours as CSS variables, pictures, the few rules
  that keep it editable. This is your full toolbox: use it.
- **A library scene**: `{ "item": "coupon-ticket" }`. One of 275 finished animated scenes in one clean interface
  look (`SKILL/registry.json`: id, name, category, length, the words you can re-word, the picture slots), re-worded
  and re-pictured with the user's copy. Fast and consistent, and it looks like a kit: use it when the user wants the
  library, or where a UI moment fits the film.

## Two contexts — the tools detect which

- **Under a GreenLight Dash board** (`GREENLIGHT_API_BASE_URL` is set and the app has a current board): the film is a
  **pipeline** on the board ([board-mode.md](references/board-mode.md) → The pipeline). Its steps run in order (Brief,
  Capture the site, Scenario, Storyboard, Preview, Render & export, Final film), and approval gates stop it for the
  user. Under the steps, a review lane shows every card at full size. The tools fill the pipeline themselves.
  Voice-overs use the board's text-to-speech models, exports create **Video Editor projects**, and the render lands
  in Final film.
- **Standalone** (any agent, any machine): every card is a page. Publish its `*.artifact.html` if you can publish
  artifacts; otherwise open the `.html` in the browser. The preview runs on a local server with working Render and
  Export buttons, and exports are files the user imports into GreenLight Dash (GLEA) or hands to an agent with
  After Effects open.

Pass `--standalone` to force standalone under a board, or `--api <url> --board <id>` to target one.

## The workflow

There are two ways through, set by the brief's `workflow.mode`:

- **Guided** (`guided`, the default with a brief): follow the steps below in order and do not skip the confirmations.
  The user approves three times: the **scenario** (the story, in words), the **storyboard** direction with its words
  (unless the brief skips it) and the **preview**.
- **Quick** (`quick`, or a plain request like "make me a cool video about X" with no brief): straight to the preview,
  which is the one approval. See [Quick mode](#quick-mode-straight-to-the-preview).

Either way, nothing is rendered before the user approves the preview.

### Quick mode: straight to the preview

1. **Ask nothing**, unless you don't know what the film is about (the product, or the message). Decide everything
   else yourself (pages or library, look, motion, length, format, voice-over) and say what you chose in one line.
   Write `brief.json` in the project with `"workflow": { "mode": "quick" }` and your choices
   ([brief.md](references/brief.md)): the tools read it. The pipeline then has no Storyboard step and no Scenario
   gate, and the preview has no Render or Export.
2. **Write the story, the direction and the scenes without stopping** (steps 2 and 3): one direction, straight into
   `scenario.json → scenes`, with the voice-over lines. Under a board, run `story.mjs` so the story sits in the
   pipeline (it opens no gate) and go on.
3. **Review it yourself first.** `check.mjs` clean, stills of every scene, and fix what a hiring director would
   notice. The user sees the film for the first time in the preview, so it must already be good.
4. **Build the preview** (step 4). Standalone, serve it (`serve.mjs`): the user's edits save into the project, and
   the page has no Render or Export. Under a board, the Preview card waits for the approval. Tell the user in one
   line: click anything to change it, then approve it here.
5. **When they approve**: the voice-over if the brief wants one (step 5), then the render (step 6). Export only what
   `output` asks for.

**Under a board, the pipeline is the plan.** Create it right after the brief is read:
`node SKILL/tools/pipeline.mjs <project>`. It reads `brief.json`: it adds a Capture step when there is a website, and a
Storyboard step unless the brief skips it. Before you work on a step, mark it running:
`pipeline.mjs <project> --step <key> --status in_progress` (keys: `capture`, `scenario`, `storyboard`, `preview`,
`render`). Each card tool then puts its card in the step's lane, finishes the step and opens its gate ("Requires
Approval"). Stop there, tell the user the card is in the pipeline, and wait. When they approve, go on: the next tool
marks the gate approved (or run `--approve <key>`). When they want changes, edit and run the tool again. The card
updates in place and the gate stays open. Never run a later step while a gate is still open.

### 1. Ask what to build and what they have

**Start from the brief.** The task may hand you one: GreenLight Dash's **AI Motion Design** action (Video Editor ▸
Smart AI) saves a `brief.json` on the board and names it in your prompt. The project may also already have a
`brief.json`. If so, read it ([brief.md](references/brief.md)) and ask only what it leaves open. Any field set to
`"agent"` is your decision; make it and say what you chose. Standalone with no brief, you can offer the visual
onboarding page instead of chat questions: `node SKILL/tools/brief.mjs <project> --agent`. Run it in the background
and give the user the URL. It writes `<project>/brief.json` when they press Start (the server also prints a
`{"event":"brief"}` line); wait for it, then continue. Always pass `--agent`: without it the page is for someone with
no agent running yet, and ends by copying a prompt for their own agent instead. With `--artifact` it writes a
publishable copy whose last step gives them a prompt with the brief as JSON to paste back to you. Whatever its source,
check a brief with `node SKILL/tools/brief.mjs --check <project>` and ask only about the fields it lists as `open`.

**A website?** If the brief or the user names the product's site, capture it first:
`node SKILL/tools/capture.mjs <project> --url <url>`. That saves desktop and phone screenshots to `assets/`, and the
page's copy, headings, colours and logo to `site.json`. The screenshots go into scenes that show the product; the copy
and colours inform the story and the palette. The user's own pictures (`product.assets`) come before captured ones.
Under a board the app's browser takes the screenshots, and they show at full size in the pipeline's Capture lane.
Standalone it is the render engine (Python + Playwright); with neither, the tool reads the page's HTML alone:
`site.json` has the copy, colours and logo but `"via": "html"` and no screenshots. Then use the user's own pictures,
or ask them for screenshots.

Otherwise (guided mode), one round of questions (use your ask-the-user tool when you have one), only what the brief
leaves open:
- **Brand-new or library?** Always ask this one. The first option is **brand-new motion graphics**: every scene
  designed from scratch for their brand and story, with its own art direction
  ([original-films.md](references/original-films.md)), as pages that can do anything a browser draws. Unique, and
  slower. The second is the **ready-made library**: 275 finished scenes in one clean UI look, re-worded and
  re-pictured with their copy. Fast and consistent. A **mix** works too: library scenes where a UI moment fits, pages
  for the rest.
- **The film**: what it is for (promo, feature demo, sale, launch, social post), the key message, the call to action,
  roughly how long (10–30 s is typical), landscape 1920×1080 or vertical 1080×1920.
- **Assets**: logo, product photos, screenshots, brand colours, the exact copy (names, prices, codes, dates), and
  whether they want a voice-over.
- Light or dark look. The motion feel is `spring` (calm, premium) unless the brief asks for something else:
  energetic, soft, playful, bouncy or elastic ([easing.md](references/easing.md)).

Copy their files into the project's `assets/`. Never invent prices, codes or claims — use theirs, or mark placeholders
clearly in the scenario for them to confirm.

### 2. The scenario: the story, in words

Make the project folder, `greenlight-motion/<film-slug>/` in the working directory (the same under a board: the tools
upload what the board needs). Start `scenario.json` with the film's `name`, `size`, `fps`, `theme`, `accent` and
`motion`. Then, **before any scene, write the story** into `scenario.json → story`
([scenario.md](references/scenario.md#story)):

- a **logline**: one sentence, who it is for and what they get;
- the **beats** in order, grouped into acts when the film has halves or turns (the loop, then the product), each beat
  a title and one sentence of what happens and why it matters. Hook, the product or the feature, proof or detail, the
  offer or the call to action: 3–8 beats.

No pages, no library ids, no timings yet. This is what the film says, not how it looks.

**Pages in the film** (brand-new or mix): read [original-films.md](references/original-films.md) now. Right after the
story, find the concept (three ideas, pick the strongest) and write the art direction into `scenario.json →
direction` (idea, references, look, type, motion, signature), with the real values in `colors`, `accent`,
`background`, `font` and `motion`. The scenario card shows it under the story, so the user approves the concept with
the story.

`node SKILL/tools/story.mjs <project> [--artifact]`

- Board: the scenario card, in the pipeline's Scenario lane. The step waits for the user's approval.
- Standalone: `story.html`, or publish `story.artifact.html`.

Ask the user to approve the story or change it (a beat, the order, the message). Re-run until they approve.

### 3. The storyboard: the shots, in 2–3 directions

Turn the approved story into shots, one per beat, and show them as **2–3 directions** to pick from. This is where the
user reads and approves the words: every shot shows its frame, every line of its copy and its part of the voice-over.

How to write a shot (the same in every direction):

1. **A page** (brand-new, or a mix where no library scene fits): write `scenes/<variant>-<name>.html` for this shot
   ([scenes.md](references/scenes.md)). Follow the direction: its type, its palette through `var(--gl-*)`, its
   signature move. Put the words the user will edit alone in their elements, give the 2–4 things worth changing a
   `data-ui-label`, pictures through `images` (`data-image="key"`), and effects worth tuning as `GLScene` params.
   Plan its first and last frames with its neighbours. Run `node SKILL/tools/check.mjs <project>` after each page.
2. **A library scene** (library, or a mix): find it with `node SKILL/tools/registry.mjs --search "countdown sale"`
   (add `--cat promo`, see the categories in `registry.json`). Read its entry in `registry.json` for its `texts` (ids
   you can re-word), `numbers` (counters) and `images` (the pictures you can fill: use each entry's `key`, which fills
   all of its `copies`). Prefer scenes whose motion tells the beat (a counter for a number, a coupon for a code). For
   product overviews and tutorials, the `showcase` category choreographs the product's own screens: a screen wall,
   a screens tour, a grid spotlight on one feature, feature relay for tutorial steps, device fold for "works
   everywhere". Give it `text` overrides and `images`, and a scene `ui` panel for what the user will want to change
   ([scenario.md](references/scenario.md#controls-for-the-preview)).
3. A shot is a scene in `scenario.json` form: `html` or `item`, `title` (the beat's), `duration`, `transition`
   (`cut` / `fade`), `text`, `images`, and the voice-over when the brief wants one. Write the voice-over as **long
   takes** over several scenes, never one short line per scene
   ([voiceover.md](references/voiceover.md#long-takes-the-default)). For library scenes, add `gallery.alternatives`
   (2–3 others per scene) so the user can swap.
4. Look at every shot before you show it: `node SKILL/tools/stills.mjs <project> --scene <n> --n 8`.

Then write **2–3 variants** into `scenario.json` → `storyboard.variants`
([scenario.md](references/scenario.md#storyboard)). Each variant is a genuinely different approach to the same
story: another concept and signature move for pages (its `note` names the concept; each variant's pages are its own
files), other picks, structure and pacing for library scenes, not just other colours. Then run:

`node SKILL/tools/storyboard.mjs <project> [--artifact]`

- Board: the storyboard card, in the pipeline's Storyboard lane. Each variant is a row with one still per shot (the
  shot at its settled moment, taken by the app) and, under each still, its title, length, every line of its copy and
  its part of the voice-over. Under the rows, the library scenes the directions use and their alternatives. The
  Scenario gate is approved and the Storyboard gate waits.
- Standalone: `storyboard.html` (the stills come from the render engine), or publish `storyboard.artifact.html`.

The tool prints `! variant …` lines for missing pages, unknown library ids, text ids or missing pictures. Fix them
all before you show it. The user picks one, or mixes them ("B, but shot 3 from A"), and corrects words. Apply the pick
with `node SKILL/tools/storyboard.mjs <project> --pick <id>`; for a mix or new words, edit the scenes afterwards
(re-run the storyboard when they want to see the result). The pick becomes the scenario's scenes and motion, and
approves the Storyboard step; the variants stay for reference.

**No storyboard** (the brief says `"storyboard": 0`, or the user wants it done in one go): write the shots straight
into `scenario.json` → `scenes`, as one direction, and go on to the preview. It shows every scene with its copy and
voice-over, and the user approves the words there.

`node SKILL/tools/gallery.mjs <project>` is optional: every scene playing, plus the library scenes and their
alternatives, for a user who wants to browse and swap them.

### 4. Build the preview

`node SKILL/tools/preview.mjs <project>`

- Board: the preview card, in the pipeline's Preview lane: the film with a scene bar and a timeline, and a right
  panel: **Scenes**, **Elements** and **Design**. It has no Render or Export buttons under a board: once the user
  approves the preview, you render and export (step 6). Its top bar says so.
- Standalone: run `node SKILL/tools/serve.mjs <project>` (in the background) and give the user the URL. There, Render
  and Export write files into the project. `preview.html` also opens as a plain file (the buttons then show the
  commands), and `--artifact` writes a publishable copy.

**The user edits the film there.** Tell them so in one line when you hand it over:
- **Click anything** in any scene: the film pauses and the Elements tab shows everything it has (words, colour, size,
  weight, case, tracking; a shape's fill and corners; a picture; move, scale, rotate, hide) and your panel for it.
  **Drag** it to move it; **double-click** words to type over them on the stage. While it plays, the tab shows your
  panels for what is on screen and the scene's effects (params).
- **Design:** the theme, background, accent, every film colour and the font.
- Each change is saved as `scenario.json → edits` ([scenario.md](references/scenario.md#edits)): on the card under a
  board, into scenario.json with serve.mjs, in the browser for a file or an artifact (the user sends it with **Copy
  for the agent**; paste it into `edits`). Undo, redo and a list of changes with a revert for each are in its top bar.

Ask the user to approve the preview or say what to change. When they approve or say they changed things, read their
changes: `node SKILL/tools/edits.mjs <project>` (under a board it pulls them from the card first) and say in one line
what you will keep. Render, export and stills apply them; you change nothing. Two things are yours to do:
- **A new font** (`edits.film.font`): words fitted to the old one may overflow. Look at stills and re-fit what broke.
- **Before you rewrite a page or reorder scenes**, run `edits.mjs --fold` (their values become the film's own), since
  edits are keyed by scene number and element id. `--clear` drops them when the user asks to start over.

### 5. After approval: the voice-over

Ask whether they want one (skip if they already said). The lines are in the scenes, written with the shots (the
storyboard showed them): long takes over several scenes ([voiceover.md](references/voiceover.md)), about 2.5 words per
second. Show them the lines (`voiceover.mjs <project> --lines`), then record:
- Board: `node SKILL/tools/voiceover.mjs <project> --models` → pick a model with the user (they are billed per
  character, so say so), then `--model <id> [--param voice_id=…] --fit`. A take is one generation, so it reads as one
  continuous voice. Recording is resumable, and `--scenes 2,5` records those lines or takes again when the user wants
  a new take or new words.
- Standalone: their own recordings `--files a.mp3,b.mp3,…` (one file per take or line), or a draft voice on macOS
  `--say --fit`.

`--fit` cuts the picture to each take (every scene ends in the pause after its part) and lengthens scenes that are
shorter than their own line. `--place` re-times the recorded clips after you change an `at`, a take's parts or a scene
length. Re-run `preview.mjs` so they can hear it. Under a board, the Preview gate asks again.

### 5b. Sound design

Sound effects finish the film: key clicks on typing, pops, whooshes on big moves, a low hit on the reveal
([sound.md](references/sound.md)). Ask once whether they want them (default yes for promos).
- `node SKILL/tools/sfx.mjs <project> --auto` cues what it can read with sounds from the GreenLight Dash Sound
  Library: the events inside library scenes, and every cut and fade. Under a board it first checks the library and,
  when it is empty, installs the **Motion Design Pack**; standalone it reads the app's library folder or
  `--sounds <folder>`.
- Your pages are your code: cue what happens in them yourself (typing, pops, the big move, the landing), then review
  every cue like a sound designer: cut clutter, add what the data can't show, swap sounds with `--list <role>`, mark
  your own `keep: true`, `--resolve`. Re-run `preview.mjs` to hear them with the voice.

### 6. Render and export

Only after the user approved the preview (with its voice-over and sound).
- Board: mark the step running (`pipeline.mjs <project> --step render --status in_progress`), then
  `node SKILL/tools/render.mjs <project> [--format mp4|webm-alpha|mov] [--motion-blur 4]`, and the exports the brief's
  `output` asks for. The app renders the film with the voice-over and sound effects mixed in (effects ducked under
  the voice, −16 LUFS). The film lands in the pipeline's Final film and the pipeline finishes; Render & export lists
  every render and export.
- Standalone: from the preview's buttons, or the same tools. The files go to `<project>/renders/` and
  `<project>/exports/`.

Exports ([export.md](references/export.md)):
- `export.mjs <project> --format glea`: a GreenLight Dash Video Editor project, every scene an HTML clip that looks
  exactly like the preview, the voice-over and the sound effects on their own channels.
- `export.mjs <project> --format ae`: the **After Effects package** — the scene pages, reference stills, the assets,
  the script runner and `PROMPT.md`, the task for an agent that rebuilds the film in After Effects as native comps,
  shape and text layers and keyframes. **Tell the user that After Effects must be installed and open** for that
  build. Offer to do it yourself: then read `PROMPT.md` and [after-effects.md](references/after-effects.md), and ask
  before you run anything in their After Effects.

Report what was made and where (the pipeline, the project name, file paths).

### 7. Under a board: a more advanced gallery (only when it fits)

Ask this only when all three hold: you run **under a board**, the film has a **library gallery scene** (the `gallery`
or `carousel` category), and the user wants a **Video Editor project** (they exported GLEA), not only a rendered
video. Then ask once whether to replace that scene with a more advanced **MotionFast** gallery template from the app:
it has styles and options the user tunes in the editor, and it takes their pictures. If they say yes, do it with the
**greenlight-dash** skill (MotionFast layers: `references/video-motion.md`): pick a template with an image list close
to the scene, put its layer in the created project at that scene's time window with the scene's pictures, and remove
the scene's HTML clip. Otherwise leave the project as it is.

## Rules

- **The look:** a brand-new film has its own look, set by its direction ([original-films.md](references/original-films.md));
  looking like the library is a failure there, and `check.mjs` flags library scenes in it. A library film keeps the
  library's one look: Helvetica Neue (or the film's `font`), the theme's colours, one accent. Either way the brand
  colours go through the film's colours (`colors`, `accent`, `--gl-*`), so the Design tab changes them everywhere.
  Scenes are transparent; the film's `background` (a colour, or `"theme"`) paints behind them.
- **Motion:** films default to `"motion": "spring"`, the calm spring feel of the GreenLight Dash launch films, for the
  library scenes; a page moves the way its direction says ([easing.md](references/easing.md) has the same curves for
  CSS). When the user asks for another feel, change the preset (for the film or one scene) or the page's easing, and
  let them compare in the preview.
- **Clean intros:** open the film without shockwave rings, ripple distortion or turbulence warps (SVG `feTurbulence`
  + `feDisplacementMap`, noise-displaced titles). The opening is where the viewer reads the product's name. A warp
  smears those letters while they are read, and it looks like a stock template trick, not design. Bring the hook in
  with clean motion: springs on position, scale and opacity, masks, blur to sharp, staggered text.
- **The user's edits win:** `scenario.json → edits` overrides your values. When they ask for a change to something they
  edited, change it in `edits` (or `--fold` first), never only underneath it. Keep the `data-gl` ids in a page you
  change: they are how the edits find their elements.
- **Copy fits:** every word reads inside the frame and its box. A library scene's words stay near their original
  length (the registry shows it). Look at the stills.
- **Numbers:** in a library scene, counters and timers are `{{{COUNTER:…}}}` / `{{{TIMER:…}}}` placeholders — override
  the whole text with a new token ([scenario.md](references/scenario.md#numbers)). In a page, animate a number
  however you like.
- **After Effects:** the package is files. Never run a script in the user's open After Effects without asking — a
  modal dialog there blocks their work.
- **Nothing is published** outside their machine or board unless they ask.
