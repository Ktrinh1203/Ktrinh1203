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
  <title>Sổ Tay Vận Hành & Hướng Dẫn Sử Dụng Nền Tảng NeuroLink</title>
  <style>
    @page {
      size: A4;
      margin: 22mm 20mm 22mm 20mm;
      @bottom-center {
        content: counter(page);
        font-family: "Times New Roman", Times, serif;
        font-size: 10pt;
        color: #333333;
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: "Times New Roman", Times, serif;
      color: #1a1a1a;
      line-height: 1.65;
      font-size: 11pt;
      background: #ffffff;
    }

    .page-break {
      page-break-after: always;
      break-after: page;
    }

    /* Cover Page */
    .cover {
      height: 92vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      text-align: center;
      page-break-after: always;
      break-after: page;
      padding-top: 50px;
    }

    .cover-institution {
      font-size: 12pt;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #2c3e50;
      margin-bottom: 8px;
    }

    .cover-sub-institution {
      font-size: 11pt;
      font-style: italic;
      color: #4a5568;
      margin-bottom: 60px;
    }

    .cover-title {
      font-size: 23pt;
      font-weight: bold;
      color: #111827;
      line-height: 1.35;
      margin-bottom: 18px;
      text-transform: uppercase;
    }

    .cover-subtitle {
      font-size: 13pt;
      color: #374151;
      max-width: 580px;
      margin: 0 auto 50px auto;
      font-style: italic;
      line-height: 1.5;
    }

    .cover-divider {
      width: 120px;
      height: 1.5px;
      background: #2b6cb0;
      margin: 0 auto 40px auto;
    }

    .cover-meta {
      font-size: 11pt;
      color: #2d3748;
      line-height: 1.8;
      text-align: left;
      display: inline-block;
      margin: 0 auto;
      padding: 16px 28px;
      border-top: 1px solid #cbd5e0;
      border-bottom: 1px solid #cbd5e0;
    }

    .cover-footer {
      font-size: 10pt;
      color: #718096;
      margin-top: 40px;
    }

    /* Headings */
    h1 {
      font-size: 14pt;
      font-weight: bold;
      color: #1a202c;
      text-transform: uppercase;
      margin-top: 26px;
      margin-bottom: 12px;
      padding-bottom: 4px;
      border-bottom: 1px solid #2d3748;
      page-break-after: avoid;
    }

    h2 {
      font-size: 12pt;
      font-weight: bold;
      color: #2d3748;
      margin-top: 18px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }

    h3 {
      font-size: 11pt;
      font-weight: bold;
      font-style: italic;
      color: #4a5568;
      margin-top: 12px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }

    /* Paragraphs and Prose */
    p {
      text-align: justify;
      margin-bottom: 10px;
      text-indent: 1.5em;
    }

    p.no-indent {
      text-indent: 0;
    }

    /* Quotes and Callouts */
    .note-box {
      border: 1px solid #cbd5e0;
      border-left: 3.5px solid #2b6cb0;
      background-color: #f7fafc;
      padding: 10px 14px;
      margin: 14px 0;
      font-size: 10.5pt;
      page-break-inside: avoid;
    }

    .note-box p {
      margin-bottom: 4px;
      text-indent: 0;
    }

    .warning-box {
      border: 1px solid #fed7d7;
      border-left: 3.5px solid #c53030;
      background-color: #fff5f5;
      padding: 10px 14px;
      margin: 14px 0;
      font-size: 10.5pt;
      page-break-inside: avoid;
    }

    .warning-box p {
      margin-bottom: 4px;
      text-indent: 0;
    }

    /* Screenshots */
    .figure-container {
      margin: 16px 0 20px 0;
      text-align: center;
      page-break-inside: avoid;
    }

    .figure-image {
      max-width: 95%;
      height: auto;
      border: 1px solid #cbd5e0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      display: block;
      margin: 0 auto;
    }

    .figure-caption {
      font-size: 9.5pt;
      font-style: italic;
      color: #4a5568;
      margin-top: 6px;
      text-align: center;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0 18px 0;
      font-size: 10pt;
      page-break-inside: avoid;
    }

    th, td {
      border-top: 1px solid #718096;
      border-bottom: 1px solid #cbd5e0;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }

    th {
      border-bottom: 1.5px solid #2d3748;
      font-weight: bold;
      color: #1a202c;
      background-color: #edf2f7;
    }

    tr:last-child td {
      border-bottom: 1px solid #718096;
    }

    /* Table of Contents */
    .toc-entry {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 11pt;
    }

    .toc-title {
      color: #1a202c;
    }

    .toc-dots {
      flex: 1;
      border-bottom: 1px dotted #a0aec0;
      margin: 0 8px 4px 8px;
    }

    .toc-page {
      color: #2d3748;
      font-weight: bold;
    }
  </style>
</head>
<body>

  <!-- ========================================================= -->
  <!-- TRANG BÌA                                                 -->
  <!-- ========================================================= -->
  <div class="cover">
    <div>
      <div class="cover-institution">Nền tảng Mạng Xã hội Chuyên môn Y sinh & Khoa học Não bộ</div>
      <div class="cover-sub-institution">Dự án Phát triển Hệ thống Thông tin Y tế & Nghiên cứu Thần kinh (PBL4_Web)</div>
      
      <div style="height: 40px;"></div>

      <div class="cover-title">SỔ TAY VẬN HÀNH VÀ HƯỚNG DẪN TRẢI NGHIỆM HỆ THỐNG NEUROLINK</div>
      <div class="cover-divider"></div>
      
      <div class="cover-subtitle">
        Tài liệu hướng dẫn cấu trúc trao đổi tri thức y học, xác thực chứng chỉ hành nghề, trung tâm đóng góp chuyên môn và cơ chế bồi dưỡng sự nghiệp dựa trên triết lý cộng đồng thực chứng.
      </div>
    </div>

    <div class="cover-meta">
      <div><strong>Tên hệ thống:</strong> NeuroLink Social Network (v1.0)</div>
      <div><strong>Mô hình tham chiếu:</strong> Kiến trúc tri thức cộng đồng lâm sàng (PatientsLikeMe Reference Framework)</div>
      <div><strong>Nhóm đối tượng:</strong> Bác sĩ chuyên khoa, Nhà nghiên cứu khoa học thần kinh, Sinh viên y sinh và Quản trị viên</div>
      <div><strong>Tiêu chuẩn dữ liệu:</strong> Bảo mật hồ sơ y khoa, xác thực chứng thực số và kiểm toán giao dịch bất biến</div>
      <div><strong>Thời gian phát hành:</strong> Tháng 10 năm 2026</div>
    </div>

    <div class="cover-footer">
      Lưu hành nội bộ — Dành cho công tác vận hành, đào tạo người dùng và kiểm định chất lượng phần mềm
    </div>
  </div>

  <!-- ========================================================= -->
  <!-- LỜI NÓI ĐẦU TỪ HỘI ĐỒNG Y KHOA & BAN PHÁT TRIỂN           -->
  <!-- ========================================================= -->
  <h1>LỜI NÓI ĐẦU: TRIẾT LÝ VẬN HÀNH CỦA NEUROLINK</h1>

  <p>
    Trong y học thực chứng và khoa học thần kinh hiện đại, khoảng cách giữa các phát hiện tại phòng thí nghiệm và thực tiễn điều trị bên giường bệnh luôn là một thách thức lớn. Các bác sĩ lâm sàng đối mặt hàng ngày với sự phức tạp của từng ca bệnh riêng biệt, trong khi các nhà khoa học tính toán và kỹ sư y sinh miệt mài hoàn thiện các mô hình giải mã tín hiệu điện não đồ (EEG) hay giao diện não - máy tính (BCI). Nếu không có một không gian trao đổi bình đẳng, minh bạch và có tính chuẩn hóa cao, tri thức y khoa quý giá sẽ tiếp tục bị phân mảnh trong các tài liệu rời rạc.
  </p>

  <p>
    Lấy cảm hứng từ sự thành công của nền tảng cộng đồng sức khỏe PatientsLikeMe — nơi dữ liệu đời thực (Real-World Evidence) và tiếng nói chuyên môn được tôn trọng như một tài sản vô giá — dự án NeuroLink ra đời nhằm thiết lập một mạng xã hội tri thức chuyên sâu. Tại đây, mỗi người thầy thuốc, mỗi nhà nghiên cứu không chỉ đóng vai trò là người tiếp nhận thông tin, mà còn là người đóng góp tích cực vào kho tàng hiểu biết chung của cộng đồng.
  </p>

  <p>
    Cuốn sổ tay này được biên soạn nhằm đồng hành cùng quý đồng nghiệp trong suốt quá trình làm quen và khai thác nền tảng. Thay vì chỉ liệt kê các thao tác kỹ thuật đơn thuần, tài liệu phân tích cặn kẽ mục đích y khoa của từng phân hệ, giải thích nguyên tắc vận hành của cơ chế thẩm định chuyên môn năm tiêu chí, và làm rõ kiến trúc bảo vệ quyền lợi người tham gia thông qua sổ cái tín chỉ minh bạch. Chúng tôi hy vọng đây sẽ là tài liệu tham khảo hữu ích cho công tác học tập, nghiên cứu và thực hành lâm sàng thường nhật của quý vị.
  </p>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- MỤC LỤC TỔNG HỢP                                          -->
  <!-- ========================================================= -->
  <h1>MỤC LỤC TỔNG THỂ</h1>
  <p class="no-indent" style="margin-bottom: 20px;">Nội dung cuốn sổ tay được bố cục thành chín chương chuyên đề và một phần phụ lục thực hành:</p>

  <div style="margin: 0 10px;">
    <div class="toc-entry">
      <span class="toc-title">Chương 1: Kiến Trúc Nền Tảng Và Triết Lý Cộng Đồng Sức Khỏe</span>
      <span class="toc-dots"></span>
      <span class="toc-page">Trang 4</span>
    </div>
    <div class="toc-entry">
      <span class="toc-title">Chương 2: Đăng Ký, Đăng Nhập Và Thiết Lập Tài Khoản Thành Viên</span>
      <span class="toc-dots"></span>
      <span class="toc-page">Trang 6</span>
    </div>
    <div class="toc-entry">
      <span class="toc-title">Chương 3: Bảng Tin Chuyên Môn Và Văn Hóa Thảo Luận Học Thuật</span>
      <span class="toc-page">Trang 8</span>
    </div>
    <div class="toc-entry">
      <span class="toc-title">Chương 4: Khám Phá Tri Thức Và Mạng Lưới Danh Bạ Đồng Nghiệp</span>
      <span class="toc-dots"></span>
      <span class="toc-page">Trang 10</span>
    </div>
    <div class="toc-entry">
      <span class="toc-title">Chương 5: Hồ Sơ Cá Nhân Và Quy Trình Xác Minh Chứng Chỉ Hành Nghề</span>
      <span class="toc-dots"></span>
      <span class="toc-page">Trang 12</span>
    </div>
    <div class="toc-entry">
      <span class="toc-title">Chương 6: Kênh Trao Đổi Riêng Tư Và Hệ Thống Thông Báo Đa Tầng</span>
      <span class="toc-dots"></span>
      <span class="toc-page">Trang 14</span>
    </div>
    <div class="toc-entry">
      <span class="toc-title">Chương 7: Trung Tâm Đóng Góp Và Thẩm Định Chuyên Môn Năm Tiêu Chí</span>
      <span class="toc-dots"></span>
      <span class="toc-page">Trang 16</span>
    </div>
    <div class="toc-entry">
      <span class="toc-title">Chương 8: Ví Tín Chỉ Chuyên Môn Và Nguyên Lý Sổ Cái Bất Biến</span>
      <span class="toc-dots"></span>
      <span class="toc-page">Trang 18</span>
    </div>
    <div class="toc-entry">
      <span class="toc-title">Chương 9: Danh Mục Đổi Thưởng Và Cơ Chế Bồi Dưỡng Y Khoa Liên Tục</span>
      <span class="toc-dots"></span>
      <span class="toc-page">Trang 20</span>
    </div>
    <div class="toc-entry">
      <span class="toc-title">Chương 10: Cổng Quản Trị Hệ Thống, Giám Sát Dữ Liệu Và Đạo Đức Y Sinh</span>
      <span class="toc-dots"></span>
      <span class="toc-page">Trang 22</span>
    </div>
    <div class="toc-entry">
      <span class="toc-title">Phụ Lục: Dữ Liệu Thực Nghiệm Mẫu Và Quy Định Ứng Xử Cộng Đồng</span>
      <span class="toc-dots"></span>
      <span class="toc-page">Trang 24</span>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- CHƯƠNG 1: TỔNG QUAN & TRIẾT LÝ CỘNG ĐỒNG                  -->
  <!-- ========================================================= -->
  <h1>CHƯƠNG 1: KIẾN TRÚC NỀN TẢNG VÀ TRIẾT LÝ CỘNG ĐỒNG SỨC KHỎE</h1>

  <h2>1.1. Tiếp cận mô hình mạng xã hội tri thức y tế</h2>
  <p>
    Khác biệt với các mạng xã hội giải trí nói chung, NeuroLink được định hình dựa trên triết lý cốt lõi của PatientsLikeMe: biến tri thức và trải nghiệm thực tiễn thành dữ liệu có cấu trúc phục vụ sự tiến bộ của y học. Nền tảng hướng tới việc tạo dựng một môi trường an toàn, nơi các bác sĩ thần kinh, bác sĩ hồi sức, kỹ sư y sinh và các nhà nghiên cứu nhận thức có thể tìm thấy tiếng nói chung.
  </p>
  <p>
    Trong hệ sinh thái NeuroLink, thông tin chia sẻ không chỉ dừng lại ở các bài đăng thông thường mà được quy chuẩn thành những đóng góp khoa học có giá trị. Người tham gia được phân định quyền lợi và trách nhiệm rõ ràng, bảo đảm rằng những thảo luận lâm sàng đều xuất phát từ những người có chuyên môn được xác thực, tránh tình trạng lan truyền các thông tin y học sai lệch nguy hại cho sức khỏe người bệnh.
  </p>

  <h2>1.2. Phân định bốn nhóm thành viên</h2>
  <p>
    Nhằm tạo dựng một cấu trúc tương tác hài hòa, NeuroLink phân chia các đối tượng tham gia thành bốn nhóm thành viên chính với các phạm vi quyền hạn chuyên biệt:
  </p>
  <p>
    Thứ nhất là nhóm người dùng quan tâm sức khỏe và sinh viên y khoa. Đây là những thành viên tham gia với mục tiêu tiếp cận thông tin y tế chính thống, theo dõi tiến trình hồi phục chức năng của người bệnh và đặt câu hỏi chuyên môn dưới sự định hướng của thầy thuốc. Nhóm này không tham gia vào chương trình nhận khen thưởng tín chỉ chuyên môn.
  </p>
  <p>
    Thứ hai là các bác sĩ và chuyên gia y tế lâm sàng. Đây là lực lượng nòng cốt tham gia chia sẻ kinh nghiệm điều trị, phân tích ca bệnh khó, giáo dục sức khỏe cộng đồng và nhận điểm tín chỉ đào tạo y khoa liên tục (CME) thông qua các đóng góp được hội đồng duyệt.
  </p>
  <p>
    Thứ ba là các nhà nghiên cứu và kỹ sư khoa học não bộ. Nhóm chuyên gia này đóng góp các công trình nghiên cứu tiền lâm sàng, mô hình xử lý tín hiệu điện não và các đánh giá học thuật chuyên sâu, đồng thời kết nối với bác sĩ điều trị để tìm kiếm dữ liệu kiểm chứng lâm sàng.
  </p>
  <p>
    Thứ tư là ban quản trị và hội đồng thẩm định. Nhóm giữ vai trò bảo vệ tính toàn vẹn của nền tảng, tiến hành đối chiếu hồ sơ cấp phép hành nghề, chấm điểm các đóng góp chuyên môn theo tiêu chuẩn khoa học và kiểm toán hệ thống sổ cái tín chỉ.
  </p>

  <h2>1.3. Ranh giới vận hành và tính độc lập của hệ thống</h2>
  <div class="warning-box">
    <p><strong>Lưu ý về ranh giới hệ thống:</strong> NeuroLink là nền tảng trao đổi tri thức và mạng lưới học thuật độc lập. Nền tảng tuyệt đối không can thiệp, không sao chép hoặc trỏ trực tiếp vào cơ sở dữ liệu lưu trữ dataset điện não đồ (EEG) của website đối tác bên ngoài, đồng thời không cung cấp các kết luận chẩn đoán tự động nhằm thay thế quyền chỉ định điều trị của người thầy thuốc.</p>
  </div>

  <div class="figure-container">
    <img src="${images.landing}" class="figure-image" alt="Giao diện trang chủ NeuroLink" />
    <div class="figure-caption">Hình 1: Trang chủ giới thiệu nền tảng NeuroLink và các trục tính năng chính dành cho cộng đồng y khoa.</div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- CHƯƠNG 2: ĐĂNG KÝ, ĐĂNG NHẬP VÀ THIẾT LẬP TÀI KHOẢN       -->
  <!-- ========================================================= -->
  <h1>CHƯƠNG 2: ĐĂNG KÝ, ĐĂNG NHẬP VÀ THIẾT LẬP TÀI KHOẢN THÀNH VIÊN</h1>

  <h2>2.1. Quy trình khởi tạo tài khoản</h2>
  <p>
    Để tham gia vào cộng đồng NeuroLink, người dùng bắt đầu bằng việc truy cập trang đăng ký thông qua liên kết trực tiếp trên trang chủ. Tại biểu mẫu đăng ký, hệ thống yêu cầu cung cấp các trường thông tin cơ bản bao gồm tên hiển thị đầy đủ, tên đăng nhập định danh duy nhất trong hệ thống, địa chỉ thư điện tử cá nhân hoặc đơn vị công tác, cùng mật khẩu bảo mật có độ dài tối thiểu tám ký tự.
  </p>
  <p>
    Sau khi nhấn nút xác nhận tạo tài khoản, máy chủ sẽ tiến hành mã hóa mật khẩu thông qua thuật toán băm an toàn bcrypt, thiết lập phiên làm việc được định danh bằng mã băm SHA-256 lưu trữ trong cơ sở dữ liệu, đồng thời trả về một cookie trình duyệt mang cờ HttpOnly và SameSite nghiêm ngặt nhằm triệt tiêu hoàn toàn nguy cơ rò rỉ phiên qua các kịch bản tấn công Cross-Site Scripting (XSS).
  </p>

  <h2>2.2. Kiểm soát đăng nhập và phòng vệ tấn công</h2>
  <p>
    Biểu mẫu đăng nhập cho phép thành viên truy cập bằng cách sử dụng địa chỉ thư điện tử hoặc tên người dùng đi kèm mật khẩu đã thiết lập. Nhằm hỗ trợ công tác kiểm thử và trải nghiệm nhanh các phân hệ nghiệp vụ, giao diện đăng nhập tích hợp sẵn các phím điền nhanh dữ liệu mẫu cho từng vai trò người dùng trong môi trường phát triển.
  </p>
  <p>
    Bên cạnh đó, hệ thống áp dụng cơ chế giới hạn tần suất truy vấn (Rate Limiting) tại các điểm tiếp nhận dữ liệu xác thực, tự động từ chối các yêu cầu có dấu hiệu dò quét mật khẩu tự động, đồng thời yêu cầu mã thông báo phòng vệ CSRF Token đính kèm trong tiêu đề của mọi yêu cầu có tính chất thay đổi trạng thái dữ liệu.
  </p>

  <div class="figure-container">
    <div style="display: flex; gap: 14px; justify-content: center;">
      <div style="flex: 1;">
        <img src="${images.login}" class="figure-image" alt="Giao diện đăng nhập NeuroLink" />
        <div class="figure-caption">Hình 2: Cửa sổ đăng nhập với các tùy chọn nạp tài khoản kiểm thử.</div>
      </div>
      <div style="flex: 1;">
        <img src="${images.register}" class="figure-image" alt="Giao diện đăng ký NeuroLink" />
        <div class="figure-caption">Hình 3: Biểu mẫu đăng ký thành viên mới trên nền tảng.</div>
      </div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- CHƯƠNG 3: BẢNG TIN CHUYÊN MÔN & THẢO LUẬN HỌC THUẬT       -->
  <!-- ========================================================= -->
  <h1>CHƯƠNG 3: BẢNG TIN CHUYÊN MÔN VÀ VĂN HÓA THẢO LUẬN HỌC THUẬT</h1>

  <h2>3.1. Bố cục không gian làm việc trên bảng tin</h2>
  <p>
    Bảng tin trung tâm của NeuroLink được thiết kế theo cấu trúc ba phân vùng khoa học, bảo đảm khả năng nắm bắt thông tin nhanh chóng mà không gây phân tâm cho người hành nghề y:
  </p>
  <p>
    Phân vùng bên trái đóng vai trò là bảng điều hướng nhanh, cung cấp tóm tắt thông tin nhân thân của người dùng hiện tại, lối tắt dẫn tới các chức năng nghiệp vụ trọng tâm như danh bạ chuyên gia, trung tâm nộp bài đóng góp và ví tín chỉ, cùng danh mục các chủ đề thảo luận lâm sàng tiêu biểu được gắn thẻ định danh.
  </p>
  <p>
    Phân vùng ở giữa là không gian tương tác chính. Tại đây, người dùng có thể lựa chọn xem toàn bộ các bài thảo luận công khai trong cộng đồng hoặc chuyển sang chế độ chỉ theo dõi những đồng nghiệp, chuyên gia đầu ngành mà mình đã thiết lập kết nối. Cơ chế tải dữ liệu dựa trên con trỏ vô hạn (Cursor-based Pagination) giúp việc duyệt bài diễn ra mượt mà và tiết kiệm băng thông.
  </p>
  <p>
    Phân vùng bên phải hiển thị danh sách các chuyên gia nổi bật được đề xuất dựa trên tính tương đồng về chuyên khoa hoặc hướng đề tài nghiên cứu, cho phép người dùng mở rộng mạng lưới hợp tác chỉ với một thao tác theo dõi.
  </p>

  <h2>3.2. Tiêu chuẩn đăng tải bài viết và minh chứng dữ liệu</h2>
  <p>
    Khi tạo lập một bài chia sẻ chuyên môn, người viết có thể trình bày nội dung văn bản học thuật kết hợp đính kèm tối đa bốn tệp hình ảnh minh họa, chẳng hạn như lát cắt chụp cộng hưởng từ (MRI), chụp cắt lớp vi tính (CT), biểu đồ tín hiệu điện não hoặc sơ đồ thuật toán xử lý dữ liệu. Hệ thống tự động kiểm duyệt định dạng tệp tải lên và áp đặt giới hạn kích thước không vượt quá năm megabyte cho mỗi bức ảnh nhằm bảo đảm hiệu năng truyền tải.
  </p>
  <div class="note-box">
    <p><strong>Khuyến cáo y đức về bảo mật thông tin bệnh nhân:</strong> Tương tự như nguyên tắc của PatientsLikeMe, mọi hình ảnh bệnh án, phim chụp chẩn đoán hình ảnh trước khi đăng tải lên diễn đàn cộng đồng bắt buộc phải được người đăng che mờ hoặc xóa bỏ hoàn toàn các thông tin định danh cá nhân của người bệnh (tên tuổi, địa chỉ, số hồ sơ bệnh viện) nhằm tuân thủ nghiêm ngặt quy định bảo mật dữ liệu y tế.</p>
  </div>

  <h2>3.3. Tương tác có trách nhiệm: Thích, phản biện và kết nối</h2>
  <p>
    Hệ thống bình luận dưới mỗi bài viết được định hướng như một không gian hội chẩn trực tuyến. Người tham gia được khuyến khích đặt câu hỏi mang tính xây dựng, dẫn chứng các hướng dẫn điều trị chuẩn hoặc công bố khoa học liên quan. Tác giả bài viết và người bình luận có toàn quyền quản lý, chỉnh sửa hoặc thu hồi ý kiến của mình, trong khi các tương tác thích và theo dõi được ghi nhận chính xác ở cấp độ cơ sở dữ liệu, loại trừ hoàn toàn các hành vi gian lận số liệu tương tác.
  </p>

  <div class="figure-container">
    <img src="${images.feed}" class="figure-image" alt="Giao diện Bảng tin chuyên môn NeuroLink" />
    <div class="figure-caption">Hình 4: Không gian Bảng tin chuyên môn với bố cục ba cột và các bài thảo luận có huy hiệu xác thực.</div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- CHƯƠNG 4: KHÁM PHÁ TRI THỨC & DANH BẠ ĐỒNG NGHIỆP         -->
  <!-- ========================================================= -->
  <h1>CHƯƠNG 4: KHÁM PHÁ TRI THỨC VÀ MẠNG LƯỚI DANH BẠ ĐỒNG NGHIỆP</h1>

  <h2>4.1. Công cụ tìm kiếm phân loại đa mục tiêu</h2>
  <p>
    Công tác nghiên cứu và điều trị thường đòi hỏi người thầy thuốc phải truy xuất nhanh các tài liệu liên quan đến một hội chứng cụ thể hoặc tìm kiếm một chuyên gia am hiểu sâu về một kỹ thuật can thiệp nhất định. Trung tâm khám phá của NeuroLink đáp ứng trọn vẹn yêu cầu này nhờ bộ lọc tìm kiếm phân loại gồm ba nhánh: tìm kiếm tổng hợp, tìm kiếm chuyên gia và tìm kiếm bài viết học thuật.
  </p>
  <p>
    Thanh công cụ cho phép người dùng tra cứu theo các thuật ngữ lâm sàng bằng tiếng Việt hoặc tiếng Anh, chẳng hạn như "đột quỵ não", "động kinh kháng trị", hoặc các khái niệm công nghệ não bộ như "mô hình P300", "giải mã tín hiệu EEG". Kết quả trả về được sắp xếp theo mức độ phù hợp và thời gian công bố, giúp người tra cứu nhanh chóng tiếp cận nguồn tri thức đáng tin cậy.
  </p>

  <h2>4.2. Danh bạ chuyên gia y tế và nhà khoa học thần kinh</h2>
  <p>
    Mục danh bạ chuyên gia cung cấp một cái nhìn toàn cảnh về mạng lưới nguồn nhân lực y sinh tham gia trên nền tảng. Thay vì danh sách người dùng dàn trải, danh bạ được tổ chức với các tiêu chí lọc rõ ràng: chuyên khoa điều trị, đơn vị công tác (bệnh viện đa khoa tuyến trung ương, viện nghiên cứu chuyên ngành thần kinh, trường đại học y dược), và trạng thái thẩm định bằng cấp.
  </p>
  <p>
    Nhờ đó, một bác sĩ tại bệnh viện tuyến tỉnh có thể dễ dàng định vị các đồng nghiệp chuyên khoa sâu về can thiệp mạch máu não tại các trung tâm lớn để xin ý kiến hội chẩn, hoặc một kỹ sư xử lý tín hiệu có thể tìm thấy các nhóm nghiên cứu đang cần chuyên gia phân tích dữ liệu điện não để cùng phối hợp xây dựng đề tài khoa học.
  </p>

  <div class="figure-container">
    <div style="display: flex; gap: 14px; justify-content: center;">
      <div style="flex: 1;">
        <img src="${images.search}" class="figure-image" alt="Trang tìm kiếm tri thức" />
        <div class="figure-caption">Hình 5: Giao diện tra cứu theo từ khóa và chủ đề chuyên môn.</div>
      </div>
      <div style="flex: 1;">
        <img src="${images.directory}" class="figure-image" alt="Danh bạ chuyên gia y tế" />
        <div class="figure-caption">Hình 6: Danh bạ thầy thuốc và nhà nghiên cứu có chứng nhận tích xanh.</div>
      </div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- CHƯƠNG 5: HỒ SƠ CÁ NHÂN & XÁC MINH CHỨNG CHỈ HÀNH NGHỀ    -->
  <!-- ========================================================= -->
  <h1>CHƯƠNG 5: HỒ SƠ CÁ NHÂN VÀ QUY TRÌNH XÁC MINH CHỨNG CHỈ HÀNH NGHỀ</h1>

  <h2>5.1. Hai diện hồ sơ chuyên môn đặc thù</h2>
  <p>
    Một trong những nền tảng tạo dựng niềm tin vững chắc trên PatientsLikeMe chính là tính minh bạch về danh tính và trình độ chuyên môn của các thành viên đưa ra lời khuyên. Trên NeuroLink, hệ thống thiết lập hai diện hồ sơ chuyên biệt được đánh dấu bằng huy hiệu tích xanh sau khi được thẩm định:
  </p>
  <p>
    Đối với Bác sĩ và Nhân viên Y tế, hồ sơ làm nổi bật chức danh chuyên môn (Bác sĩ chuyên khoa I, Chuyên khoa II, Thạc sĩ, Bác sĩ nội trú), phạm vi hoạt động chuyên môn theo chứng chỉ hành nghề, bệnh viện công tác và số năm kinh nghiệm lâm sàng.
  </p>
  <p>
    Đối với Nhà nghiên cứu và Kỹ sư Thần kinh học, hồ sơ tập trung vào học vị (Tiến sĩ, Phó Giáo sư, Giáo sư), viện nghiên cứu hoặc phòng thí nghiệm trực thuộc, các hướng đề tài then chốt (giao diện não - máy tính, giải mã tín hiệu thần kinh, thị giác máy tính trong y sinh), đi kèm liên kết tới mã định danh nghiên cứu quốc tế ORCID hoặc hồ sơ xuất bản khoa học.
  </p>

  <h2>5.2. Quy trình nộp hồ sơ chứng thực bằng cấp</h2>
  <p>
    Để đạt được huy hiệu xác thực, thành viên điều hướng tới mục Cài đặt tài khoản, chuyển đến phân hệ "Xác minh danh tính chuyên môn" và tiến hành các bước theo trình tự chuẩn hóa:
  </p>
  <p>
    Bước đầu tiên, người nộp chọn đúng nhóm nghiệp vụ của mình và điền các trường dữ liệu bắt buộc gồm tên đơn vị công tác, chức danh, mã số chứng chỉ hành nghề y tế hoặc mã số ORCID.
  </p>
  <p>
    Bước thứ hai, thành viên tải lên tệp minh chứng định dạng PDF hoặc hình ảnh chất lượng cao ghi lại chứng chỉ hành nghề, thẻ công tác bệnh viện hoặc bằng cấp sau đại học.
  </p>
  <p>
    Ngay sau khi tệp được tải lên, máy chủ sẽ kích hoạt tiến trình trích xuất văn bản quang học (OCR) để đọc tự động các trường thông tin then chốt như họ tên người được cấp, nơi cấp bằng và thời hạn hiệu lực, đồng thời tính toán mã băm mật mã SHA-256 của tệp để bảo đảm tính toàn vẹn dữ liệu, ngăn ngừa tình trạng tráo đổi tài liệu sau khi nộp.
  </p>
  <p>
    Hồ sơ sau đó được đưa vào hàng đợi thẩm định tập trung, nơi các quản trị viên có chuyên môn sẽ đối chiếu bằng chứng với cơ sở dữ liệu quản lý hành nghề y tế trước khi đưa ra quyết định phê duyệt chính thức.
  </p>

  <div class="figure-container">
    <div style="display: flex; gap: 14px; justify-content: center;">
      <div style="flex: 1;">
        <img src="${images.docProfile}" class="figure-image" alt="Hồ sơ Bác sĩ Trần Văn Minh" />
        <div class="figure-caption">Hình 7: Hồ sơ cá nhân của Bác sĩ lâm sàng với tích xanh y tế.</div>
      </div>
      <div style="flex: 1;">
        <img src="${images.resProfile}" class="figure-image" alt="Hồ sơ Nhà nghiên cứu Nguyễn Thị Lan" />
        <div class="figure-caption">Hình 8: Hồ sơ Nhà khoa học não bộ với định danh viện nghiên cứu.</div>
      </div>
    </div>
  </div>

  <div class="figure-container">
    <img src="${images.settings}" class="figure-image" alt="Biểu mẫu nộp hồ sơ xác minh CCHN" />
    <div class="figure-caption">Hình 9: Giao diện biểu mẫu nộp tài liệu minh chứng CCHN/ORCID để đề nghị cấp tích xanh.</div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- CHƯƠNG 6: NHẮN TIN RIÊNG TƯ & THÔNG BÁO ĐA TẦNG           -->
  <!-- ========================================================= -->
  <h1>CHƯƠNG 6: KÊNH TRAO ĐỔI RIÊNG TƯ VÀ HỆ THỐNG THÔNG BÁO ĐA TẦNG</h1>

  <h2>6.1. Nhắn tin bảo mật phục vụ hội chẩn lâm sàng</h2>
  <p>
    Bên cạnh các thảo luận công khai trên bảng tin, nhu cầu trao đổi trực tiếp một đối một giữa các bác sĩ về một diễn biến bệnh học phức tạp hoặc thảo luận về số liệu tiền lâm sàng là vô cùng cấp thiết. Phân hệ Tin nhắn của NeuroLink cung cấp một kênh liên lạc an toàn, đáp ứng nghiêm ngặt các tiêu chuẩn bảo mật dữ liệu y tế:
  </p>
  <p>
    Quyền truy cập phòng hội thoại được kiểm soát cưỡng bức ở cấp độ máy chủ. Chỉ hai thành viên tham gia cuộc đối thoại mới được cấp quyền đọc và gửi tin nhắn, bất kỳ nỗ lực truy cập trái phép nào từ tài khoản thứ ba đều bị chặn lại với mã lỗi từ chối quyền truy cập (403 Forbidden).
  </p>
  <p>
    Giao diện nhắn tin cung cấp danh sách các cuộc hội thoại gần nhất, hiển thị trực quan trạng thái tin nhắn mới chưa đọc, cho phép thành viên theo dõi tiến trình phản hồi từ đồng nghiệp một cách liền mạch.
  </p>

  <h2>6.2. Trung tâm thông báo đa sự kiện</h2>
  <p>
    Nhằm giúp người dùng không bỏ lỡ các diễn biến quan trọng trên nền tảng, trung tâm thông báo thời gian thực tự động phân loại và gửi tín hiệu cảnh báo theo từng nhóm sự kiện chuyên biệt:
  </p>
  <p>
    Nhóm thông báo tương tác xã hội cập nhật các lượt thích, bình luận mới trên các bài thảo luận của người dùng hoặc thông báo khi có đồng nghiệp mới bấm theo dõi hồ sơ cá nhân.
  </p>
  <p>
    Nhóm thông báo tiến độ thẩm định đóng góp gửi cảnh báo ngay khi bài viết nộp xét duyệt được hội đồng chấm điểm, phê duyệt trao tín chỉ hoặc gửi kèm nhận xét yêu cầu bổ sung chỉnh sửa.
  </p>
  <p>
    Nhóm thông báo đổi quyền lợi chuyên môn cung cấp thông tin bàn giao mã kích hoạt khóa học CME hoặc xác nhận đăng ký vé hội nghị khoa học ngay khi quản trị viên hoàn tất xử lý yêu cầu.
  </p>

  <div class="figure-container">
    <div style="display: flex; gap: 14px; justify-content: center;">
      <div style="flex: 1;">
        <img src="${images.messages}" class="figure-image" alt="Cửa sổ nhắn tin riêng tư" />
        <div class="figure-caption">Hình 10: Kênh nhắn tin trao đổi học thuật và hội chẩn 1-1.</div>
      </div>
      <div style="flex: 1;">
        <img src="${images.notifications}" class="figure-image" alt="Trung tâm thông báo" />
        <div class="figure-caption">Hình 11: Danh sách thông báo tương tác và cập nhật hồ sơ chuyên môn.</div>
      </div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- CHƯƠNG 7: ĐÓNG GÓP & THẨM ĐỊNH NĂM TIÊU CHÍ                -->
  <!-- ========================================================= -->
  <h1>CHƯƠNG 7: TRUNG TÂM ĐÓNG GÓP VÀ THẨM ĐỊNH CHUYÊN MÔN NĂM TIÊU CHÍ</h1>

  <h2>7.1. Cơ chế đóng góp tri thức không trùng lặp</h2>
  <p>
    Xuất phát từ kinh nghiệm tổ chức dữ liệu nghiên cứu của PatientsLikeMe, NeuroLink xây dựng quy trình đóng góp tri thức theo phương châm tinh gọn và tránh lãng phí thời gian của người hành nghề y. Chuyên gia không cần phải soạn thảo lại một bài viết hoàn toàn mới để đề nghị xét duyệt. Thay vào đó, sau khi đăng tải một bài viết có chất lượng học thuật cao lên bảng tin cá nhân, chuyên gia chỉ cần truy cập vào Trung tâm Đóng góp, lựa chọn chính bài viết đó từ danh sách các bài hợp lệ và gửi hồ sơ kèm theo bản tóm tắt giá trị khoa học của bài viết.
  </p>
  <p>
    Quy định kiểm soát của hệ thống bảo đảm rằng thành viên chỉ có thể nộp bài viết thuộc quyền sở hữu của chính mình, đồng thời ngăn chặn việc nộp trùng lặp một bài viết nhiều lần khi hồ sơ trước đó vẫn đang trong tiến trình xét duyệt.
  </p>

  <h2>7.2. Năm danh mục đóng góp chuyên môn</h2>
  <p>
    Để việc đánh giá được khách quan và phù hợp với đặc thù từng lĩnh vực, bài viết nộp thẩm định được phân bổ vào một trong năm danh mục chuẩn hóa:
  </p>
  <p>
    Danh mục Giáo dục & Nhận thức Y tế dành cho các bài viết giải thích cơ chế bệnh học, phân tích phác đồ điều trị lâm sàng và nâng cao hiểu biết của cộng đồng về các bệnh lý thần kinh.
  </p>
  <p>
    Danh mục Công bố & Tóm tắt Nghiên cứu dành cho các báo cáo kết quả thử nghiệm tiền lâm sàng, mô hình giải mã tín hiệu não bộ hoặc các phương pháp tính toán y sinh học mới.
  </p>
  <p>
    Danh mục Hỏi đáp Chuyên gia dành cho các câu trả lời chuyên sâu, giải đáp thấu đáo các vướng mắc điều trị lâm sàng phức tạp được đồng nghiệp nêu ra.
  </p>
  <p>
    Danh mục Thảo luận & Phản biện Học thuật dành cho các phân tích đánh giá đa chiều về các công trình nghiên cứu đã công bố, chỉ ra những ưu điểm và hạn chế của phương pháp can thiệp.
  </p>
  <p>
    Danh mục Học liệu & Tài liệu Đào tạo dành cho các sơ đồ trực quan, infographic giải phẫu chức năng não bộ hoặc video hướng dẫn thao tác đọc bản ghi điện não phục vụ đào tạo.
  </p>

  <h2>7.3. Tiêu chuẩn thẩm định năm tiêu chí độc lập</h2>
  <p>
    Hội đồng chuyên môn đánh giá từng bài viết dựa trên thang điểm từ một đến năm sao cho mỗi tiêu chí trong số năm tiêu chí độc lập:
  </p>
  <p>
    Thứ nhất là Độ chính xác khoa học, đo lường tính chuẩn xác của các số liệu y tế và bằng chứng thực nghiệm dẫn chứng trong bài.
  </p>
  <p>
    Thứ hai là Tính phù hợp chuyên môn, xem xét sự gắn kết của nội dung với các trọng tâm chăm sóc sức khỏe và nghiên cứu thần kinh học.
  </p>
  <p>
    Thứ ba là Tính hữu ích ứng dụng, đánh giá giá trị tham khảo thực tiễn mà bài viết mang lại cho các bác sĩ điều trị và bạn đọc.
  </p>
  <p>
    Thứ tư là Tính nguyên bản và sâu sắc, ghi nhận những góc nhìn đúc kết mới mẻ thay vì chỉ sao chép các thông tin giáo khoa thông thường.
  </p>
  <p>
    Thứ năm là Tác động cộng đồng, phản ánh sự lan tỏa tích cực và mức độ kích thích các trao đổi học thuật lành mạnh trong mạng lưới.
  </p>

  <h2>7.4. Vòng đời trạng thái và quy tắc chống tự duyệt</h2>
  <div class="note-box">
    <p><strong>Nguyên tắc đạo đức kiểm duyệt (Anti-Self-Review Guard):</strong> Nhằm loại trừ hoàn toàn tình trạng xung đột lợi ích, hệ thống thiết lập rào cản kỹ thuật bất biến ở tầng logic dịch vụ: Bất kỳ quản trị viên nào cũng tuyệt đối không được quyền tự tiếp nhận thẩm định hoặc tự phê duyệt bài viết đóng góp do chính tài khoản của mình đăng tải (mã lỗi từ chối 403 SELF_REVIEW_PROHIBITED). Mọi quyết định phê duyệt bắt buộc phải do một thành viên khác trong hội đồng thực hiện.</p>
  </div>

  <div class="figure-container">
    <img src="${images.contributions}" class="figure-image" alt="Trung tâm đóng góp chuyên môn" />
    <div class="figure-caption">Hình 12: Giao diện Trung tâm Đóng góp với công cụ chọn bài viết hiện có và theo dõi bảng điểm chi tiết.</div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- CHƯƠNG 8: VÍ TÍN CHỈ & SỔ CÁI BẤT BIẾN                   -->
  <!-- ========================================================= -->
  <h1>CHƯƠNG 8: VÍ TÍN CHỈ CHUYÊN MÔN VÀ NGUYÊN LÝ SỔ CÁI BẤT BIẾN</h1>

  <h2>8.1. Triết lý kế toán sổ cái trong quản lý tri thức</h2>
  <p>
    Một hệ thống tưởng thưởng chuyên môn muốn duy trì được uy tín lâu dài thì cơ chế quản lý điểm thưởng phải đạt được độ tin cậy tương đương với các hệ thống kế toán tài chính. Trên NeuroLink, mô hình số dư đơn giản đã được thay thế bằng kiến trúc Sổ cái giao dịch bất biến (Immutable Append-Only Ledger):
  </p>
  <p>
    Trong kiến trúc này, bảng lưu trữ giao dịch (CreditTransaction) chính là Nguồn Chân Lý Duy Nhất (Single Source of Truth). Mọi biến động tín chỉ của thành viên — dù là cộng điểm thưởng bài viết, trừ điểm đổi quà, hoàn trả do hủy yêu cầu hay điều chỉnh kiểm toán — đều bắt buộc phải được ghi nhận dưới dạng một dòng nhật ký giao dịch mới đính kèm mã định danh duy nhất, thời điểm tạo lập và tham chiếu nghiệp vụ rõ ràng.
  </p>
  <p>
    Số dư hiển thị trên ví của người dùng (CreditWallet) chỉ đóng vai trò là một giá trị bộ đệm phái sinh (Derived Cache) phục vụ việc hiển thị nhanh. Tuyệt đối không có bất kỳ lệnh sửa đổi trực tiếp nào vào số dư ví mà không thông qua một giao dịch ghi sổ tương ứng được thực thi bên trong một giao dịch cơ sở dữ liệu nguyên tử (Atomic Database Transaction).
  </p>

  <h2>8.2. Cơ chế phòng chống chi tiêu trùng lặp và bảo vệ lịch sử</h2>
  <p>
    Khi thành viên thực hiện một yêu cầu đổi quyền lợi, hệ thống sẽ thực hiện kiểm tra số dư tức thời ngay trong phiên giao dịch cơ sở dữ liệu. Nếu số dư khả dụng không đủ đáp ứng giá trị của gói quyền lợi, yêu cầu sẽ bị từ chối ngay lập tức, triệt tiêu nguy cơ xảy ra tình trạng số dư âm hoặc chi tiêu trùng lặp (Double-Spending) khi có nhiều yêu cầu được gửi đồng thời.
  </p>
  <p>
    Lịch sử giao dịch một khi đã được ghi vào sổ cái sẽ tồn tại vĩnh viễn và không bao giờ bị xóa bỏ hoặc chỉnh sửa. Nếu có sự cố cần bồi hoàn hoặc phát hiện sai lệch trong quá trình đối soát, quản trị viên sẽ phát hành một giao dịch đảo ngược hoặc một giao dịch điều chỉnh đối ứng, qua đó bảo toàn tính toàn vẹn và khả năng kiểm toán của toàn bộ lịch sử điểm thưởng.
  </p>

  <div class="figure-container">
    <img src="${images.rewards}" class="figure-image" alt="Ví tín chỉ và lịch sử sổ cái" />
    <div class="figure-caption">Hình 13: Thẻ hiển thị số dư khả dụng và bảng nhật ký sổ cái ghi nhận từng biến động tín chỉ.</div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- CHƯƠNG 9: DANH MỤC ĐỔI THƯỞNG & BỒI DƯỠNG Y KHOA          -->
  <!-- ========================================================= -->
  <h1>CHƯƠNG 9: DANH MỤC ĐỔI THƯỞNG VÀ CƠ CHẾ BỒI DƯỠNG Y KHOA LIÊN TỤC</h1>

  <h2>9.1. Định hướng giá trị: Phát triển sự nghiệp và học thuật</h2>
  <p>
    Khác với các hệ thống tích điểm tiêu dùng thương mại, điểm tín chỉ trên NeuroLink được thiết kế chuyên biệt để tái đầu tư vào năng lực chuyên môn của người thầy thuốc và nhà nghiên cứu. Danh mục phần thưởng tập trung vào các gói quyền lợi bồi dưỡng sự nghiệp có giá trị cao:
  </p>
  <p>
    Các khóa học đào tạo y khoa liên tục (CME) được chứng nhận bởi các trường đại học y dược và bệnh viện đầu ngành, hỗ trợ bác sĩ hoàn thành chỉ tiêu bồi dưỡng chuyên môn bắt buộc theo quy định của Luật Khám bệnh, chữa bệnh.
  </p>
  <p>
    Vé tham dự các hội nghị khoa học thần kinh quốc gia và quốc tế, các buổi workshop chuyên sâu về kỹ thuật điện não và giao diện não - máy tính, mở ra cơ hội giao lưu học thuật trực tiếp với các chuyên gia đầu ngành.
  </p>
  <p>
    Quyền truy cập các cơ sở dữ liệu học thuật quốc tế và thư viện y khoa điện tử chuyên ngành, phục vụ đắc lực cho công tác tra cứu tài liệu phục vụ đề tài nghiên cứu.
  </p>
  <p>
    Các chương trình cố vấn trực tiếp (Mentoring 1:1) cùng các giáo sư, chuyên gia đầu ngành, hỗ trợ định hướng phương pháp nghiên cứu và hoàn thiện các ấn phẩm khoa học.
  </p>

  <h2>9.2. Quy tắc bảo vệ quỹ thưởng và chống thất thoát tài chính</h2>
  <div class="warning-box">
    <p><strong>Cơ chế khóa rút tiền mặt nghiêm ngặt (Anti-Cash-Drain Guard):</strong> Nhằm bảo đảm tôn chỉ học thuật phi thương mại và ngăn ngừa các nguy cơ gian lận tài chính, các danh mục phần thưởng có tính chất quy đổi tiền tệ đều bị khóa mặc định ở tầng cấu hình hệ thống (payoutEnabled = false). Nền tảng tuyệt đối không hỗ trợ quy đổi sang tiền mã hóa, không tích hợp chuỗi khối (blockchain) và không cho phép chuyển giao tín chỉ qua lại giữa các tài khoản cá nhân. Mọi điều chỉnh liên quan đến quỹ chi trả tiền mặt bắt buộc phải trải qua quy trình phê duyệt ngân sách và rà soát pháp lý chặt chẽ của ban điều hành.</p>
  </div>

  <h2>9.3. Quy trình thực hiện yêu cầu và tự động hoàn tín chỉ</h2>
  <p>
    Khi thành viên quyết định đổi một gói quyền lợi, quy trình nghiệp vụ diễn ra theo các giai đoạn chuẩn hóa:
  </p>
  <p>
    Thành viên lựa chọn phần thưởng và xác nhận đổi điểm. Hệ thống tiến hành trừ tín chỉ trong ví, ghi nhận một giao dịch loại trừ điểm vào sổ cái và tạo yêu cầu đổi thưởng với trạng thái chờ xử lý.
  </p>
  <p>
    Quản trị viên tiếp nhận yêu cầu, tiến hành bàn giao mã kích hoạt khóa học hoặc gửi thư xác nhận đăng ký hội nghị cho thành viên, sau đó cập nhật trạng thái yêu cầu sang hoàn tất.
  </p>
  <p>
    Trong trường hợp gói quyền lợi bị hết suất, hoặc thành viên chủ động hủy yêu cầu khi chưa được xử lý, hệ thống sẽ tự động kích hoạt một giao dịch hoàn trả tín chỉ (REFUND), hoàn trả trọn vẹn số điểm đã trừ về ví của thành viên ngay lập tức mà không làm thất thoát bất kỳ điểm thưởng nào.
  </p>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- CHƯƠNG 10: CỔNG QUẢN TRỊ & GIÁM SÁT ĐẠO ĐỨC Y SINH        -->
  <!-- ========================================================= -->
  <h1>CHƯƠNG 10: CỔNG QUẢN TRỊ HỆ THỐNG, GIÁM SÁT DỮ LIỆU VÀ ĐẠO ĐỨC Y SINH</h1>

  <p class="no-indent">
    Cổng quản trị trung tâm của NeuroLink được tổ chức thành năm phân hệ nghiệp vụ độc lập, cung cấp công cụ giám sát toàn diện cho ban điều hành và hội đồng y khoa:
  </p>

  <h2>10.1. Phân hệ 1: Thẩm định hồ sơ chứng chỉ hành nghề y tế</h2>
  <p>
    Phân hệ hiển thị danh sách hồ sơ xin cấp tích xanh chuyên gia. Giao diện trực quan hóa kết quả trích xuất văn bản tự động từ tệp chứng chỉ, đánh dấu các điểm bất thường về định dạng hoặc sai lệch tên tuổi, cung cấp nhật ký kiểm toán ghi nhận mọi lần xem tài liệu và hỗ trợ quản trị viên đưa ra quyết định phê duyệt, từ chối hoặc yêu cầu bổ sung bằng chứng.
  </p>

  <div class="figure-container">
    <img src="${images.adminVerif}" class="figure-image" alt="Admin thẩm định chứng chỉ" />
    <div class="figure-caption">Hình 14: Cửa sổ thẩm định bằng cấp và hồ sơ cấp phép hành nghề y tế của ban quản trị.</div>
  </div>

  <h2>10.2. Phân hệ 2: Xét duyệt đóng góp theo biểu mẫu năm tiêu chí</h2>
  <p>
    Hội đồng chuyên môn đọc toàn văn bài viết gốc được liên kết, thao tác trực tiếp trên biểu mẫu chấm điểm năm tiêu chí khoa học, ghi nhận ý kiến nhận xét chuyên môn và nhập mức tín chỉ khen thưởng tương xứng với giá trị học thuật trước khi xác nhận phê duyệt.
  </p>

  <div class="figure-container">
    <img src="${images.adminContrib}" class="figure-image" alt="Admin chấm điểm bài đóng góp" />
    <div class="figure-caption">Hình 15: Biểu mẫu chấm điểm 5 tiêu chí độc lập và quyết định khen thưởng của hội đồng y khoa.</div>
  </div>

  <h2>10.3. Phân hệ 3: Điều hành danh mục quyền lợi và bàn giao phần thưởng</h2>
  <p>
    Cho phép quản trị viên thêm mới các gói quyền lợi, điều chỉnh mức điểm quy đổi, kích hoạt hoặc tạm dừng các danh mục phần thưởng và nhập thông tin bàn giao mã kích hoạt khóa học CME phục vụ thành viên.
  </p>

  <div class="figure-container">
    <img src="${images.adminRewards}" class="figure-image" alt="Admin quản trị phần thưởng" />
    <div class="figure-caption">Hình 16: Phân hệ quản lý danh mục phần thưởng học thuật và xử lý đơn đổi quà.</div>
  </div>

  <h2>10.4. Phân hệ 4: Kiểm toán ví tín chỉ và điều chỉnh kế toán</h2>
  <p>
    Hỗ trợ tra cứu số dư, lịch sử biến động và tổng điểm tích lũy của từng tài khoản thành viên. Trong trường hợp cần bồi hoàn sự cố hoặc điều chỉnh kế toán, phân hệ yêu cầu quản trị viên bắt buộc phải nhập lý do giải trình kiểm toán chi tiết trước khi xác nhận giao dịch.
  </p>

  <div class="figure-container">
    <img src="${images.adminWallets}" class="figure-image" alt="Admin kiểm toán ví tín chỉ" />
    <div class="figure-caption">Hình 17: Công cụ kiểm toán số dư ví tín chỉ và nhật ký điều chỉnh ghi sổ của quản trị viên.</div>
  </div>

  <h2>10.5. Phân hệ 5: Xử lý báo cáo vi phạm và kiểm duyệt nội dung</h2>
  <p>
    Tiếp nhận các phản ánh từ cộng đồng về các bài viết hoặc bình luận có dấu hiệu sai lệch kiến thức y khoa, quảng cáo thương mại không phù hợp hoặc vi phạm nguyên tắc bảo mật dữ liệu người bệnh, cho phép quản trị viên ẩn nội dung hoặc áp dụng chế tài kỷ luật tài khoản vi phạm.
  </p>

  <div class="figure-container">
    <img src="${images.adminReports}" class="figure-image" alt="Admin xử lý báo cáo vi phạm" />
    <div class="figure-caption">Hình 18: Danh mục các báo cáo phản ánh vi phạm tiêu chuẩn cộng đồng cần thẩm tra.</div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================= -->
  <!-- PHỤ LỤC: DỮ LIỆU MẪU & QUY ĐỊNH ỨNG XỬ                    -->
  <!-- ========================================================= -->
  <h1>PHỤ LỤC: DỮ LIỆU THỰC NGHIỆM MẪU VÀ QUY ĐỊNH ỨNG XỬ CỘNG ĐỒNG</h1>

  <h2>1. Bảng tài khoản thực nghiệm phục vụ kiểm thử</h2>
  <p>
    Nhằm hỗ trợ quá trình nghiệm thu chức năng và thẩm định phần mềm, cơ sở dữ liệu hệ thống đã được nạp sẵn dữ liệu thực nghiệm chuẩn hóa cho các vai trò thành viên tiêu biểu:
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 20%;">Vai trò</th>
        <th style="width: 25%;">Tên đăng nhập / Thư điện tử</th>
        <th style="width: 20%;">Mật khẩu mẫu</th>
        <th style="width: 35%;">Đặc điểm dữ liệu khởi tạo</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Ban Quản trị</strong></td>
        <td><code>admin</code><br>admin@neurolink.test</td>
        <td><code>Password123</code></td>
        <td>Tài khoản điều hành toàn quyền, có thể truy cập cổng <code>/admin</code> để duyệt hồ sơ CCHN, chấm điểm bài đóng góp và kiểm toán ví.</td>
      </tr>
      <tr>
        <td><strong>Bác sĩ Thần kinh</strong></td>
        <td><code>dr_minh</code><br>minh.tran@hospital.vn</td>
        <td><code>Password123</code></td>
        <td>Bác sĩ chuyên khoa đã được duyệt tích xanh CCHN, có sẵn 150 tín chỉ trong ví và bài viết lâm sàng để thử nghiệm nộp bài tại <code>/contributions</code>.</td>
      </tr>
      <tr>
        <td><strong>Nhà nghiên cứu BCI</strong></td>
        <td><code>prof_lan</code><br>lan.nguyen@neurotech.edu.vn</td>
        <td><code>Password123</code></td>
        <td>Nhà khoa học đã có chứng nhận tích xanh ORCID, có sẵn 200 tín chỉ trong ví để thử nghiệm đổi gói quyền lợi tại <code>/rewards</code>.</td>
      </tr>
    </tbody>
  </table>

  <h2>2. Bảng đối chiếu đường dẫn chức năng chính</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 30%;">Phân hệ chức năng</th>
        <th style="width: 35%;">Đường dẫn truy cập (URL)</th>
        <th style="width: 35%;">Mục đích nghiệp vụ</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Bảng tin chuyên môn</td>
        <td><code>http://localhost:5173/feed</code></td>
        <td>Theo dõi bài viết học thuật, đăng bài kèm ảnh lát cắt MRI/CT/EEG.</td>
      </tr>
      <tr>
        <td>Khám phá và Danh bạ</td>
        <td><code>http://localhost:5173/search</code></td>
        <td>Tra cứu chuyên gia theo chuyên khoa và tìm bài viết theo chủ đề.</td>
      </tr>
      <tr>
        <td>Hội chẩn riêng tư</td>
        <td><code>http://localhost:5173/messages</code></td>
        <td>Nhắn tin trao đổi ca bệnh và nghiên cứu một đối một bảo mật.</td>
      </tr>
      <tr>
        <td>Cài đặt và Xác minh CCHN</td>
        <td><code>http://localhost:5173/settings</code></td>
        <td>Nộp hồ sơ minh chứng cấp phép hành nghề y tế hoặc liên kết ORCID.</td>
      </tr>
      <tr>
        <td>Trung tâm đóng góp</td>
        <td><code>http://localhost:5173/contributions</code></td>
        <td>Nộp bài viết hiện có để hội đồng đánh giá theo năm tiêu chuẩn y khoa.</td>
      </tr>
      <tr>
        <td>Ví tín chỉ và Đổi thưởng</td>
        <td><code>http://localhost:5173/rewards</code></td>
        <td>Xem số dư khả dụng, tra cứu nhật ký sổ cái và đổi khóa học CME.</td>
      </tr>
      <tr>
        <td>Cổng quản trị trung tâm</td>
        <td><code>http://localhost:5173/admin</code></td>
        <td>Duyệt bằng cấp, chấm điểm bài đóng góp, kiểm toán ví tín chỉ (Admin).</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Quy ước đạo đức và ứng xử chuyên môn</h2>
  <p>
    Mọi thành viên khi tham gia nền tảng NeuroLink đều cam kết tuân thủ các chuẩn mực đạo đức y sinh cơ bản: luôn đặt lợi ích và sự an toàn của người bệnh lên hàng đầu, tôn trọng sự thật khách quan trong các báo cáo nghiên cứu khoa học, giữ gìn tính bảo mật tuyệt đối đối với các dữ liệu bệnh án lâm sàng, và duy trì thái độ giao tiếp tôn trọng, văn minh khi thảo luận và phản biện chuyên môn cùng đồng nghiệp.
  </p>

  <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #cbd5e0; color: #718096; font-size: 9.5pt; font-style: italic;">
    Tài liệu kết thúc tại đây — NeuroLink Team, Bản phát hành tháng 10 năm 2026.
  </div>

</body>
</html>
`;

async function buildPdf() {
  console.log('Writing clean human-styled HTML handbook file...');
  fs.writeFileSync(HTML_FILE, htmlContent, 'utf8');
  console.log('✓ HTML handbook saved to:', HTML_FILE);

  console.log('Launching headless browser to render human handbook PDF in Times New Roman...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  console.log('Exporting PDF with A4 format, Times New Roman, printBackground: true...');
  await page.pdf({
    path: OUTPUT_PDF,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20mm',
      bottom: '22mm',
      left: '20mm',
      right: '20mm',
    },
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="width: 100%; font-size: 9pt; color: #555555; padding: 0 20mm; display: flex; justify-content: space-between; font-family: 'Times New Roman', Times, serif; font-style: italic;">
        <span>NeuroLink — Sổ Tay Vận Hành & Khai Thác Nền Tảng</span>
        <span>Cộng Đồng Tri Thức Y Tế & Não Bộ</span>
      </div>
    `,
    footerTemplate: `
      <div style="width: 100%; font-size: 9.5pt; color: #333333; padding: 0 20mm; display: flex; justify-content: space-between; font-family: 'Times New Roman', Times, serif;">
        <span>Tài liệu lưu hành nội bộ</span>
        <span>Trang <span class="pageNumber"></span></span>
      </div>
    `,
  });

  console.log('✓ Human PDF handbook successfully created at:', OUTPUT_PDF);
  await browser.close();
}

buildPdf().catch((err) => {
  console.error('Failed to generate human PDF:', err);
  process.exit(1);
});
