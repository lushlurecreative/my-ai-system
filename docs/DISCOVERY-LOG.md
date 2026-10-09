# Discovery log

One entry per run of the tool discovery process in CLAUDE.md (Tools). Newest last. A run ends at "pick + ask Shaun for his yes"; nothing is installed or trialled without "yes, install <name>".

## 2026-10-09: See what real visitors do (session replay, heatmaps). First end-to-end run of the process.

Why this job: a funnel check found almost no real visitors reached the main action. Numbers say where people leave, not what they did. Chosen because it was a real gap, not to test the process; the process was run as written and its flaws are listed below.

**Step 1, our own toolbox first.** PostHog was already a row (analytics, `known`). Session replay is part of it. No other replay tool was listed.

**Step 2, wide search (3 web searches, standard mode, about 30 sources, mostly vendor blogs and aggregator pages).** Candidates: Microsoft Clarity (free, plus an official read-only MCP server), PostHog replay (free tier 5,000 web recordings a month, MCP can search recordings), OpenReplay (self-hosted), rrweb (a library, not a product), Highlight (replay with logs and traces), Hotjar (free-tier limits reported inconsistently).

**Step 3, scores.** 0 to 2 on each of fit, maintained, adoption, cost, setup effort, what it can touch, stack fit; total out of 14. Every score here rests on third-party pages, so each is "unverified" until a primary page (README, pricing page, license, last commit date) is read.

| Tool | Fit | Maintained | Adoption | Cost | Setup | Touch | Stack | Total | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Microsoft Clarity | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 13 | Free, no traffic cap, 30-day retention. MCP is read-only, daily request limit. Adds a script to the site (a code change in the project) |
| PostHog replay | 2 | 2 | 2 | 1 | 1 | 1 | 2 | 11 | Free tier is volume-capped. Account and keys needed. MCP can read events and person properties, broader than Clarity's |
| OpenReplay self-hosted | 2 | 1 | 1 | 1 | 0 | 1 | 1 | 7 | Needs a server; self-hosted edition has fewer features. Poor fit for a non-engineer |
| Hotjar | 1 | 1 | 2 | 1 | 1 | 2 | 1 | 9 | Free-tier numbers conflict between sources; merged into Contentsquare in 2025 |
| rrweb | 0 | 2 | 2 | 2 | 0 | 2 | 1 | 9 | A recording library only; storage and playback would have to be built |
| Highlight | not scored | | | | | | | | Self-hosting details not found |

**Step 4, pick (not installed).** Trial order: Clarity first (cheapest, read-only MCP), PostHog second (already planned for analytics, so one account covers both jobs). Runner-ups: Hotjar, OpenReplay. Re-check date: 2026-12-09, or sooner if either changes its free plan.

**Step 5, what Shaun must do.** Say "yes, install microsoft-clarity" (or posthog) in chat. Adding a Clarity script to a project's site is a code change to that project and follows that project's rules (protected files, hosting platform permissions).

### What this run showed about the process (fixes applied in the same change)
1. Searches return vendor blogs, not primary pages. Added a step: before scoring a finalist, read its primary page (README, pricing, license, last-commit date), or label the score unverified. Done here: no, not possible from a cloud session without a GitHub reader; every score is unverified.
2. Sources disagreed (Hotjar free tier). Rule added: when two sources disagree, record both and mark the field conflicting; never pick one.
3. No numeric scale existed. Scale added: 0 to 2 per criterion, total out of 14, in the table above.
4. No overlap check against tools already planned. Step 1 added: toolbox first, including tools already planned for another job.
5. Maintained and adoption need numbers (last commit date, stars or users). A web search cannot read GitHub reliably; a local session with the GitHub tools can. Until then those two columns stay unverified.
6. The process ends at "ask for a yes" with no standard wording. Wording added (Step 5 above).
