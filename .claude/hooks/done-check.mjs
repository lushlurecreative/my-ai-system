#!/usr/bin/env node
// Stop hook. (1) Ends by announcing work -> block (max 2 in a row per reason). (2) Claims done but TASK.md lacks Evidence or Reviewer PASS, or the reviewer agent never ran this session -> block once.
// (3) Autopilot off and TASK is DONE but no "which one?" handback -> block once. Fails open.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { readTask, system } from './common.mjs';
const MAX = 2;
const ANNOUNCE = /(?<!\b(?:whether|if) )\b(?:I'll|I will|I'm going to|I am going to|I'm about to|let me)\s+(?:now\s+|go ahead and\s+)?(?:dig|push|get started|check|verify|run|do|start|begin|fix|deploy|test|look|investigate|update|write|implement|continue)\b|\b(?:continuing|proceeding|moving on)\b[^.?!]{0,60}\b(?:now|next)\b|\bnow (?:I'll|let me|checking|running|verifying)\b/i;
const HANDOFF = /\?\s*$|\bblocked (?:on|by)\b|\b(?:once|after) you\b|\bwaiting (?:on|for)\b|\byour call\b|\bwhich one\b|\bNext, in order\b|\bstopp(?:ed|ing) (?:as|because) you\b/i;
const CLAIM = /\b(?:task (?:is )?(?:done|complete)|all done|is (?:now )?fixed|fixed\.|completed\.|finished\.|done\.)/i;
export function reviewerRan(transcriptPath) {
  try { return fs.readFileSync(transcriptPath, 'utf8').split('\n').some((l) => { try { const d = JSON.parse(l); return d.type === 'assistant' && Array.isArray(d.message?.content) && d.message.content.some((b) => b.type === 'tool_use' && /^(Agent|Task)$/.test(b.name) && /reviewer/i.test(JSON.stringify(b.input || {}))); } catch { return false; } }); } catch { return true; }
}
export function judge(message, root, transcriptPath) {
  const text = String(message || '').replace(/[‘’]/g, "'").trim(); if (!text) return null;
  const last = text.slice(-700).split(/\n\s*\n/).filter((p) => /[a-z]/i.test(p)).pop() || text.slice(-700);
  const spoken = last.replace(/"[^"\n]*"|`[^`\n]*`/g, ' ');
  if (!HANDOFF.test(last) && ANNOUNCE.test(spoken)) return `Your reply ends by announcing work ("${spoken.match(ANNOUNCE)[0]}") instead of doing it. Do it now, or end in a valid stop: done with evidence + next-3 question, a question only Shaun can answer, or a named blocker.`;
  const t = readTask(root);
  if (CLAIM.test(spoken)) {
    if (t.status !== 'DONE' || t.evidence === 0) return `You said it is done, but docs/TASK.md is ${t.status} with ${t.evidence} evidence lines. Add the evidence (test output, screenshot path, live URL and result) and set Status: DONE, or do not claim done.`;
    if (!/PASS/i.test(t.verdict)) return `TASK.md has no "Reviewer verdict: PASS". Launch the reviewer agent (Agent tool, subagent_type reviewer) to grade the task against "Done means", record its verdict in TASK.md, then finish.`;
    if (transcriptPath && !reviewerRan(transcriptPath)) return 'TASK.md says the reviewer passed, but no reviewer agent ran in this session. Run it now and record the real verdict.';
  }
  if (t.status === 'DONE' && !system(root).autopilot && !/\bwhich one\b/i.test(last)) return 'Task is DONE and autopilot is off: end with "Done. Next, in order, I\'d do A, B or C, because …. Which one?" using docs/NEXT.md, then stop.';
  return null;
}
function main() {
  let input = {}; try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { return; }
  const root = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd(); const file = path.join(os.tmpdir(), `ais-stop-${String(input.session_id || 'x').replace(/[^\w-]/g, '')}.count`);
  const reason = judge(input.last_assistant_message, root, input.transcript_path);
  if (!reason) { try { fs.rmSync(file, { force: true }); } catch {} return; }
  // Count repeats of the SAME reason only; a new reason starts a new count, so one cap cannot be spent on an earlier, different block.
  let n = 0; try { const [k, c] = fs.readFileSync(file, 'utf8').split('\n'); if (k === reason.slice(0, 40)) n = Number(c) || 0; } catch {}
  if (n >= MAX) { try { fs.rmSync(file, { force: true }); } catch {} return; }
  try { fs.writeFileSync(file, `${reason.slice(0, 40)}\n${n + 1}`); } catch { return; }
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}
if (import.meta.url === `file://${process.argv[1]}`) { try { main(); } catch { /* fail open */ } }
