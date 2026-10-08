# Toolbox: job -> tool

One row per tool. Several tools may serve one job; the best working one is used, and important jobs keep two independent sources.
Status is one of: `known` (we know it exists) | `installed` | `connected` (Claude can reach it) | `working` (the check below returned real data) | `needs Shaun` (only he can do the next step).
A status is something Claude observed on the date shown, never something remembered. Re-run the check before relying on an old date.
Add a tool: search widely, score candidates the same way, trial the finalists here, record the pick and why. Install nothing until Shaun says "yes, install <name>".

| Job | Tool | Status | Check that proves it | Last verified |
|---|---|---|---|---|
| Read and edit project files | Claude Code built-ins | working | any Read call returns the file | (date) |
| Review a finished task | reviewer agent | installed | run it on a trivial task; it returns VERDICT | (never) |
| Read-only sweeps | scout agent | installed | ask it to list a folder; it returns the list | (never) |
| Run tests / build | the project's own scripts (see PROJECT.md) | known | run the test command; it exits cleanly | (never) |
| Check the live site, screenshots | (to be chosen: search first) | known | open the live URL and screenshot the homepage | (never) |
| Library docs | (to be chosen: search first) | known | look up one function and get the current signature | (never) |
| Analytics (who visits, what they do) | (to be chosen: several candidates, keep two sources) | known | a real count of today's visitors comes back | (never) |

## Gaps (jobs with no working tool yet)
- (Claude adds a line here whenever a task needs a job done and nothing above is working)
