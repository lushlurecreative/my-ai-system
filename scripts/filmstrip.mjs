#!/usr/bin/env node
// Films a page's scroll so its motion can be judged: frames at every step of the scroll, desktop and phone, plus a short video.
// Usage: node ~/my-ai-system/scripts/filmstrip.mjs <page.html | url> <output-folder> [--steps 8]
// Uses the hidden browser (headless). Frames are named film-d-01.png (desktop) and film-m-01.png (phone); film-desktop.webm is the recording.
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url'; import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
const [target, out] = process.argv.slice(2).filter((a) => !a.startsWith('--')); const steps = Number(process.argv[process.argv.indexOf('--steps') + 1]) || 8;
if (!target || !out) { console.log('usage: node filmstrip.mjs <page.html | url> <output-folder> [--steps 8]'); process.exit(2); }
let chromium; try { ({ chromium } = await import('playwright')); } catch { try { const g = execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); ({ chromium } = createRequire(path.join(g, 'x.js'))('playwright')); } catch { /* handled below */ } }
if (!chromium) { console.log('playwright is not available here. Use the hidden browser tool to take the frames by hand (scroll in steps, screenshot each, name them film-d-01.png ... and film-m-01.png ...).'); process.exit(3); }
fs.mkdirSync(out, { recursive: true }); const url = /^https?:|^file:/.test(target) ? target : pathToFileURL(path.resolve(target)).href; const browser = await chromium.launch();
for (const [tag, w, h] of [['d', 1440, 900], ['m', 390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(tag === 'd' ? { recordVideo: { dir: out, size: { width: 960, height: 600 } } } : {}) }); const page = await ctx.newPage();
  await page.goto(url); await page.waitForTimeout(1800);
  const total = await page.evaluate(() => document.documentElement.scrollHeight); const stepPx = Math.max(200, Math.round((total - h) / Math.max(1, steps - 1)));
  for (let i = 0; i < steps; i++) { await page.evaluate((y) => window.scrollTo({ top: y }), Math.min(i * stepPx, Math.max(0, total - h))); await page.waitForTimeout(900); await page.screenshot({ path: path.join(out, `film-${tag}-${String(i + 1).padStart(2, '0')}.png`) }); }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1); if (overflow) console.log(`WARNING: sideways scroll at ${w}px`);
  const v = tag === 'd' ? page.video() : null; await ctx.close(); if (v) { try { fs.renameSync(await v.path(), path.join(out, 'film-desktop.webm')); } catch { /* keep default name */ } }
}
await browser.close(); console.log(`Filmstrip written to ${out}: ${steps} desktop and ${steps} phone frames and a recording.`);
