# my-ai-system

A folder of rules and guard scripts for Claude Code. It assumes the model will drift and makes drifting impossible instead of asking it not to.

**Install into a project:** `bash install.sh /path/to/project` then fill in `PROTECTED.md`, `docs/PROJECT.md`, `docs/SUBGOALS.md`, `docs/NEXT.md`, `docs/TOOLBOX.md`.

**What it enforces (hooks, not prose):** one task at a time · edits only inside the task's allowed paths · "done" needs evidence and a reviewer PASS · no push to main before done · protected files, the rules and the hooks are hard-blocked · no force push, no rm -rf, no destructive SQL · analysis tasks change only docs/ · a task cannot start with a tool that is not `working` in docs/TOOLBOX.md · nothing is installed until Shaun types "yes, install <name>" in chat · agents are listed by job in docs/AGENTS.md, new ones need "yes, add agent <name>", and a cap limits helper runs per session.

Read `docs/HOW-TO-RUN-A-SESSION.md`. That is the only page a person needs.
