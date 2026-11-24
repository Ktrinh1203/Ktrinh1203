import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5174';
const SHOT_DIR = path.resolve('D:/Antigravity/Neurolink_V1.1/docs/verification_screenshots/mobile');
const BRAIN_DIR = path.resolve('C:/Users/kissk/.gemini/antigravity/brain/41533415-5fc8-44c8-b2ca-bd6b9535971e');
fs.mkdirSync(SHOT_DIR, { recursive: true });
fs.mkdirSync(BRAIN_DIR, { recursive: true });

const report = {
  passed: [],
  failed: [],
  metrics: {},
  shots: [],
  consoleErrors: [],
  pageErrors: [],
};

function assert(cond, label) {
  if (cond) report.passed.push(label);
  else report.failed.push(label);
}

async function saveShot(page, filename) {
  const shotPath = path.join(SHOT_DIR, filename);
  await page.screenshot({ path: shotPath, fullPage: false });
  const brainPath = path.join(BRAIN_DIR, filename);
  fs.copyFileSync(shotPath, brainPath);
  report.shots.push({ shotPath, brainPath });
}

async function readPillMetrics(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Điều hướng chính"]');
    const pill = document.querySelector('[data-testid="nav-sliding-pill"]');
    const links = Array.from(document.querySelectorAll('nav[aria-label="Điều hướng chính"] a'));
    if (!nav || !pill || links.length === 0) return null;
    const pr = pill.getBoundingClientRect();
    const cs = getComputedStyle(pill);
    return {
      pillX: Number(pr.x.toFixed(2)),
      pillWidth: Number(pr.width.toFixed(2)),
      opacity: cs.opacity,
      transform: cs.transform,
      tabs: links.map((el) => {
        const r = el.getBoundingClientRect();
        return { href: el.getAttribute('href'), x: Number(r.x.toFixed(2)), width: Number(r.width.toFixed(2)), y: Number(r.y.toFixed(2)), height: Number(r.height.toFixed(2)) };
      }),
    };
  });
}

