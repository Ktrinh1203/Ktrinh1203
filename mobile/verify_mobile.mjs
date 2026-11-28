import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5174';
const ALT_HOST_URL = 'http://127.0.0.1:5174';
const SHOT_DIR = path.resolve('D:/Antigravity/Neurolink_V1.1/docs/verification_screenshots/mobile');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const results = {
  passed: [],
  failed: [],
  consoleErrors: [],
  pageErrors: [],
  badResponses: [],
  shots: [],
};

function assert(cond, label) {
  if (cond) {
    results.passed.push(label);
  } else {
    results.failed.push(label);
  }
}

async function checkNoHorizontalOverflow(page, label) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert(
    scrollWidth <= clientWidth + 1,
    `No horizontal overflow [${label}] (scroll=${scrollWidth}, client=${clientWidth})`,
  );
}

async function shot(page, name) {
  const p = path.join(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  results.shots.push(p);
}

async function dismissOnboardingIfPresent(page) {
  const modal = page.locator('[role="dialog"][aria-label*="Liên kết mã thiết bị"]');
  await modal.waitFor({ state: 'visible', timeout: 400 }).catch(() => {});
  if (await modal.isVisible().catch(() => false)) {
    const skipBtn = modal.locator('button[aria-label="Bỏ qua"], button:has-text("Để sau")').first();
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click();
      await modal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }
  }
}

async function checkStoryStripUnclipped(page, label) {
  const metrics = await page.evaluate(() => {
    const strip = document.querySelector('[data-story-strip="true"]');
    if (!strip) return { found: false };
    const measure = () => {
      const stripRect = strip.getBoundingClientRect();
      const rings = Array.from(strip.querySelectorAll('[data-story-ring="true"]'));
      const issues = [];
      let minTopGap = Infinity;
      let minBottomGap = Infinity;
      let minLeftGap = Infinity;

      rings.forEach((ring, idx) => {
        const r = ring.getBoundingClientRect();
        const topGap = r.top - stripRect.top;
        const bottomGap = stripRect.bottom - r.bottom;
        minTopGap = Math.min(minTopGap, topGap);
        minBottomGap = Math.min(minBottomGap, bottomGap);
        if (idx === 0) minLeftGap = r.left - stripRect.left;
        if (topGap < 8) issues.push(`ring[${idx}] topGap=${topGap.toFixed(1)}px`);
        if (bottomGap < 8) issues.push(`ring[${idx}] bottomGap=${bottomGap.toFixed(1)}px`);
        if (idx === 0 && strip.scrollLeft === 0 && r.left - stripRect.left < 8) {
          issues.push(`ring[0] leftGap=${(r.left - stripRect.left).toFixed(1)}px`);
        }
        if (Math.abs(r.width - r.height) > 0.5) {
          issues.push(`ring[${idx}] not circular (${r.width.toFixed(1)}x${r.height.toFixed(1)})`);
        }
        const dot = ring.querySelector('span[aria-hidden="true"].rounded-full.bg-\\[\\#16A34A\\]');
        if (dot) {
          const d = dot.getBoundingClientRect();
          if (d.top < stripRect.top + 4 || d.bottom > stripRect.bottom - 4) {
            issues.push(`dot[${idx}] clipped vertically`);
          }
        }
      });

      return { count: rings.length, minTopGap, minBottomGap, minLeftGap, issues };
    };

    strip.scrollLeft = 0;
    const atStart = measure();
    strip.scrollLeft = 40;
    const atScrolled = measure();
    strip.scrollLeft = 0;

    return {
      found: true,
      count: atStart.count,
      minTopGap: Number.isFinite(atStart.minTopGap) ? Number(atStart.minTopGap.toFixed(1)) : 0,
      minBottomGap: Number.isFinite(atStart.minBottomGap) ? Number(atStart.minBottomGap.toFixed(1)) : 0,
      minLeftGap: Number.isFinite(atStart.minLeftGap) ? Number(atStart.minLeftGap.toFixed(1)) : 0,
      issues: [...atStart.issues, ...atScrolled.issues.map((s) => `scroll40:${s}`)],
    };
  });

  assert(
    metrics.found && metrics.count > 0 && metrics.issues.length === 0,
    `Story avatar bubbles unclipped [${label}] (count=${metrics.count ?? 0}, topGap=${metrics.minTopGap}px, bottomGap=${metrics.minBottomGap}px, leftGap=${metrics.minLeftGap}px, issues=${JSON.stringify(metrics.issues ?? [])})`,
  );
}

