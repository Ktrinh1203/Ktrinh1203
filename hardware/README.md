# ESP32 + ADS1299 V1.4 Portable EEG/EMG Holter, Edge AI & NeuroLink Bridge (v3)

Hệ thống thu thập, sàng lọc đột quỵ biên (Tier-1 TinyML) và truyền luồng điện sinh lý 8 kênh 24-bit dùng **ESP32-WROOM-32 (Dual-Core + Dual-SPI)** kết nối **ADS1299 V1.4**, màn hình **TFT 1.44" ST7735S (128×128)**, cụm **5-Way Switch + SET/RST**, khe thẻ **MicroSD FAT32**, giám sát **Pin LiPo 1S (`GPIO39/GPIO36`)** và **Wi-Fi RFC 6455 WebSocket**.

## Kiến trúc Firmware v3 & Phân tách Tài nguyên
- **Core 1 (`HSPI / SPI2`, Mode 1, 4 MHz)**: Độc quyền đọc khung 27-byte từ `ADS1299 V1.4` qua ngắt `DRDY` (`GPIO35`) vào hàng đợi SPSC `SampleRingBuffer<256>` không khóa, bảo vệ bằng bắt tay `pauseAdsTask()`/`g_adsTaskPaused` và Watchdog tự phục hồi (`1.6s` stall / `5s` hot-plug).
- **Core 0 (`VSPI / SPI3`, Mode 0, `g_vspiMutex`)**: Chia sẻ an toàn giữa `TFT 1.44" ST7735S` (`20 MHz`, `20 FPS`), `MicroSD 3.3V` (`10 MHz`), nút nhấn HMI, Tier-1 Edge AI và Dual Link (`USB Serial 921,600 bps` + `Wi-Fi WebSocket`).
- **Tier-1 Edge TinyML (`tinyml_stroke_edge.h`)**: Trích xuất `98` đặc trưng (256-pt Radix-2 FFT PSD, Hjorth, Spectral Entropy, 4 cặp BSI DAR/Delta) + mô hình 16-Tree Random Forest / Linear (`const PROGMEM`) chạy ~1 Hz trên ESP32 kèm cổng SQI chống báo giả.
- **Giám sát Pin & An toàn Dữ liệu (`power_monitor.h`)**: Đọc `GPIO39` (`ADC1_CH3`, cầu phân áp `100k/100k`) và `GPIO36` (`ADC1_CH0`, cảm biến VBUS sạc) hoạt động song song Wi-Fi; tự động flush và đóng file MicroSD Holter an toàn khi pin `< 3.42 V` (`3420 mV`).
- **Tài nguyên biên dịch (`ESP32-WROOM-32`)**: Flash `1,106,607 / 1,310,720 B` (`84%`), Static DRAM `82,092 / 327,680 B` (`25%`), Free Dynamic RAM `245,588 B` (`~239.8 KB`).

## 6 Trang Hiển thị HMI trên TFT & Cách Dùng 6 Nút
- **6 Trang (`UP / DWN` để chuyển trang)**:
  1. `P1 (CH1–4 WAVE)`: Dạng sóng 4 kênh đầu (tự khử trôi DC khi ở chế độ `EEG`/`EMG`).
  2. `P2 (CH5–8 WAVE)`: Dạng sóng 4 kênh sau.
  3. `P3 (8-CH BARS)`: Biểu đồ thanh `µVpp` 8 kênh + cảnh báo `RAIL!`.
  4. `P4 (LEAD-OFF / IMP)`: Kiểm tra tiếp xúc điện cực 8 kênh (`GOOD` / `OFFP` / `OFFN` / `RAIL`). Nhấn `OK` để bật/tắt cảm biến DC Lead-Off.
  5. `P5 (CONFIG & SD)`: Nhấn `OK` vào `[EDIT MODE]`, dùng `UP/DWN` chọn dòng (`Mode`, `Rate`, `Gain`, `BIAS`, `Scale`, `SD`, `WiFi`) và `LET/RHT` đổi cấu hình tức thì.
  6. `P6 (AI TRIAGE & SYS)`: Trạng thái Tier-1 Edge AI (`SIM_MODE / WARMUP / SQI_ABSTAIN / NORMAL / BORDERLINE / STROKE_ALERT`), xác suất `RF`/`LR`, chỉ số `BSI`/`DAR`, trạng thái Pin (`USB 5V` hoặc `BAT V/%`), trạng thái `Wi-Fi WS` và bộ đếm lỗi/phục hồi SPI. Nhấn `LET/RHT` bật/tắt Wi-Fi, nhấn `OK` lưu cấu hình vào NVS.
