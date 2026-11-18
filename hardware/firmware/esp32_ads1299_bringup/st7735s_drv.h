#pragma once

#include <Arduino.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include "pins_config.h"

// ============================================================================
// Driver màn hình TFT 1.44" 128x128 ST7735S trên bus VSPI (Mode 0)
// Hỗ trợ bảo vệ chia sẻ bus bằng vspiMutex với module MicroSD.
// ============================================================================

class St7735sDriver {
public:
  struct PanelPreset {
    uint8_t colstart;
    uint8_t rowstart;
    uint8_t madctl;
    const char *name;
  };

  static constexpr uint16_t WIDTH = 128;
  static constexpr uint16_t HEIGHT = 128;

  static constexpr PanelPreset PRESETS[4] = {
    {2, 1, 0xC8, "G-Tab (2,1,BGR)"},
    {2, 3, 0xC8, "R-Tab (2,3,BGR)"},
    {0, 0, 0xC8, "Zero  (0,0,BGR)"},
    {2, 1, 0xC0, "G-Tab (2,1,RGB)"}
  };

  St7735sDriver() : canvas_(WIDTH, HEIGHT) {}

  void begin(SPIClass &vspi, SemaphoreHandle_t vspiMutex = nullptr) {
    vspi_ = &vspi;
    mutex_ = vspiMutex;

    pinMode(PIN_SD_CS, OUTPUT);
    digitalWrite(PIN_SD_CS, HIGH);
    pinMode(PIN_TFT_CS, OUTPUT);
    pinMode(PIN_TFT_DC, OUTPUT);
    pinMode(PIN_TFT_RES, OUTPUT);
    digitalWrite(PIN_TFT_CS, HIGH);
    digitalWrite(PIN_TFT_DC, HIGH);

    digitalWrite(PIN_TFT_RES, HIGH);
    delay(10);
    digitalWrite(PIN_TFT_RES, LOW);
    delay(20);
    digitalWrite(PIN_TFT_RES, HIGH);
    delay(120);

    if (lockBus()) {
      writeCmdLocked(0x01); // SWRESET
      delay(150);
      writeCmdLocked(0x11); // SLPOUT
      delay(150);

      writeCmdDataLocked(0xB1, (const uint8_t[]){0x01, 0x2C, 0x2D}, 3);
      writeCmdDataLocked(0xB2, (const uint8_t[]){0x01, 0x2C, 0x2D}, 3);
      writeCmdDataLocked(0xB3, (const uint8_t[]){0x01, 0x2C, 0x2D, 0x01, 0x2C, 0x2D}, 6);
      writeCmdDataLocked(0xB4, (const uint8_t[]){0x07}, 1);

      writeCmdDataLocked(0xC0, (const uint8_t[]){0xA2, 0x02, 0x84}, 3);
      writeCmdDataLocked(0xC1, (const uint8_t[]){0xC5}, 1);
      writeCmdDataLocked(0xC2, (const uint8_t[]){0x0A, 0x00}, 2);
      writeCmdDataLocked(0xC3, (const uint8_t[]){0x8A, 0x2A}, 2);
      writeCmdDataLocked(0xC4, (const uint8_t[]){0x8A, 0xEE}, 2);
      writeCmdDataLocked(0xC5, (const uint8_t[]){0x0E}, 1);

      writeCmdLocked(0x20); // INVOFF
      writeCmdDataLocked(0x36, (const uint8_t[]){PRESETS[preset_idx_].madctl}, 1);
      writeCmdDataLocked(0x3A, (const uint8_t[]){0x05}, 1);

      static const uint8_t gam1[16] = {
        0x02, 0x1C, 0x07, 0x12, 0x37, 0x32, 0x29, 0x2D,
        0x29, 0x25, 0x2B, 0x39, 0x00, 0x01, 0x03, 0x10
      };
      static const uint8_t gam2[16] = {
        0x03, 0x1D, 0x07, 0x06, 0x2E, 0x2C, 0x29, 0x2D,
        0x2E, 0x2E, 0x37, 0x3F, 0x00, 0x00, 0x02, 0x10
      };
      writeCmdDataLocked(0xE0, gam1, 16);
      writeCmdDataLocked(0xE1, gam2, 16);

      writeCmdLocked(0x13); // NORON
      delay(10);
      writeCmdLocked(0x29); // DISPON
      delay(50);
      unlockBus();
    }

    canvas_.fillScreen(0x0000);
    flush();
    initialized_ = true;
  }

