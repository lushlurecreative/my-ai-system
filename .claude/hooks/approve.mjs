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
export function parseAgents(prompt) {
  const p = String(prompt || '').trim(); if (!p || p.length > 300) return [];
  const m = p.match(/^\s*(?:yes|yep|yeah|ok|okay|approved?)\b[\s,.!:-]*add\s+agents?\s+(.+?)\s*[.!]?\s*$/i) || p.match(/^\s*add\s+agents?:\s*(.+?)\s*$/i);
  if (!m) return [];
  return m[1].split(/\s*(?:,|\band\b)\s*/).map((s) => s.replace(/[`"']/g, '').trim().toLowerCase().replace(/\s+/g, '-')).filter((s) => /^[\w-]{1,60}$/.test(s)).slice(0, 5).map((s) => 'agent:' + s);
}
// "go": Shaun says it at the START of his message. Sharing information, a quote or a pasted reply is not a go, so only a leading phrase counts.
const YES = '(?:(?:yes|yep|yeah|ok|okay|sure|alright)\\b[\\s,.!:-]*)';
const GO = [
  new RegExp('^' + YES + '+$', 'i'),
  new RegExp('^' + YES + '?go\\b(?!\\s+(?:to|back|into|through|over)\\b)', 'i'),
  new RegExp('^' + YES + '?(?:just\\s+)?do\\s+(?:it|that|this|all|both|them|everything|whatever)\\b', 'i'),
  new RegExp('^' + YES + '?(?:start|begin|proceed|approved?)\\b', 'i'),
  /^(?:do\s+)?(?:option|item|number|step|choice)\s*#?\d+/i,
  /^#?\d{1,2}[.)!]?$/,
  /^(?:let'?s|please)\s+(?:do|fix|go|start|build|run|finish|continue)\b/i,
  new RegExp('^' + YES + '(?:please\\s+)?(?:do|fix|build|run|finish)\\b', 'i'),
];
export function parseGo(prompt) { const p = String(prompt || '').trim().replace(/^[\s"'`>*\u201c-]+/, ''); return !!p && GO.some((r) => r.test(p)); }
export function record(root, names) {
  const f = path.join(root, '.claude/approvals.json'); let cur = []; try { cur = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
  const now = Date.now(); const keep = (Array.isArray(cur) ? cur : []).filter((x) => x && now - Number(x.ts) < 24 * 3600 * 1000 && !(names.includes('__go__') && x.name === '__go__'));
  for (const n of names) keep.push({ name: n, ts: now });
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(keep));
}
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); const root = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd(); const names = [...parse(input.prompt), ...parseAgents(input.prompt)]; const notes = [];
    if (parseGo(input.prompt)) { record(root, ['__go__']); notes.push('Shaun said go. You may open ONE task now (set Status: ACTIVE in docs/TASK.md). This go is used up when the task opens. Do what his message asks, nothing more.'); }
    if (names.length) { record(root, names); notes.push(`Shaun approved: ${names.join(', ')}. For installs, commands that name them are allowed for 24 hours; for "agent:<name>", you may write .claude/agents/<name>.md for 24 hours. Do exactly what he approved, nothing more.`); }
    if (notes.length) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: notes.join(' ') } }));
  } catch { /* fail open: no approval */ }
}
