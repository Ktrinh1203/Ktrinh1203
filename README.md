# NeuroLink (`PBL4_Web`) — Nền tảng Y khoa Thần kinh, Trạm qEEG & Hệ sinh thái Dữ liệu Điện não

NeuroLink kết hợp mạng xã hội chuyên môn y khoa, trạm phân tích điện não đồ định lượng (qEEG) tương thích phần cứng TI ADS1299, cơ sở dữ liệu huấn luyện mạng nơ-ron (Neural DB) và bốn trụ cột vận hành sản phẩm cho ba nhóm người dùng:

1. Người dùng phổ thông và cơ sở tuyến dưới theo dõi sức khỏe não bộ, nhận định hướng sàng lọc ngoài giờ từ bác sĩ.
2. Bác sĩ thần kinh, bác sĩ nội trú và nhân viên y tế đã xác minh chứng chỉ hành nghề (CCHN) tham gia đọc ca qEEG từ xa, phản biện ca lâm sàng và tích lũy tín chỉ đào tạo liên tục (CME) / honoraria.
3. Nhà nghiên cứu khoa học thần kinh và kỹ sư giao diện não - máy tính (BCI) có mã ORCID khai thác kho dữ liệu đa trung tâm đã khử định danh và xuất tập đặc trưng 80 chiều.

Chiến lược kinh doanh chi tiết và phân tích rủi ro pháp lý - lâm sàng được ghi nhận tại [docs/STARTUP_STRATEGY_BMC.md](./docs/STARTUP_STRATEGY_BMC.md), mô hình kiến trúc tại [docs/MENTAL_MODEL.md](./docs/MENTAL_MODEL.md), đặc tả hệ thống tại [docs/PROJECT_CONTEXT.md](./docs/PROJECT_CONTEXT.md), và **hướng dẫn phân vùng làm việc cho 4 Team tại [docs/TEAM_GUIDE.md](./docs/TEAM_GUIDE.md)**.

### Bản Đồ Nhanh Cho 4 Team Trong Monorepo

| Phân hệ / Team | Thư mục chính | Mô tả & Điểm vào nhanh |
|---|---|---|
| **Frontend Team** | [`client/`](./client/) | Giao diện Web React 19 + Vite + Tailwind v4 (`npm run dev:client` -> `:5173`) |
| **Backend Team** | [`server/`](./server/) | Cổng API Express 5 + Prisma + PostgreSQL 16 (`npm run dev:server` -> `:4000`) |
| **AI & qEEG Team** | [`qeeg_service/`](./qeeg_service/) | Microservice Python FastAPI qEEG, wPLI & Stroke Ensemble (`:8001`) |
| **IoT Gateway (Node-RED)** | [`node_red/`](./node_red/) | Node-RED v5 Visual IoT Gateway (`:1880`, 4 tab: ESP32 WS `/ws/hardware`, Edge AI Alerts, 4s qEEG Epoch, Simulator) — xem [`node_red/README.md`](./node_red/README.md) |
| **Hardware & Embedded Team** | [`hardware/`](./hardware/) | Firmware C++ `ESP32 + ADS1299 V3.0` Dual-Core, 5 trang TFT, Holter SD, RFC 6455 Wi-Fi WS & `pc_eeg_studio.py` (`921600 bps`) — xem [`hardware/README.md`](./hardware/README.md) |

---

## 1. Khởi động Toàn Hệ thống bằng 1 Lệnh (Unified Mega-Server)

Từ thư mục gốc dự án (`D:\PRJ_Personal\eeg_projects\software_neuronlink_eeg`), chạy lệnh sau hoặc nhấp đúp vào [start.bat](./start.bat) trên Windows:

```powershell
python start_unified_server.py
```

Trình điều phối [start_unified_server.py](./start_unified_server.py) thực hiện tuần tự các bước khởi tạo một cách an toàn:

