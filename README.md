# PBL4_Web — Mạng Xã Hội Chuyên Môn Y Tế & Khoa Học Thần Kinh (NeuroLink)

Nền tảng mạng xã hội kết nối ba nhóm người dùng:
1. **Người dùng quan tâm đến sức khỏe & não bộ** (General Users).
2. **Bác sĩ & nhân viên y tế** (Doctors & Healthcare Professionals).
3. **Nhà nghiên cứu, nhà khoa học thần kinh, kỹ sư y sinh & sinh viên** (Researchers, Neuroscientists, Biomedical Engineers, Students).

> [!IMPORTANT]
> **Ranh giới hệ thống độc lập**: Dự án này hoàn toàn độc lập với website lưu trữ dataset EEG hiện có. Hệ thống **không** can thiệp, không sao chép database EEG, không thực hiện pipeline xử lý tín hiệu EEG nặng hay chẩn đoán tự động thay bác sĩ.

---

## 1. Trạng Thái Triển Khai (Acceptance Criteria)

Tất cả các tiêu chí chấp nhận của MVP đã được triển khai và kiểm thử tự động đạt 100%:

| Nhóm chức năng | Tính năng chi tiết | Trạng thái | Kiểm thử tự động |
|---|---|---|---|
| **Xác thực & Bảo mật** | Đăng ký, Đăng nhập, Đăng xuất, Session lưu DB (SHA-256), Cookie `HttpOnly` / `SameSite=Lax`, CSRF Protection, Hash mật khẩu bcrypt, Rate Limiting | Hoàn thành | `tests/auth.test.ts` (14/14 passed) |
| **Hồ sơ cá nhân & Chuyên gia** | Chỉnh sửa tên hiển thị, bio, avatar, tạo hồ sơ Bác sĩ / Nhà nghiên cứu (chuyên khoa, viện nghiên cứu, mối quan tâm), phân quyền duyệt tích xanh | Hoàn thành | `tests/discovery_and_moderation.test.ts` (passed) |
| **Mạng xã hội** | Đăng bài (text + tối đa 4 ảnh), Xem bảng tin cộng đồng / đang theo dõi (phân trang con trỏ Cursor-based), Sửa/Xoá bài (kiểm soát quyền tác giả 403), Thích / Bỏ thích (chặn like trùng), Bình luận / Sửa / Xoá bình luận, Theo dõi / Bỏ theo dõi (chặn follow trùng & chặn tự follow ở mức DB) | Hoàn thành | `tests/social.test.ts` (7/7 passed) |
| **Khám phá & Tìm kiếm** | Tìm kiếm tổng hợp, tìm kiếm bác sĩ & nhà nghiên cứu theo chuyên khoa / từ khoá, tìm kiếm bài viết, tìm kiếm thành viên | Hoàn thành | `tests/discovery_and_moderation.test.ts` (passed) |
| **Tin nhắn riêng tư (Core)** | Tạo/mở hội thoại 1-1 (khoá duy nhất `directKey`), danh sách hội thoại kèm tin nhắn mới nhất và trạng thái chưa đọc, lịch sử tin nhắn phân trang, **kiểm soát thành viên máy chủ bắt buộc (403 nếu không thuộc hội thoại)** | Hoàn thành | `tests/messaging.test.ts` (3/3 passed) |
| **Thông báo** | Thông báo khi có lượt thích, bình luận, người theo dõi mới, tin nhắn mới, kết quả thẩm định đóng góp chuyên môn và cập nhật đổi thưởng; đánh dấu đã đọc; cơ chế de-duplicate key tránh sinh thông báo trùng | Hoàn thành | `tests/discovery_and_moderation.test.ts` (passed) |
| **Kiểm duyệt & Quản trị** | Báo cáo bài viết/người dùng vi phạm; Dashboard Quản trị viên duyệt/từ chối cấp tích xanh chuyên gia; Ẩn / Xoá nội dung vi phạm | Hoàn thành | `tests/discovery_and_moderation.test.ts` (passed) |
| **Đóng góp & Thẩm định Chuyên môn (Contributions)** | Bác sĩ/Nhà nghiên cứu đã xác thực gửi bài viết hiện có để thẩm định nhận thưởng; 5 danh mục đóng góp; State machine 7 trạng thái (`DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `NEEDS_REVISION`, `APPROVED`, `REJECTED`, `WITHDRAWN`); Chặn gửi bài người khác; Chặn gửi trùng; Chặn tự duyệt (Anti-Self-Review 403); Hội đồng chuyên môn chấm điểm theo 5 tiêu chí (Độ chính xác khoa học, Tính phù hợp, Tính hữu ích, Tính nguyên bản, Tác động cộng đồng); Ghi nhận lịch sử thẩm định | Hoàn thành | `tests/contributions_and_rewards.test.ts` (passed) |
| **Ví Tín chỉ & Sổ cái Bất biến (Credit Ledger)** | Ví tín chỉ độc lập; Sổ cái ghi chép append-only (`CreditTransaction`) là nguồn chân lý; Số dư là cached balance derived từ sổ cái; Cấm cập nhật số dư ngoài giao dịch atomic DB; Chặn số dư âm và double-spending; Lịch sử giao dịch minh bạch; Điều chỉnh ví có kiểm toán (Admin Audit Adjustment) | Hoàn thành | `tests/contributions_and_rewards.test.ts` (passed) |
| **Danh mục Đổi thưởng & Bảo vệ Rút tiền mặt (Rewards & Anti-Cash-Drain)** | Đổi quyền lợi chuyên môn (Khóa học CME, Vé hội nghị, Tài liệu học thuật, Mentoring 1:1, Sự kiện); Tự động hoàn tín chỉ (`REFUND`) khi yêu cầu đổi thưởng bị từ chối/hủy; Chặn rút tiền mặt theo mặc định (`payoutEnabled = false`, Anti-Cash-Drain); Không tiền mã hóa, không P2P transfers | Hoàn thành | `tests/contributions_and_rewards.test.ts` (passed) |

---

## 2. Công Nghệ Sử Dụng (Tech Stack)

- **Frontend**: React 19, Vite 8, TypeScript 5.9, Tailwind CSS v4, React Router v7, `@tanstack/react-query` v5, Lucide React.
- **Backend**: Node.js v24 LTS, Express v5, TypeScript 5.9.
- **Database & ORM**: PostgreSQL 16 (chạy unprivileged via `embedded-postgres` portable), Prisma ORM v6.
- **Validation**: Zod (kiểm tra chặt chẽ schema đầu vào API).
- **Security**: HttpOnly sessions, CSRF token header, bcryptjs, Helmet, Express Rate Limit, Multer (giới hạn MIME type & dung lượng ảnh ≤ 5MB).
- **Testing**: Vitest, Supertest, PostgreSQL test database cô lập.

---

## 3. Cấu Trúc Thư Mục

```
PBL4_Web/
├── client/                      # Giao diện Frontend React + Vite
│   ├── src/
│   │   ├── api/                 # Fetch client (tự động đính kèm cookie + CSRF token), endpoints, TypeScript types
│   │   ├── components/
│   │   │   ├── layout/          # AppShell (TopNav desktop, Mobile bottom navigation, UserMenu)
│   │   │   ├── ui/              # Button, Input, Textarea, Card, Avatar, Badge, Spinner, Alert, EmptyState
│   │   │   └── user/            # ProfessionalBadge, FollowButton
│   │   ├── features/
│   │   │   ├── auth/            # AuthContext, AuthProvider, AuthLayout, Route Guards (RequireAuth, GuestOnly, RequireAdmin)
│   │   │   └── feed/            # PostCard, CreatePostCard, CommentSection
│   │   ├── pages/               # LandingPage, LoginPage, RegisterPage, FeedPage, ProfilePage, SettingsPage, SearchPage, MessagesPage, NotificationsPage, AdminPage
│   │   ├── App.tsx              # Router định tuyến
│   │   └── main.tsx             # Root bootstrap & React Query Provider
│   └── vite.config.ts           # Cấu hình Vite & reverse proxy sang :4000
│
└── server/                      # Máy chủ API Node.js + Express
    ├── data/                    # Thư mục cluster cơ sở dữ liệu PostgreSQL 16 (được gitignore)
    ├── prisma/
    │   ├── schema.prisma        # Mô hình dữ liệu quan hệ PostgreSQL
    │   ├── migrations/          # Lịch sử migration phiên bản
    │   └── seed.ts              # Dữ liệu mẫu học thuật và tài khoản demo
    ├── src/
    │   ├── config/              # Đọc và validate biến môi trường (env.ts)
    │   ├── lib/                 # PrismaClient, AppError, Crypto (hashing, random tokens)
    │   ├── middleware/          # Session loader, CSRF guard, Rate limiter, Error handler, Upload media filter
    │   └── modules/
    │       ├── auth/            # Đăng ký, đăng nhập, đổi mật khẩu
    │       ├── users/           # Quản lý hồ sơ, hồ sơ chuyên gia y tế / nghiên cứu
    │       ├── posts/           # Bài viết, hình ảnh, bình luận, lượt thích, theo dõi
    │       ├── search/          # Tìm kiếm phân loại (bác sĩ, người dùng, bài viết)
    │       ├── messages/        # Hội thoại và tin nhắn riêng tư
    │       ├── notifications/   # Quản lý thông báo người dùng
    │       ├── moderation/      # Báo cáo và bảng điều khiển quản trị
    │       ├── contributions/   # Quản lý quy trình đóng góp chuyên môn, nộp bài, state machine
    │       └── rewards/         # Ví tín chỉ, sổ cái bất biến, danh mục phần thưởng & đổi thưởng
    ├── tests/                   # 44 Integration & Unit tests (Vitest + Supertest, 100% passed)
    └── scripts/                 # Daemon quản lý PostgreSQL và tiện ích UTF-8
```

---

## 4. Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### Cách 1: Chạy Tất Cả Bằng 1 Lệnh (Khuyên Dùng)
Tại thư mục gốc dự án:
```powershell
npm run dev
```
*(Hoặc click đúp vào file `start.bat` trên Windows)*
Lệnh này sẽ tự động khởi động đồng thời cả 3 thành phần:
1. `db`: PostgreSQL 16 (cổng `5432`)
2. `api`: Backend Express (cổng `4000`)
3. `ui`: Frontend Vite (cổng `5173`)

Sau khi chạy xong, bạn mở trình duyệt tại: **[`http://localhost:5173`](http://localhost:5173)**

---

### Cách 2: Chạy Từng Thành Phần Riêng Biệt (Nếu Muốn Tách Terminal)
Mở terminal tại thư mục gốc của dự án và chạy:
```powershell
npm run db:start
```
> PostgreSQL 16 sẽ sẵn sàng lắng nghe tại cổng `5432` trên máy của bạn.

### Bước 2: Nạp Dữ Liệu Demo (Seed)
Trong một terminal mới:
```powershell
npm run db:seed
```
Dữ liệu khởi tạo gồm các tài khoản:
- **Quản trị viên**: `admin` / Mật khẩu: `Password123`
- **Bác sĩ Thần kinh**: `dr_minh` / Mật khẩu: `Password123` *(Đã xác minh tích xanh)*
- **Nhà nghiên cứu BCI**: `prof_lan` / Mật khẩu: `Password123` *(Đã xác minh tích xanh)*
- **Sinh viên Kỹ thuật Y sinh**: `tuan_bme` / Mật khẩu: `Password123` *(Đang chờ duyệt)*
- **Người dùng quan tâm sức khỏe**: `hoa_health` / Mật khẩu: `Password123`

### Bước 3: Chạy Backend & Frontend Development Server
Chạy backend:
```powershell
npm run dev:server
```
*(Lắng nghe tại `http://localhost:4000`)*

Chạy frontend:
```powershell
npm run dev:client
```
*(Mở trình duyệt tại `http://localhost:5173`)*

---

## 5. Chạy Kiểm Thử (Automated Tests)

Chạy bộ 28 integration test bao phủ toàn diện các chức năng:
```powershell
npm test
```
Tất cả các bài test chạy trên cơ sở dữ liệu kiểm thử riêng biệt `pbl4_web_test` với dọn dẹp dữ liệu tự động giữa mỗi case test.

Kiểm tra kiểu dữ liệu TypeScript cả hai phía:
```powershell
npm run typecheck
```

Build production:
```powershell
npm run build
```

---

## 6. Danh Mục API Endpoints Chính

| Phương thức | Endpoint | Mô tả | Quyền truy cập |
|---|---|---|---|
| `POST` | `/api/auth/register` | Đăng ký tài khoản mới | Công khai |
| `POST` | `/api/auth/login` | Đăng nhập hệ thống | Công khai |
| `POST` | `/api/auth/logout` | Đăng xuất và huỷ session | Đã đăng nhập |
| `GET` | `/api/auth/me` | Lấy thông tin tài khoản hiện tại | Đã đăng nhập |
| `PATCH` | `/api/users/me` | Cập nhật tên hiển thị, tiểu sử | Đã đăng nhập |
| `POST` | `/api/users/me/professional` | Cập nhật hồ sơ chuyên môn (bác sĩ/nghiên cứu) | Đã đăng nhập |
| `GET` | `/api/users/:idOrUsername` | Xem trang cá nhân người dùng | Công khai |
| `POST` | `/api/users/:id/follow` | Theo dõi một tài khoản | Đã đăng nhập |
| `DELETE` | `/api/users/:id/follow` | Bỏ theo dõi một tài khoản | Đã đăng nhập |
| `GET` | `/api/posts` | Lấy bảng tin cộng đồng / đang theo dõi | Công khai / Người dùng |
| `POST` | `/api/posts` | Đăng bài viết (kèm ảnh qua multipart/form-data) | Đã đăng nhập |
| `PATCH` | `/api/posts/:id` | Sửa bài viết (chỉ chủ sở hữu) | Tác giả bài viết |
| `DELETE` | `/api/posts/:id` | Xoá bài viết (chủ sở hữu hoặc admin) | Tác giả / Admin |
| `POST` | `/api/posts/:id/like` | Thích bài viết | Đã đăng nhập |
| `DELETE` | `/api/posts/:id/like` | Bỏ thích bài viết | Đã đăng nhập |
| `GET` | `/api/posts/:id/comments` | Xem danh sách bình luận | Công khai |
| `POST` | `/api/posts/:id/comments` | Bình luận bài viết | Đã đăng nhập |
| `GET` | `/api/search` | Tìm kiếm người dùng, chuyên gia, bài viết | Công khai |
| `GET` | `/api/conversations` | Lấy danh sách hội thoại nhắn tin | Đã đăng nhập |
| `POST` | `/api/conversations` | Khởi tạo cuộc trò chuyện 1-1 | Đã đăng nhập |
| `GET` | `/api/conversations/:id/messages` | Đọc tin nhắn (kiểm tra thành viên) | Thành viên hội thoại |
| `POST` | `/api/conversations/:id/messages` | Gửi tin nhắn (kiểm tra thành viên) | Thành viên hội thoại |
| `GET` | `/api/notifications` | Lấy danh sách thông báo và số lượng chưa đọc | Đã đăng nhập |
| `PATCH` | `/api/notifications/:id/read` | Đánh dấu thông báo đã đọc | Đã đăng nhập |
| `POST` | `/api/reports` | Gửi báo cáo vi phạm nội dung / tài khoản | Đã đăng nhập |
| `GET` | `/api/admin/verifications` | Danh sách hồ sơ chuyên môn chờ cấp tích xanh | Quản trị viên |
| `PATCH` | `/api/admin/verifications/:id` | Phê duyệt hoặc từ chối xác minh chuyên gia | Quản trị viên |
| `GET` | `/api/admin/reports` | Danh sách báo cáo vi phạm cần xử lý | Quản trị viên |
| `PATCH` | `/api/admin/reports/:id` | Xử lý báo cáo (ẩn/xoá nội dung vi phạm) | Quản trị viên |
| `GET` | `/api/contributions/my` | Lấy danh sách hồ sơ đóng góp của bản thân | Chuyên gia đã xác thực |
| `GET` | `/api/contributions/eligible-posts` | Lấy danh sách bài viết hợp lệ để gửi thẩm định | Chuyên gia đã xác thực |
| `POST` | `/api/contributions` | Gửi bài viết tham gia chương trình đóng góp | Chuyên gia đã xác thực |
| `GET` | `/api/contributions/:id` | Xem chi tiết hồ sơ đóng góp, điểm số & phản hồi | Tác giả / Admin |
| `POST` | `/api/contributions/:id/resubmit` | Nộp lại hồ sơ sau khi chỉnh sửa theo yêu cầu | Tác giả |
| `POST` | `/api/contributions/:id/withdraw` | Rút lại hồ sơ đóng góp | Tác giả |
| `GET` | `/api/rewards/wallet` | Xem thông tin ví và lịch sử sổ cái giao dịch tín chỉ | Người dùng có hồ sơ |
| `GET` | `/api/rewards/catalog` | Danh mục phần thưởng và quyền lợi chuyên môn | Đã đăng nhập |
| `POST` | `/api/rewards/redeem` | Đổi thưởng bằng tín chỉ (kiểm tra số dư, atomic DB) | Đã đăng nhập |
| `GET` | `/api/rewards/my-redemptions` | Xem danh sách yêu cầu đổi thưởng cá nhân | Đã đăng nhập |
| `POST` | `/api/rewards/redemptions/:id/cancel` | Hủy yêu cầu đổi thưởng và hoàn tín chỉ tức thì | Người yêu cầu |
| `GET` | `/api/admin/rewards/contributions` | Hàng đợi thẩm định đóng góp chuyên môn | Quản trị viên / Reviewer |
| `POST` | `/api/admin/rewards/contributions/:id/claim` | Tiếp nhận thẩm định (Claim review) | Quản trị viên (Khác tác giả) |
| `POST` | `/api/admin/rewards/contributions/:id/evaluate` | Đánh giá 5 tiêu chí & ra quyết định (Approve/Reject/Revise) | Quản trị viên (Khác tác giả) |
| `GET` | `/api/admin/rewards/catalog` | Quản lý danh mục phần thưởng toàn hệ thống | Quản trị viên |
| `POST` | `/api/admin/rewards/catalog` | Thêm phần thưởng mới vào danh mục | Quản trị viên |
| `PATCH` | `/api/admin/rewards/catalog/:id` | Bật/tắt hoặc điều chỉnh thông số phần thưởng | Quản trị viên |
| `GET` | `/api/admin/rewards/redemptions` | Danh sách yêu cầu đổi thưởng cần xử lý | Quản trị viên |
| `PATCH` | `/api/admin/rewards/redemptions/:id` | Xử lý yêu cầu đổi thưởng (Approve/Fulfill/Reject & Auto-refund) | Quản trị viên |
| `GET` | `/api/admin/rewards/wallets` | Kiểm toán danh sách ví tín chỉ người dùng | Quản trị viên |
| `POST` | `/api/admin/rewards/wallets/adjust` | Điều chỉnh tín chỉ thủ công kèm lý do kiểm toán bắt buộc | Quản trị viên |
