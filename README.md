# my-ai-system

A folder of rules and guard scripts for Claude Code. It assumes the model will drift and makes drifting impossible instead of asking it not to.

**Install into a project:** `bash install.sh /path/to/project` then fill in `PROTECTED.md`, `docs/PROJECT.md`, `docs/NEXT.md`.

**What it enforces (hooks, not prose):** one task at a time · edits only inside the task's allowed paths · "done" needs evidence and a reviewer PASS · no push to main before done · protected files, the rules and the hooks are hard-blocked · no force push, no rm -rf, no destructive SQL.

Read `docs/HOW-TO-RUN-A-SESSION.md`. That is the only page a person needs.
