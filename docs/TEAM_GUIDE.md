# Hướng Dẫn Phân Vùng Monorepo & Quy Trình Phối Hợp Cho 4 Team

Repository `NeuroLink` được tổ chức theo cấu trúc **Monorepo 4 phân vùng độc lập** để các nhóm Frontend, Backend, AI/qEEG và Phần cứng Nhúng (Embedded Hardware) làm việc song song không đụng chạm mã nguồn của nhau.

---

## 1. Bản Đồ Phân Vùng Theo Team

| Team | Thư mục sở hữu | Ngôn ngữ & Stack | Cổng / Giao tiếp | Tài liệu chi tiết |
| :--- | :--- | :--- | :--- | :--- |
| **1. Team Frontend (Web UI)** | [`client/`](../client/) | React 19, Vite 8, TypeScript, Tailwind v4 | `http://127.0.0.1:5173` | [`DESIGN.md`](../DESIGN.md) |
| **2. Team Backend & DB** | [`server/`](../server/) | Node.js, Express 5, Prisma 6.19, PostgreSQL 16 | `http://127.0.0.1:4000` | [`docs/MENTAL_MODEL.md`](./MENTAL_MODEL.md) |
| **3. Team AI & qEEG Server** | [`qeeg_service/`](../qeeg_service/) | Python FastAPI, SciPy, Joblib, ReportLab | `http://127.0.0.1:8001` | [`docs/PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) |
| **4. Team Hardware & Embedded** | [`hardware/`](../hardware/) | C++ Arduino/ESP32, Python `pyserial`/DSP | USB UART `921600 bps` / MicroSD | [`hardware/README.md`](../hardware/README.md) |

---

## 2. Lệnh Chạy Nhanh Riêng Cho Từng Team

### A. Chạy toàn bộ hệ thống Web + DB + AI (1 lệnh duy nhất)
```powershell
python start_unified_server.py
```

### B. Team Frontend (`client/`)
```powershell
npm install
npm run dev:client          # Chạy riêng giao diện Vite (:5173)
npm run typecheck -w client # Kiểm tra kiểu tĩnh TypeScript
```

### C. Team Backend & Database (`server/`)
```powershell
npm install
npm run db:start            # Bật cụm PostgreSQL 16 cục bộ (:5432)
npm run dev:server          # Chạy Express API (:4000)
npm test -w server          # Chạy bộ test tích hợp Vitest + Supertest
```

### D. Team AI & qEEG Microservice (`qeeg_service/`)
```powershell
pip install -r qeeg_service/requirements.txt
uvicorn app:app --app-dir qeeg_service --host 127.0.0.1 --port 8001 --reload
pytest qeeg_service/tests -v
```

### E. Team Hardware & Embedded Software (`hardware/`)
- **Firmware trên chip ESP32**: mở thư mục [`hardware/firmware/esp32_ads1299_bringup/`](../hardware/firmware/esp32_ads1299_bringup/) bằng Arduino IDE / `arduino-cli` (`esp32:esp32:esp32`).
- **Công cụ PC Studio & Kiểm thử tự động**:
```powershell
pip install -r hardware/requirements.txt

# 1. Chạy tự kiểm POST phần cứng (ADS1299 + TFT 1.44" + 6 nút + tốc độ mẫu)
python hardware/src/hw_test_runner.py --port COM11 --baud 921600

# 2. Thu sóng 8 kênh 24-bit trực tiếp ra CSV (tương thích thẳng Web NeuroLink)
python hardware/src/pc_eeg_studio.py --port COM11 --baud 921600 record --duration 10 --rate 500 --gain 24 --input eeg --filter eeg --out hardware/docs/session_eeg.csv

# 3. Giải mã file ghi thẻ nhớ Holter (.BIN) sang .CSV
python hardware/src/pc_eeg_studio.py convert-bin EEG_0001.BIN EEG_0001.CSV

# 4. Chạy unit test cho bộ giải mã giao thức & lọc số DSP
pytest hardware/tests -v
```

---

## 3. Luồng Nối Liên Thông: Phần Cứng Thực Tế -> Web Server AI

1. **Thu dữ liệu trên thiết bị**: Mạch `ESP32 + ADS1299 V1.4` thu 8 kênh 24-bit ở `500 SPS` qua cáp USB (`pc_eeg_studio.py record`) hoặc ghi độc lập ra thẻ nhớ MicroSD (`convert-bin`).
2. ** Chuẩn định dạng CSV chung**: File xuất ra có các cột `timestamp_s, sample_idx, CH1_uV..CH8_uV` (đơn vị microvolt thực tế đã quy đổi theo hệ số PGA).
3. **Đẩy lên Trạm qEEG NeuroLink**: Mở `http://127.0.0.1:5173/clinical-workstation` (hoặc gọi `POST /api/qeeg/analyze-csv`), chọn file CSV vừa thu — cả hai động cơ Python FastAPI (`qeeg_service/app.py`) và TypeScript Fallback (`qeeg-dsp.engine.ts`) đều tự động bỏ qua cột chỉ số thời gian/marker, ánh xạ kênh tín hiệu, lọc nhiễu, vẽ bản đồ não Topomap 19 kênh, kiểm tra an toàn tPA và lưu vào `NeuralTrainingSample`.

---

## 4. Quy Tắc Nhánh Git & Tránh Xung Đột Giữa Các Team

- **Chỉ sửa đúng thư mục của team mình**:
  - Frontend chỉ sửa trong `client/`.
  - Backend chỉ sửa trong `server/`.
  - AI/DSP chỉ sửa trong `qeeg_service/`.
  - Nhúng/Phần cứng chỉ sửa trong `hardware/`.
- **Đặt tên nhánh rõ tiền tố**: `fe/<tính-năng>`, `be/<tính-năng>`, `ai/<tính-năng>`, `hw/<tính-năng>`.
- **Trước khi mở Pull Request / Push lên `main`**:
  - Web (`fe`/`be`): chạy `npm run typecheck`.
  - AI (`ai`): chạy `pytest qeeg_service/tests`.
  - Hardware (`hw`): chạy `pytest hardware/tests`.
