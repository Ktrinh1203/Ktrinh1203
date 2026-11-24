# NeuroLink — Project Context & Unified System Architecture

## Overview
- **Project:** NeuroLink (`PBL4_Web` Unified Platform)
- **Domain:** Healthcare & Neuroscience Social Network, Quantitative EEG (qEEG) Workstation, Neural Network Training Database, and 4-Pillar Startup Ecosystem
- **Strategy & Business Model:** [docs/STARTUP_STRATEGY_BMC.md](./STARTUP_STRATEGY_BMC.md)
- **Architectural Mental Model:** [docs/MENTAL_MODEL.md](./MENTAL_MODEL.md)
- **Design Specification:** [docs/DESIGN_SPECIFICATION.md](./DESIGN_SPECIFICATION.md) (Dual-Mode UI: General `#f8fafb` + `#0d9488` Teal vs Professional `#162b47` Navy + `#f1f5f9` Canvas + `#2c6865` Teal; Plus Jakarta Sans + JetBrains Mono)

---

## Unified Mega-Server Architecture & 1-Command Startup

All platform layers operate as one cohesive stack orchestrated by [start_unified_server.py](../start_unified_server.py) and [start.bat](../start.bat):

1. **PostgreSQL 16 (`127.0.0.1:5432`):** Reuses an already-listening local cluster or spawns `npm run db:start -w server` (`server/scripts/pg-daemon.ts`), executes `npx prisma migrate deploy` inside `server/`, and inspects the `User` row count to automatically run `npm run db:seed -w server` on a fresh database.
2. **Python FastAPI qEEG Service (`127.0.0.1:8001`):** Runs `uvicorn app:app --host 127.0.0.1 --port 8001` inside `qeeg_service/` (`QEEG_PORT=8001`), loading `stroke_3class_production_model.joblib`, `hospital_grade_n1_benchmark_results.json`, and `ads1299_500hz_sample.csv`. If `uvicorn`/`fastapi` is absent in the Python environment, the launcher emits a warning and continues smoothly because Express falls back to `qeeg-dsp.engine.ts`.
3. **Express 5 API Gateway (`127.0.0.1:4000`):** Proxies `/api/qeeg/*` to `QEEG_SERVICE_URL` (`http://127.0.0.1:8001`) with a 1500 ms timeout and deterministic TypeScript DSP fallback (`ts_dsp_fallback`), serves `qeeg_service/static/index.html` at `/clinical-workstation`, and hosts all social, Neural DB, and 4-pillar REST endpoints.
4. **Vite React 19 Desktop/Responsive Web SPA (`127.0.0.1:5173`, `client/`):** Proxies `/api`, `/uploads`, `/clinical-workstation`, and `/ws/hardware` to `http://127.0.0.1:4000` (`client/vite.config.ts`) so browser cookies and CSRF headers remain strictly first-party. Uses `React.lazy` + `Suspense` route-level code splitting (`client/src/App.tsx`) and idle preloading for primary tabs.
5. **Standalone Mobile Web SPA (`127.0.0.1:5174`, `mobile/`):** Dedicated mobile-first PWA/SPA (`mobile/vite.config.ts`, launched via `start_mobile.bat` or `npm run dev:mobile`) sharing the same Express `:4000` API gateway, with a sliding pill-indicator bottom dock (`MobileShell.tsx`), spring transitions, preloaded dock chunks (`routePreloaders.ts`), and responsive single-column mobile workflows.

---

## Clinical Taxonomy, qEEG Pipeline & Neural Network DB

### 1. Four Clinical Categories (`ClinicalCategory` enum)
- `VASCULAR_STROKE`: Acute ischemic stroke (LVO) vs intracerebral hemorrhage (ICH) triage with mandatory `CM[2,1] = 0` tPA lockout guard (`HOLD tPA / MANDATORY CT` prior to thrombolysis).
- `EPILEPSY_ICU`: Focal slowing and paroxysmal epileptiform discharges in temporal/ICU monitoring.
- `SLEEP_COGNITIVE`: Slow-wave N3 sleep mimics, cognitive fatigue (`TAR`), and relaxed occipital Alpha baseline.
- `HARDWARE_BCI`: Raw 6-channel 24-bit TI ADS1299 recordings at 500 Hz (`F3, F4, C3, C4, O1, O2`) and motor imagery signals.

