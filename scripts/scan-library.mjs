#!/usr/bin/env node
// Read-only scan of a tools library (default: the owner's global library). Writes ONE report file inside this repo. Never modifies, moves or deletes anything in the library.
// Usage: node scripts/scan-library.mjs [libraryPath] [--out docs/library/INVENTORY-SCAN.md]
// Safe by design: prints names, descriptions, sizes and dates only. MCP configs: server NAMES only (never env values or args). Git remotes: credentials stripped. Inventory text: secret-looking lines redacted.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2); const oi = args.indexOf('--out'); const out = path.resolve(ROOT, oi >= 0 ? args[oi + 1] : 'docs/library/INVENTORY-SCAN.md');
const pos = args.filter((a, i) => !a.startsWith('--') && i !== oi + 1);
let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude/system.json'), 'utf8')); } catch {}
const expand = (p) => String(p || '').replace(/^~(?=$|\/)/, os.homedir());
const LIB = path.resolve(expand(pos[0] || cfg.globalLibrary || '~/Downloads/Global AI Tools'));
if (!fs.existsSync(LIB) || !fs.statSync(LIB).isDirectory()) { console.error(`Library not found: ${LIB}\nRun this on the computer that has it, or pass the path.`); process.exit(2); }
const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', '__pycache__', '.venv']); const SECRET = /(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/;
const items = []; let files = 0;
const fm = (text) => { const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/); if (!m) return {}; const g = (k) => ((m[1].match(new RegExp(`^${k}:\\s*(.+)$`, 'm')) || [])[1] || '').trim().replace(/^["']|["']$/g, ''); return { name: g('name'), description: g('description'), tools: g('tools'), model: g('model') }; };
const clean = (u) => String(u).replace(/\/\/[^/@\s]+@/, '//');
function walk(dir, depth) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  const rel = path.relative(LIB, dir) || '.';
  if (ents.some((e) => e.name === '.git')) { let url = ''; try { url = (fs.readFileSync(path.join(dir, '.git/config'), 'utf8').match(/url\s*=\s*(\S+)/) || [])[1] || ''; } catch {} items.push({ type: 'repo', name: path.basename(dir), where: rel, detail: clean(url) || 'no remote', size: 0, mtime: fs.statSync(dir).mtime }); return; }
  for (const e of ents) {
    const p = path.join(dir, e.name); files++;
    if (e.isDirectory()) { if (!SKIP.has(e.name) && depth < 7) walk(p, depth + 1); continue; }
    if (!e.isFile()) continue; const st = fs.statSync(p); const r = path.relative(LIB, p);
    if (e.name === 'SKILL.md') { const f = fm(fs.readFileSync(p, 'utf8').slice(0, 4000)); items.push({ type: 'skill', name: f.name || path.basename(dir), where: r, detail: f.description, size: st.size, mtime: st.mtime }); }
    else if (/\.md$/.test(e.name) && path.basename(dir) === 'agents') { const f = fm(fs.readFileSync(p, 'utf8').slice(0, 4000)); if (f.name) items.push({ type: 'agent', name: f.name, where: r, detail: `${f.description} | tools: ${f.tools || 'all'} | model: ${f.model || '?'}`, size: st.size, mtime: st.mtime }); }
    else if (/^(\.mcp\.json|mcp\.json|claude_desktop_config\.json)$/.test(e.name)) { try { const j = JSON.parse(fs.readFileSync(p, 'utf8')); items.push({ type: 'mcp-config', name: e.name, where: r, detail: 'servers: ' + Object.keys(j.mcpServers || j.servers || {}).join(', '), size: st.size, mtime: st.mtime }); } catch { items.push({ type: 'mcp-config', name: e.name, where: r, detail: 'unreadable JSON', size: st.size, mtime: st.mtime }); } }
    else if (e.name === 'plugin.json') { try { const j = JSON.parse(fs.readFileSync(p, 'utf8')); items.push({ type: 'plugin', name: j.name || path.basename(dir), where: r, detail: j.description || '', size: st.size, mtime: st.mtime }); } catch {} }
  }
}
walk(LIB, 0);
// compare library skills with this master's skills
const mdir = path.join(ROOT, '.claude/skills'); const master = {}; try { for (const d of fs.readdirSync(mdir)) { const f = path.join(mdir, d, 'SKILL.md'); if (fs.existsSync(f)) master[d] = fs.statSync(f).size; } } catch {}
const norm = (n) => String(n).toLowerCase().replace(/^[a-z]{1,4}-(?=[a-z])/, '');
const mnorm = Object.fromEntries(Object.keys(master).map((k) => [norm(k), k]));
for (const it of items) if (it.type === 'skill') { const m = mnorm[norm(it.name)]; it.match = m ? `${m}: library ${it.size} bytes vs master ${master[m]} bytes (${it.size > master[m] * 1.3 ? 'LIBRARY FULLER' : it.size < master[m] * 0.7 ? 'master fuller' : 'similar'})` : ''; }
// inventory file, if the library has one: copy its text with secret-looking lines redacted
let inv = ''; for (const n of ['Inventory.md', 'INVENTORY.md', 'inventory.md']) { const p = path.join(LIB, n); if (fs.existsSync(p)) { inv = fs.readFileSync(p, 'utf8').split('\n').slice(0, 600).map((l) => (SECRET.test(l) ? '[line redacted: looked like a secret]' : l)).join('\n'); break; } }
const esc = (s) => String(s || '').replace(/\|/g, '/').replace(/\s+/g, ' ').slice(0, 220);
const by = (t) => items.filter((i) => i.type === t).sort((a, b) => a.name.localeCompare(b.name));
let md = `# Library scan\n\nScanned: ${new Date().toISOString().slice(0, 10)} | library: ${path.basename(LIB)} | files seen: ${files} | read-only, nothing in the library was changed\n\nEvery item is status **known** until a check proves it works. A "LIBRARY FULLER" skill is a candidate to merge into the master's version (generalized, no project names).\n`;
for (const [t, h] of [['skill', 'Skills'], ['agent', 'Agents'], ['plugin', 'Plugins'], ['mcp-config', 'MCP configs'], ['repo', 'Stored repos']]) { const rows = by(t); md += `\n## ${h} (${rows.length})\n`; if (!rows.length) continue; md += '| Name | Where | Detail | Bytes | Modified | Master comparison |\n|---|---|---|---|---|---|\n' + rows.map((i) => `| ${esc(i.name)} | ${esc(i.where)} | ${esc(i.detail)} | ${i.size || ''} | ${i.mtime.toISOString().slice(0, 10)} | ${esc(i.match || '')} |`).join('\n') + '\n'; }
if (inv) md += `\n## Library's own inventory file (copied, secret-looking lines redacted)\n\n${inv}\n`;
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, md);
console.log(`Scanned ${LIB}: ${items.length} items (${by('skill').length} skills, ${by('agent').length} agents, ${by('plugin').length} plugins, ${by('mcp-config').length} mcp configs, ${by('repo').length} repos). Report: ${path.relative(ROOT, out)}`);
