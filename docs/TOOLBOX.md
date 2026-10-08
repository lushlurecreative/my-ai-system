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
| Live-site checks, screenshots | chrome-devtools MCP (includes Lighthouse) | known | open the live URL and screenshot the homepage | (never) |
| Live-site checks, screenshots | Playwright | known | open the live URL and screenshot the homepage | (never) |
| Live-site checks, screenshots | Claude in Chrome | known | open the live URL and screenshot the homepage | (never) |
| Library docs | context7 | known | look up one function and get the current signature | (never) |
| UI components (if the project uses shadcn) | shadcn MCP | known | search for one component | (never) |
| Analytics: visitors, behavior, funnel | PostHog | known | a real count of today's visitors comes back | (never) |
| Analytics: visitors, behavior, funnel | Google Analytics | known | a real count of today's visitors comes back | (never) |
| Analytics: visitors, behavior, funnel | the host platform's own analytics (if any) | known | a real count of today's visitors comes back | (never) |
| Analytics: visitors, behavior, funnel | the project's own tracking tables (if any) | known | a query returns today's rows | (never) |
| Code graph, impact, dependencies | GitNexus MCP | known | ask for the callers of one function | (never) |
| Security review | security-guidance plugin | known | run it on one file; it returns findings | (never) |
| Code review, second opinion | code-review plugin | known | run it on a small diff; it returns findings | (never) |
| Web research | WebSearch and WebFetch | known | fetch one public page and read it | (never) |
| Web research, scraping at scale | Tavily | known | one search returns results | (never) |
| Web research, scraping at scale | Exa | known | one search returns results | (never) |
| SEO audit | searchfit-seo plugin | known | run an audit on one URL | (never) |
| Errors and monitoring | Sentry plugin | known | list recent errors | (never) |
| Payments (sandbox only) | Stripe MCP | known | read the account in test mode | (never) |
| Database queries (if hosted on Supabase) | Supabase MCP | known | list tables of the right project | (never) |
| Database queries (if hosted on Lovable) | Lovable connector | known | run select 1 against the right project | (never) |

## Gaps (jobs with no working tool yet)
- (Claude adds a line here whenever a task needs a job done and nothing above is working)
