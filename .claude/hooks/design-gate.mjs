#!/usr/bin/env node
// Design gate. A task with Type: DESIGN (anything that decides how a page, site or screen looks) cannot reach DONE unless the session's own record shows the work was really done:
// same-trade references actually opened, design skills actually run, a concept, phone + desktop renders, and at least two rounds with the independent design-critic, the last one a PASS.
// The record is the session transcript, which the harness writes; the builder cannot edit it, and what it says about itself on the card does not count.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { readTask, taskCardText, system, globRe, transcriptLines } from './common.mjs';

const DEFAULT_SKILLS = ['impeccable', 'taste', 'frontend-design', 'ui-ux', 'design-', 'polish', 'critique', 'typeset', 'layout', 'colorize', 'animate', 'distill', 'bolder', 'quieter', 'delight', 'overdrive', 'adapt', 'harden'];
const WRITERS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const READERS = new Set(['Read', 'Glob', 'Grep', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Skill', 'Agent', 'Task', 'TodoWrite']);

const textOf = (c) => typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => (typeof x === 'string' ? x : x?.text || '')).join('\n') : '';
const strings = (v, out = []) => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach((x) => strings(x, out)); else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out)); return out; };
export function readTranscript(tp) {
  const uses = []; const results = new Map(); const resultPos = new Map(); const delivered = []; let seq = 0;
  try {
    for (const l of transcriptLines(tp, ['"tool_use"', 'VERDICT:'])) {
      let d; try { d = JSON.parse(l); } catch { continue; }
      const c = d?.message?.content; seq++;
      if (d.type === 'assistant' && Array.isArray(c)) for (const b of c) if (b.type === 'tool_use') uses.push({ id: b.id, name: b.name, input: b.input || {}, i: uses.length });
      const carriesToolResult = d.type === 'user' && Array.isArray(c) && c.some((b) => b.type === 'tool_result');
      if (carriesToolResult) for (const b of c) if (b.type === 'tool_result') { results.set(b.tool_use_id, textOf(b.content)); resultPos.set(b.tool_use_id, seq); }
      // A critic that ran in the background answers later, as a hand-back message, not as the tool's own result. Take only real hand-backs: not the assistant's own words (it could write a verdict itself), not a tool's output that quotes an old report, not a compaction summary.
      if (d.type !== 'assistant' && !carriesToolResult && l.includes('VERDICT:')) { const txt = strings(d).join('\n'); if (/Subagent hand-back|<task-notification>|agent-message/i.test(txt) && !/This session is being continued|summary below covers/i.test(txt) && /VERDICT\W{0,4}\s*(PASS|FAIL)/i.test(txt) && /VIEWED/i.test(txt)) delivered.push({ text: txt, ri: uses.length, seq }); }
    }
  } catch { return null; }
  return { uses, results, resultPos, delivered };
}
export const pngSize = (f) => { try { const b = fs.readFileSync(f).subarray(0, 24); if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null; return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; } catch { return null; } };
const norm = (u) => String(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[)>.,;]+$/, '').replace(/\/$/, '');

// Layout fingerprint of a page: the set of class names it uses. Compared with earlier sites to refuse a repeated layout.
export const skeleton = (html) => { const s = new Set(); for (const m of String(html).matchAll(/class\s*=\s*["']([^"']+)["']/gi)) for (const c of m[1].split(/\s+/)) if (c) s.add(c.toLowerCase()); return s; };
export const jaccard = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n); };
function priorSites(root, dirs, exclude, selfKeys = []) {
  const out = [];
  for (const d of dirs) {
    const base = path.resolve(root, d); let names = []; try { names = fs.readdirSync(base); } catch { continue; }
    const cands = [path.join(base, 'index.html'), ...names.map((n) => path.join(base, n, 'index.html'))];
    for (const f of cands) { try { const st = fs.statSync(f); const own = path.basename(path.dirname(f)).toLowerCase(); if (path.resolve(f) !== exclude && !selfKeys.some((k) => own === k || own.startsWith(k + '-') || own.startsWith(k + '_'))) out.push({ f, m: st.mtimeMs }); } catch { /* none */ } }
  }
  return out.sort((a, b) => b.m - a.m).slice(0, 40).map((x) => x.f);
}


