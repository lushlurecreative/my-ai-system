#!/usr/bin/env node
// PreToolUse for Agent/Task. The model comes from the helper's agent file (.claude/agents/<name>.md), not from whoever launches it.
// (1) A listed agent runs on its assigned model; asking for a different one is denied. (2) An unlisted helper type gets Sonnet; Opus/Fable are denied unless system.json allowExpensiveHelpers. (3) Cap on helper runs per session (system.json maxHelpers, default 6). Fails open.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import crypto from 'node:crypto';
import { deny, system, projectRoot, reviewNeeded, tickClock, taskTitle, cardId } from './common.mjs';
const norm = (m) => { const s = String(m || '').toLowerCase(); return /haiku/.test(s) ? 'haiku' : /sonnet/.test(s) ? 'sonnet' : /opus/.test(s) ? 'opus' : /fable/.test(s) ? 'fable' : ''; };
export function assignedModel(root, name) {
  if (!/^[\w-]+$/.test(name || '')) return '';
  try { const f = fs.readFileSync(path.join(root, '.claude/agents', `${name}.md`), 'utf8'); const fm = (f.match(/^---\n([\s\S]*?)\n---/) || [])[1] || ''; return norm((fm.match(/^model:\s*(.+)$/m) || [])[1]); } catch { return ''; }
}
export function decide(input, root) {
  const ti = input?.tool_input || {}; const sys = system(root); const asked = norm(ti.model); const name = String(ti.subagent_type || '').toLowerCase(); const own = assignedModel(root, name);
  tickClock(root);
  // Review discipline: no reviewer for docs-only work, the Opus reviewer only where money, logins, protected files or security are touched, at most two reviews per task, security reviewer only for security changes.
  if (name === 'reviewer' || name === 'reviewer-light' || name === 'security') {
    const need = reviewNeeded(root);
    if (name === 'security' && need !== 'full') return deny('The security reviewer runs only when the change touches money, logins, protected files or security. This one does not. Use the normal review.');
    if (name !== 'security') {
      if (need === 'none') return deny('This task is analysis or docs-only: no reviewer is needed. Tick the Done means lines with their evidence and write "Reviewer verdict: NOT REQUIRED (docs only)".');
      if (need === 'light' && name === 'reviewer') return deny('This change does not touch money, logins, protected files or security, so use the cheaper reviewer: subagent_type reviewer-light.');
      if (need === 'full' && name === 'reviewer-light') return deny('This change touches money, logins, protected files or security, so use the full reviewer: subagent_type reviewer.');
      const max = Number.isFinite(sys.maxReviews) ? sys.maxReviews : 2;
      const f = path.join(os.tmpdir(), `ais-reviews-${String(input?.session_id || 'x').replace(/[^\w-]/g, '')}-${cardId(root)}.count`);
      let n = 0; try { n = Number(fs.readFileSync(f, 'utf8')) || 0; } catch {}
      if (n >= max) return deny(`Two reviews per task is the limit. Do not review again. Fix every blocker the reviewer named, log its minors in docs/NEXT.md, and if a blocker is still open, stop and tell Shaun in one plain line what is open and why.`);
      try { fs.writeFileSync(f, String(n + 1)); } catch {}
    }
  }
  if (own) { if (asked && asked !== own) return deny(`${name} is assigned ${own} in .claude/agents/${name}.md. Launch it without a model. To change what it runs on, Shaun says "yes, add agent ${name}" and the file is edited.`); }
  else if (/opus|fable/.test(asked) && !sys.allowExpensiveHelpers) return deny(`A helper on ${ti.model} is blocked: it costs several times Sonnet. Use sonnet (or haiku for mechanical work), or a listed agent. Shaun can allow it with "allowExpensiveHelpers": true in .claude/system.json.`);
  if (name !== 'reviewer' && name !== 'reviewer-light') {
    const max = Number.isFinite(sys.maxHelpers) ? sys.maxHelpers : 6; let task = ''; try { task = (fs.readFileSync(path.join(root, 'docs/TASK.md'), 'utf8').match(/^Task:\s*\n\s*-\s*(.+)$/m) || [])[1] || ''; } catch {}
    const f = path.join(os.tmpdir(), `ais-agents-${String(input?.session_id || 'x').replace(/[^\w-]/g, '')}-${crypto.createHash('sha1').update(task).digest('hex').slice(0, 8)}.count`);
    let n = 0; try { n = Number(fs.readFileSync(f, 'utf8')) || 0; } catch {}
    if (n >= max) return deny(`Helper limit reached for this task (${max} runs). Work with what you have, or tell Shaun why more are needed. The reviewer is not counted and the limit restarts with the next task.`);
    try { fs.writeFileSync(f, String(n + 1)); } catch {}
  }
  if (own || asked) return null;
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput: { ...ti, model: 'sonnet' }, additionalContext: 'Helper model set to Sonnet (the default for an unlisted helper).' } };
}
if (import.meta.url === `file://${process.argv[1]}`) { try { const i = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); const r = decide(i, projectRoot(i.cwd)); if (r) process.stdout.write(JSON.stringify(r)); } catch {} }
