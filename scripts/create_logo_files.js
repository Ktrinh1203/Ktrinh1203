const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SOURCE_PNG = 'C:/Users/kissk/.gemini/antigravity/brain/41533415-5fc8-44c8-b2ca-bd6b9535971e/.user_uploaded/media_1793807065404_f3698bdd.png';

const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="tealBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00b8a2"/>
      <stop offset="100%" stop-color="#009282"/>
    </linearGradient>
    <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.12"/>
    </filter>
  </defs>

  <!-- Outer ambient ring -->
  <rect x="34" y="34" width="444" height="444" rx="136" fill="#e0f7f3" opacity="0.85"/>

  <!-- Main Squircle Body -->
  <rect x="48" y="48" width="416" height="416" rx="122" fill="url(#tealBg)"/>

  <!-- Pulse / ECG / EEG Wave -->
  <path d="M 152 256 L 194 256 Q 204 256 210 242 L 232 152 Q 237 132 247 136 Q 256 140 262 165 L 284 348 Q 290 376 300 372 Q 310 368 316 342 L 332 268 Q 338 256 348 256 L 360 256"
        fill="none"
        stroke="#ffffff"
        stroke-width="32"
        stroke-linecap="round"
        stroke-linejoin="round"/>

  <!-- Top-Right Emerald Badge Dot -->
  <circle cx="436" cy="68" r="44" fill="#00c853"/>
</svg>
`;

async function main() {
  console.log('Copying user uploaded original PNG...');
  const originalBuf = fs.readFileSync(SOURCE_PNG);

  // Destinations
  const dirs = [
    path.resolve(__dirname, '../client/public'),
    path.resolve(__dirname, '../docs'),
    path.resolve(__dirname, '..'),
  ];

  dirs.forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  // Save original PNG
  fs.writeFileSync(path.resolve(__dirname, '../client/public/logo-original.png'), originalBuf);
  fs.writeFileSync(path.resolve(__dirname, '../client/public/logo.png'), originalBuf);
  fs.writeFileSync(path.resolve(__dirname, '../docs/logo.png'), originalBuf);
  fs.writeFileSync(path.resolve(__dirname, '../logo.png'), originalBuf);
  console.log('✓ Saved original PNG to logo.png and client/public/logo.png');

  // Save Vector SVG
  fs.writeFileSync(path.resolve(__dirname, '../client/public/logo.svg'), svgContent);
  fs.writeFileSync(path.resolve(__dirname, '../client/public/favicon.svg'), svgContent);
  fs.writeFileSync(path.resolve(__dirname, '../docs/logo.svg'), svgContent);
  fs.writeFileSync(path.resolve(__dirname, '../logo.svg'), svgContent);
  console.log('✓ Saved vector SVG to logo.svg and client/public/logo.svg');

  // Render High-Resolution PNG via Playwright (512x512)
  console.log('Rendering 512x512 high-resolution master PNG...');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 512, height: 512 });
  
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
          svg { width: 512px; height: 512px; display: block; }
        </style>
      </head>
      <body>
        ${svgContent}
      </body>
    </html>
  `);

  await page.waitForTimeout(500);

  const png512 = await page.screenshot({ omitBackground: true });
  fs.writeFileSync(path.resolve(__dirname, '../client/public/logo-512.png'), png512);
  fs.writeFileSync(path.resolve(__dirname, '../docs/logo-512.png'), png512);
  fs.writeFileSync(path.resolve(__dirname, '../logo-512.png'), png512);
  console.log('✓ Rendered 512x512 crisp PNG to logo-512.png');

  await browser.close();
  console.log('ALL LOGO FILES CREATED SUCCESSFULLY!');
}

main().catch(err => {
  console.error('Error generating logo:', err);
  process.exit(1);
});
