const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = path.resolve(__dirname, '../docs/handbook/screenshots');
const OUTPUT_PDF = path.resolve(__dirname, '../docs/NeuroLink_Handbook_Huong_Dan_Su_Dung.pdf');
const HTML_FILE = path.resolve(__dirname, '../docs/handbook/handbook.html');

function toBase64(filename) {
  const file = path.join(SCREENSHOTS_DIR, filename);
  if (!fs.existsSync(file)) return '';
  const bitmap = fs.readFileSync(file);
  return `data:image/png;base64,${bitmap.toString('base64')}`;
}

const images = {
  landing: toBase64('01_landing.png'),
  login: toBase64('02_login.png'),
  register: toBase64('03_register.png'),
  feed: toBase64('04_feed.png'),
  search: toBase64('05_search_discovery.png'),
  directory: toBase64('06_professionals_directory.png'),
  docProfile: toBase64('07_doctor_profile.png'),
  resProfile: toBase64('08_researcher_profile.png'),
  messages: toBase64('09_messages.png'),
  notifications: toBase64('10_notifications.png'),
  settings: toBase64('11_settings_verification.png'),
  contributions: toBase64('12_contributions_center.png'),
  rewards: toBase64('13_rewards_wallet.png'),
  adminVerif: toBase64('14_admin_verifications.png'),
  adminContrib: toBase64('15_admin_contributions.png'),
  adminRewards: toBase64('16_admin_rewards_catalog.png'),
  adminWallets: toBase64('17_admin_wallets_audit.png'),
  adminReports: toBase64('18_admin_reports.png'),
};

