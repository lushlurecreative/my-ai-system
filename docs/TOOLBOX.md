# Toolbox: job -> tool

One row per tool. Several tools may serve one job; the best working one is used, and important jobs keep two independent sources.
Status is one of: `known` (we know it exists) | `installed` | `connected` (Claude can reach it) | `working` (the check below returned real data) | `needs Shaun` (only he can do the next step).
A status is something Claude observed on the date shown, never something remembered. Re-run the check before relying on an old date.
Add a tool: search widely, score candidates the same way, trial the finalists here, record the pick and why. Install nothing until Shaun says "yes, install <name>".

## Candidate pool
The rows below were seeded on 2026-10-08 from the owner's Global AI Tools library (his Inventory.md; the downloaded repos live in its Shared/Repos folder). Its rule is ours: archive broadly, install selectively, enable narrowly. Its status words map to ours: Stored = known, Active = installed, Auth Required = needs Shaun, Reference = known and not to be enabled. Everything here is `known` until its check passes. A project copies only the rows it needs into its own docs/TOOLBOX.md.

Cautions: workflow frameworks (Superpowers, Compound Engineering) bring their own rules and can override this system's one-task discipline; trial them in a throwaway project only. The owner's machine may also run global hooks, which fire alongside this system's hooks.

| Job | Tool | Status | Check that proves it | Last verified |
|---|---|---|---|---|
| Read and edit project files | Claude Code built-ins | working | any Read call returns the file | (date) |
| Review a finished task | reviewer agent | installed | run it on a trivial task; it returns VERDICT | (never) |
| Read-only sweeps | scout agent | installed | ask it to list a folder; it returns the list | (never) |
| Run tests / build | the project's own scripts (see PROJECT.md) | known | run the test command; it exits cleanly | (never) |
| Live-site checks, screenshots, browser testing | Chrome DevTools MCP | known | open the live URL and screenshot the homepage (includes Lighthouse) | (never) |
| Live-site checks, screenshots, browser testing | Playwright MCP | known | open the live URL and screenshot the homepage | (never) |
| Live-site checks, screenshots, browser testing | Browser Use | known | open the live URL and screenshot the homepage | (never) |
| Live-site checks, screenshots, browser testing | agent-browser | known | open the live URL and screenshot the homepage | (never) |
| Live-site checks, screenshots, browser testing | Claude in Chrome | known | open the live URL and screenshot the homepage | (never) |
| Browser testing (if the project uses Next.js) | Next.js DevTools MCP | known | list the routes of a running Next.js project | (never) |
| Browser testing | Autodesk Browser Test Skills | known | run one of its tests against a page | (never) |
| Code and context | Context7 | known | look up one function and get the current signature | (never) |
| Code and context | Graphify | known | purpose to confirm from its readme; write the check then | (never) |
| Code graph, impact, dependencies | GitNexus MCP | known | ask for the callers of one function | (never) |
| Source control | GitHub MCP | known | read one file from a repo it can access | (never) |
| Agent workflow frameworks (CAUTION: can override this system's one-task rules) | Superpowers | known | trial only in a throwaway project; confirm it does not override CLAUDE.md before any real use | (never) |
| Agent workflow frameworks (CAUTION: can override this system's one-task rules) | Compound Engineering | known | trial only in a throwaway project; confirm it does not override CLAUDE.md before any real use | (never) |
| Design, UI, UX review | Impeccable | known | run on one page; it returns specific critique | (never) |
| Design, UI, UX review | Taste | known | run on one page; it returns specific critique | (never) |
| Design, UI, UX review | Claude Design Skills | known | run on one page; it returns specific critique | (never) |
| Design, UI, UX review | Vercel Web Interface Guidelines | known | check one page against the guidelines | (never) |
| Design, UI, UX review | Vercel Agent Skills | known | run one skill on a small component | (never) |
| UI components (if the project uses shadcn) | shadcn/ui | known | the component library is present in the project | (never) |
| UI components (if the project uses shadcn) | shadcn MCP | known | search for one component | (never) |
| Video creation | Remotion | known | render a 3-second test video | (never) |
| Security review | Trail of Bits Curated Skills | known | run on one file; it returns findings | (never) |
| Security review | Ghost Security Skills | known | run on one file; it returns findings | (never) |
| Security review | Anthropic Security Review | known | run on one file; it returns findings | (never) |
| Security review | OpenAI Security Skills | known | run on one file; it returns findings | (never) |
| Security review | security-guidance plugin | known | run on one file; it returns findings | (never) |
| Code review, second opinion | code-review plugin | known | run on a small diff; it returns findings | (never) |
| Marketing, positioning, channels | Marketing Skills | known | ask for three channels with quoted evidence and URLs | (never) |
| SEO audit | searchfit-seo plugin | known | run an audit on one URL | (never) |
| SEO and traffic research | Ahrefs MCP | known | one keyword lookup returns data (needs an account) | (never) |
| Search traffic (what people search to find the site) | Google Search Console | known | impressions for the last 7 days come back | (never) |
| Web research | WebSearch and WebFetch | known | fetch one public page and read it | (never) |
| Web research, scraping at scale | Perplexity MCP | known | one question returns a cited answer | (never) |
| Web research, scraping at scale | Tavily | known | one search returns results | (never) |
| Web research, scraping at scale | Exa | known | one search returns results | (never) |
| Web research, scraping at scale | Apify MCP | known | list available actors | (never) |
| Web research, scraping at scale | Crawl4AI | known | crawl one public page to text | (never) |
| Web research, scraping at scale | Firecrawl | known | external service; scrape one public page | (never) |
| Web research, scraping at scale | Agent Reach | known | ARCHIVED upstream; reference only; do not enable | (never) |
| Analytics: visitors, behavior, funnel | PostHog | known | a real count of today's visitors comes back | (never) |
| Analytics: visitors, behavior, funnel | Google Analytics | known | a real count of today's visitors comes back | (never) |
| Analytics: visitors, behavior, funnel | the host platform's own analytics (if any) | known | a real count of today's visitors comes back | (never) |
| Analytics: visitors, behavior, funnel | the project's own tracking tables (if any) | known | a query returns today's rows | (never) |
| Database queries (if hosted on Supabase) | Supabase MCP | known | list the tables of the right project | (never) |
| Database queries (if hosted on Lovable) | Lovable connector | known | run select 1 against the right project | (never) |
| Payments (sandbox only) | Stripe MCP | known | read the account in test mode; live mode is the owner's action | (never) |
| See what real visitors do (replays, heatmaps) | Microsoft Clarity | known | a recording of a real session opens; its read-only MCP server (needs a Clarity export token) answers one dashboard question | (never) |
| See what real visitors do (replays, heatmaps) | PostHog session replay (also reachable over the PostHog MCP) | known | search for one recording by a rage click; open it | (never) |
| See what real visitors do (replays, heatmaps) | OpenReplay (self-hosted) | known | one recording plays back from the self-hosted instance | (never) |
| See what real visitors do (replays, heatmaps) | Hotjar | known | free-plan limits read from Hotjar's own pricing page, then one recording opens | (never) |
| Errors and monitoring | Sentry MCP | known | list recent errors | (never) |
| Claude ecosystem | Anthropic Claude Plugins Official | known | list the plugins it offers | (never) |
| Claude ecosystem | Anthropic Knowledge Work Plugins | known | list the plugins it offers | (never) |
| Claude ecosystem | Anthropic Skills | known | load one skill and run it on a sample | (never) |
| Memory (evidence only, never truth) | claude-mem | known | ask it to recall one fact; verify the fact elsewhere | (never) |
| Codex / ChatGPT ecosystem (reference for the Codex port) | OpenAI Plugins | known | list the plugins it offers | (never) |

## Gaps (jobs with no working tool yet)
- (Claude adds a line here whenever a task needs a job done and nothing above is working)
