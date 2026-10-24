#!/usr/bin/env bash
# First-time fill of PROTECTED.md from a proposal file. It refuses once PROTECTED.md has any real entry, so it can add protection but never remove it.
# Usage: bash set-protected.sh <proposal.md> [project-folder]     (a project's chat writes the proposal to docs/notes/PROTECTED-PROPOSED.md)
set -e
SRC="${1:?usage: set-protected.sh <proposal.md> [project-folder]}"; DST="${2:-$PWD}"
[ -f "$SRC" ] || { echo "No such file: $SRC"; exit 1; }
[ -f "$DST/.claude/hooks/protected-list.mjs" ] || { echo "Not a project with the system installed: $DST"; exit 1; }
node --input-type=module - "$SRC" "$DST" <<'NODE'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const [src, dst] = process.argv.slice(2);
const { lists } = await import(pathToFileURL(path.resolve(dst, '.claude/hooks/protected-list.mjs')).href);
const cur = lists(dst);
if (cur.files.length || cur.db.length || cur.words.length) { console.error('PROTECTED.md already has entries. Only the owner changes it now (edit it by hand).'); process.exit(3); }
const text = fs.readFileSync(src, 'utf8'); const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'ais-prot-')); fs.writeFileSync(path.join(scratch, 'PROTECTED.md'), text);
const p = lists(scratch); fs.rmSync(scratch, { recursive: true, force: true });
if (!p.files.length) { console.error('The proposal has no entries under "## Protected files". Nothing written.'); process.exit(4); }
fs.writeFileSync(path.join(dst, 'PROTECTED.md'), text.endsWith('\n') ? text : text + '\n');
console.log(`PROTECTED.md written: ${p.files.length} protected files or folders, ${p.db.length} database functions, ${p.words.length} protected words.`);
NODE
