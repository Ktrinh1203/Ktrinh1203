#pragma once

#include <Arduino.h>
#include <SPI.h>
#include <math.h>
#include "pins_config.h"

// ============================================================================
// Driver ADS1299 V1.4 trên bus HSPI (SPI Mode 1: CPOL=0, CPHA=1)
// Hỗ trợ cấu hình động Rate/Gain/Input/BIAS/Lead-Off & Event Marker chính xác mẫu.
// ============================================================================

struct AdsSample {
  uint32_t seq;
  uint32_t status24;
  int32_t  raw24[8];
  float    ch_uV[8];
  uint16_t marker;
};

enum AdsInputMode : uint8_t {
  ADS_IN_EEG_SRB1    = 0, // Normal electrode + SRB1=1 (Single-Ended tham chiếu REF)
  ADS_IN_SHORT_NOISE = 1, // Input shorted nội (MUX=001) đo noise sàn
  ADS_IN_TEST_SIGNAL = 2, // Sóng vuông nội ~1.953 Hz, ±1.875 mV = 3750 uVpp
  ADS_IN_EMG_DIFF    = 3  // Normal electrode + SRB1=0 (Vi sai lưỡng cực từng cặp P/N)
};

struct AdsSettings {
  uint8_t      rateIdx      = 1;                  // 0=250, 1=500, 2=1000, 3=2000, 4=4000 SPS
  uint8_t      pgaIdx       = 5;                  // 0=1, 1=2, 2=4, 3=6, 4=8, 5=12, 6=24
  AdsInputMode inputMode    = ADS_IN_TEST_SIGNAL; // Khởi động mặc định chạy Test Signal kiểm chứng
  bool         biasAllCh    = true;               // Đưa vòng hồi tiếp đồng pha ra chân RLD
  bool         loffEnable   = false;              // Bật bộ so sánh DC Lead-Off trên điện cực
  uint8_t      chEnableMask = 0xFF;               // Mặt nạ bật từng kênh CH1..CH8 (bit 0..7)
};

// SPSC Lock-Free Ring Buffer nghiêm ngặt (Core 1 chỉ sửa head_, Core 0 chỉ sửa tail_)
template <size_t N>
class SampleRingBuffer {
public:
  void clear() {
    head_ = 0;
    tail_ = 0;
    dropped_ = 0;
  }

  bool push(const AdsSample &s) {
    size_t head = head_;
    size_t next = (head + 1) % N;
    if (next == tail_) {
      dropped_ = dropped_ + 1;
      return false;
    }
    buf_[head] = s;
    __sync_synchronize();
    head_ = next;
    return true;
  }

  bool pop(AdsSample &out) {
    size_t tail = tail_;
    if (head_ == tail) return false;
    out = buf_[tail];
    __sync_synchronize();
    tail_ = (tail + 1) % N;
    return true;
  }

  uint32_t droppedCount() const { return dropped_; }

private:
  AdsSample buf_[N];
  volatile size_t head_ = 0;
  volatile size_t tail_ = 0;
  volatile uint32_t dropped_ = 0;
};

extern volatile uint32_t g_ads_drdy_irq_count;
extern volatile TaskHandle_t g_ads_stream_task;
extern volatile uint16_t g_ads_pending_marker;
void IRAM_ATTR ads1299_drdy_isr();

class Ads1299Driver {
public:
  static constexpr uint8_t CMD_WAKEUP = 0x02;
  static constexpr uint8_t CMD_STANDBY = 0x04;
  static constexpr uint8_t CMD_RESET  = 0x06;
  static constexpr uint8_t CMD_START  = 0x08;
  static constexpr uint8_t CMD_STOP   = 0x0A;
  static constexpr uint8_t CMD_RDATAC = 0x10;
  static constexpr uint8_t CMD_SDATAC = 0x11;
  static constexpr uint8_t CMD_RDATA  = 0x12;