async function measureTabGlide(page, targetHref, settleMs = 480) {
  const startMetrics = await readPillMetrics(page);
  const targetTab = startMetrics.tabs.find((t) => t.href === targetHref);
  if (!targetTab) {
    throw new Error(`Target tab ${targetHref} not found in nav`);
  }

  // Collect real compositor frame positions inside the browser via requestAnimationFrame
  await page.evaluate((durationMs) => {
    const pill = document.querySelector('[data-testid="nav-sliding-pill"]');
    const samples = [];
    const tStart = performance.now();
    window.__pillGlidePromise = new Promise((resolve) => {
      function tick(now) {
        if (pill) {
          const rect = pill.getBoundingClientRect();
          samples.push({
            t: Number((now - tStart).toFixed(1)),
            x: Number(rect.x.toFixed(2)),
          });
        }
        if (now - tStart < durationMs) {
          requestAnimationFrame(tick);
        } else {
          resolve(samples);
        }
      }
      requestAnimationFrame(tick);
    });
  }, settleMs);

  const link = page.locator(`nav[aria-label="Điều hướng chính"] a[href="${targetHref}"]`);
  const box = await link.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  const samples = await page.evaluate(() => window.__pillGlidePromise);
  const settledMetrics = await readPillMetrics(page);

  const startX = startMetrics.pillX;
  const targetX = targetTab.x;
  const goingRight = targetX > startX;

  const preArrival = [];
  for (const s of samples) {
    if (goingRight ? s.x >= targetX - 2 : s.x <= targetX + 2) break;
    if (goingRight ? s.x > startX + 2 : s.x < startX - 2) {
      preArrival.push(s);
    }
  }

  let monotonic = preArrival.length > 0;
  const distinctMidFrames = [];
  for (const s of preArrival) {
    if (distinctMidFrames.length === 0) {
      distinctMidFrames.push(s);
    } else {
      const prev = distinctMidFrames[distinctMidFrames.length - 1];
      if (goingRight ? s.x < prev.x - 0.1 : s.x > prev.x + 0.1) {
        monotonic = false;
      } else if (goingRight ? s.x > prev.x + 0.1 : s.x < prev.x - 0.1) {
        distinctMidFrames.push(s);
      }
    }
  }

  return {
    startX,
    targetX,
    settledX: settledMetrics.pillX,
    settledTransform: settledMetrics.transform,
    totalFrames: samples.length,
    monotonic,
    distinctMidFrames,
  };
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

try {
  // -------------------------------------------------------------------------
  // 1. General Mode: Glide trajectory + Mid-glide screenshot + Pointer Drag
  // -------------------------------------------------------------------------
  const ctx1 = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx1.newPage();
  let allow401 = true;
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !(allow401 && msg.text().includes('401'))) {
      report.consoleErrors.push(`[general] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => report.pageErrors.push(`[general] ${err.message}`));

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.click('text=Vào nhanh tài khoản mẫu');
  allow401 = false;
  await page.click('button:has-text("Thành viên")');
  await page.waitForURL('**/feed', { timeout: 10000 });
  await page.waitForSelector('article');
  // Allow idle chunk preloader to complete before measuring
  await page.waitForTimeout(700);

  const initial = await readPillMetrics(page);
  assert(Boolean(initial && Math.abs(initial.pillX - initial.tabs[0].x) <= 1.5), `Initial pill aligned on Tab 1 (/feed): pillX=${initial?.pillX}, tab0X=${initial?.tabs[0]?.x}`);

  // Measure glide from Tab 1 (Tin) -> Tab 5 (Chat) via browser requestAnimationFrame sampling
  const generalGlide = await measureTabGlide(page, '/chat', 480);

  await page.waitForURL('**/chat');
  await saveShot(page, '14_toolbar_settled_general_375.png');

  report.metrics.generalTab1ToTab5 = {
    startX: generalGlide.startX,
    targetX: generalGlide.targetX,
    settledX: generalGlide.settledX,
    settledTransform: generalGlide.settledTransform,
    totalFrames: generalGlide.totalFrames,
    monotonic: generalGlide.monotonic,
    midFrames: generalGlide.distinctMidFrames,
  };

  assert(
    generalGlide.monotonic && generalGlide.distinctMidFrames.length >= 3,
    `General pill glides monotonically through >=3 intermediate rAF frames (start=${generalGlide.startX} -> [${generalGlide.distinctMidFrames.map((f) => `${f.x}@${f.t}ms`).join(', ')}] -> target=${generalGlide.targetX})`,
  );
  assert(
    Math.abs(generalGlide.settledX - generalGlide.targetX) <= 1.5,
    `General pill settles accurately on Tab 5 (pillX=${generalGlide.settledX}, tab4X=${generalGlide.targetX})`,
  );

  // Mid-glide screenshot: click back to Tab 1 (/feed) and capture right in the middle band
  const feedLink = page.locator('nav[aria-label="Điều hướng chính"] a[href="/feed"]');
  const feedBox = await feedLink.boundingBox();
  await page.evaluate(() => {
    const pill = document.querySelector('[data-testid="nav-sliding-pill"]');
    const links = Array.from(document.querySelectorAll('nav[aria-label="Điều hướng chính"] a'));
    const startX = pill ? pill.getBoundingClientRect().x : 288;
    const targetX = links[0] ? links[0].getBoundingClientRect().x : 19;
    const triggerX = startX - (startX - targetX) * 0.35;
    const t0 = performance.now();
    window.__midGlideReady = new Promise((resolve) => {
      function check(now) {
        const x = pill ? pill.getBoundingClientRect().x : targetX;
        if (x <= triggerX || now - t0 > 180) {
          resolve(Number(x.toFixed(2)));
        } else {
          requestAnimationFrame(check);
        }
      }
      requestAnimationFrame(check);
    });
  });
  await page.mouse.click(feedBox.x + feedBox.width / 2, feedBox.y + feedBox.height / 2);
  await page.evaluate(() => window.__midGlideReady);
  const midReturn = await readPillMetrics(page);
  report.metrics.midGlideReturnShot = midReturn;
  await saveShot(page, '15_toolbar_mid_glide_375.png');
  await page.waitForTimeout(380);
  await page.waitForURL('**/feed');

  // Pointer drag / scrub test: drag horizontally from Tab 1 (Tin) -> Tab 3 (Hỏi BS)
  const navBeforeDrag = await readPillMetrics(page);
  const tab0 = navBeforeDrag.tabs[0];
  const tab2 = navBeforeDrag.tabs[2];
  const startDragX = tab0.x + tab0.width / 2;
  const endDragX = tab2.x + tab2.width / 2;
  const dragY = tab0.y + tab0.height / 2;

  await page.mouse.move(startDragX, dragY);
  await page.mouse.down();
  await page.mouse.move(endDragX, dragY, { steps: 14 });
  await page.waitForTimeout(40);
  const whileDragging = await readPillMetrics(page);
  await saveShot(page, '16_toolbar_pointer_scrub_375.png');
  await page.mouse.up();
  await page.waitForURL('**/consult', { timeout: 6000 });
  await page.waitForTimeout(420);
  const afterDrag = await readPillMetrics(page);

  report.metrics.pointerDragTab1ToTab3 = {
    whileDraggingX: whileDragging.pillX,
    targetTab2X: tab2.x,
    settledAfterDragX: afterDrag.pillX,
  };
  assert(
    Math.abs(whileDragging.pillX - tab2.x) <= 8 && Math.abs(afterDrag.pillX - tab2.x) <= 1.5,
    `Pointer scrub drags pill smoothly to Tab 3 and snaps on release (dragX=${whileDragging.pillX}, settledX=${afterDrag.pillX}, tab2X=${tab2.x})`,
  );

  await ctx1.close();

  // -------------------------------------------------------------------------
  // 2. Professional Mode + Responsive 375 / 768 / 1440 alignment
  // -------------------------------------------------------------------------
  const ctx2 = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  const proPage = await ctx2.newPage();
  let proAllow401 = true;
  proPage.on('console', (msg) => {
    if (msg.type() === 'error' && !(proAllow401 && msg.text().includes('401'))) {
      report.consoleErrors.push(`[pro] ${msg.text()}`);
    }
  });
  proPage.on('pageerror', (err) => report.pageErrors.push(`[pro] ${err.message}`));

  await proPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await proPage.click('text=Vào nhanh tài khoản mẫu');
  proAllow401 = false;
  await proPage.click('button:has-text("Bác sĩ")');
  await proPage.waitForURL('**/dashboard', { timeout: 10000 });
  await proPage.waitForSelector('text=Ca ưu tiên');
  await proPage.waitForTimeout(700);

  const proGlide = await measureTabGlide(proPage, '/chat', 480);
  await proPage.waitForURL('**/chat');
  await saveShot(proPage, '17_toolbar_pro_settled_375.png');

  report.metrics.proTab1ToTab5 = {
    startX: proGlide.startX,
    targetX: proGlide.targetX,
    settledX: proGlide.settledX,
    totalFrames: proGlide.totalFrames,
    monotonic: proGlide.monotonic,
    midFrames: proGlide.distinctMidFrames,
  };
  assert(
    proGlide.monotonic &&
      proGlide.distinctMidFrames.length >= 3 &&
      Math.abs(proGlide.settledX - proGlide.targetX) <= 1.5,
    `Pro Mode pill glides monotonically through >=3 intermediate rAF frames and settles on Tab 5 (start=${proGlide.startX} -> [${proGlide.distinctMidFrames.map((f) => `${f.x}@${f.t}ms`).join(', ')}] -> settled=${proGlide.settledX}, target=${proGlide.targetX})`,
  );

  // Resize checks: Tablet 768x1024 and Desktop 1440x900
  await proPage.setViewportSize({ width: 768, height: 1024 });
  await proPage.waitForTimeout(200);
  const tabletMetrics = await readPillMetrics(proPage);
  assert(
    Math.abs(tabletMetrics.pillX - tabletMetrics.tabs[4].x) <= 1.5,
    `Tablet 768x1024 ResizeObserver keeps pill locked to active tab (pillX=${tabletMetrics.pillX}, tab4X=${tabletMetrics.tabs[4].x})`,
  );

  await proPage.setViewportSize({ width: 1440, height: 900 });
  await proPage.waitForTimeout(200);
  const desktopMetrics = await readPillMetrics(proPage);
  assert(
    Math.abs(desktopMetrics.pillX - desktopMetrics.tabs[4].x) <= 1.5,
    `Desktop 1440x900 ResizeObserver keeps pill locked to active tab (pillX=${desktopMetrics.pillX}, tab4X=${desktopMetrics.tabs[4].x})`,
  );

  // Regression check: Pro Mode on /feed (index 3) -> tap /feed again & scrub back to /feed -> switch to General Mode -> pill MUST align on Tab 1 (/feed, index 0), NEVER stuck on index 3!
  await proPage.setViewportSize({ width: 375, height: 812 });
  await proPage.waitForTimeout(150);
  await proPage.click('nav[aria-label="Điều hướng chính"] a[href="/feed"]');
  await proPage.waitForURL('**/feed');
  await proPage.waitForTimeout(450);

  // Tap current active tab (/feed at index 3) again
  await proPage.click('nav[aria-label="Điều hướng chính"] a[href="/feed"]');
  await proPage.waitForTimeout(100);

  // Scrub slightly away and release back onto /feed (index 3)
  const proFeedBeforeScrub = await readPillMetrics(proPage);
  const proFeedTab = proFeedBeforeScrub.tabs[3];
  const proFeedCenterX = proFeedTab.x + proFeedTab.width / 2;
  const proFeedCenterY = proFeedTab.y + proFeedTab.height / 2;
  await proPage.mouse.move(proFeedCenterX, proFeedCenterY);
  await proPage.mouse.down();
  await proPage.mouse.move(proFeedCenterX - 24, proFeedCenterY, { steps: 6 });
  await proPage.mouse.move(proFeedCenterX, proFeedCenterY, { steps: 6 });
  await proPage.mouse.up();
  await proPage.waitForTimeout(420);

  // Switch Pro -> General via Account Sheet
  await proPage.click('button[aria-label="Tài khoản"]');
  await proPage.waitForSelector('[role="dialog"]');
  await proPage.getByRole('dialog').getByRole('button', { name: 'Thành viên', exact: true }).click();
  await proPage.waitForURL('**/feed');
  await proPage.waitForTimeout(450);
  const afterModeSwitch = await readPillMetrics(proPage);
  report.metrics.proToGeneralFeedRegression = {
    pillX: afterModeSwitch.pillX,
    tab0X: afterModeSwitch.tabs[0].x,
    tab3X: afterModeSwitch.tabs[3].x,
  };
  assert(
    Math.abs(afterModeSwitch.pillX - afterModeSwitch.tabs[0].x) <= 1.5,
    `Pro -> General switch after tapping/scrubbing /feed aligns pill at Tab 1 (pillX=${afterModeSwitch.pillX}, tab0X=${afterModeSwitch.tabs[0].x}, NOT stuck at tab3X=${afterModeSwitch.tabs[3].x})`,
  );

  await ctx2.close();
} finally {
  await browser.close();
}

assert(report.consoleErrors.length === 0, `Zero console errors (found=${report.consoleErrors.length})`);
assert(report.pageErrors.length === 0, `Zero page errors (found=${report.pageErrors.length})`);

console.log(JSON.stringify(report, null, 2));
if (report.failed.length > 0) {
  process.exitCode = 1;
}
