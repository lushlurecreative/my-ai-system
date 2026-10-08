# How to run a session (Shaun's one-page sheet)

1. **Open Claude Code in the project folder.** New session for every task. Never reuse yesterday's chat; the files remember, not the chat.
2. **Say the task in one or two sentences.** Claude writes it on the task card and asks you 1-3 questions. Answer them.
3. **Let it work.** It can only touch the files it listed. Anything else it notices goes on the Next list. No permission pop-ups for normal work.
4. **It says "Done" only with evidence and after the reviewer agent passed it.** Otherwise the system bounces it back on its own.
5. **Autopilot off:** it ends with "Next, in order: A, B or C. Which one?" Reply with a letter. **Autopilot on:** it takes the top item from the Next list and continues. Switch: `.claude/system.json` → `"autopilot": true`.
6. **"This needs a protected file, unlock it":** only you can. Create `.claude/override.txt` in the project folder with one line, e.g. `allow: src/lib/pricing.ts`. Start a new session. Delete the file when done.
7. **To reorder priorities:** say "move X to the top of NEXT.md".

8. **Installing a tool or adding an agent:** Claude tells you what and why. You answer in chat: "yes, install posthog" or "yes, add agent marketing". Nothing happens without those words.

What never changes without you: the protected files, spending money, credentials, deleting data, CLAUDE.md, the hooks.

## Earning autopilot
Turn it on only after: the reviewer is grading every task, the "task A, also fix B" test refused B four times in a row, and a week of sessions with nothing you had to catch.
