#!/usr/bin/env node
// Tests for scripts/pitch-check.mjs and scripts/audit-site.mjs. Run: node scripts/test-pitch.mjs
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http'; import { spawn, spawnSync } from 'node:child_process';
import { pitchGate } from './pitch-check.mjs';
const here = path.dirname(new URL(import.meta.url).pathname); let pass = 0, fail = 0;
const t = (n, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  (got ${JSON.stringify(got)?.slice(0, 160)}, want ${JSON.stringify(want)})`); };
const R = fs.mkdtempSync(path.join(os.tmpdir(), 'pitch-')); const P = (f) => path.join(R, f);
const png = Buffer.alloc(6000); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png); png.writeUInt32BE(1200, 16); png.writeUInt32BE(800, 20);
const setup = (o = {}) => {
  fs.rmSync(R, { recursive: true, force: true }); fs.mkdirSync(P('docs/pitch/countries'), { recursive: true }); fs.mkdirSync(P('docs/pitch/flor'), { recursive: true }); fs.mkdirSync(P('research'), { recursive: true });
  fs.copyFileSync(path.join(here, '../docs/pitch/BANNED-CLAIMS.md'), P('docs/pitch/BANNED-CLAIMS.md')); fs.copyFileSync(path.join(here, '../docs/pitch/countries/ecuador.md'), P('docs/pitch/countries/ecuador.md'));
  fs.writeFileSync(P('research/linktree.png'), png); fs.writeFileSync(P('research/page.png'), png); fs.writeFileSync(P('research/grader.png'), png); fs.writeFileSync(P('research/search.png'), png);
  const find = [`- F1 | weakness | 3 | Best work, the catalog, is reached through Linktree, then Drive, then a PDF | research/linktree.png`, `- F2 | strength | ${o.strengthSev || 2} | Professional photo shoot and clear prices in the catalog | research/page.png`, `- F3 | weakness | 2 | No website of its own, only a link page | https://linktr.ee/azuay.floristeria`];
  fs.writeFileSync(P('docs/pitch/flor/CASE.md'), `Country: Ecuador\n${o.owner ? 'Owner name: Marta | research/page.png\n' : ''}\n## Findings\n${find.join('\n')}\n\n## Cost\n- F1 | A customer who wants flowers must pass three screens before seeing the best work, and many stop.\n${o.noCost3 ? '' : '- F3 | Searching for the shop shows no site of theirs, so people who search find others first.\n'}\n## Proof\nGrader: https://pagespeed.web.dev/analysis?url=x | search readiness 62/100 | screenshot: research/grader.png\nSearch results: flower shop Cuenca | screenshot: research/search.png\n${o.demand || 'Demand: 410 searches per month | source: Google Keyword Planner, Ecuador, May'}\n`);
  const m1 = o.m1 || ['- Good morning. | intro', '- Your catalog photos are professional and the prices are clear. | compliment F2', '- Your best work is three screens deep: Linktree, then Drive, then a PDF. | F1', '- Many customers never reach it. | cost F1', '- Could we send an example? | ask'];
  fs.writeFileSync(P('docs/pitch/flor/MESSAGES.md'), `## Message 1\n${m1.join('\n')}\n## Message 2\n${o.m2 === undefined ? '- You have no website of your own, only a link page. | F3\n- Here is our example: https://example.com/flor | ask' : o.m2}\n`);
};
setup(); t('pitch gate: complete case and messages -> passes', pitchGate(R, 'flor'), null);
setup({ noCost3: true }); t('pitch gate: weakness with no cost line -> refused', /Cost/.test(pitchGate(R, 'flor') || ''), true);
setup({ strengthSev: 1 }); t('pitch gate: compliment on a weak strength -> refused', /compliment/.test(pitchGate(R, 'flor') || ''), true);
setup({ m1: ['- Good morning. | intro', '- See https://example.com/flor | F1', '- Many never arrive. | cost F1'] }); t('pitch gate: link in the first message -> refused', /first message contains a link/.test(pitchGate(R, 'flor') || ''), true);
setup({ m1: ['- Good morning. | intro', '- Your best work is three screens deep. | F1', '- This will guarantee more customers. | F1'] }); t('pitch gate: banned claim -> refused', /banned claim/.test(pitchGate(R, 'flor') || ''), true);
setup({ m1: ['- Hola Marta | intro', '- Your best work is three screens deep. | F1', '- Many never arrive. | cost F1'] }); t('pitch gate: greets by an unsourced name -> refused', /Never guess a name/.test(pitchGate(R, 'flor') || ''), true);
setup({ owner: true, m1: ['- Hola Marta | intro', '- Your best work is three screens deep. | F1', '- Many never arrive. | cost F1', '- May we send an example? | ask'] }); t('pitch gate: greets by a sourced name -> allowed', /name/.test(pitchGate(R, 'flor') || ''), false);
setup({ m2: '- Here is our example. | ask' }); t('pitch gate: a serious weakness named in no message -> refused', /in no message/.test(pitchGate(R, 'flor') || ''), true);
setup({ m1: ['- Good morning. | intro', '- Your best work is three screens deep. F1'] }); t('pitch gate: untagged sentence -> refused', /untagged/.test(pitchGate(R, 'flor') || ''), true);
setup({ demand: 'Demand: about 400 | source: n' }); t('pitch gate: demand with no real source -> refused', /Demand/.test(pitchGate(R, 'flor') || ''), true);
setup({ demand: 'Demand: unavailable: the keyword service refused the request' }); t('pitch gate: demand honestly unavailable -> allowed', /Demand/.test(pitchGate(R, 'flor') || ''), false);
setup(); fs.rmSync(P('docs/pitch/countries/ecuador.md')); t('pitch gate: no country profile -> refused', /country profile/.test(pitchGate(R, 'flor') || ''), true);
setup(); t('pitch check command: proven exits 0', spawnSync('node', [path.join(here, 'pitch-check.mjs'), R, 'flor']).status, 0);
setup({ noCost3: true }); t('pitch check command: refused exits 1', spawnSync('node', [path.join(here, 'pitch-check.mjs'), R, 'flor']).status, 1);
// audit-site against a stand-in Google service
const srv = http.createServer((req, res) => { res.setHeader('content-type', 'application/json'); if (/url=quota/.test(req.url)) { res.statusCode = 429; res.end(JSON.stringify({ error: { message: 'Quota exceeded' } })); return; } res.end(JSON.stringify({ lighthouseResult: { categories: { seo: { score: 0.62 }, accessibility: { score: 0.8 }, 'best-practices': { score: 0.9 }, performance: { score: 0.3 } } } })); });
await new Promise((r) => srv.listen(0, r)); const port = srv.address().port; const out = P('audit');
const run = (u, env = {}) => new Promise((res) => { const p = spawn('node', [path.join(here, 'audit-site.mjs'), u, out], { env: { ...process.env, PAGESPEED_API: `http://127.0.0.1:${port}/x`, ...env } }); let stdout = ''; p.stdout.on('data', (d) => { stdout += d; }); p.on('close', (status) => res({ status, stdout })); });
const ok = await run('https://example.com'); t('audit: good answer saves scores and a report link', [ok.status, JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8')).scores.seo, /pagespeed\.web\.dev/.test(fs.readFileSync(path.join(out, 'summary.json'), 'utf8'))], [0, 62, true]);
const q = await run('quota'); t('audit: quota answer is refused and says to use a key', [q.status, /free key/.test(q.stdout)], [1, true]);
srv.close(); fs.rmSync(R, { recursive: true, force: true });
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
