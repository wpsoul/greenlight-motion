/* GreenLight Motion — the prompt library: ready prompts for a film. The brief's "About it" field offers them as
 * Prompt Presets (the brief page, tools/brief.mjs, and GreenLight Dash's AI Motion Design); an agent or a person can
 * also paste one straight into a chat. A [bracketed part] is for the user to fill in.
 *
 *   window.GLPrompts / require('lib/prompts.js') = [{ id, name, desc, text }, …]
 */
(function (root) {
  const PROMPTS = [
    {
      id: 'motion-design-video',
      name: 'Motion design video',
      desc: 'A dynamic 15-second motion graphics film. The agent studies your product and writes the content itself.',
      text: `Make a dynamic 15-second motion graphics video that shows what an incredible motion designer you are. The content should focus on [add your product and site]. You should visit the pages first to learn about the product, then write the video content yourself.`,
    },
    {
      id: 'explainer-video',
      name: 'Explainer video',
      desc: 'A launch-day product video with Dribbble-level UI motion, driven by a cursor.',
      text: `Make a promo video about [add info], the kind a top startup posts on X on launch day. The bar: someone who has never heard of the feature gets what it does in the first seconds and wants to try it by the end.

Get to know the feature first: what it promises, who it is for, what makes it worth trying. Use its real assets: logo, colours, type, interface. Make the product the star: show it working instead of describing it. Direction, story, pacing and sound are yours; make it look like a motion designer's work, not a template.

Before you call it done, review it scene by scene with a critical eye and polish what is weak.

<inputs>
Use UI elements like on [add some examples]
</inputs>

<direction>
Dribbble-level UI motion. One shape, never cut: every state is the same element morphing its size, radius and color while its content swaps with a short blur. A cursor drives every change with real clicks and drags like we make real app smooth screen record and explainer.
Banned: bouncy easing, particle bursts, glows, gradients on UI chrome, mismatched icon strokes, dead time, anything that looks like a template.
</direction>

<build>
1. Every style is computed from time inside seek(t): no CSS transitions, no timers, no state carried between frames.
2. Springs are closed-form step responses. A value that changes target many times is the sum of one spring per change, so it stays a pure function of time.
3. Drags are direct manipulation: while the cursor is held, the value is computed from its position. On release it springs back from wherever it was.
4. Render one frame per beat before the full render. Fix anything off the grid, cramped or hard to read.
</build>

<gotchas>
Never put will-change on anything the camera scales or the text renders blurry. Text that swaps inside a morphing container needs its own enter and exit timing or it overlaps. Make the last frame identical to the first, cursor position and speed included, or the loop stutters.
</gotchas>`,
    },
  ];

  /** Put a preset into a text field's current value: an empty field (or one still holding a preset as it came)
   *  takes the preset; anything the user wrote is kept, with the preset below it. */
  const apply = (current, preset) => {
    const cur = String(current || '');
    const untouched = !cur.trim() || PROMPTS.some((p) => p.text === cur.trim());
    return untouched ? preset.text : `${cur.replace(/\s+$/, '')}\n\n${preset.text}`;
  };
  /** The first [part to fill in] after `from`, as [start, end] — for selecting it. */
  const blank = (text, from = 0) => {
    const m = /\[[^\]\n]+\]/.exec(String(text).slice(from));
    return m ? [from + m.index, from + m.index + m[0].length] : null;
  };

  const api = { PROMPTS, apply, blank };
  root.GLPrompts = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
