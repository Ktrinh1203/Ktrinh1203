const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 1800 });

  await page.goto('https://dribbble.com/shots/25443650-MindBridge-Mental-Health-App-UI-Design', {
    waitUntil: 'networkidle',
    timeout: 30000,
  });

  // Scroll to video
  await page.waitForTimeout(3000);

  const video = page.locator('video').first();
  if (await video.count() > 0) {
    await video.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
    const box = await video.boundingBox();
    if (box) {
      const shotDir = path.resolve(__dirname, '../docs/mindbridge_ref');
      await page.screenshot({
        path: path.join(shotDir, 'mindbridge_frame.png'),
        clip: box,
      });
      console.log('Saved mindbridge_frame.png with clip box:', box);
    }
  }

  // Also take full screenshot of shot container
  const shotContainer = page.locator('.shot-container, .media-container, main').first();
  if (await shotContainer.count() > 0) {
    await shotContainer.screenshot({ path: path.join(path.resolve(__dirname, '../docs/mindbridge_ref'), 'shot_container.png') });
    console.log('Saved shot_container.png');
  }

  await browser.close();
}

main().catch(console.error);
