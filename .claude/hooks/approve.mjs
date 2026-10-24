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
  /^(?:(?:option|item|choice)\s*#?[a-e]\b|[a-e][.)!]?$)/i,
  /^(?:let'?s|please)\s+(?:do|fix|go|start|build|run|finish|continue)\b/i,
  new RegExp('^' + YES + '(?:please\\s+)?(?:do|fix|build|run|finish)\\b', 'i'),
];
export function parseGo(prompt) { const p = String(prompt || '').trim().replace(/^[\s"'`>*\u201c-]+/, ''); return !!p && GO.some((r) => r.test(p)); }
// Discussion mode: Shaun says it at the START of his message ("let's talk", "discussion mode"). A go, "task mode" or "back to work" ends it.
const DISC_ON = /^\s*(?:(?:ok(?:ay)?|alright|so|hey|right)\b[\s,.!:-]*)?(?:(?:let'?s|lets|i want to|i'd like to|i would like to|can we|could we)\s+(?:just\s+|really\s+)?(?:talk|discuss|chat|brainstorm|think|have a (?:talk|discussion|chat|conversation))\b|(?:go\s+(?:in\s*)?to|switch\s+(?:in)?to|enter|start|turn on|put (?:this|us|it) in|use)\s+(?:a\s+)?discussion mode\b|discussion mode\b)/i;
const DISC_OFF = /^\s*(?:(?:ok(?:ay)?|alright|so)\b[\s,.!:-]*)?(?:(?:exit|leave|end|stop|turn off|switch off|done with|out of)\s+(?:the\s+)?discussion(?:\s+mode)?\b|task mode\b|back to (?:work|task mode|building|the task)\b|stop (?:discussing|talking)\b)/i;
export function parseDiscuss(prompt) { const p = String(prompt || '').trim().replace(/^[\s"'`>*“-]+/, ''); if (!p) return null; if (DISC_OFF.test(p)) return 'off'; if (p.length <= 1500 && DISC_ON.test(p)) return 'on'; return null; }
export function setDiscussion(root, on) {
  const f = path.join(root, '.claude/discussion.json');
  if (on) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify({ ts: Date.now() })); } else fs.rmSync(f, { force: true });
}
const discussionWas = (root) => fs.existsSync(path.join(root, '.claude/discussion.json'));
export function record(root, names) {
  const f = path.join(root, '.claude/approvals.json'); let cur = []; try { cur = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
  const now = Date.now(); const keep = (Array.isArray(cur) ? cur : []).filter((x) => x && now - Number(x.ts) < 24 * 3600 * 1000 && !(names.includes('__go__') && x.name === '__go__'));
  for (const n of names) keep.push({ name: n, ts: now });
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(keep));
}
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); const root = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd(); const names = [...parse(input.prompt), ...parseAgents(input.prompt)]; const notes = [];
    const disc = parseDiscuss(input.prompt);
    if (disc === 'on') { setDiscussion(root, true); notes.push('Discussion mode is ON (Shaun asked for it). Talk with him like a thoughtful partner: read files, code and read-only data freely to ground what you say, give your view and a clear recommendation (not a menu of options), and end however is natural, including a question. Change no files and send no connector messages; the hooks block them. Write no task card, no Done. line, no NEXT.md list. Say once, in one line, that discussion mode is on and that "go" or "task mode" leaves it. If he states a decision, you may append it to docs/RULINGS.md.'); }
    else if (disc === 'off') { setDiscussion(root, false); notes.push('Discussion mode is OFF (Shaun ended it). Task rules apply again.'); }
    if (disc !== 'on' && parseGo(input.prompt)) { if (discussionWas(root)) { setDiscussion(root, false); notes.push('Discussion mode is OFF (Shaun said go).'); } record(root, ['__go__']); notes.push('Shaun said go. You may open ONE task now (set Status: ACTIVE in docs/TASK.md). This go is used up when the task opens. Do what his message asks, nothing more.'); }
    if (names.length) { record(root, names); notes.push(`Shaun approved: ${names.join(', ')}. For installs, commands that name them are allowed for 24 hours; for "agent:<name>", you may write .claude/agents/<name>.md for 24 hours. Do exactly what he approved, nothing more.`); }
    if (notes.length) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: notes.join(' ') } }));
  } catch { /* fail open: no approval */ }
}
