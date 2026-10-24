#!/usr/bin/env node
// SessionStart: show only the task card, the top of NEXT, the mode. Small on purpose (runs on start, resume and compaction).
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { execSync, execFileSync } from 'node:child_process';
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const read = (p, n) => { try { const t = fs.readFileSync(path.join(root, p), 'utf8'); return n ? t.split('\n').slice(0, n).join('\n') : t; } catch { return `(missing: ${p})`; } };
const sh = (c) => { try { return execSync(c, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000 }).toString().trim(); } catch { return '?'; } };
let input = {}; try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch {}
// Automatic update: on a fresh chat, pull the master clone and run its installer when it holds a newer version. Needs no action from Shaun. Off with autoUpdate:false in system.json or AIS_NO_AUTOUPDATE=1.
const verNum = (v) => String(v || '').trim().split(/[-.]/).map(Number);
const newer = (a, b) => { const x = verNum(a), y = verNum(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0; } return false; };
const autoUpdate = () => {
  try {
    if (process.env.AIS_NO_AUTOUPDATE === '1' || !['startup', 'clear'].includes(String(input.source || 'startup'))) return '';
    let sys = {}; try { sys = JSON.parse(fs.readFileSync(path.join(root, '.claude/system.json'), 'utf8')); } catch {}
    if (sys.autoUpdate === false) return '';
    const master = String(sys.masterPath || '~/my-ai-system').replace(/^~/, os.homedir());
    if (!fs.existsSync(path.join(master, 'install.sh')) || path.resolve(master) === path.resolve(root)) return '';
    try { execFileSync('git', ['-C', master, 'pull', '--ff-only', '-q'], { timeout: 12000, stdio: 'ignore' }); } catch { /* offline or diverged: use what is there */ }
    const want = fs.readFileSync(path.join(master, 'VERSION'), 'utf8').trim(); let have = '0'; try { have = fs.readFileSync(path.join(root, '.claude/system-version'), 'utf8').trim(); } catch {}
    if (!want || !newer(want, have)) return '';
    execFileSync('bash', [path.join(master, 'install.sh'), root], { timeout: 25000, stdio: 'ignore' });
    return `The system updated itself from ${have} to ${want} at the start of this chat. The new rules text (CLAUDE.md) is read from the next chat; the checks already use the new version. The changed system files are uncommitted: include them in your next commit. You need not tell Shaun.`;
  } catch (e) { return `The automatic system update failed (${String(e.message || e).split('\n')[0].slice(0, 120)}). Tell Shaun in one plain sentence. Do not retry it yourself.`; }
};
const updated = autoUpdate();
const behind = (() => { if (sh('git rev-parse --is-inside-work-tree') !== 'true') return ''; sh('git fetch --quiet origin'); const n = Number(sh('git rev-list --count HEAD..@{upstream}')); return Number.isFinite(n) && n > 0 ? `WARNING: this folder is ${n} commit${n > 1 ? 's' : ''} behind GitHub. If git status is clean, run git pull --ff-only yourself now and say so in one line. If there are uncommitted changes, tell Shaun first. Do not work from stale files.` : ''; })();
const noVersion = fs.existsSync(path.join(root, '.claude/system-version')) ? '' : 'WARNING: .claude/system-version is missing, so the system may be half installed or an old copy. Tell Shaun first.';
const model = input.model || input.model_name || process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || '';
import { discussionOn } from './common.mjs';
const disc = discussionOn(root);
let auto = false; try { auto = !!JSON.parse(fs.readFileSync(path.join(root, '.claude/system.json'), 'utf8')).autopilot; } catch {}
const out = [
  ...[updated, behind, noVersion].filter(Boolean),
  ...(disc ? ['DISCUSSION MODE is ON: Shaun is thinking out loud. Be a constructive partner, read freely, give a view and a recommendation, change nothing (hooks block edits), no task card or Done. list, no generic opener, and no talk of your own pending work unless he asks or it bears on his topic. "go" or "task mode" from Shaun ends it.'] : []),
  `my-ai-system ${(() => { try { return fs.readFileSync(path.join(root, '.claude/system-version'), 'utf8').trim(); } catch { return '?'; } })()} session (${input.source || 'startup'}). Autopilot: ${auto ? 'ON (after DONE, start the top NEXT item that needs nothing from Shaun, no question)' : 'OFF (after DONE, list every startable NEXT item, numbered, and ask which numbers to run)'}. Git: ${sh('git rev-parse --abbrev-ref HEAD')} @ ${sh('git rev-parse --short HEAD')}, ${sh('git status --porcelain | wc -l')} uncommitted.`,
  `Chat model: ${model || 'not reported to this hook (say which you are on if you know)'}. Suggest the model that fits each task (docs/MODELS.md); only Shaun can switch it with /model. Helpers run on the model in their agent file.`,
  `Starting work: ${auto ? 'autopilot is ON: after a task is DONE with a reviewer PASS, start the top item of docs/NEXT.md that needs nothing from Shaun, without asking. Hard blocks and docs/RULINGS.md still apply.' : 'no task starts until Shaun says go in chat (a hook blocks Status: ACTIVE without it). Sharing information or a pasted reply is not a go. Name the task in one sentence and stop.'} docs/archive/ and old handoffs are history, never current state. docs/RULINGS.md holds Shaun's decisions: never propose work a ruling parks.`,
  'Do it yourself: run, open, check and test anything your tools can; never hand Shaun a step you can do or ask him to bring back a result. Only a password, money, a protected unlock, a decision or a physical step goes to him, once, with what you tried.',
  'Rules: one task (docs/TASK.md). Edits outside its Allowed paths are blocked. PROTECTED.md files, CLAUDE.md and .claude/ are hard-blocked. DONE needs Evidence + reviewer PASS. Never end a turn by announcing work.',
  '', '=== docs/PROJECT.md ===', read('docs/PROJECT.md', 12), '', '=== docs/SUBGOALS.md ===', read('docs/SUBGOALS.md', 12), '', '=== docs/RULINGS.md (last 12 lines) ===', read('docs/RULINGS.md').split('\n').filter((l) => l.trim() && !l.startsWith('#') && !l.startsWith('<!--')).slice(-12).join('\n') || '(none yet)', '', '=== docs/TASK.md ===', read('docs/TASK.md'), '', '=== docs/NEXT.md (top) ===', read('docs/NEXT.md', 16),
];
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: out.join('\n') } }));