  static uint16_t rateValueFromIdx(uint8_t idx) {
    static constexpr uint16_t RATES[5] = {250, 500, 1000, 2000, 4000};
    return (idx < 5) ? RATES[idx] : 500;
  }

  static uint8_t pgaValueFromIdx(uint8_t idx) {
    static constexpr uint8_t PGAS[7] = {1, 2, 4, 6, 8, 12, 24};
    return (idx < 7) ? PGAS[idx] : 12;
  }

  static const char *inputModeShortName(AdsInputMode m) {
    switch (m) {
      case ADS_IN_EEG_SRB1:    return "EEG";
      case ADS_IN_SHORT_NOISE: return "SHRT";
      case ADS_IN_TEST_SIGNAL: return "TEST";
      case ADS_IN_EMG_DIFF:    return "EMG";
      default:                 return "UNK";
    }
  }

  void beginPinsAndSpi() {
    pinMode(PIN_ADS_CS, OUTPUT);
    pinMode(PIN_ADS_START, OUTPUT);
    pinMode(PIN_ADS_RST, OUTPUT);
    pinMode(PIN_ADS_PWDN, OUTPUT);
    pinMode(PIN_ADS_DRDY, INPUT);

    digitalWrite(PIN_ADS_CS, HIGH);
    digitalWrite(PIN_ADS_START, LOW);
    digitalWrite(PIN_ADS_RST, HIGH);
    digitalWrite(PIN_ADS_PWDN, LOW);

    if (!spi_started_) {
      hspi_.begin(PIN_ADS_SCLK, PIN_ADS_MISO, PIN_ADS_MOSI, -1);
      attachInterrupt(digitalPinToInterrupt(PIN_ADS_DRDY), ads1299_drdy_isr, FALLING);
      spi_started_ = true;
    }
  }

