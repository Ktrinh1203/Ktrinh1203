---
name: NeuroLink
description: Hybrid Professional Healthcare & Neuroscience Community Design System
colors:
  brand-50: "#f0f4f8"
  brand-100: "#e2e8f0"
  brand-200: "#cbd5e1"
  brand-300: "#94a3b8"
  brand-400: "#64748b"
  brand-500: "#3b5984"
  brand-600: "#2b4c7e"
  brand-700: "#1e3a5f"
  brand-800: "#162b47"
  brand-900: "#0f1e32"
  accent-50: "#f0f7f6"
  accent-100: "#d9ece9"
  accent-200: "#b6dcd7"
  accent-300: "#88c4bc"
  accent-400: "#5aa39a"
  accent-500: "#3a7d79"
  accent-600: "#2c6865"
  accent-700: "#214f4d"
  surface-bg: "#f4f6f8"
  surface-card: "#ffffff"
  heading-text: "#1e293b"
  body-text: "#334155"
  muted-text: "#64748b"
  subtle-text: "#94a3b8"
  border-subtle: "#e2e8f0"
  border-card: "#e2e8f0"
  status-verified: "#2c6865"
  status-gold: "#d97706"
typography:
  font-primary: "Plus Jakarta Sans, Inter, -apple-system, sans-serif"
  font-sans: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
  heading-xl:
    fontFamily: "{typography.font-primary}"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  heading-lg:
    fontFamily: "{typography.font-primary}"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  heading-md:
    fontFamily: "{typography.font-primary}"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title-logo:
    fontFamily: "{typography.font-primary}"
    fontSize: "17px"
    fontWeight: 800
    lineHeight: 1.1
  body-base:
    fontFamily: "{typography.font-primary}"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  body-feed:
    fontFamily: "{typography.font-primary}"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  caption:
    fontFamily: "{typography.font-primary}"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
  caption-md:
    fontFamily: "{typography.font-primary}"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.4
  caption-sm:
    fontFamily: "{typography.font-primary}"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.3
  micro-badge:
    fontFamily: "{typography.font-primary}"
    fontSize: "9px"
    fontWeight: 700
    lineHeight: 1
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  card: "12px"
  chat-bubble: "12px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.brand-600}"
    textColor: "{colors.surface-card}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.brand-700}"
  button-dark:
    backgroundColor: "{colors.heading-text}"
    textColor: "{colors.surface-card}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.brand-50}"
    textColor: "{colors.brand-800}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
    height: "40px"
  card-base:
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.card}"
    padding: "20px"
---

# Design System

<!-- google-stitch:design-md 1 -->

## Overview

Hệ thống thiết kế của **NeuroLink** được xây dựng dựa trên triết lý nhân văn và thấu cảm từ nguyên mẫu **MindBridge (Phenomenon Studio)**. Nền tảng hướng đến nhóm người dùng đặc thù là các Bác sĩ Thần kinh lâm sàng và Nhà nghiên cứu Khoa học Não bộ (BCI), nơi tính chính xác học thuật cần phải song hành cùng sự thư thái thị giác, triệt tiêu cảm giác căng thẳng (cognitive fatigue) khi tiếp cận các ca bệnh phức tạp.

Không gian thị giác của NeuroLink đặc trưng bởi:
- Bề mặt canvas dịu mát (`#F4F7F9` và gradient khí quyển nhẹ).
- Thẻ thông tin nổi với bán kính bo cong lớn (`rounded-[24px]` / `24px`).
- Nút bấm, thanh tìm kiếm, nhãn phân loại dạng viên thuốc mềm mại (`rounded-full` pills).
- Nhận diện thương hiệu đặc trưng: Squircle teal với nhịp sóng tim/não ECG màu trắng và chấm phát sáng xanh ngọc (`emerald-400`).

---

## Colors

