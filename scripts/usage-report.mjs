#!/usr/bin/env node
// Read-only. Adds up what a project's Claude Code sessions really used, from the session records Claude Code keeps on this computer (~/.claude/projects).
// Usage: node usage-report.mjs [--match finalise-dash] [--since 2026-11-01] [--prices opus=15/75,sonnet=3/15,haiku=1/5]
// Without --prices it reports tokens only (real counts). With prices (dollars per million input/output tokens, from your plan or the Anthropic price page) it adds an ESTIMATE:
// cache reads at 0.1x and cache writes at 1.25x of the input price. Actual money billed is on the Anthropic console usage page; on a subscription plan these dollars are not what you pay.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const arg = (n, d = '') => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const match = arg('match', path.basename(process.cwd())).toLowerCase(); const since = arg('since', '');
const prices = Object.fromEntries(arg('prices', '').split(',').filter(Boolean).map((x) => { const [k, v] = x.split('='); const [i, o] = (v || '').split('/').map(Number); return [k.toLowerCase(), { i, o }]; }));
const family = (m) => { const s = String(m || '').toLowerCase(); return /opus/.test(s) ? 'opus' : /sonnet/.test(s) ? 'sonnet' : /haiku/.test(s) ? 'haiku' : /fable/.test(s) ? 'fable' : (s || 'unknown'); };
const root = arg('dir', path.join(os.homedir(), '.claude/projects'));
const walk = (d) => { let out = []; let es = []; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return out; } for (const e of es) { const p = path.join(d, e.name); if (e.isDirectory()) out = out.concat(walk(p)); else if (e.name.endsWith('.jsonl')) out.push(p); } return out; };
let dirs = []; try { dirs = fs.readdirSync(root).filter((n) => n.toLowerCase().includes(match)).map((n) => path.join(root, n)); } catch { /* none */ }
if (!dirs.length) { console.log(`No session records found under ${root} matching "${match}". Use --match <part of the project folder name> or --dir <folder>.`); process.exit(0); }
const files = dirs.flatMap(walk);
const day = (ts) => String(ts || '').slice(0, 10);
const days = {}; const sessions = []; const agents = {}; let gapMs = 0;
for (const f of files) {
  let lines = []; try { lines = fs.readFileSync(f, 'utf8').split('\n'); } catch { continue; }
  const seen = new Map(); const times = []; const sub = /subagents/.test(f);
  for (const l of lines) {
    if (!l.trim()) continue; let d; try { d = JSON.parse(l); } catch { continue; }
    if (d.timestamp) times.push(Date.parse(d.timestamp));
    if (d.type !== 'assistant' || !d.message) continue;
    const u = d.message.usage; if (u) seen.set(d.message.id || d.uuid, { u, m: d.message.model, ts: d.timestamp });
    if (!sub && Array.isArray(d.message.content)) for (const b of d.message.content) if (b.type === 'tool_use' && (b.name === 'Agent' || b.name === 'Task')) { const k = String(b.input?.subagent_type || 'general'); agents[k] = (agents[k] || 0) + 1; }
  }
  const first = times.length ? Math.min(...times) : 0; if (since && day(new Date(first).toISOString()) < since) continue;
  let active = 0; times.sort((a, b) => a - b); for (let i = 1; i < times.length; i++) { const g = times[i] - times[i - 1]; if (g <= 10 * 60 * 1000) active += g; }
  const s = { f: path.basename(f), sub, turns: seen.size, active, first, tok: { in: 0, out: 0, cr: 0, cw: 0 }, cost: 0, models: {} };
  for (const { u, m, ts } of seen.values()) {
    const fam = family(m); const x = { in: u.input_tokens || 0, out: u.output_tokens || 0, cr: u.cache_read_input_tokens || 0, cw: u.cache_creation_input_tokens || 0 };
    for (const k of Object.keys(x)) s.tok[k] += x[k];
    const p = prices[fam]; const c = p ? (x.in * p.i + x.out * p.o + x.cr * p.i * 0.1 + x.cw * p.i * 1.25) / 1e6 : 0; s.cost += c;
    const dd = (days[day(ts)] ||= { turns: 0, active: 0, byModel: {}, cost: 0 }); dd.turns++; dd.cost += c; const bm = (dd.byModel[fam] ||= { in: 0, out: 0, cr: 0, cw: 0 }); for (const k of Object.keys(x)) bm[k] += x[k];
    s.models[fam] = (s.models[fam] || 0) + 1;
  }
  if (first) { const dd = (days[day(new Date(first).toISOString())] ||= { turns: 0, active: 0, byModel: {}, cost: 0 }); dd.active += active; }
  sessions.push(s);
}
const K = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n));
const mins = (ms) => Math.round(ms / 60000);
console.log(`Sessions read: ${sessions.length} (${sessions.filter((s) => s.sub).length} helper runs) from ${dirs.length} project folder(s). Active time = time between messages, gaps over 10 minutes not counted.\n`);
console.log('By day (tokens: new input / output / cache read / cache written)');
for (const d of Object.keys(days).sort()) {
  const v = days[d]; console.log(`${d}  ${String(v.turns).padStart(5)} turns  ${String(mins(v.active)).padStart(4)} active min${Object.keys(prices).length ? `  est $${v.cost.toFixed(2)}` : ''}`);
  for (const [m, t] of Object.entries(v.byModel)) console.log(`    ${m.padEnd(7)} in ${K(t.in).padStart(6)}  out ${K(t.out).padStart(6)}  cache-read ${K(t.cr).padStart(7)}  cache-write ${K(t.cw).padStart(6)}`);
}
console.log('\nHelper agents launched from chats (reviewers and others):');
for (const [k, n] of Object.entries(agents).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(18)} ${n}`);
const top = sessions.filter((s) => !s.sub).sort((a, b) => (b.tok.out + b.tok.in + b.tok.cw) - (a.tok.out + a.tok.in + a.tok.cw)).slice(0, 8);
console.log('\nBiggest chat sessions:');
for (const s of top) console.log(`  ${new Date(s.first).toISOString().slice(0, 16)}  ${String(s.turns).padStart(5)} turns  ${String(mins(s.active)).padStart(4)} min  out ${K(s.tok.out)}  new-in ${K(s.tok.in + s.tok.cw)}${Object.keys(prices).length ? `  est $${s.cost.toFixed(2)}` : ''}  ${Object.keys(s.models).join('/')}`);
if (!Object.keys(prices).length) console.log('\n(No prices given, so no dollar figures. Add --prices opus=<in>/<out>,sonnet=<in>/<out>,haiku=<in>/<out> in dollars per million tokens for an estimate.)');