1. Kiểm tra cổng `5432`: nếu PostgreSQL 16 chưa chạy, tự động khởi chạy `npm run db:start -w server` và chờ cụm dữ liệu sẵn sàng (nếu đã chạy sẵn sẽ tái sử dụng cụm hiện có).
2. Áp dụng migration cơ sở dữ liệu bằng `npx prisma migrate deploy` trong `server/`, đồng thời kiểm tra số lượng bản ghi bảng `User` — nếu cơ sở dữ liệu trống (`0` người dùng), tự động chạy `npm run db:seed -w server`.
3. Khởi chạy dịch vụ Python FastAPI qEEG (`uvicorn app:app --host 127.0.0.1 --port 8001` trong `qeeg_service/`). Nếu môi trường chưa cài `uvicorn`/`fastapi`, trình khởi chạy hiển thị cảnh báo gọn và tiếp tục bình thường nhờ động cơ dự phòng TypeScript DSP (`ts_dsp_fallback`) tích hợp sẵn trong Express.
4. Khởi chạy máy chủ Express API (`npm run dev -w server` trên `:4000`, tích hợp sẵn cổng WebSocket phần cứng trực tiếp `/ws/hardware`) và giao diện Vite React (`npm run dev -w client` trên `:5173`).
5. Khởi chạy **Node-RED v5 IoT Gateway** (`node-red -u node_red -s node_red/settings.js --no-telemetry` trên `:1880`); nếu máy chưa cài `node-red`, trình khởi chạy cảnh báo nhẹ và giữ nguyên luồng WebSocket phần cứng trực tiếp trên `:4000`.
6. Kiểm tra sức khỏe đồng thời `http://127.0.0.1:4000/api/health`, `http://127.0.0.1:4000/api/qeeg/health`, `http://127.0.0.1:1880/gateway/status` (khi Node-RED bật) và `http://127.0.0.1:5173`, sau đó in bảng địa chỉ truy cập cùng danh sách tài khoản demo; nhấn `Ctrl+C` để đóng sạch toàn bộ tiến trình con đã mở.

Để kiểm tra trước môi trường mà chưa bật máy chủ, chạy `python start_unified_server.py --preflight`. Có thể dùng `--no-qeeg` để bỏ qua Python qEEG hoặc `--no-nodered` để tắt cổng Node-RED `:1880`.

### Địa chỉ Truy cập & Tài khoản Demo

Sau khi bảng thông báo sẵn sàng xuất hiện:

| Thành phần | Địa chỉ Truy cập |
|---|---|
| Giao diện chính NeuroLink (Web SPA) | `http://127.0.0.1:5173` |
| Trạm Thiết bị Phần cứng trực tiếp (`Thiết bị`) | `http://127.0.0.1:5173/eeg-hub?tab=device` |
| Trạm qEEG Lâm sàng Chuyên sâu (Proxied) | `http://127.0.0.1:5173/clinical-workstation` |
| Cổng kiểm tra Express API | `http://127.0.0.1:4000/api/health` |
| Cổng WebSocket Phần cứng trực tiếp (RFC 6455) | `ws://127.0.0.1:4000/ws/hardware` |
| Node-RED v5 IoT Visual Gateway | `http://127.0.0.1:1880` (`GET /gateway/status`, WS `/ws/hardware`) |
| Cổng kiểm tra qEEG Gateway (Python / TS Fallback) | `http://127.0.0.1:4000/api/qeeg/health` |
| Dịch vụ Python FastAPI qEEG trực tiếp (khi khả dụng) | `http://127.0.0.1:8001/api/qeeg/health` |

Danh sách tài khoản mẫu khởi tạo sẵn (mật khẩu chung: `Password123`):

| Tên đăng nhập | Vai trò & Trạng thái | Mục đích kiểm thử chính |
|---|---|---|
| `admin` | Ban Quản trị NeuroLink (`ADMIN`) | Duyệt tích xanh CCHN/ORCID, kiểm duyệt báo cáo, thẩm định đóng góp và đổi thưởng |
| `dr_minh` | Bác sĩ CKII Thần kinh (`VERIFIED`) | Chế độ Chuyên gia, nhận ca đọc sóng não từ xa, xác nhận nhãn Neural DB |
| `prof_lan` | PGS. TS. Nghiên cứu BCI (`VERIFIED`) | Niêm yết gói dữ liệu Data Bank, xuất CSV/JSONL Neural DB, đóng góp Research Hub |
| `bs_noitru_khang` | Bác sĩ Nội trú (`VERIFIED`) | Mô hình bác sĩ trẻ trực hàng đợi hỏi đáp Qanda ngoài giờ |
| `hoa_health` | Người dùng Cá nhân (`GENERAL_MODE`) | Nhận 250 tín chỉ khởi đầu, tự theo dõi sức khỏe/lịch làm việc, đặt câu hỏi qEEG |

