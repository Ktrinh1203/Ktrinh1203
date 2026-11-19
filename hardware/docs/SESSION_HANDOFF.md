# SESSION HANDOFF — esp32_ads1299_holter

## Trạng thái hiện tại (Firmware v3 + PC Studio & NeuroLink Bridge v3)
- **Firmware v3 (`firmware/esp32_ads1299_bringup/`)**:
  - Đã biên dịch sạch với `arduino-cli compile --fqbn esp32:esp32:esp32` (Exit `0`): Flash `1,106,607 / 1,310,720 B` (`84%`), Static DRAM `82,092 / 327,680 B` (`25%`), Free Dynamic RAM `245,588 B` (`~239.8 KB`).
  - Bổ sung 6 trang TFT (`P6: AI TRIAGE & SYS`), Tier-1 Edge TinyML (`98` đặc trưng, `16` cây RF `PROGMEM`), giám sát pin 1S LiPo (`GPIO39`/`GPIO36`, tự flush SD `< 3.42 V`), ADS1299 stall/hot-plug watchdog, và Wi-Fi RFC 6455 WebSocket (`/ws/hardware`).
- **PC Studio & NeuroLink Live Bridge v3 (`src/`)**:
  - `src/protocol_codec.py`: Bổ sung `build_wifi_set_cmd`, `build_eeg_stream_frame`, mở rộng guard `assert_allowed_serial_port` chặn cứng `COM10` mọi định dạng.
  - `src/neurolink_bridge.py`: Máy chủ RFC 6455 WebSocket thuần Python (`HardwareWsServer`), bộ đệm epoch trượt/cuốn (`EegEpochBuffer`), HTTP forwarder `/api/qeeg/analyze-csv` có retry & chống sập khi offline, hỗ trợ cả `--source serial` và `--source ws`.
  - `src/pc_eeg_studio.py`: Đầy đủ lệnh v3 (`info`, `ai`, `pwr`, `sd-list`, `wifi-config`, `recover`, `record --montage`, `convert-bin --montage`, `bridge`), khóa cứng `COM10` trên mọi lệnh mở serial.
  - `src/hw_test_runner.py`: Khóa `COM10`, thêm parser JSON v3 (`AI`, `PWR`, `WIFI_STATUS`, `SD_LIST`, `RECOVER`) và đánh giá `v3_telemetry` (`vbat_v`, `vbat_pct`, `ai_ok`, `wifi_state`, ngưỡng pin `>= 3.42 V`) giữ tương thích ngược v2.
- **Kiểm thử & Cổng tĩnh**:
  - `python D:\PRJ_Personal\_tools\deterministic_gate.py D:\PRJ_Personal\esp32_ads1299_holter\src`: Exit `0`.
  - `pytest D:\PRJ_Personal\esp32_ads1299_holter\tests -v`: Toàn bộ test pass (gồm guard `COM10`, montage `raw/glasses/neurolink6`, v3 JSON & đánh giá phần cứng, RFC 6455 WS handshake + binary frame + mock HTTP `/api/qeeg/analyze-csv`, SOS zero-transient DSP và guard `4000 SPS`).

## Lịch sử nghiệm thu phần cứng thực tế (`COM11` — v2 baseline, `COM11` hiện đang rút cáp)
- Bản v2 trước đó đã pass 8/8 POST checks trên `COM11` @ `921600 bps`: ADS1299 ID `0x3E`, shorted noise `0.22–0.30 µVrms`, test signal `3769–3787 µVpp`, live stream `500 SPS` & `2000 SPS` ổn định `0 dropped`.
- Khi cắm lại `COM11` cho bước flash v3: nạp `firmware/esp32_ads1299_bringup` (giữ `BOOT` -> bấm thả `RST` nếu dùng bản DevKitC clone), rồi chạy `python src/hw_test_runner.py --port COM11 --baud 921600` và `python src/pc_eeg_studio.py --port COM11 info`.

## Lệnh nhanh vận hành v3
- Kiểm tra chẩn đoán v3: `python src/pc_eeg_studio.py --port COM11 {info,ai,pwr,sd-list,recover}`
- Cấu hình & bật Wi-Fi WS: `python src/pc_eeg_studio.py --port COM11 wifi-config --action set --ssid "<SSID>" --password "<PASS>" --host <IP> --ws-port 4000 --path /ws/hardware` rồi `--action on`
- Chạy Live Bridge sang NeuroLink: `python src/pc_eeg_studio.py bridge --source ws --ws-port 4000 --montage neurolink6 --epoch-sec 4 --neurolink-url http://localhost:4000`
