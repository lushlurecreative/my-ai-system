#!/usr/bin/env node
// SessionStart: show only the task card, the top of NEXT, the mode. Small on purpose (runs on start, resume and compaction).
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process';
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const read = (p, n) => { try { const t = fs.readFileSync(path.join(root, p), 'utf8'); return n ? t.split('\n').slice(0, n).join('\n') : t; } catch { return `(missing: ${p})`; } };
const sh = (c) => { try { return execSync(c, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000 }).toString().trim(); } catch { return '?'; } };
let input = {}; try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch {}
let auto = false; try { auto = !!JSON.parse(fs.readFileSync(path.join(root, '.claude/system.json'), 'utf8')).autopilot; } catch {}
const out = [
  `my-ai-system ${(() => { try { return fs.readFileSync(path.join(root, '.claude/system-version'), 'utf8').trim(); } catch { return '?'; } })()} session (${input.source || 'startup'}). Autopilot: ${auto ? 'ON (take the top NEXT item after DONE)' : 'OFF (suggest next 3, then stop)'}. Git: ${sh('git rev-parse --abbrev-ref HEAD')} @ ${sh('git rev-parse --short HEAD')}, ${sh('git status --porcelain | wc -l')} uncommitted.`,
  `Chat model: ${input.model || 'unknown to this hook'}. Suggest the model that fits each task (docs/MODELS.md); only Shaun can switch it with /model. Helpers run on the model in their agent file.`,
  'Rules: one task (docs/TASK.md). Edits outside its Allowed paths are blocked. PROTECTED.md files, CLAUDE.md and .claude/ are hard-blocked. DONE needs Evidence + reviewer PASS. Never end a turn by announcing work.',
  '', '=== docs/PROJECT.md ===', read('docs/PROJECT.md', 12), '', '=== docs/SUBGOALS.md ===', read('docs/SUBGOALS.md', 12), '', '=== docs/TASK.md ===', read('docs/TASK.md'), '', '=== docs/NEXT.md (top) ===', read('docs/NEXT.md', 16),
];
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: out.join('\n') } }));
