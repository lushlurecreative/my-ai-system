#!/usr/bin/env node
// PreToolUse for Agent/Task. The model comes from the helper's agent file (.claude/agents/<name>.md), not from whoever launches it.
// (1) A listed agent runs on its assigned model; asking for a different one is denied. (2) An unlisted helper type gets Sonnet; Opus/Fable are denied unless system.json allowExpensiveHelpers. (3) Cap on helper runs per session (system.json maxHelpers, default 6). Fails open.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { deny, system } from './common.mjs';
const norm = (m) => { const s = String(m || '').toLowerCase(); return /haiku/.test(s) ? 'haiku' : /sonnet/.test(s) ? 'sonnet' : /opus/.test(s) ? 'opus' : /fable/.test(s) ? 'fable' : ''; };
export function assignedModel(root, name) {
  if (!/^[\w-]+$/.test(name || '')) return '';
  try { const f = fs.readFileSync(path.join(root, '.claude/agents', `${name}.md`), 'utf8'); const fm = (f.match(/^---\n([\s\S]*?)\n---/) || [])[1] || ''; return norm((fm.match(/^model:\s*(.+)$/m) || [])[1]); } catch { return ''; }
}
export function decide(input, root) {
  const ti = input?.tool_input || {}; const sys = system(root); const asked = norm(ti.model); const name = String(ti.subagent_type || '').toLowerCase(); const own = assignedModel(root, name);
  if (own) { if (asked && asked !== own) return deny(`${name} is assigned ${own} in .claude/agents/${name}.md. Launch it without a model. To change what it runs on, Shaun says "yes, add agent ${name}" and the file is edited.`); }
  else if (/opus|fable/.test(asked) && !sys.allowExpensiveHelpers) return deny(`A helper on ${ti.model} is blocked: it costs several times Sonnet. Use sonnet (or haiku for mechanical work), or a listed agent. Shaun can allow it with "allowExpensiveHelpers": true in .claude/system.json.`);
  const max = Number.isFinite(sys.maxHelpers) ? sys.maxHelpers : 6; const f = path.join(os.tmpdir(), `ais-agents-${String(input?.session_id || 'x').replace(/[^\w-]/g, '')}.count`);
  let n = 0; try { n = Number(fs.readFileSync(f, 'utf8')) || 0; } catch {}
  if (n >= max) return deny(`Helper limit reached (${max} runs this session). Work with what you have, or tell Shaun why more are needed; he can raise "maxHelpers" in .claude/system.json.`);
  try { fs.writeFileSync(f, String(n + 1)); } catch {}
  if (own || asked) return null;
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput: { ...ti, model: 'sonnet' }, additionalContext: 'Helper model set to Sonnet (the default for an unlisted helper).' } };
}
if (import.meta.url === `file://${process.argv[1]}`) { try { const i = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); const r = decide(i, i.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd()); if (r) process.stdout.write(JSON.stringify(r)); } catch {} }