---

## 2. Kiến trúc 4 Nhóm Lâm sàng, Neural DB & 4 Trụ cột Khởi nghiệp

### Bốn Nhóm Lâm sàng (`ClinicalCategory`) & Trạm qEEG

Trạm điện não đồ định lượng hỗ trợ sáu kịch bản lâm sàng và dữ liệu CSV 6 kênh TI ADS1299 500 Hz (`F3`, `F4`, `C3`, `C4`, `O1`, `O2`) phân loại theo bốn nhóm:

- `VASCULAR_STROKE`: Sàng lọc đột quỵ thiếu máu cục bộ (LVO) và xuất huyết não (ICH) với quy tắc khóa an toàn tuyệt đối `CM[2,1] = 0` (`HOLD tPA / MANDATORY CT`, không gợi ý tiêu sợi huyết đơn độc khi chưa đối chiếu phim CT sọ não).
- `EPILEPSY_ICU`: Theo dõi phức hợp nhọn - sóng chậm kịch phát và phóng điện thùy thái dương.
- `SLEEP_COGNITIVE`: Phân biệt pha ngủ sâu N3 (nhóm giả đột quỵ đối xứng hai bán cầu), chỉ số mệt mỏi nhận thức TAR và nhịp Alpha chẩm.
- `HARDWARE_BCI`: Tín hiệu thực nghiệm từ mạch đo 24-bit TI ADS1299 (`ads1299_500hz_sample.csv`) và bài toán giao diện não - máy tính.

### Cơ sở Dữ liệu Huấn luyện Mạng Nơ-ron (`NeuralTrainingSample`)

Mỗi bản ghi sau khi lọc Butterworth + Notch 50 Hz + CAR và nội suy bản đồ 19 chuyển đạo 10-20 được trích xuất thành vector đặc trưng 80 chiều (`featureVectorJson`) kèm các chỉ số bất biến độ lợi khuếch đại (DAR, TAR, BSI, PRI, wPLI), gán năm nhãn chuẩn (`CONTROL`, `ISCHEMIC_STROKE`, `HEMORRHAGIC_STROKE`, `EPILEPTIFORM_SLOWING`, `COGNITIVE_FATIGUE`) và bốn tập dữ liệu (`TRAIN`, `VALIDATION`, `TEST`, `EXTERNAL_HOLDOUT`). Cổng lưu mẫu bắt buộc xác nhận đã xóa định danh bệnh nhân (`deidentifiedConfirmed === true`) trước khi cho phép chuyên gia tích xanh xác nhận nhãn và xuất thành tệp CSV hoặc JSONL.

### Bốn Trụ cột Vận hành (Startup Pillars)

1. **Personal Assistance (`/consultations`):** Hàng đợi hỏi đáp đọc sóng não từ xa kiểu Qanda có ký quỹ tín chỉ (`CONSULTATION_ESCROW`), tự động bật cảnh báo cấp cứu 115 (`urgentRedFlag = true`) khi phát hiện ngưỡng nguy kịch, giải ngân sang ví bác sĩ (`CONSULTATION_EARNING`) sau khi người gửi nghiệm thu.
2. **Co-creation & Data Bank (`/eeg-hub` tab Kho Dữ liệu):** Chợ trao đổi bộ dữ liệu qEEG có bản xem trước chỉ số tổng hợp, ẩn CSV gốc cho tới khi thanh toán tín chỉ nguyên tử (`DATABANK_PURCHASE` và `DATABANK_ROYALTY`).
3. **Self-Services (`/my-health` & `/eeg-hub`):** Biểu đồ theo dõi sinh lý đa ngày (`HealthCheckIn`), điều phối khối thời gian làm việc theo trạng thái sóng não (`WorkingPlanBlock`: `DEEP_WORK`, `LIGHT_ADMIN`, `NEURO_RECOVERY`, `SLEEP_TARGET`, `CLINICAL_CHECK`) và kiểm soát ủy quyền dữ liệu EEG cho bác sĩ.
4. **Community & Popularity (`/feed` & `/u/:username`):** Bảng tin học thuật lọc theo bốn nhóm bệnh lý cùng bảng xếp hạng chuyên gia tiêu biểu (`/api/community-insights/spotlight`) tính theo đóng góp thực tế, đi kèm nút nhận một lần `+250` tín chỉ khởi đầu (`STARTER_GRANT`) và sổ cái chống rút tiền mặt trực tiếp (`payoutEnabled = false`).

