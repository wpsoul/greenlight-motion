# The brief (`brief.json`)

A brief is the user's answers to step 1, gathered before you start. It comes from GreenLight Dash's
**AI Motion Design** action (Video Editor ▸ Smart AI), from the skill's own onboarding page
(`node SKILL/tools/brief.mjs <project>`), or from you when you write down what the user said in chat.
When a brief exists, read it first and ask only what it leaves open. Any field set to `"agent"`, and any
field left out, is yours to decide. Choose well and say what you chose.

```json
{
  "kind": "greenlight-motion-brief",
  "version": 1,
  "source": "greenlight-dash",
  "product": {
    "name": "Acme Boards",
    "url": "https://acme.example",
    "about": "What it is, who it is for, the key message, features to show, the exact copy to use",
    "assets": [
      { "url": "/media/admin/<board>/screens/dashboard.png", "name": "dashboard.png", "type": "image" }
    ]
  },
  "film": {
    "goal": "promo",
    "cta": "Try it free",
    "duration": 20,
    "format": "16:9",
    "language": "en"
  },
  "look": {
    "source": "library",
    "picks": ["feature-relay", "screen-wall"],
    "theme": "light",
    "accent": "#3E63DD"
  },
  "motion": { "preset": "spring" },
  "workflow": { "mode": "guided", "storyboard": 2, "voiceover": "agent" },
  "output": ["render", "video-editor"]
}
```

| Field | Values | What to do with it |
|---|---|---|
| `product.name` | text | The product's name, exactly as written. |
| `product.url` | URL | Capture it first: `node SKILL/tools/capture.mjs <project> --url <url>` saves screenshots (desktop and phone) to `assets/`, and saves the page's name, description, headings, colours and logo to `site.json`. Use them for copy, accent and showcase screens. |
| `product.about` | text | The brief's substance: the message, audience, features and exact copy. Never invent claims beyond it. |
| `product.assets[]` | `{ url, name, type }` | The user's own pictures and videos. A `/media/…` url is on the board: download it with `$GREENLIGHT_API_BASE_URL<url>` into `assets/`. Prefer these over captured screenshots. |
| `film.goal` | `promo` · `explainer` · `tutorial` · `launch` · `social` · `agent` | Shapes the beats: tutorials need steps (feature relay, zoom through), launches need a hook and a CTA. |
| `film.cta` | text | The last scene's call to action. |
| `film.duration` | seconds (10–90) | The target length. Plan 1 scene per 3–5 s. |
| `film.format` | `16:9` · `9:16` · `1:1` | Sets `size`: 1920×1080 · 1080×1920 · 1080×1080. |
| `film.language` | ISO code | The language of all copy and the voice-over. |
| `look.source` | `library` · `new` · `mix` · `agent` | The SKILL.md step 1 question, answered: ready-made library scenes, brand-new motion graphics (every scene a page you write), or both. With `agent`, choose by the brief: `new` for a brand, a launch or anything that must look like no one else; `library` for a quick, clean UI film. |
| `look.picks[]` | library scene ids | Library scenes the user liked. Use them where they fit a beat, and offer them as alternatives otherwise. |
| `look.theme` | `light` · `dark` · `agent` | `scenario.theme`. |
| `look.accent` | hex · `agent` | `scenario.accent`. With `agent`, take the brand colour from `site.json` or the logo. |
| `motion.preset` | `spring` · `snappy` · `gentle` · `playful` · `elastic` · `agent` | `scenario.motion` ([easing.md](easing.md)). |
| `workflow.mode` | `quick` · `guided` · `agent` | How the film is made. `quick`: straight to the preview. You decide every open answer yourself, write the story and the shots without stopping, and the preview is the one approval (SKILL.md → Quick mode). `guided`: the user approves the story, then a storyboard direction, then the preview. With `agent`, choose `quick` when the request is short and clear, `guided` when there is a lot to get right. |
| `workflow.storyboard` | `0` (skip) · `2` · `3` | The number of storyboard variants to show before the preview (SKILL.md step 3). With `0`, go straight from the approved scenario to the preview. |
| `workflow.voiceover` | `yes` · `no` · `agent` | Whether step 5 records a voice-over. |
| `output[]` | `render` · `video-editor` · `after-effects` | What step 6 delivers: a rendered video, a Video Editor project (GLEA: every scene an HTML clip), and/or an After Effects project built by an agent from the After Effects package (After Effects must be installed and open; [export.md](export.md)). |

Keep the brief in the project folder as `brief.json`. If it came from a board URL, save a copy there.
`node SKILL/tools/brief.mjs --check <file>` validates a brief and prints what it leaves open.