### 1. Forest & Sage Teal (Brand Primary)
Tông màu xanh ngọc rừng già và xô thơm mang tính biểu tượng y khoa, đại diện cho tri thức thần kinh học, sự điềm tĩnh và độ tin cậy tuyệt đối:
- `brand-50` (`#F0F7F5`): Nền nhạt cho thẻ trạng thái, tab kích hoạt, badge y tế.
- `brand-100` (`#DCF0EA`): Viền nhạt, hiệu ứng hover nhẹ, nền topic y khoa.
- `brand-500` (`#2A9883`): Trọng tâm tương tác, đường viền focus cho input.
- `brand-600` (`#177D69`): Màu thương hiệu chính, nút kêu gọi hành động (CTA), logo.
- `brand-700` (`#136354`) & `brand-800` (`#115044`): Chữ tiêu đề trên nền nhạt, banner organic tối màu.

### 2. Calming Sky Blue & Cyan (Secondary / Action Accent)
Tông màu xanh trời nhẹ nhàng mang lại cảm giác giải phóng nhận thức, sử dụng cho hệ thống tin nhắn và các tương tác nhanh:
- `accent-50` (`#F0F8FF`) / `accent-100` (`#E0F2FE`): Bong bóng tin nhắn gửi đi (Sent Chat Bubble), thông báo nhẹ.
- `accent-400` (`#38BDF8`) / `accent-600` (`#0284C7`): Huy hiệu đếm số lượng tin nhắn mới, tag nghiên cứu BCI.

### 3. Neutral Canvas & Surface
- `surface-bg` (`#F4F7F9`): Nền trang chủ toàn diện, thay thế màu trắng gắt hay xám lạnh.
- `surface-card` (`#FFFFFF`): Màu trắng tinh khiết tạo sự tương phản nổi trên nền canvas.
- `heading-text` (`#0F172A`): Màu xanh đen sẫm sâu sắc, tương phản cao và rõ ràng cho tiêu đề.
- `body-text` (`#334155`): Màu xám đen dịu mắt cho các đoạn văn bản dài, ca lâm sàng.
- `muted-text` (`#64748B`): Màu chú thích, ngày tháng, đếm ký tự.

---

## Typography

Sử dụng hệ phông **Plus Jakarta Sans** kết hợp cùng **Inter** cho trải nghiệm đọc tối ưu trên các tài liệu y tế:
- **Tiêu đề (Headings):** Font weight `700` hoặc `800`, letter-spacing `-0.015em` đến `-0.02em` tạo cảm giác chắc chắn, chuyên nghiệp và thân thiện.
- **Văn bản nội dung (Body):** Font weight `400` hoặc `500`, line-height `1.6`, font-size `14px - 15px` đảm bảo người dùng đọc các bài phân tích tín hiệu não hay ca bệnh kéo dài không bị mỏi mắt.
- **Huy hiệu & Chú thích (Pills & Captions):** Font weight `600`, kích thước `10px - 12px`, uppercase nhẹ với tracking vừa phải.

---

## Layout

Áp dụng bố cục 3 cột kinh điển cho mạng xã hội chuyên môn (Golden Ratio 3-Column Layout):
- **Cột Trái (Left Sidebar - 250px đến 270px):** Thẻ tóm tắt danh tính chuyên gia, Menu điều hướng nghiệp vụ (Bảng tin, Đóng góp, Ví tín chỉ, Danh bạ chuyên gia, Tin nhắn) và danh sách Chủ đề lâm sàng tiêu biểu.
- **Cột Giữa (Center Column - 1fr, max 680px - 720px):** Khung soạn thảo ca bệnh lâm sàng, bộ chuyển đổi bảng tin dạng capsule toggle, dòng bài viết vô tận (Infinite Scroll).
- **Cột Phải (Right Sidebar - 310px):** Thẻ Bác sĩ & Chuyên gia đề xuất tự động, Thẻ cảnh báo quy chuẩn & trách nhiệm y khoa, thông tin bản quyền.

---

## Elevation & Depth

Triết lý đổ bóng của MindBridge là **"Khuếch tán tự nhiên (Soft Ambient Diffusion)"**, hoàn toàn tránh các bóng đổ đen kịt hay cứng nhắc:
- **Card Default Shadow:** `box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.03)` kết hợp viền mờ `border: 1px solid rgba(226, 232, 240, 0.7)`.
- **Card Hover Shadow:** `box-shadow: 0 8px 30px -4px rgba(15, 23, 42, 0.06)` tạo cảm giác bề mặt nhấc nhẹ khi rê chuột.
- **Banner Organic Depth:** Sử dụng gradient đa điểm (`from-[#177D69] via-[#136354] to-[#0F2942]`) kết hợp các đốm sáng mờ ảo (`blur-2xl`) ở các góc tạo chiều sâu thị giác sang trọng.

