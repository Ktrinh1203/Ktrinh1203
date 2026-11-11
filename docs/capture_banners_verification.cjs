const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\kissk\\.gemini\\antigravity\\brain\\41533415-5fc8-44c8-b2ca-bd6b9535971e';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Log in as dr_minh
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="text"], input[name="username"], input:not([type="password"])', 'dr_minh');
  await page.fill('input[type="password"]', 'Password123');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/feed', { timeout: 15000 });
  await page.waitForTimeout(800);

  // 1. Rewards Page Banner
  await page.goto('http://localhost:5173/rewards', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_rewards_banner.png'), fullPage: false });
  console.log('Saved verified_rewards_banner.png');

  // 2. Contributions Page Banner
  await page.goto('http://localhost:5173/contributions', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_contributions_banner.png'), fullPage: false });
  console.log('Saved verified_contributions_banner.png');

  await browser.close();
})();
