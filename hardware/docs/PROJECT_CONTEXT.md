# PROJECT CONTEXT — esp32_ads1299_holter

## 1. Mục tiêu & Phạm vi
- **Mô tả**: Hệ thống thu thập, sàng lọc đột quỵ biên (Tier-1 TinyML) và truyền luồng điện sinh lý 8 kênh 24-bit trên ESP32-WROOM-32 Dual-SPI/Dual-Core + ADS1299 V1.4 + TFT 1.44" ST7735S (6 trang HMI) + 5-Way Switch + MicroSD Holter + Pin LiPo 1S + Wi-Fi RFC 6455 WebSocket + PC Studio & NeuroLink Live Bridge.
- **Trạng thái**: Đã nâng cấp trọn bộ lên **Firmware v3** (`firmware/esp32_ads1299_bringup/`) và **PC Studio / NeuroLink Bridge v3** (`src/`):
  - Firmware biên dịch sạch (`arduino-cli compile --fqbn esp32:esp32:esp32`, Exit `0`): Flash `1,106,607 / 1,310,720 B` (`84%`), Static DRAM `82,092 / 327,680 B` (`25%`), Free Dynamic RAM `245,588 B` (`~239.8 KB`).
  - PC Studio v3 + RFC 6455 WebSocket Receiver + HTTP `/api/qeeg/analyze-csv` Bridge + bộ test pytest tự động (100% deterministic, không mở `COM10`).

## 2. Kiến trúc & Điểm vào chính
- **Firmware ESP32 v3**: `firmware/esp32_ads1299_bringup/` (`esp32_ads1299_bringup.ino`, `pins_config.h`, `ads1299_drv.h`, `ads1299_isr.cpp`, `st7735s_drv.h`, `sd_holter.h`, `pc_bridge.h`, `power_monitor.h`, `tinyml_stroke_edge.h`, `stroke_glasses_esp32.h`, `wifi_ws_link.h`).
- **Bộ công cụ PC & Bridge**:
  - `src/protocol_codec.py`: Codec khung nhị phân `0xAA..0xBB`/`0xA5..0x5A`, `assert_allowed_serial_port` (khóa cứng `COM10`), ánh xạ montage (`raw`, `glasses`, `neurolink6`), giải mã Holter `.BIN`, tạo lệnh `WIFI_SET`.
  - `src/dsp_filters.py`: Bộ lọc IIR SOS không quá độ khởi tạo bằng `sosfilt_zi * x[0]` (`eeg`, `emg`, `none`).
  - `src/neurolink_bridge.py`: Máy chủ RFC 6455 WebSocket thuần Python (`HardwareWsServer` khớp `wifi_ws_link.h`), bộ đệm epoch trượt/cuốn (`EegEpochBuffer`), HTTP client chịu lỗi offline đẩy `/api/qeeg/analyze-csv` (`post_eeg_epoch`), cầu nối `run_ws_bridge` & `run_serial_bridge`.
  - `src/pc_eeg_studio.py`: CLI v3 đầy đủ (`info`, `ai`, `pwr`, `sd-list`, `wifi-config`, `recover`, `record`, `convert-bin`, `bridge`).
  - `src/hw_test_runner.py`: Trình chạy POST & đánh giá phần cứng tương thích v2/v3 (bổ sung phân tích `vbat_mv`/`vbat_v`, `bat_pct`, `charging`, `ai_ok`, `wifi_state`, `tinyml_features/trees`).
- **Unit & Integration Tests**: `tests/test_main.py`, `tests/test_parser.py`, `tests/test_protocol_and_dsp.py`, `tests/test_v3_studio_and_bridge.py`.

## 3. Ràng buộc & Quyết định kỹ thuật bất biến
- **An toàn cổng nối tiếp**: Mọi đường mở Serial trong `hw_test_runner.py`, `pc_eeg_studio.py`, `neurolink_bridge.py` bắt buộc gọi `assert_allowed_serial_port()` — chặn cứng `COM10` (`COM10`, `com10`, `\\.\COM10`) với `PermissionError`.
- **Dual-SPI + Dual-Core + Watchdog**:
  - Core 1 (`adsAcqTask`) độc quyền trên `HSPI` (`Mode 1, 4 MHz`) đẩy vào SPSC `SampleRingBuffer<256>` nghiêm ngặt; bắt tay `pauseAdsTask()`/`g_adsTaskPaused` trước mọi thay đổi thanh ghi; tự phục hồi `recoverHardware()` khi mất `DRDY > 1.6s` hoặc hot-plug sau `5s`.
  - Core 0 dùng `g_vspiMutex` cho `TFT ST7735S` (6 trang: `P1..P4`, `P5 Config`, `P6 AI TRIAGE`) và `MicroSD` (`/EEG_XXXX.BIN`: 64B header `EEGHOLT1` + 44B record `0xEE61`).
- **Pin & An toàn nguồn (`power_monitor.h`)**: Dùng `ADC1` (`GPIO39` VBAT `100k/100k`, `GPIO36` VBUS) tương thích Wi-Fi; tự động flush & đóng file MicroSD khi `vbat_mv < 3420 mV` (`3.42 V`).
- **Dual-Link (`921,600 bps` UART + Wi-Fi RFC 6455 WebSocket)**:
  - Khung EEG nhị phân `197 B` (`0xA5 0xC2 0x11 0xD3 <48 float32 LE> 0x5A`), nhịp tim JSON telemetry mỗi 2s trên WS Opcode `0x01`, lệnh điều khiển từ xa trên WS Opcode `0x01`.
  - Băng thông UART `921,600 bps`: live binary stream tối đa `2000 SPS` (`4000 SPS` chỉ dùng ghi offline MicroSD); Wi-Fi WS tự hạ tần `<= 500 SPS`.
- **Montage ánh xạ chuẩn**:
  - `raw`: `CH1_uV..CH8_uV`
  - `glasses`: `FP1, FP2, F3, F4, F7, F8, T3, T4` (khớp `tinyml_stroke_edge.h`)
  - `neurolink6`: `F3, F4, C3, C4, O1, O2, T3, T4` (khớp NeuroLink Web `/api/qeeg/analyze-csv`).