---

## 3. Cấu trúc Thư mục Dự án

```text
software_neuronlink_eeg/
├── start_unified_server.py        # Trình điều phối Mega-Server 1 lệnh (DB + qEEG + Express + Node-RED + Vite)
├── start.bat                      # Điểm khởi chạy nhanh trên Windows
├── package.json                   # Workspace scripts gốc (server & client)
├── node_red/                      # Node-RED v5 Visual IoT Gateway (:1880, 100% core nodes)
│   ├── settings.js                # Cấu hình Node-RED v5 (telemetry tắt, global API/secret)
│   ├── flows.json                 # 4 tab trực quan: ESP32 Gateway, Edge AI Alerts, 4s qEEG Epoch, Simulator
│   └── README.md                  # Hướng dẫn vận hành & kết nối ESP32 qua Node-RED hoặc WS trực tiếp
├── client/                        # React 19 + Vite 8 + TypeScript + Tailwind CSS v4
│   ├── vite.config.ts             # Reverse proxy /api, /uploads, /clinical-workstation, /ws/hardware -> :4000
│   └── src/
│       ├── api/                   # Fetch client (HttpOnly cookie + CSRF), types.ts, endpoints.ts
│       ├── components/            # AppShell Dual-Mode, shared UI primitives, user badges
│       ├── features/eeg/          # BrainWaveformViewer, CorticalTopomap2D, DataBankMarketplacePanel, NeuralDatabasePanel, QeegStudioPanel, PhysiologicalTrendChart
│       └── pages/                 # FeedPage, EEGHubPage, MyHealthPage, ConsultationsPage, ContributionsPage, RewardsPage, ProfilePage, ProfessionalDashboardPage, AdminPage...
├── server/                        # Express 5 + Prisma 6.19 + PostgreSQL 16
│   ├── prisma/                    # schema.prisma, migrations/, seed.ts
│   ├── scripts/pg-daemon.ts       # Embedded PostgreSQL 16 cluster daemon
│   ├── src/modules/               # auth, users, posts, search, messages, notifications, moderation, verification, contributions, rewards, eeg, communities, qeeg, neural-db, consultations, databank, self-service, community-insights
│   └── tests/                     # Bộ kiểm thử tích hợp Vitest + Supertest
├── qeeg_service/                  # FastAPI qEEG microservice (:8001)
│   ├── app.py                     # API phân tích sóng 6->19 kênh, khóa tPA, xuất PDF ReportLab
│   ├── models/ & results/         # Trọng số N=1 và kết quả ngoại kiểm UCLH
│   ├── sample_data/               # Bản ghi mẫu TI ADS1299 500 Hz
│   ├── static/index.html          # Trạm lâm sàng Dual-Mode (/clinical-workstation)
│   └── tests/test_qeeg_service.py # Bộ kiểm thử pytest cho dịch vụ Python qEEG
├── hardware/                      # Phần mềm Nhúng & PC Studio cho thiết bị đo thực tế ESP32 + ADS1299 V1.4
│   ├── firmware/                  # Firmware C++ Dual-Core/Dual-SPI (ADS1299 + TFT ST7735S + 5D Switch + MicroSD)
│   ├── src/                       # PC EEG Studio (thu sóng 921600 bps, lọc DSP, chuyển Holter .BIN -> .CSV, POST runner)
│   ├── tests/                     # Unit tests giao thức nhị phân & lọc số (pytest)
│   └── docs/                      # Báo cáo đo kiểm thực tế trên mạch & bản ghi mẫu CSV 8 kênh
├── scripts/                       # Tiện ích nội bộ & kịch bản hỗ trợ
└── docs/                          # TEAM_GUIDE.md, PROJECT_CONTEXT.md, MENTAL_MODEL.md, STARTUP_STRATEGY_BMC.md, handbook/
```

