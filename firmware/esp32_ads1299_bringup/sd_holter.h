#pragma once

#include <Arduino.h>
#include <SPI.h>
#include <FS.h>
#include <SD.h>
#include "pins_config.h"
#include "ads1299_drv.h"

// ============================================================================
// Module ghi thẻ nhớ MicroSD Holter (SPI Mode 0, bảo vệ bằng vspiMutex)
// Định dạng file nhị phân /EEG_XXXX.BIN: Header 64 bytes + Bản ghi 44 bytes/mẫu
// ============================================================================

#pragma pack(push, 1)
struct HolterFileHeader {
  char     magic[8];     // "EEGHOLT1"
  uint16_t version;      // 1
  uint16_t record_size;  // 44
  uint32_t sample_rate;  // 250..4000
  uint8_t  pga_gain;     // 1..24
  uint8_t  input_mode;   // 0..3
  uint8_t  srb1;         // 0 or 1
  uint8_t  bias_on;      // 0 or 1
  float    lsb_uV;       // 4500000.0f / (gain * 8388607.0f)
  uint8_t  reserved[40]; // zero padding -> 64 bytes
};

struct HolterSampleRecord {
  uint16_t sync;         // 0xEE61
  uint16_t marker;       // 0 nếu bình thường, >=1 khi có Event Marker
  uint32_t seq;          // Chỉ số mẫu
  uint32_t status24;     // 24-bit status word ADS1299
  int32_t  raw24[8];     // 8 kênh signed 24-bit raw
};
#pragma pack(pop)

static_assert(sizeof(HolterFileHeader) == 64, "HolterFileHeader must be 64 bytes");
static_assert(sizeof(HolterSampleRecord) == 44, "HolterSampleRecord must be 44 bytes");

class SdHolterLogger {
public:
  static constexpr size_t BATCH_SAMPLES = 24; // 24 * 44 = 1056 bytes/write

  void init(SPIClass &vspi, SemaphoreHandle_t vspiMutex) {
    vspi_ = &vspi;
    mutex_ = vspiMutex;
    pinMode(PIN_SD_CS, OUTPUT);
    digitalWrite(PIN_SD_CS, HIGH);
  }

  bool mount() {
    if (recording_) {
      stopRecording();
    }
    if (!vspi_ || !lockBus()) return false;
    digitalWrite(PIN_TFT_CS, HIGH);
    if (mounted_) {
      SD.end();
      mounted_ = false;
    }
    bool ok = SD.begin(PIN_SD_CS, *vspi_, 10000000);
    if (ok && SD.cardType() != CARD_NONE) {
      mounted_ = true;
      card_mb_ = static_cast<uint32_t>(SD.cardSize() / (1024ULL * 1024ULL));
    } else {
      SD.end();
      digitalWrite(PIN_SD_CS, HIGH);
      mounted_ = false;
      card_mb_ = 0;
      ok = false;
    }
    unlockBus();
    return ok;
  }

