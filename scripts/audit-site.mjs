#!/usr/bin/env node
// Runs Google's own PageSpeed Insights test on a website and saves the result so a message can cite it as a third-party grade.
// Usage: PAGESPEED_API_KEY=<free key> node audit-site.mjs <website-url> <output-folder> [mobile|desktop]
// Writes <output-folder>/pagespeed.json (full report), <output-folder>/summary.json ({url, report_link, scores, checked}) and prints one line.
// Without a key Google answers from a shared pool that is often full (HTTP 429); get a free key at https://developers.google.com/speed/docs/insights/v5/get-started
import fs from 'node:fs'; import path from 'node:path';
const [url, outDir, strategy = 'mobile'] = process.argv.slice(2);
if (!url || !outDir) { console.log('usage: PAGESPEED_API_KEY=<key> node audit-site.mjs <website-url> <output-folder> [mobile|desktop]'); process.exit(2); }
const base = process.env.PAGESPEED_API || 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const q = new URLSearchParams({ url, strategy }); for (const c of ['seo', 'accessibility', 'best-practices', 'performance']) q.append('category', c); if (process.env.PAGESPEED_API_KEY) q.set('key', process.env.PAGESPEED_API_KEY);
let status = 0, body = null;
try { const r = await fetch(`${base}?${q}`, { signal: AbortSignal.timeout(120000) }); status = r.status; body = await r.json(); } catch (e) { console.log(`REFUSED: could not reach the PageSpeed service (${e.message}).`); process.exit(1); }
if (!body || !body.lighthouseResult) {
  const msg = (body && body.error && body.error.message) || `HTTP ${status}`;
  console.log(`REFUSED: Google did not return a report (${status}): ${String(msg).slice(0, 200)}.${status === 429 && !process.env.PAGESPEED_API_KEY ? ' No key was given, so the call drew on a shared allowance. Set PAGESPEED_API_KEY to a free key.' : ''}`); process.exit(1);
}
const cats = body.lighthouseResult.categories || {}; const scores = Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, Math.round((v.score || 0) * 100)]));
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'pagespeed.json'), JSON.stringify(body));
const summary = { url, strategy, report_link: `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(url)}&form_factor=${strategy}`, scores, checked: new Date().toISOString().slice(0, 10) };
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(`OK: ${url} (${strategy}) search readiness ${scores.seo ?? '?'}/100, accessibility ${scores.accessibility ?? '?'}/100, best practices ${scores['best-practices'] ?? '?'}/100, speed ${scores.performance ?? '?'}/100. Report: ${summary.report_link}`);
