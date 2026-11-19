#pragma once

#include <Arduino.h>
#include "ads1299_drv.h"

// ============================================================================
// Cầu nối PC Dual-Protocol ở 921,600 bps (Firmware v3):
// 1. Giao thức nhị phân hãng (0xAA..0xBB / 0xA5..0x5A, khung 197 byte 6 mẫu)
//    -> Tương thích trực tiếp app WinForm/Python/MATLAB, pc_eeg_studio & NeuroLink
// 2. Lệnh ASCII CLI kết thúc '\n' (qua USB Serial hoặc Wi-Fi WebSocket):
//    R, I, O, M0..M3, MKR, SD_INIT, REC_START, REC_STOP, SD_LIST, AI, PWR,
//    RATE <sps>, GAIN <pga>, LOFF <0|1>, BIAS <0|1>, CH_MASK <hex>,
//    CFG_SAVE, CFG_LOAD, CFG_RESET, RECOVER,
//    WIFI_SET <ssid>|<pass>|<host>|<port>|<path>, WIFI_ON, WIFI_OFF, WIFI_STATUS
// ============================================================================

class PcBridge {
public:
  struct Callbacks {
    void (*onRunPost)() = nullptr;
    void (*onPrintInfo)() = nullptr;
    void (*onCycleTftPreset)() = nullptr;
    void (*onApplyParams)(uint8_t rateIdx, uint8_t pgaIdx, AdsInputMode mode) = nullptr;
    void (*onSetBinaryStream)(bool enable) = nullptr;
    void (*onTriggerMarker)() = nullptr;
    void (*onSdCommand)(uint8_t cmd) = nullptr; // 0=init, 1=rec_start, 2=rec_stop, 3=list
    void (*onExtendedCommand)(const String &cmdLine) = nullptr;
  };

  void setCallbacks(const Callbacks &cb) { cb_ = cb; }

  bool isBinaryStreaming() const { return bin_stream_active_; }

  void setBinaryStreaming(bool enable) {
    bin_stream_active_ = enable;
    batch_idx_ = 0;
  }

  void pushSampleToStream(const AdsSample &s) {
    if (!bin_stream_active_) return;
    for (int ch = 0; ch < 8; ++ch) {
      batch_floats_[batch_idx_ * 8 + ch] = s.ch_uV[ch];
    }
    batch_idx_++;
    if (batch_idx_ >= 6) {
      uint8_t frame[197];
      frame[0] = 0xA5;
      frame[1] = 0xC2; // 2 + 192 = 194
      frame[2] = 0x11;
      frame[3] = frame[1] ^ frame[2]; // 0xD3
      memcpy(frame + 4, batch_floats_, 192);
      frame[196] = 0x5A;
      Serial.write(frame, sizeof(frame));
      batch_idx_ = 0;
    }
  }

  void sendAckBytes(uint8_t addr, const uint8_t *payload, uint8_t len) {
    uint8_t buf[64];
    if (len > 58) len = 58;
    buf[0] = 0xA5;
    buf[1] = static_cast<uint8_t>(2 + len);
    buf[2] = addr;
    buf[3] = buf[1] ^ buf[2];
    if (len > 0 && payload != nullptr) {
      memcpy(buf + 4, payload, len);
    }
    buf[4 + len] = 0x5A;
    Serial.write(buf, 5 + len);
  }

  void sendAckString(uint8_t addr, const char *str) {
    size_t n = strlen(str);
    if (n > 58) n = 58;
    sendAckBytes(addr, reinterpret_cast<const uint8_t *>(str), static_cast<uint8_t>(n));
  }

  void processExternalCommand(const String &cmdLine, const AdsSettings &curSettings) {
    String clean = cmdLine;
    clean.trim();
    if (clean.length() > 0) {
      handleAsciiCommand(clean, curSettings);
    }
  }

  void pollSerial(const AdsSettings &curSettings) {
    // Reset trạng thái đọc gói binary nếu bị đứt đoạn quá 60 ms
    if (in_bin_ && (millis() - bin_last_byte_ms_ > 60)) {
      in_bin_ = false;
      bin_pos_ = 0;
      bin_expected_len_ = 0;
    }

    while (Serial.available() > 0) {
      uint8_t b = static_cast<uint8_t>(Serial.read());

      if (in_bin_) {
        bin_last_byte_ms_ = millis();
        bin_buf_[bin_pos_++] = b;
        if (bin_pos_ == 2) {
          if (b < 3 || b > 40) {
            in_bin_ = false;
            bin_pos_ = 0;
            continue;
          }
          bin_expected_len_ = static_cast<uint8_t>(b + 3);
        }
        if (bin_expected_len_ > 0 && bin_pos_ >= bin_expected_len_) {
          handleBinaryFrame(bin_buf_, bin_expected_len_, curSettings);
          in_bin_ = false;
          bin_pos_ = 0;
          bin_expected_len_ = 0;
        }
        continue;
      }

      if (b == 0xAA) {
        in_bin_ = true;
        bin_pos_ = 0;
        bin_expected_len_ = 0;
        bin_buf_[bin_pos_++] = b;
        bin_last_byte_ms_ = millis();
        ascii_line_ = "";
        continue;
      }

      if (b == '\r') continue;
      if (b == '\n') {
        ascii_line_.trim();
        if (ascii_line_.length() > 0) {
          handleAsciiCommand(ascii_line_, curSettings);
        }
        ascii_line_ = "";
      } else if (b >= 0x20 && b <= 0x7E && ascii_line_.length() < 160) {
        ascii_line_ += static_cast<char>(b);
      }
    }
  }

private:
  Callbacks cb_{};
  bool bin_stream_active_ = false;
  float batch_floats_[48] = {0};
  uint8_t batch_idx_ = 0;

