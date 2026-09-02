// Renders title/end cards as 1920x1080 PNGs with the app's fonts, for the stitch step.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] ?? 'video/out/cards';
mkdirSync(OUT, { recursive: true });
const cards: Record<string, [string, string]> = {
  title: ['A Million Ways to Die in Medieval', 'Honest trades, unfortunate accidents'],
  end: ['A Million Ways to Die in Medieval', 'Gather three to eight friends. Try not to die.'],
};
const html = (h: string, s: string) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Eczar:wght@700;800&family=Alegreya+Sans:wght@500&display=swap">
<style>body{margin:0;width:1920px;height:1080px;background:radial-gradient(ellipse 120% 90% at 50% 10%,#232B3F 0%,#161B28 45%,#0D1017 100%);color:#E9E5DB;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Eczar,Georgia,serif}
.skull{font-size:110px;margin-bottom:24px}h1{font-size:104px;font-weight:800;margin:0;line-height:1.05;text-align:center;max-width:1500px}p{font-family:"Alegreya Sans",sans-serif;font-size:38px;letter-spacing:.22em;text-transform:uppercase;color:#D8A84F;margin:36px 0 0}</style></head>
<body><div class="skull">💀</div><h1>${h}</h1><p>${s}</p></body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
for (const [name, [h, s]] of Object.entries(cards)) {
  await page.setContent(html(h, s), { waitUntil: 'networkidle' });
  await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('card', name);
}
await browser.close();
