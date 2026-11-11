const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 1200 });

  console.log('Navigating to Dribbble shot...');
  try {
    await page.goto('https://dribbble.com/shots/25443650-MindBridge-Mental-Health-App-UI-Design', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(4000);

    const shotDir = path.resolve(__dirname, '../docs/mindbridge_ref');
    if (!fs.existsSync(shotDir)) fs.mkdirSync(shotDir, { recursive: true });

    await page.screenshot({ path: path.join(shotDir, 'dribbble_shot.png'), fullPage: false });
    console.log('Saved dribbble_shot.png');

    // Extract image sources
    const imgUrls = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.map(img => ({ src: img.src, alt: img.alt, class: img.className })).filter(i => i.src && i.src.includes('cdn.dribbble.com'));
    });
    console.log('Found images:', imgUrls.slice(0, 10));

    // Also extract colors and text styles
    const styles = await page.evaluate(() => {
      const body = window.getComputedStyle(document.body);
      return {
        fontFamily: body.fontFamily,
        backgroundColor: body.backgroundColor,
      };
    });
    console.log('Page body styles:', styles);
  } catch (err) {
    console.error('Error fetching Dribbble:', err.message);
  } finally {
    await browser.close();
  }
}

main();