async function checkPillTabsPadding(page, label) {
  const metrics = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('[data-pill-tabs="true"]'));
    if (tabs.length === 0) return { found: false, issues: ['No PillTabs found'] };
    const issues = [];
    const summary = [];

    tabs.forEach((el, tabIdx) => {
      const buttons = Array.from(el.querySelectorAll('button'));
      if (buttons.length === 0) return;

      el.scrollLeft = 0;
      const boxStart = el.getBoundingClientRect();
      const firstRect = buttons[0].getBoundingClientRect();
      const topGap = firstRect.top - boxStart.top;
      const bottomGap = boxStart.bottom - firstRect.bottom;
      const leftGap = firstRect.left - boxStart.left;

      el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
      const boxEnd = el.getBoundingClientRect();
      const lastRect = buttons[buttons.length - 1].getBoundingClientRect();
      const rightGap = boxEnd.right - lastRect.right;
      el.scrollLeft = 0;

      if (topGap < 4) issues.push(`tabs[${tabIdx}] top=${topGap.toFixed(1)}px`);
      if (bottomGap < 4) issues.push(`tabs[${tabIdx}] bottom=${bottomGap.toFixed(1)}px`);
      if (leftGap < 4) issues.push(`tabs[${tabIdx}] left=${leftGap.toFixed(1)}px`);
      if (rightGap < 4) issues.push(`tabs[${tabIdx}] right=${rightGap.toFixed(1)}px`);

      summary.push({
        top: Number(topGap.toFixed(1)),
        bottom: Number(bottomGap.toFixed(1)),
        left: Number(leftGap.toFixed(1)),
        right: Number(rightGap.toFixed(1)),
      });
    });

    return { found: true, summary, issues };
  });

  assert(
    metrics.found && metrics.issues.length === 0,
    `PillTabs focus-ring padding >= 4px all sides [${label}] (${JSON.stringify(metrics.summary ?? [])}, issues=${JSON.stringify(metrics.issues)})`,
  );
}

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

