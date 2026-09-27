# Contributing to GreenLight Motion

Everything lives in this one folder. `skills/greenlight-motion/lib/` holds the scene runtime (`clock.js`, `scene.js`,
`overrides.js`, `editor.js`, `player.js`) and the library: its engine (`engine.js`, `easings.js`, `film.js`,
`html-export.js`) and every library scene (`elements-*.js`). There is no second copy anywhere. GreenLight Dash's
Video Editor, its lab page and its bundled agent skill all read these same files.

## Library scenes

A library scene is a `UIK.define({ id, name, cat, T, build(H, P) })` in the matching `lib/elements-<category>.js`:
a tree of layers (`rect`, `ellipse`, `text`, `path`, `icon`, `group`, `photo`, `canvas`) whose animated values are
keyframe tracks of `[t0, t1, value, easing]` segments, a pure function of time. The existing files are the reference:
read two or three scenes of the same category before you write one, and keep to their look (the theme's colours by
name, Helvetica Neue, one accent) and their motion (the spring curves, one easing table at the top of the file).

1. Add the scene with `UIK.define({ … })`.
   - **A new file** goes into `K.FILES` in `lib/catalog.js`, since everything loads exactly that list. In the
     GreenLight Dash repo, also add its `<script>` tag to `html/ui-motion-kit-lab.html`.
   - **A new category** needs a `key: 'Label'` entry in `K.CATS` in `catalog.js`. Galleries follow that order, then
     the order scenes are defined in.
   - Give every text a film may re-word an `id`, and every picture slot an `id` (or a shared `src`).
2. Rebuild the registry. Agents search this file, so it must match `lib/`:
   `node skills/greenlight-motion/tools/registry.mjs`
3. Look at the scene and run the checks (any folder works as `<dir>`):
   ```
   node skills/greenlight-motion/tools/stills.mjs <dir> --item <id> --n 6
   node skills/greenlight-motion/tools/stills.mjs <dir> --item <id> --t 1.2,1.5,2 --w 960
   node skills/greenlight-motion/tools/stills.mjs <dir> --item <id> --n 4 --theme dark
   node skills/greenlight-motion/tools/check.mjs  <dir> --item <id>
   ```
4. **The engine is shared by every scene.** Change it only in backward-compatible ways, and run
   `check.mjs <dir> --all` afterwards: it builds every scene.

## The scene runtime

Scene pages ([references/scenes.md](skills/greenlight-motion/references/scenes.md)) get `clock.js` (the page clock),
`overrides.js` (the user's edits), `scene.js` (the film's colours, pictures, `GLScene`) and, in the preview only,
`editor.js` (the element picker). `player.js` plays a film's scene pages on one timeline and makes the film page
renders record. `runtime/motion.js` builds every page from the scenario; `tools/project.mjs` loads a project and
checks it. A change here reaches every film: run the gates below.

### In the GreenLight Dash repo

This folder is `plugins/greenlight-motion` there. The repo's own gates cover what a browser or the app is needed for:

- `tests/greenlight-motion/`: `verify_scenes.mjs` (the scene runtime, the player, exports), `verify_edits.mjs`
  (editing in the preview), `verify_board.mjs` (the skill end to end on a board), `verify_standalone.mjs` (from a copy
  of this folder, outside the repo).
- `tests/ui-motion-kit-lab/`: contact sheets, frame bounds and text fit for the library, and the Presets-tab gate
  `verify_presets_panel.mjs`.

The app picks up a change with its next frontend build. The desktop build copies `skills/greenlight-motion` into the
app, where the agent terminal's **GL Motion Film** preset points.

## Releasing a version

1. Bump `version` in `.claude-plugin/plugin.json` and in both places in
   `.claude-plugin/marketplace.json`. Claude Code uses the version to notice an update.
2. `claude plugin validate --strict .`
3. Publish this folder as the root of [wpsoul/greenlight-motion](https://github.com/wpsoul/greenlight-motion).
   The source of truth is `plugins/greenlight-motion` in the GreenLight Dash repo: copy it into a clone of
   the public repository, then commit, tag and release there (for example v1.2.0):
   ```
   git clone https://github.com/wpsoul/greenlight-motion ../greenlight-motion-public
   rsync -a --delete --exclude .git --exclude .DS_Store plugins/greenlight-motion/ ../greenlight-motion-public/
   cd ../greenlight-motion-public
   git add -A && git commit -m "v1.2.0: <what changed>" && git tag v1.2.0 && git push --follow-tags
   gh release create v1.2.0 --title "v1.2.0" --notes "<what changed>"
   ```
4. Users update with `claude plugin marketplace update greenlight-motion` and
   `claude plugin update greenlight-motion@greenlight-motion`.
