#!/usr/bin/env node
// Builds the app icon from the card-back skull, roughed up to sit beside the role portraits:
// crushed shadows, dirt, ink spatter, scratches and a wobbly inked frame.
// Usage: node art/make_icon.mjs            (writes web/public/*.png)
//        node art/make_icon.mjs --preview DIR   (also writes the 1024 master and a size sheet to DIR)
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'web/public');
const previewDir = process.argv.includes('--preview') ? process.argv[process.argv.indexOf('--preview') + 1] : null;
const src = 'data:image/webp;base64,' + readFileSync(join(root, 'art/originals/basic-card-back.webp')).toString('base64');

// Square window onto the 864x1152 card back: the skull, its cap and the coins either side.
const CROP = { x: 148, y: 328, size: 568 };
const S = 1024;
const k = S / CROP.size;

const page = (rounded) => `<!doctype html><html><head><style>
  html, body { margin: 0; background: transparent; }
  #icon { position: relative; width: ${S}px; height: ${S}px; overflow: hidden; background: #1a120c;
          border-radius: ${rounded ? 208 : 0}px; }
  #icon > * { position: absolute; inset: 0; }
  #art { background: url(${src}) no-repeat; background-size: ${864 * k}px ${1152 * k}px;
         background-position: ${-CROP.x * k}px ${-CROP.y * k}px;
         filter: url(#ink) contrast(1.12) saturate(0.9) brightness(1.0) sepia(0.12); }
  #grime   { mix-blend-mode: multiply; }
  #scratch { mix-blend-mode: multiply; opacity: .4; }
  #spatter { mix-blend-mode: multiply; }
  #dust    { mix-blend-mode: screen; opacity: .22; }
  #vignette { mix-blend-mode: multiply;
              background: radial-gradient(ellipse 62% 62% at 50% 50%, #fff 58%, #c9ad88 80%, #6a4a2e 100%); }
</style></head><body>
<svg width="0" height="0" style="position:absolute"><defs>
  <!-- thicken and roughen the line work a touch so it holds at 32px -->
  <filter id="ink" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <!-- blotchy dirt: big soft stains, kept mostly light so it only bites in patches -->
  <filter id="f-grime" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="5" seed="11"/>
    <feColorMatrix values="0 0 0 0 .42  0 0 0 0 .30  0 0 0 0 .20  1.5 0 0 0 -0.62"/>
  </filter>
  <!-- fine paper grain -->
  <filter id="f-grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/>
    <feColorMatrix values="0 0 0 0 .16  0 0 0 0 .11  0 0 0 0 .07  0 1.2 0 0 -0.5"/>
  </filter>
  <!-- hatching: noise stretched along one axis, thresholded to thin dark strokes -->
  <filter id="f-scratch" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.004 0.22" numOctaves="2" seed="19"/>
    <feColorMatrix values="0 0 0 0 .10  0 0 0 0 .07  0 0 0 0 .05  0 0 7 0 -4.35"/>
  </filter>
  <!-- ink spatter: mid-frequency noise thresholded hard into specks and blots -->
  <filter id="f-spatter" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="42"/>
    <feColorMatrix values="0 0 0 0 .09  0 0 0 0 .06  0 0 0 0 .04  0 0 0 26 -18.6"/>
    <feGaussianBlur stdDeviation="0.7"/>
  </filter>
  <!-- pale flecks, like chipped paint -->
  <filter id="f-dust" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.11" numOctaves="2" seed="5"/>
    <feColorMatrix values="0 0 0 0 .85  0 0 0 0 .78  0 0 0 0 .62  0 30 0 0 -23"/>
  </filter>
  <filter id="f-rough" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="23" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="16" xChannelSelector="R" yChannelSelector="B"/>
  </filter>
</defs></svg>
<div id="icon">
  <div id="art"></div>
  <svg id="grime" viewBox="0 0 ${S} ${S}"><rect width="${S}" height="${S}" filter="url(#f-grime)"/>
    <rect width="${S}" height="${S}" filter="url(#f-grain)"/></svg>
  <svg id="scratch" viewBox="0 0 ${S} ${S}"><g transform="rotate(-38 ${S / 2} ${S / 2})">
    <rect x="-200" y="-200" width="${S + 400}" height="${S + 400}" filter="url(#f-scratch)"/></g></svg>
  <svg id="spatter" viewBox="0 0 ${S} ${S}"><rect width="${S}" height="${S}" filter="url(#f-spatter)"/></svg>
  <svg id="dust" viewBox="0 0 ${S} ${S}"><rect width="${S}" height="${S}" filter="url(#f-dust)"/></svg>
  <div id="vignette"></div>
  <!-- heavy, uneven inked frame -->
  <svg id="frame" viewBox="0 0 ${S} ${S}"><g filter="url(#f-rough)" fill="none">
    <rect x="6" y="6" width="${S - 12}" height="${S - 12}" rx="${rounded ? 202 : 40}" stroke="#140d08" stroke-width="44"/>
    <rect x="42" y="42" width="${S - 84}" height="${S - 84}" rx="${rounded ? 168 : 30}" stroke="#7a5632" stroke-width="8" opacity=".85"/>
  </g></svg>
</div></body></html>`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: S, height: S }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const master = {};
for (const rounded of [true, false]) {
  await p.setContent(page(rounded));
  await p.waitForFunction(() => document.fonts.ready.then(() => true));
  master[rounded] = (await p.locator('#icon').screenshot({ omitBackground: true })).toString('base64');
}

// Downscale each size from the 1024 master in the browser (smooth, keeps the transparent corners).
async function emit(file, size, rounded, dir = out) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<body style="margin:0;background:transparent"><canvas id="c" width="${size}" height="${size}"></canvas></body>`);
  await p.evaluate(async ({ b64, size }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    // step down by halves so small sizes stay crisp rather than aliased
    let cur = img, w = img.width;
    while (w / 2 >= size) {
      w /= 2;
      const c = new OffscreenCanvas(w, w);
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, w, w);
      cur = c;
    }
    const g = document.getElementById('c').getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(cur, 0, 0, size, size);
  }, { b64: master[rounded], size });
  await p.locator('#c').screenshot({ path: join(dir, file), omitBackground: true });
}

await emit('favicon-32.png', 32, true);
await emit('favicon-64.png', 64, true);
await emit('icon-192.png', 192, true);
await emit('icon-512.png', 512, true);
await emit('apple-touch-icon.png', 180, false); // iOS rounds the corners itself

if (previewDir) {
  mkdirSync(previewDir, { recursive: true });
  await emit('master-rounded.png', 1024, true, previewDir);
  await p.setViewportSize({ width: 1312, height: 304 });
  const img = (s) => `<img src="data:image/png;base64,${master.true}" width="${s}" height="${s}">`;
  const row = (bg) => `<div style="background:${bg};padding:24px;display:flex;gap:28px;align-items:flex-end">${[256, 128, 64, 32, 16].map(img).join('')}</div>`;
  await p.setContent(`<body style="margin:0;display:flex">${row('#f4efe6')}${row('#17120e')}</body>`);
  await p.screenshot({ path: join(previewDir, 'sheet.png') });
}
await browser.close();
console.log('icons written to web/public' + (previewDir ? ` (preview in ${previewDir})` : ''));
