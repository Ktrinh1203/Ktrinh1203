# NeuroLink — Session Handoff (Unified qEEG, Neural DB & 4-Pillar Startup Architecture)

## 1. Deliverables Completed in This Session (`docs-startup` Slice)

1. **One-Command Mega-Server Orchestrator ([start_unified_server.py](../start_unified_server.py) & [start.bat](../start.bat)):**
   - Checks TCP `127.0.0.1:5432` and reuses an existing PostgreSQL 16 instance or spawns `npm run db:start -w server` and waits for readiness.
   - Runs `npx prisma migrate deploy` in `server/`, queries the `User` count via Prisma (`query_user_count`), and automatically invokes `npm run db:seed -w server` when the database has `0` users.
   - Detects `uvicorn` + `fastapi` across local virtual environments or active Python and launches `uvicorn app:app --host 127.0.0.1 --port 8001` inside `qeeg_service/` (`QEEG_PORT=8001`), emitting a non-fatal warning if unavailable so Express TypeScript DSP fallback serves `/api/qeeg/*` uninterrupted.
   - Launches `npm run dev -w server` (`:4000`) and `npm run dev -w client` (`:5173`), polls `http://127.0.0.1:4000/api/health`, `http://127.0.0.1:4000/api/qeeg/health`, and `http://127.0.0.1:5173`, prints access URLs plus demo accounts (`admin`, `dr_minh`, `prof_lan`, `hoa_health`, `bs_noitru_khang` — `Password123`), and shuts down managed process trees cleanly on `Ctrl+C` (`taskkill /F /T /PID` on Windows).
   - Supports `--preflight` (read-only environment, port, User count, and Python check), `--skip-seed`, and `--no-qeeg`.

2. **Startup Business Strategy & Clinical Risk Architecture ([docs/STARTUP_STRATEGY_BMC.md](./STARTUP_STRATEGY_BMC.md)):**
   - Authored in authentic Vietnamese technical-founder prose compliant with `.agents/rules/human-technical-writing.md`.
   - Maps all four Customer Relationship pillars (Personal Assistance Qanda-style remote overtime triage, Co-creation & Data Bank marketplace, Self-Services EEG & working-plan tracking, and Community academic popularity) into Alexander Osterwalder's 9-block Business Model Canvas, Dual-Sided Flywheel (Mermaid), Hamilton Helmer's 7 Powers (`21/35` Tier 2 assessment anchored on Cornered Resource and Network Economies), Unit Economics levers, Strategyzer 90-day Learning Card thresholds, and explicit clinical/legal risk mitigations (`CM[2,1] = 0` tPA lockout anchored on UCLH N=28 blind validation, PHI de-identification gate, anti-adverse-selection controls, separation of triage guidance vs formal hospital orders, and `payoutEnabled = false` trade-off analysis).

3. **System Documentation Updates ([README.md](../README.md), [docs/PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md), [docs/MENTAL_MODEL.md](./MENTAL_MODEL.md)):**
   - Documented the unified 4-layer stack (`:5173` -> `:4000` -> `:8001` / TS fallback -> `:5432`), four clinical categories (`VASCULAR_STROKE`, `EPILEPSY_ICU`, `SLEEP_COGNITIVE`, `HARDWARE_BCI`), 5-label 80-feature Neural Network DB, four startup pillars, API catalog, and 1-command startup.

---

## 2. Unified Platform Integration State (Across Swarm Slices)

- **Backend & Database (`server/src/**`, `server/prisma/seed.ts`, `server/tests/unified_eeg_and_startup_pillars.test.ts`):**
  - Wired `QEEG_SERVICE_URL`, 2 MB JSON payload limit, `/clinical-workstation` static workstation serving with CSP, and 6 new API routers (`/api/qeeg`, `/api/neural-db`, `/api/consultations`, `/api/databank`, `/api/self-service`, `/api/community-insights`) plus `POST /api/rewards/claim-onboarding-grant`.
  - Seeded `bs_noitru_khang` (verified resident overtime doctor), `STARTER_GRANT` credit ledger entries, 12 `NeuralTrainingSamples` across all 5 labels and 4 clinical categories, 5 `DataBankListings` (free + paid), 4 `ConsultationTickets`, and `HealthCheckIns` / `WorkingPlanBlocks`.
