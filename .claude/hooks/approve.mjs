#!/usr/bin/env node
// UserPromptSubmit: when Shaun types "yes, install X" (or "install: X") in chat, record the approval. The harness runs this only on HIS messages, so Claude cannot forge it.
// scope-guard.mjs reads .claude/approvals.json. Approvals last 24 hours. Fails open (no approval) on any error.
import fs from 'node:fs'; import path from 'node:path';
export function parse(prompt) {
  const p = String(prompt || '').trim(); if (!p || p.length > 300) return [];
  const m = p.match(/^\s*(?:yes|yep|yeah|ok|okay|approved?)\b[\s,.!:-]*install\s+(.+?)\s*[.!]?\s*$/i) || p.match(/^\s*install:\s*(.+?)\s*$/i);
  if (!m) return [];
  return m[1].split(/\s*(?:,|\band\b)\s*/).map((s) => s.replace(/[`"']/g, '').trim().toLowerCase()).filter((s) => s && s.length <= 80).slice(0, 5);
}
export function record(root, names) {
  const f = path.join(root, '.claude/approvals.json'); let cur = []; try { cur = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
  const now = Date.now(); const keep = (Array.isArray(cur) ? cur : []).filter((x) => x && now - Number(x.ts) < 24 * 3600 * 1000);
  for (const n of names) keep.push({ name: n, ts: now });
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(keep));
}
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); const root = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd(); const names = parse(input.prompt);
    if (names.length) { record(root, names); process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: `Shaun approved installing: ${names.join(', ')}. Commands that name these are allowed for 24 hours. Install exactly what he approved, nothing more.` } })); }
  } catch { /* fail open: no approval */ }
}
