const { chromium } = require('playwright');
const path = require('path');

const SCREENSHOTS_DIR = path.resolve(__dirname, '../docs/handbook/screenshots');

async function run() {
  console.log('Capturing Admin Tabs with exact button texts...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });

  const page = await context.newPage();

  async function snap(filename, delay = 800) {
    await page.waitForTimeout(delay);
    const dest = path.join(SCREENSHOTS_DIR, filename);
    await page.screenshot({ path: dest, fullPage: false });
    console.log(`✓ Saved ${filename}`);
  }

  try {
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
    await page.fill('#identifier', 'admin');
    await page.fill('#password', 'Password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/feed', { timeout: 10000 });

    await page.goto('http://localhost:5173/admin', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await snap('14_admin_verifications.png');

    // 15. Xét duyệt Đóng góp
    console.log('Clicking Xét duyệt Đóng góp...');
    await page.locator('button:has-text("Xét duyệt Đóng góp")').click();
    await page.waitForTimeout(1200);
    await snap('15_admin_contributions.png');

    // 16. Phần thưởng & Đổi quà
    console.log('Clicking Phần thưởng & Đổi quà...');
    await page.locator('button:has-text("Phần thưởng & Đổi quà")').click();
    await page.waitForTimeout(1200);
    await snap('16_admin_rewards_catalog.png');

    // 17. Quản lý Ví Tín chỉ
    console.log('Clicking Quản lý Ví Tín chỉ...');
    await page.locator('button:has-text("Quản lý Ví Tín chỉ")').click();
    await page.waitForTimeout(1200);
    await snap('17_admin_wallets_audit.png');

    // 18. Báo cáo Vi phạm
    console.log('Clicking Báo cáo Vi phạm...');
    await page.locator('button:has-text("Báo cáo Vi phạm")').click();
    await page.waitForTimeout(1200);
    await snap('18_admin_reports.png');

    console.log('Admin tabs captured successfully!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

run();