  bool probeAndReadRegs(float &outDrdyBootHz, uint8_t outRegs[24]) {
    g_ads_stream_task = nullptr;
    beginPinsAndSpi();

    digitalWrite(PIN_ADS_CS, HIGH);
    digitalWrite(PIN_ADS_START, LOW);
    digitalWrite(PIN_ADS_PWDN, LOW);
    delay(20);
    digitalWrite(PIN_ADS_PWDN, HIGH);
    delay(250);

    digitalWrite(PIN_ADS_RST, LOW);
    delay(10);
    digitalWrite(PIN_ADS_RST, HIGH);
    delay(50);

    // Kéo START=HIGH trong 200ms để đo tần số DRDY mặc định 250 SPS ngay sau Reset
    g_ads_drdy_irq_count = 0;
    digitalWrite(PIN_ADS_START, HIGH);
    uint32_t t0 = millis();
    while (millis() - t0 < 200) {
      delay(5);
    }
    uint32_t cnt = g_ads_drdy_irq_count;
    digitalWrite(PIN_ADS_START, LOW);
    outDrdyBootHz = cnt * 5.0f;

    // Dummy clock lúc CS=HIGH để ổn định SCLK idle=LOW trước khi gửi SDATAC
    hspi_.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE1));
    hspi_.transfer(0x00);
    hspi_.endTransaction();

    sendCommand(CMD_SDATAC, 1000000);
    delay(2);
    sendCommand(CMD_STOP, 1000000);
    delay(2);

    readRegs(0x00, outRegs, 24, 1000000);
    memcpy(last_regs_, outRegs, 24);
    id_raw_ = outRegs[0];
    id_ok_ = ((outRegs[0] & 0x1F) == 0x1E);
    spi_err_count_ = 0;
    return id_ok_;
  }

  bool applySettings(const AdsSettings &s, bool restartStreamIfNeeded = false) {
    bool wasStreaming = streaming_;
    if (wasStreaming) {
      stopContinuous();
      delay(2);
    } else {
      g_ads_stream_task = nullptr;
      digitalWrite(PIN_ADS_START, LOW);
      sendCommand(CMD_SDATAC, 1000000);
      delay(2);
      sendCommand(CMD_STOP, 1000000);
      delay(2);
    }

    static constexpr uint8_t RATE_REGS[5] = {0x96, 0x95, 0x94, 0x93, 0x92};
    uint8_t rIdx = (s.rateIdx < 5) ? s.rateIdx : 1;
    uint8_t pIdx = (s.pgaIdx < 7) ? s.pgaIdx : 5;
    gain_ = pgaValueFromIdx(pIdx);
    sample_rate_ = rateValueFromIdx(rIdx);

    uint8_t cfg[23] = {0};
    cfg[0] = RATE_REGS[rIdx]; // 0x01 CONFIG1
    cfg[2] = 0xEC;            // 0x03 CONFIG3: PD_REFBUF=1 (4.5V), BIASREF_INT=1, PD_BIAS=1

    uint8_t mux = 0x00;
    uint8_t srb1 = 0x00;
    if (s.inputMode == ADS_IN_EEG_SRB1) {
      cfg[1] = 0xC0;
      mux = 0x00;
      srb1 = 0x20;
    } else if (s.inputMode == ADS_IN_SHORT_NOISE) {
      cfg[1] = 0xC0;
      mux = 0x01;
      srb1 = 0x00;
    } else if (s.inputMode == ADS_IN_TEST_SIGNAL) {
      // Test signal nội ~1.953 Hz, ±1.875 mV = 3750 uVpp
      cfg[1] = 0xD1;
      mux = 0x05;
      srb1 = 0x00;
    } else { // ADS_IN_EMG_DIFF
      cfg[1] = 0xC0;
      mux = 0x00;
      srb1 = 0x00;
    }

    uint8_t chRegActive = static_cast<uint8_t>(((pIdx & 0x07) << 4) | (mux & 0x07));
    uint8_t chMask = (s.chEnableMask == 0) ? 0xFF : s.chEnableMask;
    for (int i = 0; i < 8; ++i) {
      bool chOn = ((chMask >> i) & 0x01) != 0;
      // Kênh tắt ghi 0x81 (PDn=1, MUX=001 nối tắt nội theo khuyến nghị TI ADS1299)
      cfg[4 + i] = chOn ? chRegActive : 0x81; // 0x05..0x0C CH1SET..CH8SET
    }

    bool isElectrodeMode = (s.inputMode == ADS_IN_EEG_SRB1 || s.inputMode == ADS_IN_EMG_DIFF);
    uint8_t biasMask = (s.biasAllCh && isElectrodeMode) ? chMask : 0x00;
    cfg[12] = biasMask; // 0x0D BIAS_SENSP
    cfg[13] = biasMask; // 0x0E BIAS_SENSN

    if (s.loffEnable && isElectrodeMode) {
      cfg[3]  = 0x00;   // 0x04 LOFF: DC Pull-up/down 6 nA, 95%/5%
      cfg[14] = chMask; // 0x0F LOFF_SENSP
      // Khi SRB1=1, chỉ kiểm cực P vì các ngõ INxN nối chung nội tới REF
      cfg[15] = (s.inputMode == ADS_IN_EEG_SRB1) ? 0x00 : chMask; // 0x10 LOFF_SENSN
      cfg[22] = 0x02;   // 0x17 CONFIG4: PD_LOFF_COMP = 1
    } else {
      cfg[3]  = 0x00;
      cfg[14] = 0x00;
      cfg[15] = 0x00;
      cfg[22] = 0x00;
    }

    cfg[20] = srb1; // 0x15 MISC1

    writeRegs(0x01, cfg, 23, 1000000);
    delay(4);

    uint8_t readback[24] = {0};
    readRegs(0x00, readback, 24, 1000000);
    memcpy(last_regs_, readback, 24);
    settings_ = s;
    settings_.rateIdx = rIdx;
    settings_.pgaIdx = pIdx;
    settings_.chEnableMask = chMask;

    bool ok = (readback[0x01] == cfg[0]) &&
              (readback[0x02] == cfg[1]) &&
              (readback[0x03] == cfg[2]) &&
              (readback[0x05] == cfg[4]) &&
              (readback[0x15] == cfg[20]) &&
              (readback[0x17] == cfg[22]);

    if (restartStreamIfNeeded && wasStreaming) {
      startContinuous(saved_task_handle_);
    }
    return ok;
  }

  void startContinuous(TaskHandle_t taskToNotify = nullptr) {
    if (taskToNotify != nullptr) {
      saved_task_handle_ = taskToNotify;
    }
    g_ads_drdy_irq_count = 0;
    seq_ = 0;
    streaming_ = true;
    g_ads_stream_task = taskToNotify;
    sendCommand(CMD_RDATAC, 4000000);
    delayMicroseconds(20);
    digitalWrite(PIN_ADS_START, HIGH);
  }

  void stopContinuous() {
    streaming_ = false;
    g_ads_stream_task = nullptr;
    digitalWrite(PIN_ADS_START, LOW);
    delayMicroseconds(20);
    sendCommand(CMD_STOP, 1000000);
    sendCommand(CMD_SDATAC, 1000000);
  }

  bool readFrame(AdsSample &out) {
    uint8_t tx[27] = {0};
    uint8_t rx[27] = {0};

    hspi_.beginTransaction(SPISettings(4000000, MSBFIRST, SPI_MODE1));
    digitalWrite(PIN_ADS_CS, LOW);
    delayMicroseconds(1);
    hspi_.transferBytes(tx, rx, 27);
    delayMicroseconds(1);
    digitalWrite(PIN_ADS_CS, HIGH);
    hspi_.endTransaction();

    uint32_t st = ((uint32_t)rx[0] << 16) | ((uint32_t)rx[1] << 8) | rx[2];
    bool deadBus = (st == 0x000000UL || st == 0xFFFFFFUL);
    bool badHdr  = id_ok_ && ((st & 0xF00000UL) != 0xC00000UL);
    if (deadBus || badHdr) {
      spi_err_count_++;
      return false;
    }

    out.seq = ++seq_;
    out.status24 = st;
    out.marker = __atomic_exchange_n(&g_ads_pending_marker, 0, __ATOMIC_SEQ_CST);

    const float scale_uV = 4500000.0f / ((float)gain_ * 8388607.0f);
    for (int ch = 0; ch < 8; ++ch) {
      int idx = 3 + ch * 3;
      uint32_t u = ((uint32_t)rx[idx] << 16) | ((uint32_t)rx[idx + 1] << 8) | rx[idx + 2];
      if (u & 0x00800000UL) {
        u |= 0xFF000000UL;
      }
      int32_t signed24 = static_cast<int32_t>(u);
      out.raw24[ch] = signed24;
      out.ch_uV[ch] = static_cast<float>(signed24) * scale_uV;
    }
    return true;
  }

  int collectBlocking(AdsSample *buf, int maxSamples, int skipSamples, uint32_t timeoutMs) {
    int totalNeeded = skipSamples + maxSamples;
    int got = 0;
    uint32_t lastEdge = g_ads_drdy_irq_count;
    uint32_t tStart = millis();

    while (got < totalNeeded && (millis() - tStart) < timeoutMs) {
      if (g_ads_drdy_irq_count != lastEdge || digitalRead(PIN_ADS_DRDY) == LOW) {
        lastEdge = g_ads_drdy_irq_count;
        AdsSample s;
        if (readFrame(s)) {
          if (got >= skipSamples) {
            buf[got - skipSamples] = s;
          }
          got++;
        }
      } else {
        delayMicroseconds(100);
      }
    }
    return (got > skipSamples) ? (got - skipSamples) : 0;
  }

  // Tự phục hồi phần cứng ADS1299 khi DRDY bị treo do xung tĩnh điện ESD hoặc lỏng cáp
  bool recoverHardware() {
    streaming_ = false;
    g_ads_stream_task = nullptr;
    digitalWrite(PIN_ADS_START, LOW);
    digitalWrite(PIN_ADS_CS, HIGH);

    digitalWrite(PIN_ADS_RST, LOW);
    delay(6);
    digitalWrite(PIN_ADS_RST, HIGH);
    delay(30);

    hspi_.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE1));
    hspi_.transfer(0x00);
    hspi_.endTransaction();

    sendCommand(CMD_SDATAC, 1000000);
    delay(2);
    sendCommand(CMD_STOP, 1000000);
    delay(2);

    uint8_t regs[24] = {0};
    readRegs(0x00, regs, 24, 1000000);
    memcpy(last_regs_, regs, 24);
    id_raw_ = regs[0];
    id_ok_ = ((regs[0] & 0x1F) == 0x1E);
    recovery_count_++;
    if (!id_ok_) return false;
    return applySettings(settings_, false);
  }

  uint8_t idRaw() const { return id_raw_; }
  bool isIdOk() const { return id_ok_; }
  uint8_t gain() const { return gain_; }
  uint16_t sampleRate() const { return sample_rate_; }
  float lsbUv() const { return 4500000.0f / ((float)gain_ * 8388607.0f); }
  const AdsSettings &settings() const { return settings_; }
  AdsInputMode mode() const { return settings_.inputMode; }
  const uint8_t *lastRegs() const { return last_regs_; }
  uint32_t spiErrorCount() const { return spi_err_count_; }
  uint32_t recoveryCount() const { return recovery_count_; }

