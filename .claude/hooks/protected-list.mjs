// Reads PROTECTED.md so the per-project fill-in is one file, not code. Fails open to empty lists.
import fs from 'node:fs'; import path from 'node:path';
export const SELF = ['CLAUDE.md', 'PROTECTED.md']; export const SELF_DIRS = ['.claude/'];
function section(text, title) {
  // JS has no \Z, so a sentinel heading marks end-of-file; otherwise the last section is never found.
  const m = (text + '\n## END\n').match(new RegExp(`^##\\s*${title}[^\\n]*\\n([\\s\\S]*?)(?=^##\\s)`, 'mi')); if (!m) return [];
  return [...m[1].matchAll(/^\s*-\s*`([^`]+)`/gm)].map((x) => x[1].trim()).filter((v) => v && !v.startsWith('('));
}
export function lists(root) {
  let t = ''; try { t = fs.readFileSync(path.join(root, 'PROTECTED.md'), 'utf8'); } catch {}
  return { files: section(t, 'Protected files'), db: section(t, 'Protected database functions'), words: section(t, 'Protected words') };
}
