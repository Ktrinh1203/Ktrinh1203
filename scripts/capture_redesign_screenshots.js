const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function main() {
  const outDir = path.resolve(__dirname, '../docs/screenshots');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  // 1. Desktop Context (1440x900)
  const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktopPage = await desktopCtx.newPage();

  // Navigate to login
  await desktopPage.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await desktopPage.fill('input[type="text"], input[name="username"], input[placeholder*="username"], input#username, input:not([type="password"])', 'dr_minh');
  await desktopPage.fill('input[type="password"]', 'Password123');
  await desktopPage.click('button[type="submit"]');

  // Wait for feed to load
  await desktopPage.waitForURL('**/feed', { timeout: 15000 });
  await desktopPage.waitForTimeout(2000);

  // Capture Feed Desktop
  await desktopPage.screenshot({ path: path.join(outDir, '01_feed_desktop_1440.png'), fullPage: false });
  console.log('Saved 01_feed_desktop_1440.png');

  // Navigate to Search
  await desktopPage.goto('http://localhost:5173/search', { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(2000);
  await desktopPage.screenshot({ path: path.join(outDir, '02_search_desktop_1440.png'), fullPage: false });
  console.log('Saved 02_search_desktop_1440.png');

  // Navigate to Contributions
  await desktopPage.goto('http://localhost:5173/contributions', { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(2000);
  await desktopPage.screenshot({ path: path.join(outDir, '03_contributions_desktop_1440.png'), fullPage: false });
  console.log('Saved 03_contributions_desktop_1440.png');

  // Navigate to Rewards
  await desktopPage.goto('http://localhost:5173/rewards', { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(2000);
  await desktopPage.screenshot({ path: path.join(outDir, '04_rewards_desktop_1440.png'), fullPage: false });
  console.log('Saved 04_rewards_desktop_1440.png');

  // Navigate to Messages
  await desktopPage.goto('http://localhost:5173/messages', { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(2000);
  await desktopPage.screenshot({ path: path.join(outDir, '05_messages_desktop_1440.png'), fullPage: false });
  console.log('Saved 05_messages_desktop_1440.png');

  // 2. Tablet Context (768x1024)
  const tabletCtx = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const tabletPage = await tabletCtx.newPage();
  await tabletPage.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await tabletPage.fill('input:not([type="password"])', 'dr_minh');
  await tabletPage.fill('input[type="password"]', 'Password123');
  await tabletPage.click('button[type="submit"]');
  await tabletPage.waitForURL('**/feed', { timeout: 15000 });
  await tabletPage.waitForTimeout(2000);
  await tabletPage.screenshot({ path: path.join(outDir, '06_feed_tablet_768.png'), fullPage: false });
  console.log('Saved 06_feed_tablet_768.png');

  // 3. Mobile Context (375x812)
  const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await mobilePage.fill('input:not([type="password"])', 'dr_minh');
  await mobilePage.fill('input[type="password"]', 'Password123');
  await mobilePage.click('button[type="submit"]');
  await mobilePage.waitForURL('**/feed', { timeout: 15000 });
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({ path: path.join(outDir, '07_feed_mobile_375.png'), fullPage: false });
  console.log('Saved 07_feed_mobile_375.png');

  await browser.close();
  console.log('All screenshots captured successfully!');
}

main().catch(console.error);