try {
  // 0. Verify existing Web (5173), Mobile (5174), and API (4000) are healthy
  const web5173 = await fetch('http://localhost:5173').then((r) => r.status).catch(() => 0);
  const mobile5174 = await fetch('http://localhost:5174').then((r) => r.status).catch(() => 0);
  const api4000 = await fetch('http://127.0.0.1:4000/api/health').then((r) => r.status).catch(() => 0);
  assert(web5173 === 200, `Existing Desktop Web on 5173 undisturbed (status=${web5173})`);
  assert(mobile5174 === 200, `Standalone Mobile on 5174 healthy (status=${mobile5174})`);
  assert(api4000 === 200, `Live API on 4000 healthy (status=${api4000})`);

  // =========================================================================
  // SUITE 1: General Mode (hoa_health) — Read, Write Mutations & Edge Cases
  // =========================================================================
  const ctx1 = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx1.newPage();

  let allowAuth401 = true;
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (allowAuth401 && text.includes('401')) return;
      results.consoleErrors.push(`[general] ${text}`);
    }
  });
  page.on('pageerror', (err) => results.pageErrors.push(`[general] ${err.message}`));
  page.on('response', (res) => {
    const url = res.url();
    if (res.status() >= 400) {
      if (allowAuth401 && url.includes('/api/auth/')) return;
      results.badResponses.push(`[general] ${res.status()} ${url}`);
    }
  });

  // 1a. Clean Login screen screenshot FIRST (zero error banner), then negative auth & register checks
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[placeholder="Tên đăng nhập hoặc email"]');
  await checkNoHorizontalOverflow(page, 'login-375');

  // Reveal quick demo strip and capture CLEAN initial Auth screen (no red alert banner)
  await page.click('text=Vào nhanh tài khoản mẫu');
  await page.waitForTimeout(250);
  const initialAlertCount = await page.locator('[role="alert"]').count();
  assert(initialAlertCount === 0, `Clean initial Login screen has zero alert banners (alerts=${initialAlertCount})`);
  await shot(page, '01_mobile_login_375');

  // Register client validation for 6-char password (must match backend 8-char + letter/digit in Vietnamese)
  await page.click('button:has-text("Đăng ký")');
  await page.fill('input[placeholder="Họ và tên"]', 'Nguyễn Kiểm Thử');
  await page.fill('input[aria-label="Tên người dùng"]', 'kiemthu_mobile');
  await page.fill('input[aria-label="Email"]', 'kiemthu@example.com');
  await page.fill('input[aria-label="Mật khẩu"]', 'abcdef');
  await page.click('button[type="submit"]');
  await page.waitForSelector('[role="alert"]');
  const regErr = await page.textContent('[role="alert"]');
  assert(
    Boolean(regErr && regErr.includes('8 ký tự')),
    `Register validates 8-char letter+digit rule client-side in Vietnamese (${regErr})`,
  );

  // Switch back to Login & verify invalid credentials alert
  await page.click('button:has-text("Đăng nhập")');
  await page.fill('input[placeholder="Tên đăng nhập hoặc email"]', 'hoa_health');
  await page.fill('input[placeholder="Mật khẩu"]', 'WrongPassword999');
  await page.click('button[type="submit"]');
  await page.waitForSelector('[role="alert"]');
  const errText = await page.textContent('[role="alert"]');
  assert(Boolean(errText && errText.includes('Sai')), `Invalid login displays Vietnamese error (${errText})`);

  // Login as hoa_health
  allowAuth401 = false;
  await page.click('button:has-text("Thành viên")');
  await page.waitForURL('**/feed', { timeout: 20000 });
  await page.waitForSelector('article');
  await dismissOnboardingIfPresent(page);
  await page.waitForTimeout(400);
  await checkNoHorizontalOverflow(page, 'feed-general-375');
  await checkStoryStripUnclipped(page, 'feed-general-375');
  await checkPillTabsPadding(page, 'feed-general-375');
  await shot(page, '02_mobile_feed_general_375');
  const storyWrapBox = await page.locator('[data-story-strip="true"]').locator('..').boundingBox();
  if (storyWrapBox) {
    const zoomPath = path.join(SHOT_DIR, '18_mobile_story_bubbles_zoom_375.png');
    await page.screenshot({
      path: zoomPath,
      clip: {
        x: Math.max(0, storyWrapBox.x),
        y: Math.max(0, storyWrapBox.y - 12),
        width: storyWrapBox.width,
        height: storyWrapBox.height + 24,
      },
    });
    results.shots.push(zoomPath);
  }

  // Bottom dock touch target height >= 44px
  const navTabMinHeight = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('nav[aria-label="Điều hướng chính"] a'));
    return Math.min(...links.map((el) => el.getBoundingClientRect().height));
  });
  assert(navTabMinHeight >= 44, `Bottom nav touch targets >= 44px (min=${navTabMinHeight.toFixed(1)}px)`);

  // Security invariant: unverified user redirected from /dashboard
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
  assert(page.url().endsWith('/feed'), `Unverified user redirected from /dashboard to /feed (${page.url()})`);
  await page.waitForSelector('article');
  await dismissOnboardingIfPresent(page);

  // 1b. Like toggle + cross-tab cache persistence check!
  const firstLikeBtn = page.locator('article button[aria-label="Thích"], article button[aria-label="Bỏ thích"]').first();
  const initialPressed = await firstLikeBtn.getAttribute('aria-pressed');
  await firstLikeBtn.click();
  await page.waitForTimeout(350);
  const afterPressed = await firstLikeBtn.getAttribute('aria-pressed');
  assert(initialPressed !== afterPressed, `Like toggle mutated state (${initialPressed} -> ${afterPressed})`);

  // Switch away to /eeg and back to /feed -> must NOT revert to stale cache!
  await page.click('nav[aria-label="Điều hướng chính"] a[href="/eeg"]');
  await page.waitForURL('**/eeg');
  await page.waitForTimeout(250);
  await page.click('nav[aria-label="Điều hướng chính"] a[href="/feed"]');
  await page.waitForURL('**/feed');
  await page.waitForSelector('article');
  const afterReturnPressed = await page
    .locator('article button[aria-label="Thích"], article button[aria-label="Bỏ thích"]')
    .first()
    .getAttribute('aria-pressed');
  assert(
    afterReturnPressed === afterPressed,
    `Like state persists across tab switch (afterClick=${afterPressed}, afterReturn=${afterReturnPressed})`,
  );
  // Restore original like state cleanly
  await page.locator('article button[aria-label="Thích"], article button[aria-label="Bỏ thích"]').first().click();
  await page.waitForTimeout(300);

  // 1c. END-TO-END WRITE: Compose Post with PNG image + zero blob URL leak + Comment + Delete Comment + 2-tap Delete Post
  const uniquePostText = `Ghi chú kiểm thử EEG mobile ${Date.now()}`;
  await page.click('button[aria-label="Viết bài mới"]');
  await page.waitForSelector('[role="dialog"]');
  await page.waitForTimeout(200);
  await shot(page, '03_mobile_compose_sheet_375');

  await page.setInputFiles('input[type="file"][accept="image/*"]', {
    name: 'mobile_e2e_test.png',
    mimeType: 'image/png',
    buffer: PNG_1X1,
  });
  await page.waitForTimeout(150);
  const blob1 = await page.locator('[role="dialog"] img').first().getAttribute('src');
  await page.fill('[role="dialog"] textarea', uniquePostText);
  const blob2 = await page.locator('[role="dialog"] img').first().getAttribute('src');
  assert(blob1 && blob1 === blob2, `Image preview blob URL stays stable on typing (no leak)`);

  // Submit post with image
  await page.click('[role="dialog"] button:has-text("Đăng")');
  await page.waitForSelector(`article:has-text("${uniquePostText}")`, { timeout: 10000 });
  const newPostArticle = page.locator('article', { hasText: uniquePostText }).first();
  const uploadedImgLoaded = await newPostArticle.locator('img').last().evaluate((img) => img.complete && img.naturalWidth > 0);
  assert(uploadedImgLoaded, 'Created post with PNG image uploaded and rendered cleanly');

  // Add comment + delete comment on the created post
  await newPostArticle.locator('button[aria-label="Bình luận"]').click();
  await page.waitForSelector('[role="dialog"] input[aria-label="Viết bình luận"]');
  const uniqueComment = `Bình luận kiểm thử ${Date.now()}`;
  await page.fill('[role="dialog"] input[aria-label="Viết bình luận"]', uniqueComment);
  await page.click('[role="dialog"] button[aria-label="Gửi bình luận"]');
  await page.waitForSelector(`[role="dialog"]:has-text("${uniqueComment}")`, { timeout: 8000 });
  assert(true, 'Comment created and displayed in Comments Bottom Sheet');

  // Delete comment
  await page.locator('[role="dialog"] button[aria-label="Xóa bình luận"]').last().click();
  await page.waitForTimeout(400);
  const commentStillThere = await page.locator(`[role="dialog"]:has-text("${uniqueComment}")`).count();
  assert(commentStillThere === 0, 'Own comment deleted cleanly from Comments Bottom Sheet');
  await page.click('[role="dialog"] button[aria-label="Đóng"]');
  await page.waitForTimeout(200);

  // 2-tap delete created test post (keeps demo DB clean!)
  await newPostArticle.locator('button[aria-label="Xóa bài"]').click();
  await newPostArticle.locator('button:has-text("Xóa")').click();
  await page.waitForTimeout(500);
  const postRemaining = await page.locator('article', { hasText: uniquePostText }).count();
  assert(postRemaining === 0, 'Created test post deleted cleanly via 2-tap confirm');

  // 1d. Brand-new chat from Active Doctors rail -> Header MUST show recipient immediately (not blank!)
  await page.click('button:has-text("Mai Lan")');
  await page.waitForURL(/\/chat\?conv=/, { timeout: 8000 });
  await page.waitForTimeout(120);
  const immediateChatHeader = await page.locator('header').textContent();
  assert(
    Boolean(immediateChatHeader && immediateChatHeader.includes('Trần Mai Lan')),
    `New chat thread header displays recipient immediately (${immediateChatHeader?.trim()})`,
  );
  // Short viewport (virtual keyboard open: 375x450) check on Chat thread!
  await page.setViewportSize({ width: 375, height: 450 });
  await page.waitForTimeout(150);
  await checkNoHorizontalOverflow(page, 'chat-keyboard-375x450');
  const sendBtnBox = await page.locator('button[aria-label="Gửi tin nhắn"]').boundingBox();
  assert(
    Boolean(sendBtnBox && sendBtnBox.y + sendBtnBox.height <= 452),
    `Chat composer remains visible inside short keyboard viewport 375x450 (bottom=${sendBtnBox ? (sendBtnBox.y + sendBtnBox.height).toFixed(0) : 'none'})`,
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await page.click('button[aria-label="Quay lại"]');
  await page.waitForSelector('[data-story-strip="true"]', { timeout: 8000 });
  await page.waitForTimeout(300);
  await checkStoryStripUnclipped(page, 'chat-inbox-375');
  await shot(page, '14_toolbar_settled_general_375');

  // 1e. EEG Tab: Waveform scrub + CSV upload + Extreme DAR format + Persistence across tab switches + Device simulate
  await page.click('nav[aria-label="Điều hướng chính"] a[href="/eeg"]');
  await page.waitForURL('**/eeg');
  await page.waitForSelector('svg[aria-label="Biểu đồ sóng não 6 kênh"]');
  await page.locator('main .grid.grid-cols-3').first().waitFor({ state: 'visible', timeout: 8000 });
  await checkPillTabsPadding(page, 'eeg-general-375');
  await checkNoHorizontalOverflow(page, 'eeg-general-375');

  const eegMainText = (await page.locator('main').textContent()) ?? '';
  assert(
    eegMainText.includes('6 kênh') && !/\b6ch\b/i.test(eegMainText),
    'General Mode EEG displays plain-language "6 kênh" instead of "6ch"',
  );

  const svgBox = await page.locator('svg[aria-label="Biểu đồ sóng não 6 kênh"]').boundingBox();
  if (svgBox) {
    await page.mouse.move(svgBox.x + svgBox.width * 0.4, svgBox.y + svgBox.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(svgBox.x + svgBox.width * 0.65, svgBox.y + svgBox.height * 0.5, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(200);
  }
  const scrubReadout = await page.locator('text=/\\d+\\.\\d{2}s/').first().textContent().catch(() => null);
  assert(Boolean(scrubReadout), `EEG waveform pointer scrub updated timestamp readout (${scrubReadout})`);
  const genStatText = (await page.locator('main .grid.grid-cols-3').first().textContent()) ?? '';
  assert(
    genStatText.includes('Chỉ số sóng chậm (DAR)') &&
      genStatText.includes('Cân bằng 2 bán cầu (BSI)') &&
      genStatText.includes('Nhịp thư thái (Alpha)'),
    `General Mode EEG stat tiles use layperson Vietnamese labels with DAR/BSI/Alpha (${genStatText.trim()})`,
  );
  await shot(page, '04_mobile_eeg_general_375');

  // Upload real EEG CSV with strong delta (triggers extreme DAR -> must format cleanly & survive tab switch!)
  const csvLines = ['time,F3,F4,C3,C4,O1,O2'];
  for (let i = 0; i < 600; i++) {
    const t = (i / 250).toFixed(4);
    const v = (28 * Math.sin(2 * Math.PI * 2.0 * (i / 250))).toFixed(2);
    csvLines.push([t, v, '1.0', v, '1.0', '2.0', '2.0'].join(','));
  }
  await page.setInputFiles('input[type="file"][accept*="csv"]', {
    name: 'mobile_verify.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csvLines.join('\n')),
  });
  await page.waitForSelector('text=CSV: mobile_verify.csv', { timeout: 8000 });
  await checkNoHorizontalOverflow(page, 'eeg-csv-extreme-dar-375');
  const darText = await page.locator('main .grid.grid-cols-3 .font-mono').first().textContent();
  assert(Boolean(darText && darText.length <= 6), `Extreme CSV DAR formatted compactly without overflow (${darText})`);

  // Switch to Thiết bị -> trigger Đo mẫu ổn định -> switch back to Phân tích -> CSV must still be active!
  await page.click('button:has-text("Thiết bị")');
  await page.locator('button[aria-pressed="true"]:has-text("Thiết bị")').waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForFunction(() => !document.querySelector('main [role="status"] svg.animate-spin'), { timeout: 8000 });
  await checkNoHorizontalOverflow(page, 'eeg-device-375');
  const simBtn = page.locator('button:has-text("Đo mẫu ổn định")');
  if (await simBtn.isVisible().catch(() => false)) {
    await simBtn.click();
    await page.waitForSelector('[role="status"]', { timeout: 6000 });
    const devStatus = await page.textContent('[role="status"]');
    assert(Boolean(devStatus && devStatus.includes('mẫu')), `Device simulate burst succeeded with feedback (${devStatus})`);
  }

  await page.click('button:has-text("Phân tích")');
  await page.waitForTimeout(400);
  const csvStillActive = await page.locator('text=CSV: mobile_verify.csv').isVisible();
  assert(csvStillActive, 'Uploaded CSV analysis persists after switching to Thiết bị and back');
  // Dismiss CSV back to preset
  await page.click('button[aria-label="Quay về mẫu chuẩn"]');
  await page.waitForTimeout(400);

  await page.click('button:has-text("Đã lưu")');
  await page.locator('button[aria-pressed="true"]:has-text("Đã lưu")').waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForFunction(() => !document.querySelector('main [role="status"] svg.animate-spin'), { timeout: 8000 });
  await checkNoHorizontalOverflow(page, 'eeg-saved-375');

  // 1f. Consult Tab: Urgent badge + Short keyboard viewport Ask Doctor Sheet
  await page.click('nav[aria-label="Điều hướng chính"] a[href="/consult"]');
  await page.waitForURL('**/consult');
  await page.locator('span:text-is("Khẩn")').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  await checkPillTabsPadding(page, 'consult-general-375');
  await checkNoHorizontalOverflow(page, 'consult-general-375');
  const urgentVisible = await page.locator('span:text-is("Khẩn")').first().isVisible().catch(() => false);
  assert(urgentVisible, 'Urgent consultation ticket displays crisp red Khẩn badge');
  await shot(page, '05_mobile_consult_general_375');

  await page.setViewportSize({ width: 375, height: 450 });
  await page.click('button:has-text("Hỏi BS")');
  await page.waitForSelector('[role="dialog"]');
  await page.waitForTimeout(200);
  await checkNoHorizontalOverflow(page, 'consult-ask-keyboard-375x450');
  await page.click('[role="dialog"] button[aria-label="Đóng"]');
  await page.setViewportSize({ width: 375, height: 812 });

  // 1g. Health Tab: Hằng ngày filter persistence + Work Block full CRUD (Create -> Toggle -> Delete)
  await page.click('nav[aria-label="Điều hướng chính"] a[href="/health"]');
  await page.waitForURL('**/health');
  await page.waitForSelector('text=Ghi nhanh hôm nay');
  await page.waitForTimeout(400);
  await checkNoHorizontalOverflow(page, 'health-general-375');
  await shot(page, '06_mobile_health_general_375');

  // Filter by Thứ 2 -> Hằng ngày item must stay visible!
  await page.getByRole('button', { name: 'Thứ 2', exact: true }).click();
  await page.waitForTimeout(150);
  const dailyVisibleInMon = await page.locator('text=Hằng ngày').first().isVisible().catch(() => false);
  assert(dailyVisibleInMon, 'Daily (Hằng ngày) work blocks remain visible under weekday filter');
  await page.getByRole('button', { name: 'Tất cả', exact: true }).click();

  // Add -> Toggle -> Delete a work block cleanly
  const uniqueBlock = `Kiểm thử nhịp sinh học ${Date.now().toString().slice(-4)}`;
  await page.getByRole('button', { name: 'Thêm', exact: true }).click();
  await page.waitForSelector('[role="dialog"]');
  await page.fill('[role="dialog"] input[placeholder*="Hoạt động"]', uniqueBlock);
  await page.click('[role="dialog"] button:has-text("Thêm vào lịch")');
  await page.waitForSelector(`text=${uniqueBlock}`, { timeout: 8000 });
  const blockRow = page.locator('div.flex.items-center', { hasText: uniqueBlock }).first();
  await blockRow.locator('button[aria-label*="Đánh dấu"]').click();
  await page.waitForTimeout(350);
  await blockRow.locator('button[aria-label="Xóa khối lịch"]').click();
  await page.locator(`text=${uniqueBlock}`).waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
  const blockLeft = await page.locator(`text=${uniqueBlock}`).count();
  assert(blockLeft === 0, 'Health work block Create -> Toggle -> Delete CRUD succeeded cleanly');

  // 1h. Communities: Verified-only locked (0 HTTP 403s!) + Public community Join/Leave toggle
  await page.click('button[aria-label="Tài khoản"]');
  await page.waitForSelector('[role="dialog"]');
  await page.waitForTimeout(200);
  await shot(page, '07_mobile_account_sheet_375');
  await page.click('[role="dialog"] a:has-text("Cộng đồng")');
  await page.waitForURL('**/communities');
  await page.locator('span:has-text("Chuyên gia")').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  await checkNoHorizontalOverflow(page, 'communities-375');
  const lockedBadges = await page.locator('span:has-text("Chuyên gia")').count();
  assert(lockedBadges >= 1, `Verified-only communities clearly locked for general user (locked=${lockedBadges})`);
  // Join & leave public community cleanly
  const publicJoinBtn = page.getByRole('button', { name: 'Tham gia', exact: true }).first();
  if (await publicJoinBtn.isVisible().catch(() => false)) {
    const commTitle = (await publicJoinBtn.locator('..').locator('h2').textContent())?.trim() ?? '';
    const publicRow = page.locator('div.rounded-2xl', { hasText: commTitle }).first();
    await publicJoinBtn.click();
    await publicRow.getByRole('button', { name: 'Đã vào', exact: true }).waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    const becameMember = await publicRow.getByRole('button', { name: 'Đã vào', exact: true }).isVisible();
    assert(becameMember, `Public community Join mutation updated UI to Đã vào (${commTitle})`);
    // Leave back to keep seed clean
    await publicRow.getByRole('button', { name: 'Đã vào', exact: true }).click();
    await publicRow.getByRole('button', { name: 'Tham gia', exact: true }).waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    const leftCleanly = await publicRow.getByRole('button', { name: 'Tham gia', exact: true }).isVisible();
    assert(leftCleanly, `Public community Leave mutation restored Tham gia (${commTitle})`);
  }

  // 1i. Search -> Post Preview Bottom Sheet + Profile follow/unfollow + own Edit Profile Sheet
  await page.click('header a[aria-label="Tìm kiếm"]');
  await page.waitForURL('**/search');
  await page.getByRole('button', { name: 'đột quỵ', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('main [role="status"] svg.animate-spin'), { timeout: 8000 });
  await page.locator('main button.w-full.text-left, main p').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  const firstPostRes = page.locator('main button.w-full.text-left').first();
  if (await firstPostRes.isVisible().catch(() => false)) {
    await firstPostRes.click();
    await page.waitForSelector('[role="dialog"]:has-text("Chi tiết bài viết")');
    assert(true, 'Search post result opens Post Preview Bottom Sheet');
    await page.click('[role="dialog"] button[aria-label="Đóng"]');
  }

  await page.goto(`${BASE_URL}/u/hoa_health`, { waitUntil: 'networkidle' });
  await dismissOnboardingIfPresent(page);
  await page.waitForSelector('button:has-text("Chỉnh sửa")');
  await page.click('button:has-text("Chỉnh sửa")');
  await page.waitForSelector('[role="dialog"]:has-text("Chỉnh sửa hồ sơ")');
  assert(true, 'Own profile opens Edit Profile Bottom Sheet');
  await page.click('[role="dialog"] button[aria-label="Đóng"]');

  await page.goto(`${BASE_URL}/u/dr_minh`, { waitUntil: 'networkidle' });
  await dismissOnboardingIfPresent(page);
  await page.waitForSelector('button:has-text("Theo dõi"), button:has-text("Đang theo dõi")');
  const followBtn = page.locator('button:has-text("Theo dõi"), button:has-text("Đang theo dõi")').first();
  const followBefore = (await followBtn.textContent())?.trim();
  const expectedAfter = followBefore === 'Theo dõi' ? 'Đang theo dõi' : 'Theo dõi';
  await followBtn.click();
  await page.locator(`button:text-is("${expectedAfter}")`).first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  const followAfter = (await followBtn.textContent())?.trim();
  assert(followBefore !== followAfter, `Profile follow toggle mutated cleanly (${followBefore} -> ${followAfter})`);
  // Restore original follow state
  await followBtn.click();
  await page.locator(`button:text-is("${followBefore}")`).first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});

  // 1j. Wallet: Clean consumer Wallet UI (no HMAC/hash/ledger/Sandbox jargon) + Compact VietQR topup sheet + Test confirm
  await page.goto(`${BASE_URL}/wallet`, { waitUntil: 'networkidle' });
  await dismissOnboardingIfPresent(page);
  await page.waitForSelector('text=Số dư Credit', { timeout: 8000 });
  await page.waitForSelector('text=Nạp VietQR', { timeout: 8000 });
  await page.waitForTimeout(350);
  await checkNoHorizontalOverflow(page, 'wallet-375');

  const walletMainText = (await page.locator('main').textContent()) ?? '';
  const hasWalletJargon =
    /HMAC|chuỗi băm|sổ cái|ledger|sandbox|P2P|#[0-9a-f]{6,}/i.test(walletMainText);
  assert(
    !hasWalletJargon &&
      walletMainText.includes('Số dư Credit') &&
      walletMainText.includes('Đã nhận') &&
      walletMainText.includes('Đã dùng') &&
      walletMainText.includes('Nạp VietQR') &&
      walletMainText.includes('Lịch sử'),
    'Wallet screen is clean consumer UI without HMAC/chuỗi băm/hash/Sandbox jargon',
  );

  // Parse initial numeric balance
  const parseBalance = async () => {
    const raw = (await page.locator('section').first().locator('p.font-mono.text-3xl').textContent()) ?? '0';
    return Number(raw.replace(/[^\d-]/g, ''));
  };
  const balanceBefore = await parseBalance();
  await shot(page, '08_mobile_wallet_375');

  // Open VietQR bottom sheet via 50.000đ package pill
  await page.click('button:has-text("50.000đ")');
  await page.waitForSelector('[role="dialog"]:has-text("Thanh toán VietQR")', { timeout: 15000 });
  await page.locator('[role="dialog"] span.select-all').waitFor({ state: 'visible', timeout: 8000 });
  await page.locator('[role="dialog"] img, [role="dialog"] svg[role="img"]').first().waitFor({ state: 'visible', timeout: 8000 });
  await checkNoHorizontalOverflow(page, 'wallet-vietqr-sheet-375');
  const orderCodeText = (await page.locator('[role="dialog"] span.select-all').textContent())?.trim() ?? '';
  assert(/^NL[A-Z0-9]{8}$/.test(orderCodeText), `VietQR bottom sheet generated valid order code (${orderCodeText})`);
  const qrRendered = await page.locator('[role="dialog"] img, [role="dialog"] svg[role="img"]').first().isVisible();
  assert(qrRendered, 'VietQR bottom sheet rendered scannable QR code cleanly');

  const confirmBtnVisible = await page.locator('[role="dialog"] button:has-text("Xác nhận thử (Sandbox)")').isVisible();
  assert(confirmBtnVisible, 'VietQR bottom sheet shows "Xác nhận thử (Sandbox)" button in sandbox mode');

  // Copy order code feedback
  await page.click('[role="dialog"] button:has-text("Chép nội dung")');
  await page.waitForSelector('[role="dialog"] button:has-text("Đã chép")', { timeout: 4000 });
  assert(true, 'VietQR order code 1-tap copy feedback works');
  await shot(page, '08b_mobile_wallet_vietqr_sheet_375');

  // Confirm test payment -> balance +50 Credit + history remains clean without hash
  await page.click('[role="dialog"] button:has-text("Xác nhận thử (Sandbox)")');
  await page.waitForSelector('[role="dialog"]:has-text("Đã cộng +50 Credit")', { timeout: 20000 });
  await page.click('[role="dialog"] button:has-text("Xong")');
  await page.locator('[role="dialog"]').waitFor({ state: 'detached', timeout: 5000 });
  await page.waitForFunction(
    (prev) => {
      const el = document.querySelector('section p.font-mono.text-3xl');
      return Boolean(el && Number((el.textContent || '0').replace(/[^\d-]/g, '')) > prev);
    },
    balanceBefore,
    { timeout: 8000 },
  );
  const balanceAfter = await parseBalance();
  assert(
    balanceAfter === balanceBefore + 50,
    `VietQR test topup credited wallet balance (+50: ${balanceBefore} -> ${balanceAfter})`,
  );
  const walletAfterText = (await page.locator('main').textContent()) ?? '';
  assert(
    !/HMAC|chuỗi băm|sổ cái|sandbox|#[0-9a-f]{6,}/i.test(walletAfterText),
    'Wallet remains free of HMAC/hash/Sandbox jargon after VietQR topup',
  );

  await ctx1.close();

  // =========================================================================
  // SUITE 2: Professional Mode (dr_minh) on 127.0.0.1:5174 + Mobile/Tablet/Desktop
  // =========================================================================
  const ctx2 = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  const proPage = await ctx2.newPage();
  let proAllow401 = true;
  proPage.on('console', (msg) => {
    if (msg.type() === 'error') {
      if (proAllow401 && msg.text().includes('401')) return;
      results.consoleErrors.push(`[pro] ${msg.text()}`);
    }
  });
  proPage.on('pageerror', (err) => results.pageErrors.push(`[pro] ${err.message}`));
  proPage.on('response', (res) => {
    if (res.status() >= 400) {
      if (proAllow401 && res.url().includes('/api/auth/')) return;
      results.badResponses.push(`[pro] ${res.status()} ${res.url()}`);
    }
  });

  await proPage.goto(`${ALT_HOST_URL}/login`, { waitUntil: 'networkidle' });
  await proPage.click('text=Vào nhanh tài khoản mẫu');
  proAllow401 = false;
  await proPage.click('button:has-text("Bác sĩ")');
  // STRICT: Must land DIRECTLY on /dashboard with NO fallback navigation!
  await proPage.waitForURL('**/dashboard', { timeout: 20000 });
  await proPage.waitForSelector('text=Ca ưu tiên');
  await dismissOnboardingIfPresent(proPage);
  await proPage.waitForFunction(() => !document.querySelector('main [role="status"] svg.animate-spin'), { timeout: 8000 });
  await checkNoHorizontalOverflow(proPage, 'pro-dashboard-375');
  const dataMode = await proPage.getAttribute('[data-mode]', 'data-mode');
  assert(dataMode === 'professional', `Verified doctor lands directly on /dashboard in professional mode (${dataMode})`);

  // Verify "Đã xử lý" KPI is accurate (>= 1, NOT stuck at 0!)
  const handledVal = await proPage.locator('section').first().locator('.grid.grid-cols-3 > div').nth(2).locator('.font-mono').textContent();
  assert(Number(handledVal) >= 1, `Pro Dashboard "Đã xử lý" KPI reflects real handled cases (${handledVal})`);
  await shot(proPage, '09_mobile_pro_dashboard_375');

  // Verify dynamic LAN/host Desktop Web link inside Account Sheet + Mode toggle (Chuyên gia -> Thành viên -> Chuyên gia)
  await proPage.click('button[aria-label="Tài khoản"]');
  await proPage.waitForSelector('[role="dialog"]');
  const webLinkHref = await proPage.locator('[role="dialog"] a:has-text("Mở bản Web")').getAttribute('href');
  assert(webLinkHref === 'http://127.0.0.1:5173', `Desktop Web link derives active hostname (${webLinkHref})`);

  await proPage.getByRole('dialog').getByRole('button', { name: 'Thành viên', exact: true }).click();
  await proPage.waitForURL('**/feed', { timeout: 8000 });
  const toggledGenMode = await proPage.getAttribute('[data-mode]', 'data-mode');
  assert(toggledGenMode === 'general', `Mode switch toggled doctor to general mode (${toggledGenMode})`);

  await proPage.click('button[aria-label="Tài khoản"]');
  await proPage.waitForSelector('[role="dialog"]');
  await proPage.getByRole('dialog').getByRole('button', { name: 'Chuyên gia', exact: true }).click();
  await proPage.waitForURL('**/dashboard', { timeout: 8000 });
  const toggledProMode = await proPage.getAttribute('[data-mode]', 'data-mode');
  assert(toggledProMode === 'professional', `Mode switch restored professional mode (${toggledProMode})`);

  // Click priority case on Pro Dashboard -> must deep-link and auto-open that ticket detail sheet!
  await proPage.waitForSelector('section:has-text("Ca ưu tiên") a[href*="/consult?ticket="]');
  await proPage.locator('section:has-text("Ca ưu tiên") a[href*="/consult?ticket="]').first().click();
  await proPage.waitForSelector('[role="dialog"]:has-text("Chi tiết ca hỏi đáp")', { timeout: 8000 });
  assert(true, 'Clicking Pro Dashboard priority case deep-links and opens ticket detail sheet');
  await proPage.click('[role="dialog"] button[aria-label="Đóng"]');
  await proPage.waitForTimeout(200);

  // Pro qEEG screen + clinical labels + 2D Topomap electrode tap (F4) + Device Tab NL-CLINIC-01
  await proPage.click('nav[aria-label="Điều hướng chính"] a[href="/eeg"]');
  await proPage.waitForURL('**/eeg');
  await proPage.waitForSelector('svg[aria-label="Biểu đồ sóng não 6 đạo trình"]');
  await proPage.waitForTimeout(550);
  await checkNoHorizontalOverflow(proPage, 'pro-eeg-375');
  const proStatText = (await proPage.locator('main .grid.grid-cols-3').first().textContent()) ?? '';
  assert(
    proStatText.includes('DAR') && proStatText.includes('BSI') && proStatText.includes('Alpha'),
    `Pro Mode EEG retains clinical DAR/BSI/Alpha labels (${proStatText.trim()})`,
  );
  await shot(proPage, '10_mobile_pro_eeg_375');
  await proPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await proPage.waitForTimeout(250);
  await proPage.locator('[aria-label="Điện cực F4"]').click();
  await proPage.waitForTimeout(150);
  const topoReadout = await proPage.locator('p.font-mono.text-base:text-is("F4")').isVisible();
  assert(topoReadout, 'CompactTopomap electrode F4 tap updates readout cleanly');
  await shot(proPage, '10b_mobile_pro_eeg_topomap_375');

  // Pro Device tab showing NL-CLINIC-01
  await proPage.evaluate(() => window.scrollTo(0, 0));
  await proPage.click('button:has-text("Thiết bị")');
  await proPage.waitForSelector('text=NL-CLINIC-01', { timeout: 8000 });
  await proPage.waitForTimeout(350);
  await checkNoHorizontalOverflow(proPage, 'pro-device-375');
  const clinicDeviceVisible = await proPage.locator('text=NL-CLINIC-01').isVisible();
  assert(clinicDeviceVisible, 'Pro Device tab displays seeded hardware device NL-CLINIC-01');
  await shot(proPage, '10c_mobile_pro_device_375');

  // Pro Chat Thread
  await proPage.click('nav[aria-label="Điều hướng chính"] a[href="/chat"]');
  await proPage.waitForURL('**/chat');
  await proPage.waitForFunction(() => !document.querySelector('main [role="status"] svg.animate-spin'), { timeout: 8000 });
  await proPage.locator('main .divide-y button, main p').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  const firstConv = proPage.locator('main .divide-y button').first();
  if (await firstConv.isVisible().catch(() => false)) {
    await firstConv.click();
    await proPage.waitForURL(/\/chat\?conv=/, { timeout: 8000 });
    await proPage.locator('input[aria-label="Nội dung tin nhắn"]').waitFor({ state: 'visible', timeout: 8000 });
    await proPage.waitForFunction(() => !document.querySelector('[role="status"] svg.animate-spin'), { timeout: 8000 });
    await checkNoHorizontalOverflow(proPage, 'pro-chat-thread-375');
    await shot(proPage, '11_mobile_pro_chat_375');
  }

  // Tablet 768x1024 & Desktop 1440x900 framing verification + No self-avatar in Active Doctors strip
  await proPage.goto(`${ALT_HOST_URL}/feed`, { waitUntil: 'networkidle' });
  await dismissOnboardingIfPresent(proPage);
  await proPage.waitForSelector('button:has-text("Mai Lan")', { timeout: 8000 });
  const activeDoctorsRailText = (await proPage.locator('main .overflow-x-auto').first().textContent()) ?? '';
  assert(
    !activeDoctorsRailText.includes('Văn Minh') && activeDoctorsRailText.includes('Mai Lan'),
    `Logged-in doctor dr_minh is excluded from Active Doctors quick-chat rail (${activeDoctorsRailText.trim()})`,
  );
  await proPage.setViewportSize({ width: 768, height: 1024 });
  await proPage.waitForTimeout(350);
  await checkNoHorizontalOverflow(proPage, 'tablet-768');
  await shot(proPage, '12_tablet_768');

  await proPage.setViewportSize({ width: 1440, height: 900 });
  await proPage.waitForTimeout(350);
  await checkNoHorizontalOverflow(proPage, 'desktop-1440');
  const dockWidthDesktop = await proPage.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Điều hướng chính"]');
    return nav ? nav.getBoundingClientRect().width : 0;
  });
  assert(
    dockWidthDesktop > 0 && dockWidthDesktop <= 410,
    `Bottom dock stays constrained inside 430px mobile frame on 1440px desktop (width=${dockWidthDesktop.toFixed(1)}px)`,
  );
  await shot(proPage, '13_desktop_1440');

  await ctx2.close();
} finally {
  await browser.close();
}

assert(results.consoleErrors.length === 0, `Zero console errors (found=${results.consoleErrors.length})`);
assert(results.pageErrors.length === 0, `Zero page errors (found=${results.pageErrors.length})`);
assert(results.badResponses.length === 0, `Zero unexpected >=400 HTTP responses (found=${results.badResponses.length})`);

console.log(JSON.stringify(results, null, 2));
if (results.failed.length > 0) {
  process.exitCode = 1;
}