- **Phím tắt nhanh**:
  - `MID (OK)` **nhấn giữ `>= 800 ms`** (ở bất kỳ trang nào): Bật/Tắt ghi file Holter `/EEG_XXXX.BIN` vào thẻ MicroSD.
  - `SET (GPIO0)`: Gắn **Event Marker** chính xác tới từng chỉ số mẫu.

## Công cụ PC Studio & NeuroLink Live Bridge (`src/`)
- Cài phụ thuộc: `pip install -r requirements.txt` (`pyserial`, `numpy`, `scipy`, `pytest`; WebSocket server & HTTP bridge dùng 100% Python stdlib).
- **Bảo vệ cổng nối tiếp**: Mọi đường mở cổng đều chặn cứng `COM10` (`COM10`, `\\.\COM10`) bằng `PermissionError`.
- Kiểm tra phần cứng & chạy POST (hỗ trợ trường v2 & v3):
  ```powershell
  python src/hw_test_runner.py --port COM11 --baud 921600
  ```
- Điều khiển & chẩn đoán Firmware v3:
  ```powershell
  python src/pc_eeg_studio.py --port COM11 info
  python src/pc_eeg_studio.py --port COM11 ai
  python src/pc_eeg_studio.py --port COM11 pwr
  python src/pc_eeg_studio.py --port COM11 sd-list
  python src/pc_eeg_studio.py --port COM11 recover
  python src/pc_eeg_studio.py --port COM11 wifi-config --action set --ssid "LabWiFi" --password "secret" --host 192.168.1.100 --ws-port 4000 --path /ws/hardware
  python src/pc_eeg_studio.py --port COM11 wifi-config --action on
  python src/pc_eeg_studio.py --port COM11 wifi-config --action status
  python src/pc_eeg_studio.py --port COM11 wifi-config --action off
  ```
- Thu sóng 8 kênh thời gian thực kèm ánh xạ Montage (`raw`, `glasses`, `neurolink6`):
  ```powershell
  python src/pc_eeg_studio.py --port COM11 record --duration 5 --rate 500 --gain 12 --input eeg --filter eeg --montage glasses --out docs/live_capture.csv
  ```
- Chuyển file thẻ nhớ Holter `.BIN` sang `.CSV` theo montage:
  ```powershell
  python src/pc_eeg_studio.py convert-bin EEG_0001.BIN EEG_0001.CSV --montage neurolink6
  ```
- **NeuroLink Live Bridge** (nhận luồng `0xA5..0x5A` qua USB Serial `921600 bps` HOẶC Wi-Fi WebSocket `/ws/hardware`, tự động đẩy epoch EEG sang `POST /api/qeeg/analyze-csv` kèm khả năng chịu lỗi offline):
  ```powershell
  # Chế độ USB Serial -> NeuroLink Web Server
  python src/pc_eeg_studio.py --port COM11 bridge --source serial --rate 500 --montage neurolink6 --epoch-sec 4 --neurolink-url http://localhost:4000

  # Chế độ Wi-Fi WebSocket Receiver -> NeuroLink Web Server
  python src/pc_eeg_studio.py bridge --source ws --ws-host 0.0.0.0 --ws-port 4000 --ws-path /ws/hardware --montage glasses --epoch-sec 4 --neurolink-url http://localhost:4000
  ```
- Giới hạn băng thông UART `921,600 bps` (~92 KB/s): Live stream USB hỗ trợ tới `2000 SPS` (`4000 SPS` bị chặn sớm trên UART và chỉ dùng ghi offline MicroSD); luồng Wi-Fi WebSocket tự hạ tần `<= 500 SPS`.
