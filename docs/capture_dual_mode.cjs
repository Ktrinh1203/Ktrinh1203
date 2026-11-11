const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\kissk\\.gemini\\antigravity\\brain\\41533415-5fc8-44c8-b2ca-bd6b9535971e';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1. Log in as dr_minh
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="text"], input[name="username"], input:not([type="password"])', 'dr_minh');
  await page.fill('input[type="password"]', 'Password123');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/feed', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // -------------------------------------------------------------
  // A. PROFESSIONAL MODE CAPTURES
  // -------------------------------------------------------------
  await page.evaluate(() => localStorage.setItem('neurolink_app_mode', 'professional'));

  // 1. Professional Dashboard
  await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'professional_mode_dashboard_1440.png'), fullPage: false });
  console.log('Saved professional_mode_dashboard_1440.png');

  // 2. Professional Feed
  await page.goto('http://localhost:5173/feed', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'professional_mode_feed_1440.png'), fullPage: false });
  console.log('Saved professional_mode_feed_1440.png');

  // 3. Professional Communities (Specialty Boards)
  await page.goto('http://localhost:5173/communities', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'professional_mode_communities_1440.png'), fullPage: false });
  console.log('Saved professional_mode_communities_1440.png');

  // 4. EEG Workspace
  await page.goto('http://localhost:5173/eeg-hub?view=workspace', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'professional_mode_eeg_workspace_1440.png'), fullPage: false });
  console.log('Saved professional_mode_eeg_workspace_1440.png');

  // -------------------------------------------------------------
  // B. GENERAL MODE CAPTURES
  // -------------------------------------------------------------
  await page.evaluate(() => localStorage.setItem('neurolink_app_mode', 'general'));

  // 5. General Mode Home Feed
  await page.goto('http://localhost:5173/feed', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'general_mode_feed_1440.png'), fullPage: false });
  console.log('Saved general_mode_feed_1440.png');

  // 6. My Health
  await page.goto('http://localhost:5173/my-health', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'general_mode_my_health_1440.png'), fullPage: false });
  console.log('Saved general_mode_my_health_1440.png');

  // 7. General Communities
  await page.goto('http://localhost:5173/communities', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'general_mode_communities_1440.png'), fullPage: false });
  console.log('Saved general_mode_communities_1440.png');

  // 8. My EEG (Personal Records)
  await page.goto('http://localhost:5173/eeg-hub?view=personal', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'general_mode_my_eeg_1440.png'), fullPage: false });
  console.log('Saved general_mode_my_eeg_1440.png');

  // 9. Mobile Viewport (General Mode Home)
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://localhost:5173/feed', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'general_mode_mobile_375.png'), fullPage: false });
  console.log('Saved general_mode_mobile_375.png');

  // 10. Mobile Viewport (Professional Mode Dashboard)
  await page.evaluate(() => localStorage.setItem('neurolink_app_mode', 'professional'));
  await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'professional_mode_mobile_375.png'), fullPage: false });
  console.log('Saved professional_mode_mobile_375.png');

  await browser.close();
  console.log('Dual mode captures finished successfully!');
})();
