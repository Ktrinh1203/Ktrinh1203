const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_DIR = path.resolve(__dirname);
const SLIDE_HTML = path.join(BASE_DIR, 'bmc_v2_investor_slide.html');
const REPORT_MD = path.join(BASE_DIR, 'BAO_CAO_PHAN_TICH_BMC_CHITIET_V2.md');
const REPORT_HTML = path.join(BASE_DIR, 'bao_cao_bmc_chitiet_v2.html');
const REPORT_PDF = path.join(BASE_DIR, 'BAO_CAO_PHAN_TICH_BMC_CHITIET_V2.pdf');
const SURVEY_HTML = path.join(BASE_DIR, 'neurolink_market_survey.html');

const FORBIDDEN_AI_PHRASES = [
  'trong bối cảnh',
  'đóng vai trò then chốt',
  'bức tranh toàn cảnh',
  'minh chứng sống động',
  'minh chứng rõ nét',
  'vô số',
  'tóm lại',
  'cần lưu ý rằng',
  'không ngừng nâng cao',
];

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

function checkForbiddenPhrases(text, filename) {
  const issues = [];
  const lower = text.toLowerCase();
  for (const phrase of FORBIDDEN_AI_PHRASES) {
    if (lower.includes(phrase)) {
      issues.push(`Found forbidden phrase "${phrase}" in ${filename}`);
    }
  }
  const khongChiPattern = /không chỉ[\s\S]{1,100}?mà còn/i;
  if (khongChiPattern.test(text)) {
    issues.push(`Found pattern "không chỉ...mà còn" in ${filename}`);
  }
  return issues;
}

