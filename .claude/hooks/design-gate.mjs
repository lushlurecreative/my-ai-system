#!/usr/bin/env node
// Design gate. A task with Type: DESIGN (anything that decides how a page, site or screen looks) cannot reach DONE unless the session's own record shows the work was really done:
// same-trade references actually opened, design skills actually run, a concept, phone + desktop renders, and at least two rounds with the independent design-critic, the last one a PASS.
// The record is the session transcript, which the harness writes; the builder cannot edit it, and what it says about itself on the card does not count.
import fs from 'node:fs'; import path from 'node:path';
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
    const m = l.match(/^\s*-\s*(same|neighbou?r)\s*\|\s*(https?:\/\/[^\s|]+)\s*\|\s*(local|-|no)\s*\|\s*([^|]+)\|\s*(.+)$/i);
    if (m) rows.push({ kind: m[1].toLowerCase().startsWith('s') ? 'same' : 'neighbor', url: m[2], local: m[3].toLowerCase() === 'local', what: m[4].trim(), borrow: m[5].trim() });
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
  const miss = need('REFERENCES.md', `list at least ${minRefs} real ${trade} sites you opened, one per line: "- same | <url> | local or - | <what great ${trade} sites do here> | <what you take from it>". Up to 2 may be "neighbor" (a close trade, labelled), never an unrelated trade.`); if (miss) return miss;
  const refs = parseReferences(fs.readFileSync(path.join(dir, 'REFERENCES.md'), 'utf8'));
  const visited = (u) => { const n = norm(u); return uses.some((x) => !READERS.has(x.name) && JSON.stringify(x.input).toLowerCase().includes(n)); };
  const same = refs.filter((r) => r.kind === 'same'); const neigh = refs.filter((r) => r.kind === 'neighbor');
  if (neigh.length > 2) return `REFERENCES.md has ${neigh.length} neighbor references; at most 2 are allowed. The rest must be real ${trade} sites.`;
  const thin = refs.filter((r) => r.what.length < 25 || r.borrow.length < 20); if (thin.length) return `REFERENCES.md: say what each site does and what you take from it (a real sentence each). Incomplete: ${thin.slice(0, 3).map((r) => r.url).join(', ')}.`;
  const hosts = new Set(same.filter((r) => visited(r.url)).map((r) => norm(r.url).split('/')[0]));
  const seen = same.filter((r) => visited(r.url));
  if (seen.length < minRefs) return `Only ${seen.length} same-trade reference(s) in REFERENCES.md were actually opened in this session (need ${minRefs}). Open each ${trade} site with the browser or fetch tool, look at it, and list only the ones you opened. A listed URL that was never opened does not count.`;
  if (hosts.size < Math.min(minRefs, 4)) return `The references come from too few sites (${hosts.size}). Use at least ${Math.min(minRefs, 4)} different sites.`;
  if (refs.filter((r) => r.local).length < 2) return 'At least 2 references must fit the customer\'s own market (same language, phone-first, local ordering such as WhatsApp). Mark them "local" in REFERENCES.md.';

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
  const itemsN = Number(((content.match(/^\s*Items:\s*(\d+)/im) || [])[1])) || 0;
  if (((photoPaths.length + videoPaths.length) < minPhotos || itemsN < minItems) && !/^Material waived:\s*\S/mi.test(card)) return `Not enough real material for a page that can look good: ${photoPaths.length} photographs and ${videoPaths.length} videos found on disk (${minPhotos} photographs or videos in total are required), ${itemsN} of ${minItems} required real items. Do not pad it with stock or invented content. Stop on this business, record it as waiting for more photographs and items from the business, and tell Shaun in plain words which business and what is missing.`;

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
    if (!hasLabel(x.r, 'RULINGS') || !hasLabel(x.r, 'TRADE-RELEVANCE') || !hasLabel(x.r, 'PAIRWISE') || !hasLabel(x.r, 'GARBAGE-CASE')) return 'A critic round is missing a required line (RULINGS:, TRADE-RELEVANCE:, PAIRWISE:, GARBAGE-CASE:). Run it again; it must report all four.';
  }
  const inSite = (u) => WRITERS.has(u.name) && path.resolve(root, String(u.input.file_path || u.input.notebook_path || '')).startsWith(path.dirname(site));
  const edits = uses.filter(inSite);
  if (!edits.some((e) => e.i > rounds[0].u.i && e.i < last.u.i)) return 'No change to the page was made between the critic\'s first and last round. A review that changes nothing is not a revision. Fix what the critic found, then review again.';
  if (edits.some((e) => e.i > last.u.i)) return 'The page changed after the critic\'s last PASS. Render again and run the critic once more on the final version.';
  return null;
}
