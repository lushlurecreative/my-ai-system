import fs from 'node:fs'; import path from 'node:path';
export const deny = (reason) => ({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } });
export function rel(root, p) { p = String(p || ''); if (path.isAbsolute(p)) p = path.relative(root, p); return p.replace(/^\.\//, ''); }
export function readTask(root) {
  let t = ''; try { t = fs.readFileSync(path.join(root, 'docs/TASK.md'), 'utf8'); } catch { return { status: 'NONE', type: 'BUILD', allowed: [], tools: null, evidence: 0, verdict: '', doneTotal: 0, doneTicked: 0, ledgerTotal: 0, ledgerTicked: 0 }; }
  const status = ((t.match(/^Status:\s*(\w+)/m) || [])[1] || 'NONE').toUpperCase();
  const sect = (name) => { const m = t.match(new RegExp(`^${name}:\\s*\\n((?:[ \\t]*-.*\\n?)*)`, 'm')); return m ? m[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter((l) => l && !l.startsWith('(')) : []; };
  const type = ((t.match(/^Type:\s*(\w+)/m) || [])[1] || 'BUILD').toUpperCase();
  // tools === null means the "Tools needed:" list is missing or still the template placeholder; ['none'] means the task needs no tool beyond the built-ins.
  const hasTools = /^Tools needed:/m.test(t); const toolLines = sect('Tools needed').map((l) => l.split(/\s*[:(]/)[0].trim()).filter(Boolean);
  // Checkbox sections: a line counts as ticked only when it starts with [x].
  const boxes = (name) => { const l = sect(name); return { total: l.length, ticked: l.filter((x) => /^\[x\]/i.test(x)).length }; };
  const dm = boxes('Done means'); const sl = boxes('Scope ledger');
  return { status, type, doneTotal: dm.total, doneTicked: dm.ticked, ledgerTotal: sl.total, ledgerTicked: sl.ticked, allowed: sect('Allowed paths'), tools: hasTools && toolLines.length ? toolLines : null, evidence: sect('Evidence').length, verdict: (sect('Reviewer verdict')[0] || '') };
}
// docs/TOOLBOX.md rows: | Job | Tool | Status | Check | Last verified |  ->  { 'tool name (lowercase)': 'working' | 'known' | ... }
export function readToolbox(root) {
  let t = ''; try { t = fs.readFileSync(path.join(root, 'docs/TOOLBOX.md'), 'utf8'); } catch { return {}; }
  const out = {};
  for (const line of t.split('\n')) {
    if (!/^\s*\|/.test(line) || /^\s*\|[\s:|-]+\|?\s*$/.test(line)) continue;
    const c = line.split('|').slice(1, -1).map((x) => x.trim()); if (c.length < 5 || /^job$/i.test(c[0])) continue;
    const st = (c[2].toLowerCase().match(/needs shaun|working|connected|installed|known/) || ['unknown'])[0];
    out[c[1].toLowerCase()] = st;
  }
  return out;
}
// Installs Shaun approved by typing "yes, install X" in chat (written by approve.mjs, which only the harness runs on his messages).
export function readApprovals(root) {
  try { const a = JSON.parse(fs.readFileSync(path.join(root, '.claude/approvals.json'), 'utf8')); const now = Date.now(); return (Array.isArray(a) ? a : []).filter((x) => x && x.name && !String(x.name).startsWith('__') && now - Number(x.ts) < 24 * 3600 * 1000).map((x) => String(x.name).toLowerCase()); } catch { return []; }
}
// Shaun's "go" (written by approve.mjs from his own chat message). One go opens one task; it expires after 6 hours. Stored as name "__go__" so it never counts as an install approval.
const GO_MS = 6 * 3600 * 1000;
export function readGo(root) { try { const a = JSON.parse(fs.readFileSync(path.join(root, '.claude/approvals.json'), 'utf8')); const now = Date.now(); return (Array.isArray(a) ? a : []).filter((x) => x && x.name === '__go__' && now - Number(x.ts) < GO_MS); } catch { return []; } }
export function consumeGo(root) { const f = path.join(root, '.claude/approvals.json'); try { const a = JSON.parse(fs.readFileSync(f, 'utf8')); const now = Date.now(); const i = (Array.isArray(a) ? a : []).findIndex((x) => x && x.name === '__go__' && now - Number(x.ts) < GO_MS); if (i < 0) return; a.splice(i, 1); fs.writeFileSync(f, JSON.stringify(a)); } catch { /* nothing to consume */ } }
// Discussion mode: set only by approve.mjs from Shaun's own chat message; lapses after 24 hours so a forgotten flag cannot switch the stop checks off for long.
export function discussionOn(root) { try { const d = JSON.parse(fs.readFileSync(path.join(root, '.claude/discussion.json'), 'utf8')); return Date.now() - Number(d.ts) < 24 * 3600 * 1000; } catch { return false; } }
// Shell text with only provably inert text removed, so a name that appears only in a commit message or a data heredoc is not mistaken for a file the command writes.
// Removed: the -m message of git commit, git tag or git merge only (never the quoted text after a flag on bash, sh, zsh, python, node, perl, ruby, eval or any other command), and only if it is single-quoted or has no $( or backtick (those can run); a heredoc body only when the heredoc feeds cat or git and is not piped on to a shell or interpreter; fd redirects (2>&1, >/dev/null).
// Never removed: a heredoc body fed to bash, sh, zsh, python, node, perl, ruby (or piped into one), and anything containing $( or a backtick.
const RUNS = /\|\s*(?:sudo\s+)?(?:bash|sh|zsh|dash|ksh|python3?|node|perl|ruby|php|eval|source|xargs|env)\b|\$\(|`/;
export function stripInertHeredocs(text) {
  const lines = String(text || '').split('\n'); const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]; const marks = [...line.matchAll(/(?<!<)<<(?!<)-?\s*(['"]?)(\w+)\1/g)];
    out.push(line);
    if (!marks.length) continue;
    const m = marks[0]; const tag = m[2]; const before = line.slice(0, m.index); const after = line.slice(m.index + m[0].length);
    let end = -1; for (let k = i + 1; k < lines.length; k++) if (lines[k].trim() === tag) { end = k; break; }
    if (end < 0) continue;
    const segment = before.split(/&&|\|\||[;|&]/).pop().trim(); const feeder = (segment.split(/\s+/)[0] || '').replace(/^.*\//, '');
    const inert = marks.length === 1 && (feeder === 'cat' || feeder === 'git') && !RUNS.test(after) && !RUNS.test(before);
    if (inert) i = end; // drop the body and the terminator
  }
  return lines.length ? out.join('\n') : '';
}
const GIT_MESSAGE_CMD = /^\s*(?:sudo\s+)?git\s+(?:-C\s+\S+\s+|-c\s+\S+\s+|--[\w-]+(?:=\S+)?\s+)*(?:commit|tag|merge)\b/;
export const quiet = (s) => stripInertHeredocs(String(s || '')).replace(/(\s-[a-zA-Z]*m|\s--message)(\s*=?\s*)("(?:[^"\\]|\\.)*"|'[^']*')/g, (m, flag, sp, body, offset, whole) => (GIT_MESSAGE_CMD.test(whole.slice(0, offset).split(/&&|\|\||[;|&\n]/).pop()) && (body[0] === "'" || !/\$\(|`/.test(body))) ? `${flag}${sp}""` : m).replace(/\d*>&\d*|&?>>?\s*\/dev\/null/g, ' ');
export function system(root) { try { return JSON.parse(fs.readFileSync(path.join(root, '.claude/system.json'), 'utf8')); } catch { return {}; } }
export const globRe = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '(?:.*/)?').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