// Real code first: a page is adapted from the real source of a curated, top-rated design (a gallery's copyable code), never written from a blank file.
const readTree = (dir, exts, max = 400000) => { let out = ''; const walk = (d) => { let es = []; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; } for (const e of es) { if (out.length > max) return; const f = path.join(d, e.name); if (e.isDirectory()) { if (!/^(node_modules|\.git|assets|images|img|fonts)$/i.test(e.name)) walk(f); } else if (exts.test(e.name)) { try { out += '\n' + fs.readFileSync(f, 'utf8'); } catch { /* skip */ } } } }; walk(dir); return out; };
export const codeTokens = (txt) => { const s = new Set(); for (const m of String(txt).matchAll(/class\s*=\s*["']([^"']+)["']/gi)) for (const c of m[1].split(/\s+/)) if (c) s.add('c:' + c.toLowerCase()); for (const m of String(txt).matchAll(/\.([a-z_][\w-]{2,})\s*[{,:.\s>+~[]/gi)) s.add('c:' + m[1].toLowerCase()); for (const m of String(txt).matchAll(/@keyframes\s+([\w-]+)/gi)) s.add('k:' + m[1].toLowerCase()); for (const m of String(txt).matchAll(/--([\w-]+)\s*:/g)) s.add('v:' + m[1].toLowerCase()); return s; };
const MOTION = [/@keyframes/, /animation-timeline|scroll-timeline/, /IntersectionObserver/, /ScrollTrigger|gsap/i, /lenis/i, /framer-motion|motion\.dev|from\s+["']motion/i, /three(?:\.js|\/|\.module)|\bogl\b|webgl/i, /view-transition/, /position:\s*sticky/, /scroll-snap/];
const labelLine = (txt, label) => (String(txt).match(new RegExp('^[\\s>*_\\-#]*\\**\\s*' + label + '\\s*:?\\**\\s*:?\\s*(.+)$', 'im')) || [])[1] || '';
const hasLabel = (txt, label) => new RegExp('^[\\s>*_\\-#]*\\**\\s*' + label + '\\s*:', 'im').test(String(txt));
const field = (card, name) => ((card.match(new RegExp(`^${name}:[ \\t]*(.+)$`, 'mi')) || [])[1] || '').trim();
export function parseReferences(text) {
  const rows = [];
  for (const l of String(text || '').split('\n')) {
    const m = l.match(/^\s*-\s*(same|neighbou?r|avoid)\s*\|\s*(https?:\/\/[^\s|]+)\s*\|\s*(local|-|no)\s*\|\s*([^|]+)\|\s*(.+)$/i);
    if (m) rows.push({ kind: m[1].toLowerCase().startsWith('s') ? 'same' : m[1].toLowerCase().startsWith('a') ? 'avoid' : 'neighbor', url: m[2], local: m[3].toLowerCase() === 'local', what: m[4].trim(), borrow: m[5].trim() });
  }
  return rows;
}

// Returns null when the design work is proven, else one plain instruction naming what is missing.
export function designGate(root, transcriptPath, opts = {}) {
  const sys = system(root); const card = opts.card ?? taskCardText(root); const t = opts.card ? { type: 'DESIGN' } : readTask(root);
  if (t.type !== 'DESIGN') return null;
  const minSkills = Number(sys.designMinSkills) || 3; const minRefs = Number(sys.designMinReferences) || 6;
  const patterns = (Array.isArray(sys.designSkillPatterns) && sys.designSkillPatterns.length ? sys.designSkillPatterns : DEFAULT_SKILLS).map((x) => String(x).toLowerCase());
  const slug = field(card, 'Design').replace(/[^\w.-]/g, ''); const trade = field(card, 'Trade'); const siteRaw = field(card, 'Site');
  if (!slug || !trade || !siteRaw) return 'A DESIGN card needs three lines at the top: "Design: <short-name>", "Trade: <the business\'s trade, e.g. bakery>" and "Site: <path to the page or folder you are building>". Add them.';
  const dir = path.join(root, 'docs/design', slug); const rel = (p) => path.relative(root, p);
  const need = (f, why) => (fs.existsSync(path.join(dir, f)) ? null : `docs/design/${slug}/${f} is missing: ${why}`);
  if (!/^Rulings applied:/m.test(card) || !(card.match(/^Rulings applied:\s*\n((?:[ \t]*-.*\n?)*)/m)?.[1] || '').split('\n').some((l) => l.replace(/^\s*-\s*/, '').trim() && !l.trim().startsWith('-  (') && !/^\s*-\s*\(/.test(l))) return 'The card needs a "Rulings applied:" list: every decision Shaun has recorded (docs/RULINGS.md) that touches this design, one per line, each with how you are honoring it.';
  const tr = readTranscript(transcriptPath || ''); if (!tr) return 'The session record could not be read, so the design work cannot be proven. Do not mark this DONE.';
  const { uses, results, resultPos, delivered } = tr;

  // 1. design skills actually run
  const skills = new Set(uses.filter((u) => u.name === 'Skill').map((u) => String(u.input.skill || '').toLowerCase()).filter((s) => patterns.some((p) => s.includes(p))));
  if (skills.size < minSkills) return `Only ${skills.size} design skill(s) ran in this session${skills.size ? ` (${[...skills].join(', ')})` : ''}; ${minSkills} different ones from the design library are required. Run them with the Skill tool on this design (direction, layout, type and colour, polish, critique), then continue. If the library is not reachable, stop and tell Shaun in plain words; do not substitute your own judgment.`;

  // 2. same-trade references, each really opened
  const miss = need('REFERENCES.md', `list at least ${minRefs} of the BEST ${trade} sites anywhere that you opened, one per line: "- same | <url> | - | <what great ${trade} sites do here> | <what you take from it>". Up to 2 may be "neighbor" (a close trade, labelled), never an unrelated trade. Then list at least 2 of the customer's local competitors as what NOT to do: "- avoid | <url> | local | <what is weak about it> | <what we do instead>". A local competitor is never something to borrow from.`); if (miss) return miss;
  const refs = parseReferences(fs.readFileSync(path.join(dir, 'REFERENCES.md'), 'utf8'));
  // A reference counts as opened when this session's own record shows the visit, OR when the trade's shared reference library holds a dated, real screenshot of it (docs/design/library/<trade>/LIBRARY.md rows: "- <url> | <screenshot file> | <YYYY-MM-DD> | <what to learn>"), fresh within designLibraryDays (default 90). Sites are opened once per trade, not once per business.
  const libDays = Number.isFinite(sys.designLibraryDays) ? sys.designLibraryDays : 90; const tradeSlug = String(trade || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const libRows = (() => { let txt = ''; try { txt = fs.readFileSync(path.join(root, 'docs/design/library', tradeSlug, 'LIBRARY.md'), 'utf8'); } catch { return []; } return txt.split('\n').map((l) => l.match(/^\s*-\s*(https?:\/\/\S+)\s*\|\s*(\S+)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*(.+)$/)).filter(Boolean).map((m) => ({ url: m[1], shot: m[2], date: m[3] })); })();
  const libOk = (u) => libRows.some((r) => { if (norm(r.url) !== norm(u)) return false; const age = (Date.now() - Date.parse(r.date)) / 86400000; if (!(age >= 0 && age <= libDays)) return false; const f = path.resolve(root, 'docs/design/library', tradeSlug, r.shot); try { if (fs.statSync(f).size < 5000) return false; if (/\.png$/i.test(f)) { const d = pngSize(f); if (!d || d.w < 600) return false; } return true; } catch { return false; } });
  const visited = (u) => { const n = norm(u); return libOk(u) || uses.some((x) => !READERS.has(x.name) && JSON.stringify(x.input).toLowerCase().includes(n)); };
  const same = refs.filter((r) => r.kind === 'same'); const neigh = refs.filter((r) => r.kind === 'neighbor'); const avoid = refs.filter((r) => r.kind === 'avoid');
  const borrowedLocal = [...same, ...neigh].filter((r) => r.local); if (borrowedLocal.length) return `REFERENCES.md borrows from a local competitor (${borrowedLocal[0].url}). Local competitors are weak by default: list them only as "- avoid | <url> | local | <what is weak> | <what we do instead>". Everything you borrow from must be among the best ${trade} sites anywhere (use "-" in the third column).`;
  if (neigh.length > 2) return `REFERENCES.md has ${neigh.length} neighbor references; at most 2 are allowed. The rest must be real ${trade} sites.`;
  const thin = refs.filter((r) => r.what.length < 25 || r.borrow.length < 20); if (thin.length) return `REFERENCES.md: say what each site does and what you take from it (a real sentence each). Incomplete: ${thin.slice(0, 3).map((r) => r.url).join(', ')}.`;
  const hosts = new Set(same.filter((r) => visited(r.url)).map((r) => norm(r.url).split('/')[0]));
  const seen = same.filter((r) => visited(r.url));
  if (seen.length < minRefs) return `Only ${seen.length} same-trade reference(s) in REFERENCES.md were actually opened in this session (need ${minRefs}). Open each ${trade} site with the browser or fetch tool, look at it, and list only the ones you opened. A listed URL that was never opened does not count.`;
  if (hosts.size < Math.min(minRefs, 4)) return `The references come from too few sites (${hosts.size}). Use at least ${Math.min(minRefs, 4)} different sites.`;
  const avoidSeen = avoid.filter((r) => visited(r.url)); if (avoidSeen.length < 2) return `REFERENCES.md needs at least 2 local competitors that you opened, listed as what NOT to do: "- avoid | <url> | local | <what is weak about it> | <what we do instead>". Found ${avoidSeen.length} opened.`;

  // 3. concept, different from the last sites
  const m2 = need('CONCEPT.md', 'write the direction for THIS business (the idea drawn from its own world, layout, type, colour, one signature moment) and a section "Different from:" naming at least 3 earlier sites and how this one differs.'); if (m2) return m2;
  const concept = fs.readFileSync(path.join(dir, 'CONCEPT.md'), 'utf8');
  if (concept.replace(/\s+/g, ' ').length < 400 || !/different from/i.test(concept)) return 'CONCEPT.md is too thin or has no "Different from:" section. Describe the direction in full and name at least 3 earlier sites and how this one differs.';

  const hostOf = (u) => norm(u).split('/')[0].replace(/^www\./, '');
  const uncited = [...new Set(same.map((r) => hostOf(r.url)))].filter((h) => !concept.toLowerCase().includes(h.split('.')[0]));
  if (uncited.length > Math.max(0, hosts.size - 3)) return `CONCEPT.md must say which idea you borrowed from each reference site and how you made it your own. It does not mention: ${uncited.slice(0, 4).join(', ')}.`;
  const AXES = ['Hue', 'Fonts', 'Hero', 'Density', 'Order'];
  const axes = (txt) => Object.fromEntries(AXES.map((a) => [a, ((txt.match(new RegExp(`^\\s*[-*]?\\s*${a}:\\s*(.+)$`, 'im')) || [])[1] || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)]));
  const mine = axes(concept); const blank = AXES.filter((a) => !mine[a].length);
  if (blank.length) return `CONCEPT.md needs one line each for: ${AXES.map((a) => a + ':').join(' ')} (hue family, font pair, hero treatment, density, section order). Missing: ${blank.join(', ')}.`;
  const designRoot = path.join(root, 'docs/design'); let others = []; try { others = fs.readdirSync(designRoot).filter((d) => d !== slug && fs.existsSync(path.join(designRoot, d, 'CONCEPT.md'))); } catch { /* none */ }
  for (const o of others) {
    const theirs = axes(fs.readFileSync(path.join(designRoot, o, 'CONCEPT.md'), 'utf8')); let differ = 0;
    for (const a of AXES) { const A = new Set(mine[a]), B = new Set(theirs[a]); if (!B.size) { differ++; continue; } let n = 0; for (const x of A) if (B.has(x)) n++; if (n / (A.size + B.size - n) < 0.6) differ++; }
    if (differ < 3) return `This concept is too close to the one for "${o}": only ${differ} of its 5 style lines (Hue, Fonts, Hero, Density, Order) differ, and 3 must. Choose a genuinely different direction for this business.`;
  }
  // content floor: a page cannot be better than what it is made from
  const minPhotos = Number.isFinite(sys.designMinPhotos) ? sys.designMinPhotos : 6; const minItems = Number.isFinite(sys.designMinItems) ? sys.designMinItems : 8;
  const mc = need('CONTENT.md', 'list what the page is made from: "Photos: <comma-separated paths of the business\'s own photographs>", optionally "Videos: <paths of its own video clips>" (they count toward the photo minimum), "Items: <number of real, verified products or services>", and "Designed assets: <illustration, pattern or other labelled non-photo material, or none>".'); if (mc) return mc;
  const content = fs.readFileSync(path.join(dir, 'CONTENT.md'), 'utf8');
  const photoPaths = ((content.match(/^\s*Photos:\s*(.+)$/im) || [])[1] || '').split(',').map((x) => x.trim()).filter(Boolean).filter((x) => fs.existsSync(path.resolve(root, x)));
  const videoPaths = ((content.match(/^\s*Videos:\s*(.+)$/im) || [])[1] || '').split(',').map((x) => x.trim()).filter(Boolean).filter((x) => fs.existsSync(path.resolve(root, x)));
  const itemsN0 = Number(((content.match(/^\s*Items:\s*(\d+)/im) || [])[1])) || 0;
  // honest stand-ins: when the business's own material is judged unusable, labelled sample material may fill the gap, and every stand-in is listed to be replaced
  const photoVerdict = ((content.match(/^\s*Photo verdict:\s*([\w-]+)/im) || [])[1] || 'own').toLowerCase();
  const standPaths = ((content.match(/^\s*Stand-in photos:\s*(.+)$/im) || [])[1] || '').split(',').map((x) => x.trim()).filter(Boolean).filter((x) => fs.existsSync(path.resolve(root, x)));
  const standItems = Number(((content.match(/^\s*Stand-in items:\s*(\d+)/im) || [])[1])) || 0;
  const replaceLines = (content.split(/^\s*Replace later:[ \t]*/im)[1] || '').split('\n').map((l) => l.replace(/^[\s\-*]+/, '').trim()).filter((l, k) => l.length >= 8 && (k === 0 || /^\s*[-*]|^\S/.test(l))).slice(0, 50).length;
  if (!['own', 'mixed', 'stand-in'].includes(photoVerdict)) return 'CONTENT.md "Photo verdict:" must be own, mixed or stand-in.';
  if (photoVerdict === 'own' && (standPaths.length || standItems)) return 'CONTENT.md lists stand-in material but says "Photo verdict: own". Say mixed or stand-in so the page is labelled honestly.';
  if (photoVerdict !== 'own' && !/^Material waived:\s*\S/mi.test(card)) {
    const reason = (content.match(/^\s*Verdict reason:\s*(.+)$/im) || [])[1] || '';
    if (reason.trim().length < 25) return 'CONTENT.md needs "Verdict reason: <what you examined (how many photos, where from) and why it is not good enough>" of at least a full sentence. Judge the business\'s own material honestly and say what you saw.';
    if (!standPaths.length && !standItems) return 'Photo verdict is not "own", so CONTENT.md needs "Stand-in photos: <paths of the sample photos you used, files that exist>" (and/or "Stand-in items: <n>").';
    if (!replaceLines) return 'CONTENT.md needs a "Replace later:" list with one line for each stand-in or missing fact (each photo slot, a phone number not found, a price not found) saying what the business should send to replace it.';
    let sf = path.resolve(root, siteRaw); try { if (fs.statSync(sf).isDirectory()) sf = path.join(sf, 'index.html'); } catch { /* checked later */ }
    const pg = readTree(path.dirname(sf), /\.(html?|js|mjs)$/i).toLowerCase();
    if (!/foto de ejemplo|foto de muestra|imagen de muestra|imagen de ejemplo|foto referencial|imagen referencial|imagen ilustrativa|foto ilustrativa|tu foto aqu|ejemplo|muestra|referencial|your photo here|sample photo|sample image|example photo|example image|stock photo|placeholder photo/.test(pg)) return 'The page uses stand-in material, so it must say so visibly on the page itself (for example a badge over each sample photo: "Foto de ejemplo - aqu\u00ed ir\u00e1 tu foto"). Stand-ins are never shown as if they were the business\'s own.';
  }
  const itemsN = itemsN0 + standItems;
  if (((photoPaths.length + videoPaths.length + standPaths.length) < minPhotos || itemsN < minItems) && !/^Material waived:\s*\S/mi.test(card)) return `Not enough material for a page that can look good: ${photoPaths.length} of the business's own photographs, ${videoPaths.length} videos and ${standPaths.length} labelled stand-ins found on disk (${minPhotos} in total are required), ${itemsN} of ${minItems} required items. If the business's own material is unusable, set "Photo verdict: stand-in" with labelled sample photos and a "Replace later:" list. Never present sample material as the business's own and never invent products or prices.`;

  // photos must be usable: measured, not just described. Blurry, dark and tiny photos cannot be used; the first-screen photo must clear a stricter bar; 
  if (sys.designPhotoCheck !== false && !/^Material waived:\s*\S/mi.test(card)) {
    const listOf = (re) => ((content.match(re) || [])[1] || '').split(',').map((x) => x.trim()).filter(Boolean);
    const own = listOf(/^\s*Photos:\s*(.+)$/im), stand = listOf(/^\s*Stand-in photos:\s*(.+)$/im), vids = listOf(/^\s*Videos:\s*(.+)$/im);
    const heroRel = ((content.match(/^\s*Hero:\s*(\S.*)$/im) || [])[1] || '').trim();
    if (!heroRel) return 'CONTENT.md needs "Hero: <the one photo or video that fills the first screen>". The first screen decides the page: it must be a bright, sharp, professional image.';
    if (![...own, ...stand, ...vids].includes(heroRel)) return `CONTENT.md says the hero is ${heroRel}, but that file is not listed under Photos, Stand-in photos or Videos.`;
    const script = [path.join(os.homedir(), 'my-ai-system/scripts/photo-check.py'), path.join(root, 'scripts/photo-check.py'), path.join(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/photo-check.py')].find((f) => fs.existsSync(f));
    if (!script) return 'The photo check tool (scripts/photo-check.py from my-ai-system) is not installed here, so photos cannot be measured. Run the system update, then continue.';
    const measure = (files, hero) => { if (!files.length) return []; const r = spawnSync('python3', [script, ...(hero ? ['--hero'] : []), ...files.map((f) => path.resolve(root, f))], { encoding: 'utf8', timeout: 120000 }); if (r.error || !r.stdout) return { error: `python3 could not run the photo check (${r.error ? r.error.message : (r.stderr || '').slice(0, 120)}). Install python3 with Pillow and numpy: python3 -m pip install pillow numpy` }; const rows = r.stdout.trim().split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); if (rows[0] && rows[0].error) return { error: `The photo check could not run: ${rows[0].error}` }; return rows; };
    const isVid = (f) => /\.(mp4|mov|webm|m4v)$/i.test(f);
    const imgs = [...own, ...stand].filter((f) => fs.existsSync(path.resolve(root, f)) && !isVid(f)); const res = measure(imgs, false); if (res.error) return res.error;
    const bad = res.filter((x) => x.problems && x.problems.length); if (bad.length) return `These photos are listed as usable but fail the photo check, so they cannot be used: ${bad.slice(0, 4).map((x) => `${path.relative(root, x.file)} (${x.problems[0]})`).join('; ')}${bad.length > 4 ? `; and ${bad.length - 4} more` : ''}. Remove them from CONTENT.md, or replace them with better photos (labelled stand-ins if the business has none).`;
    if (!isVid(heroRel)) { const hr = measure([heroRel], true); if (hr.error) return hr.error; if (hr[0] && hr[0].problems && hr[0].problems.length) return `The first-screen photo ${heroRel} is not good enough: ${hr[0].problems.join('; ')}. The first screen needs one bright, sharp, large professional image. Pick a better one, or use a labelled stand-in.`; }
  }

  // 3a. research before design: every channel the business can have was searched, and every one that exists was actually read
  if (!/^Research waived:\s*\S/mi.test(card)) {
    const mr = need('RESEARCH.md', 'list one line for EACH channel type, in this form: "- <type> | <link or none> | read, not-found or skipped | <evidence file path, or the search you ran, or the reason>". Types: website, instagram, facebook, tiktok, youtube, google-maps, delivery-marketplace, directory. "read" needs a saved evidence file (notes, screenshots or downloaded clips); "not-found" needs the search you ran; "skipped" needs a real reason. Videos and posts you read are saved under docs/design/<name>/ or the project\'s research records.'); if (mr) return mr;
    const rows = fs.readFileSync(path.join(dir, 'RESEARCH.md'), 'utf8').split('\n').map((l) => l.match(/^\s*-\s*([\w-]+)\s*\|\s*([^|]*)\|\s*(read|not-found|skipped|unread)\s*\|\s*(.+)$/i)).filter(Boolean).map((m) => ({ type: m[1].toLowerCase(), link: m[2].trim(), status: m[3].toLowerCase(), note: m[4].trim() }));
    const TYPES = ['website', 'instagram', 'facebook', 'tiktok', 'youtube', 'google-maps', 'delivery-marketplace', 'directory', 'link-in-bio', 'catalog-document'];
    const missingTypes = TYPES.filter((ty) => !rows.some((r) => r.type === ty));
    if (missingTypes.length) return `RESEARCH.md has no line for: ${missingTypes.join(', ')}. Search for the business on every channel type and record the result of each (read, not-found with the search you ran, or skipped with a reason).`;
    // every link found inside something already read is followed: a link-in-bio page, a catalog on a shared drive, a menu, a social page, a map pin
    const OWN = /(linktr\.ee|beacons\.ai|bio\.link|lnk\.bio|linkin\.bio|taplink|carrd\.co|drive\.google\.com|docs\.google\.com|dropbox\.com|canva\.com|wa\.me|api\.whatsapp\.com|facebook\.com|fb\.com|fb\.me|instagram\.com|tiktok\.com|youtube\.com|youtu\.be|maps\.app\.goo\.gl|google\.[a-z.]+\/maps|rappi\.|pedidosya\.|ubereats\.)/i;
    const normUrl = (u) => String(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/[)>.,;"']+$/, '').replace(/\/$/, '');
    const listed = rows.map((r) => normUrl(r.link)).concat(rows.map((r) => r.note.toLowerCase()));
    const missed = [];
    for (const r of rows.filter((x) => x.status === 'read')) {
      const f = path.resolve(root, r.note.split(/\s/)[0]); let txt = ''; try { if (fs.statSync(f).isFile() && fs.statSync(f).size < 3e6) txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
      for (const u of txt.match(/https?:\/\/[^\s"'<>)\]]+/g) || []) { if (!OWN.test(u)) continue; const n = normUrl(u); if (!n || n === normUrl(r.link) || listed.some((l) => l && (l === n || l.includes(n)))) continue; if (!missed.includes(n)) missed.push(n); }
    }
    if (missed.length) return `Links found inside what you already read were not followed: ${missed.slice(0, 4).join(', ')}. A link-in-bio page, a catalog on a shared drive, a menu or a social page each get their own line in RESEARCH.md ("- link-in-bio | <url> | read | <evidence file>", or "skipped" with a real reason), and everything inside them is read: documents are opened page by page and their photos and prices saved.`;
    // the dossier: what a designer AND a seller need to know, section by section, with every gap explained, and a second pass that tested whether the research was finished
    const md = need('DOSSIER.md', 'write the business dossier with these sections (as headings): Identity, Brand, Offerings, Proof, Place and contact, Channels, Media, Gaps. Each section holds what was found, or "none found: <how you searched>". Media has a line "Photos: <n>  Videos: <n>  Documents: <n>". Add a line "Saturation: <the second search you ran from a different angle and how many NEW leads it found>".'); if (md) return md;
    const dos = fs.readFileSync(path.join(dir, 'DOSSIER.md'), 'utf8'); const sect = (name) => { const m = dos.match(new RegExp('^#{1,3}\\s*' + name + '[^\\n]*\\n([\\s\\S]*?)(?=^#{1,3}\\s|(?![\\s\\S]))', 'im')); return m ? m[1].trim() : null; };
    const NEED = [['Identity', 'Identity'], ['Brand', 'Brand'], ['Offerings', 'Offerings'], ['Proof', 'Proof'], ['Place and contact', 'Place(?: and contact)?'], ['Channels', 'Channels'], ['Media', 'Media'], ['Gaps', 'Gaps']];
    const thin = NEED.filter(([, rx]) => { const b = sect(rx); return b === null || b.replace(/\s+/g, ' ').length < 20; }).map(([n]) => n);
    if (thin.length) return `DOSSIER.md sections missing or empty: ${thin.join(', ')}. Each needs what was found, or "none found: <how you searched>" (a real sentence).`;
    if (!/Photos:\s*\d+/i.test(sect('Media')) || !/Videos:\s*\d+/i.test(sect('Media'))) return 'DOSSIER.md Media section needs a count line: "Photos: <n>  Videos: <n>  Documents: <n>".';
    if (!/^\s*Saturation:\s*.*\d.*/im.test(dos) || (dos.match(/^\s*Saturation:\s*(.+)$/im) || [])[1].length < 25) return 'DOSSIER.md needs a "Saturation:" line: the second search you ran from a different angle (for example by phone number, by handle, by tagline or by a photo) and how many NEW leads it found. If it found new ones, follow them and run it again.';
    const unread = rows.filter((r) => r.status === 'unread'); if (unread.length) return `These channels exist but were never read: ${unread.map((r) => r.type).join(', ')}. Read each one (save notes, screenshots or clips as evidence), then mark it "read".`;
    const bad = rows.filter((r) => (r.status === 'read' && !fs.existsSync(path.resolve(root, r.note.split(/\s/)[0]))) || (r.status === 'not-found' && r.note.length < 10) || (r.status === 'skipped' && r.note.length < 15));
    if (bad.length) return `RESEARCH.md: ${bad.slice(0, 3).map((r) => r.type).join(', ')} need real evidence: a "read" line must start with the path of a saved evidence file that exists; "not-found" needs the search you ran; "skipped" needs a real reason.`;
  }
  // 3b. the business's own identity is the starting point: logo, colours and where they came from, and the page really uses them
  if (!/^Brand waived:\s*\S/mi.test(card)) {
    const mb = need('BRAND.md', 'record the business\'s own identity: "Logo: <path to the logo file>", "Colours: <#hex, #hex, ...>" (at least 2, taken from its logo, card, sign or posts), "Sources: <where each came from>", "Use: <how the page uses them>". If it truly has no brand material, put "Brand waived: <why>" on the card.'); if (mb) return mb;
    const brandTxt = fs.readFileSync(path.join(dir, 'BRAND.md'), 'utf8'); const logoRel = ((brandTxt.match(/^\s*Logo:\s*(\S+)/im) || [])[1] || '').trim();
    const hexes = [...new Set(((brandTxt.match(/^\s*Colou?rs:\s*(.+)$/im) || [])[1] || '').match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) || [])].map((h) => h.toLowerCase());
    if (!logoRel || !fs.existsSync(path.resolve(root, logoRel))) return 'BRAND.md needs "Logo: <path>" pointing at the business\'s real logo file.';
    if (hexes.length < 2 || !/^\s*Sources:\s*\S/im.test(brandTxt)) return 'BRAND.md needs at least 2 brand colours as hex codes on a "Colours:" line, and a "Sources:" line saying where each came from (its logo, card, sign or posts).';
    let siteFile0 = path.resolve(root, siteRaw); try { if (fs.statSync(siteFile0).isDirectory()) siteFile0 = path.join(siteFile0, 'index.html'); } catch { /* checked later */ }
    const pageTxt = readTree(path.dirname(siteFile0), /\.(html?|css|js|mjs|svg)$/i).toLowerCase(); const expand = (h) => (h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h);
    const used = hexes.filter((h) => pageTxt.includes(h) || pageTxt.includes(expand(h))).length;
    if (used < 2) return `The page uses only ${used} of the brand colours listed in BRAND.md (${hexes.join(', ')}). Build the palette from the business's own colours.`;
    if (!pageTxt.includes(path.basename(logoRel).toLowerCase()) && !/class\s*=\s*["'][^"']*logo|id\s*=\s*["']logo/.test(pageTxt)) return `The page does not use the business's logo (${logoRel}). Put it in the header and use it as a motif.`;
  }
  // 4. renders: phone and desktop, seen by the critic
  const shots = path.join(dir, 'shots'); let files = []; try { files = fs.readdirSync(shots).filter((f) => /\.png$/i.test(f)); } catch { /* none */ }
  const anyImages = (() => { const out = []; const walk = (d) => { let es = []; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; } for (const e of es) { if (e.isDirectory()) { if (!/^(BASE|node_modules)$/i.test(e.name)) walk(path.join(d, e.name)); } else if (/\.(png|jpe?g|webp)$/i.test(e.name)) out.push(e.name); } }; walk(dir); return out; })();
  const dims = files.map((f) => ({ f, ...(pngSize(path.join(shots, f)) || { w: 0, h: 0 }) }));
  if (sys.designBaseRequired === true) {
  const filmD = dims.filter((d) => /^film-/i.test(d.f) && d.w >= 1200).length, filmM = dims.filter((d) => /^film-/i.test(d.f) && d.w > 0 && d.w <= 500).length;
  if (filmD < 4 || filmM < 3) return `docs/design/${slug}/shots/ needs a scroll filmstrip so the page's motion can be judged: at least 4 desktop and 3 phone frames named film-*.png. Make them with: node ~/my-ai-system/scripts/filmstrip.mjs <page> docs/design/${slug}/shots`;
  }
  const mainDims = dims.filter((d) => !/^film-/i.test(d.f));
  if (!mainDims.some((d) => d.w > 0 && d.w <= 500) || !mainDims.some((d) => d.w >= 1200)) return `docs/design/${slug}/shots/ needs PNG renders of the finished page: one at phone width (500px or less) and one at desktop width (1200px or more), full page. Take them with the hidden browser.`;

  if (sys.designBaseRequired === true) { // off by default: starting from a gallery template produced the worst pages so far
  // 4b. built from real code, with real motion, and filmed
  const base = field(card, 'Base'); const baseDir = path.join(dir, 'BASE');
  if (!/^https?:\/\//i.test(base)) return 'The card needs a line "Base: <link>": the curated, top-rated design (from a gallery that offers its code, see docs/design/SOURCES.md) you are adapting. Do not start from a blank file. Pick the best fit for this business\'s mood and trade, fetch its real source, and adapt it.';
  const baseCode = readTree(baseDir, /\.(html?|css|js|mjs|jsx|tsx|ts|svelte|vue)$/i);
  if (baseCode.length < 4000) return `docs/design/${slug}/BASE/ must hold the real source files you fetched for ${base} (HTML, CSS, JS), at least a few KB, plus BASE/SOURCE.md with the line "url: ${base}".`;
  if (!visited(base) && !(((fs.existsSync(path.join(baseDir, 'SOURCE.md')) && fs.readFileSync(path.join(baseDir, 'SOURCE.md'), 'utf8').match(/^code-url:\s*(\S+)/im)) || [])[1] && visited(fs.readFileSync(path.join(baseDir, 'SOURCE.md'), 'utf8').match(/^code-url:\s*(\S+)/im)[1]))) return `The base design (${base}) was never opened or fetched in this session. Fetch its page and its real code, then adapt it. If its code is behind a "copy code" button, use the browser to fetch it.`;
  try { for (const o of fs.readdirSync(path.join(root, 'docs/design')).filter((d) => d !== slug)) { const sf = path.join(root, 'docs/design', o, 'BASE/SOURCE.md'); if (fs.existsSync(sf) && new RegExp(`^url:\\s*${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'im').test(fs.readFileSync(sf, 'utf8'))) return `This base design was already used for "${o}". Choose a different base so the sites do not share a recipe.`; } } catch { /* no other designs */ }
  const siteDirTxt = readTree(path.dirname(path.resolve(root, siteRaw.endsWith('.html') ? siteRaw : path.join(siteRaw, 'index.html'))), /\.(html?|css|js|mjs)$/i);
  const bt = codeTokens(baseCode), pt = codeTokens(siteDirTxt); let shared = 0; for (const x of bt) if (pt.has(x)) shared++;
  if (bt.size && shared / Math.min(bt.size, pt.size || 1) < 0.2) return `The page does not look built from the base (${Math.round(100 * shared / Math.min(bt.size, pt.size || 1))}% of its structure and style names match). Start from the base's real code: keep its structure, class names, motion and craft where they work, and replace the content, colours, photos and language for this business.`;
  const motionHits = MOTION.filter((r) => r.test(siteDirTxt)).length;
  if (motionHits < 2) return 'The page has almost no motion or depth (it needs at least two of: scroll-triggered or scroll-driven animation, keyframe animation, smooth scrolling, sticky or layered scenes, 3D or shader graphics, view transitions). A still page is not acceptable. Keep the base design\'s motion, or build it with a motion library.';
  }
  // 5. layout not repeated
  let site = path.resolve(root, siteRaw); try { if (fs.statSync(site).isDirectory()) site = path.join(site, 'index.html'); } catch { return `The Site path on the card (${siteRaw}) does not exist.`; }
  // no commentary on the site: it carries the business's own voice, never notes about where the words or photos came from
  { let html = ''; try { html = readTree(path.dirname(site), /\.html?$/i); } catch { /* ignore */ }
    const visible = html.replace(/<(script|style|svg|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
    const MON = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|ene|abr|ago|dic)[a-z]*\\.?';
    const COMMENTARY = [
      /\b(?:on|from|via)\s+(?:her|his|their|its)\s+(?:instagram|facebook|tiktok|google|website|page|profile)\b/i, /\ben\s+su\s+(?:instagram|facebook|tiktok|perfil|p[a\u00e1]gina)\b/i,
      /\b(?:according to|as seen on|as posted on|taken from|sourced from|as reported by|seg[u\u00fa]n (?:su|el|la) (?:instagram|facebook|perfil))\b/i, /\b(?:source|fuente)\s*:/i,
      new RegExp(`\\(\\s*${MON}\\s+\\d{1,2},?\\s+20\\d\\d\\s*\\)`, 'i'), /\(\s*\d{1,2}\s+de\s+[a-z\u00e1\u00e9\u00ed\u00f3\u00fa]+\s+(?:de\s+)?20\d\d\s*\)/i,
      /\b(?:CC[- ]BY|creative commons|wikimedia|unsplash|pexels|pixabay)\b/i, /\b(?:dossier|research record|replace later|lorem ipsum|placeholder text|verified by)\b/i,
    ];
    const hit = COMMENTARY.map((r) => visible.match(r)).find(Boolean);
    if (hit) return `The page contains commentary about where its content came from ("${String(hit[0]).slice(0, 60)}"). A site carries the business's own voice only: no source notes, dates, attributions, credits or research remarks (the only allowed label is the visible sample-photo badge). Remove it. If a photo's licence demands a credit line, use a different stand-in photo that needs none.`; }
  const dirs = Array.isArray(sys.designSitesDirs) ? sys.designSitesDirs : [];
  if (dirs.length) {
    const mine = skeleton(fs.readFileSync(site, 'utf8')); let worst = { s: 0, f: '' };
    const selfKeys = [...new Set([slug, path.basename(path.dirname(site))].map((x) => String(x).toLowerCase().split(/[-_ ]/)[0]).filter((x) => x.length >= 4))]; // a business is never compared with its own earlier page: revising it is the point
    for (const f of priorSites(root, dirs, path.resolve(site), selfKeys)) { let h = ''; try { h = fs.readFileSync(f, 'utf8'); } catch { continue; } const s = jaccard(mine, skeleton(h)); if (s > worst.s) worst = { s, f }; }
    if (worst.s > 0.5) return `This page repeats the layout of an earlier site (${Math.round(worst.s * 100)}% of its structure matches ${rel(worst.f)}). Design a different composition for this business, then render and review again.`;
  }

  const inSite0 = (u) => WRITERS.has(u.name) && path.resolve(root, String(u.input.file_path || u.input.notebook_path || '')).startsWith(path.dirname(site));
  const lastEdit = Math.max(-1, ...uses.filter(inSite0).map((u) => u.i));
  const viewedShot = (pred) => uses.some((u) => u.name === 'Read' && u.i > lastEdit && dims.some((d) => pred(d) && path.resolve(String(u.input.file_path || '')) === path.resolve(shots, d.f)));
  if (!viewedShot((d) => d.w > 0 && d.w <= 500) || !viewedShot((d) => d.w >= 1200)) return 'After your last change to the page, open both renders yourself (Read the phone image and the desktop image) and look at them before asking for review. Re-render if the page changed since the renders were taken.';

  // 6. the independent critic: 2+ rounds, last one PASS, work changed between rounds, final version is the one reviewed
  const launches = uses.filter((u) => (u.name === 'Agent' || u.name === 'Task') && String(u.input.subagent_type || '').toLowerCase() === 'design-critic');
  const arrived = []; // {text, seq, launch}. Two rounds can have the same words, so a report is never dropped for matching an earlier one; only a copy delivered twice in a row is.
  const isReport = (txt) => /VERDICT\W{0,4}\s*(PASS|FAIL)/i.test(txt) && /VIEWED/i.test(txt);
  for (const u of launches) { const txt = results.get(u.id) || ''; if (isReport(txt)) arrived.push({ text: txt, seq: resultPos.get(u.id) || 0, launch: u }); }
  // each launch's tool result names the agent it started; a hand-back that mentions that id belongs to that launch
  const agentIds = new Map(launches.map((u) => [u, ((results.get(u.id) || '').match(/agentId:\s*([a-z0-9]{8,})/i) || [])[1]]));
  const keyOf = (txt) => txt.replace(/\s+/g, ' ').trim().slice(-600);
  for (const dv of delivered) {
    const prev = arrived.filter((a) => !a.launch || a.seq).sort((a, b) => b.seq - a.seq)[0];
    if (prev && keyOf(prev.text) === keyOf(dv.text) && Math.abs(dv.seq - prev.seq) <= 2 && !launches.some((u) => results.get(u.id) === prev.text && false)) continue;
    const owner = launches.find((u) => agentIds.get(u) && dv.text.includes(agentIds.get(u))); arrived.push({ text: dv.text, seq: dv.seq, launch: owner || null });
  }
  arrived.sort((a, b) => a.seq - b.seq);
  // launches in order; a verdict joins its own launch by id, otherwise the next launch that has no verdict yet
  const taken = new Set(arrived.filter((a) => a.launch).map((a) => a.launch)); const free = launches.filter((u) => !taken.has(u)); let fi = 0;
  const rounds = arrived.map((a) => ({ u: a.launch || free[fi++] || launches[launches.length - 1], r: a.text })).filter((x) => x.u);
  if (rounds.length < 2) return `The design-critic has returned ${rounds.length} verdict(s); at least 2 rounds are required (review, fix what it found, review again). Launch it with the Agent tool (subagent_type design-critic), give it the renders in docs/design/${slug}/shots/, REFERENCES.md, CONCEPT.md and the trade.`;
  const verdict = (x) => (x.r.match(/VERDICT\W{0,4}\s*(PASS|FAIL)/gi).pop().match(/PASS|FAIL/i)[0].toUpperCase());
  const last = rounds[rounds.length - 1];
  if (verdict(last) !== 'PASS') return 'The design-critic\'s last verdict is FAIL. Fix every problem it named, re-render, and run it again.';
  { const x = last; // the required report lines are checked on the newest round only: earlier rounds were already followed by fixes and a re-review
    const viewed = labelLine(x.r, 'VIEWED');
    if (!viewed || !(files.length ? files : []).concat(anyImages).some((f) => viewed.includes(f))) return 'A critic round did not list the render files it viewed ("VIEWED: <file names>", naming image files that exist under docs/design/<name>/). Its VIEWED line was: ' + (viewed || '(empty)').slice(0, 160) + '. Run it again and require real file names.';
    if (!hasLabel(x.r, 'RULINGS') || !hasLabel(x.r, 'TRADE-RELEVANCE') || !hasLabel(x.r, 'PAIRWISE') || !hasLabel(x.r, 'GARBAGE-CASE') || !hasLabel(x.r, 'ANCHORS')) return 'A critic round is missing a required line (RULINGS:, TRADE-RELEVANCE:, PAIRWISE:, GARBAGE-CASE:, ANCHORS:). Run it again; it must report all five.';
  }
  const inSite = (u) => WRITERS.has(u.name) && path.resolve(root, String(u.input.file_path || u.input.notebook_path || '')).startsWith(path.dirname(site));
  const edits = uses.filter(inSite);
  if (!edits.some((e) => e.i > rounds[0].u.i && e.i < last.u.i)) return 'No change to the page was made between the critic\'s first and last round. A review that changes nothing is not a revision. Fix what the critic found, then review again.';
  if (edits.some((e) => e.i > last.u.i)) return 'The page changed after the critic\'s last PASS. Render again and run the critic once more on the final version.';
  return null;
}
