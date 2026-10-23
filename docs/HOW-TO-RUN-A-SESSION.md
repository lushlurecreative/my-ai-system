# How to run a session (Shaun's one-page sheet)

1. **Open Claude Code in the project folder.** New session for every task. Never reuse yesterday's chat; the files remember, not the chat.
2. **Say the task in one or two sentences.** Claude writes it on the task card and asks you 1-3 questions. Answer them. **Work starts only when you say go.** "go", "do it", "option 2", "start ..." or just the number of an option all count. Sharing information, a quote or a pasted reply never starts anything. Your go stays good for 6 hours and opens one task.
3. **Let it work.** It can only touch the files it listed. Anything else it notices goes on the Next list. No permission pop-ups for normal work.
4. **It says "Done" only with evidence and after the reviewer agent passed it.** Otherwise the system bounces it back on its own.
5. **Autopilot off:** it ends with a numbered list of everything it can start now (no cap), each with one plain sentence, and asks which numbers to run. Reply with the numbers. **Autopilot on:** it takes the top item from the Next list that needs nothing from you, starts it as a new task, and keeps going; it stops with "Autopilot paused:" when only things that need you are left. Hard blocks (protected files, installs, spending, deleting) and rulings still apply. Switch: `.claude/system.json` → `"autopilot": true` or `false`.
6. **"This needs a protected file, unlock it":** only you can. Create `.claude/override.txt` in the project folder, one line per unlock: `allow: src/lib/pricing.ts` (a file), `allow-db: fn_one, fn_two` (lets ONE migration per commit mention those protected database functions), `allow-migration: supabase/migrations/<file>.sql` (optional: only that one file may do it), `allow-words: word one, word two` (lets connector messages use those protected words), and `expires: 2026-10-18T00:00:00Z` (everything stops working after that moment). Delete the file to turn it all off.
7. **Claude does the doing.** It runs the regression suite, runs deals, opens the browser and pages, checks mobile, runs tests and reads back deploys itself. It comes to you only for a password or login, money, a protected unlock, a decision, or a physical step, once, saying what it tried. **To reorder priorities:** say "move X to the top of NEXT.md". **To record a decision** ("park this", "disregard that", "from now on"): just say it. Claude adds one dated line to `docs/RULINGS.md` at once, and the startup screen shows it every session.

8. **Installing a tool or adding an agent:** Claude tells you what and why. You answer in chat: "yes, install posthog" or "yes, add agent marketing". Nothing happens without those words.
9. **Syncing your global tools library:** this needs a session on your own computer, because cloud sessions cannot see your files. Open Claude (the desktop app) in the my-ai-system folder and say "sync the global library." It reads the folder and changes nothing in it.

What never changes without you: the protected files, spending money, credentials, deleting data, CLAUDE.md, the hooks.

## Earning autopilot
Turn it on only after: the reviewer is grading every task, the "task A, also fix B" test refused B four times in a row, and a week of sessions with nothing you had to catch.