- **Frontend (`client/src/features/eeg/**`, `client/src/features/messages/**`, `client/src/pages/**`, `client/vite.config.ts`):**
  - Proxied `/clinical-workstation` in Vite, created `BrainWaveformViewer.tsx`, `CorticalTopomap2D.tsx`, `DataBankMarketplacePanel.tsx`, `NeuralDatabasePanel.tsx`, `QeegStudioPanel.tsx`, `PhysiologicalTrendChart.tsx`, `eegLabels.ts`, and `ConsultationsPage.tsx`.
  - Added global Floating Messenger Chat Popup (`ChatPopupContext.tsx`, `ChatPopupDock.tsx`) anchored bottom-right across the app (`Tin nhắn`, online doctor `Chat`, profile `Nhắn tin`).
  - Redesigned `AppShell.tsx`, `FeedPage.tsx`, `CreatePostCard.tsx`, `PostCard.tsx`, `EEGHubPage.tsx`, `MyHealthPage.tsx`, `ConsultationsPage.tsx`, `LandingPage.tsx`, `LoginPage.tsx`, `ProfilePage.tsx`, and `MessagesPage.tsx` with clean flat social architecture, authentic `/logo.svg` pulse branding, and NeuroLink Emerald Green (`#16A34A`) primary palette.
