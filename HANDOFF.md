# Handoff: master system builder and architect

Written 2026-11-27 for whoever takes over from the current architect. Shaun is the owner, not an engineer. He judges by opening real pages, not by test counts. He is angry about time, tokens and repeated failures. Read "What went wrong" before anything else.

## Where everything lives

- `CLAUDE.md`: core operating rules for every project's builder (task cards, stopping, no-asking rules).
- `docs/design/RULES.md`: design and **research** rules (investigation standard, dossier, photos measured, references, anchors, critic, rule 2h "a page that passed is kept"). Also `BAR.md`, `BANNED.md`, `SOURCES.md` (the six style galleries), `anchors/` (one rated pass and five fails).
- `docs/pitch/RULES.md`, `CASE-TEMPLATE.md`, `MESSAGES-TEMPLATE.md`, `BANNED-CLAIMS.md`, `countries/ecuador.md`: pitch standard (case file, messages, country profile).
- `MASTER-CHAT.md`: how the master chat behaves.
- `.claude/hooks/*.mjs`, `.claude/agents/`, `scripts/`, `install.sh`: the code that enforces the rules; `node scripts/test-hooks.mjs` runs the tests. Projects get the system through `install.sh` and update with the typed words `yes, update`.
- The Site Launch Pros project (repo `lushlurecreative/finalise-dash`, builder chat runs on Shaun's Mac and cannot be reached from here): its goal is in `docs/PROJECT.md`, his dated decisions in `docs/RULINGS.md`, the pipeline in `pipeline/`.

## The goal (in Shaun's words as relayed)

Site Launch Pros finds small businesses in Cuenca, Ecuador (Spanish, phone-first, WhatsApp). For each one it researches the business, builds a sample site Shaun would be proud to show, writes a truthful pitch and messages it by WhatsApp. It scales to 50 sites and later other countries.

## The product promise (final)

For $500 every site has: the business's own name, logo and colours with only proven facts; a WhatsApp button that works; a map or directions link; a call button; the Instagram link; one tool that fits the business's trade and ends in a pre-filled WhatsApp message (never promise a specific tool); up to 3 edits after purchase; one year of hosting included. The price is always $500.

## Decisions Shaun has made (none of these are in a RULINGS file yet)

- The four pages Floristería Azuay, Nuit Coffee & Bakery, Café Ñucallacta and Rosas Eternas are fine as first working passes to sell. Stop design work on them.
- Do not redo the 35 existing sites. Do research only (dossier and case file) for all 37 businesses.
- Pitch messages link to each business's existing sample site.
- Faces in a business's own good photos are fine.
- "Ownership proof" is the wrong concept: it is only a same-business check so businesses are not mixed up.
- No commentary on sites (no source notes, dates, credits).
- The AI critic advises and never blocks a page. The owner's approval beats the critic.
- A failed check gets repair, skip or ask, decided on purpose.
- Show him a real clickable page, never a tall screenshot.
- Moritas and Isabella Store are to be trashed and rebuilt from complete research, replaced at the same address (old versions saved aside).
- A timer or hard time limit is not a fix: the 60-minute stop was removed.
- He wants the galleries in `docs/design/SOURCES.md` used as inspiration for style, quality and 2026 craft, never as templates (templates make every restaurant look alike).

## Open decisions

- Whether the system may use generated art and video as the backdrop of each site, with the business's real photos kept for real products and premises.
- The WhatsApp approach (recommended default: a person taps send on the first message; everything after a reply is automated).
- A Spanish reader for the messages (interim: two independent AI Spanish reviews, a native reader before launch). Never write Spanish in the chat to Shaun.
- Publishing is governed by the project's "Do not touch Lovable" rule; Shaun lifted it for the three sites (Nuit, Café Ñucallacta, Betel rebuild) and for Moritas and Isabella Store in the prompts he was given.

## In progress with the builder (reports not yet back)

- Milú Café clean end-to-end test finished from its saved passed page (preview, case file, English message, staging).
- Publish Nuit Coffee & Bakery, Café Ñucallacta and the Betel rebuild so their `.sitelaunchpros.com` addresses respond.
- Moritas and Isabella Store: complete research and rebuild, replaced at the same address.
- Pipeline fix not yet built: save the passed page as the deliverable, keep it when a revision is refused, resume from saved work (rule 2h is written; the pipeline does not enforce it).

## What went wrong, so you do not repeat it

- Every failure was answered with a new gate. The gates catch defects; none of them produce quality. The sites fall far short of the style galleries and nothing in the system makes them better.
- Gates that fail after the expensive designer stage cause full redos. A clean one-business run took four hours and still produced no page. The checks themselves are fast; the repeated redoing is slow.
- Reports said "fixed" when only a check or test had passed. Report only what Shaun can open.
- Quality finding from reading eight Kombai landing pages end to end: they are plain HTML and CSS, mostly without libraries. What sets them apart is one art direction through every section, images made for the page in one style (usually generated), a looping video, 8 to 14 distinct sections built for the subject, real-looking specifics throughout, and one signature interaction each. Our sites have thin, generic pages on generic imagery. The real target is that depth, built from true facts about the business. Nothing built so far reaches it.
- The only time a good-looking page appeared quickly was when the page was built by hand against the references, with one concept and graded imagery. That is where to start.

## Working with Shaun

Results only. Complete prompts in one block, priced in minutes, with no one-time setup bundled into the result he is waiting for. No asking permission to continue and no offers in place of doing a clear instruction. Never refer him back to earlier text. Admit a failure in one sentence, then act.
