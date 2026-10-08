# my-ai-system

A folder of rules, guard scripts, agents and lens skills for Claude Code. It assumes the model will drift and makes drifting impossible instead of asking it not to. It is project-agnostic: project details live in each project's `docs/` files.

**Install or update a project:** `bash install.sh /path/to/project`. Safe to re-run. It refreshes the rules, hooks, agents and skills, keeps the project's own files, and migrates old-format files. Then fill in `PROTECTED.md` and the `docs/` files it lists.

**What it enforces (hooks, not prose):** one task at a time · edits only inside the task's allowed paths · "done" needs evidence and a reviewer PASS · no push to main before done · protected files, the rules and the hooks are hard-blocked · no force push, no rm -rf, no destructive SQL · analysis tasks change only docs/ · a task cannot start with a tool that is not `working` in docs/TOOLBOX.md · nothing is installed until Shaun types "yes, install <name>" in chat · agents are listed by job in docs/AGENTS.md, new ones need "yes, add agent <name>", Sonnet is the default helper model and a cap limits helper runs per session.

**What it contains:** `CLAUDE.md` (rules) · `.claude/hooks` (guards) · `.claude/agents` (analyst, marketing, security, design, researcher, tool-scout, tool-verifier, reviewer, scout) · `.claude/skills` (ten lenses: first-impression, naive-customer, expert-customer, trust-audit, value-audit, pricing-review, competitor-test, pmf-red-team, reliability-audit, evidence-synthesizer) · `docs/` templates (project facts, sub-goals, task card, next list, toolbox, agents, one-page how-to) · `scripts/test-hooks.mjs` · `scripts/scan-library.mjs` (read-only scan of the owner's global tools library; see `docs/LIBRARY-SYNC.md`).

Read `docs/HOW-TO-RUN-A-SESSION.md`. That is the only page a person needs.

## Known gaps
- The guards are tested with synthetic inputs, not yet in real sessions. A real-session scenario suite (including "do task A, then also fix B") is not built.
- Shell commands can write files outside a task's allowed paths. The guard checks shell writes only for protected files and the rules. The reviewer's check of what changed is the backstop.
- "Working" statuses in the toolbox are written by Claude after running the check. A script that computes them from the check's result is not built.
- Discussion mode (answer, don't pivot to building) is a written rule only. The permission-seeking guard applies only while a task is ACTIVE.
- Autopilot has no automatic trust score yet; the criteria are in the how-to sheet.
- The tool and agent discovery process is written down but has not been run end to end.
