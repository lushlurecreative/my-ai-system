#!/usr/bin/env bash
# Usage: bash install.sh /path/to/project
# Installs or UPDATES the system in a project. Safe to re-run: master-owned files are refreshed; project-owned files are kept.
#   Refreshed from the master: CLAUDE.md, .claude/hooks, .claude/agents (non-prefixed), .claude/skills (non-prefixed), .claude/settings.json, docs/HOW-TO-RUN-A-SESSION.md
#   Kept (project data): PROTECTED.md, docs/PROJECT.md, docs/SUBGOALS.md, docs/NEXT.md, docs/TOOLBOX.md, docs/AGENTS.md, .claude/system.json (missing keys are added)
#   Migrated: an idle docs/TASK.md in the old format is replaced; an old-format docs/TOOLBOX.md is saved as docs/TOOLBOX.old.md and replaced by the new template.
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"; DST="${1:?usage: install.sh /path/to/project}"
[ -d "$DST" ] || { echo "no such folder: $DST"; exit 1; }
mkdir -p "$DST/.claude/hooks" "$DST/.claude/agents" "$DST/.claude/skills" "$DST/docs"
cp "$SRC"/.claude/hooks/*.mjs "$DST/.claude/hooks/"; cp "$SRC"/.claude/agents/*.md "$DST/.claude/agents/"; cp -R "$SRC"/.claude/skills/. "$DST/.claude/skills/"
cp "$SRC/.claude/settings.json" "$DST/.claude/settings.json"; cp "$SRC/CLAUDE.md" "$DST/CLAUDE.md"; cp "$SRC/docs/HOW-TO-RUN-A-SESSION.md" "$DST/docs/"
NOTES=""
# docs/TASK.md: replace only when idle and in the old format
if [ -f "$DST/docs/TASK.md" ]; then
  if ! grep -q "^Scope ledger" "$DST/docs/TASK.md"; then
    if grep -qE "^Status:[[:space:]]*(NONE|DONE)" "$DST/docs/TASK.md"; then cp "$SRC/docs/TASK.md" "$DST/docs/TASK.md"; NOTES="$NOTES\n- docs/TASK.md was idle and in the old format: replaced with the new template."; else NOTES="$NOTES\n- docs/TASK.md has an active task in the old format. Add 'Type:' and 'Tools needed:' lines to it by hand."; fi
  fi
else cp "$SRC/docs/TASK.md" "$DST/docs/TASK.md"; fi
# docs/TOOLBOX.md: old format has no Status column
if [ -f "$DST/docs/TOOLBOX.md" ] && ! grep -q "| Status |" "$DST/docs/TOOLBOX.md"; then mv "$DST/docs/TOOLBOX.md" "$DST/docs/TOOLBOX.old.md"; cp "$SRC/docs/TOOLBOX.md" "$DST/docs/TOOLBOX.md"; NOTES="$NOTES\n- docs/TOOLBOX.md was in the old format: saved as docs/TOOLBOX.old.md. Carry its rows into the new table with a status each."; fi
for f in PROTECTED.md docs/PROJECT.md docs/SUBGOALS.md docs/NEXT.md docs/TOOLBOX.md docs/AGENTS.md; do [ -f "$DST/$f" ] || cp "$SRC/$f" "$DST/$f"; done
# .claude/system.json: add any missing default keys, keep the project's values
node -e '
const fs=require("fs"),p=process.argv[1]+"/.claude/system.json",d=JSON.parse(fs.readFileSync(process.argv[2]+"/.claude/system.json","utf8"));
let c={};try{c=JSON.parse(fs.readFileSync(p,"utf8"))}catch(e){}
fs.writeFileSync(p,JSON.stringify({...d,...c})+"\n");' "$DST" "$SRC"
cp "$SRC/VERSION" "$DST/.claude/system-version"
touch "$DST/.gitignore"; grep -qx ".claude/approvals.json" "$DST/.gitignore" || echo ".claude/approvals.json" >> "$DST/.gitignore"
echo "Installed system $(cat "$SRC/VERSION") into $DST."
[ -n "$NOTES" ] && printf "Needs attention:$NOTES\n"
echo "Fill in: PROTECTED.md, docs/PROJECT.md, docs/SUBGOALS.md, docs/NEXT.md, docs/TOOLBOX.md, docs/AGENTS.md."
