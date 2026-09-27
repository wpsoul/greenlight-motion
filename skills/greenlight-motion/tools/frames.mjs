// Frames of a page at given moments, as small JPEG data URIs — the storyboard's shots. Under a board the app records
// them (/api/html/stills: nothing is saved on the board); standalone the render engine does (Python + Playwright).
//   import { pageStills } from './frames.mjs';
//   await pageStills({ B, html, width, height, times, dir, python, w: 640 }) → ['data:image/jpeg;base64,…', …]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SKILL_DIR } from './kit.mjs';

export async function pageStills({ B = null, html, width, height, times, dir, python = null, w = 640 }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mu-frames-'));
  try {
    if (B) {
      const res = await B.call('POST', '/api/html/stills', { html, width, height, fps: 60, times }, {}, { timeout: 600000 });
      res.frames.forEach((f, k) => fs.writeFileSync(path.join(tmp, `still-${String(k).padStart(3, '0')}.png`), Buffer.from(f.png, 'base64')));
    } else {
      if (!python) throw new Error('no Python with Playwright: the shots need it outside GreenLight Dash (node tools/doctor.mjs says what to install)');
      // the page sits in the project, so its relative pictures resolve
      const page = path.join(dir, `.frames-${Date.now()}.html`);
      fs.writeFileSync(page, html);
      try {
        const r = spawnSync(python, [path.join(SKILL_DIR, 'render/render.py'), page, '--out', tmp, '--width', String(width), '--height', String(height), '--stills', times.join(',')], { encoding: 'utf8' });
        if (r.status !== 0) throw new Error(r.stderr.slice(-1500));
      } finally { fs.rmSync(page, { force: true }); }
    }
    const pngs = fs.readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
    return pngs.map((f) => {
      const jpg = path.join(tmp, f.replace(/\.png$/, '.jpg'));
      const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(tmp, f), '-vf', `scale=${w}:-2`, '-q:v', '3', jpg], { encoding: 'utf8' });
      if (ff.status !== 0 || !fs.existsSync(jpg)) return `data:image/png;base64,${fs.readFileSync(path.join(tmp, f)).toString('base64')}`;
      return `data:image/jpeg;base64,${fs.readFileSync(jpg).toString('base64')}`;
    });
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