- **Python qEEG Microservice (`qeeg_service/`):**
  - Unified `/api/qeeg/*` endpoints, 6 clinical scenarios across 4 categories, 80-feature extraction, ReportLab Vietnamese clinical PDF, Dual-Mode `qeeg_service/static/index.html`, and `qeeg_service/tests/test_qeeg_service.py` (14 pytest cases reported passing in #13).

---

## 3. Verification Evidence

- **Directly Verified by `docs-startup`:**
  - `python -m py_compile start_unified_server.py`: PASS (exit code 0).
  - `python start_unified_server.py --preflight`: PASS (exit code 0; verified `server/.env: True`, `Postgres :5432: OPEN`, `User count` Prisma query working, Python `uvicorn`/`fastapi` detection).
  - `python D:\PRJ_Personal\_tools\deterministic_gate.py D:\PRJ_Personal\eeg_projects\software_neuronlink_eeg\start_unified_server.py`: `GATE STATUS: APPROVED` (exit code 0, AST + Ruff clean).
- **Reported by Sibling Swarm Agents on Shared Board:**
  - `@server-core` (#11): `npm run typecheck -w server` (exit 0), `npm run build -w server` (exit 0), `npm run db:seed -w server` (exit 0), `npm test -w server` — 9/9 test files passed, 56/56 tests passed (50 existing + 6 in `unified_eeg_and_startup_pillars.test.ts`).
  - `@qeeg-engine` (#13): `pytest D:\PRJ_Personal\eeg_projects\software_neuronlink_eeg\qeeg_service\tests -v` — 14 passed in 8.58s (exit 0); `deterministic_gate.py` APPROVED on `app.py` and `test_qeeg_service.py`; Playwright visual check passed across `?mode=professional` and `?mode=general` (1440x900, 768x1024, 375x812).
  - `@client-social-startup` (#7) & `@client-clinical-eeg` (#8): `npm run typecheck -w client` (exit 0) and `npm run build -w client` (exit 0, 2021 modules built).
- **Pending Independent Verifier Check:**
  - Full cross-stack verification (`deterministic_gate.py`, builds, tests, Zero-AI-Slop scan, and 12-screen Playwright E2E audit) assigned to `@verifier` (#14).

---

## 4. Hardware IoT, Node-RED v5 Visual Gateway & Device DB Update (`nodered-gateway` Slice)

- **Embedded Node-RED v5 Gateway ([node_red/settings.js](../node_red/settings.js), [node_red/flows.json](../node_red/flows.json), [node_red/README.md](../node_red/README.md)):**
  - Zero third-party palette dependencies — built strictly from Node-RED v5.0.7 core nodes (`tab`, `websocket-listener`, `websocket in/out`, `http in/response/request`, `function`, `switch`, `inject`, `debug`, `comment`).
  - 4 visual tabs on `http://127.0.0.1:1880`:
    1. `ESP32 Hardware Gateway`: WebSocket `/ws/hardware` decoding 197-byte binary ADS1299 frames (`0xA5 0xC2 0x11 0xD3 [48 float32 LE] 0x5A`) and JSON telemetry heartbeats -> authenticated POST (`x-nodered-secret`) to `:4000/api/devices/ingest/{telemetry,samples}`, plus `POST /device/command` and `GET /gateway/status`.
    2. `Edge AI & Alert Router`: Evaluates `ai_state === 'STROKE_ALERT'`, `0 < vbat_mv < 3450`, and `loff_p > 0` with 30s debounce -> `POST :4000/api/devices/ingest/alert`.
    3. `qEEG Epoch Forwarder`: Buffers rolling 4-second 8-channel epochs (`F3,F4,C3,C4,O1,O2,T3,T4`) -> `POST :4000/api/qeeg/analyze-csv` -> `POST :4000/api/devices/ingest/epoch`.
    4. `ESP32 Test Simulator`: One-click `inject` triggers (`Sim: Normal Sinusoidal EEG`, `Sim: Acute Stroke Alert`, `Sim: Critical Battery 3.38V`) for hardware-free live demos.
- **Launcher & Vite Integration ([start_unified_server.py](../start_unified_server.py), [start.bat](../start.bat), [client/vite.config.ts](../client/vite.config.ts)):**
  - Added `NODERED_DIR`, `NODERED_PORT = 1880`, `--no-nodered`, `find_nodered_cli()`, graceful warning if `node-red` is absent, startup banner & `--preflight` Node-RED status, and clean process-tree shutdown.
  - Proxied `/ws/hardware` (`ws: true`) in `client/vite.config.ts` to Express `:4000` for direct RFC 6455 hardware WebSocket streaming.
  - Documented Node-RED `:1880`, direct RFC 6455 WS `/ws/hardware`, and Device DB endpoints (`HardwareDevice`, `DeviceTelemetryLog`, `DeviceAlert`, `DeviceRecordingSession`) in [README.md](../README.md) and [node_red/README.md](../node_red/README.md).

---

## 5. Standalone Mobile App (`5174`), Web Optimization & Secondary Pages Audit (Nov 2026)

- **Live Runtime Topology:**
  - Express API Gateway: `http://localhost:4000/api/health` (`200 OK`)
  - Desktop/Responsive Web SPA: `http://localhost:5173` (`200 OK`, built with route-level `React.lazy` + `Suspense` code splitting in `client/src/App.tsx`; main entry chunk `320.84 kB` / gzip `98.30 kB`)
  - Standalone Mobile SPA: `http://localhost:5174` (`200 OK`, workspace `mobile/`, launched via `start_mobile.bat` or `npm run dev:mobile`; main entry chunk `274.95 kB` / gzip `85.50 kB`)
- **UI/UX & Copy Hardening:**
  - **Sliding Pill Dock Toolbar (`mobile/src/components/MobileShell.tsx`):** Spring-eased sliding indicator with pointer scrub, preloaded dock tabs (`mobile/src/routePreloaders.ts`), and verification script `mobile/verify_toolbar_motion.mjs`.
  - **Mobile 375px & Story Bubbles (`mobile/verify_mobile.mjs`):** Verified 375×812 header layout and unclipped story avatar rings across General & Professional modes.
  - **Vietnamese Copy & Jargon Removal:** Replaced exposed technical/backend jargon (`HMAC`, `chuỗi băm`, `ts_dsp_fallback`, `RESEARCH_CONTRIBUTION`, `Sandbox`, `P2P`, `PHI`) across `client/src/` and `mobile/src/` with plain Vietnamese user-facing labels.
  - **Secondary Pages Fix & Verification:** Inspected `/login`, `/register`, `/search`, `/notifications`, `/u/:username`, and `/settings?tab=verify` for `hoa_health` and `dr_minh` at `375×812` and `1440×900` (Web & Mobile). Fixed duplicate native `×` search clear button in [mobile/src/pages/SearchPage.tsx](../mobile/src/pages/SearchPage.tsx) (`type="text"` + `inputMode="search"`). Zero horizontal overflow (`scrollWidth <= clientWidth`), zero console/page errors, zero HTTP `>= 400` responses, and `typecheck` / `typecheck:mobile` / `build -w client` / `build -w mobile` all exited `0`.

---

## 6. Brand Landing Page Song Ngữ (`VI | EN`)

- **Bilingual Brand Landing Page ([client/src/pages/LandingPage.tsx](../client/src/pages/LandingPage.tsx), [client/src/pages/landingContent.ts](../client/src/pages/landingContent.ts)):**
  - Hỗ trợ chuyển đổi song ngữ `VI | EN` qua query parameter (`?lang=vi` / `?lang=en`) và lưu tùy chọn vào `localStorage` (`neurolink_landing_lang`), kèm `RevealBlock` tôn trọng `prefers-reduced-motion` và sơ đồ kiến trúc `EcosystemDiagram`.
- **Real Product Visuals (`client/public/landing/`, 11 ảnh PNG):**
  - Nhúng 11 ảnh chụp màn hình sản phẩm thực tế (`desktop-feed.png`, `desktop-qeeg-stable.png`, `desktop-qeeg-stroke.png`, `desktop-consultations.png`, `desktop-myhealth.png`, `desktop-pro-dashboard.png`, `desktop-doctor-profile.png`, `mobile-feed.png`, `mobile-qeeg.png`, `mobile-consult.png`, `mobile-topomap.png`).
- **Build & Live `dev:all` Runtime Verification:**
  - Production chunk của `LandingPage`: `44.80 kB` (`12.62 kB` gzip).
  - Xác nhận runtime `npm run dev:all` hoạt động trên 4 cổng: PostgreSQL TCP `127.0.0.1:5432` (`True`), Express API `http://127.0.0.1:4000/api/health` (`200`, `{"status":"ok"}`), Desktop/Web SPA `http://127.0.0.1:5173/` (`200`), và Standalone Mobile SPA `http://127.0.0.1:5174/` (`200`).
  - Playwright check trên `http://localhost:5173/?lang=vi`, `http://localhost:5173/?lang=en` (`1440×900`) và `http://localhost:5174/` (`375×812`): `0` page errors, `0` failed requests, `scrollWidth === clientWidth` (`1440` / `375`), ảnh hero hiển thị `naturalWidth > 0` (`desktop-feed.png`: `2880×1800`, `mobile-qeeg.png`: `750×1624`).

---

## 7. Visual Storytelling Landing Page Redesign & Launcher Resilience (Nov 2026)

- **Visual Storytelling Landing Page ([client/src/pages/LandingPage.tsx](../client/src/pages/LandingPage.tsx), [client/src/pages/landingContent.ts](../client/src/pages/landingContent.ts)):**
  - Tái thiết kế Landing Page theo cấu trúc kể chuyện trực quan song ngữ (`EN | VI`), giữ 7 ảnh story biên tập (`client/public/landing/story/*.jpg`) kết hợp các ảnh chụp sản phẩm thực tế (`client/public/landing/*.png`) và khu vực `Experience` tương tác theo tab (`brainwave`, `guidance`, `community`).
  - Hỗ trợ `prefers-reduced-motion`, skip-to-content, điều hướng desktop/mobile drawer, và lưu ngôn ngữ qua `?lang=` + `localStorage` (`neurolink_landing_lang`).
- **Launcher & Embedded Postgres Resilience ([start.bat](../start.bat), [start_mobile.bat](../start_mobile.bat), [server/scripts/pg-daemon.ts](../server/scripts/pg-daemon.ts)):**
  - `start.bat`: Kiểm tra sẵn các cổng `:4000`, `:5173`, `:5174` ở chế độ Node.js fallback để tránh khởi chạy chồng chéo khi dịch vụ đang chạy, đồng thời bổ sung `--preflight` kiểm tra trạng thái cổng và `server/.env`.
  - `start_mobile.bat`: Tự động nhận diện Mobile `:5174` hoặc API `:4000` đang chạy sẵn để mở thẳng trình duyệt hoặc chỉ bật `npm run dev:mobile` thay vì khởi động lại toàn bộ stack.
  - `server/scripts/pg-daemon.ts`: Kiểm tra TCP `127.0.0.1:5432` / `::1:5432` trước khi `initialise()`/`start()` để tái sử dụng PostgreSQL đang mở an toàn và xử lý shutdown idempotent.
