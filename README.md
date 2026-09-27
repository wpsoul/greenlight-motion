# GreenLight Motion

**GL Motion** for short: the motion design studio for agents. It turns a brief into a finished motion film.
By [WPSoul](https://greenlightdash.pro), the makers of [GreenLight Dash](https://greenlightdash.pro).

- **Every scene is a web page.** The agent writes each scene as HTML, CSS, SVG, canvas or three.js and animates it
  any way a web page can: CSS keyframes, the Web Animations API, `requestAnimationFrame`, timers, video. A page clock
  makes every frame exact, so the preview scrubs it and the render records it frame by frame. Kinetic type, shape
  systems, generative patterns, real 3D with lights and bloom: if a browser can draw it, the film can have it.
- **275 ready-made library scenes** in one clean interface style: buttons, toggles, forms, cards, charts, dashboards,
  checkouts, coupons, countdowns, notifications, chats, AI prompts, galleries, carousels and titles, re-worded and
  re-pictured with your copy. Use them for a quick UI film, or mix them with new scenes.
- **Story, art direction, storyboard.** The agent asks what you want and what assets you have, writes the story and
  (for brand-new films) the concept and art direction, then shows 2–3 directions as a storyboard of stills with every
  line of copy under them.
- **A preview you edit like a design tool.** Click anything in the film to change its words, colour, size, weight,
  picture or position; drag it; double-click words to type over them. The agent's panels for what matters, the
  scenes' effects, and the film's colours and font sit beside it, with undo and a list of your changes. Your changes
  go into the render and every export.
- **Voice-over.** Your own recordings, a quick macOS draft voice, or (inside GreenLight Dash) the board's
  text-to-speech models. Long, continuous takes, placed on their scenes and mixed into the render.
- **Sound effects.** Key clicks, pops, whooshes, a hit under the big reveal, from the GreenLight Dash Sound Library
  (inside the app it installs the Motion Design Pack when the library is empty), or from any folder of sounds. Mixed
  under the voice-over.
- **A frame-exact HTML render engine** (`skills/greenlight-motion/render/render.py`) with a virtual clock, parallel
  recording and motion blur. It writes MP4, WebM with alpha and ProRes 4444, tagged BT.709.
- **Exports.** A GreenLight Dash Video Editor project (GLEA): every scene an HTML clip that looks exactly like the
  preview, with the voice-over and sound effects on their own tracks. And an **After Effects package**: the scene
  pages, reference stills and a prompt, for an agent that rebuilds the film in After Effects as native comps, shape
  and text layers and keyframes (After Effects must be installed and open).

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

Without Python and ffmpeg the agent still writes the scenario and the storyboard's words, builds the preview
and makes the GLEA export. The website capture reads the page's text but takes no screenshots, the storyboard
and the After Effects package have no stills, and there's no rendered video.

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
the product, the film, the look (brand-new or the library, with the whole library playing to pick from), the motion
and what to deliver.

```
node skills/greenlight-motion/tools/brief.mjs my-film
```

Open the URL it prints. The last button saves `my-film/brief.json` and copies a prompt with the paths to
the skill, the brief and the project. Paste it into Claude Code, Codex, Gemini or any agent that reads
skills. The agent asks only what the brief leaves open.

Or just ask for a film, for example: *"Make a 15-second promo for our spring sale. The code is SPRING50, it
ends May 3, and here are two product photos."* That is **quick mode**: the agent decides everything itself,
builds the film and shows it in the preview, where you edit anything and approve the render. It asks nothing
first unless it doesn't know what the film is about.

Say "step by step" (or pick it in the brief) for the **guided** way, where you approve each stage. The agent
follows `skills/greenlight-motion/SKILL.md`:

1. It asks questions, or reads your brief.
2. It writes the **scenario**: the story in words (a logline and the beats). For brand-new motion graphics
   it also writes the art direction: the concept, the look, the type and the motion language. You approve it.
3. It shows a **storyboard** with 2–3 directions: one still per shot, with every line of its copy and its
   part of the voice-over under it. You pick one and correct the words.
4. It builds the **preview**: the player page, with working Render and Export buttons when it runs locally.
   You click anything to change it, or change the film's colours and font, and approve it. The agent reads your
   changes (`tools/edits.mjs`) and renders with them.
5. It records the voice-over in long, continuous takes, and adds sound effects if you want them.
6. It renders and exports.

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
  lib/                 the scene runtime (page clock, scene kit, edits, the preview's element picker, the player),
                       the library (its engine and 275 scenes, the HTML export) and three.js (lib/vendor)
  registry.json        every library scene: words you can re-word, picture slots, length (built from lib/)
  tools/               brief page, site capture, storyboard, gallery, preview, local server, render, export,
                       your edits, voice-over, sound effects, checks, and doctor (what this machine can do)
  runtime/ templates/  the pages' shared code and markup
  render/              the render engine
  scripts/ae/          the safe After Effects script runner (for the After Effects package)
  references/          scene pages, scenario format, art direction, easing, board mode, exports, After Effects,
                       render, voice-over, sound
```

To add scenes to the library or release a new version, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT © [WPSoul](https://greenlightdash.pro). The icons are Lucide paths (ISC). three.js is MIT
(`skills/greenlight-motion/lib/vendor/LICENSE-three.txt`). See [LICENSE](LICENSE).