  bool startRecording(const Ads1299Driver &ads) {
    if (recording_) return true;
    if (!mounted_) {
      if (!mount()) return false;
    }
    if (!lockBus()) return false;
    digitalWrite(PIN_TFT_CS, HIGH);

    bool ok = false;
    char path[24] = {0};
    for (int idx = 1; idx <= 9999; ++idx) {
      snprintf(path, sizeof(path), "/EEG_%04d.BIN", idx);
      if (!SD.exists(path)) {
        file_ = SD.open(path, FILE_WRITE);
        break;
      }
    }

    if (file_) {
      HolterFileHeader hdr{};
      memcpy(hdr.magic, "EEGHOLT1", 8);
      hdr.version = 1;
      hdr.record_size = sizeof(HolterSampleRecord);
      hdr.sample_rate = ads.sampleRate();
      hdr.pga_gain = ads.gain();
      hdr.input_mode = static_cast<uint8_t>(ads.mode());
      hdr.srb1 = (ads.mode() == ADS_IN_EEG_SRB1) ? 1 : 0;
      hdr.bias_on = ads.settings().biasAllCh ? 1 : 0;
      hdr.lsb_uV = ads.lsbUv();

      size_t written = file_.write(reinterpret_cast<const uint8_t *>(&hdr), sizeof(hdr));
      file_.flush();
      if (written == sizeof(hdr)) {
        strncpy(current_file_, path, sizeof(current_file_) - 1);
        current_file_[sizeof(current_file_) - 1] = '\0';
        batch_len_ = 0;
        samples_written_ = 0;
        last_flush_ms_ = millis();
        recording_ = true;
        ok = true;
      } else {
        file_.close();
      }
    }

    if (!ok) {
      // Cho phép tự mount lại nếu người dùng vừa rút hoặc thay thẻ mới
      mounted_ = false;
      card_mb_ = 0;
      SD.end();
      digitalWrite(PIN_SD_CS, HIGH);
    }
    unlockBus();
    return ok;
  }

  void pushSample(const AdsSample &s) {
    if (!recording_) return;
    HolterSampleRecord &rec = batch_[batch_len_++];
    rec.sync = 0xEE61;
    rec.marker = s.marker;
    rec.seq = s.seq;
    rec.status24 = s.status24;
    for (int ch = 0; ch < 8; ++ch) {
      rec.raw24[ch] = s.raw24[ch];
    }
    if (batch_len_ >= BATCH_SAMPLES) {
      flushBatch(false);
    }
  }

  void periodicFlush() {
    if (!recording_) return;
    if (millis() - last_flush_ms_ >= 2000) {
      flushBatch(true);
    }
  }

  void stopRecording() {
    if (!recording_) return;
    flushBatch(true);
    if (lockBus()) {
      digitalWrite(PIN_TFT_CS, HIGH);
      if (file_) {
        file_.flush();
        file_.close();
      }
      unlockBus();
    }
    recording_ = false;
  }

  bool isMounted() const { return mounted_; }
  bool isRecording() const { return recording_; }
  uint32_t cardMb() const { return card_mb_; }
  uint32_t samplesWritten() const { return samples_written_; }
  const char *currentFile() const { return current_file_; }

private:
  SPIClass *vspi_ = nullptr;
  SemaphoreHandle_t mutex_ = nullptr;
  File file_;
  bool mounted_ = false;
  bool recording_ = false;
  uint32_t card_mb_ = 0;
  uint32_t samples_written_ = 0;
  uint32_t last_flush_ms_ = 0;
  char current_file_[24] = "";
  HolterSampleRecord batch_[BATCH_SAMPLES]{};
  size_t batch_len_ = 0;

  bool lockBus() {
    if (mutex_ == nullptr) return true;
    return xSemaphoreTake(mutex_, pdMS_TO_TICKS(300)) == pdTRUE;
  }

  void unlockBus() {
    if (mutex_ != nullptr) {
      xSemaphoreGive(mutex_);
    }
  }

  void flushBatch(bool syncFat) {
    if (!recording_ || !file_) return;
    if (!lockBus()) return;
    digitalWrite(PIN_TFT_CS, HIGH);

    bool writeOk = true;
    if (batch_len_ > 0) {
      size_t bytesToWrite = batch_len_ * sizeof(HolterSampleRecord);
      size_t written = file_.write(reinterpret_cast<const uint8_t *>(batch_), bytesToWrite);
      if (written == bytesToWrite) {
        samples_written_ += static_cast<uint32_t>(batch_len_);
      } else {
        writeOk = false;
      }
      batch_len_ = 0;
    }
    if (syncFat && writeOk) {
      file_.flush();
      last_flush_ms_ = millis();
    }
    if (!writeOk) {
      file_.close();
      recording_ = false;
      mounted_ = false;
      SD.end();
      digitalWrite(PIN_SD_CS, HIGH);
    }
    unlockBus();
  }
};
