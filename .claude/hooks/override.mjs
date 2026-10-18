// Shaun unlocks things for a task by creating .claude/override.txt. Claude cannot write that file. Lines (one per line, any order):
//   allow: <path>                   unlock one protected file
//   allow-db: fn1, fn2              let ONE migration per commit/push mention these protected database functions
//   allow-migration: <path>         optional: only this migration file may do that (otherwise any one migration may)
//   allow-words: word1, word2       let connector messages use these protected words
//   expires: 2026-10-18T00:00:00Z   every line above stops working after this moment (optional; an unreadable date counts as expired)
// Delete the file to turn everything off at once.
import fs from 'node:fs'; import path from 'node:path';
function lines(root) { try { return fs.readFileSync(path.join(root, '.claude/override.txt'), 'utf8').split('\n').map((l) => l.trim()); } catch { return []; } }
function live(root) { const ls = lines(root); const e = ls.find((l) => /^expires:/i.test(l)); if (e) { const t = Date.parse(e.replace(/^expires:\s*/i, '').trim()); if (!Number.isFinite(t) || Date.now() > t) return []; } return ls; }
const vals = (root, key) => live(root).filter((l) => new RegExp(`^${key}:`, 'i').test(l)).flatMap((l) => l.replace(new RegExp(`^${key}:\\s*`, 'i'), '').split(',').map((s) => s.trim()).filter(Boolean));
export const overrides = (root) => vals(root, 'allow');
export const allowedDb = (root) => vals(root, 'allow-db');
export const allowedMigrations = (root) => vals(root, 'allow-migration');
export const allowedWords = (root) => vals(root, 'allow-words').map((s) => s.toLowerCase());
export function isOverridden(root, rel) { return overrides(root).some((o) => o === '*' || rel === o || rel.endsWith('/' + o)); }
