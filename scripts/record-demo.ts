// Records tutorial shots from the local harness with Playwright, one MP4 per shot.
// Usage: node scripts/record-demo.ts [--seed 42] [--seats 5] [--out video/out/shots] [--base http://localhost:5173]
// Needs the web dev server (cd web && npm run dev) and ffmpeg on PATH.
import { chromium, type Page, type Browser } from 'playwright';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
const timing: Record<string, number> = {}; // seconds of page-load lead-in per shot, so the stitcher can skip it
let shotStart = 0; let currentShot = '';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SEED = arg('--seed', '28'); const SEATS = arg('--seats', '5'); const OUT = arg('--out', 'video/out/shots'); const BASE = arg('--base', 'http://localhost:5173');
const W = 1920, H = 1080;
mkdirSync(OUT, { recursive: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clickText = (page: Page, re: RegExp) => page.evaluate((src) => { const b = [...document.querySelectorAll('button')].find((x) => new RegExp(src, 'i').test(x.innerText.trim())); if (b) { b.click(); return true; } return false; }, re.source);

async function shot(browser: Browser, name: string, run: (page: Page) => Promise<void>) {
  shotStart = Date.now(); currentShot = name;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUT, size: { width: W, height: H } }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  try { await run(page); } catch (e) { console.error(`shot ${name} failed:`, (e as Error).message); }
  const video = page.video();
  await ctx.close();
  const webm = await video?.path();
  if (webm && existsSync(webm)) {
    const mp4 = join(OUT, `${name}.mp4`);
    execSync(`ffmpeg -y -loglevel error -i "${webm}" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r 30 -movflags +faststart "${mp4}"`);
    rmSync(webm);
    console.log('recorded', mp4);
  }
}

const harness = async (page: Page, extra = '') => { await page.goto(`${BASE}/dev?seed=${SEED}&seats=${SEATS}&clean${extra}`, { waitUntil: 'networkidle' }); await page.waitForSelector('footer [aria-label]', { timeout: 30000 }); await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready); timing[currentShot] = (Date.now() - shotStart) / 1000; };
const handCards = (page: Page) => page.locator('footer [aria-label]');
const seatTiles = (page: Page) => page.locator('[data-seat]');

async function main() {
  const browser = await chromium.launch();
  // 1. the hand: hover a few cards so the large preview pops
  await shot(browser, '01-hand', async (page) => {
    await harness(page); await sleep(1200);
    const cards = handCards(page); const n = await cards.count();
    for (const i of [0, 3, n - 1]) { await cards.nth(i).hover(); await sleep(1800); }
    await page.mouse.move(W / 2, 200); await sleep(800);
  });
  // 2. placement: drag one card onto a seat, then fill and lock in
  await shot(browser, '02-place', async (page) => {
    await harness(page); await sleep(1000);
    const card = handCards(page).first(); const seat = seatTiles(page).nth(1);
    const cb = (await card.boundingBox())!; const sb = (await seat.boundingBox())!;
    await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2); await page.mouse.down();
    const steps = 30; for (let i = 1; i <= steps; i++) { await page.mouse.move(cb.x + (sb.x + sb.width / 2 - cb.x) * i / steps, cb.y + (sb.y + sb.height / 2 - cb.y) * i / steps); await sleep(25); }
    await page.mouse.up(); await sleep(900);
    await clickText(page, /fill the rest/); await sleep(1200);
    await clickText(page, /^lock in$/); await sleep(1500);
  });
  // 3. the reveal: step through every scene with Next, letting the coin flights play
  await shot(browser, '03-reveal', async (page) => {
    await harness(page); await sleep(800);
    await clickText(page, /fill the rest/); await sleep(400); await clickText(page, /^lock in$/); await sleep(2600);
    for (let i = 0; i < 20; i++) {
      const t = await page.evaluate(() => document.querySelector('.z-30')?.textContent ?? '');
      const last = /Finish/i.test(await page.evaluate(() => [...document.querySelectorAll('.z-30 button')].map((b) => b.textContent).join('|')));
      await sleep(/In front of/.test(t) ? 3200 : 2600);
      if (!(await clickText(page, /^(next|finish)$/))) break;
      if (last) { await sleep(1500); break; }
    }
  });
  // 4. a funeral: stage the narrator's death and seal a will
  await shot(browser, '04-funeral', async (page) => {
    await harness(page); await sleep(800);
    await page.evaluate(() => {
      const d = (window as unknown as { __mwtd: { state: any; bump: () => void } }).__mwtd; const s = d.state; const me = s.seats[0];
      me.alive = false; me.diedRound = s.round; me.revealedTrade = me.trade; me.willSealed = false;
      for (const c of s.cards) if (c.zone === 'hand' && c.ownerSeat === 0) { c.zone = 'grave_pool'; c.pileSeat = 0; }
      s.phase = 'funeral'; d.bump();
    });
    await sleep(5500);
    await page.locator('.z-40 button').first().click(); await sleep(2500);
  });
  // 5. the end screen: play the year out quickly, then linger on the result
  await shot(browser, '05-end', async (page) => {
    await harness(page, '&noanim'); await sleep(600);
    await page.evaluate(async () => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      // innerText reflects CSS text-transform (the buttons render uppercase), so match case-insensitively
      const click = (re: RegExp) => { const b = [...document.querySelectorAll('button')].find((x) => new RegExp(re.source, 'i').test(x.innerText.trim())); if (b) { b.click(); return true; } return false; };
      const d = (window as unknown as { __mwtd: { settle: () => void } }).__mwtd;
      for (let step = 0; step < 400; step++) {
        d.settle(); // the harness's other players only act when settle runs
        const header = document.querySelector('header')?.textContent ?? '';
        if (/The year is over/i.test(header)) break;
        if (document.querySelector('.z-40 button')) { (document.querySelector('.z-40 button') as HTMLButtonElement).click(); await sleep(200); continue; }
        if (/placement/i.test(header)) { if (click(/fill the rest/)) { await sleep(150); click(/^lock in$/); } else if (!click(/^haunt$/)) click(/rest quietly/); }
        else if (/reveal/i.test(header)) { if (!click(/skip to the end/)) click(/^(next|finish)$/); }
        await sleep(250);
      }
    });
    await sleep(6000);
  });
  await browser.close();
  writeFileSync(join(OUT, 'timing.json'), JSON.stringify(timing, null, 1));
  console.log('lead-in seconds:', JSON.stringify(timing));
  console.log('shots:', readdirSync(OUT).filter((f) => f.endsWith('.mp4')).join(', '));
}
main().catch((e) => { console.error(e); process.exit(1); });
