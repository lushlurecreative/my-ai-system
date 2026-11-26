# Pitch rules (master-owned; refreshed by the installer; read before anything written or sent to a business)

## Pitch work (anything written or sent to a business)
A message to a business is written from a case file, never from a guess. `docs/pitch/<name>/CASE.md` (template: `docs/pitch/CASE-TEMPLATE.md`) holds every finding the research made (strengths and weaknesses, severity 1-3, each with evidence), a cost line for every serious weakness, and proof: a third-party grade (Google PageSpeed report link and screenshot, run with `scripts/audit-site.mjs`), a screenshot of what people actually see when they search, and a real search-demand number with its source. Each is real or marked `unavailable: <why>`, never invented.
- **Call out everything.** Every serious weakness is named in at least one message, spread over the messages. Nothing is dropped to be gentle.
- **Blunt from the facts.** Say what we noticed, plainly, from evidence. Criticise the setup, never the person. A compliment only when a verified strength (severity 2 or 3) backs it. A hidden compliment ("it served you well when it was built") is fine when it is true.
- **The pitch answers the local belief.** Each country has a profile (`docs/pitch/countries/<country>.md`) of what people there believe and how they search. The bar is the same everywhere; the profile tells the pitch what to answer. A website means being found on Google, Bing and AI assistants, which means more eyes and very likely more customers, never guaranteed.
- **Links.** The first message has no link. The sample link comes after a reply, then the proof pack, then one new finding per message.
- **No guesses.** Never guess an owner's name. Never state a number that was not measured or sourced; an illustration is labelled as one. `docs/pitch/BANNED-CLAIMS.md` lists claims that never go out.
- **Code that writes or sends messages calls `node ~/my-ai-system/scripts/pitch-check.mjs <project> <name>` and refuses to send when it fails.** Messages are written in English first and translated afterwards.

