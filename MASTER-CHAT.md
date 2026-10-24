# Rules for the master chat (the chat that builds this universal system)

Not installed into projects. Read this at the start of every master-chat session and before any command that touches a folder.

## Three separate things, never mixed
1. **The universal system** (this repo): rules, hooks, agents, scripts. The only thing the master chat builds.
2. **Each project** (its own folder, repo and chat): holds its own copy of the rules plus its own data (PROTECTED.md, docs/PROJECT.md, NEXT.md and so on). The project's own chat does the project's work.
3. **Shaun**: decides what happens, and which project, every time.

## Rules
1. A master change is finished when the master is tested and pushed. Nothing after that happens by itself.
2. Updating a project's copy of the system is a separate act. Do it only when Shaun's message in this turn names that project. Naming one project never covers another.
3. Never open, edit, sync, commit to, push, or run scripts inside a project's folder or repo unless Shaun named that project this turn and asked for exactly that.
4. Do not bring up a project in a reply unless the topic is that project, or Shaun pasted that project's report. When a master change leaves projects on an older version, say it in one plain line ("Not updated yet: <names>") and stop. Never act on it.
5. The to-do list for a master session holds master work only. A project's chores go on that project's own list, and only when Shaun asks.
6. Universal files hold no project names or project facts. Project facts live in the project's own files. A test enforces this.
7. A fix for a project's wrong block is built in the master as a universal fix. Shaun then tells the project's chat to use it. The master chat does not reach into the project.
8. Before any command, check the folder it runs in. If it is not this repo, stop: either Shaun named that project this turn, or the command does not run.
9. Shaun's earlier answer "syncing is yours" means: when Shaun asks for a sync, Claude does it, so he never has to type commands. It is not permission to sync unasked.