const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>NeuroLink - Sổ Tay Hướng Dẫn Sử Dụng Nền Tảng</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 20mm 16mm;
      @bottom-center {
        content: "Trang " counter(page) " / " counter(pages);
        font-size: 9pt;
        color: #64748b;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.55;
      font-size: 10pt;
      background: #ffffff;
    }

    /* Page Breaks */
    .page-break {
      page-break-after: always;
      break-after: page;
    }

    /* Cover Page */
    .cover-container {
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 40px 20px 20px 20px;
      page-break-after: always;
      break-after: page;
      text-align: center;
    }

    .cover-logo-badge {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 10px 24px;
      border-radius: 9999px;
      background: linear-gradient(135deg, #0d9488 0%, #0284c7 100%);
      color: white;
      font-weight: 800;
      font-size: 16pt;
      margin-bottom: 20px;
      box-shadow: 0 4px 14px rgba(13, 148, 136, 0.25);
    }

    .cover-title {
      font-size: 26pt;
      font-weight: 900;
      color: #0f172a;
      line-height: 1.2;
      margin-bottom: 12px;
      letter-spacing: -0.5px;
    }

    .cover-subtitle {
      font-size: 13pt;
      font-weight: 500;
      color: #475569;
      max-width: 650px;
      margin: 0 auto 30px auto;
      line-height: 1.45;
    }

    .cover-meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 24px;
      max-width: 580px;
      margin: 0 auto;
      text-align: left;
      font-size: 9.5pt;
    }

    .cover-meta-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px dashed #cbd5e1;
    }
    .cover-meta-row:last-child {
      border-bottom: none;
    }
    .cover-meta-label {
      color: #64748b;
      font-weight: 600;
    }
    .cover-meta-value {
      color: #0f172a;
      font-weight: 700;
    }

    /* Headings */
    h1 {
      font-size: 17pt;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 2px solid #0d9488;
      padding-bottom: 6px;
      margin-top: 18px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    h2 {
      font-size: 12.5pt;
      font-weight: 700;
      color: #0f172a;
      margin-top: 14px;
      margin-bottom: 8px;
      padding-left: 8px;
      border-left: 4px solid #0284c7;
    }

    h3 {
      font-size: 10.5pt;
      font-weight: 700;
      color: #334155;
      margin-top: 10px;
      margin-bottom: 6px;
    }

    p {
      margin-bottom: 8px;
      text-align: justify;
    }

    ul, ol {
      margin-left: 20px;
      margin-bottom: 10px;
    }

    li {
      margin-bottom: 4px;
    }

    /* Callouts & Alert Boxes */
    .callout {
      border-radius: 8px;
      padding: 10px 14px;
      margin: 10px 0;
      font-size: 9pt;
      border-left: 4px solid;
    }
    .callout-info {
      background: #f0fdfa;
      border-left-color: #0d9488;
      color: #134e4a;
    }
    .callout-warning {
      background: #fffbeb;
      border-left-color: #f59e0b;
      color: #78350f;
    }
    .callout-purple {
      background: #faf5ff;
      border-left-color: #9333ea;
      color: #581c87;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-teal { background: #ccfbf1; color: #0f766e; }
    .badge-blue { background: #e0f2fe; color: #0369a1; }
    .badge-purple { background: #f3e8ff; color: #7e22ce; }
    .badge-amber { background: #fef3c7; color: #b45309; }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0 14px 0;
      font-size: 8.5pt;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 10px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 700;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }

    /* Screenshot Container with browser chrome frame */
    .screenshot-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
      margin: 12px 0 16px 0;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
      page-break-inside: avoid;
    }

    .screenshot-header {
      background: #f1f5f9;
      border-bottom: 1px solid #e2e8f0;
      padding: 6px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 8pt;
      color: #64748b;
    }

    .screenshot-dots {
      display: flex;
      gap: 5px;
    }

    .screenshot-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    .dot-red { background: #ef4444; }
    .dot-yellow { background: #f59e0b; }
    .dot-green { background: #10b981; }

    .screenshot-img {
      width: 100%;
      height: auto;
      display: block;
    }

    .screenshot-caption {
      padding: 6px 12px;
      font-size: 8pt;
      font-style: italic;
      color: #475569;
      background: #fafafa;
      border-top: 1px solid #f1f5f9;
      text-align: center;
    }

    /* Table of contents */
    .toc-container {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px 20px;
      margin: 16px 0;
    }
    .toc-item {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      border-bottom: 1px dotted #cbd5e1;
      font-size: 9.5pt;
    }
    .toc-item:last-child {
      border-bottom: none;
    }
    .toc-title {
      font-weight: 600;
      color: #1e293b;
    }
    .toc-page {
      font-weight: 700;
      color: #0d9488;
    }

    /* Step circles */
    .step-list {
      list-style: none;
      margin-left: 0;
      margin-bottom: 12px;
    }
    .step-item {
      display: flex;
      gap: 10px;
      margin-bottom: 8px;
      align-items: flex-start;
    }
    .step-num {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #0d9488;
      color: white;
      font-weight: 700;
      font-size: 8pt;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 2px;
    }
    .step-content {
      flex: 1;
      font-size: 9.5pt;
    }
  </style>
</head>
<body>

  <!-- ========================================================= -->
  <!-- COVER PAGE                                                -->
  <!-- ========================================================= -->
  <div class="cover-container">
    <div>
      <div style="margin-top: 30px;">
        <div class="cover-logo-badge">
          <span>🧠 NeuroLink</span>
        </div>
      </div>
      <div class="cover-title">SỔ TAY HƯỚNG DẪN SỬ DỤNG<br>NỀN TẢNG NEUROLINK</div>
      <div class="cover-subtitle">
        Cẩm nang vận hành chi tiết, trải nghiệm toàn diện các tính năng mạng xã hội y tế, xác thực chứng chỉ hành nghề, trung tâm đóng góp chuyên môn và ví tín chỉ đổi thưởng.
      </div>
    </div>

    <div class="cover-meta-box">
      <div class="cover-meta-row">
        <span class="cover-meta-label">Tên sản phẩm:</span>
        <span class="cover-meta-value">NeuroLink (PBL4_Web)</span>
      </div>
      <div class="cover-meta-row">
        <span class="cover-meta-label">Phiên bản ứng dụng:</span>
        <span class="cover-meta-value">v1.0 (MVP Release)</span>
      </div>
      <div class="cover-meta-row">
        <span class="cover-meta-label">Phạm vi chuyên ngành:</span>
        <span class="cover-meta-value">Y tế, Lâm sàng Thần kinh & Khoa học Não bộ (BCI)</span>
      </div>
      <div class="cover-meta-row">
        <span class="cover-meta-label">Đối tượng sử dụng:</span>
        <span class="cover-meta-value">Bác sĩ, Nhà nghiên cứu, Chuyên gia y sinh, Quản trị viên</span>
      </div>
      <div class="cover-meta-row">
        <span class="cover-meta-label">Cập nhật lần cuối:</span>
        <span class="cover-meta-value">Tháng 10 / 2026</span>
      </div>
      <div class="cover-meta-row">
        <span class="cover-meta-label">Tiêu chuẩn bảo mật:</span>
        <span class="cover-meta-value">HttpOnly Sessions, Anti-Self-Review, Immutable Ledger</span>
      </div>
    </div>

    <div style="color: #64748b; font-size: 8.5pt; margin-bottom: 20px;">
      © 2026 NeuroLink Team. Tài liệu hướng dẫn sử dụng nội bộ và đào tạo thành viên.
    </div>
  </div>

  <!-- ========================================================= -->
  <!-- TABLE OF CONTENTS                                         -->
  <!-- ========================================================= -->
  <h1>📋 MỤC LỤC TỔNG HỢP</h1>
  <p>Sổ tay được thiết kế thành 10 chương trọng tâm giúp người dùng và quản trị viên dễ dàng tra cứu:</p>

  <div class="toc-container">
    <div class="toc-item">
      <span class="toc-title">Chương 1: Tổng Quan Nền Tảng NeuroLink & Ranh Giới Hệ Thống</span>
      <span class="toc-page">Chương 1</span>
    </div>
    <div class="toc-item">
      <span class="toc-title">Chương 2: Hướng Dẫn Đăng Ký, Đăng Nhập & Tài Khoản Mẫu Trải Nghiệm</span>
      <span class="toc-page">Chương 2</span>
    </div>
    <div class="toc-item">
      <span class="toc-title">Chương 3: Bảng Tin Chuyên Môn, Đăng Bài & Tương Tác Cộng Đồng</span>
      <span class="toc-page">Chương 3</span>
    </div>
    <div class="toc-item">
      <span class="toc-title">Chương 4: Khám Phá Tri Thức & Danh Bạ Bác Sĩ, Chuyên Gia Nghiên Cứu</span>
      <span class="toc-page">Chương 4</span>
    </div>
    <div class="toc-item">
      <span class="toc-title">Chương 5: Hồ Sơ Cá Nhân & Quy Trình Nộp Hồ Sơ Xác Minh Chứng Chỉ (Tích Xanh)</span>
      <span class="toc-page">Chương 5</span>
    </div>
    <div class="toc-item">
      <span class="toc-title">Chương 6: Nhắn Tin Riêng Tư 1-1 & Trung Tâm Thông Báo Thời Gian Thực</span>
      <span class="toc-page">Chương 6</span>
    </div>
    <div class="toc-item">
      <span class="toc-title">Chương 7: Trung Tâm Đóng Góp Chuyên Môn & Quy Trình Thẩm Định 5 Tiêu Chí</span>
      <span class="toc-page">Chương 7</span>
    </div>
    <div class="toc-item">
      <span class="toc-title">Chương 8: Ví Tín Chỉ & Sổ Cái Giao Dịch Bất Biến (Immutable Ledger)</span>
      <span class="toc-page">Chương 8</span>
    </div>
    <div class="toc-item">
      <span class="toc-title">Chương 9: Danh Mục Phần Thưởng & Cơ Chế Đổi Quyền Lợi Chuyên Môn</span>
      <span class="toc-page">Chương 9</span>
    </div>
    <div class="toc-item">
      <span class="toc-title">Chương 10: Bảng Điều Khiển Quản Trị Hệ Thống Toàn Diện (Admin Hub)</span>
      <span class="toc-page">Chương 10</span>
    </div>
    <div class="toc-item">
      <span class="toc-title">Phụ Lục: Bảng Phím Tắt, Câu Hỏi Thường Gặp (FAQ) & An Toàn Thông Tin</span>
      <span class="toc-page">Phụ lục</span>
    </div>
  </div>

  <div class="callout callout-info">
    <strong>💡 Mẹo đọc tài liệu:</strong> Mỗi chương đều bao gồm mục đích chức năng, hướng dẫn thao tác từng bước, hình ảnh chụp trực tiếp từ giao diện thực tế và các lưu ý an toàn quan trọng.
  </div>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- CHAPTER 1: OVERVIEW & SYSTEM BOUNDARIES                  -->
  <!-- ========================================================= -->
  <h1>CHƯƠNG 1: TỔNG QUAN NỀN TẢNG NEUROLINK</h1>

  <h2>1.1. Sứ mệnh và Mục tiêu</h2>
  <p>
    <strong>NeuroLink</strong> là nền tảng mạng xã hội chuyên ngành được xây dựng chuyên biệt cho lĩnh vực <strong>Y tế, Lâm sàng Thần kinh và Khoa học Não bộ (BCI)</strong>. Hệ thống giải quyết bài toán thiếu hụt kênh kết nối tin cậy giữa các bác sĩ điều trị và các nhà khoa học thần kinh máy tính, đồng thời tôn vinh và tưởng thưởng xứng đáng cho những đóng góp tri thức chất lượng cao phục vụ cộng đồng.
  </p>

  <h2>1.2. Bốn Nhóm Người Dùng Chính</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Nhóm người dùng</th>
        <th style="width: 35%;">Đặc điểm chuyên môn</th>
        <th style="width: 40%;">Quyền hạn trên hệ thống</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Người dùng phổ thông (General User)</strong></td>
        <td>Bệnh nhân, người quan tâm sức khỏe não bộ, sinh viên y khoa năm đầu.</td>
        <td>Đọc bài viết, thích, bình luận, theo dõi chuyên gia, báo cáo vi phạm, nhắn tin kết nối.</td>
      </tr>
      <tr>
        <td><strong>Bác sĩ & Nhân viên Y tế (Doctor / Healthcare)</strong></td>
        <td>Bác sĩ chuyên khoa thần kinh, nội thần kinh, chẩn đoán hình ảnh, hồi sức cấp cứu.</td>
        <td>Xác thực tích xanh CCHN, đăng bài lâm sàng, gửi thẩm định đóng góp nhận tín chỉ, đổi thưởng khóa học CME.</td>
      </tr>
      <tr>
        <td><strong>Nhà nghiên cứu (Researcher / Scientist)</strong></td>
        <td>Chuyên gia BCI, giải mã tín hiệu điện não đồ (EEG), kỹ thuật y sinh, tác giả bài báo khoa học.</td>
        <td>Xác thực ORCID/DOI/Viện nghiên cứu, chia sẻ tóm tắt nghiên cứu khoa học, đổi vé hội nghị chuyên ngành.</td>
      </tr>
      <tr>
        <td><strong>Quản trị viên (Admin)</strong></td>
        <td>Hội đồng chuyên môn, ban điều hành hệ thống và an toàn thông tin NeuroLink.</td>
        <td>Kiểm toán chứng chỉ CCHN/ORCID, chấm điểm đóng góp 5 tiêu chí, kiểm toán ví tín chỉ, quản lý danh mục phần thưởng.</td>
      </tr>
    </tbody>
  </table>

  <h2>1.3. Ranh Giới Hệ Thống Độc Lập (System Boundary)</h2>
  <div class="callout callout-warning">
    <strong>⚠️ Ranh giới độc lập với nền tảng EEG:</strong> NeuroLink là mạng xã hội tri thức chuyên môn. Nền tảng tuyệt đối không can thiệp, không trỏ, không sao chép database EEG hiện có và không tự ý đưa ra kết luận chẩn đoán tự động thay thế y lệnh của bác sĩ điều trị.
  </div>

  <div class="screenshot-card">
    <div class="screenshot-header">
      <div class="screenshot-dots">
        <span class="screenshot-dot dot-red"></span>
        <span class="screenshot-dot dot-yellow"></span>
        <span class="screenshot-dot dot-green"></span>
      </div>
      <span>http://localhost:5173/ — Trang Chủ Giới Thiệu (Landing Page)</span>
    </div>
    <img src="${images.landing}" class="screenshot-img" alt="Trang chủ NeuroLink" />
    <div class="screenshot-caption">Hình 1.1: Giao diện Trang chủ NeuroLink giới thiệu các khối tính năng và đối tượng tham gia.</div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- CHAPTER 2: AUTHENTICATION & DEMO ACCOUNTS                -->
  <!-- ========================================================= -->
  <h1>CHƯƠNG 2: ĐĂNG KÝ, ĐĂNG NHẬP & TÀI KHOẢN MẪU</h1>

  <h2>2.1. Đăng ký Tài Khoản Mới</h2>
  <ul class="step-list">
    <li class="step-item">
      <div class="step-num">1</div>
      <div class="step-content">Truy cập đường dẫn <code>http://localhost:5173/register</code> hoặc bấm nút <strong>"Tham gia ngay"</strong> trên trang chủ.</div>
    </li>
    <li class="step-item">
      <div class="step-num">2</div>
      <div class="step-content">Nhập <strong>Tên hiển thị</strong>, <strong>Tên đăng nhập (username)</strong>, <strong>Địa chỉ e-mail</strong> và <strong>Mật khẩu</strong> (tối thiểu 8 ký tự).</div>
    </li>
    <li class="step-item">
      <div class="step-num">3</div>
      <div class="step-content">Bấm nút <strong>"Tạo tài khoản"</strong>. Hệ thống sẽ cấp phiên đăng nhập tự động qua cookie bảo mật <code>HttpOnly</code>.</div>
    </li>
  </ul>

  <h2>2.2. Đăng Nhập & Bảo Mật Phiên Làm Việc</h2>
  <p>
    Truy cập <code>http://localhost:5173/login</code>. Bạn có thể sử dụng <strong>Tên người dùng (Username)</strong> hoặc <strong>Địa chỉ E-mail</strong> kèm mật khẩu. Hệ thống phòng vệ chống tấn công Brute-Force bằng Rate Limiter và phòng vệ CSRF Header cho toàn bộ API nhạy cảm.
  </p>

  <h2>2.3. Danh Sách Tài Khoản Mẫu Có Sẵn (Demo Seed Accounts)</h2>
  <table>
    <thead>
      <tr>
        <th>Tài khoản</th>
        <th>Tên người dùng</th>
        <th>Mật khẩu mẫu</th>
        <th>Vai trò & Dữ liệu có sẵn</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Quản trị viên</strong></td>
        <td><code>admin</code></td>
        <td><code>Password123</code></td>
        <td>Toàn quyền Quản trị, duyệt hồ sơ chứng chỉ, chấm điểm đóng góp, kiểm toán ví.</td>
      </tr>
      <tr>
        <td><strong>Bác sĩ Thần kinh</strong></td>
        <td><code>dr_minh</code></td>
        <td><code>Password123</code></td>
        <td>Đã có tích xanh Y tế (CCHN Bệnh viện TW), Ví có sẵn 150 tín chỉ thưởng.</td>
      </tr>
      <tr>
        <td><strong>Nhà nghiên cứu BCI</strong></td>
        <td><code>prof_lan</code></td>
        <td><code>Password123</code></td>
        <td>Đã có tích xanh Nghiên cứu (ORCID ĐH Bách Khoa), Ví có sẵn 200 tín chỉ thưởng.</td>
      </tr>
    </tbody>
  </table>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
    <div class="screenshot-card">
      <div class="screenshot-header">
        <div class="screenshot-dots">
          <span class="screenshot-dot dot-red"></span>
          <span class="screenshot-dot dot-yellow"></span>
          <span class="screenshot-dot dot-green"></span>
        </div>
        <span>Màn hình Đăng nhập</span>
      </div>
      <img src="${images.login}" class="screenshot-img" alt="Đăng nhập" />
      <div class="screenshot-caption">Hình 2.1: Giao diện Đăng nhập với nút điền nhanh tài khoản demo.</div>
    </div>

    <div class="screenshot-card">
      <div class="screenshot-header">
        <div class="screenshot-dots">
          <span class="screenshot-dot dot-red"></span>
          <span class="screenshot-dot dot-yellow"></span>
          <span class="screenshot-dot dot-green"></span>
        </div>
        <span>Màn hình Đăng ký</span>
      </div>
      <img src="${images.register}" class="screenshot-img" alt="Đăng ký" />
      <div class="screenshot-caption">Hình 2.2: Giao diện Đăng ký tài khoản thành viên mới.</div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- CHAPTER 3: FEED & SOCIAL INTERACTIONS                    -->
  <!-- ========================================================= -->
  <h1>CHƯƠNG 3: BẢNG TIN CHUYÊN MÔN & TƯƠNG TÁC CỘNG ĐỒNG</h1>

  <h2>3.1. Cấu Trúc Bảng Tin Chính (/feed)</h2>
  <p>
    Bảng tin NeuroLink được chia thành bố cục 3 cột chuyên nghiệp:
  </p>
  <ul>
    <li><strong>Cột Trái (Sidebar Trái)</strong>: Thẻ tóm tắt thông tin tài khoản, Menu điều hướng chuyên môn (Bảng tin chính, Danh bạ chuyên gia, Đóng góp chuyên môn, Ví & Phần thưởng) và Danh mục các thẻ chủ đề khoa học đang thảo luận nổi bật (<em>#LâmSàngThầnKinh</em>, <em>#BCI_Neurotech</em>, <em>#ĐộtQuỵNão</em>...).</li>
    <li><strong>Cột Giữa (Main Feed)</strong>: Khối tạo bài viết chuyên môn, bộ lọc chế độ xem (<strong>"Tất cả bài viết"</strong> hoặc <strong>"Đang theo dõi"</strong>) và dòng thời gian các bài viết phân trang vô hạn (Infinite Scroll Cursor-based).</li>
    <li><strong>Cột Phải (Sidebar Phải)</strong>: Danh sách gợi ý các Bác sĩ và Nhà khoa học tiêu biểu kèm nút theo dõi nhanh.</li>
  </ul>

  <h2>3.2. Đăng Bài Viết Chuyên Môn</h2>
  <p>
    Người dùng có thể đăng tải nội dung văn bản kèm tối đa <strong>4 hình ảnh</strong> (ảnh chụp phim cộng hưởng từ MRI, CT scan, biểu đồ sóng điện não EEG, sơ đồ thuật toán). Hệ thống tự động kiểm tra định dạng MIME hợp lệ và giới hạn kích thước an toàn mỗi ảnh $\le$ 5MB.
  </p>

  <h2>3.3. Tương Tác Học Thuật: Thích, Bình Luận & Theo Dõi</h2>
  <ul class="step-list">
    <li class="step-item">
      <div class="step-num">♥</div>
      <div class="step-content"><strong>Thích bài viết</strong>: Tác vụ thích / bỏ thích được thực hiện tức thì với cơ chế bảo vệ chống click trùng lặp ở tầng cơ sở dữ liệu.</div>
    </li>
    <li class="step-item">
      <div class="step-num">💬</div>
      <div class="step-content"><strong>Bình luận học thuật</strong>: Hỗ trợ trao đổi trực tiếp dưới mỗi bài viết; tác giả bình luận có quyền chỉnh sửa hoặc xóa bình luận của mình bất kỳ lúc nào.</div>
    </li>
    <li class="step-item">
      <div class="step-num">👤</div>
      <div class="step-content"><strong>Theo dõi chuyên gia</strong>: Bấm nút theo dõi trên trang cá nhân hoặc thẻ bài viết để ưu tiên nhận cập nhật từ các chuyên gia đầu ngành trên tab "Đang theo dõi".</div>
    </li>
  </ul>

  <div class="screenshot-card">
    <div class="screenshot-header">
      <div class="screenshot-dots">
        <span class="screenshot-dot dot-red"></span>
        <span class="screenshot-dot dot-yellow"></span>
        <span class="screenshot-dot dot-green"></span>
      </div>
      <span>http://localhost:5173/feed — Bảng Tin Chuyên Môn NeuroLink</span>
    </div>
    <img src="${images.feed}" class="screenshot-img" alt="Bảng tin chuyên môn" />
    <div class="screenshot-caption">Hình 3.1: Giao diện Bảng tin cộng đồng với huy hiệu chuyên môn và tương tác học thuật.</div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- CHAPTER 4: SEARCH & PROFESSIONAL DIRECTORY               -->
  <!-- ========================================================= -->
  <h1>CHƯƠNG 4: KHÁM PHÁ TRI THỨC & DANH BẠ CHUYÊN GIA</h1>

  <h2>4.1. Công Cụ Khám Phá Toàn Diện (/search)</h2>
  <p>
    Thanh tìm kiếm thông minh trên NeuroLink cho phép tra cứu đa chiều:
  </p>
  <ul>
    <li><strong>Tìm kiếm theo từ khóa</strong>: Nhập triệu chứng lâm sàng (<em>đột quỵ</em>, <em>động kinh</em>, <em>co giật</em>) hoặc công nghệ BCI (<em>fMRI</em>, <em>mô hình giải mã</em>, <em>P300</em>).</li>
    <li><strong>Tìm kiếm theo Hashtag</strong>: Lọc nhanh các bài viết thuộc chủ đề gắn thẻ.</li>
    <li><strong>Bộ lọc phân loại 3 tab</strong>: <em>"Tất cả"</em>, <em>"Chuyên gia Y tế & Nghiên cứu"</em>, <em>"Bài viết khoa học"</em>.</li>
  </ul>

  <h2>4.2. Danh Bạ Bác Sĩ & Nhà Nghiên Cứu</h2>
  <p>
    Tại mục <strong>Danh bạ chuyên gia</strong>, bạn có thể dễ dàng tìm kiếm đồng nghiệp theo:
  </p>
  <ul>
    <li><strong>Chuyên khoa</strong>: Thần kinh học, Chẩn đoán hình ảnh, Tâm thần học, Kỹ thuật y sinh.</li>
    <li><strong>Đơn vị công tác</strong>: Bệnh viện tuyến Trung ương, Viện nghiên cứu não bộ, Trường đại học.</li>
    <li><strong>Trạng thái tích xanh</strong>: Phân biệt rõ ràng chuyên gia đã được thẩm định chứng chỉ hành nghề chính thức.</li>
  </ul>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
    <div class="screenshot-card">
      <div class="screenshot-header">
        <div class="screenshot-dots">
          <span class="screenshot-dot dot-red"></span>
          <span class="screenshot-dot dot-yellow"></span>
          <span class="screenshot-dot dot-green"></span>
        </div>
        <span>Trang Tìm Kiếm & Khám Phá</span>
      </div>
      <img src="${images.search}" class="screenshot-img" alt="Tìm kiếm" />
      <div class="screenshot-caption">Hình 4.1: Tìm kiếm bài viết và chủ đề khoa học nổi bật.</div>
    </div>

    <div class="screenshot-card">
      <div class="screenshot-header">
        <div class="screenshot-dots">
          <span class="screenshot-dot dot-red"></span>
          <span class="screenshot-dot dot-yellow"></span>
          <span class="screenshot-dot dot-green"></span>
        </div>
        <span>Danh Bạ Chuyên Gia Y Tế & BCI</span>
      </div>
      <img src="${images.directory}" class="screenshot-img" alt="Danh bạ chuyên gia" />
      <div class="screenshot-caption">Hình 4.2: Danh bạ bác sĩ và nhà khoa học có tích xanh xác thực.</div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- CHAPTER 5: PROFILES & VERIFICATION (BLUE BADGE)          -->
  <!-- ========================================================= -->
  <h1>CHƯƠNG 5: HỒ SƠ CÁ NHÂN & XÁC MINH CHỨNG CHỈ (TÍCH XANH)</h1>

  <h2>5.1. Hai Loại Hồ Sơ Chuyên Nghiệp</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Loại hồ sơ</th>
        <th style="width: 45%;">Huy hiệu & Thông tin chuyên môn</th>
        <th style="width: 30%;">Ví dụ đại diện</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><span class="badge badge-teal">Bác sĩ / Y tế</span></td>
        <td>Huy hiệu Stethoscope xanh lá, Chức danh, Chuyên khoa lâm sàng, Bệnh viện công tác, Số năm kinh nghiệm, Số CCHN.</td>
        <td><code>BS.CKII Trần Văn Minh</code><br>(Bệnh viện Đa khoa TW)</td>
      </tr>
      <tr>
        <td><span class="badge badge-purple">Nhà nghiên cứu / BCI</span></td>
        <td>Huy hiệu Atom tím, Chức danh học thuật, Viện nghiên cứu, Hướng đề tài (BCI, Signal Processing), Mã định danh ORCID.</td>
        <td><code>PGS.TS. Nguyễn Thị Lan</code><br>(Viện Nghiên cứu Não bộ)</td>
      </tr>
    </tbody>
  </table>

  <h2>5.2. Quy Trình Nộp Hồ Sơ Xác Minh Chứng Chỉ (Settings)</h2>
  <ul class="step-list">
    <li class="step-item">
      <div class="step-num">1</div>
      <div class="step-content">Truy cập <code>http://localhost:5173/settings</code>, chuyển đến mục <strong>"Xác minh danh tính chuyên môn"</strong>.</div>
    </li>
    <li class="step-item">
      <div class="step-num">2</div>
      <div class="step-content">Chọn loại hình chuyên môn (Bác sĩ hoặc Nhà nghiên cứu).</div>
    </li>
    <li class="step-item">
      <div class="step-num">3</div>
      <div class="step-content">Tải lên tệp chứng chỉ dạng PDF hoặc ảnh chụp rõ nét: Chứng chỉ hành nghề (CCHN), Thẻ cán bộ bệnh viện, Bằng cấp tiến sĩ, hoặc Bản chụp hồ sơ ORCID.</div>
    </li>
    <li class="step-item">
      <div class="step-num">4</div>
      <div class="step-content">Hệ thống AI tự động áp dụng <strong>Optical Character Recognition (OCR)</strong> để trích xuất số chứng chỉ, nơi cấp, tính toán mã băm SHA-256 chống giả mạo và chuyển vào hàng đợi thẩm định của Quản trị viên.</div>
    </li>
  </ul>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
    <div class="screenshot-card">
      <div class="screenshot-header">
        <div class="screenshot-dots">
          <span class="screenshot-dot dot-red"></span>
          <span class="screenshot-dot dot-yellow"></span>
          <span class="screenshot-dot dot-green"></span>
        </div>
        <span>Hồ Sơ Bác Sĩ Lâm Sàng (dr_minh)</span>
      </div>
      <img src="${images.docProfile}" class="screenshot-img" alt="Hồ sơ Bác sĩ" />
      <div class="screenshot-caption">Hình 5.1: Trang cá nhân Bác sĩ với tích xanh y tế và danh sách bài viết.</div>
    </div>

    <div class="screenshot-card">
      <div class="screenshot-header">
        <div class="screenshot-dots">
          <span class="screenshot-dot dot-red"></span>
          <span class="screenshot-dot dot-yellow"></span>
          <span class="screenshot-dot dot-green"></span>
        </div>
        <span>Hồ Sơ Nhà Nghiên Cứu BCI (prof_lan)</span>
      </div>
      <img src="${images.resProfile}" class="screenshot-img" alt="Hồ sơ Nhà nghiên cứu" />
      <div class="screenshot-caption">Hình 5.2: Trang cá nhân Nhà khoa học thần kinh với liên kết ORCID.</div>
    </div>
  </div>

  <div class="screenshot-card">
    <div class="screenshot-header">
      <div class="screenshot-dots">
        <span class="screenshot-dot dot-red"></span>
        <span class="screenshot-dot dot-yellow"></span>
        <span class="screenshot-dot dot-green"></span>
      </div>
      <span>http://localhost:5173/settings — Nộp Hồ Sơ Xác Minh Chứng Chỉ</span>
    </div>
    <img src="${images.settings}" class="screenshot-img" alt="Cài đặt và Xác minh" />
    <div class="screenshot-caption">Hình 5.3: Form tải lên tài liệu minh chứng CCHN/ORCID để cấp tích xanh chuyên gia.</div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- CHAPTER 6: PRIVATE MESSAGING & NOTIFICATIONS             -->
  <!-- ========================================================= -->
  <h1>CHƯƠNG 6: TIN NHẮN RIÊNG TƯ & TRUNG TÂM THÔNG BÁO</h1>

  <h2>6.1. Tin Nhắn Riêng Tư 1-1 Học Thuật (/messages)</h2>
  <p>
    Tính năng nhắn tin cho phép các bác sĩ và nhà khoa học tiến hành <strong>hội chẩn chuyên môn, trao đổi dữ liệu nghiên cứu hoặc tư vấn chuyên sâu</strong> một cách bảo mật:
  </p>
  <ul>
    <li><strong>Khởi tạo hội thoại</strong>: Bấm nút <em>"Gửi tin nhắn"</em> trên trang cá nhân của bất kỳ chuyên gia nào hoặc tìm kiếm tên người dùng trong hộp thoại chat.</li>
    <li><strong>Bảo mật phân quyền bắt buộc (403 Forbidden)</strong>: API máy chủ kiểm soát nghiêm ngặt thành viên hội thoại. Người dùng không thuộc cuộc hội thoại tuyệt đối không thể đọc hoặc gửi tin nhắn.</li>
    <li><strong>Trạng thái tin cậy</strong>: Hiển thị thời gian gửi, trạng thái đã đọc và tự động đồng bộ thời gian thực.</li>
  </ul>

  <h2>6.2. Trung Tâm Thông Báo Thời Gian Thực (/notifications)</h2>
  <p>
    Hệ thống thông báo ghi nhận tất cả tương tác liên quan đến người dùng:
  </p>
  <ul>
    <li><span class="badge badge-teal">Tương tác bài viết</span>: Thông báo khi có người thích hoặc bình luận bài viết của bạn.</li>
    <li><span class="badge badge-blue">Theo dõi mới</span>: Thông báo khi có đồng nghiệp hoặc thành viên mới bấm theo dõi.</li>
    <li><span class="badge badge-purple">Đóng góp chuyên môn</span>: Thông báo khi hồ sơ nộp bài được Hội đồng thẩm định duyệt (cộng tín chỉ) hoặc yêu cầu bổ sung chỉnh sửa.</li>
    <li><span class="badge badge-amber">Đổi phần thưởng</span>: Thông báo mã kích hoạt khóa học CME hoặc vé hội nghị khi quản trị viên bàn giao thành công.</li>
  </ul>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
    <div class="screenshot-card">
      <div class="screenshot-header">
        <div class="screenshot-dots">
          <span class="screenshot-dot dot-red"></span>
          <span class="screenshot-dot dot-yellow"></span>
          <span class="screenshot-dot dot-green"></span>
        </div>
        <span>Giao Diện Nhắn Tin Riêng Tư 1-1</span>
      </div>
      <img src="${images.messages}" class="screenshot-img" alt="Nhắn tin riêng tư" />
      <div class="screenshot-caption">Hình 6.1: Khung chat 1-1 trao đổi học thuật và thảo luận ca bệnh.</div>
    </div>

    <div class="screenshot-card">
      <div class="screenshot-header">
        <div class="screenshot-dots">
          <span class="screenshot-dot dot-red"></span>
          <span class="screenshot-dot dot-yellow"></span>
          <span class="screenshot-dot dot-green"></span>
        </div>
        <span>Trung Tâm Thông Báo Đa Kênh</span>
      </div>
      <img src="${images.notifications}" class="screenshot-img" alt="Thông báo" />
      <div class="screenshot-caption">Hình 6.2: Danh sách thông báo tương tác và cập nhật trạng thái thưởng.</div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- CHAPTER 7: CONTRIBUTION CENTER & 5 EVALUATION CRITERIA   -->
  <!-- ========================================================= -->
  <h1>CHƯƠNG 7: TRUNG TÂM ĐÓNG GÓP CHUYÊN MÔN (CONTRIBUTIONS)</h1>

  <h2>7.1. Mục Tiêu & Cơ Chế Nộp Bài Viết Hiện Có</h2>
  <p>
    Chương trình Đóng góp & Tưởng thưởng NeuroLink được thiết kế nhằm khuyến khích các chuyên gia đã có tích xanh chia sẻ tri thức chất lượng cao. Chuyên gia <strong>không cần phải viết lại bài mới</strong>, mà có thể trực tiếp chọn từ các bài viết chất lượng đã đăng tải trên trang cá nhân để nộp xét duyệt nhận tín chỉ.
  </p>

  <h2>7.2. Năm Danh Mục Đóng Góp Chuyên Môn</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 30%;">Danh mục đóng góp</th>
        <th style="width: 45%;">Nội dung trọng tâm</th>
        <th style="width: 25%;">Đối tượng phù hợp</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>HEALTHCARE_EDUCATION</strong></td>
        <td>Phổ biến kiến thức bệnh lý não bộ, phác đồ điều trị, chăm sóc sau đột quỵ, nâng cao nhận thức cộng đồng.</td>
        <td>Bác sĩ, Dược sĩ, Điều dưỡng thần kinh.</td>
      </tr>
      <tr>
        <td><strong>RESEARCH_CONTRIBUTION</strong></td>
        <td>Tóm tắt công trình nghiên cứu khoa học, mô hình giải mã tín hiệu điện não BCI, thử nghiệm thuật toán AI.</td>
        <td>Nhà khoa học, Nghiên cứu sinh.</td>
      </tr>
      <tr>
        <td><strong>EXPERT_QA</strong></td>
        <td>Giải đáp chuyên sâu các ca bệnh phức tạp, phản biện câu hỏi hóc búa của cộng đồng y khoa.</td>
        <td>Bác sĩ chuyên khoa II, Trưởng khoa.</td>
      </tr>
      <tr>
        <td><strong>RESEARCH_DISCUSSION</strong></td>
        <td>Phân tích học thuật, đánh giá ưu nhược điểm của các phương pháp can thiệp phẫu thuật não / cấy ghép vi điện cực.</td>
        <td>Nhóm nghiên cứu liên ngành.</td>
      </tr>
      <tr>
        <td><strong>EDUCATIONAL_RESOURCE</strong></td>
        <td>Infographic giải phẫu thần kinh, video hướng dẫn đọc bản ghi EEG, tài liệu đào tạo thực hành lâm sàng.</td>
        <td>Giảng viên y khoa, Viện đào tạo.</td>
      </tr>
    </tbody>
  </table>

  <h2>7.3. Quy Trình Vòng Đời Trạng Thái (State Machine)</h2>
  <div class="callout callout-purple">
    <strong>Sơ đồ chuyển trạng thái:</strong><br>
    <code>DRAFT</code> $\rightarrow$ <code>SUBMITTED</code> (Đã nộp) $\rightarrow$ <code>UNDER_REVIEW</code> (Đang thẩm định) $\rightarrow$ <strong><code>APPROVED</code> (Đã duyệt & Tự động cộng tín chỉ qua Sổ cái)</strong> | <code>NEEDS_REVISION</code> (Yêu cầu sửa đổi) | <code>REJECTED</code> (Từ chối).<br>
    <em>Lưu ý:</em> Tác giả có thể <strong>Rút hồ sơ (WITHDRAWN)</strong> bất kỳ lúc nào khi hồ sơ chưa được duyệt.
  </div>

  <div class="screenshot-card">
    <div class="screenshot-header">
      <div class="screenshot-dots">
        <span class="screenshot-dot dot-red"></span>
        <span class="screenshot-dot dot-yellow"></span>
        <span class="screenshot-dot dot-green"></span>
      </div>
      <span>http://localhost:5173/contributions — Trung Tâm Đóng Góp Chuyên Môn</span>
    </div>
    <img src="${images.contributions}" class="screenshot-img" alt="Trung tâm đóng góp" />
    <div class="screenshot-caption">Hình 7.1: Giao diện Trung tâm Đóng góp với form nộp bài viết hiện có và theo dõi điểm số 5 tiêu chí.</div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- CHAPTER 8: CREDIT WALLET & IMMUTABLE LEDGER              -->
  <!-- ========================================================= -->
  <h1>CHƯƠNG 8: VÍ TÍN CHỈ & SỔ CÁI GIAO DỊCH BẤT BIẾN</h1>

  <h2>8.1. Nguyên Lý Sổ Cái Bất Biến (Immutable Append-Only Ledger)</h2>
  <p>
    Trên NeuroLink, tín chỉ đóng góp được quản lý theo kiến trúc tài chính kế toán kép:
  </p>
  <ul>
    <li><strong>Sổ cái giao dịch (<code>CreditTransaction</code>) là Nguồn Chân Lý duy nhất (Single Source of Truth)</strong>. Mọi biến động tín chỉ (thưởng bài viết, đổi quà, hoàn trả, kiểm toán) đều được ghi nhận dạng nhật ký append-only, tuyệt đối không bao giờ bị xóa bỏ hoặc chỉnh sửa lịch sử.</li>
    <li><strong>Số dư ví (<code>CreditWallet.balance</code>) là giá trị bộ đệm phái sinh (Derived Cache)</strong>. Số dư chỉ được thay đổi đồng thời với một giao dịch ghi sổ tương ứng thông qua giao dịch cơ sở dữ liệu nguyên tử (Atomic Database Transaction <code>prisma.$transaction</code>).</li>
    <li><strong>Chống chi tiêu trùng lặp (Double-Spending Prevention)</strong>: Hệ thống kiểm tra số dư tức thời trước khi xác nhận bất kỳ giao dịch trừ tín chỉ nào, đảm bảo số dư không bao giờ âm.</li>
  </ul>

  <h2>8.2. Các Loại Giao Dịch Tín Chỉ</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Loại giao dịch</th>
        <th style="width: 15%;">Dấu biến động</th>
        <th style="width: 60%;">Ý nghĩa & Tình huống kích hoạt</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code>CONTRIBUTION_REWARD</code></td>
        <td><strong style="color: #10b981;">+ Dương</strong></td>
        <td>Cộng tín chỉ khi bài viết đóng góp chuyên môn được Hội đồng thẩm định phê duyệt thành công.</td>
      </tr>
      <tr>
        <td><code>REWARD_REDEMPTION</code></td>
        <td><strong style="color: #ef4444;">- Âm</strong></td>
        <td>Trừ tín chỉ khi chuyên gia thực hiện đổi lấy khóa học CME, vé hội nghị hoặc tài liệu học thuật.</td>
      </tr>
      <tr>
        <td><code>REFUND</code></td>
        <td><strong style="color: #10b981;">+ Dương</strong></td>
        <td>Tự động hoàn lại tín chỉ vào ví khi yêu cầu đổi thưởng bị từ chối hoặc do người dùng chủ động hủy.</td>
      </tr>
      <tr>
        <td><code>ADMIN_ADJUSTMENT</code></td>
        <td><strong>+/- Linh hoạt</strong></td>
        <td>Điều chỉnh thủ công từ Quản trị viên phục vụ kiểm toán, bồi hoàn sự cố; bắt buộc ghi nhận lý do kiểm toán.</td>
      </tr>
    </tbody>
  </table>

  <div class="screenshot-card">
    <div class="screenshot-header">
      <div class="screenshot-dots">
        <span class="screenshot-dot dot-red"></span>
        <span class="screenshot-dot dot-yellow"></span>
        <span class="screenshot-dot dot-green"></span>
      </div>
      <span>http://localhost:5173/rewards — Ví Tín Chỉ & Lịch Sử Giao Dịch Sổ Cái</span>
    </div>
    <img src="${images.rewards}" class="screenshot-img" alt="Ví tín chỉ và đổi thưởng" />
    <div class="screenshot-caption">Hình 8.1: Thẻ hiển thị số dư ví, danh mục đổi thưởng và bảng lịch sử sổ cái append-only.</div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- CHAPTER 9: REWARD CATALOG & REDEMPTION WORKFLOW          -->
  <!-- ========================================================= -->
  <h1>CHƯƠNG 9: DANH MỤC PHẦN THƯỞNG & QUY TRÌNH ĐỔI THƯỞNG</h1>

  <h2>9.1. Danh Mục Quyền Lợi Chuyên Môn</h2>
  <p>
    Tín chỉ đóng góp tri thức có thể được sử dụng để đổi lấy các gói quyền lợi giá trị cao:
  </p>
  <ul>
    <li><strong>Khóa học CME & Đào tạo Y khoa liên tục</strong>: Các khóa học cập nhật phác đồ chẩn đoán thần kinh, xử trí đột quỵ cấp, cấp chứng chỉ CME hợp chuẩn.</li>
    <li><strong>Vé tham dự Hội nghị & Workshop Khoa học</strong>: Vé tham dự trực tiếp hoặc trực tuyến các hội nghị thần kinh học và giao diện não - máy tính (BCI).</li>
    <li><strong>Cơ sở dữ liệu Học thuật & Thư viện điện tử</strong>: Tài khoản truy cập các bài báo khoa học, thư viện nghiên cứu chuyên sâu về khoa học não bộ.</li>
    <li><strong>Mentoring 1:1 với Chuyên gia Đầu ngành</strong>: Các buổi trao đổi, cố vấn định hướng nghiên cứu và phản biện luận án y khoa cùng Giáo sư đầu ngành.</li>
  </ul>

  <h2>9.2. Cơ Chế Chống Thất Thoát Tiền Tệ (Anti-Cash-Drain Monetary Guard)</h2>
  <div class="callout callout-warning">
    <strong>🛡️ Quy tắc bảo vệ quỹ thưởng nghiêm ngặt:</strong><br>
    Các phần thưởng quy đổi tiền mặt trực tiếp (<code>isMonetary: true</code>) luôn bị <strong>khóa mặc định</strong> (<code>payoutEnabled = false</code>). Hệ thống sẽ chặn tức thì mọi yêu cầu rút tiền nếu chưa được kích hoạt bởi chính sách giải ngân chính thức. Nền tảng tuyệt đối không hỗ trợ tiền mã hóa (crypto), blockchain, hay chuyển nhượng tín chỉ qua lại giữa các tài khoản (P2P transfers).
  </div>

  <h2>9.3. Quy Trình Đổi Quà & Hoàn Tín Chỉ Tự Động</h2>
  <ul class="step-list">
    <li class="step-item">
      <div class="step-num">1</div>
      <div class="step-content">Chuyên gia chọn phần thưởng mong muốn trên trang <code>/rewards</code> và bấm <strong>"Đổi thưởng ngay"</strong>.</div>
    </li>
    <li class="step-item">
      <div class="step-num">2</div>
      <div class="step-content">Hệ thống mở hộp thoại xác nhận, kiểm tra số dư ví và trừ tín chỉ, tạo bản ghi yêu cầu đổi quà với trạng thái <code>REQUESTED</code>.</div>
    </li>
    <li class="step-item">
      <div class="step-num">3</div>
      <div class="step-content"><strong>Quản trị viên bàn giao (FULFILL)</strong>: Nhập mã kích hoạt khóa học hoặc gửi link tham dự hội nghị cho chuyên gia.</div>
    </li>
    <li class="step-item">
      <div class="step-num">4</div>
      <div class="step-content"><strong>Tự động hoàn tín chỉ (Auto-Refund)</strong>: Nếu yêu cầu bị từ chối hoặc người dùng hủy yêu cầu khi chưa được xử lý, toàn bộ số tín chỉ đã trừ sẽ được <strong>hoàn trả 100% về ví ngay lập tức</strong> thông qua một giao dịch <code>REFUND</code>.</div>
    </li>
  </ul>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- CHAPTER 10: ADMIN CONTROL HUB (5 TABS)                   -->
  <!-- ========================================================= -->
  <h1>CHƯƠNG 10: BẢNG ĐIỀU KHIỂN QUẢN TRỊ TOÀN DIỆN (ADMIN HUB)</h1>

  <p>
    Cổng quản trị <code>http://localhost:5173/admin</code> dành riêng cho Ban điều hành và Hội đồng chuyên môn với 5 phân hệ kiểm soát tập trung:
  </p>

  <h2>10.1. Tab 1: Thẩm Định Bác Sĩ & AI OCR Hồ Sơ Chứng Chỉ</h2>
  <p>
    Kiểm tra hồ sơ nộp CCHN của bác sĩ hoặc ORCID của nhà nghiên cứu. Bảng kiểm tra hiển thị kết quả trích xuất OCR, độ tương đồng tên, cảnh báo tài liệu đáng ngờ và lịch sử can thiệp (Audit Trail).
  </p>
  <div class="screenshot-card">
    <div class="screenshot-header">
      <div class="screenshot-dots">
        <span class="screenshot-dot dot-red"></span>
        <span class="screenshot-dot dot-yellow"></span>
        <span class="screenshot-dot dot-green"></span>
      </div>
      <span>Admin Tab 1: Thẩm định Bác sĩ & Hồ sơ CCHN / ORCID</span>
    </div>
    <img src="${images.adminVerif}" class="screenshot-img" alt="Admin Duyệt Chứng Chỉ" />
    <div class="screenshot-caption">Hình 10.1: Hàng đợi xét duyệt chứng chỉ hành nghề y tế với bằng chứng trích xuất OCR.</div>
  </div>

  <h2>10.2. Tab 2: Xét Duyệt Đóng Góp Với 5 Tiêu Chí Chấm Điểm</h2>
  <p>
    Hội đồng thẩm định đọc nội dung bài viết gốc, chấm điểm từ 1 đến 5 sao theo 5 tiêu chí độc lập:
  </p>
  <ul>
    <li><strong>Độ chính xác khoa học (ACCURACY)</strong></li>
    <li><strong>Tính phù hợp chuyên môn (RELEVANCE)</strong></li>
    <li><strong>Tính hữu ích ứng dụng (USEFULNESS)</strong></li>
    <li><strong>Tính nguyên bản (ORIGINALITY)</strong></li>
    <li><strong>Tác động cộng đồng (COMMUNITY_IMPACT)</strong></li>
  </ul>
  <div class="callout callout-info">
    <strong>Quy tắc Chống tự duyệt (Anti-Self-Review Guard):</strong> Quản trị viên không bao giờ được phép tự tiếp nhận hoặc tự phê duyệt bài viết đóng góp do chính mình đăng tải (lỗi <code>403 SELF_REVIEW_PROHIBITED</code>).
  </div>

  <div class="screenshot-card">
    <div class="screenshot-header">
      <div class="screenshot-dots">
        <span class="screenshot-dot dot-red"></span>
        <span class="screenshot-dot dot-yellow"></span>
        <span class="screenshot-dot dot-green"></span>
      </div>
      <span>Admin Tab 2: Xét duyệt Đóng góp với Form Chấm điểm 5 Tiêu chí</span>
    </div>
    <img src="${images.adminContrib}" class="screenshot-img" alt="Admin Thẩm định đóng góp" />
    <div class="screenshot-caption">Hình 10.2: Khung chấm điểm 5 tiêu chí chuyên môn và quyết định trao thưởng tín chỉ.</div>
  </div>

  <div class="page-break"></div>

  <h2>10.3. Tab 3: Quản Lý Danh Mục Phần Thưởng & Bàn Giao Quyền Lợi</h2>
  <p>
    Quản trị viên có thể thêm mới phần thưởng, điều chỉnh mức tín chỉ, cập nhật số lượng giới hạn và thực hiện bàn giao mã kích hoạt khóa học CME hoặc vé hội nghị cho thành viên.
  </p>
  <div class="screenshot-card">
    <div class="screenshot-header">
      <div class="screenshot-dots">
        <span class="screenshot-dot dot-red"></span>
        <span class="screenshot-dot dot-yellow"></span>
        <span class="screenshot-dot dot-green"></span>
      </div>
      <span>Admin Tab 3: Quản trị Danh mục Phần thưởng & Xử lý Yêu cầu Đổi quà</span>
    </div>
    <img src="${images.adminRewards}" class="screenshot-img" alt="Admin Quản trị phần thưởng" />
    <div class="screenshot-caption">Hình 10.3: Quản lý danh mục gói quà và phê duyệt bàn giao quyền lợi cho người dùng.</div>
  </div>

  <h2>10.4. Tab 4: Kiểm Toán & Điều Chỉnh Ví Tín Chỉ Người Dùng</h2>
  <p>
    Tra cứu ví của bất kỳ người dùng nào, xem chi tiết số dư, tổng điểm tích lũy và thực hiện điều chỉnh cộng/trừ tín chỉ đặc biệt kèm bắt buộc ghi nhận lý do giải trình kiểm toán.
  </p>
  <div class="screenshot-card">
    <div class="screenshot-header">
      <div class="screenshot-dots">
        <span class="screenshot-dot dot-red"></span>
        <span class="screenshot-dot dot-yellow"></span>
        <span class="screenshot-dot dot-green"></span>
      </div>
      <span>Admin Tab 4: Kiểm toán Số dư Ví Tín chỉ & Điều chỉnh Kế toán</span>
    </div>
    <img src="${images.adminWallets}" class="screenshot-img" alt="Admin Kiểm toán ví tín chỉ" />
    <div class="screenshot-caption">Hình 10.4: Danh sách ví người dùng và nút điều chỉnh tín chỉ phục vụ kiểm toán.</div>
  </div>

  <h2>10.5. Tab 5: Xử Lý Báo Cáo Vi Phạm & Kiểm Duyệt Nội Dung</h2>
  <p>
    Tiếp nhận các báo cáo phản ánh từ cộng đồng về bài viết có dấu hiệu sai lệch kiến thức y khoa, quảng cáo thương mại trái phép hoặc vi phạm tiêu chuẩn đạo đức nghiên cứu; hỗ trợ thao tác ẩn bài viết hoặc khóa tài khoản vi phạm.
  </p>
  <div class="screenshot-card">
    <div class="screenshot-header">
      <div class="screenshot-dots">
        <span class="screenshot-dot dot-red"></span>
        <span class="screenshot-dot dot-yellow"></span>
        <span class="screenshot-dot dot-green"></span>
      </div>
      <span>Admin Tab 5: Danh mục Báo cáo Vi phạm Nội dung</span>
    </div>
    <img src="${images.adminReports}" class="screenshot-img" alt="Admin Xử lý báo cáo" />
    <div class="screenshot-caption">Hình 10.5: Hàng đợi xử lý báo cáo vi phạm tiêu chuẩn cộng đồng.</div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- APPENDIX: SHORTCUTS, FAQ & SECURITY                      -->
  <!-- ========================================================= -->
  <h1>PHỤ LỤC: CÂU HỎI THƯỜNG GẶP (FAQ) & AN TOÀN THÔNG TIN</h1>

  <h2>1. Các Câu Hỏi Thường Gặp (FAQ)</h2>

  <h3>Q1: Tôi là Bác sĩ mới đăng ký, làm thế nào để được cấp tích xanh?</h3>
  <p>
    <strong>Trả lời:</strong> Sau khi đăng nhập, bạn vào mục <strong>Cài đặt tài khoản (/settings)</strong> $\rightarrow$ chọn mục <strong>"Xác minh danh tính chuyên môn"</strong> $\rightarrow$ điền đầy đủ nơi công tác, số chứng chỉ hành nghề và tải lên bản chụp CCHN hoặc thẻ bệnh viện. Hội đồng thẩm định của NeuroLink sẽ đối chiếu và phê duyệt trong vòng 24–48 giờ làm việc.
  </p>

  <h3>Q2: Tôi có thể nộp một bài viết của đồng nghiệp để nhận tín chỉ thưởng không?</h3>
  <p>
    <strong>Trả lời:</strong> Tuyệt đối không. Hệ thống chỉ cho phép nộp các bài viết do chính tài khoản của bạn đăng tải (kiểm tra quyền tác giả máy chủ). Mọi hành vi cố tình giả mạo quyền sở hữu bài viết sẽ bị từ chối và cảnh cáo tài khoản.
  </p>

  <h3>Q3: Điểm số của Hội đồng thẩm định được tính như thế nào?</h3>
  <p>
    <strong>Trả lời:</strong> Mỗi bài viết đóng góp được đánh giá trên 5 tiêu chí độc lập (Độ chính xác, Tính phù hợp, Tính hữu ích, Tính nguyên bản, Tác động cộng đồng), mỗi tiêu chí từ 1 đến 5 điểm. Điểm tổng kết là trung bình cộng của 5 tiêu chí. Các bài viết đạt yêu cầu sẽ được Hội đồng quyết định mức tín chỉ thưởng xứng đáng.
  </p>

  <h3>Q4: Khi đổi khóa học CME hoặc vé hội nghị mà bị hết chỗ thì tín chỉ có mất không?</h3>
  <p>
    <strong>Trả lời:</strong> Không bao giờ mất. Nhờ kiến trúc Sổ cái Bất biến, nếu yêu cầu đổi thưởng bị từ chối hoặc hết suất, hệ thống sẽ tự động kích hoạt giao dịch <code>REFUND</code> hoàn lại 100% tín chỉ về ví của bạn ngay lập tức.
  </p>

  <h2>2. Bảng Phím Tắt & Thao Tác Nhanh</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Thao tác</th>
        <th style="width: 35%;">Đường dẫn nhanh</th>
        <th style="width: 40%;">Mục đích sử dụng</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Bảng tin chính</strong></td>
        <td><code>/feed</code></td>
        <td>Đọc bài viết mới, trao đổi học thuật, đăng bài kèm ảnh.</td>
      </tr>
      <tr>
        <td><strong>Tìm kiếm & Danh bạ</strong></td>
        <td><code>/search</code></td>
        <td>Tra cứu chuyên gia theo chuyên khoa và bài viết khoa học.</td>
      </tr>
      <tr>
        <td><strong>Hộp thư riêng tư</strong></td>
        <td><code>/messages</code></td>
        <td>Hội chẩn 1-1, trao đổi ca bệnh và nghiên cứu riêng tư.</td>
      </tr>
      <tr>
        <td><strong>Đóng góp chuyên môn</strong></td>
        <td><code>/contributions</code></td>
        <td>Nộp bài viết hiện có, theo dõi điểm số 5 tiêu chí.</td>
      </tr>
      <tr>
        <td><strong>Ví & Đổi thưởng</strong></td>
        <td><code>/rewards</code></td>
        <td>Kiểm tra số dư tín chỉ, xem sổ cái giao dịch và đổi quà.</td>
      </tr>
      <tr>
        <td><strong>Trung tâm Quản trị</strong></td>
        <td><code>/admin</code></td>
        <td>Duyệt CCHN, chấm điểm bài đóng góp, kiểm toán ví (Admin).</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Cam Kết An Toàn Thông Tin & Quyền Riêng Tư</h2>
  <div class="callout callout-info">
    Toàn bộ tài liệu y tế cá nhân (CCHN, hồ sơ nhân thân) đều được lưu trữ trong thư mục phân vùng an toàn, mã hóa kiểm tra SHA-256 chống chỉnh sửa và chỉ có quản trị viên có thẩm quyền mới được quyền giải mã để phục vụ công tác xác minh.
  </div>

  <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 8.5pt;">
    — HẾT SỔ TAY HƯỚNG DẪN SỬ DỤNG NEUROLINK v1.0 —
  </div>

</body>
</html>
`;

async function buildPdf() {
  console.log('Writing HTML handbook file...');
  fs.writeFileSync(HTML_FILE, htmlContent, 'utf8');
  console.log('✓ HTML handbook saved to:', HTML_FILE);

  console.log('Launching headless browser to generate PDF handbook...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  console.log('Exporting PDF with printBackground: true, format: A4...');
  await page.pdf({
    path: OUTPUT_PDF,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '16mm',
      bottom: '18mm',
      left: '14mm',
      right: '14mm',
    },
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="width: 100%; font-size: 8pt; color: #94a3b8; padding: 0 16mm; display: flex; justify-content: space-between; font-family: sans-serif;">
        <span>NeuroLink v1.0 — Sổ Tay Hướng Dẫn Sử Dụng</span>
        <span>Mạng Xã Hội Chuyên Môn Y Tế & Não Bộ</span>
      </div>
    `,
    footerTemplate: `
      <div style="width: 100%; font-size: 8pt; color: #94a3b8; padding: 0 16mm; display: flex; justify-content: space-between; font-family: sans-serif;">
        <span>Chỉ lưu hành nội bộ</span>
        <span>Trang <span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>
    `,
  });

  console.log('✓ PDF handbook successfully created at:', OUTPUT_PDF);
  await browser.close();
}

buildPdf().catch((err) => {
  console.error('Failed to generate PDF:', err);
  process.exit(1);
});
