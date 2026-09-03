// Screenshots the local harness in a given state. Usage: node scripts/shot-harness.ts placement|reveal out.png [seed] [seats]
import { chromium } from 'playwright';
const [state, out, seed = '28', seats = '5'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto(`http://localhost:5173/dev?seed=${seed}&seats=${seats}&clean`, { waitUntil: 'networkidle' });
await page.waitForSelector('footer [aria-label]');
const click = (re: string) => page.evaluate((src) => { const b = [...document.querySelectorAll('button')].find((x) => new RegExp(src, 'i').test(x.innerText.trim())); if (b) { b.click(); return true; } return false; }, re);
if (state.startsWith('reveal')) { await click('fill the rest'); await page.waitForTimeout(300); await click('^lock in$'); await page.waitForTimeout(2500); for (let i = Number(state.split(':')[1] ?? 0); i > 0; i--) { await click('^next$'); await page.waitForTimeout(2200); } }
else await page.waitForTimeout(800);
await page.screenshot({ path: out });
await browser.close(); console.log('saved', out);