---

## Shapes

- **Card Radius:** Bắt buộc sử dụng `rounded-[24px]` (24px) cho toàn bộ các khối nội dung, khung chat, danh thiếp chuyên gia.
- **Button & Tag Radius:** Bắt buộc sử dụng `rounded-full` (pill shape) cho tất cả nút bấm, thanh input tìm kiếm, bộ lọc tab và chip chuyên khoa.
- **Avatar:** Hình tròn tuyệt đối `rounded-full` kèm viền trắng nổi (`ring-2 ring-white` hoặc `ring-4 ring-white`) khi đặt trên nền gradient.

---

## Components

### 1. Nút Bấm (Buttons)
- **Primary Pill:** Nền `bg-brand-600` chữ trắng, đổ bóng xanh `shadow-[0_2px_12px_rgba(23,125,105,0.22)]`, hover chuyển `bg-brand-700`.
- **Secondary Pill:** Nền `bg-brand-50` viền `border-brand-200/60` chữ `text-brand-800`, hover chuyển `bg-brand-100`.
- **Outline Pill:** Nền trắng viền `border-slate-200` chữ `text-slate-700`, hover chuyển `bg-slate-50`.

### 2. Bộ Chuyển Đổi Bảng Tin (Feed Switcher Capsule)
- Vỏ bọc hình viên thuốc dài nền `bg-slate-200/50 p-1.5`.
- Tab đang kích hoạt là một viên thuốc trắng nổi `bg-white text-slate-900 shadow-xs border border-slate-200/60 font-semibold`.

### 3. Bong Bóng Trò Chuyện (Chat Bubbles)
- **Tin nhắn gửi đi (Sender):** Bo góc `rounded-2xl rounded-tr-xs`, nền xanh dịu `bg-[#E8F4FC]` viền `border-[#CCE5F7]`, chữ xanh đen `#0F2942`.
- **Tin nhắn nhận về (Receiver):** Bo góc `rounded-2xl rounded-tl-xs`, nền trắng tinh khiết `bg-white` viền `border-slate-200/80`, chữ `text-slate-800`.

### 4. Thẻ Đề Xuất Chuyên Gia (Doctor Card)
- Bo góc `rounded-[24px]`, hiển thị ảnh đại diện, huy hiệu tích xanh xác minh, chức danh, bệnh viện công tác, các chip nghiên cứu bo tròn và 2 nút hành động: *Xem hồ sơ* (outline pill) và *Nhắn tin* (secondary pill).

---

## Do's and Don'ts

### ✅ Do's:
1. Luôn sử dụng hình dạng viên thuốc (`rounded-full`) cho các nút bấm, ô tìm kiếm và chip bộ lọc.
2. Giữ khoảng thở rộng rãi (Spacious Breathing Room) giữa các phần tử để bác sĩ và nhà nghiên cứu dễ tiếp thu thông tin.
3. Sử dụng tone xanh trời nhạt `#E8F4FC` cho các tương tác nổi bật hoặc tin nhắn của người dùng.
4. Tôn trọng huy hiệu xác minh: Chỉ hiển thị tích xanh khi hồ sơ được Hội đồng Quản trị duyệt thực tế.

### ❌ Don'ts:
1. **Tuyệt đối không sử dụng nút bấm góc vuông hoặc bo góc nhỏ kiểu desktop truyền thống (`rounded-md` hay `rounded-none`).**
2. Không sử dụng bóng đổ quá đậm (như `shadow-2xl` màu đen sẫm) gây cảm giác đè nặng thị giác.
3. Không sử dụng các màu cảnh báo đỏ/vàng rực rỡ một cách vô tội vạ; chỉ dùng màu cam/đỏ nhạt cho các thông báo y tế bắt buộc.
4. Không nhồi nhét chữ quá đặc trong các thẻ tóm tắt ca bệnh.
