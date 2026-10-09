# my-ai-system

A folder of rules, guard scripts, agents and lens skills for Claude Code. It assumes the model will drift and makes drifting impossible instead of asking it not to. It is project-agnostic: project details live in each project's `docs/` files.

**Install or update a project:** `bash install.sh /path/to/project`. Safe to re-run. It refreshes the rules, hooks, agents and skills, keeps the project's own files, and migrates old-format files. Then fill in `PROTECTED.md` and the `docs/` files it lists.

**What it enforces (hooks, not prose):** one task at a time · edits only inside the task's allowed paths · "done" needs evidence and a reviewer PASS · no push to main before done · protected files, the rules and the hooks are hard-blocked · no force push, no rm -rf, no destructive SQL · shell commands that write files follow the same allowed paths as edits · analysis tasks change only docs/ · a task cannot start with a tool that is not `working` in docs/TOOLBOX.md · nothing is installed until Shaun types "yes, install <name>" in chat · agents are listed by job in docs/AGENTS.md, new ones need "yes, add agent <name>", each agent runs on the model written in its file (haiku for mechanical, sonnet for normal, opus for security and the reviewer) and a cap limits helper runs per session · the startup screen warns when a folder is behind GitHub or half installed, and shows the owner's rulings (`docs/RULINGS.md`). The chat's own model is advice only (`docs/MODELS.md`): Claude suggests, only the owner can switch.

**What it contains:** `CLAUDE.md` (rules) · `.claude/hooks` (guards) · `.claude/agents` (analyst, marketing, security, design, researcher, tool-scout, tool-verifier, reviewer, scout) · `.claude/skills` (ten lenses: first-impression, naive-customer, expert-customer, trust-audit, value-audit, pricing-review, competitor-test, pmf-red-team, reliability-audit, evidence-synthesizer) · `docs/` templates (project facts, sub-goals, task card, next list, toolbox, agents, models, one-page how-to) · `scripts/test-hooks.mjs` · `scripts/scan-library.mjs` (read-only scan of the owner's global tools library; see `docs/LIBRARY-SYNC.md`).

Read `docs/HOW-TO-RUN-A-SESSION.md`. That is the only page a person needs.

## Known gaps
- The suite of 238 checks uses synthetic inputs. The system has run in one real project since 2026-10-09 and held; a real-session scenario suite (including "do task A, then also fix B") is not built.
- Shell writes: redirects, `tee`, `cp`, `mv`, `rm` and `sed -i` are checked against the allowed paths. Not checked: scripts that write files themselves (`node`, `python`), `curl -o`, commands that change files as a side effect, and paths built from variables or wildcards. The reviewer's check of what changed is the backstop.
- "Working" statuses in the toolbox are written by Claude after running the check. A script that computes them from the check's result is not built.
- The go gate looks for a go phrase at the start of the owner's message (`go`, `do it`, `option 2`, `start ...`, a bare number, a yes). A phrase outside that list is not recognised, and a chat can still answer in prose without any gate. Docs the guard always allows (TASK, NEXT, PROJECT, TOOLBOX, SUBGOALS, RULINGS) can be edited without a task.
- The stale-folder warning needs a network connection and a tracked upstream branch; without them it stays silent.
- Autopilot has no automatic trust score yet; the criteria are in the how-to sheet.
- The chat-model advice is a written rule. Whether SessionStart receives the current model name is unverified; the startup line says "not reported" when it does not.
- Tool discovery has been run once (`docs/DISCOVERY-LOG.md`). Its scores rest on third-party pages because a cloud session cannot read GitHub activity; that needs a local session with the GitHub tools.
