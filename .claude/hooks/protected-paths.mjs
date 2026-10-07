#!/usr/bin/env node
// PreToolUse: the OTHER doors to a protected asset: shell writes, git commit/push of protected files, connector messages naming protected words, destructive SQL. DENY. Fails open.
import fs from 'node:fs'; import { execSync } from 'node:child_process';
import { lists } from './protected-list.mjs'; import { isOverridden } from './override.mjs'; import { deny } from './common.mjs';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const DESTRUCTIVE = /(?<![A-Za-z_])(delete\s+from|drop\s+(?:table|function|schema|policy|trigger|view|index|column)|truncate|alter\s+(?:table|function|policy|role)|grant|revoke|create\s+or\s+replace\s+function)(?![A-Za-z_])/i;
const WRITES = [/\bsed\s+(?:\S+\s+)*?(?:-[a-zA-Z]*i\b|--in-place)/, /\bperl\s+-[a-zA-Z]*i/, /\btee\b/, /\bmv\b/, /\brm\b/, /\bpatch\b/, /\bgit\s+(?:checkout|restore|apply|am|rm|mv|reset)\b/, />>?/];
function git(args, cwd) { try { return execSync(`git ${args}`, { cwd, stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000 }).toString().split('\n').map((s) => s.trim()).filter(Boolean); } catch { return []; } }
export function check(input) {
  const name = String(input?.tool_name || ''); const ti = input?.tool_input || {}; const cwd = input?.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const P = lists(cwd); const names = [...P.files, ...P.files.map((f) => f.split('/').pop())].filter(Boolean);
  if (name === 'Bash') {
    const cmd = String(ti.command || '');
    const hit = names.find((n) => cmd.includes(n) && WRITES.some((w) => w.test(cmd)));
    if (hit && !isOverridden(cwd, hit)) return deny(`This shell command may change the protected asset ${hit}. Hard block (PROTECTED.md).`);
    const dbfn = P.db.find((f) => cmd.includes(f)); if (dbfn && /migrations\//.test(cmd)) return deny(`This writes a migration touching protected DB function ${dbfn}.`);
    if (/\bgit\b[^|;&]*?\b(commit|push)\b/.test(cmd)) {
      const files = new Set([...git('diff HEAD --name-only', cwd), ...git('diff --cached --name-only', cwd), ...git('ls-files --others --exclude-standard', cwd), ...(/\bpush\b/.test(cmd) ? git('diff --name-only origin/main..HEAD', cwd) : [])]);
      const open = P.files.filter((f) => files.has(f) && !isOverridden(cwd, f));
      for (const f of files) if (/migrations\/.+\.sql$/.test(f)) { try { const b = fs.readFileSync(`${cwd}/${f}`, 'utf8'); if (P.db.some((d) => b.includes(d))) open.push(f); } catch {} }
      if (open.length) return deny(`This git ${/\bpush\b/.test(cmd) ? 'push' : 'commit'} includes protected file(s): ${open.join(', ')}.`);
    }
    return null;
  }
  if (/__send_message$/.test(name)) {
    const msg = String(ti.message || ti.prompt || ''); const w = [...P.words, ...names].find((x) => new RegExp(`(?<![A-Za-z])${esc(x)}(?![A-Za-z])`, 'i').test(msg));
    return w ? deny(`This connector request mentions "${w}", a protected area (PROTECTED.md).`) : null;
  }
  if (/__(query_database|execute_sql|apply_migration|run_sql)$/.test(name)) {
    const sql = String(ti.sql || ti.query || '');
    const fn = P.db.find((f) => sql.includes(f)); if (fn && !/^\s*(select|with)\b/i.test(sql)) return deny(`This SQL touches protected DB function ${fn}.`);
    const d = sql.match(DESTRUCTIVE); if (d) return deny(`Destructive SQL blocked ("${d[1]}"). Ask Shaun.`);
    if (/^\s*update\b/i.test(sql) && !/\bwhere\b/i.test(sql)) return deny('UPDATE without WHERE blocked.');
  }
  return null;
}
if (import.meta.url === `file://${process.argv[1]}`) { try { const r = check(JSON.parse(fs.readFileSync(0, 'utf8') || '{}')); if (r) process.stdout.write(JSON.stringify(r)); } catch { /* fail open */ } }
