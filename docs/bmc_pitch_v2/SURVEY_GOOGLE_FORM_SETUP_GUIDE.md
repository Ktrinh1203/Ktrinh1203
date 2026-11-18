# Hướng Dẫn Triển Khai Khảo Sát Thị Trường & Định Giá NeuroLink (5 Phút)

> **Tài liệu hướng dẫn vận hành độc quyền:** Dành cho Ban Dự Án NeuroLink Health  
> **Tệp ứng dụng web khảo sát:** [neurolink_market_survey.html](file:///D:/PRJ_Personal/software_neuronlink_eeg/docs/bmc_pitch_v2/neurolink_market_survey.html)  
> **Cập nhật:** Tháng 11/2026 — Phục vụ Pilot Đợt 1 tại Đà Nẵng & Miền Trung

---

## 1. Triển Khai Web Khảo Sát & Webhook Google Sheets Tự Động (5 Phút)

Ứng dụng web [neurolink_market_survey.html](file:///D:/PRJ_Personal/software_neuronlink_eeg/docs/bmc_pitch_v2/neurolink_market_survey.html) được xây dựng hoàn toàn bằng Single-file HTML5/CSS3/Vanilla JS sạch, không phụ thuộc bundler, tích hợp sẵn thuật toán phân tích Van Westendorp PSM và lưu trữ đa tầng (LocalStorage dự phòng + Google Sheets Webhook).

### Bước 1: Tạo Google Sheets & Dán Mã Google Apps Script (~18 dòng)
1. Mở trình duyệt, truy cập [Google Sheets](https://sheets.new) để tạo một bảng tính mới. Đặt tên: `NeuroLink_Market_Survey_2026`.
2. Tạo hàng tiêu đề (Hàng 1) gồm các cột:
   - `A: ThoiGian`, `B: MaPhieu`, `C: Luong`, `D: DoTuoi_ChuyenKhoa`, `E: DonVi_NoiLamViec`, `F: HoanCanh_ThoiGianRanh`, `G: TienSuBenhNen`, `H: MucDoLoLang`, `I: DanhGiaGiaiPhap_CongCu`, `J: HinhThucSoHuu_MoHinhThuLao`, `K: PSM1_QuaRe`, `L: PSM2_GiaHoi`, `M: PSM3_BatDauDat`, `N: PSM4_QuaDat`, `O: GoiAI_ThuLaoToiThieu`, `P: PhiBacSiDocCa`, `Q: HoTen`, `R: LienHe_SDT_Email`
3. Trên thanh menu Google Sheets, chọn **Tiện ích mở rộng (Extensions)** -> **Apps Script**.
4. Xóa toàn bộ nội dung mặc định và dán đoạn mã Apps Script sau:

```javascript
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    var row = [
      new Date(),
      data.id || "",
      data.stream === "A" ? "Luồng A (Con cái)" : "Luồng B (Bác sĩ)",
      data.age || data.specialty || "",
      data.workplace || data.hospital_type || "",
      data.parent_living || data.spare_time || "",
      (data.health_history || []).join("; "),
      data.anxiety_level || "",
      data.solution_rating || data.tools_rating || "",
      data.ownership_model || data.compensation_model || "",
      data.psm1 || "",
      data.psm2 || "",
      data.psm3 || "",
      data.psm4 || "",
      data.sub_plan || data.reservation_fee || "",
      data.doctor_fee || "",
      data.name || "",
      data.contact || (data.phone ? (data.phone + " / " + (data.email || "")) : "")
    ];
    sheet.appendRow(row);
    return ContentService.createTextOutput(JSON.stringify({ status: "success", id: data.id }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

### Bước 2: Triển Khai Web App (Deploy)
1. Ở góc trên bên phải giao diện Apps Script, bấm nút **Triển khai (Deploy)** -> **Tùy chọn triển khai mới (New deployment)**.
2. Chọn loại: **Ứng dụng web (Web app)**:
   - **Mô tả:** `NeuroLink Survey Webhook v1`
   - **Thực thi dưới dạng (Execute as):** `Tôi (Email của bạn)`
   - **Ai có quyền truy cập (Who has access):** **Bất kỳ ai (Anyone)** *(Quan trọng: để người tham gia khảo sát không cần đăng nhập Google khi gửi form)*.
3. Bấm **Triển khai (Deploy)**, duyệt cấp quyền truy cập tài khoản Google khi được hỏi.
4. Sao chép đường dẫn **URL ứng dụng web** (có dạng `https://script.google.com/macros/s/.../exec`).

### Bước 3: Kết Nối URL Vào Khảo Sát
Có 2 cách kích hoạt cực nhanh:
- **Cách 1 (Trực quan qua giao diện):** Mở tệp `neurolink_market_survey.html` trên trình duyệt -> Bấm nút **"Chế độ Ban Dự Án (Thống kê & Xuất CSV)"** ở góc trên cùng -> Dán URL vừa sao chép vào ô *Cấu Hình Google Sheets Webhook URL* -> Bấm **Lưu Webhook URL**.
- **Cách 2 (Sửa trực tiếp code):** Mở tệp `neurolink_market_survey.html`, gán URL vào biến `let GOOGLE_SCRIPT_WEBHOOK_URL = "URL_VỪA_COPY";` ở đầu khối script.

### Bước 4: Đưa Khảo Sát Lên Internet Miễn Phí Trong 1 Phút
- **Qua Cloudflare Pages / Vercel:** Kéo thả tệp `neurolink_market_survey.html` (đổi tên thành `index.html`) vào trang chủ Cloudflare Pages -> Nhận ngay link `https://neurolink-survey.pages.dev` bảo mật HTTPS tốc độ cao.
- **Qua GitHub Pages:** Tạo repo mới trên GitHub, đẩy tệp `index.html` lên nhánh `main`, bật GitHub Pages trong cài đặt repo -> Nhận link `https://<username>.github.io/<repo>/`.

---

## 2. Bộ Câu Hỏi & Đáp Án Định Dạng Sẵn Copy-Paste 1:1 Vào Google Forms Truyền Thống

Nếu Ban Dự Án muốn đồng thời phát hành link Google Forms ngắn gọn (`forms.gle`), hãy tạo biểu mẫu mới trên [Google Forms](https://forms.new) và thiết lập cấu trúc phân nhánh như sau:

### Cấu Hình Chung Google Forms
- **Tiêu đề biểu mẫu:** KHẢO SÁT NHU CẦU & ĐỊNH GIÁ THIẾT BỊ BẢO VỆ GIẤC NGỦ NEUROLINK HEALTH
- **Mô tả biểu mẫu:**
  > Dự án NeuroLink Health phát triển thiết bị vòng đeo tai BCI êm ái, tự động nhận diện sớm nguy cơ đột quỵ thầm lặng trong giấc ngủ của cha mẹ để báo động và kết nối bác sĩ từ xa.  
  > Thời gian hoàn thành: 4 phút. Tặng ngay voucher ưu đãi 30% suất dùng thử Pilot đầu tiên tại Đà Nẵng.

---

### PHẦN 1: PHÂN NHÁNH ĐỐI TƯỢNG KHẢO SÁT

**Câu 1 (Trắc nghiệm — Bắt buộc):** Bạn tham gia khảo sát với tư cách nào?
- [ ] Con cái / Người đi làm quan tâm đến sức khỏe giấc ngủ của cha mẹ *(Chuyển đến Phần 2)*
- [ ] Bác sĩ / Học viên sau đại học / Nhân viên y tế *(Chuyển đến Phần 3)*

---

### PHẦN 2: DÀNH CHO CON CÁI / NGƯỜI ĐI LÀM (LUỒNG A)

#### Nhóm I. Nhân khẩu học & Hoàn cảnh gia đình
**Câu 2 (Trắc nghiệm — Bắt buộc):** Độ tuổi của bạn:
- [ ] Dưới 22 tuổi
- [ ] 22 – 29 tuổi (Người mới đi làm / Kỹ sư trẻ)
- [ ] 30 – 39 tuổi (Giai đoạn gánh vác chính trong gia đình)
- [ ] 40 – 49 tuổi
- [ ] 50 tuổi trở lên

**Câu 3 (Trắc nghiệm — Bắt buộc):** Nơi làm việc / Khối ngành nghề hiện tại:
- [ ] Khu CNTT & Công nghệ (FPT Complex, KMS, Synopsys, Enclave, Viettel...)
- [ ] Khối Văn phòng, Ngân hàng, Doanh nghiệp tài chính, Cơ quan Nhà nước
- [ ] Kinh doanh tự do / Khởi nghiệp / Freelancer
- [ ] Khác

**Câu 4 (Trắc nghiệm — Bắt buộc):** Hoàn cảnh sinh sống của cha mẹ so với nơi bạn làm việc:
- [ ] Cha mẹ ở quê / khác tỉnh (Con sống và đi làm xa nhà)
- [ ] Ở cùng thành phố nhưng ở nhà riêng (cách nhau một quãng đường)
- [ ] Đang sống chung một nhà cùng cha mẹ

**Câu 5 (Hộp kiểm — Chọn nhiều — Bắt buộc):** Tiền sử sức khỏe của cha mẹ bạn:
- [ ] Tăng huyết áp (Cao huyết áp)
- [ ] Mất ngủ kinh niên / Giấc ngủ chập chờn / Ngủ ngáy to, ngưng thở khi ngủ
- [ ] Rối loạn tuần hoàn não / Thiếu máu não thoáng qua (TIA) / Hay hoa mắt chóng mặt
- [ ] Đái tháo đường (Tiểu đường) / Bệnh lý tim mạch
- [ ] Chưa phát hiện bệnh nền

#### Nhóm II. Nỗi đau & Thiết bị hiện có
**Câu 6 (Thang đo tuyến tính 1–5 — Bắt buộc):** Mức độ lo lắng của bạn về biến cố sức khỏe ban đêm (đột quỵ thầm lặng, tăng huyết áp kịch phát khi ngủ) của cha mẹ khi con ở xa?
- `1`: Rất an tâm
- `5`: Cực kỳ lo lắng, bất an thường trực

**Câu 7 (Hộp kiểm — Chọn nhiều — Bắt buộc):** Lý do khiến các thiết bị hiện nay chưa giải quyết triệt để nỗi lo của bạn?
- [ ] Máy đo huyết áp bắp tay: Chỉ đo lúc thức, không thể tự động bơm đo liên tục lúc ngủ; cha mẹ hay quên đo
- [ ] Đồng hồ thông minh: Cảm biến quang học đo nhịp tim/SpO2 sai lệch nhiều khi ngủ co tay, KHÔNG đo được tín hiệu sóng não phát hiện cơn TIA
- [ ] Thiếu cảnh báo chủ động: Không có cơ chế tự động gọi điện thoại đánh thức con cái khẩn cấp khi phát hiện dấu hiệu nguy hiểm trong đêm
- [ ] Rào cản công nghệ: Thao tác cài đặt rườm rà, phải sạc pin mỗi ngày khiến cha mẹ ngại dùng

#### Nhóm III. Kiểm chứng giải pháp & Hình thức sở hữu
**Câu 8 (Thang đo tuyến tính 1–5 — Bắt buộc):** Bạn đánh giá thế nào về tính năng: Thiết bị tự động học nhịp não cá nhân (Baseline) + Tự động gọi điện đánh thức con cái khi phát hiện sóng não lệch pha ban đêm + Kết nối bác sĩ chuyên khoa đọc ca trong 2 giờ?
- `1`: Không hữu ích
- `5`: Cực kỳ thiết thực & cần thiết

**Câu 9 (Trắc nghiệm — Bắt buộc):** Nếu trang bị thiết bị cho cha mẹ, bạn ưu tiên hình thức sở hữu nào nhất?
- [ ] Mua đứt thiết bị: 2.490.000 VNĐ (Sở hữu trọn đời, bảo hành chính hãng 12 tháng 1 đổi 1)
- [ ] Đặt cọc thuê máy: 990.000 VNĐ + thuê bao tháng (Hoàn trả 100% tiền cọc 990k khi trả máy; đổi máy mới miễn phí khi hỏng hóc)
- [ ] Chưa có nhu cầu sở hữu

#### Nhóm IV. Định giá chuẩn quốc tế Van Westendorp Price Sensitivity Meter (PSM)
*(Ghi chú: Yêu cầu điền số tiền VNĐ trọn bộ phần cứng thiết bị. Thứ tự giá hợp lệ bắt buộc: Câu 10 < Câu 11 < Câu 12 < Câu 13)*

- **Câu 10 (Trả lời ngắn — Bắt buộc):** [PSM1 - Quá rẻ] Ở mức giá nào bạn thấy thiết bị **quá rẻ** đến mức nghi ngờ độ chính xác y sinh & chất lượng linh kiện? *(Nhập số VNĐ, ví dụ: 800000)*
- **Câu 11 (Trả lời ngắn — Bắt buộc):** [PSM2 - Giá hời] Ở mức giá nào bạn thấy thiết bị **hợp lý / là món hời tốt** để sẵn sàng mua tặng bố mẹ ngay? *(Nhập số VNĐ, ví dụ: 1600000)*
- **Câu 12 (Trả lời ngắn — Bắt buộc):** [PSM3 - Bắt đầu đắt] Ở mức giá nào bạn thấy **bắt đầu đắt** nhưng vẫn sẵn sàng chi trả vì sự an toàn của cha mẹ? *(Nhập số VNĐ, ví dụ: 2600000)*
- **Câu 13 (Trả lời ngắn — Bắt buộc):** [PSM4 - Quá đắt] Ở mức giá nào bạn thấy **quá đắt**, vượt khả năng chi trả và chắc chắn từ bỏ không mua? *(Nhập số VNĐ, ví dụ: 3800000)*

#### Nhóm V. Gói dịch vụ thuê bao & Kênh tiếp cận
**Câu 14 (Trắc nghiệm — Bắt buộc):** Gói thuê bao AI phân tích giấc ngủ, học Baseline sóng não & gọi điện đánh thức khẩn cấp ban đêm: Mức phí hàng tháng bạn sẵn sàng chi trả?
- [ ] 59.000 VNĐ / tháng (Gói Tiết kiệm: Cảnh báo tự động qua App)
- [ ] 99.000 VNĐ / tháng (Gói Tiêu chuẩn: AI trực canh 24/7 + Gọi điện thoại đánh thức khẩn cấp con cái + Báo cáo gia đình)
- [ ] 149.000 VNĐ / tháng (Gói Chăm sóc Toàn diện: Kèm hỗ trợ ưu tiên và bảo hiểm thiết bị)

**Câu 15 (Trắc nghiệm — Bắt buộc):** Khi thiết bị phát hiện sóng não bất thường lúc ngủ, gia đình có thể yêu cầu Bác sĩ Nội trú đọc ca và tư vấn từ xa (~15 phút). Mức phí theo lượt nào bạn thấy phù hợp?
- [ ] 150.000 VNĐ / ca hội chẩn
- [ ] 199.000 VNĐ / ca hội chẩn (Đề xuất tiêu chuẩn: Bác sĩ nhận 150k, sàn vận hành 49k)
- [ ] 250.000 VNĐ / ca hội chẩn

**Câu 16 (Hộp kiểm — Chọn tối đa 2 — Bắt buộc):** Kênh tiếp cận nào tạo cho bạn niềm tin cao nhất để quyết định trang bị thiết bị cho cha mẹ?
- [ ] Bác sĩ phòng khám chuyên khoa Nội thần kinh / Tim mạch khuyên dùng
- [ ] Gian hàng đo trải nghiệm trực tiếp & Ưu đãi nội bộ công ty dịp Ngày Phụ huynh / Công đoàn (FPT Complex, KMS...)
- [ ] Trạm đo trải nghiệm tại chuỗi nhà thuốc lớn (Long Châu, Pharmacity, An Khang)
- [ ] Chia sẻ từ Bác sĩ KOL y tế uy tín trên mạng xã hội / Truyền thông chính thống

#### Nhóm VI. Đăng ký nhận ưu đãi Pilot
- **Câu 17 (Hộp kiểm):** [x] Tôi muốn nhận ưu đãi 30% suất dùng thử Pilot đầu tiên tại Đà Nẵng – Miền Trung
- **Câu 18 (Trả lời ngắn):** Họ và tên của bạn (Tùy chọn)
- **Câu 19 (Trả lời ngắn):** Số điện thoại / Zalo hoặc Email nhận thông tin ưu đãi

*(Chuyển đến phần Gửi biểu mẫu)*

---

### PHẦN 3: DÀNH CHO BÁC SĨ & NHÂN VIÊN Y TẾ (LUỒNG B)

**Câu 20 (Trắc nghiệm — Bắt buộc):** Chuyên khoa chính của Quý Bác sĩ / Nhân viên y tế:
- [ ] Bác sĩ Nội thần kinh / Đơn vị Đột quỵ
- [ ] Bác sĩ Nội trú (Thần kinh, Cấp cứu, Đa khoa)
- [ ] Bác sĩ Đa khoa / Lão khoa / Nội tổng quát
- [ ] Bác sĩ Tim mạch / Hồi sức cấp cứu (ICU)
- [ ] Kỹ thuật viên Thần kinh / Thăm dò chức năng (Điện não EEG / PSG)
- [ ] Khác

**Câu 21 (Trắc nghiệm — Bắt buộc):** Đơn vị công tác hiện tại của Quý Bác sĩ:
- [ ] Bệnh viện công lập / Bệnh viện Trường Đại học Y Dược
- [ ] Bệnh viện tư nhân / Bệnh viện đa khoa quốc tế
- [ ] Phòng khám chuyên khoa tư nhân / Phòng mạch ngoài giờ
- [ ] Học viên Sau đại học / Đang đào tạo Bác sĩ Nội trú

**Câu 22 (Trắc nghiệm — Bắt buộc):** Quỹ thời gian rảnh ngoài giờ Quý Bác sĩ có thể nhận đọc ca bất thường từ xa mỗi tuần:
- [ ] Dưới 2 giờ / tuần (~3 – 5 ca bất thường)
- [ ] 2 – 5 giờ / tuần (~8 – 15 ca bất thường)
- [ ] 5 – 10 giờ / tuần (~20 – 30 ca bất thường)
- [ ] Trên 10 giờ / tuần

**Câu 23 (Trắc nghiệm — Bắt buộc):** So sánh 2 mô hình thù lao đọc ca của NeuroLink, Quý Bác sĩ ưu tiên mô hình nào?
- [ ] Theo ca bất thường: Nhận 150.000đ – 200.000đ / ca (Đọc ~15 phút trên bản đồ Topomap 2D/3D đã lọc nhiễu sẵn)
- [ ] Khoán trọn gói theo danh sách: 35.000đ – 40.000đ / bệnh nhân / tháng (Định kỳ rà soát hồ sơ theo danh sách được phân công)

**Câu 24 (Trắc nghiệm — Bắt buộc):** Mức thù lao tối thiểu chấp nhận (Reservation Fee) cho 1 ca hội chẩn định hướng 15 phút:
- [ ] 100.000 VNĐ / ca
- [ ] 150.000 VNĐ / ca (Mức đề xuất tiêu chuẩn)
- [ ] 200.000 VNĐ / ca
- [ ] 250.000 VNĐ+ / ca

**Câu 25 (Thang đo tuyến tính 1–5 — Bắt buộc):** Quý Bác sĩ đánh giá thế nào về tính trực quan và hỗ trợ quyết định lâm sàng của giao diện Web NeuroLink (Bản đồ Topomap 2D/3D + Chỉ số bất đối xứng bán cầu BSI/DAR + Tự động lọc nhiễu vận động + Khóa cảnh báo 115 khi nguy kịch)?
- `1`: Khó dùng / Ít tính thực tiễn
- `5`: Rất trực quan / Hỗ trợ ra quyết định xuất sắc

**Câu 26 (Trả lời ngắn):** Thông tin đăng ký Mạng Lưới Bác Sĩ Cộng Tác Viên Pilot (Họ tên, Đơn vị, SĐT/Zalo, Email):

---

## 3. Chiến Thuật Rải Mẫu Thu 80–100 Phản Hồi Thật Trong 48 Giờ

Để số liệu khảo sát có giá trị thực chứng cao phục vụ bảo vệ hội đồng đầu tư và chốt chiến lược GTM, Ban Dự Án áp dụng chiến thuật **Tập trung hóa cụm đối tượng mục tiêu (Targeted Cluster Seeding)** tại Đà Nẵng:

### Kênh 1: Cụm Kỹ Sư & Cựu Sinh Viên Bách Khoa (DUT Alumni) tại các Khu CNTT Đà Nẵng
- **Mục tiêu:** 60 – 70 phản hồi Luồng A (Con cái đi làm xa).
- **Địa bàn trọng điểm:**
  - FPT Complex Đà Nẵng (Nam Kỳ Khởi Nghĩa, Ngũ Hành Sơn — quy mô ~8.000 kỹ sư).
  - KMS Technology Đà Nẵng (Tòa nhà VNPT / Nguyễn Tri Phương).
  - Synopsys, Enclave, Viettel IDC, Paradox Đà Nẵng.
  - Các hội nhóm Facebook/Zalo: *Cựu sinh viên Bách Khoa Đà Nẵng (DUT Alumni)*, *Cộng đồng CNTT Đà Nẵng (Danang IT Community)*, *FPT Software Danang Off-topic*.
- **Kịch bản đăng bài (Copywriting Template):**
  > **[Khảo sát 3 phút] Giải pháp giám sát giấc ngủ & phòng ngừa đột quỵ đêm cho bố mẹ ở quê — Dự án khởi nghiệp của cựu SV Bách Khoa Đà Nẵng**  
  > Chào anh chị em đồng nghiệp CNTT Đà Nẵng,  
  > Tụi mình là nhóm kỹ sư Bách Khoa đang phát triển **NeuroLink** — thiết bị vòng đeo tai BCI êm ái khi ngủ, tự học sóng não cá nhân của bố mẹ để tự động phát hiện sớm cơn thiếu máu não thoáng qua (TIA) ban đêm và tự động gọi điện đánh thức con cái đi làm xa.  
  > Tụi mình đang tiến hành khảo sát định giá thị trường thực tế (theo chuẩn quốc tế Van Westendorp) để chuẩn bị cho đợt thử nghiệm Pilot đầu tiên tại Đà Nẵng. Rất mong nhận được 3 phút góp ý chân thực từ anh chị em đang đi làm xa nhà:  
  > 🔗 Link khảo sát nhanh: `https://[link-pages-hoặc-forms]`  
  > 🎁 Nhóm xin gửi tặng mã ưu đãi **30%** suất trải nghiệm sớm cho các anh chị em hoàn thành khảo sát. Cảm ơn mọi người rất nhiều!

### Kênh 2: Mạng Lưới Bác Sĩ Trẻ, Bác Sĩ Nội Trú & Kỹ Thuật Viên Thần Kinh Đà Nẵng – Huế
- **Mục tiêu:** 20 – 30 phản hồi Luồng B (Bác sĩ chuyên môn).
- **Địa bàn trọng điểm:**
  - Khoa Đột quỵ & Hồi sức tích cực — Bệnh viện Đà Nẵng.
  - Bệnh viện C Đà Nẵng (Khoa Thăm dò chức năng / Điện não).
  - Bệnh viện Trường Đại học Y Dược Huế & CLB Bác sĩ Nội trú Huế - Đà Nẵng.
  - Chi hội Đột quỵ & Thần kinh miền Trung.
- **Kịch bản tiếp cận 1:1 qua Zalo:**
  > Dạ em chào Bác sĩ [Tên], em là [Tên], kỹ sư phụ trách dự án thiết bị giám sát sóng não NeuroLink tại Đà Nẵng.  
  > Dự án của tụi em đang xây dựng nền tảng Web hỗ trợ đọc ca điện não giấc ngủ từ xa với bản đồ Topomap 2D/3D và chỉ số bất đối xứng bán cầu BSI/DAR tự động lọc nhiễu. Tụi em đang khảo sát ý kiến chuyên môn của các Bác sĩ về mức thù lao đọc ca linh hoạt ngoài giờ (150.000đ – 200.000đ / ca bất thường ~15 phút).  
  > Rất mong Bác sĩ dành 2 phút góp ý giúp tụi em qua link này ạ: `https://[link-pages-hoặc-forms]`. Tụi em xin chân thành cảm ơn Bác sĩ!

---

### Kế Hoạch Theo Dõi & Lọc Dữ Liệu Trong 48 Giờ
- **Khung giờ vàng gửi khảo sát:**
  - Buổi trưa: `11h30 – 12h45` (Giờ nghỉ trưa của kỹ sư và bác sĩ).
  - Buổi tối: `20h00 – 21h30` (Thời điểm người đi làm thư giãn, online mạng xã hội).
- **Cổng kiểm soát chất lượng dữ liệu (Quality Gate):**
  - Loại bỏ các phản hồi vi phạm điều kiện Van Westendorp (`psm1 >= psm2` hoặc `psm2 >= psm3` hoặc `psm3 >= psm4`). Trên web [neurolink_market_survey.html](file:///D:/PRJ_Personal/software_neuronlink_eeg/docs/bmc_pitch_v2/neurolink_market_survey.html), lỗi này đã được khóa tự động và cảnh báo ngay khi nhập.
  - Mở "Chế độ Ban Dự Án" trên web để theo dõi trực tiếp biểu đồ 4 đường cong và các chỉ số OPP, IDP, PMC, PME cập nhật theo thời gian thực.
  - Xuất file `.CSV UTF-8` (kèm BOM chống lỗi font tiếng Việt) để nộp trực tiếp cho Hội đồng Đánh giá / Nhà đầu tư.