private:
  SPIClass hspi_{HSPI};
  bool spi_started_ = false;
  bool streaming_ = false;
  bool id_ok_ = false;
  TaskHandle_t saved_task_handle_ = nullptr;
  uint8_t id_raw_ = 0;
  uint8_t gain_ = 12;
  uint16_t sample_rate_ = 500;
  uint32_t seq_ = 0;
  uint32_t spi_err_count_ = 0;
  uint32_t recovery_count_ = 0;
  AdsSettings settings_{};
  uint8_t last_regs_[24] = {0};

  void sendCommand(uint8_t cmd, uint32_t clkHz) {
    hspi_.beginTransaction(SPISettings(clkHz, MSBFIRST, SPI_MODE1));
    digitalWrite(PIN_ADS_CS, LOW);
    delayMicroseconds(2);
    hspi_.transfer(cmd);
    delayMicroseconds(4);
    digitalWrite(PIN_ADS_CS, HIGH);
    hspi_.endTransaction();
  }

  void readRegs(uint8_t startAddr, uint8_t *out, uint8_t count, uint32_t clkHz) {
    hspi_.beginTransaction(SPISettings(clkHz, MSBFIRST, SPI_MODE1));
    digitalWrite(PIN_ADS_CS, LOW);
    delayMicroseconds(2);
    hspi_.transfer(static_cast<uint8_t>(0x20 | (startAddr & 0x1F)));
    delayMicroseconds(4);
    hspi_.transfer(static_cast<uint8_t>((count - 1) & 0x1F));
    delayMicroseconds(4);
    for (uint8_t i = 0; i < count; ++i) {
      out[i] = hspi_.transfer(0x00);
      delayMicroseconds(4);
    }
    digitalWrite(PIN_ADS_CS, HIGH);
    hspi_.endTransaction();
  }

  void writeRegs(uint8_t startAddr, const uint8_t *data, uint8_t count, uint32_t clkHz) {
    hspi_.beginTransaction(SPISettings(clkHz, MSBFIRST, SPI_MODE1));
    digitalWrite(PIN_ADS_CS, LOW);
    delayMicroseconds(2);
    hspi_.transfer(static_cast<uint8_t>(0x40 | (startAddr & 0x1F)));
    delayMicroseconds(4);
    hspi_.transfer(static_cast<uint8_t>((count - 1) & 0x1F));
    delayMicroseconds(4);
    for (uint8_t i = 0; i < count; ++i) {
      hspi_.transfer(data[i]);
      delayMicroseconds(4);
    }
    digitalWrite(PIN_ADS_CS, HIGH);
    hspi_.endTransaction();
  }
};
