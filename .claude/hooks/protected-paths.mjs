#!/usr/bin/env node
// PreToolUse: the OTHER doors to a protected asset: shell writes, git commit/push of protected files, connector messages naming protected words, destructive SQL. DENY. Fails open.
import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
import { lists } from './protected-list.mjs'; import { isOverridden, allowedDb, allowedWords, allowedMigrations } from './override.mjs'; import { deny, globRe } from './common.mjs';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const DESTRUCTIVE = /(?<![A-Za-z_])(delete\s+from|drop\s+(?:table|function|schema|policy|trigger|view|index|column)|truncate|alter\s+(?:table|function|policy|role)|grant|revoke|create\s+or\s+replace\s+function)(?![A-Za-z_])/i;
const WRITES = [/\bsed\s+(?:\S+\s+)*?(?:-[a-zA-Z]*i\b|--in-place)/, /\bperl\s+-[a-zA-Z]*i/, /\btee\b/, /\bcp\b/, /\bmv\b/, /\brm\b/, /\bpatch\b/, /\bgit\s+(?:checkout|restore|apply|am|rm|mv|reset)\b/, />>?/];
const gitv = (args, cwd) => { try { return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000 }).toString().split('\n').map((x) => x.trim()).filter(Boolean); } catch { return []; } };
// Only the files this command will actually commit or push. Untracked folders that nothing stages are never looked at.
const tokens = (seg) => (seg.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((t) => t.replace(/^["']|["']$/g, ''));
const VALUE_FLAG = /^(-m|-F|-C|-c|--message|--file|--author|--date|--template|--reuse-message|--reedit-message|--cleanup|--trailer)$/;
export function gitFiles(cmd, cwd) {
  const out = new Set(); const add = (a) => a.forEach((f) => out.add(f)); const staging = /\bgit\b[^|;&]*?\bcommit\b/.test(cmd);
  if (staging) add(gitv(['diff', '--cached', '--name-only'], cwd));
  for (const seg of String(cmd).split(/&&|\|\||;|\n|\|/)) {
    const t = tokens(seg.trim()); const g = t.indexOf('git'); if (g < 0) continue; const rest = t.slice(g + 1); let k = 0; while (k < rest.length && rest[k].startsWith('-')) k += /^-[Cc]$/.test(rest[k]) ? 2 : 1; const verb = rest[k]; const args = rest.slice(k + 1);
    if (verb === 'add') {
      const flags = args.filter((a) => a.startsWith('-')); const paths = args.filter((a) => !a.startsWith('-'));
      if (flags.some((f) => /^(-A|--all)$/.test(f)) || paths.includes('.')) { add(gitv(['ls-files', '--others', '--exclude-standard'], cwd)); add(gitv(['diff', '--name-only'], cwd)); }
      else if (flags.some((f) => /^(-u|--update)$/.test(f))) add(gitv(['diff', '--name-only'], cwd));
      for (const pth of paths) if (pth !== '.') { add(gitv(['ls-files', '-m', '-o', '--exclude-standard', '--', pth], cwd)); add([pth]); }
    } else if (verb === 'commit') {
      let all = false, skip = false, dd = false; const paths = [];
      for (const a of args) { if (skip) { skip = false; continue; } if (a === '--') { dd = true; continue; } if (!dd && a.startsWith('-')) { if (a === '--all' || /^-[a-zA-Z]*a[a-zA-Z]*$/.test(a)) all = true; if (VALUE_FLAG.test(a) || /^-[a-zA-Z]*[mFCc]$/.test(a)) skip = true; } else paths.push(a); }
      if (all) add(gitv(['diff', '--name-only'], cwd));
      for (const pth of paths) { add(gitv(['ls-files', '-m', '-o', '--exclude-standard', '--', pth], cwd)); add([pth]); }
    } else if (verb === 'push') {
      const up = gitv(['rev-parse', '--abbrev-ref', '@{upstream}'], cwd).length ? '@{upstream}..HEAD' : 'origin/main..HEAD'; add(gitv(['diff', '--name-only', up], cwd));
    }
  }
  return out;
}
export function check(input) {
  const name = String(input?.tool_name || ''); const ti = input?.tool_input || {}; const cwd = input?.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const P = lists(cwd); const plain = P.files.filter((f) => !f.includes('*')); const prefixes = P.files.filter((f) => f.includes('*')).map((f) => f.split('*')[0]).filter((x) => x.length >= 4); const names = [...plain, ...plain.map((f) => f.split('/').pop())].filter(Boolean); const shellNames = [...names, ...prefixes];
  const isProt = (f) => P.files.some((g) => f === g || globRe(g).test(f));
  if (name === 'Bash') {
    const cmd = String(ti.command || '');
    const hit = shellNames.find((n) => cmd.includes(n) && WRITES.some((w) => w.test(cmd)));
    if (hit && !isOverridden(cwd, hit)) return deny(`This shell command may change the protected asset ${hit}. Hard block (PROTECTED.md).`);
    const okDb = allowedDb(cwd); const okMig = allowedMigrations(cwd); const dbfn = P.db.find((f) => cmd.includes(f) && !okDb.includes(f)); if (dbfn && /migrations\//.test(cmd)) return deny(`This writes a migration touching protected DB function ${dbfn}.`);
    if (okMig.length && /migrations\//.test(cmd) && P.db.some((f) => cmd.includes(f) && okDb.includes(f)) && !okMig.some((m) => cmd.includes(m) || cmd.includes(m.split('/').pop()))) return deny('This writes a migration touching a protected DB function, but override.txt (allow-migration) names a different migration file.');
    if (/\bgit\b[^|;&]*?\b(commit|push)\b/.test(cmd)) {
      const files = gitFiles(cmd, cwd);
      const open = [...files].filter((f) => isProt(f) && !isOverridden(cwd, f));
      const okDb = allowedDb(cwd); const okMig = allowedMigrations(cwd); let usingAllowed = 0;
      for (const f of files) if (/migrations\/.+\.sql$/.test(f)) { try { const b = fs.readFileSync(`${cwd}/${f}`, 'utf8'); const hit = P.db.filter((d) => b.includes(d)); if (hit.some((d) => !okDb.includes(d))) open.push(f); else if (hit.length) { if (okMig.length && !okMig.some((m) => f === m || f.endsWith('/' + m))) open.push(f); else usingAllowed++; } } catch {} }
      if (usingAllowed > 1) return deny(`Only ONE migration may touch the protected database functions allowed in .claude/override.txt (allow-db); this ${/\bpush\b/.test(cmd) ? 'push' : 'commit'} has ${usingAllowed}.`);
      if (open.length) return deny(`This git ${/\bpush\b/.test(cmd) ? 'push' : 'commit'} includes protected file(s): ${open.join(', ')}.`);
    }
    return null;
  }
  if (/__send_message$/.test(name)) {
    const msg = String(ti.message || ti.prompt || ''); const okW = allowedWords(cwd); const w = [...P.words.filter((x) => !okW.includes(x.toLowerCase())), ...names].find((x) => new RegExp(`(?<![A-Za-z])${esc(x)}(?![A-Za-z])`, 'i').test(msg));
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