  GFXcanvas16 &canvas() { return canvas_; }
  bool isInitialized() const { return initialized_; }

  const char *cyclePreset() {
    preset_idx_ = (preset_idx_ + 1) % 4;
    if (lockBus()) {
      writeCmdDataLocked(0x36, (const uint8_t[]){PRESETS[preset_idx_].madctl}, 1);
      unlockBus();
    }
    return PRESETS[preset_idx_].name;
  }

  const char *currentPresetName() const { return PRESETS[preset_idx_].name; }

  void flush() {
    if (!vspi_ || !lockBus()) return;
    digitalWrite(PIN_SD_CS, HIGH);

    const PanelPreset &p = PRESETS[preset_idx_];
    const uint16_t *fb = canvas_.getBuffer();

    vspi_->beginTransaction(SPISettings(20000000, MSBFIRST, SPI_MODE0));
    digitalWrite(PIN_TFT_CS, LOW);

    sendCmdByte(0x2A);
    uint8_t caset[4] = {0x00, p.colstart, 0x00, static_cast<uint8_t>(p.colstart + WIDTH - 1)};
    sendDataBytes(caset, 4);

    sendCmdByte(0x2B);
    uint8_t raset[4] = {0x00, p.rowstart, 0x00, static_cast<uint8_t>(p.rowstart + HEIGHT - 1)};
    sendDataBytes(raset, 4);

    sendCmdByte(0x2C);
    digitalWrite(PIN_TFT_DC, HIGH);

    constexpr uint16_t LINES_PER_CHUNK = 16;
    uint8_t chunk[WIDTH * LINES_PER_CHUNK * 2];
    for (uint16_t y = 0; y < HEIGHT; y += LINES_PER_CHUNK) {
      const uint16_t *src = fb + (uint32_t)y * WIDTH;
      uint32_t count = WIDTH * LINES_PER_CHUNK;
      for (uint32_t i = 0; i < count; ++i) {
        uint16_t px = src[i];
        chunk[i * 2] = static_cast<uint8_t>(px >> 8);
        chunk[i * 2 + 1] = static_cast<uint8_t>(px & 0xFF);
      }
      vspi_->writeBytes(chunk, sizeof(chunk));
    }

    digitalWrite(PIN_TFT_CS, HIGH);
    vspi_->endTransaction();
    unlockBus();
  }

private:
  SPIClass *vspi_ = nullptr;
  SemaphoreHandle_t mutex_ = nullptr;
  GFXcanvas16 canvas_;
  uint8_t preset_idx_ = 0;
  bool initialized_ = false;

  bool lockBus() {
    if (mutex_ == nullptr) return true;
    return xSemaphoreTake(mutex_, pdMS_TO_TICKS(200)) == pdTRUE;
  }

  void unlockBus() {
    if (mutex_ != nullptr) {
      xSemaphoreGive(mutex_);
    }
  }

  void sendCmdByte(uint8_t cmd) {
    digitalWrite(PIN_TFT_DC, LOW);
    vspi_->transfer(cmd);
  }

  void sendDataBytes(const uint8_t *data, size_t len) {
    digitalWrite(PIN_TFT_DC, HIGH);
    vspi_->writeBytes(data, len);
  }

  void writeCmdLocked(uint8_t cmd) {
    digitalWrite(PIN_SD_CS, HIGH);
    vspi_->beginTransaction(SPISettings(20000000, MSBFIRST, SPI_MODE0));
    digitalWrite(PIN_TFT_CS, LOW);
    sendCmdByte(cmd);
    digitalWrite(PIN_TFT_CS, HIGH);
    vspi_->endTransaction();
  }

  void writeCmdDataLocked(uint8_t cmd, const uint8_t *data, size_t len) {
    digitalWrite(PIN_SD_CS, HIGH);
    vspi_->beginTransaction(SPISettings(20000000, MSBFIRST, SPI_MODE0));
    digitalWrite(PIN_TFT_CS, LOW);
    sendCmdByte(cmd);
    if (len > 0) sendDataBytes(data, len);
    digitalWrite(PIN_TFT_CS, HIGH);
    vspi_->endTransaction();
  }
};
