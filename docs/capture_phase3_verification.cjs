const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\kissk\\.gemini\\antigravity\\brain\\41533415-5fc8-44c8-b2ca-bd6b9535971e';

async function loginAs(page, usernameOrEmail, password = 'Password123') {
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="text"], input[name="username"], input:not([type="password"])', usernameOrEmail);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  await page.waitForTimeout(900);
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  // 1. DOCTOR + VERIFIED (dr_minh) -> Automatically resolves to PROFESSIONAL_MODE
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await loginAs(page, 'dr_minh');
    await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase3_verified_doctor_pro_1440.png') });
    console.log('Saved phase3_verified_doctor_pro_1440.png');

    await page.goto('http://localhost:5173/eeg-hub?view=workspace', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase3_eeg_workspace_consent_1440.png') });
    console.log('Saved phase3_eeg_workspace_consent_1440.png');
    await ctx.close();
  }

  // 2. RESEARCH_STUDENT + PENDING (tuan_bme) -> Locked to GENERAL_MODE + enable_verification_center = true
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await loginAs(page, 'tuan_bme');
    await page.goto('http://localhost:5173/feed', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase3_pending_student_general_1440.png') });
    console.log('Saved phase3_pending_student_general_1440.png');

    // Attempt navigating to /dashboard ->RequireVerifiedProfessional redirects to /settings#verification-center
    await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase3_pending_verification_center_1440.png') });
    console.log('Saved phase3_pending_verification_center_1440.png');
    await ctx.close();
  }

  // 3. HEALTHCARE_WORKER + REJECTED (ktv_linh) -> Locked to GENERAL_MODE + enable_resubmission = true
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await loginAs(page, 'ktv_linh');
    await page.goto('http://localhost:5173/feed', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase3_rejected_worker_resubmit_1440.png') });
    console.log('Saved phase3_rejected_worker_resubmit_1440.png');

    await page.goto('http://localhost:5173/settings#verification-center', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase3_rejected_resubmission_center_1440.png') });
    console.log('Saved phase3_rejected_resubmission_center_1440.png');
    await ctx.close();
  }

  // 4. GENERAL_USER (hoa_health) -> GENERAL_MODE + Data-Owner Consent Management in My EEG
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await loginAs(page, 'hoa_health');
    await page.goto('http://localhost:5173/eeg-hub?view=personal', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const accessBtn = page.locator('button', { hasText: 'Phân quyền Bác sĩ' });
    if (await accessBtn.count()) {
      await accessBtn.click();
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase3_data_owner_eeg_consent_1440.png') });
    console.log('Saved phase3_data_owner_eeg_consent_1440.png');

    // Tablet 768x1024
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase3_tablet_768.png') });
    console.log('Saved phase3_tablet_768.png');

    // Mobile 375x812
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase3_mobile_375.png') });
    console.log('Saved phase3_mobile_375.png');
    await ctx.close();
  }

  await browser.close();
  console.log('All Phase 3 screenshots completed successfully!');
})();
