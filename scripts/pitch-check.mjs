#!/usr/bin/env node
// The pitch gate: a message to a business may only be sent when it is built from a real case file. Hooks cannot watch product code, so the code that writes or sends messages must call this and refuse when it fails.
// Usage: node ~/my-ai-system/scripts/pitch-check.mjs <project-folder> <business-name>      exit 0 = proven, exit 1 = refused (the reason is printed)
// Reads docs/pitch/<name>/CASE.md and MESSAGES.md, docs/pitch/countries/<country>.md and docs/pitch/BANNED-CLAIMS.md. Templates: docs/pitch/CASE-TEMPLATE.md and MESSAGES-TEMPLATE.md.
import fs from 'node:fs'; import path from 'node:path';
import { pngSize } from '../.claude/hooks/design-gate.mjs';
export function pitchGate(root, name) {
  const slug = String(name).replace(/[^\w.-]/g, ''); const dir = path.join(root, 'docs/pitch', slug);
  const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return null; } };
  const caseTxt = read(path.join(dir, 'CASE.md')); if (!caseTxt) return `docs/pitch/${slug}/CASE.md is missing. Write the case file from the research (template: docs/pitch/CASE-TEMPLATE.md) before any message is written.`;
  const msgTxt = read(path.join(dir, 'MESSAGES.md')); if (!msgTxt) return `docs/pitch/${slug}/MESSAGES.md is missing (template: docs/pitch/MESSAGES-TEMPLATE.md).`;
  const exists = (p) => { try { return fs.statSync(path.resolve(root, p)).size > 0; } catch { return false; } };
  const evOk = (e) => (/^https?:\/\/\S+/.test(e) || exists(e));
  // country profile
  const country = ((caseTxt.match(/^\s*Country:\s*(.+)$/im) || [])[1] || '').trim().toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-');
  if (!country) return 'CASE.md needs a "Country:" line.';
  const prof = read(path.join(root, 'docs/pitch/countries', `${country}.md`)); if (!prof) return `There is no country profile for "${country}". Write docs/pitch/countries/${country}.md from docs/pitch/countries/_TEMPLATE.md first.`;
  const noProfile = ['Beliefs to answer', 'Channels people use', 'Search engines and maps people use', 'Tone'].filter((h) => !new RegExp(`^#+\\s*${h}[\\s\\S]*?\\n\\s*[-*A-Za-z]`, 'im').test(prof) || (prof.split(new RegExp(`^#+\\s*${h}\\s*$`, 'im'))[1] || '').split(/^#/m)[0].trim().length < 25);
  if (noProfile.length) return `The country profile for ${country} is empty under: ${noProfile.join(', ')}.`;
  // findings
  const findings = []; for (const l of caseTxt.split('\n')) { const m = l.match(/^\s*-\s*(F\d+)\s*\|\s*(strength|weakness)\s*\|\s*([123])\s*\|\s*([^|]{15,})\|\s*(\S.*)$/i); if (m) findings.push({ id: m[1].toUpperCase(), kind: m[2].toLowerCase(), sev: Number(m[3]), text: m[4].trim(), ev: m[5].trim() }); }
  if (findings.length < 3) return `CASE.md lists ${findings.length} findings; at least 3 are required, in the form "- F1 | weakness | 3 | what we found | evidence file or link". List everything the research found, not a selection.`;
  const badEv = findings.filter((f) => !evOk(f.ev)); if (badEv.length) return `These findings have no real evidence (a file that exists or a link): ${badEv.map((f) => f.id).join(', ')}.`;
  if (new Set(findings.map((f) => f.id)).size !== findings.length) return 'CASE.md repeats a finding number.';
  // cost
  const costSec = caseTxt.split(/^#+\s*Cost\s*$/im)[1] || ''; const costIds = new Set([...costSec.split(/^#/m)[0].matchAll(/^\s*-\s*(F\d+)\s*\|\s*(.{20,})$/gim)].map((m) => m[1].toUpperCase()));
  const noCost = findings.filter((f) => f.kind === 'weakness' && f.sev >= 2 && !costIds.has(f.id)); if (noCost.length) return `Every weakness of severity 2 or 3 needs a line under "## Cost" saying what it costs them in plain words. Missing: ${noCost.map((f) => f.id).join(', ')}.`;
  // proof: real evidence or an honest "unavailable: why"
  const proofSec = (caseTxt.split(/^#+\s*Proof\s*$/im)[1] || '').split(/^#/m)[0];
  const un = (l) => /unavailable:\s*\S.{14,}/i.test(l);
  const grader = proofSec.match(/^\s*Grader:\s*(.+)$/im); if (!grader) return 'CASE.md "## Proof" needs a "Grader:" line: "<report link> | <score line> | screenshot: <file>" or "unavailable: <why>".';
  if (!un(grader[1])) { const parts = grader[1].split('|').map((x) => x.trim()); const shot = (parts.find((p) => /^screenshot:/i.test(p)) || '').replace(/^screenshot:\s*/i, ''); if (!/^https?:\/\//.test(parts[0]) || parts.length < 3 || !shot) return 'Grader line needs "<report link> | <score line> | screenshot: <file>".'; try { if (fs.statSync(path.resolve(root, shot)).size < 5000) return `Grader screenshot ${shot} is missing or tiny.`; } catch { return `Grader screenshot ${shot} does not exist.`; } }
  const srch = proofSec.match(/^\s*Search results:\s*(.+)$/im); if (!srch) return 'CASE.md "## Proof" needs a "Search results:" line: "<exact search> | screenshot: <file>" or "unavailable: <why>".';
  if (!un(srch[1])) { const sh = (srch[1].match(/screenshot:\s*(\S+)/i) || [])[1]; if (!sh || !exists(sh) || !(pngSize(path.resolve(root, sh)) || { w: 0 }).w) return 'Search results line needs a real screenshot file (png).'; }
  const dem = proofSec.match(/^\s*Demand:\s*(.+)$/im); if (!dem) return 'CASE.md "## Proof" needs a "Demand:" line: "<searches per month> | source: <where it came from>" or "unavailable: <why>".';
  if (!un(dem[1]) && !(/\d/.test(dem[1]) && /source:\s*\S{4,}/i.test(dem[1]))) return 'Demand line needs a number and a "source:" (never an estimate with no source), or "unavailable: <why>".';
  // messages
  const hasOwner = /^\s*Owner name:\s*\S.*\|\s*\S/im.test(caseTxt);
  const banned = (read(path.join(root, 'docs/pitch/BANNED-CLAIMS.md')) || '').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => { try { return new RegExp(l, 'i'); } catch { return null; } }).filter(Boolean);
  const messages = []; for (const part of msgTxt.split(/^##\s*Message\s*\d+.*$/im).slice(1)) messages.push(part.split('\n').filter((l) => /^\s*-\s/.test(l)));
  const real = messages.filter((m) => m.length); if (!real.length) return 'MESSAGES.md has no messages. Use "## Message 1" followed by lines "- sentence | tag".';
  const byId = Object.fromEntries(findings.map((f) => [f.id, f])); const named = new Set();
  for (let i = 0; i < real.length; i++) for (const l of real[i]) {
    const m = l.match(/^\s*-\s*(.+?)\s*\|\s*(intro|ask|(?:compliment|cost)\s+F\d+|F\d+)\s*$/i); if (!m) return `Message ${i + 1} has an untagged or badly tagged sentence: "${l.trim().slice(0, 80)}". Every sentence is "- text | F<n>", "cost F<n>", "compliment F<n>", "ask" or "intro".`;
    const text = m[1], tag = m[2].toLowerCase().replace(/\s+/g, ' '); const idm = tag.match(/f\d+/); const f = idm ? byId[idm[0].toUpperCase()] : null;
    if (idm && !f) return `Message ${i + 1} cites ${idm[0].toUpperCase()}, which is not in CASE.md.`;
    if (tag.startsWith('compliment') && !(f.kind === 'strength' && f.sev >= 2)) return `Message ${i + 1} pays a compliment on ${f.id}, which is not a real strength of severity 2 or 3. There is no compliment unless a verified strength backs it.`;
    if (f && f.kind === 'weakness' && f.sev >= 2 && !tag.startsWith('compliment')) named.add(f.id);
    if (i === 0 && /https?:\/\/|\bwww\.|\b[a-z0-9-]+\.(com|ec|net|org|io|app)\b/i.test(text)) return 'The first message contains a link. Links come after the business replies.';
    if (!hasOwner && /^(?:[Hh]i|[Hh]ello|[Dd]ear|[Hh]ola|[Bb]uen[oa]s)\s+[A-ZÁÉÍÓÚ][a-záéíóúñ]+/.test(text)) return `Message ${i + 1} greets by a name, but CASE.md has no "Owner name:" line with evidence. Never guess a name.`;
    for (const r of banned) if (r.test(text)) return `Message ${i + 1} contains a banned claim (${r}): "${text.slice(0, 80)}".`;
  }
  const dropped = findings.filter((f) => f.kind === 'weakness' && f.sev >= 2 && !named.has(f.id)); if (dropped.length) return `These weaknesses are in the case file but in no message: ${dropped.map((f) => f.id + ' (' + f.text.slice(0, 50) + ')').join('; ')}. Call out every one of them, spread over the messages.`;
  return null;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [rootArg, name] = process.argv.slice(2); if (!rootArg || !name) { console.log('usage: node pitch-check.mjs <project-folder> <business-name>'); process.exit(2); }
  const r = pitchGate(path.resolve(rootArg), name); if (r) { console.log(`REFUSED: ${r}`); process.exit(1); } console.log(`PROVEN: ${name} has a case file, proof and messages that trace to it.`);
}
