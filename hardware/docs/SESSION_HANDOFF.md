# SESSION HANDOFF — esp32_ads1299_holter

## Trạng thái hiện tại (ĐÃ NGHIỆM THU TRÊN PHẦN CỨNG `COM11`)
- **Firmware**: `esp32_ads1299_holter_v2` đã nạp thành công lên ESP32-D0WD-V3 (`COM11`, `389,291 bytes` Flash 29%, `95,684 bytes` RAM 29%, `Hash of data verified`).
- **Tốc độ UART thực tế**: Chạy ổn định ở **`921600 bps`** (phát hiện thực tế chip bridge `CP2102` trên `COM11` khóa trần baud chuẩn tại `921600`, nếu để `1,000,000 bps` sẽ lệch khung byte). Đã bật `INPUT_PULLUP` cho `GPIO0` (`SET`) và thêm lệnh đổi nhanh `B460800`/`B921600`.
- **Static Gate & Unit Tests**: `deterministic_gate.py src` (`Exit 0`) và `pytest tests -v` (`7 passed`).

## Kết quả đo kiểm thực tế (`docs/last_hw_report.json`)
- **`hw_test_runner.py --port COM11 --baud 921600`** -> `overall_pass: true` (8/8 checks PASS):
  - `sd_cs_isolated`: `true` (`sd_ready`: `false` do chưa cắm thẻ MicroSD).
  - `tft_ok`: `true` (`G-Tab (2,1,BGR)`, `20 FPS`).
  - `ads_id_ok`: `true` (`0x3E`, masked `0x1E`).
  - `drdy_ok`: `true` (`drdy_boot_hz = 230.0 Hz`).
  - `short_noise_ok`: `true` (`short_rms_uV = [0.22, 0.26, 0.27, 0.24, 0.24, 0.29, 0.30, 0.26] uV`, x24, 128 mẫu).
  - `test_signal_ok`: `true` (`test_pp_uV = [3787.28, 3785.63, 3771.90, 3768.77, 3786.61, 3786.48, 3769.09, 3768.95] uVpp`, kỳ vọng `3750.0 uVpp`).
  - `buttons_idle_ok`: `true` (`UP:1, DWN:1, LET:1, RHT:1, MID:1, SET:1` — phím `UP` mới đã hết kẹt).
  - `stream_sps_ok`: `true` (`500.0 Hz`, `dropped: 0`).
- **Thu stream nhị phân PC Studio (`pc_eeg_studio.py --port COM11 --baud 921600`)**:
  - `500 SPS` Test Signal (`docs/live_capture_test.csv`): `1494` mẫu trong `3.02s` (`~495.4 SPS`), PP `[3769.17..3787.91] uVpp`, AC RMS `[1874.39..1883.56] uV`.
  - `2000 SPS` Shorted Noise (`docs/live_2ksps_short.csv`): `3990` mẫu trong `2.02s` (`~1979.2 SPS`), AC RMS `[0.58..0.61] uV`.

## Lưu ý vận hành & Việc còn lại tùy chọn
- Trên bản DevKitC clone này, khi nạp code mới qua USB cần giữ `BOOT` -> bấm thả `RST` (màn hình trắng ở ROM bootloader) rồi dùng `esptool --before no-reset`.
- Khi lắp thẻ **MicroSD `4–32 GB` format `FAT32`**: nhấn giữ nút giữa `MID (OK)` `>= 800 ms` để bắt đầu/dừng ghi `/EEG_XXXX.BIN`, sau đó chuyển sang CSV bằng `python src/pc_eeg_studio.py convert-bin EEG_0001.BIN EEG_0001.CSV`.
- Ghi chú kiểm tra thủ công phần phím bấm vật lý: lúc rảnh có thể bấm lần lượt `UP/DWN/LET/RHT/MID/SET` để chuyển 5 trang TFT và xác nhận cảm giác nhấn.
