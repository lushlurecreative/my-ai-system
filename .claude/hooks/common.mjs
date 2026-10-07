import fs from 'node:fs'; import path from 'node:path';
export const deny = (reason) => ({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } });
export function rel(root, p) { p = String(p || ''); if (path.isAbsolute(p)) p = path.relative(root, p); return p.replace(/^\.\//, ''); }
export function readTask(root) {
  let t = ''; try { t = fs.readFileSync(path.join(root, 'docs/TASK.md'), 'utf8'); } catch { return { status: 'NONE', allowed: [], evidence: 0, verdict: '' }; }
  const status = ((t.match(/^Status:\s*(\w+)/m) || [])[1] || 'NONE').toUpperCase();
  const sect = (name) => { const m = t.match(new RegExp(`^${name}:\\s*\\n((?:[ \\t]*-.*\\n?)*)`, 'm')); return m ? m[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter((l) => l && !l.startsWith('(')) : []; };
  return { status, allowed: sect('Allowed paths'), evidence: sect('Evidence').length, verdict: (sect('Reviewer verdict')[0] || '') };
}
export function system(root) { try { return JSON.parse(fs.readFileSync(path.join(root, '.claude/system.json'), 'utf8')); } catch { return {}; } }
export const globRe = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '(?:.*/)?').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
