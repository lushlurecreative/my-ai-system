# Toolbox: job → tool

Use what is here. If a task fails for lack of a tool: search once (GitHub stars + recent commits, Anthropic docs, MCP registries), propose in two lines, install nothing until Shaun says yes, then add it here.

| Job | Tool | Notes |
|---|---|---|
| Read or edit project files | Claude Code built-ins (Read, Edit, Grep, Glob) | |
| Run tests / build | project's own scripts (`package.json`) | see PROJECT.md |
| Check the live site, take screenshots | Playwright or chrome-devtools MCP | live claims need this |
| Read docs for a library | context7 | |
| Production database queries | the project's connector (e.g. Lovable `query_database`) | writes are blocked by hook |
| Web research | WebSearch / WebFetch | |
| Scrape a whole site | (to be chosen in the toolbox research step) | |
| YouTube transcripts | yt-dlp | |
| Code review / second opinion | `reviewer` agent | required before DONE |
| Read-only sweeps | `scout` agent | |
