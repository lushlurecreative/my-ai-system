#!/usr/bin/env node
// Stop hook. (1) Ends by announcing work -> block (max 2 in a row per reason). (2) Claims done but TASK.md lacks Evidence or Reviewer PASS, or the reviewer agent never ran this session -> block once.
// (1b) Asks permission to continue mid-task -> block. (1c) Claims done with unticked Done means, or an ANALYSIS with an open Scope ledger -> block. (3) TASK is DONE with a reviewer PASS: autopilot off needs a numbered list of every NEXT item that can start now plus "which numbers"; autopilot on needs the next task started, not a question. Fails open.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { readTask, system, discussionOn } from './common.mjs';
const NEEDS_SHAUN = /\bShaun(?:'s)?\b[^|]{0,60}\b(?:action|login|logins|decision|decides|decide|spend|approval|authoriz\w+|unlock|setup|set up|sign-in|only|led)\b|\bneeds? (?:Shaun|your)\b|\b(?:logins?|credentials?|rotate|spend|admin sign-in)\b|\bseparately authorized\b|\bparked\b|\byou(?:r|'ll|'d)?\b|\btype "yes|\bsay (?:when|anything)\b/i;
export function startableItems(root) {
  let t = ''; try { t = fs.readFileSync(path.join(root, 'docs/NEXT.md'), 'utf8'); } catch { return []; }
  const body = t.split(/^Parked ideas/m)[0];
  return [...body.matchAll(/^\s*\d+\.\s+(.+)$/gm)].map((m) => m[1]).filter((x) => !/^\(/.test(x) && !NEEDS_SHAUN.test(x));
}
export function lastUserText(transcriptPath) {
  try { const ls = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean); for (let i = ls.length - 1; i >= 0; i--) { try { const d = JSON.parse(ls[i]); if (d.type !== 'user' || d.message?.role !== 'user') continue; const c = d.message.content; const txt = typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b) => b.type === 'text').map((b) => b.text).join('\n') : ''; if (txt.trim()) return txt.trim(); } catch {} } } catch {}
  return '';
}
// A question from Shaun is answered, not turned into new work or a forced list.
const isQuestion = (u) => !!u && u.length <= 1500 && !/^\s*(?:go|do|just do|start|proceed|option|yes|ok|okay)\b/i.test(u) && (/\?\s*$/.test(u) || /^\s*(?:why|what|how|who|when|where|which|can|could|should|would|is|are|was|were|does|did)\b/i.test(u));
const MAX = 2;
const ANNOUNCE = /(?<!\b(?:whether|if) )\b(?:I'll|I will|I'm going to|I am going to|I'm about to|let me)\s+(?:now\s+|go ahead and\s+)?(?:dig|push|get started|check|verify|run|do|start|begin|fix|deploy|test|look|investigate|update|write|implement|continue)\b|\b(?:continuing|proceeding|moving on)\b[^.?!]{0,60}\b(?:now|next)\b|\bnow (?:I'll|let me|checking|running|verifying)\b/i;
const HANDOFF = /\?\s*$|\bblocked (?:on|by)\b|\b(?:once|after) you\b|\bwaiting (?:on|for)\b|\byour call\b|\bwhich (?:one|numbers)\b|\bnumbers to run\b|\bAutopilot paused\b|\bstopp(?:ed|ing) (?:as|because) you\b/i;
// Mid-task, asking permission to continue is not a valid stop. Genuine decisions ("should the price be monthly or yearly?") are not matched.
const PERMISSION = /\b(?:want me to|would you like me to|do you want me to|shall I|should I (?:go ahead|proceed|continue|start|begin|fix|implement|run|check|build|do)|let me know if you(?:'d| would) like me|say go|waiting on your (?:go|ok|approval|permission))\b/i;
// Asking Shaun to run, open, check or bring back something Claude can do itself. Real blockers (a login, money, an unlock, a decision) are exempt.
const OFFLOAD = [
  /\b(?:can|could|would|will) you (?:please )?(?:re-?run|run|open|visit|go to|click|refresh|load|check|test|try|verify|look at|screenshot|paste|copy|send)\b/i,
  /\byou(?:'ll| will)? (?:need to|have to|should|must|can|could) (?:re-?run|run|open|visit|go to|click|refresh|load|check|test|try|verify|look at)\b/i,
  /\b(?:and|then)\s+(?:tell|let|show|send|paste|bring|report)\b[^.?!\n]{0,30}\b(?:me|back)\b[^.?!\n]{0,40}\b(?:result|results|output|see|says|happens|screenshot|error|find|found)\b/i,
  /\b(?:paste|send|bring|share)\b[^.?!\n]{0,20}\b(?:the|its|that|those)\s+(?:output|result|results|error|screenshot|log|logs)\b/i,
];
const REAL_BLOCKER = /\b(?:password|passcode|login|log in|log-in|sign in|sign-in|signed in|credentials?|2fa|two-factor|verification code|otp|token|secret|api key|payment|card|billing|spend|purchase|approve|approval|your decision|decide|decision|unlock|override|protected|physical|only you|stripe|dashboard|install)\b/i;
const CLAIM = /\b(?:task (?:is )?(?:done|complete)|all done|is (?:now )?fixed|fixed\.|completed\.|finished\.|done\.)/i;
export function reviewerRan(transcriptPath) {
  try { return fs.readFileSync(transcriptPath, 'utf8').split('\n').some((l) => { try { const d = JSON.parse(l); return d.type === 'assistant' && Array.isArray(d.message?.content) && d.message.content.some((b) => b.type === 'tool_use' && /^(Agent|Task)$/.test(b.name) && /reviewer/i.test(JSON.stringify(b.input || {}))); } catch { return false; } }); } catch { return true; }
}
// Shaun does not read code or system talk. A reply to him that is mostly file names, paths and system terms is rejected; it is rewritten in plain English.
const JARGON = [/\.claude\b/ig, /\boverride(?:\.txt)?\b/ig, /\bhard[- ]?blocks?\b/ig, /\bhooks?\b/ig, /\bheredoc/ig, /\b(?:regex|allowlist|blocklist|stderr|stdout|exit code|protected-paths|scope-guard|done-check|settings\.json)\b/ig, /\b[\w-]+\.(?:mjs|cjs|jsx?|tsx?|json|sh|toml|sql|ya?ml|env|txt|md)\b/ig, /\b(?:src|docs|supabase|scripts|public|lib|components)\/[\w./-]+/ig];
export function jargonHits(text) {
  const prose = String(text || '').replace(/```[\s\S]*?```/g, ' '); const seen = new Set();
  for (const re of JARGON) for (const m of prose.matchAll(re)) seen.add(m[0].toLowerCase());
  return [...seen];
}
const ASKED_ABOUT_CODE = /\b(?:which|what) (?:files?|code|scripts?)\b|\bshow me (?:the )?(?:code|files?|diff)\b|\bthe code\b|\bwhich files?\b/i;
export function judge(message, root, transcriptPath) {
  const text = String(message || '').replace(/[‘’]/g, "'").trim(); if (!text) return null;
  const jh = jargonHits(text); if (jh.length >= 3 && !(transcriptPath && ASKED_ABOUT_CODE.test(lastUserText(transcriptPath)))) return `Your reply talks in file names and system terms (${jh.slice(0, 4).join(', ')}). Shaun does not read those and does not edit files. Rewrite it in plain English: the problem in one sentence, what you recommend, the exact text to paste and where (inside a code block), and the one thing he must do. No reasons unless he asked. Any pasting goes in a chat box; never ask him to open or edit a file.`;
  if (discussionOn(root)) return null; // discussion mode: a plain conversational reply is fine; the edit blocks still apply
  const last = text.slice(-700).split(/\n\s*\n/).filter((p) => /[a-z]/i.test(p)).pop() || text.slice(-700);
  const spoken = last.replace(/"[^"\n]*"|`[^`\n]*`/g, ' ');
  if (!HANDOFF.test(last) && ANNOUNCE.test(spoken)) return `Your reply ends by announcing work ("${spoken.match(ANNOUNCE)[0]}") instead of doing it. Do it now, or end in a valid stop: done with evidence plus the numbered list (autopilot off) or the next task started (autopilot on), a question only Shaun can answer, or a named blocker.`;
  const t = readTask(root);
  if (t.status === 'ACTIVE' && PERMISSION.test(spoken)) return 'You are mid-task and you are asking permission to continue. That is not a valid stop. Research it, investigate, decide, and do the next step. Valid stops: a decision only Shaun can make (give the options and your recommendation), a named blocker with what you tried, or done with evidence.';
  if (OFFLOAD.some((r) => r.test(spoken)) && !REAL_BLOCKER.test(spoken)) return 'You are asking Shaun to do something you can do yourself (run it, open the page, check it, bring back a result). Do it now with your tools and carry on. Only a real blocker may go to him (a password or login, money, a protected unlock, a decision, a physical step), and then say what you were doing, what you tried, what blocks you, and the one thing you need.';
  if (CLAIM.test(spoken)) {
    if (t.status !== 'DONE' || t.evidence === 0) return `You said it is done, but docs/TASK.md is ${t.status} with ${t.evidence} evidence lines. Add the evidence (test output, screenshot path, live URL and result) and set Status: DONE, or do not claim done.`;
    if (t.doneTotal === 0) return 'docs/TASK.md has no "Done means" lines. Write the checkable statements, verify each, tick them, then claim done.';
    if (t.doneTicked < t.doneTotal) return `${t.doneTotal - t.doneTicked} of ${t.doneTotal} "Done means" lines are not ticked in docs/TASK.md. Verify each one, put "[x]" in front of it with its evidence, then claim done. If part is not finished, finish it. Do not call it done.`;
    if (t.type === 'ANALYSIS' && t.ledgerTotal === 0) return 'This is an ANALYSIS task but docs/TASK.md has no "Scope ledger". List every page, file or area in scope as "[ ]" lines, cover each, tick it with evidence (or tick it as "out of scope: reason"), then claim done.';
    if (t.type === 'ANALYSIS' && t.ledgerTicked < t.ledgerTotal) return `${t.ledgerTotal - t.ledgerTicked} of ${t.ledgerTotal} Scope ledger items are not covered. Cover each one and tick it with evidence, or tick it as "out of scope: reason". Do not call the analysis done while any item is open.`;
    if (!/PASS/i.test(t.verdict)) return `TASK.md has no "Reviewer verdict: PASS". Launch the reviewer agent (Agent tool, subagent_type reviewer) to grade the task against "Done means", record its verdict in TASK.md, then finish.`;
    if (transcriptPath && !reviewerRan(transcriptPath)) return 'TASK.md says the reviewer passed, but no reviewer agent ran in this session. Run it now and record the real verdict.';
  }
  if (t.status === 'DONE' && t.evidence > 0 && /PASS/i.test(t.verdict) && !(transcriptPath && isQuestion(lastUserText(transcriptPath)))) {
    if (system(root).autopilot) { if (!/\bAutopilot paused:/i.test(text)) return 'Autopilot is on and this task is DONE with a reviewer PASS. Do not end with a question. Take the top item in docs/NEXT.md that needs nothing from Shaun (skip items that need his login, money, a protected unlock or a decision, and anything a ruling in docs/RULINGS.md parks), move it into docs/TASK.md as a new task and start it. If nothing on the list can start without him, end with "Autopilot paused:" and a numbered list of what needs him and why.'; }
    else {
      const need = startableItems(root).length; const listed = (text.match(/^\s*\d+[.)]\s+\S/gm) || []).length;
      if (/\bpick (?:something|anything|one) (?:from|off) (?:the|this) list\b/i.test(text)) return 'Never list an option that says "pick something from the list". List the real items.';
      if (need === 0 ? !/\bnothing\b/i.test(text) : listed < need) return `Task is DONE and autopilot is off: after "Done." list every item from docs/NEXT.md that can be started now (${need} found), numbered, each with one plain sentence of what it is and what it needs from Shaun (usually nothing). No cap. ${need === 0 ? 'If nothing can start without him, say so and list what needs him.' : `You listed ${listed}.`}`;
      if (need > 0 && !/\bwhich (?:numbers|ones|items)\b|\bnumbers to run\b/i.test(last)) return 'End by asking which numbers to run.';
    }
  }
  return null;
}
function main() {
  let input = {}; try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { return; }
  const root = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd(); const file = path.join(os.tmpdir(), `ais-stop-${String(input.session_id || 'x').replace(/[^\w-]/g, '')}.count`);
  const reason = judge(input.last_assistant_message, root, input.transcript_path);
  if (!reason) { try { fs.rmSync(file, { force: true }); } catch {} return; }
  // Count repeats of the SAME reason only; a new reason starts a new count, so one cap cannot be spent on an earlier, different block.
  let n = 0; try { const [k, c] = fs.readFileSync(file, 'utf8').split('\n'); if (k === reason.slice(0, 40)) n = Number(c) || 0; } catch {}
  if (n >= MAX) { try { fs.rmSync(file, { force: true }); } catch {} return; }
  try { fs.writeFileSync(file, `${reason.slice(0, 40)}\n${n + 1}`); } catch { return; }
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}
if (import.meta.url === `file://${process.argv[1]}`) { try { main(); } catch { /* fail open */ } }
