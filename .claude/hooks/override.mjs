// Shaun unlocks a protected file for one session by creating .claude/override.txt with "allow: <path>". Claude cannot write that file.
import fs from 'node:fs'; import path from 'node:path';
export function overrides(root) { try { return fs.readFileSync(path.join(root, '.claude/override.txt'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => /^allow:/i.test(l)).map((l) => l.replace(/^allow:\s*/i, '').trim()); } catch { return []; } }
export function isOverridden(root, rel) { return overrides(root).some((o) => o === '*' || rel === o || rel.endsWith('/' + o)); }
