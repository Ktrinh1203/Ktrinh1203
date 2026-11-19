#pragma once

// ============================================================================
// Master Pinout — Khớp 100% sơ đồ nối dây BOM_EEG_Device (ESP32-WROOM-32 38P)
// ============================================================================

// --- Bus HSPI (SPI2, Core 1): Độc quyền cho ADS1299 V1.4 (SPI Mode 1, 4 MHz) ---
constexpr int PIN_ADS_SCLK  = 14; // R8  -> ADS1299 P1.7  (SCLK)
constexpr int PIN_ADS_MOSI  = 13; // R5  -> ADS1299 P1.9  (DIN)
constexpr int PIN_ADS_MISO  = 34; // R15 -> ADS1299 P1.5  (DOUT) [Input-only, né G12]
constexpr int PIN_ADS_CS    = 27; // R9  -> ADS1299 P1.8  (CS)
constexpr int PIN_ADS_DRDY  = 35; // R14 -> ADS1299 P1.4  (DRDY) [Input-only, FALLING INT]
constexpr int PIN_ADS_START = 26; // R10 -> ADS1299 P1.11 (START)
constexpr int PIN_ADS_RST   = 25; // R11 -> ADS1299 P1.13 (REST)
constexpr int PIN_ADS_PWDN  = 2;  // L5  -> ADS1299 P1.14 (PWDN) [HIGH bật AFE + LED board]

// --- Bus VSPI (SPI3, Core 0): Chia sẻ TFT 1.44" ST7735S + MicroSD (SPI Mode 0) ---
constexpr int PIN_VSPI_SCK  = 18; // L11 -> TFT SCL + SD CLK
constexpr int PIN_VSPI_MISO = 19; // L12 -> SD MISO (TFT 1 chiều không có MISO)
constexpr int PIN_VSPI_MOSI = 23; // L18 -> TFT SDA + SD MOSI
constexpr int PIN_SD_CS     = 5;  // L10 -> SD CS (chưa dùng vẫn kéo HIGH để cô lập bus)
constexpr int PIN_TFT_CS    = 16; // L8  -> TFT CS
constexpr int PIN_TFT_DC    = 17; // L9  -> TFT DC
constexpr int PIN_TFT_RES   = 4;  // L7  -> TFT RES

// --- Cụm điều khiển 5-Way Switch + 2 Buttons (COM -> GND, Active-LOW) ---
constexpr int PIN_BTN_UP    = 33; // R12 (lưu ý PCB clone in nhầm chữ G23)
constexpr int PIN_BTN_DWN   = 32; // R13
constexpr int PIN_BTN_LET   = 21; // L14
constexpr int PIN_BTN_RHT   = 22; // L17
constexpr int PIN_BTN_MID   = 15; // L4  (Start/Stop/OK)
constexpr int PIN_BTN_SET   = 0;  // L6  (Event Marker / BOOT, pull-up 10k cứng trên DevKitC)
// Nút RST (B2) nối cứng vào chân EN (R18) trên board ESP32.

// --- Đo áp pin LiPo 1S & VBUS 5V (ADC1, an toàn song song Wi-Fi) ---
constexpr int PIN_VBAT_ADC   = 39; // L3  (SN / GPIO39 Input-only, ADC1_CH3) -> R_BAT1(100k)/R_BAT2(100k) từ VBAT_SW
constexpr int PIN_VBUS_SENSE = 36; // L2  (SP / GPIO36 Input-only, ADC1_CH0) -> Optional VBUS/Charger sense
