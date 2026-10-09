# Which model for what

Two separate things: the model of your chat, and the model each helper agent runs on.

## Your chat (advice only)
Claude cannot switch the chat's own model and no hook can. Only Shaun can, with `/model`. So Claude suggests, once, and Shaun decides.

| Work | Suggested model | Why |
|---|---|---|
| Edits, small fixes, routine analysis, status, syncing, formatting, scans | sonnet | Cheapest model that does this well |
| Hard judgement: money or payments, login and entitlement, protected files, valuation or other math audits, security, system or plan design, conflicting evidence | opus | Costs several times Sonnet, worth it where a mistake is expensive |
| The same kinds of work when it is stuck or the stakes are highest | fable | Most capable and costliest. Only on request or after Opus also fails |
| Pure lookup (list a folder, check a status) | haiku | Not worth more |

How Claude does it:
- At the start of every task, fill the task card's `Model:` line (suggested model and one-line reason) and say it in one line: the suggestion, the current model if known, and that Shaun switches with `/model`.
- Say it again only when something changes: two real attempts at the same problem have failed (suggest up), or the work turned routine (suggest down).
- Never claim to have switched. Never push a more expensive model without a reason tied to the table. If Shaun keeps a model, carry on without repeating.

## Helper agents (enforced)
Each agent's model is written in its own file (`.claude/agents/<name>.md`, the `model:` line). A hook runs the helper on that model and denies a launch that asks for a different one. The table in `docs/AGENTS.md` repeats the models for reading; the agent file is the authority and a test checks the two match.

| Agent | Model | Why |
|---|---|---|
| scout, tool-verifier | haiku | Mechanical: list, check, report a verdict line |
| analyst, marketing, design, researcher, tool-scout | sonnet | Reading and judging at normal difficulty |
| security | opus | A missed hole costs money or trust; rare, so cost is small |
| reviewer | opus | The check that decides DONE should be at least as capable as, and independent from, the model doing the work |

An agent not in this table (a built-in helper type, for example) runs on Sonnet; Opus and Fable are denied unless `allowExpensiveHelpers` is true in `.claude/system.json`.
To change an agent's model: Shaun says "yes, add agent <name>", then the `model:` line in its file is edited and this table is updated in the same change.