async function run() {
  console.log('=== STARTING RENDER AND VERIFY (V2.1 - REPORT & MONOCHROME) ===');
  const results = {
    ai_rules: { passed: false, checks: [] },
    report_html_style: { passed: false, checks: [] },
    bmc_slide_monochrome: { passed: false, checks: [] },
    slide_render: { passed: false, checks: [] },
    report_pdf: { passed: false, checks: [] },
    report_previews: { passed: false, checks: [] },
  };

  // -------------------------------------------------------------
  // STEP 1: SCAN FORBIDDEN AI PHRASES & TEXT RULES
  // -------------------------------------------------------------
  console.log('\n--- Step 1: Checking AI forbidden phrases in MD & HTML ---');
  let textIssues = [];
  if (fs.existsSync(REPORT_MD)) {
    const mdContent = fs.readFileSync(REPORT_MD, 'utf8');
    const mdIssues = checkForbiddenPhrases(mdContent, 'BAO_CAO_PHAN_TICH_BMC_CHITIET_V2.md');
    textIssues.push(...mdIssues);
    console.log(`REPORT_MD issues: ${mdIssues.length}`);
  } else {
    textIssues.push(`File missing: ${REPORT_MD}`);
  }

  if (fs.existsSync(REPORT_HTML)) {
    const htmlContent = fs.readFileSync(REPORT_HTML, 'utf8');
    const htmlIssues = checkForbiddenPhrases(htmlContent, 'bao_cao_bmc_chitiet_v2.html');
    textIssues.push(...htmlIssues);
    console.log(`REPORT_HTML issues: ${htmlIssues.length}`);
  } else {
    textIssues.push(`File missing: ${REPORT_HTML}`);
  }

  results.ai_rules.checks = textIssues;
  results.ai_rules.passed = textIssues.length === 0;

  // -------------------------------------------------------------
  // STEP 2: PLAYWRIGHT BROWSER VERIFICATIONS
  // -------------------------------------------------------------
  const browser = await chromium.launch({ headless: true });

  try {
    // -------------------------------------------------------------
    // A. VERIFY bao_cao_bmc_chitiet_v2.html & GENERATE PDF / PREVIEWS
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Checking bao_cao_bmc_chitiet_v2.html ---');
    if (fs.existsSync(REPORT_HTML)) {
      const reportContext = await browser.newContext({
        viewport: { width: 820, height: 1160 },
        deviceScaleFactor: 2,
      });
      const reportPage = await reportContext.newPage();
      await reportPage.goto(`file:///${REPORT_HTML.replace(/\\/g, '/')}`, { waitUntil: 'load' });
      await reportPage.waitForTimeout(500);

      // Verify DOM: no <b> or <strong> inside <p> or <li>
      const boldInsidePOrLi = await reportPage.evaluate(() => {
        const elements = document.querySelectorAll('p b, p strong, li b, li strong');
        return Array.from(elements).map(el => ({
          tag: el.tagName,
          parent: el.parentElement.tagName,
          text: el.textContent.trim().substring(0, 50),
        }));
      });

      console.log(`Bold tags inside p/li: ${boldInsidePOrLi.length}`);
      const noBoldInText = boldInsidePOrLi.length === 0;
      results.report_html_style.checks.push({
        name: 'No bold inside <p> or <li>',
        passed: noBoldInText,
        details: boldInsidePOrLi,
      });

      // Verify Emoji in text
      const htmlText = await reportPage.evaluate(() => document.body.innerText);
      const hasEmoji = EMOJI_REGEX.test(htmlText);
      console.log(`Has emoji in report HTML: ${hasEmoji}`);
      results.report_html_style.checks.push({
        name: 'Zero emoji in report',
        passed: !hasEmoji,
      });

      // Verify color palette (no colorful hex codes in inline styles or computed styles)
      const colorCheck = await reportPage.evaluate(() => {
        const text = document.documentElement.innerHTML;
        // Search for colorful hex patterns like #0284c7, #10b981, #ef4444, #f59e0b, #3b82f6, etc.
        const colorfulMatches = text.match(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi) || [];
        const nonMono = [];
        for (const hex of colorfulMatches) {
          const cleanHex = hex.replace('#', '');
          let r, g, b;
          if (cleanHex.length === 3) {
            r = parseInt(cleanHex[0] + cleanHex[0], 16);
            g = parseInt(cleanHex[1] + cleanHex[1], 16);
            b = parseInt(cleanHex[2] + cleanHex[2], 16);
          } else if (cleanHex.length === 6) {
            r = parseInt(cleanHex.substring(0, 2), 16);
            g = parseInt(cleanHex.substring(2, 4), 16);
            b = parseInt(cleanHex.substring(4, 6), 16);
          } else {
            continue;
          }
          // In pure monochrome, r == g == b (or max diff <= 10 for very subtle grays)
          if (Math.abs(r - g) > 15 || Math.abs(r - b) > 15 || Math.abs(g - b) > 15) {
            nonMono.push(hex);
          }
        }
        return {
          totalHexFound: colorfulMatches.length,
          nonMonoHex: Array.from(new Set(nonMono)),
        };
      });

      console.log('Report color check:', JSON.stringify(colorCheck));
      const isMono = colorCheck.nonMonoHex.length === 0;
      results.report_html_style.checks.push({
        name: 'Report 100% monochrome',
        passed: isMono,
        details: colorCheck,
      });

      results.report_html_style.passed = noBoldInText && !hasEmoji && isMono;

      // Generate PDF
      console.log('Generating A4 PDF: BAO_CAO_PHAN_TICH_BMC_CHITIET_V2.pdf ...');
      await reportPage.pdf({
        path: REPORT_PDF,
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
      });
      console.log(`Saved PDF: ${REPORT_PDF}`);
      results.report_pdf.passed = fs.existsSync(REPORT_PDF) && fs.statSync(REPORT_PDF).size > 1000;

      // Capture report preview Page 1 (820x1160)
      const previewP1Path = path.join(BASE_DIR, 'report_v2_preview_p1.png');
      await reportPage.screenshot({ path: previewP1Path, fullPage: false });
      console.log(`Saved screenshot: ${previewP1Path}`);

      // Capture report preview Section II.1 (Customer Segments & Bottom-Up Market Size)
      console.log('Scrolling to Section II.1 (Customer Segments & Market Size) ...');
      await reportPage.evaluate(() => {
        const seg1Header = Array.from(document.querySelectorAll('h1, h2, h3, h4, p, div')).find(el => 
          el.textContent.includes('Phân khúc Khách hàng') || el.textContent.includes('Customer Segments')
        );
        if (seg1Header) {
          seg1Header.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      });
      await reportPage.waitForTimeout(400);
      const previewSeg1Path = path.join(BASE_DIR, 'report_v2_preview_seg1.png');
      await reportPage.screenshot({ path: previewSeg1Path, fullPage: false });
      console.log(`Saved screenshot: ${previewSeg1Path}`);

      // Capture report preview Table (Unit Economics in Section III)
      console.log('Scrolling to Unit Economics table in Section III ...');
      const tableFound = await reportPage.evaluate(() => {
        const table = document.querySelector('table');
        if (table) {
          table.scrollIntoView({ behavior: 'instant', block: 'center' });
          return true;
        }
        return false;
      });
      await reportPage.waitForTimeout(400);

      const previewTablePath = path.join(BASE_DIR, 'report_v2_preview_table.png');
      await reportPage.screenshot({ path: previewTablePath, fullPage: false });
      console.log(`Saved screenshot: ${previewTablePath}`);

      results.report_previews.passed = fs.existsSync(previewP1Path) && fs.existsSync(previewTablePath) && fs.existsSync(previewSeg1Path);

      await reportContext.close();
    }

    // -------------------------------------------------------------
    // B. VERIFY bmc_v2_investor_slide.html (MONOCHROME & RENDER)
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Checking bmc_v2_investor_slide.html (Monochrome) ---');
    if (fs.existsSync(SLIDE_HTML)) {
      const slideContext = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 2,
      });
      const slidePage = await slideContext.newPage();
      await slidePage.goto(`file:///${SLIDE_HTML.replace(/\\/g, '/')}`, { waitUntil: 'load' });
      await slidePage.waitForTimeout(500);

      // Check monochrome and 0 SVG icons inside cards
      const slideMonochromeCheck = await slidePage.evaluate(() => {
        const svgInsideCards = document.querySelectorAll('.card svg, .bmc-card svg, .grid-item svg, .box svg, [class*="block"] svg');
        const text = document.documentElement.innerHTML;
        const hexMatches = text.match(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi) || [];
        const allowedPalette = new Set([
          '#111827', '#1f2937', '#374151', '#4b5563', '#6b7280',
          '#9ca3af', '#d1d5db', '#e5e7eb', '#f3f4f6', '#f9fafb',
          '#ffffff', '#000000', '#fff', '#000', '#0f172a', '#1e293b'
        ]);
        const nonMono = [];
        for (const hex of hexMatches) {
          const lowerHex = hex.toLowerCase();
          if (allowedPalette.has(lowerHex)) continue;
          const cleanHex = lowerHex.replace('#', '');
          let r, g, b;
          if (cleanHex.length === 3) {
            r = parseInt(cleanHex[0] + cleanHex[0], 16);
            g = parseInt(cleanHex[1] + cleanHex[1], 16);
            b = parseInt(cleanHex[2] + cleanHex[2], 16);
          } else if (cleanHex.length === 6) {
            r = parseInt(cleanHex.substring(0, 2), 16);
            g = parseInt(cleanHex.substring(2, 4), 16);
            b = parseInt(cleanHex.substring(4, 6), 16);
          } else {
            continue;
          }
          if (Math.abs(r - g) > 25 || Math.abs(r - b) > 25 || Math.abs(g - b) > 25) {
            nonMono.push(hex);
          }
        }
        return {
          svgInsideCardsCount: svgInsideCards.length,
          nonMonoHex: Array.from(new Set(nonMono)),
        };
      });

      console.log('Slide monochrome check:', JSON.stringify(slideMonochromeCheck));
      const slideIsMono = slideMonochromeCheck.svgInsideCardsCount === 0 && slideMonochromeCheck.nonMonoHex.length === 0;
      results.bmc_slide_monochrome.passed = slideIsMono;
      results.bmc_slide_monochrome.checks.push(slideMonochromeCheck);

      // Check scrollHeight <= 1080 & bounding boxes
      const scrollMetrics = await slidePage.evaluate(() => {
        const body = document.body;
        const html = document.documentElement;
        return {
          bodyScrollHeight: body ? body.scrollHeight : 0,
          htmlScrollHeight: html ? html.scrollHeight : 0,
          innerHeight: window.innerHeight,
        };
      });
      console.log('Slide scroll metrics:', JSON.stringify(scrollMetrics));
      const scrollPassed = scrollMetrics.bodyScrollHeight <= 1080 && scrollMetrics.htmlScrollHeight <= 1080;

      // Footer overlap check
      const footerOverlapCheck = await slidePage.evaluate(() => {
        const footer = document.querySelector('footer, .bmc-footer, #bmc-footer, .footer');
        if (!footer) return { hasFooter: false, error: 'Footer element not found' };
        const footerRect = footer.getBoundingClientRect();
        const cards = document.querySelectorAll('.card, .bmc-card, .grid-item');
        const overlaps = [];
        cards.forEach((card, idx) => {
          if (card.contains(footer) || footer.contains(card)) return;
          const r = card.getBoundingClientRect();
          if (r.bottom > footerRect.top + 2) {
            overlaps.push({
              index: idx,
              cardBottom: r.bottom,
              footerTop: footerRect.top,
              diff: r.bottom - footerRect.top,
            });
          }
        });
        return {
          hasFooter: true,
          overlaps,
          totalCardsChecked: cards.length,
        };
      });
      console.log('Footer overlap check:', JSON.stringify(footerOverlapCheck));
      const overlapPassed = footerOverlapCheck.hasFooter && footerOverlapCheck.overlaps.length === 0;

      // Take screenshot of slide
      const slideImgPath = path.join(BASE_DIR, 'bmc_v2_investor_slide.png');
      await slidePage.screenshot({ path: slideImgPath, fullPage: false });
      console.log(`Saved screenshot: ${slideImgPath}`);

      results.slide_render.passed = scrollPassed && overlapPassed;
      results.slide_render.checks.push({ scrollMetrics, footerOverlapCheck });

      await slideContext.close();
    }

  } catch (err) {
    console.error('Fatal error during render and verify:', err);
  } finally {
    await browser.close();
  }

  // Summary output
  console.log('\n=============================================');
  console.log('VERIFICATION SUMMARY REPORT:');
  console.log(JSON.stringify(results, null, 2));
  console.log('=============================================');

  fs.writeFileSync(path.join(BASE_DIR, 'verification_results_v2.json'), JSON.stringify(results, null, 2), 'utf8');

  const allPassed = results.ai_rules.passed &&
                    results.report_html_style.passed &&
                    results.bmc_slide_monochrome.passed &&
                    results.slide_render.passed &&
                    results.report_pdf.passed &&
                    results.report_previews.passed;

  process.exit(allPassed ? 0 : 1);
}

run();
