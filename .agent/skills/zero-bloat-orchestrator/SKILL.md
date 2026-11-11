---
name: zero-bloat-orchestrator
description: Use when executing any software, data, or research task to achieve >90% token savings on the main thread (Gemini 4 Argon / High-tier models) by delegating 100% of execution to Gemini 3.8 Flash subagents (TypeName "self", Model "flash") and returning compact verification reports.
---

# Zero-Bloat Subagent Orchestrator (Cơ Chế Hoạt Động Giảm >90% Token Luồng Chính)

## 1. Nguyên Lý Tiết Kiệm >90% Token Ở Luồng Chính (Zero-Bloat Main Thread)

- **Bản chất kỹ thuật trên Antigravity**: Khi người dùng chọn model cao cấp (như Gemini 4 Argon, Claude 3.5 Sonnet, Gemini 3.8 Flash High/Pro), mọi nội dung xuất hiện ở luồng chat chính (đọc file dài, xả log chạy lệnh terminal, viết code/script dài) sẽ bị cộng dồn vĩnh viễn vào bộ nhớ ngữ cảnh (Context Window) của model chính qua từng lượt chat.
- **Ràng buộc thép (Strict Invariant)**: **CẤM** model luồng chính trực tiếp đọc file dài, xả log terminal hoặc tự viết code/script dài.
- **Phân định vai trò**:
  - **Luồng chính (Main Thread)**: Giữ vai trò duy nhất là **Kiến trúc sư & Điều phối viên (Architect & Orchestrator)**. Chỉ lập kế hoạch, phân rã công việc, triệu hồi subagents, tổng hợp kết quả nghiệm thu và giao tiếp với User.
  - **Luồng phụ (Subagents)**: Xử lý 100% các công việc thực thi nặng nhẹ.

---

## 2. Đẩy 100% Việc Nặng Nhẹ Sang Gemini 3.8 Flash (`Model: "flash"`)

Toàn bộ quá trình thao tác công cụ (`read_file`, `write_file`, `edit_file`, `run_command`) được giao hoàn toàn cho Subagent sử dụng model `flash`.

### A. Với Tác Vụ Nhẹ / Vừa / Đơn Luồng (Single-Thread / Focused Task)
- Luồng chính không tự đọc file hay gõ lệnh.
- Lập tức gọi **1 Subagent** (`invoke_subagent` với `TypeName: "self"`, `Model: "flash"`) để xử lý trọn gói:
  1. Khảo sát codebase và đọc tài liệu.
  2. Tạo/chỉnh sửa file mã nguồn.
  3. Chạy lệnh terminal, unit test, linter.
  4. Tự sửa lỗi và nghiệm thu kết quả.

### B. Với Tác Vụ Nặng / Đa Hạng Mục (Complex / Multi-Module Task)
- Luồng chính lập **Master Plan ngắn gọn** (tối đa 5-7 gạch đầu dòng chiến lược).
- Chia thành **2 đến 4 nhánh công việc độc lập** (tối đa 4 nhánh để đảm bảo hiệu suất).
- Kích hoạt **đồng thời 2–4 Subagents** (`TypeName: "self"`, `Model: "flash"`) chạy song song trong cùng một lượt gọi công cụ.

```json
// Ví dụ kích hoạt song song 2 Subagents Flash trong cùng 1 lượt
[
  {
    "tool": "invoke_subagent",
    "parameters": {
      "TypeName": "self",
      "Model": "flash",
      "Role": "Backend API Implementer",
      "Prompt": "Triển khai REST API endpoint cho module Auth tại src/api/auth.py và viết test tại tests/test_auth.py. Chạy pytest xác minh exit code 0. Khi hoàn thành, chỉ gửi bản tóm tắt kết quả 3 dòng và danh sách file đã tạo."
    }
  },
  {
    "tool": "invoke_subagent",
    "parameters": {
      "TypeName": "self",
      "Model": "flash",
      "Role": "Frontend UI Implementer",
      "Prompt": "Thiết kế giao diện đăng nhập tại src/components/Login.vue theo chuẩn Tailwind CSS. Kiểm tra build frontend không lỗi. Khi hoàn thành, chỉ gửi bản tóm tắt kết quả 3 dòng và danh sách file."
    }
  }
]
```

---

## 3. Giao Thức Báo Cáo Ngược Tinh Gọn (Compact Return Protocol)

- **Vùng nhớ cô lập**: Toàn bộ quá trình đọc hàng nghìn dòng code, bóc tách Excel/AutoCAD, chạy script và debug thử-sai đều diễn ra trong vùng nhớ riêng của Gemini 3.8 Flash (tiêu thụ 100% token Flash rẻ và nhẹ).
- **Quy cách trả lời của Subagent về Luồng Chính**:
  Subagent `flash` **TUYỆT ĐỐI KHÔNG** paste lại toàn bộ nội dung file hay xả log terminal dài hàng trăm dòng. Subagent chỉ gửi về:
  1. **Bản tóm tắt kết quả (Summary)**: 3 đến 5 gạch đầu dòng về những gì đã làm và kết quả.
  2. **Số liệu đã xác thực (Verified Metrics)**: Test pass rate, exit codes, benchmark metrics, số dòng thay đổi.
  3. **Đường dẫn file thành phẩm**: Clickable file links dạng `[filename](file:///absolute/path/to/file)`.

---

## 4. Bảng So Sánh Cơ Chế Hoạt Động

| Tiêu chí | Cơ chế Cũ (Anti-Pattern) | Cơ chế Zero-Bloat (Mới - Chuẩn) |
| :--- | :--- | :--- |
| **Đọc file dài (>50 dòng)** | Main thread gọi `read_file` trực tiếp | Giao Subagent Flash đọc, phân tích và trích xuất |
| **Xử lý mã nguồn / Viết script** | Main thread tự code, token phình to | Subagent Flash code, test và hoàn thiện |
| **Chạy Terminal & Debug** | Log terminal xả thẳng vào Main thread | Subagent Flash chạy terminal, chỉ báo exit code & kết quả |
| **Tiêu thụ Token Main Thread** | Nhanh chóng chạm trần 100k-500k tokens | Giảm >90%, Main thread luôn siêu nhẹ (<20k-50k tokens) |
| **Tốc độ phản hồi** | Chậm dần theo độ dài phiên (Lost-in-the-Middle) | Siêu tốc, giữ 100% độ sắc bén của kiến trúc sư |

---

## 5. Quy Trình Phối Hợp Với Cổng Phản Biện (Adversarial Review Gate)

Khi Subagent Flash hoàn tất công việc:
1. Luồng chính tiếp nhận báo cáo ngắn gọn.
2. Trước khi bàn giao kết quả cho User: Luồng chính triệu hồi Subagent kiểm toán độc lập theo skill `adversarial-review-gate` (`Model: "flash"`, `Role: "Ruthless Adversarial Reviewer & Anti-Hallucination Auditor"`).
3. Sau khi nhận phán quyết `🟢 [GATE_STATUS: APPROVED]`, Luồng chính tổng hợp phản hồi tinh gọn, sắc sảo kèm bằng chứng thực chứng gửi cho User.
