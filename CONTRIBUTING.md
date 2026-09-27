# Contributing to GreenLight Motion

Everything lives in this one folder. `skills/greenlight-motion/lib/` is the library itself: the engine and
every item. There is no second copy anywhere. GreenLight Dash's Video Editor, its lab page and its
bundled agent skill all read these same files.

## Adding or changing items

1. Read [skills/greenlight-motion/references/building-items.md](skills/greenlight-motion/references/building-items.md).
   It covers the item spec, the style and motion rules, recipes and traps. The full API is in
   [engine-api.md](skills/greenlight-motion/references/engine-api.md).
2. Add the item to the matching `lib/elements-<category>.js` with `UIK.define({ … })`.
   - **A new file** goes into `K.FILES` in `lib/catalog.js`, since everything loads exactly that list.
     In the GreenLight Dash repo, also add its `<script>` tag to `html/ui-motion-kit-lab.html`.
   - **A new category** needs a `key: 'Label'` entry in `K.CATS` in `catalog.js`. Galleries follow
     that order, then the order items are defined in.
3. Rebuild the registry. Agents search this file, so it must match `lib/`:
   `node skills/greenlight-motion/tools/registry.mjs`
4. Look at the item and run the checks (any folder works as `<dir>`):
   ```
   node skills/greenlight-motion/tools/stills.mjs <dir> --item <id> --n 6
   node skills/greenlight-motion/tools/stills.mjs <dir> --item <id> --t 1.2,1.5,2 --w 960
   node skills/greenlight-motion/tools/stills.mjs <dir> --item <id> --n 4 --theme dark
   node skills/greenlight-motion/tools/check.mjs  <dir> --item <id>
   ```
5. **The engine is shared by every item.** Change it only in backward-compatible ways, and run
   `check.mjs <dir> --all` afterwards. It builds every item and converts it to the Video Editor and
   After Effects formats.

### Items drawn in code

A gallery or effect that is easier to draw than to build from layers can be one `canvas` layer with a
`draw(ctx, { width, height, t, images })` function (see `references/engine-api.md` → Canvas layers).
Such an item is plain HTML: it declares `formats: ['html']`, has no parameters (one item is one fixed
look), and takes the scene's pictures as a list. Keep drawing pure: no `Date`, no `Math.random`, no
state between frames.

### In the GreenLight Dash repo

This folder is `plugins/greenlight-motion` there. The repo's own gates cover what a browser or the app is
needed for:

- `tests/ui-motion-kit-lab/`: contact sheets, frame bounds, text fit, and item-vs-editor render
  comparisons (`ve_compare.cjs`, under ~2 % of pixels off is glyph-edge noise). It also has the
  Presets-tab gate `verify_presets_panel.mjs`.
- `tests/greenlight-motion/`: `verify_board.mjs` runs the skill end to end on a board.
  `verify_standalone.mjs` runs it from a copy of this folder, outside the repo.

The app picks up a library change with its next frontend build. The desktop build copies
`skills/greenlight-motion` into the app, where the agent terminal's **GL Motion Film** preset points.

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
