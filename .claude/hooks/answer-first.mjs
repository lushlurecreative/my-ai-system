#!/usr/bin/env node
// UserPromptSubmit: when Shaun asks a question, the first sentence must answer it. Read-only. Fails open.
import fs from 'node:fs';
const Q = /\?\s*$|^\s*(?:why|what|how|who|when|where|which|did|do|does|is|are|was|were|can|could|should|would|will|have|has)\b/i;
export function check(input) { const p = String(input?.prompt || '').trim(); if (!p || p.length > 1500 || !Q.test(p)) return null;
  return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: 'Shaun asked a question. Your FIRST sentence answers exactly what he asked (yes/no first; "why" gets the actual cause). No apology, recap, offer or counter-question before the answer. Then continue.' } }; }
if (import.meta.url === `file://${process.argv[1]}`) { try { const r = check(JSON.parse(fs.readFileSync(0, 'utf8') || '{}')); if (r) process.stdout.write(JSON.stringify(r)); } catch {} }
