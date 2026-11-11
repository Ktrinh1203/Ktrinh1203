const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  const page = await context.newPage();
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await page.fill('#identifier', 'dr_minh');
  await page.fill('#password', 'Password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/feed');
  await page.goto('http://localhost:5173/search', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'docs/handbook/screenshots/05_search_discovery.png' });
  console.log('✓ New search page screenshot saved!');
  await browser.close();
})();
