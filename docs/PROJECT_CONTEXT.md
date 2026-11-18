# PROJECT CONTEXT — esp32_ads1299_holter

## 1. Mục tiêu & Phạm vi
- **Mô tả**: Hệ thống thu thập & chẩn đoán điện sinh lý 8 kênh 24-bit hoàn chỉnh trên ESP32-WROOM-32 Dual-SPI/Dual-Core + ADS1299 V1.4 + TFT 1.44" ST7735S + 5-Way Switch + MicroSD Holter + PC Studio (tương thích WinForm `921600 bps`).
- **Trạng thái**: Đã hoàn thiện toàn bộ Production Firmware v2 (`firmware/esp32_ads1299_bringup/`) và PC Studio (`src/`), đã qua kiểm toán độc lập Adversarial Review Gate (APPROVED), đã biên dịch sạch (`389,131 bytes` Flash / `95,684 bytes` RAM), `pytest` `7 passed`.

## 2. Kiến trúc & Điểm vào chính
- **Firmware ESP32**: `firmware/esp32_ads1299_bringup/` (`esp32_ads1299_bringup.ino`, `pins_config.h`, `ads1299_drv.h`, `ads1299_isr.cpp`, `st7735s_drv.h`, `sd_holter.h`, `pc_bridge.h`).
- **Bộ công cụ PC**: `src/pc_eeg_studio.py`, `src/protocol_codec.py`, `src/dsp_filters.py`, `src/hw_test_runner.py`.
- **Unit Tests**: `tests/test_parser.py`, `tests/test_protocol_and_dsp.py`, `tests/test_main.py`.

## 3. Ràng buộc & Quyết định kỹ thuật bất biến
- **Dual-SPI + Dual-Core + Handshake**:
  - Core 1 (`adsAcqTask`) độc quyền trên `HSPI` (`Mode 1, 4 MHz`) đẩy vào SPSC `SampleRingBuffer<512>` nghiêm ngặt (không sửa `tail_` từ producer); mọi thao tác đổi thanh ghi trên Core 0 bắt buộc bắt tay `pauseAdsTask()` -> chờ `g_adsTaskPaused` -> `applySettings()` -> `resumeAdsTask()`.
  - Core 0 dùng `vspiMutex` cho `TFT ST7735S` (`20 MHz, Mode 0`) và `MicroSD` (`10 MHz, Mode 0`, định dạng file `/EEG_XXXX.BIN`: 64B header `EEGHOLT1` + 44B record `0xEE61`).
- **Dual-Protocol UART `921,600 bps` (chuẩn CP2102 max baud)**:
  - Hỗ trợ gói nhị phân hãng (`0xAA..0xBB` / `0xA5..0x5A` 197B chứa 6 mẫu float32 µV) lẫn ASCII CLI (`R`, `I`, `O`, `M0..M3`, `MKR`, `SD_INIT`, `REC_START`, `REC_STOP`, `B460800`, `B921600`).
  - Giới hạn băng thông UART `921,600 bps` (~92.16 KB/s): Live binary stream tối đa `2000 SPS` (~65.7 KB/s); `4000 SPS` (~131.3 KB/s) chỉ dùng ghi offline MicroSD.
- **DSP Python (`dsp_filters.py`)**: Dùng `scipy.signal.sosfilt_zi` nhân mẫu đầu tiên để loại DC nửa pin điện cực ngay từ `t = 0` không bị quá độ hay suy giảm biên độ.
