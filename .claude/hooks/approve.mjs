#!/usr/bin/env node
// UserPromptSubmit: when Shaun types "yes, install X" (or "install: X") in chat, record the approval. The harness runs this only on HIS messages, so Claude cannot forge it.
// scope-guard.mjs reads .claude/approvals.json. Approvals last 24 hours. Fails open (no approval) on any error.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { grantUnlock } from './override.mjs'; import { verNewer, masterPathOf, verifyMaster } from './common.mjs';
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
// A plain approval ("go", "yes", "do it", "all of them", "execute all") is a standing go that covers everything he named or that was listed in the message he answered. A specific pick ("option 2", "3", "start the header fix") opens just that one task.
const GO_ALL = [
  new RegExp('^' + YES + '+$', 'i'),
  new RegExp('^' + YES + '?go\\b(?!\\s+(?:to|back|into|through|over)\\b)[\\s,.!]*(?:(?:ahead|on)\\b[\\s,.!]*)?(?:(?:on|with)\\s+)?(?:all(?:\\s+of\\s+them)?|everything|the\\s+(?:whole\\s+)?list)?[\\s.!]*$', 'i'),
  new RegExp('^' + YES + '?(?:just\\s+)?do\\s+(?:it|that|this|all|both|them|everything|whatever)\\b', 'i'),
  /^(?:execute|run|do)\s+all\b/i, /^all\s+of\s+them\b/i, /^(?:yes[\s,.!]*)?(?:all|everything)[\s.!]*$/i, /^(?:proceed|approved?)\b/i,
];
const cleanGo = (prompt) => String(prompt || '').trim().replace(/^[\s"'`>*“-]+/, '');
export function goKind(prompt) { const p = cleanGo(prompt); if (!p) return null; if (GO_ALL.some((r) => r.test(p))) return 'all'; return GO.some((r) => r.test(p)) ? 'one' : null; }
export function parseGo(prompt) { return !!goKind(prompt); }
// Discussion mode: Shaun says it at the START of his message ("let's talk", "discussion mode"). A go, "task mode" or "back to work" ends it.
const DISC_ON = /^\s*(?:(?:ok(?:ay)?|alright|so|hey|right)\b[\s,.!:-]*)?(?:(?:let'?s|lets|i want to|i'd like to|i would like to|can we|could we)\s+(?:just\s+|really\s+)?(?:talk|discuss|chat|brainstorm|think|have a (?:talk|discussion|chat|conversation))\b|(?:go\s+(?:in\s*)?to|switch\s+(?:in)?to|enter|start|turn on|put (?:this|us|it) in|use)\s+(?:a\s+)?discussion mode\b|discussion mode\b)/i;
const DISC_OFF = /^\s*(?:(?:ok(?:ay)?|alright|so)\b[\s,.!:-]*)?(?:(?:exit|leave|end|stop|turn off|switch off|done with|out of)\s+(?:the\s+)?discussion(?:\s+mode)?\b|task mode\b|back to (?:work|task mode|building|the task)\b|stop (?:discussing|talking)\b)/i;
export function parseDiscuss(prompt) { const p = String(prompt || '').trim().replace(/^[\s"'`>*“-]+/, ''); if (!p) return null; if (DISC_OFF.test(p)) return 'off'; if (p.length <= 1500 && DISC_ON.test(p)) return 'on'; return null; }
export function setDiscussion(root, on) {
  const f = path.join(root, '.claude/discussion.json');
  if (on) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify({ ts: Date.now() })); } else fs.rmSync(f, { force: true });
}
const discussionWas = (root) => fs.existsSync(path.join(root, '.claude/discussion.json'));
// "unlock pricing" / "yes, unlock" at the START of a short message of his own. The word comes from the block message Claude saw.
const UNLOCK = /^\s*(?:(?:yes|yep|yeah|ok|okay|sure)\b[\s,.!:-]*)?unlock\b([^\n]*?)\s*[.!]?\s*$/i;
export function parseUnlock(prompt) {
  const p = String(prompt || '').trim().replace(/^[\s"'`>*“-]+/, ''); if (!p || p.length > 160) return null; const m = p.match(UNLOCK); if (!m) return null;
  const raw = m[1].split(/[\s,]+/).filter((w) => w && !/^(?:and|the)$/i.test(w)); if (raw.length > 5 || raw.some((w) => !/^[\w.\-/]+$/.test(w))) return null;
  return { words: raw.map((w) => w.replace(/^.*\//, '').replace(/\.[^.]*$/, '')) };
}
// "yes, update": Shaun's own message runs the update, here in the hook, so nothing updates without his word and Claude never has to run the installer.
const UPDATE = /^\s*(?:(?:ok|okay|sure)\b[\s,.!:-]*)?yes\b[\s,.!:-]*update(?:\s+(?:the\s+)?system)?\s*[.!]?\s*$/i;
export const parseUpdate = (prompt) => { const p = String(prompt || '').trim().replace(/^[\s"'`>*“-]+/, ''); return !!p && p.length <= 60 && UPDATE.test(p); };
export function runUpdate() {
  try {
    const project = process.env.CLAUDE_PROJECT_DIR; // only the trusted environment setting; never the folder a chat reports
    if (!project) return { ok: false, msg: 'The system update was stopped: the project folder is not known from the trusted setting. Nothing was installed.' };
    const master = masterPathOf(project); const v = verifyMaster(project, master, { sync: true });
    if (!v.ok) return { ok: false, msg: `The system update was stopped: ${v.reason}. Nothing was installed.` };
    let have = '0'; try { have = fs.readFileSync(path.join(project, '.claude/system-version'), 'utf8').trim(); } catch {}
    const want = fs.readFileSync(path.join(v.master, 'VERSION'), 'utf8').trim();
    if (!verNewer(want, have)) return { ok: true, msg: `The system is already on the latest version (${have}).` };
    execFileSync('bash', [path.join(v.master, 'install.sh'), project], { timeout: 40000, stdio: 'ignore' });
    return { ok: true, msg: `The system was updated from ${have} to ${want}. The new rules text is read from the next fresh chat; the checks already use the new version. The changed system files are uncommitted: include them in the next commit.` };
  } catch (e) { return { ok: false, msg: `The system update failed (${String(e.message || e).split('\n')[0].slice(0, 120)}). Nothing was installed.` }; }
}
// "stop" / "pause" / "cancel" (alone, or with everything / all / it / now / working / please) ends his standing approval; nothing else ends it.
const STOP = /^\s*(?:(?:ok(?:ay)?|alright|please)\b[\s,.!:-]*)?(?:stop|pause|cancel|never\s?mind|hold\s+on|wait)(?:\s+(?:everything|all|it|now|working|please|that|there))*[\s.!]*$/i;
export const parseStop = (prompt) => { const p = cleanGo(prompt); return !!p && p.length <= 40 && STOP.test(p); };
export function clearGo(root) { const f = path.join(root, '.claude/approvals.json'); try { const a = JSON.parse(fs.readFileSync(f, 'utf8')); fs.writeFileSync(f, JSON.stringify((Array.isArray(a) ? a : []).filter((x) => x && x.name !== '__go__' && x.name !== '__goall__'))); return true; } catch { return false; } }
// Permission in plain words, anywhere in a message ("fix them all", "I'm giving you permission", "do it"): ends discussion mode. Skipped when it is negated ("do not fix it", "don't do it").
const PERM = /\b(?:go ahead|go for it|do it|do them|do all(?: of (?:it|them))?|do everything|fix (?:it|them|all|everything|these|this|that|the problems?|all of (?:it|them))|just fix|you (?:have|got|can|may) (?:my )?(?:permission|approval|the go)|(?:i'?m|i am) giving you permission|execute all|handle (?:it|them|this|all|everything)|take care of (?:it|them|this|all|everything)|all of them|make it happen|build it|implement it)\b/gi;
export function permissionAnywhere(prompt) {
  const p = String(prompt || ''); if (!p.trim() || p.length > 6000) return false;
  for (const m of p.matchAll(PERM)) {
    const before = p.slice(Math.max(0, m.index - 18), m.index).toLowerCase(); if (/(?:don'?t|do not|never|not|without|stop|no need to|shouldn'?t)\s*(?:\w+\s+)?$/.test(before)) continue;
    // a question is a question, not permission: skip a match inside a sentence that ends in "?" or opens with a question word or modal
    const from = Math.max(p.lastIndexOf('.', m.index), p.lastIndexOf('!', m.index), p.lastIndexOf('?', m.index), p.lastIndexOf('\n', m.index)) + 1;
    const tail = p.slice(m.index).search(/[.!?\n]/); const endAt = tail < 0 ? p.length : m.index + tail; const sentence = p.slice(from, endAt + 1).trim();
    if (/\?$/.test(sentence) || /^(?:and |but |so |ok(?:ay)? |well )?(?:how|what|why|when|where|which|who|should|would|could|can|do you|did you|does|is|are|will|shall|might)\b/i.test(sentence)) continue;
    return true;
  }
  return false;
}
export function record(root, names) {
  const f = path.join(root, '.claude/approvals.json'); let cur = []; try { cur = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
  const now = Date.now(); const keep = (Array.isArray(cur) ? cur : []).filter((x) => x && (x.name === '__go__' || x.name === '__goall__' || now - Number(x.ts) < 24 * 3600 * 1000) && !(names.includes('__go__') && x.name === '__go__') && !(names.includes('__goall__') && x.name === '__goall__'));
  for (const n of names) keep.push({ name: n, ts: now });
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(keep));
}
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); const root = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd(); const names = [...parse(input.prompt), ...parseAgents(input.prompt)]; const notes = []; const shown = [];
    // `shown` = lines Shaun sees himself (systemMessage)
    if (parseUpdate(input.prompt)) { const u = runUpdate(); shown.push(u.msg); notes.push(`${u.msg} Tell Shaun the result in one plain sentence.`); }
    const unl = parseUnlock(input.prompt);
    if (unl) {
      const got = unl.words.length ? unl.words.flatMap((w) => grantUnlock(root, w)) : grantUnlock(root, '');
      if (got.length) { const list = got.map((x) => x.value).join(', '); shown.push(`Unlocked for 3 hours: ${list}`); notes.push(`Shaun unlocked ${list} for 3 hours. Make exactly the change you described, nothing more, then tell him in plain words that it is done. Do not mention files or code to him.`); }
      if (!got.length || (unl.words.length && got.length < unl.words.length)) notes.push('Some of what Shaun typed matched nothing that is waiting (one word unlocks one thing; there is no "unlock all"). Ask again in plain words for what is still locked, and give him the exact words to type (the block message names them).');
    }
    if (parseStop(input.prompt)) { clearGo(root); notes.push('Shaun said stop. His standing approval is cleared. Stop what you are doing, change nothing further, and wait for his next instruction. Say in one plain sentence that you stopped.'); }
    const disc = parseDiscuss(input.prompt);
    if (disc === 'on') { setDiscussion(root, true); notes.push('Discussion mode is ON (Shaun asked for it). Talk with him like a thoughtful partner: read files, code and read-only data freely to ground what you say, give your view and a clear recommendation (not a menu of options), and end however is natural, including a question. Change no files and send no connector messages; the hooks block them. Write no task card, no Done. line, no NEXT.md list. Do not open with a generic question like "what do you want to talk about". If he gave no topic, say in one line that discussion mode is on and that "go" or "task mode" leaves it, then stop. If he did give a topic, answer it. Do not mention your own pending work, unpushed changes, reviewers or "say go to push" unless he asks or it directly bears on what he raised. If he states a decision, you may append it to docs/RULINGS.md.'); }
    else if (disc === 'off') { setDiscussion(root, false); notes.push('Discussion mode is OFF (Shaun ended it). Task rules apply again.'); }
    if (disc !== 'on' && !parseGo(input.prompt) && discussionWas(root) && permissionAnywhere(input.prompt)) { setDiscussion(root, false); notes.push('Discussion mode is OFF: Shaun gave permission to act in plain words. Do what he asked, on your own.'); }
    if (disc !== 'on' && parseGo(input.prompt)) { if (discussionWas(root)) { setDiscussion(root, false); notes.push('Discussion mode is OFF (Shaun said go).'); } const gk = goKind(input.prompt); if (gk === 'all') { record(root, ['__goall__']); notes.push('Shaun approved. That covers everything he named, or that was listed in the message he answered. Open each task in turn (set Status: ACTIVE in docs/TASK.md) and work through them one after another without asking again; this approval stays in force until Shaun says stop. Stop only for a real blocker: a password or login, money or a card, a physical step, or a real business decision. Ask for that in one short message.'); } else { record(root, ['__go__']); notes.push('Shaun said go for one item. You may open ONE task now (set Status: ACTIVE in docs/TASK.md). This go is used up when the task opens. Do what his message asks, nothing more.'); } }
    if (names.length) { record(root, names); notes.push(`Shaun approved: ${names.join(', ')}. For installs, commands that name them are allowed for 24 hours; for "agent:<name>", you may write .claude/agents/<name>.md for 24 hours. Do exactly what he approved, nothing more.`); }
    if (notes.length) process.stdout.write(JSON.stringify({ ...(shown.length ? { systemMessage: shown.join(' | ') } : {}), hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: notes.join(' ') } }));
  } catch { /* fail open: no approval */ }
}
