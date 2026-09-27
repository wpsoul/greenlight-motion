// Page assembly for the gallery and the preview: theme tokens per target, inlined scripts, and the
// three targets — 'local' (a file / tools/serve.mjs), 'board' (a GreenLight Dash HTML card: tokens on
// the app's class, nothing on :root or body) and 'artifact' (a claude.ai artifact: no document
// skeleton, light + dark palettes on :root, no downloads).
import fs from 'node:fs';
import path from 'node:path';
import { SKILL_DIR } from './kit.mjs';
import { isUrl, dataUri, mapImages } from './project.mjs';

const DARK = { bg: '#121211', panel: '#1A1A19', line: '#2A2927', txt: '#E9E7E2', sub: '#8F8B84', soft: '#242320', acc: '#33EFAB', 'on-acc': '#0F1115',
  chip: 'rgba(18,18,17,.74)', 'chip-txt': '#E9E7E2', scrim: 'rgba(8,8,7,.74)', warn: '#F5A524', bad: '#FF6369', good: '#33EFAB', field: '#141413' };
const LIGHT = { bg: '#F4F3F0', panel: '#FFFFFF', line: '#E0DDD7', txt: '#161614', sub: '#6B675F', soft: '#ECEAE5', acc: '#2BE0A0', 'on-acc': '#0F1115',
  chip: 'rgba(255,255,255,.86)', 'chip-txt': '#161614', scrim: 'rgba(20,18,14,.5)', warn: '#B26B00', bad: '#C4262E', good: '#0B8F63', field: '#FAF9F7' };
const vars = (t) => Object.entries(t).map(([k, v]) => `--mu-${k}: ${v};`).join(' ');

export function tokens(target, appClass) {
  if (target === 'artifact') {
    return `:root { ${vars(LIGHT)} }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${vars(DARK)} color-scheme: dark; } }
:root[data-theme="dark"] { ${vars(DARK)} color-scheme: dark; }
html, body { height: 100%; }
body { background: var(--mu-bg); color: var(--mu-txt); }`;
  }
  // the app is dark; an HTML card keeps its variables on its own class and styles nothing outside it
  // (the app fills the frame itself: position fixed, inset 0)
  return `.${appClass} { ${vars(DARK)} color-scheme: dark; }`;
}

export const jsonForScript = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16));
// inside an inlined script, "</script" would end the tag, and a document skeleton ("<html", "<body" … in
// html-export's page template) must not look like the page's own: "<" becomes \x3c there — the same
// character in JS strings, templates and regexes
export const inlineScripts = (list) => list.map(([name, text, type]) => `<script data-mu-src="${name}"${type ? ` type="${type}"` : ''}>${String(text)
  .replace(/<\/(script)/gi, '<\\/$1').replace(/<(?=(!doctype|html|head|body)\b)/gi, '\\x3c')}</script>`).join('\n');

/** Fill a template; the artifact target keeps only the marked head + body parts. */
export function build(templateName, { title, target, appClass, scripts, data }) {
  let html = fs.readFileSync(path.join(SKILL_DIR, 'templates', templateName), 'utf8');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // function replacers: script text may contain "$&" and friends
  html = html.replace('@@TITLE@@', () => esc(title)).replace('@@TOKENS@@', () => tokens(target, appClass))
    .replace('@@SCRIPTS@@', () => inlineScripts(scripts)).replace('@@DATA@@', () => jsonForScript(data));
  if (target === 'artifact') {
    const part = (tag) => { const open = `<!--MU:${tag}-->`; const a = html.indexOf(open); const b = html.indexOf(`<!--/MU:${tag}-->`); return html.slice(a + open.length, b); };
    html = part('HEAD').trim() + '\n' + part('BODY').trim() + '\n';
  }
  return html;
}

/** The scenario's pictures for a target: 'artifact' → data URIs (nothing else loads there); otherwise
 *  paths relative to where the page sits (`rel(path)` maps a project path). */
export function picturesFor(project, target, rel = (p) => p) {
  return mapImages(project.scenario, (src) => {
    if (isUrl(src)) return src;
    const f = path.join(project.dir, src);
    if (target === 'artifact' && fs.existsSync(f)) return dataUri(f);
    return rel(src);
  });
}
