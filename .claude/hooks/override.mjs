// Shaun unlocks things for a task by creating .claude/override.txt. Claude cannot write that file. Lines (one per line, any order):
//   allow: <path>                   unlock one protected file
//   allow-db: fn1, fn2              let ONE migration per commit/push mention these protected database functions
//   allow-migration: <path>         optional: only this migration file may do that (otherwise any one migration may)
//   allow-words: word1, word2       let connector messages use these protected words
//   expires: 2026-10-18T00:00:00Z   every line above stops working after this moment (optional; an unreadable date counts as expired)
// Delete the file to turn everything off at once.
import fs from 'node:fs'; import path from 'node:path'; import { globRe } from './common.mjs';
function lines(root) { try { return fs.readFileSync(path.join(root, '.claude/override.txt'), 'utf8').split('\n').map((l) => l.trim()); } catch { return []; } }
function live(root) { const ls = lines(root); const e = ls.find((l) => /^expires:/i.test(l)); if (e) { const t = Date.parse(e.replace(/^expires:\s*/i, '').trim()); if (!Number.isFinite(t) || Date.now() > t) return []; } return ls; }
const vals = (root, key) => live(root).filter((l) => new RegExp(`^${key}:`, 'i').test(l)).flatMap((l) => l.replace(new RegExp(`^${key}:\\s*`, 'i'), '').split(',').map((s) => s.trim()).filter(Boolean));
// Typed unlocks: when a protected thing is blocked, the hook records a pending request here. Shaun types "unlock <word>" in chat (approve.mjs sees only his own messages), which moves the request into unlocks.json for 3 hours. Claude cannot type his message, and system files (CLAUDE.md, PROTECTED.md, .claude/) never get a request.
const PENDING_MS = 30 * 60 * 1000; const UNLOCK_MS = 3 * 3600 * 1000;
const readJson = (f, d) => { try { const v = JSON.parse(fs.readFileSync(f, 'utf8')); return v ?? d; } catch { return d; } };
const pf = (root) => path.join(root, '.claude/pending.json'); const uf = (root) => path.join(root, '.claude/unlocks.json');
export const unlockKey = (kind, value) => (kind === 'file' ? String(value).replace(/\/?\*+$/, '').split('/').pop().replace(/\.[^.]*$/, '') : String(value)).toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'it';
export function requestUnlock(root, kind, value) {
  const key = unlockKey(kind, value);
  try { const now = Date.now(); const cur = readJson(pf(root), []).filter((x) => x && now - Number(x.ts) < PENDING_MS && !(x.kind === kind && x.value === value)); cur.push({ kind, value, key, ts: now }); fs.mkdirSync(path.dirname(pf(root)), { recursive: true }); fs.writeFileSync(pf(root), JSON.stringify(cur)); } catch { /* the block still applies */ }
  return key;
}
export const unlockHint = (root, kind, value) => `Tell Shaun in plain words (no file names, no code terms) what you want to change and why it is safe, then ask him to type: unlock ${requestUnlock(root, kind, value)}. After he does, retry.`;
export function grantUnlock(root, word) {
  const now = Date.now(); const pending = readJson(pf(root), []).filter((x) => x && now - Number(x.ts) < PENDING_MS);
  const keys = [...new Set(pending.map((x) => x.key))]; const w = String(word || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const picked = w === 'all' ? pending : w ? pending.filter((x) => x.key === w) : (keys.length === 1 ? pending : []);
  if (!picked.length) return [];
  const live = readJson(uf(root), []).filter((x) => x && now - Number(x.ts) < UNLOCK_MS);
  for (const x of picked) live.push({ kind: x.kind, value: x.value, ts: now });
  fs.writeFileSync(uf(root), JSON.stringify(live)); fs.writeFileSync(pf(root), JSON.stringify(pending.filter((x) => !picked.includes(x))));
  return picked;
}
const typed = (root, kind) => readJson(uf(root), []).filter((x) => x && x.kind === kind && Date.now() - Number(x.ts) < UNLOCK_MS).map((x) => x.value);
export const overrides = (root) => [...vals(root, 'allow'), ...typed(root, 'file')];
export const allowedDb = (root) => [...vals(root, 'allow-db'), ...typed(root, 'db')];
export const allowedMigrations = (root) => vals(root, 'allow-migration');
export const allowedWords = (root) => [...vals(root, 'allow-words'), ...typed(root, 'word')].map((s) => s.toLowerCase());
export function isOverridden(root, rel) { return overrides(root).some((o) => o === '*' || rel === o || rel.endsWith('/' + o) || (o.includes('*') && globRe(o).test(rel))); }
