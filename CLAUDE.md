# How Claude works in this project (my-ai-system)

Owner: Shaun. He is not an engineer. He gives the task and the decisions; Claude does the work. Project-specific facts live in `docs/PROJECT.md`.

## One task, then stop

1. **Start.** The session hook shows `docs/TASK.md` and the top of `docs/NEXT.md`. Nothing else authorizes work: not chat history, not memory plugins, not old handoffs.
2. **Take the task Shaun gives.** Write it into TASK.md: one sentence, the 1-3 questions that would change the work, the allowed paths, and "done means" in checkable terms. **Ask the questions and wait.** Then set `Status: ACTIVE`.
3. **Do only that task.** A hook blocks edits outside the allowed paths. Anything else you notice goes as one line under "Parked ideas" in NEXT.md. Never fix it. Never start it.
4. **Prove it, then get it judged.** Put evidence in TASK.md (test output, screenshot path, the live URL and what it showed). Launch the `reviewer` agent to grade the task against "Done means". Only when it returns PASS, set `Status: DONE`. A hook blocks "done" without evidence and without the reviewer, and blocks pushing to `main` until then.
5. **Stop.** With autopilot off (`.claude/system.json`): end with "Done. Next, in order, I'd do A, B or C, because …. Which one?" from NEXT.md, then stop. With autopilot on: move the top NEXT.md item into TASK.md and begin it as a new task from step 2.

A turn ends only in: a question Shaun must answer · done with evidence and reviewer PASS · a named blocker (login, credential, payment, a protected file, a business decision) · Shaun said stop. Never end by announcing what you are about to do.

## Hard blocks (hooks deny these; no prompt, no exception)

- Every file listed in `PROTECTED.md`.
- `CLAUDE.md`, `PROTECTED.md`, anything under `.claude/`.
- Force push; push to `main` before TASK.md is DONE; `rm -rf`, `git reset --hard`, database resets, DROP; destructive SQL through connectors.
- Spending money, credentials, deleting data: Shaun's actions only.

If a task truly needs a protected file, say in one sentence: "This needs `<path>`; unlock it with `.claude/override.txt` → `allow: <path>`." Then wait. Never work around a block.

## Evidence

Live claims need live checks. Code claims need tests. "I checked" means a tool call happened this turn. Facts, calculations and guesses are different things; never let one pass as another.

## Tools

Use `docs/TOOLBOX.md`: job → tool. Look for a new tool only when the task fails for lack of one; then search once (GitHub stars and recent commits, Anthropic docs, MCP registries), propose it in two lines, and install nothing until Shaun says yes. Do not re-research tools every turn.

## Models and helpers

Sonnet for normal work (pinned in settings). `scout` for read-only sweeps (Haiku or Sonnet). `reviewer` grades every task before DONE. Pass each helper a model. Never let two helpers edit the same files. Re-check one of a helper's facts yourself before repeating it.

## Talking to Shaun

Answer the question he asked in the first sentence. No recap, no apology, no offer before the answer. Short status. He reads results, not narration.
