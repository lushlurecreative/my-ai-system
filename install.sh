#!/usr/bin/env bash
# Usage: bash install.sh /path/to/project   — copies the system into a project. Never overwrites a filled-in PROTECTED.md, NEXT.md, PROJECT.md or TASK.md.
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"; DST="${1:?usage: install.sh /path/to/project}"
[ -d "$DST" ] || { echo "no such folder: $DST"; exit 1; }
mkdir -p "$DST/.claude/hooks" "$DST/.claude/agents" "$DST/docs"
cp "$SRC"/.claude/hooks/*.mjs "$DST/.claude/hooks/"; cp "$SRC"/.claude/agents/*.md "$DST/.claude/agents/"
cp "$SRC/.claude/settings.json" "$DST/.claude/settings.json"; [ -f "$DST/.claude/system.json" ] || cp "$SRC/.claude/system.json" "$DST/.claude/system.json"
cp "$SRC/CLAUDE.md" "$DST/CLAUDE.md"; cp "$SRC/docs/HOW-TO-RUN-A-SESSION.md" "$DST/docs/"
for f in PROTECTED.md docs/PROJECT.md docs/SUBGOALS.md docs/NEXT.md docs/TASK.md docs/TOOLBOX.md; do [ -f "$DST/$f" ] || cp "$SRC/$f" "$DST/$f"; done
touch "$DST/.gitignore"; grep -qx ".claude/approvals.json" "$DST/.gitignore" || echo ".claude/approvals.json" >> "$DST/.gitignore"
echo "Installed into $DST. Now fill in: PROTECTED.md, docs/PROJECT.md, docs/SUBGOALS.md, docs/NEXT.md, docs/TOOLBOX.md. Then open Claude Code there."
