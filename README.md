# GreenLight Motion

**GL Motion** for short: the motion design engine for agents. It turns a brief into a finished motion film
made of animated UI elements, new motion graphics in the same style, or real 3D scenes.
By [WPSoul](https://greenlightdash.pro), the makers of [GreenLight Dash](https://greenlightdash.pro).

- **267 GL Motion items** in one clean style: buttons, toggles, forms, cards, charts, dashboards,
  checkouts, coupons, countdowns, notifications, chats, AI prompts, galleries, carousels and titles.
  A searchable registry lists every item, and a guide shows the agent how to build new ones in the
  same style.
- **Scenario, gallery, preview.** The agent asks what you want and what assets you have, plans the
  scenes, and shows every scene playing with your copy for you to approve. Then it builds a player
  preview with Render and Export buttons, where you edit the film yourself: click anything in it to change
  its text, colours and size, use the controls the agent designed for this film (its effects too), or
  change the design tokens and the font. Your changes go into the render and every export.
- **Voice-over.** Your own recordings, a quick macOS draft voice, or (inside GreenLight Dash) the
  board's text-to-speech models. Each line is placed on its scene and mixed into the render.
- **Sound effects.** Key clicks on typing, pops, whooshes on camera moves, a hit under the big reveal —
  cued on the film's own events from the GreenLight Dash Sound Library (inside the app it installs the Motion
  Design Pack when the library is empty), or from any folder of sounds. Mixed under the voice-over.
- **A frame-exact HTML render engine** (`skills/greenlight-motion/render/render.py`) with a virtual clock,
  parallel recording and motion blur. It writes MP4, WebM with alpha and ProRes 4444, tagged BT.709.
- **Two engines, one per film.** The default builds every scene from layers, with 3D space: cards that
  turn, depth, a camera that tilts and moves in. The **3D engine** is for real 3D (objects, lights, glow,
  particles): each scene is an HTML page drawn with three.js on WebGL, and you tune the text and the
  effects the agent exposes in the preview.
- **Exports.** GreenLight Dash Video Editor projects (every layer editable, or one HTML clip per
  scene) and After Effects scripts that build the comp from native layers, 3D layers and a camera
  included. A 3D-engine film exports one HTML clip per scene to the Video Editor, and has no After
  Effects export.

## Install

**Claude Code.** This repository is both the plugin and its own marketplace:

```
/plugin marketplace add wpsoul/greenlight-motion
/plugin install greenlight-motion@greenlight-motion
```

To try a local copy without installing it: `git clone https://github.com/wpsoul/greenlight-motion`, then
`claude --plugin-dir greenlight-motion`.

**Any agent that reads Agent Skills.** Copy `skills/greenlight-motion` into the agent's skills folder
(Claude Code: `~/.claude/skills/greenlight-motion`), or tell the agent "use the skill at
`<path>/skills/greenlight-motion/SKILL.md`".

**GreenLight Dash** ships this skill. Open an agent terminal and choose **Presets ▸ GL Motion Film**,
or just ask the agent for a film.

## Requirements

**Inside GreenLight Dash you need nothing else.** The app captures websites, takes the review stills and
renders with its own browser and ffmpeg.

**On its own**, the skill uses:

| | What it's for | Get it |
|---|---|---|
| **Node.js 18+** | every tool (there's nothing to `npm install`) | [nodejs.org](https://nodejs.org/en/download) |
| **Python 3.9+ with Playwright** | website screenshots, review stills, rendering | [python.org](https://www.python.org/downloads/) · [Playwright for Python](https://playwright.dev/python/docs/intro) |
| **ffmpeg** (with ffprobe) | rendering, mixing the voice-over and sound effects, review sheets | [ffmpeg.org](https://ffmpeg.org/download.html) |

Without Python and ffmpeg the agent still writes the scenario and shows the gallery, the storyboard and
the preview. It also exports Video Editor and After Effects projects. The website capture reads the page's
text but takes no screenshots, and there's no rendered video.

**Check your machine:** `node skills/greenlight-motion/tools/doctor.mjs` lists what works and prints the
exact install commands for what's missing, with the right paths for your install. The agent runs it too.

### macOS

1. Install [Homebrew](https://brew.sh) if you don't have it.
2. `brew install node python ffmpeg`
3. Give the render engine its own Python with Playwright:
   ```
   python3 -m venv ~/.greenlight-motion/venv
   ~/.greenlight-motion/venv/bin/pip install -r skills/greenlight-motion/render/requirements.txt
   ~/.greenlight-motion/venv/bin/python -m playwright install chromium
   ```

### Windows (PowerShell)

1. Install the three with [winget](https://learn.microsoft.com/windows/package-manager/winget/), or with
   the installers from [nodejs.org](https://nodejs.org/en/download), [python.org](https://www.python.org/downloads/windows/)
   (tick "Add python.exe to PATH") and [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) (add its `bin` folder to PATH):
   ```
   winget install OpenJS.NodeJS.LTS
   winget install Python.Python.3.12
   winget install Gyan.FFmpeg
   ```
2. Open a new terminal, then give the render engine its own Python with Playwright:
   ```
   py -m venv "$HOME\.greenlight-motion\venv"
   & "$HOME\.greenlight-motion\venv\Scripts\pip.exe" install -r skills\greenlight-motion\render\requirements.txt
   & "$HOME\.greenlight-motion\venv\Scripts\python.exe" -m playwright install chromium
   ```

### Linux (Debian, Ubuntu)

1. Node.js 18+ from [nodejs.org](https://nodejs.org/en/download) (older distributions ship an older one),
   then `sudo apt install python3 python3-venv ffmpeg`.
2. Give the render engine its own Python with Playwright:
   ```
   python3 -m venv ~/.greenlight-motion/venv
   ~/.greenlight-motion/venv/bin/pip install -r skills/greenlight-motion/render/requirements.txt
   ~/.greenlight-motion/venv/bin/python -m playwright install --with-deps chromium
   ```

The tools find `~/.greenlight-motion/venv` by themselves. Any other Python with Playwright works too: set
`GL_MOTION_PYTHON=/path/to/python`. An installed Chrome or Edge can stand in for `playwright install chromium`.

## Use

**Start from the brief page (optional).** Answer the questions on a visual page instead of in chat:
the product, the film, the look (the engine, and the whole library playing to pick from), the motion and what to deliver.

```
node skills/greenlight-motion/tools/brief.mjs my-film
```

Open the URL it prints. The last button saves `my-film/brief.json` and copies a prompt with the paths to
the skill, the brief and the project. Paste it into Claude Code, Codex, Gemini or any agent that reads
skills. The agent asks only what the brief leaves open.

Or just ask for a film, for example: *"Make a 15-second promo for our spring sale. The code is SPRING50, it
ends May 3, and here are two product photos."* The agent follows `skills/greenlight-motion/SKILL.md`:

1. It asks questions, or reads your brief.
2. It writes the **scenario**: the story in words (a logline and the beats). You approve it.
3. It writes the **script**: an item per scene, every line of copy, the voice-over and the timing. You
   approve it.
4. It shows a **storyboard** with 2–3 directions, one frame per shot, and the items they use. You pick one.
5. It builds the **preview**: the player page, with working Render and Export buttons when it runs locally.
   You edit what you like there (Elements, Design) and approve it. The agent reads your changes
   (`tools/edits.mjs`) and renders with them.
6. It records the voice-over in long, continuous takes, and adds sound effects if you want them.
7. It renders and exports.

Inside GreenLight Dash the film becomes a **pipeline** on the current board. The steps run in a row, each
approval is a gate, and every card sits at full size in a review lane below. The agent renders and exports
after you approve the preview; the film lands in the pipeline's Final film, and exports become Video Editor
projects.

## Updating

Claude Code:

```
claude plugin marketplace update greenlight-motion
claude plugin update greenlight-motion@greenlight-motion
```

Restart Claude Code afterwards. If you copied the skill folder instead, copy the new version over it.

## What's inside

```
.claude-plugin/        plugin + marketplace manifests
skills/greenlight-motion/
  SKILL.md             the workflow the agent follows
  lib/                 the library: engine, items, converters (Video Editor, After Effects, HTML),
                       the 3D engine's scene runtime, and three.js (lib/vendor)
  registry.json        every item: texts you can re-word, photo slots, length (built from lib/)
  tools/               brief page, site capture, gallery, storyboard, preview, local server, render, export,
                       your edits, voice-over, sound effects, checks, and doctor (what this machine can do)
  runtime/ templates/  the pages' shared code and markup
  render/              the render engine
  references/          scenario format, board mode, exports, render, voice-over, sound, building items,
                       the 3D engine
```

To add items to the library or release a new version, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT © [WPSoul](https://greenlightdash.pro). The icons are Lucide paths (ISC). three.js is MIT
(`skills/greenlight-motion/lib/vendor/LICENSE-three.txt`). See [LICENSE](LICENSE).
