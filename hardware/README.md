# ESP32 + ADS1299 V1.4 Portable EEG/EMG Holter & Live Monitor

Hệ thống thu thập tín hiệu điện sinh lý 8 kênh 24-bit dùng **ESP32-WROOM-32 (Dual-Core + Dual-SPI)** kết nối **ADS1299 V1.4**, màn hình **TFT 1.44" ST7735S (128×128)**, cụm **5-Way Switch + SET/RST**, và khe thẻ **MicroSD FAT32**.

## Kiến trúc & Phân tách Tài nguyên
- **Core 1 (`HSPI / SPI2`, Mode 1, 4 MHz)**: Độc quyền đọc khung 27-byte từ `ADS1299 V1.4` qua ngắt `DRDY` (`GPIO35`) vào hàng đợi SPSC `SampleRingBuffer<512>` không khóa, không rớt mẫu khi ghi thẻ hay vẽ màn hình.
- **Core 0 (`VSPI / SPI3`, Mode 0, `vspiMutex`)**: Chia sẻ an toàn giữa `TFT 1.44" ST7735S` (`20 MHz`, `20 FPS`) và `MicroSD 3.3V` (`10 MHz`), xử lý nút nhấn và cầu nối `Serial 921,600 bps` (giới hạn phần cứng tối đa chuẩn của chip USB-UART CP2102).

## 5 Trang Hiển thị HMI trên TFT & Cách Dùng 6 Nút
- **5 Trang (`UP / DWN` để chuyển trang)**:
  1. `Page 1 (CH1–4 WAVE)`: Dạng sóng 4 kênh đầu (tự khử trôi DC khi ở chế độ `EEG`/`EMG`).
  2. `Page 2 (CH5–8 WAVE)`: Dạng sóng 4 kênh sau.
  3. `Page 3 (8-CH BARS)`: Biểu đồ thanh `µVpp` 8 kênh + cảnh báo `RAIL!`.
  4. `Page 4 (LEAD-OFF / IMP)`: Bảng kiểm tra tiếp xúc điện cực 8 kênh (`GOOD` / `OFFP` / `OFFN` / `RAIL`). Nhấn `OK` để bật/tắt cảm biến DC Lead-Off.
  5. `Page 5 (CONFIG & SD)`: Nhấn `OK` để vào `[EDIT MODE]`, dùng `UP/DWN` chọn dòng (`Mode`, `Rate`, `Gain`, `BIAS`, `Scale`, `SD`) và `LET/RHT` đổi cấu hình tức thì.
- **Phím tắt nhanh**:
  - `LET / RHT` (ở trang 1–3): Đổi thang biên độ (`AUTO / 50uV / 200u / 500u / 2.5m`).
  - `MID (OK)` nhấn ngắn: Đổi nhanh `Mode` (`EEG` / `SHRT` / `TEST` / `EMG`) ở trang 1–3, bật `Lead-Off` ở trang 4, bật/tắt `[EDIT]` ở trang 5.
  - `MID (OK)` **nhấn giữ `>= 800 ms`** (ở bất kỳ trang nào): Bật/Tắt ghi file Holter `/EEG_XXXX.BIN` vào thẻ MicroSD (tương thích an toàn ngay cả khi chưa cắm thẻ).
  - `SET (GPIO0)`: Gắn **Event Marker** chính xác tới từng chỉ số mẫu.

## Công cụ PC Studio (`src/`)
- Cài phụ thuộc: `pip install -r requirements.txt` (cần `pyserial`, `numpy`, `scipy`).
- Kiểm tra phần cứng & chạy POST:
  ```powershell
  python src/hw_test_runner.py --port COM11 --baud 921600
  ```
- Thu sóng 8 kênh thời gian thực qua `921,600 bps` (hỗ trợ lọc `none`, `eeg`, `emg`):
  ```powershell
  python src/pc_eeg_studio.py --port COM11 record --duration 5 --rate 500 --gain 12 --input test --filter none --out docs/live_capture.csv
  ```
- Chuyển file thẻ nhớ Holter `.BIN` sang `.CSV`:
  ```powershell
  python src/pc_eeg_studio.py convert-bin EEG_0001.BIN EEG_0001.CSV
  ```
- Tương thích giao thức nhị phân app **WinForm `.exe` của hãng** ở tốc độ `921,600 bps` (lưu ý `UART 921,600 bps` hỗ trợ live stream tới `2000 SPS`; tốc độ `4000 SPS` dùng khi ghi Holter MicroSD).
