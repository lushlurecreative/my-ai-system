#!/usr/bin/env node
// PreToolUse: one task at a time, enforced. Decisions are DENY (in auto mode an "ask" is answered by the machine). Fails open on crash.
import fs from 'node:fs';
import { lists, SELF, SELF_DIRS } from './protected-list.mjs';
import { isOverridden } from './override.mjs';
import { deny, rel, readTask, readToolbox, readApprovals, globRe } from './common.mjs';
const ALWAYS_OK = [/^docs\/(TASK|NEXT|PROJECT|TOOLBOX|SUBGOALS)\.md$/, /^docs\/notes\//];
export function checkEdit(root, filePath) {
  const r = rel(root, filePath);
  if (r.startsWith('..')) return deny(`Edits outside the project (${r}) are not allowed.`);
  const am = r.match(/^\.claude\/agents\/([\w-]+)\.md$/); if (am && readApprovals(root).includes('agent:' + am[1].toLowerCase())) return null;
  if (SELF.includes(r) || SELF_DIRS.some((d) => r.startsWith(d))) return isOverridden(root, r) ? null : deny(`${r} is the system's own rules/hooks. Only Shaun edits these (unlock: .claude/override.txt "allow: ${r}").`);
  const P = lists(root);
  if (P.files.some((f) => r === f || globRe(f).test(r))) return isOverridden(root, r) ? null : deny(`${r} is PROTECTED (PROTECTED.md). Hard block. Tell Shaun in one sentence what change you need; he unlocks with .claude/override.txt "allow: ${r}".`);
  if (/^supabase\/migrations\/.+\.sql$/.test(r) || /migrations\/.+\.sql$/.test(r)) { /* migration content is checked by protected-paths */ }
  if (ALWAYS_OK.some((x) => x.test(r))) return null;
  const t = readTask(root);
  if (t.status !== 'ACTIVE') return deny(`No ACTIVE task in docs/TASK.md (status ${t.status}). Write the task there first (one task, questions, allowed paths, done-means), get Shaun's answers, set Status: ACTIVE, then edit code.`);
  if (t.type === 'ANALYSIS' && !r.startsWith('docs/')) return deny(`This is an ANALYSIS task. Analysis looks and reports; it changes only docs/ (findings go in docs/NEXT.md). ${r} is not in docs/. Record it as a finding instead.`);
  if (t.type !== 'ANALYSIS') { const tb = checkTools(root, t); if (tb) return tb; }
  if (!t.allowed.some((g) => globRe(g).test(r))) return deny(`${r} is outside this task's Allowed paths. If it needs work, add one line under "Parked ideas" in docs/NEXT.md and continue the task. If it IS part of the task, add the path under "Allowed paths:" in TASK.md and say so to Shaun.`);
  return null;
}
function checkTools(root, t) {
  if (!t.tools) return deny('docs/TASK.md has no "Tools needed:" list. Under it, list each tool this task needs (name as in docs/TOOLBOX.md), or "- none" when the built-ins are enough. Then set Status: ACTIVE again.');
  if (t.tools.length === 1 && /^(none|built-?ins?)$/i.test(t.tools[0])) return null;
  const box = readToolbox(root);
  for (const name of t.tools) {
    const st = box[name.toLowerCase()];
    if (!st) return deny(`Tool "${name}" is not in docs/TOOLBOX.md. Add it there with status "known" and a one-line check that proves it works, or correct the name in TASK.md.`);
    if (st !== 'working') return deny(`Tool "${name}" is ${st}, not working. Do not improvise around it. Tell Shaun in plain words, then either put "set up ${name}" first (his steps spelled out) or switch to a tool that is working and update "Tools needed".`);
  }
  return null;
}
// Adding software: npm/yarn/pnpm/bun add of a package, pip/pipx/uv, brew/apt/cargo/go, claude mcp/plugin add, npx -y, or piping a download into a shell.
const INSTALL = /\b(?:npm\s+(?:install|i|add)\s+(?:-\S+\s+)*[@\w]|yarn\s+add\s|pnpm\s+(?:add|install|i)\s+(?:-\S+\s+)*[@\w]|bun\s+(?:add|install|i)\s+(?:-\S+\s+)*[@\w]|pipx?\s+install\b|pip3\s+install\b|uv\s+(?:pip\s+install|add|tool\s+install)\b|brew\s+install\b|apt(?:-get)?\s+install\b|cargo\s+install\b|go\s+install\b|claude\s+(?:mcp\s+add|plugins?\s+(?:install|add))\b|npx\s+(?:-y|--yes)\b|(?:curl|wget)\b[^|;&]*\|\s*(?:ba|z)?sh\b)/i;
function checkInstall(root, c) {
  if (!INSTALL.test(c)) return null;
  const lower = c.toLowerCase(); if (readApprovals(root).some((n) => lower.includes(n))) return null;
  return deny('Installing software needs Shaun\'s yes. Tell him in two lines what you want to install and why. He answers in chat, for example "yes, install <name>", and then this command is allowed. Never work around this.');
}
export function checkBash(root, cmd) {
  const c = String(cmd || '');
  const inst = checkInstall(root, c); if (inst) return inst;
  if (/\bgit\s+push\b/.test(c)) {
    if (/\s(-f|--force|--force-with-lease)\b|\s\+\w/.test(c)) return deny('Force push is never allowed.');
    const toMain = /\bmain\b|\bmaster\b/.test(c) || !/\bgit\s+push\s+\S+\s+\S+/.test(c);
    if (toMain) { const t = readTask(root); if (t.status !== 'DONE' || t.evidence === 0 || !/PASS/i.test(t.verdict)) return deny(`Push to main is allowed only when docs/TASK.md is DONE with Evidence and a Reviewer verdict PASS (now: ${t.status}, ${t.evidence} evidence lines, verdict "${t.verdict || 'none'}").`); }
  }
  if (/\brm\s+-[a-zA-Z]*r[a-zA-Z]*f|\brm\s+-[a-zA-Z]*f[a-zA-Z]*r|\bgit\s+reset\s+--hard|\bgit\s+checkout\s+--\s+\.|\bgit\s+clean\s+-[a-zA-Z]*f|\bdb\s+reset\b|\bdrop\s+(table|schema|database)\b|\btruncate\s+table\b/i.test(c)) return deny('Destructive command blocked (rm -rf, git reset --hard, git clean, db reset, DROP, TRUNCATE). Ask Shaun.');
  if ([...SELF, ...SELF_DIRS].some((s) => c.includes(s)) && /(>>?|\btee\b|\bsed\s+-i|\bmv\b|\bcp\b|\brm\b|<<|\bwriteFile)/.test(c)) return deny('Shell writes to CLAUDE.md, PROTECTED.md or .claude/ are not allowed. Only Shaun edits the rules.');
  return null;
}
export function check(input) {
  const root = input?.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd(); const name = String(input?.tool_name || ''); const ti = input?.tool_input || {};
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(name)) return checkEdit(root, ti.file_path || ti.notebook_path);
  if (name === 'Bash') return checkBash(root, ti.command);
  return null;
}
if (import.meta.url === `file://${process.argv[1]}`) { try { const r = check(JSON.parse(fs.readFileSync(0, 'utf8') || '{}')); if (r) process.stdout.write(JSON.stringify(r)); } catch { /* fail open */ } }