### 2. Quantitative qEEG Studio & Standalone Workstation
- **Backend Proxy & TS Fallback (`server/src/modules/qeeg/`):** `qeeg.routes.ts` and `qeeg-dsp.engine.ts` (zero-phase IIR bandpass/50 Hz notch + CAR, Welch Hann FFT PSD, DAR/TAR/BSI/PRI/wPLI, 19-ch spherical geodesic topomap, 80-dim `featureVector80`, PDF 1.4 fallback) expose `/api/qeeg/health`, `/api/qeeg/cases` (6 built-in scenarios: `case_ischemia_lvo`, `case_ich_hemorrhage`, `case_epilepsy_temporal`, `case_sleep_fatigue_n3`, `case_healthy_alpha`, `case_ads1299_hardware`), `/api/qeeg/analyze-case`, `/api/qeeg/analyze-csv`, `/api/qeeg/export-pdf-summary` (1-page ReportLab clinical Vietnamese PDF or minimal PDF fallback), and `POST /api/qeeg/save-to-platform`.
- **Frontend qEEG Components (`client/src/features/eeg/`, `client/src/pages/EEGHubPage.tsx`):** `BrainWaveformViewer.tsx` (multi-channel paper grid, 25/50/100 uV gain, raw vs filtered toggle, calibration bracket), `CorticalTopomap2D.tsx` (19-channel 10-20 scalp topomap + hemispheric BSI breakdown), `QeegStudioPanel.tsx`, `PhysiologicalTrendChart.tsx`, `eegLabels.ts`, and Dual-Mode `qeeg_service/static/index.html` served at `/clinical-workstation`.

### 3. Neural Network Training Database (`NeuralTrainingSample` & `/api/neural-db/*`)
- **Labels (`NeuralLabel` enum):** `CONTROL` (0), `ISCHEMIC_STROKE` (1), `HEMORRHAGIC_STROKE` (2), `EPILEPTIFORM_SLOWING` (3), `COGNITIVE_FATIGUE` (4).
- **Splits (`DatasetSplit` enum):** `TRAIN`, `VALIDATION`, `TEST`, `EXTERNAL_HOLDOUT`.
- **Pipeline & Governance:** Stores deterministic 80-dimensional `featureVectorJson`, physiological biomarkers (`dar`, `bsi`, `tar`, `pri`, `wpli`, `signalQualityScore`, `tpaLockoutTriggered`), and `waveformPreviewJson`. Enforces `deidentifiedConfirmed === true` on ingestion (`POST /api/neural-db/samples`), restricts expert labeling (`PATCH /api/neural-db/samples/:id/verify`) via `assertVerifiedProfessional`, and exports structured CSV/JSONL (`GET /api/neural-db/export?format=csv|jsonl`) via `NeuralDatabasePanel.tsx`.

---

## Four Startup Pillars (Customer Relationships & Economic Engine)

1. **Pillar 1 — Personal Assistance (`ConsultationTicket`, `ConsultationReply`, `/consultations`, `/api/consultations`):** Qanda-style remote overtime triage connecting general users and frontline clinics with verified junior/resident doctors (`bs_noitru_khang`), neurologists (`dr_minh`), and neuroscientists (`prof_lan`). Supports atomic `CONSULTATION_ESCROW` on creation, automatic `urgentRedFlag` 115 alert detection (`bsi >= 0.22`, `dar >= 3.2`, or acute stroke keywords), peer claim (`POST /:id/claim`), structured 3-part clinical guidance replies (`waveAnalysisText`, `clinicalGuidanceText`, `recommendedFollowUp`), and requester acceptance (`POST /:id/accept/:replyId`) transferring `CONSULTATION_EARNING`.
2. **Pillar 2 — Co-creation & Data Bank (`DataBankListing`, `DataBankPurchase`, `/api/databank`, `DataBankMarketplacePanel.tsx`):** Marketplace for de-identified multi-center EEG datasets across the 4 clinical categories. Public listings expose summary `previewMetricsJson` while redacting `payloadCsvJson` until purchase (`POST /api/databank/:id/purchase`), which atomically debits `DATABANK_PURCHASE`, credits author `DATABANK_ROYALTY`, records `DataBankPurchase`, and increments `downloadsCount`.
3. **Pillar 3 — Self-Services (`HealthCheckIn`, `WorkingPlanBlock`, `/my-health`, `/api/self-service`):** Longitudinal personal EEG/health tracker (`PhysiologicalTrendChart.tsx` across `focusScore`, `fatigueIndexTar`, `hemisphericBsi`, `sleepHours`) paired with daily work-recovery scheduling (`DEEP_WORK`, `LIGHT_ADMIN`, `NEURO_RECOVERY`, `SLEEP_TARGET`, `CLINICAL_CHECK`) and granular Data-Owner Consent (`eegDatasetsApi.grantConsent` / `revokeConsent`).
4. **Pillar 4 — Community & Doctor Popularity (`Post`, `Contribution`, `/api/community-insights/spotlight`):** Academic feed (`FeedPage.tsx`) featuring 4-category filters and a verified specialist spotlight widget ranked by real database `impactScore` (public posts, likes, followers, accepted consultations, Data Bank listings and downloads). Supported by a 1-time idempotent `+250` `STARTER_GRANT` (`POST /api/rewards/claim-onboarding-grant`) and append-only `CreditWallet` / `CreditTransaction` ledger with `payoutEnabled = false` anti-cash-drain enforcement.