  bool in_bin_ = false;
  uint8_t bin_buf_[48] = {0};
  uint8_t bin_pos_ = 0;
  uint8_t bin_expected_len_ = 0;
  uint32_t bin_last_byte_ms_ = 0;
  String ascii_line_;

  static AdsInputMode mapVendorInputIdx(uint8_t vIdx) {
    if (vIdx == 0) return ADS_IN_EEG_SRB1;
    if (vIdx == 1) return ADS_IN_SHORT_NOISE;
    if (vIdx == 2) return ADS_IN_TEST_SIGNAL;
    if (vIdx == 3) return ADS_IN_EMG_DIFF;
    return ADS_IN_EEG_SRB1;
  }

  static uint8_t toVendorInputIdx(AdsInputMode m) {
    if (m == ADS_IN_EEG_SRB1) return 0;
    if (m == ADS_IN_SHORT_NOISE) return 1;
    if (m == ADS_IN_TEST_SIGNAL) return 2;
    return 3;
  }

  void handleBinaryFrame(const uint8_t *buf, uint8_t len, const AdsSettings &cur) {
    if (len < 6 || buf[0] != 0xAA || buf[len - 1] != 0xBB) return;

    uint8_t xr = 0;
    for (uint8_t i = 1; i <= len - 3; ++i) {
      xr ^= buf[i];
    }
    if (xr != buf[len - 2]) return;

    uint8_t rw = buf[2];
    uint8_t addr = buf[3];
    const uint8_t *data = &buf[4];
    uint8_t dataLen = static_cast<uint8_t>(len - 6);

    if (addr == 0x01) { // HardwareVersion
      sendAckString(0x01, "ESP32-ADS1299-V1.4");
    } else if (addr == 0x02) { // SoftwareVersion
      sendAckString(0x02, "V3.0.0");
    } else if (addr == 0x09) { // ConnStatus
      uint8_t st = (dataLen >= 1) ? data[0] : 1;
      sendAckBytes(0x09, &st, 1);
    } else if (addr == 0x10) { // SamplePar
      if (rw == 0x80 && dataLen >= 3) {
        uint8_t rIdx = (data[0] < 5) ? data[0] : cur.rateIdx;
        uint8_t pIdx = (data[1] < 7) ? data[1] : cur.pgaIdx;
        AdsInputMode m = mapVendorInputIdx(data[2]);
        if (cb_.onApplyParams) {
          cb_.onApplyParams(rIdx, pIdx, m);
        }
        uint8_t ack[3] = {rIdx, pIdx, toVendorInputIdx(m)};
        sendAckBytes(0x10, ack, 3);
      } else {
        uint8_t ack[3] = {cur.rateIdx, cur.pgaIdx, toVendorInputIdx(cur.inputMode)};
        sendAckBytes(0x10, ack, 3);
      }
    } else if (addr == 0x11) { // SampleControl
      if (rw == 0x80 && dataLen >= 1) {
        bool start = (data[0] != 0x00);
        setBinaryStreaming(start);
        if (cb_.onSetBinaryStream) {
          cb_.onSetBinaryStream(start);
        }
      }
    }
  }

  void handleAsciiCommand(const String &cmd, const AdsSettings &cur) {
    if (cmd == "R" || cmd == "r") {
      setBinaryStreaming(false);
      if (cb_.onRunPost) cb_.onRunPost();
    } else if (cmd == "I" || cmd == "i") {
      if (!bin_stream_active_ && cb_.onPrintInfo) cb_.onPrintInfo();
    } else if (cmd == "O" || cmd == "o") {
      if (cb_.onCycleTftPreset) cb_.onCycleTftPreset();
    } else if (cmd == "M0") {
      if (cb_.onApplyParams) cb_.onApplyParams(cur.rateIdx, cur.pgaIdx, ADS_IN_EEG_SRB1);
    } else if (cmd == "M1") {
      if (cb_.onApplyParams) cb_.onApplyParams(cur.rateIdx, cur.pgaIdx, ADS_IN_SHORT_NOISE);
    } else if (cmd == "M2") {
      if (cb_.onApplyParams) cb_.onApplyParams(cur.rateIdx, cur.pgaIdx, ADS_IN_TEST_SIGNAL);
    } else if (cmd == "M3") {
      if (cb_.onApplyParams) cb_.onApplyParams(cur.rateIdx, cur.pgaIdx, ADS_IN_EMG_DIFF);
    } else if (cmd == "MKR") {
      if (cb_.onTriggerMarker) cb_.onTriggerMarker();
    } else if (cmd == "SD_INIT") {
      if (cb_.onSdCommand) cb_.onSdCommand(0);
    } else if (cmd == "REC_START") {
      if (cb_.onSdCommand) cb_.onSdCommand(1);
    } else if (cmd == "REC_STOP") {
      if (cb_.onSdCommand) cb_.onSdCommand(2);
    } else if (cmd == "SD_LIST") {
      if (!bin_stream_active_ && cb_.onSdCommand) cb_.onSdCommand(3);
    } else if (cmd == "B460800") {
      Serial.println("{\"baud\":460800}");
      Serial.flush();
      Serial.updateBaudRate(460800);
    } else if (cmd == "B921600") {
      Serial.println("{\"baud\":921600}");
      Serial.flush();
      Serial.updateBaudRate(921600);
    } else if (cb_.onExtendedCommand) {
      cb_.onExtendedCommand(cmd);
    }
  }
};
