# Agents: job -> agent

Claude hands a job to a listed agent. It does not invent helpers on the fly. Agent files live in `.claude/agents/`. A new or changed agent needs Shaun to type "yes, add agent <name>" in chat.

**When a job deserves its own agent:** it differs in the tools it needs, what it may change, the expertise it needs, whether the checker must be independent of the doer, or it can run in parallel. If none differ, extend an existing agent with a lens (a named set of instructions) instead of adding a worker. Each extra agent costs setup, handoffs and review.

**Single writer:** helpers return text. Only the main session writes files, so two helpers never collide.

**Models:** every agent has one assigned model, written in its own file and explained in `docs/MODELS.md`. A hook runs the helper on that model and denies a launch that asks for another. A helper type with no agent file gets Sonnet, and Opus or Fable is denied unless `allowExpensiveHelpers` is true in `.claude/system.json`. The hook also stops launching after `maxHelpers` helper runs in one task (default 6); the reviewer is never counted and the count restarts with the next task.

**Project-specific tools for an agent:** copy the agent file with a project prefix, for example `myproject-analyst.md`, and add the tool names. Updates from the master never overwrite prefixed files.

| Job | Agent | Model (authority: the agent file) | Changes files? | Status | Check that proves it |
|---|---|---|---|---|---|
| Look at a site or data through one lens | analyst | sonnet | no | installed | run on one page with the clutter lens; returns findings in the required shape |
| Distribution, positioning, buyer language | marketing | sonnet | no | installed | ask for three channels with quoted evidence and URLs; every claim has a URL |
| Paywall, auth, secrets, database policy holes | security | opus | no | installed | ask it to review one file; returns severity and a minimal fix |
| Visual clarity and mobile | design | sonnet | no | installed | give it one screenshot; names exact elements |
| Public-source research | researcher | sonnet | no | installed | ask one factual question; answer has URL and date |
| Find and score tools or agents | tool-scout | sonnet | no | installed | ask for candidates for one job; returns the scored table |
| Re-check registry statuses | tool-verifier | haiku | no | installed | give it two rows; returns a verdict line for each |
| Grade finished work | reviewer | opus | no | installed | run on a trivial task; returns VERDICT |
| Read-only sweeps | scout | haiku | no | installed | list one folder; returns the list and the command |

## Gaps (jobs with no agent yet)
- (Claude adds a line here when a task needs a job nobody on the list can do, then runs the scout on it)
