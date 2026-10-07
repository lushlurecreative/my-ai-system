#!/usr/bin/env node
// PreToolUse for Agent/Task: a helper launched without a model gets Sonnet. Never blocks. Fails open.
import fs from 'node:fs';
export function decide(input) { const ti = input?.tool_input || {}; if (ti.model && String(ti.model).toLowerCase() !== 'inherit') return null;
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput: { ...ti, model: 'sonnet' }, additionalContext: 'Helper model set to Sonnet (the default for normal work).' } }; }
if (import.meta.url === `file://${process.argv[1]}`) { try { const r = decide(JSON.parse(fs.readFileSync(0, 'utf8') || '{}')); if (r) process.stdout.write(JSON.stringify(r)); } catch {} }