---

## Core Existing Modules & Access Control
- **Mode & Role Resolution:** Deterministic backend `experience.resolver.ts` and frontend `ModeContext.tsx` separating `GENERAL_MODE` (`hoa_health`) from `PROFESSIONAL_MODE` (`dr_minh`, `prof_lan`, `bs_noitru_khang`) alongside `PENDING` (`tuan_bme`) and `REJECTED` verification workflows.
- **Social, Messaging & Research Hub:** Cursor-paginated feed, 1-on-1 direct messaging (`directKey` 403 participant guard), notifications with `dedupeKey`, moderation reporting, 6-state credential dossier review with SHA-256 + OCR checks, and 5-criteria Research Hub peer review.
- **Recent UX & Performance Hardening (Nov 2026):**
  - Route-level code splitting (`React.lazy` + `Suspense`) on Web (`client/src/App.tsx`) and Mobile (`mobile/src/App.tsx`, `mobile/src/routePreloaders.ts`).
  - Sliding pill dock toolbar with pointer-drag / spring motion on Mobile (`MobileShell.tsx`, `mobile/verify_toolbar_motion.mjs`).
  - Vietnamese UI copy simplification across Web & Mobile (removing internal backend/crypto jargon such as `HMAC`, `ts_dsp_fallback`, `RESEARCH_CONTRIBUTION`, `Sandbox`, `P2P`, `PHI` from user-facing surfaces).
  - Mobile 375px header spacing, unclipped story avatar bubbles (`verify_mobile.mjs`), and deduplicated search clear button (`mobile/src/pages/SearchPage.tsx`).

---

## Section 6 — Brand Landing Page Song Ngữ (`VI | EN`)

- **Bilingual Implementation ([client/src/pages/LandingPage.tsx](../client/src/pages/LandingPage.tsx), [client/src/pages/landingContent.ts](../client/src/pages/landingContent.ts)):**
  - Trang landing page thương hiệu hỗ trợ song ngữ `VI | EN` (`?lang=vi`, `?lang=en`, lưu qua `neurolink_landing_lang` trong `localStorage`), tối ưu chuyển động với `prefers-reduced-motion` (`RevealBlock`) và sơ đồ `EcosystemDiagram`.
- **Product Screenshots (`client/public/landing/`, 11 files):**
  - Sử dụng 11 ảnh chụp thật từ giao diện Desktop & Mobile: `desktop-feed.png`, `desktop-qeeg-stable.png`, `desktop-qeeg-stroke.png`, `desktop-consultations.png`, `desktop-myhealth.png`, `desktop-pro-dashboard.png`, `desktop-doctor-profile.png`, `mobile-feed.png`, `mobile-qeeg.png`, `mobile-consult.png`, `mobile-topomap.png`.
- **Bundle & Runtime (`npm run dev:all`):**
  - Chunk `LandingPage` sau build đạt `44.80 kB` (`12.62 kB` gzip).
  - Toàn bộ stack `dev:all` chạy ổn định trên 4 cổng: `:5432` (PostgreSQL TCP `True`), `:4000` (`/api/health` HTTP `200` `{"status":"ok"}`), `:5173` (Web SPA HTTP `200`), và `:5174` (Mobile SPA HTTP `200`), đã kiểm chứng tải trang sạch qua Playwright (`0` page errors, `0` failed requests, ảnh hero `naturalWidth > 0`).
