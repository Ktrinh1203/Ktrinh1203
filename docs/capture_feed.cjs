const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\kissk\\.gemini\\antigravity\\brain\\41533415-5fc8-44c8-b2ca-bd6b9535971e';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1. Capture Landing Page (Sermo 2-column Hero + CME Split-Cards)
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'sermo_neurolink_landing_1440.png'), fullPage: false });
  console.log('Saved sermo_neurolink_landing_1440.png');

  // 2. Log in and capture 3-Column Clinical Feed across 3 viewports
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="text"], input[name="username"], input[placeholder*="username"], input#username, input:not([type="password"])', 'dr_minh');
  await page.fill('input[type="password"]', 'Password123');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/feed', { timeout: 15000 });
  await page.waitForTimeout(1500);

  // Desktop 1440 Feed
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'sermo_neurolink_feed_desktop_1440.png'), fullPage: false });
  await page.screenshot({ path: path.resolve(__dirname, 'screenshots/feed_optimized_desktop_1440.png'), fullPage: false });
  console.log('Saved sermo_neurolink_feed_desktop_1440.png');

  // Desktop 1440 EEG Health Hub
  await page.goto('http://localhost:5173/eeg-hub', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'neurolink_eeg_hub_desktop_1440.png'), fullPage: false });
  console.log('Saved neurolink_eeg_hub_desktop_1440.png');

  // Desktop 1440 Explore & Directory
  await page.goto('http://localhost:5173/search', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'neurolink_explore_desktop_1440.png'), fullPage: false });
  console.log('Saved neurolink_explore_desktop_1440.png');

  // Desktop 1440 Rewards Banner
  await page.goto('http://localhost:5173/rewards', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'neurolink_rewards_banner_1440.png'), fullPage: false });
  console.log('Saved neurolink_rewards_banner_1440.png');

  // Desktop 1440 Contributions Banner
  await page.goto('http://localhost:5173/contributions', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'neurolink_contributions_banner_1440.png'), fullPage: false });
  console.log('Saved neurolink_contributions_banner_1440.png');

  // Tablet 768 Feed
  await page.goto('http://localhost:5173/feed', { waitUntil: 'networkidle' });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'sermo_neurolink_feed_tablet_768.png'), fullPage: false });
  await page.screenshot({ path: path.resolve(__dirname, 'screenshots/feed_optimized_tablet_768.png'), fullPage: false });
  console.log('Saved sermo_neurolink_feed_tablet_768.png');

  // Mobile 375 Feed
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'sermo_neurolink_feed_mobile_375.png'), fullPage: false });
  await page.screenshot({ path: path.resolve(__dirname, 'screenshots/feed_optimized_mobile_375.png'), fullPage: false });
  console.log('Saved sermo_neurolink_feed_mobile_375.png');

  await browser.close();
  console.log('All Sermo-style NeuroLink screenshots captured successfully!');
})();
