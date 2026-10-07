// Proves the guards block what they must and allow what they must. Run: node scripts/test-hooks.mjs
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { execSync } from 'node:child_process';
const SRC = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'ais-test-')); execSync(`bash "${SRC}/install.sh" "${T}"`, { stdio: 'ignore' }); execSync('git init -q -b main', { cwd: T });
fs.mkdirSync(path.join(T, 'src/pages'), { recursive: true }); fs.mkdirSync(path.join(T, 'src/lib'), { recursive: true });
fs.writeFileSync(path.join(T, 'PROTECTED.md'), '# P\n\n## Protected files\n- `src/lib/pricing.ts`\n\n## Protected database functions\n- `user_has_entitlement`\n\n## Protected words\n- `checkout`\n');
const run = (hook, input) => { try { const out = execSync(`node "${T}/.claude/hooks/${hook}"`, { input: JSON.stringify({ cwd: T, session_id: 't1', ...input }), encoding: 'utf8' }); return out ? JSON.parse(out) : null; } catch (e) { return { crash: String(e) }; } };
const decision = (r) => r?.hookSpecificOutput?.permissionDecision || r?.decision || (r?.crash ? 'CRASH' : 'allow');
let pass = 0, fail = 0; const t = (name, got, want) => { const ok = got === want; ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (got ${got}, want ${want})`); };
const edit = (p) => run('scope-guard.mjs', { tool_name: 'Edit', tool_input: { file_path: path.join(T, p) } });
const bash = (c) => run('scope-guard.mjs', { tool_name: 'Bash', tool_input: { command: c } });
const pp = (name, ti) => run('protected-paths.mjs', { tool_name: name, tool_input: ti });
const stop = (msg) => run('done-check.mjs', { last_assistant_message: msg });
const task = (status, allowed, evidence, verdict) => fs.writeFileSync(path.join(T, 'docs/TASK.md'), `# Current task\n\nStatus: ${status}\n\nTask:\n- x\n\nAllowed paths:\n${allowed.map((a) => `- ${a}`).join('\n')}\n\nDone means:\n- y\n\nEvidence:\n${evidence.map((e) => `- ${e}`).join('\n')}\n\nReviewer verdict:\n- ${verdict}\n`);
// no task
task('NONE', [], [], ''); t('edit with no task -> deny', decision(edit('src/pages/Home.tsx')), 'deny');
t('edit docs/NEXT.md with no task -> allow', decision(edit('docs/NEXT.md')), 'allow');
// active task
task('ACTIVE', ['src/pages/**'], [], ''); t('edit inside allowed -> allow', decision(edit('src/pages/Home.tsx')), 'allow');
t('edit outside allowed -> deny', decision(edit('src/lib/other.ts')), 'deny');
t('edit protected even if allowed -> deny', decision(run('scope-guard.mjs', { tool_name: 'Edit', tool_input: { file_path: path.join(T, 'src/lib/pricing.ts') } })), 'deny');
t('edit CLAUDE.md -> deny', decision(edit('CLAUDE.md')), 'deny'); t('edit hook -> deny', decision(edit('.claude/hooks/scope-guard.mjs')), 'deny');
fs.writeFileSync(path.join(T, '.claude/override.txt'), 'allow: src/lib/pricing.ts\n'); task('ACTIVE', ['src/lib/pricing.ts'], [], '');
t('protected with override -> allow', decision(edit('src/lib/pricing.ts')), 'allow'); fs.rmSync(path.join(T, '.claude/override.txt'));
// bash
t('force push -> deny', decision(bash('git push -f origin main')), 'deny'); t('push main while ACTIVE -> deny', decision(bash('git push origin main')), 'deny');
task('DONE', ['src/pages/**'], ['tests 12/12 pass'], 'PASS 2026-10-07 all claims verified'); t('push main when DONE+PASS -> allow', decision(bash('git push origin main')), 'allow');
t('rm -rf -> deny', decision(bash('rm -rf node_modules')), 'deny'); t('shell write to CLAUDE.md -> deny', decision(bash('echo x >> CLAUDE.md')), 'deny'); t('ls -> allow', decision(bash('ls -la')), 'allow');
t('sed -i protected -> deny', decision(pp('Bash', { command: 'sed -i "s/a/b/" src/lib/pricing.ts' })), 'deny'); t('cat protected -> allow', decision(pp('Bash', { command: 'cat src/lib/pricing.ts' })), 'allow');
t('lovable message naming checkout -> deny', decision(pp('mcp__Lovable__send_message', { message: 'please rework the checkout flow' })), 'deny'); t('lovable message harmless -> allow', decision(pp('mcp__Lovable__send_message', { message: 'change the hero color to blue' })), 'allow');
t('destructive SQL -> deny', decision(pp('mcp__Lovable__query_database', { query: 'DROP TABLE users' })), 'deny'); t('select SQL -> allow', decision(pp('mcp__Lovable__query_database', { query: 'select count(*) from deals' })), 'allow');
// stop
task('ACTIVE', ['src/pages/**'], [], ''); t('announce -> block', decision(stop("Found the bug. I'll now fix the layout and run tests.")), 'block'); t('question -> allow', decision(stop('Should the price show monthly or yearly?')), 'allow');
t('claims done without evidence -> block', decision(stop('The layout is fixed.')), 'block');
task('DONE', ['src/pages/**'], ['screenshot docs/notes/x.png'], ''); t('done without reviewer -> block', decision(stop('Done.')), 'block');
task('DONE', ['src/pages/**'], ['screenshot docs/notes/x.png'], 'PASS'); t('done, no next-3 question, autopilot off -> block', decision(stop('Done. All good.')), 'block');
t('done with next-3 question -> allow', decision(stop("Done. Next, in order, I'd do A, B or C, because A blocks sign-ups. Which one?")), 'allow');
fs.rmSync(T, { recursive: true, force: true }); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
