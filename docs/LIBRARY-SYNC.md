# Library sync (a system session, not a project session)

The owner keeps a **global library** of downloaded skills, agents, plugins, MCP configs and repos on his own computer. It is the master's candidate pool. Its location is `globalLibrary` in `.claude/system.json`.

**Who may touch what**
- A system session (working inside the master repo) may read the global library, scan it, and promote things from it into the master.
- Nothing in the global library is deleted or moved. The scan never modifies it.
- A project's own tools folder is that project's data. A system session never edits it. A project session may read it to propose a promotion, as a finding.

**Layout:** the library's category folders (for example `Claude/Skills`) hold Mac shortcuts (aliases), not copies. The real files are the repos in `Shared/Repos`. The scan reads the repos; it does not follow shortcuts. `Inventory.md` at the library's top is the owner's own list and is the quickest seed.

**Why it needs the owner's computer:** cloud sessions cannot see his files. The sync runs in a session on his computer (Claude Desktop app, or `claude remote-control` in a terminal), opened in the master folder. The result is a report committed to the repo, so every later session in any place can read it.

**Procedure**
1. Run `node scripts/scan-library.mjs`. It writes `docs/library/INVENTORY-SCAN.md`. If node is missing, do the same listing with the shell.
2. Read the report. For each item, mark it against `docs/TOOLBOX.md` and `docs/AGENTS.md`: already there, new candidate, or redundant.
3. A skill marked LIBRARY FULLER: merge the extra substance into the master's version, generalized (project details become parameters from `docs/PROJECT.md`). The test suite fails if a project name leaks into the master.
4. New candidates go into `docs/TOOLBOX.md` as `known`. Nothing is installed; that still needs "yes, install <name>".
5. Run `node scripts/test-hooks.mjs`, commit, push. Then update each project with `bash install.sh <project>`.
