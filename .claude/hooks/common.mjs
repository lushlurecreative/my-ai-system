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
  try { const a = JSON.parse(fs.readFileSync(path.join(root, '.claude/approvals.json'), 'utf8')); const now = Date.now(); return (Array.isArray(a) ? a : []).filter((x) => x && x.name && now - Number(x.ts) < 24 * 3600 * 1000).map((x) => String(x.name).toLowerCase()); } catch { return []; }
}
export function system(root) { try { return JSON.parse(fs.readFileSync(path.join(root, '.claude/system.json'), 'utf8')); } catch { return {}; } }
export const globRe = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '(?:.*/)?').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
