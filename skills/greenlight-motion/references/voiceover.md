# Voice-over

Write the lines with the shots (the storyboard shows them, so the user reads them there); record after they
approve the preview. Spoken, about **2.5 words per second**. Show them the lines before recording.

## Long takes: the default

**Record the voice-over in long takes, never one short clip per scene.** A text-to-speech model reads every
request as a complete utterance: it opens fresh and lets the voice fall at the end. Eight scene-sized chunks
therefore sound like eight separate announcements, each one incomplete and the whole thing choppy. One take
over several scenes is one continuous read, with real momentum, emphasis and breath, and that is what a voice
artist would give you.

- Write a take per **act** (a stretch of the story with one thought: the problem, the product, the offer), or
  **one take for the whole film** when it is 30 s or shorter. Split only where a real pause belongs anyway, for
  example before the call to action or after a musical hit.
- Write the take as flowing speech, not as captions: full sentences that lead into each other ("Your users vote
  on what gets built next, and one drag moves it from planned to shipped."), with punctuation that sets the
  rhythm. A comma is a breath and a full stop is a pause. Give the model expression through its own options:
  emotion, speed and pause marks (see the model notes below).
- A take is written on its first scene as its **parts**, one per scene it runs over:

```json
{ "voice": { "take": [
    "Build forums and roadmaps together with your community.",
    "Your users vote on what gets built next,",
    "and one drag moves it from planned to shipped."
] } }
```

  Part k is spoken over scene +k (here scenes 1–3). The scenes inside a take have no `voice` of their own.
  The parts are joined and recorded as ONE generation. `at` on the take moves its start into the scene
  (default `--lead`, 0.25 s).
- **The picture is cut to the voice.** After recording, the tool finds where the parts meet: the pause
  nearest to where the words put each boundary. Record with `--fit`, or run `--place --fit` afterwards, and
  every scene of the take ends in the pause after its part. The last scene keeps at least its length (a held
  end card) plus a beat after the voice. Without `--fit`, the tool says which scenes are out of step.
- Give every part enough words for its scene's animation. If a scene needs 3.5 s to play and its part is
  spoken in 2 s, the cut comes before it settles (`--fit` warns). Add words, or shorten the scene.
- `--lines` shows each take with its parts, their rough spoken length and their scenes' current lengths.

## Short lines (the exception)

A scene's voice can also be one line or a list of lines, each its own recording. Use this only for a
deliberate standalone beat, such as a single word on a hit or a tagline alone on the end card:

```json
{ "voice": "Right in your Video Editor." }
{ "voice": [
    { "text": "Meet the new way to animate interfaces.", "at": 0.1 },
    { "text": "Two hundred sixty-seven animated elements.", "at": 4.9 }
] }
```

`at` puts a line on a second of its scene (the beat it belongs to: a number said while the counter rolls, a
name said as it types). A line without `at` starts `--lead` into the scene (default 0.25 s), or follows the
scene's previous line after a short breath.

```
node SKILL/tools/voiceover.mjs <project> --lines      # lines + scene timing + rough spoken length
```

## Recording

| Where | How |
| --- | --- |
| Board | `--models` lists the board's text-to-speech models, their options and price; then `--model <id> [--param voice_id=Calm_Woman] [--param speed=1.1] [--param format=wav]`. Each line is one generation, **billed by the provider** (usually per character): tell the user which model and roughly what it costs before running. The clips are saved into the film's board folder and into `audio/`. |
| Standalone | The user's own recordings, one file per line (empty = none): `--files vo1.m4a,,vo3.m4a`. On macOS a quick draft: `--say [--voice Samantha]` (the system voice; for timing, not for the final film). |

Recording is **resumable and per line**:
- Every finished line is saved into `scenario.json` at once — a failure later keeps it.
- A re-run records only the lines with no clip yet or whose text changed; the others are kept.
- `--scenes 1,6` records those scenes' lines again, keeping the rest (a take is addressed by its first
  scene). `--force` records all.
- Each request waits `--timeout` seconds (default 120) and is retried `--retries` times (default 2) on no
  answer, a network error or a server error. A request that timed out may still have finished at the
  provider, so a retry can bill that line twice — say so if it happens.
- Clips are named by what they are (a provider may return WAV behind an `.mp3` address). Ask for a
  lossless format (`format=wav`, `sample_rate=44100`) when the model offers it: lossy low-rate voice can
  sound artifacted once mixed.

`--place` places the recorded clips again without recording — after editing a line's `at` or a scene's
length. `--fit` lengthens any scene its lines run past (+0.4 s); without it an overrun is reported.
`--clear` removes the voice-over.

The result is written to `scenario.json → voiceover.clips` (`scene`, `line`, `text`, `file`, `at`,
`start`, `duration`; a take also has `parts`, `through` and `cuts`, where its parts meet in the recording).
Changing only where a take's parts split keeps the recording: `--place --fit` re-cuts the picture. After recording, re-run `preview.mjs` — the preview plays the clips (the bars under
the scene bar), renders mix them in with the sound effects ([sound.md](sound.md)), and the GLEA exports
put them on a Voice channel.

GreenLight Dash's model notes (voices, emotions, pauses): `skills/greenlight-dash/references/ai-generation.md`
→ Voice & audio generation.
