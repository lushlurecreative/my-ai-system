#!/usr/bin/env node
// Keeps the files every session reads small. Moves finished to-do items, old fixed-defect lines and old rulings into archive files (nothing is deleted; the archive is searchable).
// Usage: node ~/my-ai-system/scripts/archive-docs.mjs [project-folder]   (default: current folder)
// A ruling older than 45 days stays in docs/RULINGS.md as one short stub (its first 160 characters, which carry the decision) pointing to the full text in docs/RULINGS-ARCHIVE.md.
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(process.argv[2] || process.cwd()); const doc = (f) => path.join(root, 'docs', f);
const read = (f) => { try { return fs.readFileSync(doc(f), 'utf8'); } catch { return null; } };
const append = (f, text) => { if (!text) return; const p = doc(f); const head = fs.existsSync(p) ? '' : `# ${f.replace('.md', '')} (moved out of the files read at the start of every session)\n\n`; fs.appendFileSync(p, head + text + (text.endsWith('\n') ? '' : '\n')); };
const days = (d) => (Date.now() - Date.parse(d)) / 864e5; const out = [];
// NEXT: finished items. Two shapes: list lines like "1. (DONE ...)" and paragraph entries (separated by blank lines) whose heading says CLOSED, DONE, RESOLVED or COMPLETED.
{ const t = read('NEXT.md'); if (t) {
  const isDone = (b) => !/^#/.test(b.trim()) && /^\s*(?:\d+\.|-)\s*\((?:DONE|done)/.test(b) || /\b(?:CLOSED|DONE|RESOLVED|COMPLETED)\b/.test(b.trim().slice(0, 220));
  const blocks = t.split(/\n\s*\n/); const keep = [], gone = [];
  blocks.forEach((b) => { const lines = b.split('\n'); const done = lines.filter((l) => /^\s*(?:\d+\.|-)\s*\((?:DONE|done)/i.test(l)); if (lines.length > 1 && done.length) { gone.push(done.join('\n')); keep.push(lines.filter((l) => !done.includes(l)).join('\n')); } else (isDone(b) ? gone : keep).push(b); });
  if (gone.length) { fs.writeFileSync(doc('NEXT.md'), keep.filter((b) => b.trim()).join('\n\n') + '\n'); append('NEXT-ARCHIVE.md', gone.join('\n\n')); out.push(`NEXT.md: ${gone.length} finished items archived`); } } }
// FIXED and RULINGS: dated bullet lines older than a cutoff
const dated = (name, cutoff, stub) => { const t = read(name); if (!t) return; const keep = [], gone = []; for (const l of t.split('\n')) { const m = l.match(/^\s*-\s*(\d{4}-\d{2}-\d{2})\b/); if (m && days(m[1]) > cutoff && l.length > (stub ? 200 : 0)) { gone.push(l); keep.push(stub ? `${l.slice(0, 160).trimEnd()}… (full text: docs/${name.replace('.md', '')}-ARCHIVE.md)` : null); } else keep.push(l); }
  const kept = keep.filter((x) => x !== null); if (gone.length) { fs.writeFileSync(doc(name), kept.join('\n')); append(`${name.replace('.md', '')}-ARCHIVE.md`, gone.join('\n')); out.push(`${name}: ${gone.length} old lines archived`); } };
dated('FIXED.md', 30, false); dated('RULINGS.md', 45, true);
// Budget pass: if a file is still over its limit, keep what matters most and move the rest out, so the start-up files really come down.
const LIMIT = { 'NEXT.md': 10000, 'RULINGS.md': 12000, 'FIXED.md': 8000 };
const bytes = (x) => Buffer.byteLength(x);
const blocksOf = (t) => t.split(/\n\s*\n/);
{ // NEXT is in priority order: keep the top entries that fit, move the rest to the archive with one pointer line
  const t = read('NEXT.md'); if (t && bytes(t) > LIMIT['NEXT.md']) {
    const bl = blocksOf(t); const keep = [bl[0]]; let used = bytes(bl[0]); const gone = [];
    for (const b of bl.slice(1)) (used + bytes(b) <= LIMIT['NEXT.md'] - 300 ? (keep.push(b), used += bytes(b)) : gone.push(b));
    if (gone.length) { keep.push(`${gone.length} lower-priority entries are in docs/NEXT-ARCHIVE.md. Read them only when the top of this list is done or Shaun asks.`); fs.writeFileSync(doc('NEXT.md'), keep.join('\n\n') + '\n'); append('NEXT-ARCHIVE.md', gone.join('\n\n')); out.push(`NEXT.md: ${gone.length} lower-priority entries moved to the archive`); }
  } }
{ // RULINGS (newest last): the newest stay in full, older ones shrink to a short stub that keeps the decision's opening words
  const t = read('RULINGS.md'); if (t && bytes(t) > LIMIT['RULINGS.md']) {
    const lines = t.split('\n'); const idx = lines.map((l, i) => (/^\s*-\s*\d{4}-\d{2}-\d{2}/.test(l) && !/full text: docs\/RULINGS-ARCHIVE/.test(l) ? i : -1)).filter((i) => i >= 0);
    let used = bytes(lines.filter((_, i) => !idx.includes(i)).join('\n')); const goneLines = []; const full = new Set();
    for (const i of idx.slice().reverse()) { if (used + bytes(lines[i]) <= 6000) { full.add(i); used += bytes(lines[i]); } }
    const out2 = lines.map((l, i) => { if (!idx.includes(i) || full.has(i)) return l; goneLines.push(l); return `${l.slice(0, 120).trimEnd()}… (full text: docs/RULINGS-ARCHIVE.md)`; });
    if (goneLines.length) { fs.writeFileSync(doc('RULINGS.md'), out2.join('\n')); append('RULINGS-ARCHIVE.md', goneLines.join('\n')); out.push(`RULINGS.md: ${goneLines.length} older rulings shortened to stubs`); }
  } }
{ const t = read('FIXED.md'); if (t && bytes(t) > LIMIT['FIXED.md']) {
    const lines = t.split('\n'); const idx = lines.map((l, i) => (/^\s*-\s*\d{4}-\d{2}-\d{2}/.test(l) ? i : -1)).filter((i) => i >= 0); let used = bytes(lines.filter((_, i) => !idx.includes(i)).join('\n')); const keepI = new Set(); const gone = [];
    for (const i of idx.slice().reverse()) { if (used + bytes(lines[i]) <= LIMIT['FIXED.md'] - 200) { keepI.add(i); used += bytes(lines[i]); } else gone.push(lines[i]); }
    if (gone.length) { fs.writeFileSync(doc('FIXED.md'), lines.filter((_, i) => !idx.includes(i) || keepI.has(i)).join('\n')); append('FIXED-ARCHIVE.md', gone.reverse().join('\n')); out.push(`FIXED.md: ${gone.length} older lines archived`); }
  } }
const size = (f) => { try { return fs.statSync(doc(f)).size; } catch { return 0; } };
console.log((out.length ? out.join('\n') : 'Nothing old enough to archive.') + `\nSizes now: RULINGS ${size('RULINGS.md')} bytes, NEXT ${size('NEXT.md')}, FIXED ${size('FIXED.md')}. Limits: RULINGS ${LIMIT['RULINGS.md']}, NEXT ${LIMIT['NEXT.md']}, FIXED ${LIMIT['FIXED.md']}.`);