---

## 4. Công nghệ Sử dụng & Lệnh Kiểm thử

- **Frontend:** React 19, Vite 8, TypeScript 5.9, Tailwind CSS v4, React Router v7, `@tanstack/react-query` v5, Lucide React.
- **Backend Node.js:** Node.js, Express 5, TypeScript 5.9, Prisma ORM 6.19, PostgreSQL 16 (`embedded-postgres`), Zod, Helmet, bcryptjs, Multer.
- **Microservice qEEG Python:** FastAPI, Uvicorn, NumPy, SciPy, Pandas, Joblib, ReportLab.
- **Hardware Firmware & PC Studio:** ESP32 Arduino Core (FreeRTOS Dual-Core, HSPI/VSPI), TI ADS1299 24-bit AFE, Python `pyserial` + `scipy` SOS DSP.

Các lệnh kiểm thử và kiểm tra tĩnh:

```powershell
# Kiểm tra cú pháp launcher Python & cổng tĩnh phần cứng
python -m py_compile start_unified_server.py

# Kiểm thử Python FastAPI qEEG service & phần mềm thiết bị phần cứng
pytest qeeg_service/tests
pytest hardware/tests -v

# Kiểm tra TypeScript, build production và test tích hợp Node/Express (PostgreSQL test DB)
npm run typecheck
npm run build
npm test -w server
```

---

## 5. Danh mục API Chính (Tóm tắt)

- **Auth, Users, Social & Verification:** `/api/auth/*`, `/api/users/*`, `/api/posts/*`, `/api/search`, `/api/conversations/*`, `/api/notifications/*`, `/api/reports`, `/api/verifications/*`, `/api/admin/verifications/*`, `/api/communities/*`, `/api/contributions/*`, `/api/rewards/*` (bao gồm `POST /api/rewards/claim-onboarding-grant`), `/api/admin/rewards/*`, `/api/eeg-datasets/*`.
- **qEEG Proxy & Workstation:** `GET /clinical-workstation`, `GET /api/qeeg/health`, `GET /api/qeeg/cases`, `POST /api/qeeg/analyze-case`, `POST /api/qeeg/analyze-csv`, `GET /api/qeeg/export-pdf-summary`, `POST /api/qeeg/save-to-platform`.
- **Neural Network DB:** `GET /api/neural-db/stats`, `GET /api/neural-db/samples`, `POST /api/neural-db/samples`, `PATCH /api/neural-db/samples/:id/verify`, `GET /api/neural-db/export`.
- **Pillar 1 — Consultations:** `GET /api/consultations`, `POST /api/consultations`, `POST /api/consultations/:id/claim`, `POST /api/consultations/:id/replies`, `POST /api/consultations/:id/accept/:replyId`.
- **Pillar 2 — Data Bank:** `GET /api/databank`, `GET /api/databank/:id`, `POST /api/databank`, `POST /api/databank/:id/purchase`.
- **Pillar 3 — Self-Service:** `GET /api/self-service/overview`, `POST /api/self-service/check-ins`, `POST /api/self-service/work-plan`, `PATCH /api/self-service/work-plan/:id`, `DELETE /api/self-service/work-plan/:id`.
- **Pillar 4 — Community Insights:** `GET /api/community-insights/spotlight`.
- **Hardware IoT, Direct WS & Node-RED Ingestion:** `WS /ws/hardware` (RFC 6455 binary 197B + JSON telemetry), `/api/devices` (`GET`, `POST`, `PATCH /:id`, `DELETE /:id`, `GET /:id/telemetry`, `POST /:id/command`, `POST /:id/simulate`, `POST /:id/alerts/:alertId/ack`, `POST /:id/sessions/capture`), và `/api/devices/ingest/{telemetry,samples,alert,epoch}` (xác thực `x-nodered-secret` hoặc `x-device-key`).
