const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = path.resolve(__dirname, '../docs/handbook/screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function run() {
  console.log('Starting Playwright screenshot capture...');
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
    // 1. Landing Page
    console.log('Navigating to Landing Page...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    await snap('01_landing.png');

    // 2. Login Page
    console.log('Navigating to Login Page...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
    await snap('02_login.png');

    // 3. Register Page
    console.log('Navigating to Register Page...');
    await page.goto('http://localhost:5173/register', { waitUntil: 'networkidle' });
    await snap('03_register.png');

    // Log in as Doctor (dr_minh)
    console.log('Logging in as dr_minh...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
    await page.fill('#identifier', 'dr_minh');
    await page.fill('#password', 'Password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/feed', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // 4. Main Feed
    console.log('Capturing Main Feed...');
    await snap('04_feed.png');

    // 5. Search & Discovery
    console.log('Capturing Search & Discovery...');
    await page.goto('http://localhost:5173/search', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await snap('05_search_discovery.png');

    // 6. Professional Directory
    console.log('Capturing Professionals Directory...');
    await page.goto('http://localhost:5173/search?category=professionals', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await snap('06_professionals_directory.png');

    // 7. Doctor Profile
    console.log('Capturing Doctor Profile...');
    await page.goto('http://localhost:5173/u/dr_minh', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await snap('07_doctor_profile.png');

    // 8. Researcher Profile
    console.log('Capturing Researcher Profile...');
    await page.goto('http://localhost:5173/u/prof_lan', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await snap('08_researcher_profile.png');

    // 9. Messages
    console.log('Capturing Messages...');
    await page.goto('http://localhost:5173/messages', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await snap('09_messages.png');

    // 10. Notifications
    console.log('Capturing Notifications...');
    await page.goto('http://localhost:5173/notifications', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await snap('10_notifications.png');

    // 11. Settings & Verification
    console.log('Capturing Settings & Verification...');
    await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await snap('11_settings_verification.png');

    // 12. Contributions Center
    console.log('Capturing Contributions Center...');
    await page.goto('http://localhost:5173/contributions', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await snap('12_contributions_center.png');

    // 13. Rewards Page & Credit Wallet
    console.log('Capturing Rewards Page & Credit Wallet...');
    await page.goto('http://localhost:5173/rewards', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await snap('13_rewards_wallet.png');

    // Logout and Login as Admin
    console.log('Logging in as Admin...');
    await context.clearCookies();
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
    await page.fill('#identifier', 'admin');
    await page.fill('#password', 'Password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/feed', { timeout: 10000 });

    // 14. Admin Verifications
    console.log('Capturing Admin Verifications...');
    await page.goto('http://localhost:5173/admin', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await snap('14_admin_verifications.png');

    // 15. Admin Contributions
    console.log('Capturing Admin Contributions...');
    const contribTabBtn = page.locator('button:has-text("Thẩm định Đóng góp")');
    if (await contribTabBtn.count() > 0) {
      await contribTabBtn.first().click();
      await page.waitForTimeout(1000);
    }
    await snap('15_admin_contributions.png');

    // 16. Admin Rewards Catalog
    console.log('Capturing Admin Rewards Catalog...');
    const rewardsTabBtn = page.locator('button:has-text("Danh mục Phần thưởng")');
    if (await rewardsTabBtn.count() > 0) {
      await rewardsTabBtn.first().click();
      await page.waitForTimeout(1000);
    }
    await snap('16_admin_rewards_catalog.png');

    // 17. Admin Wallets Audit
    console.log('Capturing Admin Wallets Audit...');
    const walletsTabBtn = page.locator('button:has-text("Kiểm toán Ví Tín chỉ")');
    if (await walletsTabBtn.count() > 0) {
      await walletsTabBtn.first().click();
      await page.waitForTimeout(1000);
    }
    await snap('17_admin_wallets_audit.png');

    // 18. Admin Reports
    console.log('Capturing Admin Reports...');
    const reportsTabBtn = page.locator('button:has-text("Báo cáo Vi phạm")');
    if (await reportsTabBtn.count() > 0) {
      await reportsTabBtn.first().click();
      await page.waitForTimeout(1000);
    }
    await snap('18_admin_reports.png');

    console.log('ALL_SCREENSHOTS_CAPTURED_SUCCESSFULLY');
  } catch (err) {
    console.error('Error during screenshot capture:', err);
  } finally {
    await browser.close();
  }
}

run();
