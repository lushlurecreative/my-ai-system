#!/usr/bin/env node
// Stop hook. (1) Ends by announcing work -> block (max 2 in a row per reason). (2) Claims done but TASK.md lacks Evidence or Reviewer PASS, or the reviewer agent never ran this session -> block once.
// (1b) Asks permission to continue mid-task -> block. (1c) Claims done with unticked Done means, or an ANALYSIS with an open Scope ledger -> block. (3) TASK is DONE with a reviewer PASS: autopilot off needs a numbered list of every NEXT item that can start now plus "which numbers"; autopilot on needs the next task started, not a question. Fails open.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { readTask, system, discussionOn, readGoAll, projectRoot } from './common.mjs';
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
// Asking Shaun to pick an order, to say where to start, or whether to start. He is the boss; Claude decides and tells him afterwards.
const PICK = [/\bwhich (?:of (?:these|those|them)|one|ones|items?|numbers?)\b[^.?!\n]{0,60}\b(?:first|next|start|tackle|dig|fix|run|do)\b/i, /\bwhere (?:do you want|should (?:I|we)) (?:me )?(?:to )?(?:start|begin)\b/i, /\bwhat (?:would|do) you (?:like|want) (?:me )?to (?:do|tackle|fix|start|work on)\b/i, /\bwant me to (?:start|begin|fix|tackle|go|save|commit)\b/i, /\bshould I (?:start|begin|go ahead|proceed|fix|tackle|save|commit)\b/i, /\b(?:reply|say|type|tell me) ["'\u201c]?(?:save it|commit it|yes|ok|okay)\b/i, /\bI need your (?:ok|okay|go|approval|permission) to (?:save|commit|fix|start|run|change|build)\b/i];
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
// "What I need from you": anything waiting on Shaun goes in its own labeled section, each item explained so it makes sense cold. Not buried in a paragraph, never a bare label such as "decision on button colour".
const ASK_HEADING = /^[ \t]*(?:#{1,4}[ \t]*)?\**[ \t]*(?:(?:what|things)[ \t]+(?:i|we)[ \t]+need[ \t]+from[ \t]+you|needs?[ \t]+from[ \t]+you|waiting[ \t]+on[ \t]+you)\b[^\n]*$/im;
const ASK_SIGNAL = /\b(?:waiting (?:on|for) you|needs? your (?:decision|approval|ok|okay|yes|permission|input|go|sign-?off)|needs? (?:you|Shaun) to\b|awaiting your|(?:can'?t|cannot|won'?t|will not) [^.\n]{0,50}\buntil you\b|only you can\b|(?:a|your) decision (?:is )?(?:needed|required))/i;
export function askSection(text) {
  const m = ASK_HEADING.exec(text); if (!m) return null;
  const startAt = m.index + m[0].length; const after = text.slice(startAt).split('\n'); const bullets = []; let started = false; let consumed = 0; let lastBullet = 0;
  for (const l of after) { consumed += l.length + 1; const b = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+)$/); if (b) { started = true; bullets.push(b[1]); lastBullet = consumed; continue; } if (started && l.trim() && !/^\s{2,}\S/.test(l)) break; }
  return { heading: m[0], bullets, from: m.index, to: startAt + (started ? lastBullet : 0) };
}
const MONTH = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)';
const ASK_CONTEXT = new RegExp(`\\b(?:on ${MONTH}[a-z]*\\.? \\d{1,2}|yesterday|today|last (?:week|night)|this (?:morning|week)|you (?:said|asked|raised|told|mentioned|wanted|flagged)|(?:was|were) found|came up|found (?:on|during|while)|the (?:audit|check|test|walk)(?:-through)? (?:on|from|found))\\b`, 'i');
const ASK_PICK = /\bI(?:'d| would| suggest| recommend)\b|\bmy (?:pick|recommendation)\b|\brecommend\b/i;
const ASK_OPS = /\b(?:redeploy\w*|deploy\w*|publish\w*|reviewer|regression|suite|share-?link|endpoint|migration|lookup|commit\w*|push\w*|merge\w*|queue)\b/i;
const plainBullet = (b) => b.replace(/[*_`]/g, '').trim();
const normKey = (b) => plainBullet(b).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').slice(0, 120);
// Asks already shown earlier in this chat (so the same ask is never sent twice unless it changed).
export function earlierAsks(transcriptPath) {
  const keys = new Set(); if (!transcriptPath) return keys;
  try {
    const texts = []; for (const l of fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean)) { try { const d = JSON.parse(l); if (d.type !== 'assistant') continue; const c = d.message?.content; const t = typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b) => b.type === 'text').map((b) => b.text).join('\n') : ''; if (t.trim()) texts.push(t); } catch {} }
    texts.pop(); // the message being judged is the last one
    for (const t of texts) { const sec = askSection(t); if (sec) for (const b of sec.bullets) keys.add(normKey(b)); }
  } catch {}
  return keys;
}
export function askProblem(text, transcriptPath) {
  const sec = askSection(text); const outside = sec ? text.slice(0, sec.from) + ' ' + text.slice(sec.to) : text;
  if (sec && ASK_SIGNAL.test(outside)) return 'Something that waits on Shaun is written outside your "What I need from you" section. Move it into the section as its own bullet and take it out of the paragraph. Shaun rarely reads the paragraphs.';
  if (!sec) return ASK_SIGNAL.test(text) ? 'You are telling Shaun that something waits on him, inside a paragraph. Put it in its own section titled "What I need from you", as bullets. Each bullet opens with "I need a decision on ...", "I need your approval to ...", "I need your yes to ...", "I need a login for ..." or similar, then the subject in plain words, a reminder of when it came up and what he said or what was found, his choices, and your pick. Three or four short lines, never a paragraph. Take the facts from docs/ASKS.md.' : null;
  if (!sec.bullets.length) return 'Your "What I need from you" section has no bullets. List each thing you need from Shaun as a bullet, or remove the section if nothing is needed.';
  if (sec.bullets.length > 3) return `You listed ${sec.bullets.length} asks. Show at most 3, the most important, and end with one line such as "2 more are waiting; say list to see them." Shaun does not have time for more.`;
  const label = (b) => `"${plainBullet(b).slice(0, 50)}"`;
  const notAsk = sec.bullets.find((b) => !/^I need\b/i.test(plainBullet(b)));
  if (notAsk) return `The ask ${label(notAsk)} must open with "I need ...", saying what kind of thing it is: "I need a decision on ...", "I need your approval to ...", "I need your yes to ...", "I need a login for ...". Then the subject in plain words, when it came up, his choices and your pick.`;
  const shortOne = sec.bullets.find((b) => plainBullet(b).split(/\s+/).length < 14);
  if (shortOne) return `The ask ${label(shortOne)} is too short to understand cold. Shaun did not write it and may not remember it. After "I need ..." and the subject, add when it came up and what he said or what was found, his choices, and your pick. Three or four short lines.`;
  const longOne = sec.bullets.find((b) => plainBullet(b).split(/\s+/).length > 75);
  if (longOne) return `The ask ${label(longOne)} is too long. Shaun does not read paragraphs. Cut it to about 45 to 60 words: what you need, the subject, when it came up, his choices, your pick. More detail only if he asks.`;
  const noCtx = sec.bullets.find((b) => !ASK_CONTEXT.test(plainBullet(b)));
  if (noCtx) return `The ask ${label(noCtx)} does not say when it came up or what he said or what was found. Add one short clause, for example "On Nov 3 you said ..." or "On Nov 5 the check found ...", so it makes sense to him days later.`;
  const noPick = sec.bullets.find((b) => /^I need (?:a decision|your (?:approval|yes|ok|okay))/i.test(plainBullet(b)) && !ASK_PICK.test(plainBullet(b)));
  if (noPick) return `The ask ${label(noPick)} gives no recommendation. Say what you would pick and why in a few words ("I'd go with blue because ...").`;
  const stepAsk = sec.bullets.find((b) => /\b(?:paste|pasting|copy and paste|run this|run the command)\b/i.test(plainBullet(b)));
  if (stepAsk) return `The ask ${label(stepAsk)} is a step for Shaun, not a decision. Do not ask for his yes to a step. Give it as "Do this:" with the one action in a short sentence and the exact text to paste in a code block, then "Where:" with the exact place, before the "What I need from you" section.`;
  const ops = sec.bullets.map((b) => ASK_OPS.exec(plainBullet(b))).find(Boolean);
  if (ops) return `An ask uses the word "${ops[0]}", which Shaun does not use. Say it in plain words (for example "put it live" instead of "redeploy"), and never mention the reviewer or a queue unless that is the thing he must decide.`;
  const before = earlierAsks(transcriptPath); const dup = sec.bullets.find((b) => before.has(normKey(b)));
  if (dup) return `You already showed this ask earlier in this chat: ${label(dup)}. Do not repeat an ask unless it has changed. Leave the section out, or show only new or changed asks, and give just the result.`;
  return null;
}
// Status messages: "waiting on the reviewer", "I'll let you know", "about 8 of 63 checks done". Shaun wants the result, not the progress.
const STATUS = /\b(?:still waiting|waiting (?:on|for) (?:the )?(?:reviewer|publish|build|deploy|queue|lovable)|I'?m (?:watching|checking|monitoring|polling|waiting)|I'?ll (?:let you know|check back|read it back|keep (?:watching|checking))|(?:the )?reviewer (?:has not|hasn'?t|is (?:checking|still))|(?:is|are|isn'?t|aren'?t) (?:still )?not (?:live|published) yet|not (?:live|published) yet|still (?:running|publishing|building)|once the reviewer|\d+ of \d+ (?:checks|tests|files)|(?:the )?task card stays open)\b/i;
const ASKED_STATUS = /\b(?:status|where are we|what'?s (?:going on|happening|the update)|are you (?:done|finished)|how'?s it going|update me|progress)\b/i;
export function statusOnly(text, transcriptPath) {
  const sec = askSection(text); const body = (sec ? text.slice(0, sec.from) + ' ' + text.slice(sec.to) : text).trim();
  if (!STATUS.test(body) || /\bafter \d+ (?:minutes|hours)\b/i.test(body)) return null;
  if (transcriptPath && (ASKED_STATUS.test(lastUserText(transcriptPath)) || isQuestion(lastUserText(transcriptPath)))) return null;
  const words = body.split(/\s+/).filter(Boolean).length; const last = body.split(/\n\s*\n/).filter((p) => /[a-z]/i.test(p)).pop() || body;
  return words <= 120 || STATUS.test(last) ? 'This is a status message, and Shaun wants none. Do not report that you are waiting, watching, checking or that something is under review or not live yet. Keep working silently: if you are waiting for something outside your control (a publish, a build), wait with a command that checks every 30 seconds for up to 10 minutes and do other work from the list meanwhile. Report only a result, good or bad. If it truly is not live after 10 minutes, say that once as a result ("not live after 10 minutes").' : null;
}
// Counts, hashes and version numbers: not his business. "664 tests pass", "passed 64 of 64", "commit 3fa9c21", "version 2026-11-07.2".
const NOISE_NUMBERS = /\b\d+(?:\s+of\s+\d+)?\s+(?:tests?|checks?|test files|assertions)\s+(?:pass(?:ed|es)?|ran|run|green)\b|\bpassed\s+\d+\s+of\s+\d+\b|\ball\s+\d+\s+(?:tests?|checks?)\b|\bcommit\s+[0-9a-f]{7,40}\b|\bversion\s+\d{4}-\d{2}-\d{2}(?:\.\d+)?\b|\b(?:sha|hash)\s+[0-9a-f]{7,40}\b/i;
const ASKED_COUNTS = /\b(?:how many|which version|what version|test count|commit|hash|sha)\b/i;
export function noiseNumbers(text, transcriptPath) {
  const body = String(text || '').replace(/```[\s\S]*?```/g, ' ');
  const m = NOISE_NUMBERS.exec(body); if (!m) return null;
  if (transcriptPath && ASKED_COUNTS.test(lastUserText(transcriptPath))) return null;
  return `Shaun does not need "${m[0]}": counts, commit hashes and version numbers are not his business. Say that the checks pass (or the one thing that failed), and leave out how many ran, which commit, and which version.`;
}
// Results only: a long report is not read. Questions from Shaun and discussion mode are exempt.
export function tooLong(text, transcriptPath, root) {
  if (discussionOn(root)) return null; if (transcriptPath && isQuestion(lastUserText(transcriptPath))) return null;
  const sec = askSection(text); const body = (sec ? text.slice(0, sec.from) + ' ' + text.slice(sec.to) : text).replace(/```[\s\S]*?```/g, ' ').trim();
  return body.split(/\s+/).filter(Boolean).length > 140 ? 'This report is too long. Shaun reads results, not narration, and does not read long blocks. Give the result in at most three short lines (what is done, what is live, what failed), and put anything he must decide in the "What I need from you" section. Cut everything else; the detail is in docs/FIXED.md and the task card.' : null;
}
export function judge(message, root, transcriptPath) {
  const text = String(message || '').replace(/[‘’]/g, "'").trim(); if (!text) return null;
  const jh = jargonHits(text); if (jh.length >= 3 && !(transcriptPath && ASKED_ABOUT_CODE.test(lastUserText(transcriptPath)))) return `Your reply talks in file names and system terms (${jh.slice(0, 4).join(', ')}). Shaun does not read those and does not edit files. Rewrite it in plain English: the problem in one sentence, what you recommend, the exact text to paste and where (inside a code block), and the one thing he must do. No reasons unless he asked. Any pasting goes in a chat box; never ask him to open or edit a file.`;
  { const ap = askProblem(text, transcriptPath); if (ap) return ap; }
  { const so = statusOnly(text, transcriptPath); if (so) return so; }
  { const nn = noiseNumbers(text, transcriptPath); if (nn) return nn; }
  { const tl = tooLong(text, transcriptPath, root); if (tl) return tl; }
  const last = text.slice(-700).split(/\n\s*\n/).filter((p) => /[a-z]/i.test(p)).pop() || text.slice(-700);
  const spoken = last.replace(/"[^"\n]*"|`[^`\n]*`/g, ' ');
  const askSec = askSection(text); const outsideAsk = (askSec ? text.slice(0, askSec.from) + ' ' + text.slice(askSec.to) : text).trim(); const lastOutside = outsideAsk.slice(-700).split(/\n\s*\n/).filter((p) => /[a-z]/i.test(p)).pop() || outsideAsk;
  if (PICK.some((r) => r.test(lastOutside.replace(/"[^"\n]*"|`[^`\n]*`/g, ' ')))) return 'Do not ask Shaun to pick an order, to say where to start, or whether you should start. He is the boss and has told you to carry on. Decide the order yourself (most customer-damaging first), do the work, and tell him afterwards what you found and fixed, in plain words. Ask him only for a password or login, money or a card, a physical step, or a real business decision.';
  if (discussionOn(root)) return null; // discussion mode: a plain conversational reply is fine; the edit blocks still apply
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
    const keepGoing = system(root).autopilot || system(root).initiative !== false || readGoAll(root).length > 0; // initiative is on unless a project turns it off
    if ((text.slice(-600).match(/^\s*\d+[.)]\s+\S/gm) || []).length >= 2) return 'Do not end with a numbered list of options or things for Shaun to type. Say in one short message what finished and, only if something truly needs him (a password or login, money or a card, a physical step, a real business decision), the one ask, with Do this and Where.';
    if (keepGoing) { if (startableItems(root).length > 0) return 'This task is DONE with a reviewer PASS and items on docs/NEXT.md can start without Shaun. Do not end with a report or a question. Move the top such item into docs/TASK.md as a new task and start it; tell Shaun what you found and fixed afterwards, in plain words. (Skip items that need his login, money or a decision, and anything a ruling in docs/RULINGS.md parks.)'; }
    else {
      const need = startableItems(root).length;
      if (need === 0 && !/\bnothing\b/i.test(text)) return 'Say plainly that nothing is left that can start without Shaun, and name the one thing that needs him, if any. No list.';
      if (need > 0 && !/\bgo\b/i.test(last)) return 'End with your one recommended next step in plain words and ask Shaun to type go. No numbered list.';
    }
  }
  return null;
}
function main() {
  let input = {}; try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { return; }
  const root = projectRoot(input.cwd); const file = path.join(os.tmpdir(), `ais-stop-${String(input.session_id || 'x').replace(/[^\w-]/g, '')}.count`);
  const reason = judge(input.last_assistant_message, root, input.transcript_path);
  if (!reason) { try { fs.rmSync(file, { force: true }); } catch {} return; }
  // Count repeats of the SAME reason only; a new reason starts a new count, so one cap cannot be spent on an earlier, different block.
  let n = 0; try { const [k, c] = fs.readFileSync(file, 'utf8').split('\n'); if (k === reason.slice(0, 40)) n = Number(c) || 0; } catch {}
  if (n >= MAX) { try { fs.rmSync(file, { force: true }); } catch {} return; }
  try { fs.writeFileSync(file, `${reason.slice(0, 40)}\n${n + 1}`); } catch { return; }
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}
if (import.meta.url === `file://${process.argv[1]}`) { try { main(); } catch { /* fail open */ } }
