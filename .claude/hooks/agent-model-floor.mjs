#!/usr/bin/env node
// PreToolUse for Agent/Task: (1) helper with no model -> Sonnet. (2) Opus/Fable helpers denied unless system.json allowExpensiveHelpers. (3) cap on helper runs per session (system.json maxHelpers, default 6). Fails open.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { deny, system } from './common.mjs';
export function decide(input, root) {
  const ti = input?.tool_input || {}; const sys = system(root); const model = String(ti.model || '').toLowerCase();
  if (/opus|fable/.test(model) && !sys.allowExpensiveHelpers) return deny(`A helper on ${ti.model} is blocked: it costs several times Sonnet. Use sonnet (or haiku for mechanical work). Shaun can allow it with "allowExpensiveHelpers": true in .claude/system.json.`);
  const max = Number.isFinite(sys.maxHelpers) ? sys.maxHelpers : 6; const f = path.join(os.tmpdir(), `ais-agents-${String(input?.session_id || 'x').replace(/[^\w-]/g, '')}.count`);
  let n = 0; try { n = Number(fs.readFileSync(f, 'utf8')) || 0; } catch {}
  if (n >= max) return deny(`Helper limit reached (${max} runs this session). Work with what you have, or tell Shaun why more are needed; he can raise "maxHelpers" in .claude/system.json.`);
  try { fs.writeFileSync(f, String(n + 1)); } catch {}
  if (model && model !== 'inherit') return null;
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput: { ...ti, model: 'sonnet' }, additionalContext: 'Helper model set to Sonnet (the default for normal work).' } };
}
if (import.meta.url === `file://${process.argv[1]}`) { try { const i = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); const r = decide(i, i.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd()); if (r) process.stdout.write(JSON.stringify(r)); } catch {} }
