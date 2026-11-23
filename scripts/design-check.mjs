#!/usr/bin/env node
// The design gate for AUTOMATIC production code (a pipeline that makes customer-facing designs without a chat). Hooks cannot watch code, so the code itself must call this and refuse to publish when it fails.
// Usage: node ~/my-ai-system/scripts/design-check.mjs <project-folder> <design-name>      exit 0 = proven, exit 1 = refused (the reason is printed)
// The pipeline writes docs/design/<name>/EVIDENCE.json ITSELF, from what it really did (never from the model's own claims):
//   { "trade": "bakery", "site": "path/to/page-or-folder", "base": "optional link", "rulings": ["2026-10-24 use design tools with a critique loop: how honored"],
//     "skills": ["impeccable", ...],                       design-library skills the run actually invoked
//     "opened": [{ "url": "https://...", "screenshot": "docs/design/<name>/refs/01.png" }],   every reference really opened, with the screenshot the browser took
//     "critics": ["<full text of each design-critic round, in order>"],
//     "edits": [{ "after_round": 1, "file": "page.html" }],  page changes the run made after a critic round (round numbers start at 1)
//     "viewed": ["shots/phone.png", "shots/desktop.png"] }   renders the run opened itself after its last change
// It also needs the same files a chat task needs: REFERENCES.md, CONCEPT.md, CONTENT.md, shots/ (see "Design work" in CLAUDE.md). A listed reference whose screenshot file is missing or tiny does not count as opened.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { designGate, pngSize } from '../.claude/hooks/design-gate.mjs';
const [rootArg, name] = process.argv.slice(2); if (!rootArg || !name) { console.log('usage: node design-check.mjs <project-folder> <design-name>'); process.exit(2); }
const root = path.resolve(rootArg); const dir = path.join(root, 'docs/design', name.replace(/[^\w.-]/g, ''));
const fail = (m) => { console.log(`REFUSED: ${m}`); process.exit(1); };
let ev; try { ev = JSON.parse(fs.readFileSync(path.join(dir, 'EVIDENCE.json'), 'utf8')); } catch { fail(`docs/design/${name}/EVIDENCE.json is missing or unreadable. The pipeline must write it from what it actually did.`); }
const opened = Array.isArray(ev.opened) ? ev.opened : [];
const real = opened.filter((o) => { const f = path.resolve(root, String(o.screenshot || '')); try { return /^https?:\/\//.test(o.url || '') && fs.statSync(f).size > 5000 && (pngSize(f) || { w: 0 }).w >= 600; } catch { return false; } });
if (real.length < opened.length) fail(`${opened.length - real.length} listed reference(s) have no real screenshot on disk (a screenshot of at least 600px width and 5 KB is the proof it was opened).`);
const siteRaw = String(ev.site || ''); if (!siteRaw) fail('EVIDENCE.json has no "site".');
// turn the pipeline's own record into the event stream the chat gate reads, so one gate serves both
const lines = []; let n = 0; const id = () => `e${++n}`;
const use = (name, input) => { const i = id(); lines.push(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: i, name, input }] } })); return i; };
const res = (i, text) => lines.push(JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: i, content: text }] } }));
for (const s of ev.skills || []) res(use('Skill', { skill: String(s) }), 'ok');
for (const o of real) res(use('mcp__pipeline__navigate', { url: o.url }), 'ok');
if (ev.base) res(use('mcp__pipeline__navigate', { url: ev.base }), 'ok');
const sitePath = path.resolve(root, siteRaw); const siteFile = fs.existsSync(sitePath) && fs.statSync(sitePath).isDirectory() ? path.join(sitePath, 'index.html') : sitePath;
use('Write', { file_path: siteFile, content: 'first version' });
const critics = (ev.critics || []).map(String); const edits = ev.edits || [];
critics.forEach((text, i) => {
  res(use('Agent', { subagent_type: 'design-critic', prompt: 'review' }), text);
  for (const e of edits.filter((x) => Number(x.after_round) === i + 1)) use('Edit', { file_path: path.resolve(path.dirname(siteFile), String(e.file || 'index.html')), old_string: 'a', new_string: 'b' });
  if (i === critics.length - 2 || critics.length === 1) for (const v of ev.viewed || []) use('Read', { file_path: path.resolve(dir, String(v).replace(/^shots\//, 'shots/')) });
});
for (const v of ev.viewed || []) use('Read', { file_path: path.resolve(dir, String(v)) });
const tp = path.join(os.tmpdir(), `ais-design-check-${process.pid}.jsonl`); fs.writeFileSync(tp, lines.join('\n') + '\n');
const card = `Design: ${name}\nTrade: ${ev.trade || ''}\nSite: ${siteRaw}\n${ev.base ? `Base: ${ev.base}\n` : ''}\nRulings applied:\n${(ev.rulings || []).map((r) => `- ${r}`).join('\n')}\n`;
let reason; try { reason = designGate(root, tp, { card }); } finally { try { fs.rmSync(tp, { force: true }); } catch { /* ignore */ } }
if (reason) fail(reason);
console.log(`PROVEN: ${name} passed the design gate (${real.length} references opened with screenshots, ${(ev.skills || []).length} skills, ${critics.length} critic rounds).`);
