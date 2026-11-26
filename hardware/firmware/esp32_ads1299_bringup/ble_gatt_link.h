#pragma once

#include <Arduino.h>
#include <NimBLEDevice.h>
#include "ads1299_drv.h"

// ============================================================================
// NeuroLink BLE 4.2/5.0 GATT Server (NimBLE Stack) for 24/7 Mobile Collector
// - Dùng NimBLE-Arduino thay Bluedroid giúp tiết kiệm ~45 KB DRAM nội bộ
//   để cùng chạy ổn định với TFT ST7735S (32 KB), SD Card, Wi-Fi và TinyML.
// - Hai chế độ hoạt động:
//   * AUTO (mặc định): tiết kiệm pin tối đa, chỉ phát BLE burst (1s pre + 7s)
//     khi Edge AI trên mạch phát hiện AI_STROKE_ALERT / AI_BORDERLINE.
//   * REALTIME: truyền sóng 8 kênh liên tục <= 250 SPS về điện thoại.
// - Định dạng khung nhị phân 197 byte:
//   [0xA5, 0xC2, 0x11, 0xD3] + 48 float32 LE (6 mẫu × 8 kênh µV) + [0x5A].
// ============================================================================

#define NL_BLE_DEVICE_NAME   "NeuroLink-Holter"
#define NL_BLE_SERVICE_UUID  "4f9a0001-b5a3-f393-e0a9-e50e24dcca9e"
#define NL_BLE_EEG_CHAR_UUID "4f9a0002-b5a3-f393-e0a9-e50e24dcca9e"
#define NL_BLE_TEL_CHAR_UUID "4f9a0003-b5a3-f393-e0a9-e50e24dcca9e"
#define NL_BLE_CMD_CHAR_UUID "4f9a0004-b5a3-f393-e0a9-e50e24dcca9e"

enum BleStreamMode : uint8_t {
  BLE_MODE_AUTO     = 0,
  BLE_MODE_REALTIME = 1
};

class BleGattLink {
public:
  using CommandCallback = void (*)(const String &cmdLine);

  void begin(CommandCallback onRemoteCmd = nullptr, bool autoAdvertise = true) {
    initDeviceId();
    on_cmd_ = onRemoteCmd;
    enabled_ = autoAdvertise;
    if (!enabled_) return;
    ensureStarted();
  }

  const char *deviceId() const { return device_id_; }

  void setEnabled(bool enabled) {
    enabled_ = enabled;
    if (enabled_) {
      ensureStarted();
      if (server_ != nullptr && !connected_) {
        NimBLEDevice::startAdvertising();
      }
    } else if (initialized_) {
      NimBLEDevice::stopAdvertising();
      connected_ = false;
    }
  }

  void setStreamMode(BleStreamMode mode) {
    stream_mode_ = mode;
    if (mode == BLE_MODE_AUTO) {
      burst_armed_ = false;
      pre_drain_rem_ = 0;
      pre_drain_idx_ = 0;
      batch_idx_ = 0;
    }
  }

  BleStreamMode streamMode() const { return stream_mode_; }

  const char *streamModeName() const {
    return stream_mode_ == BLE_MODE_REALTIME ? "REALTIME" : "AUTO";
  }

  bool isBurstActive() const {
    if (pre_drain_rem_ > 0) return true;
    return burst_armed_ && static_cast<int32_t>(burst_until_ms_ - millis()) > 0;
  }

  void triggerAlertBurst(uint32_t durationMs = 7000) {
    burst_armed_ = true;
    burst_until_ms_ = millis() + durationMs;
    if (prebuf_ != nullptr && pre_drain_rem_ == 0 && pre_filled_ >= 6) {
      pre_drain_idx_ = (pre_filled_ < PREBUF_LEN) ? 0 : pre_head_;
      pre_drain_rem_ = pre_filled_;
    }
  }

  uint32_t recommendedHeartbeatMs() const {
    return (stream_mode_ == BLE_MODE_AUTO && !isBurstActive()) ? 5000UL : 2000UL;
  }

  bool isEnabled() const { return enabled_; }
  bool isConnected() const { return enabled_ && initialized_ && connected_; }

  const char *stateName() const {
    if (!enabled_) return "OFF";
    if (!initialized_) return "INIT";
    return connected_ ? "BLE_CONN" : "BLE_ADV";
  }

  void poll() {
    if (!enabled_ || !initialized_) return;
    if (burst_armed_ && static_cast<int32_t>(burst_until_ms_ - millis()) <= 0) {
      burst_armed_ = false;
    }
    if (!connected_ && prev_connected_) {
      prev_connected_ = false;
      burst_armed_ = false;
      pre_drain_rem_ = 0;
      batch_idx_ = 0;
      NimBLEDevice::startAdvertising();
    } else if (connected_ && !prev_connected_) {
      prev_connected_ = true;
    }

    if (pending_cmd_.length() > 0 && on_cmd_ != nullptr) {
      String cmd = pending_cmd_;
      pending_cmd_ = "";
      cmd.trim();
      if (cmd.length() > 0) on_cmd_(cmd);
    }

    // Xả tối đa 2 gói (12 mẫu) tiền sự kiện mỗi chu kỳ poll() để không nghẽn GATT queue
    if (isConnected() && prebuf_ != nullptr && pre_drain_rem_ >= 6) {
      int framesSent = 0;
      while (pre_drain_rem_ >= 6 && framesSent < 2) {
        float tmp[48];
        for (int s = 0; s < 6; ++s) {
          const uint32_t rowBase = static_cast<uint32_t>(pre_drain_idx_) * 8U;
          for (int ch = 0; ch < 8; ++ch) {
            tmp[s * 8 + ch] = static_cast<float>(prebuf_[rowBase + ch]) * 0.1f;
          }
          pre_drain_idx_ = (pre_drain_idx_ + 1) % PREBUF_LEN;
          pre_drain_rem_--;
        }
        notifyFrame(tmp);
        framesSent++;
      }
      if (pre_drain_rem_ < 6) {
        pre_drain_rem_ = 0;
      }
    }
  }

  // Đẩy mẫu EEG qua BLE Notify (luôn lưu vòng đệm 1.0s tiền sự kiện; chỉ phát radio khi Realtime hoặc Burst)
  void pushSample(const AdsSample &s, uint16_t actualSps) {
    if (!isConnected()) return;

    uint16_t decim = 1;
    if (actualSps > 250) {
      decim = actualSps / 250;
      if (decim < 1) decim = 1;
    }
    decim_cnt_++;
    if (decim_cnt_ < decim) return;
    decim_cnt_ = 0;

    if (prebuf_ != nullptr) {
      const uint32_t rowBase = static_cast<uint32_t>(pre_head_) * 8U;
      for (int ch = 0; ch < 8; ++ch) {
        float uv = s.ch_uV[ch];
        if (uv > 3270.0f) uv = 3270.0f;
        else if (uv < -3270.0f) uv = -3270.0f;
        prebuf_[rowBase + ch] = static_cast<int16_t>(lroundf(uv * 10.0f));
      }
      pre_head_ = (pre_head_ + 1) % PREBUF_LEN;
      if (pre_filled_ < PREBUF_LEN) pre_filled_++;
    }

    if (stream_mode_ == BLE_MODE_AUTO && !isBurstActive()) {
      return;
    }

    for (int ch = 0; ch < 8; ++ch) {
      batch_floats_[batch_idx_ * 8 + ch] = s.ch_uV[ch];
    }
    batch_idx_++;
    if (batch_idx_ < 6) return;
    batch_idx_ = 0;

    notifyFrame(batch_floats_);
  }

  void sendJsonTelemetry(const char *jsonStr) {
    if (!isConnected() || tel_char_ == nullptr || jsonStr == nullptr) return;
    size_t len = strlen(jsonStr);
    if (len == 0) return;
    if (len > 500) len = 500;
    const uint8_t *raw = reinterpret_cast<const uint8_t *>(jsonStr);
    tel_char_->setValue(raw, len);
    tel_char_->notify(raw, len);
  }

private:
  static constexpr uint16_t PREBUF_LEN = 250; // 1.0s @ 250 SPS (~4 KB heap)

  void notifyFrame(const float *floats48) {
    if (eeg_char_ == nullptr) return;
    uint8_t frame[197];
    frame[0] = 0xA5;
    frame[1] = 0xC2;
    frame[2] = 0x11;
    frame[3] = 0xD3;
    memcpy(frame + 4, floats48, 48 * sizeof(float)); // 192 bytes
    frame[196] = 0x5A;

    eeg_char_->notify(frame, sizeof(frame));
  }

  class ServerCallbacks : public NimBLEServerCallbacks {
  public:
    explicit ServerCallbacks(BleGattLink *owner) : owner_(owner) {}
    void onConnect(NimBLEServer *, NimBLEConnInfo &) override { owner_->connected_ = true; }
    void onDisconnect(NimBLEServer *, NimBLEConnInfo &, int) override { owner_->connected_ = false; }

  private:
    BleGattLink *owner_;
  };

  class CmdCallbacks : public NimBLECharacteristicCallbacks {
  public:
    explicit CmdCallbacks(BleGattLink *owner) : owner_(owner) {}
    void onWrite(NimBLECharacteristic *ch, NimBLEConnInfo &) override {
      std::string val = ch->getValue();
      if (!val.empty()) {
        owner_->pending_cmd_ = val.c_str();
      }
    }

  private:
    BleGattLink *owner_;
  };

  void initDeviceId() {
    if (device_id_[0] != '\0') return;
    uint64_t mac = ESP.getEfuseMac();
    uint8_t b3 = static_cast<uint8_t>((mac >> 24) & 0xFF);
    uint8_t b4 = static_cast<uint8_t>((mac >> 32) & 0xFF);
    uint8_t b5 = static_cast<uint8_t>((mac >> 40) & 0xFF);
    snprintf(device_id_, sizeof(device_id_), "NL-%02X%02X%02X", b3, b4, b5);
  }

  void ensureStarted() {
    if (initialized_) return;
    initDeviceId();
    if (prebuf_ == nullptr) {
      prebuf_ = static_cast<int16_t *>(calloc(static_cast<size_t>(PREBUF_LEN) * 8U, sizeof(int16_t)));
    }
    NimBLEDevice::init(device_id_);
    NimBLEDevice::setMTU(512);
    NimBLEDevice::setPower(3); // +3 dBm cho kết nối đeo người tiết kiệm pin

    server_ = NimBLEDevice::createServer();
    server_->setCallbacks(new ServerCallbacks(this));

    NimBLEService *svc = server_->createService(NL_BLE_SERVICE_UUID);

    eeg_char_ = svc->createCharacteristic(
      NL_BLE_EEG_CHAR_UUID,
      NIMBLE_PROPERTY::NOTIFY
    );

    tel_char_ = svc->createCharacteristic(
      NL_BLE_TEL_CHAR_UUID,
      NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
    );

    cmd_char_ = svc->createCharacteristic(
      NL_BLE_CMD_CHAR_UUID,
      NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
    );
    cmd_char_->setCallbacks(new CmdCallbacks(this));

    svc->start();

    NimBLEAdvertising *adv = NimBLEDevice::getAdvertising();
    adv->addServiceUUID(NL_BLE_SERVICE_UUID);
    adv->setName(device_id_);
    adv->enableScanResponse(true);
    adv->setPreferredParams(0x06, 0x12);
    NimBLEDevice::startAdvertising();
    initialized_ = true;
  }

  char device_id_[16] = "";
  CommandCallback on_cmd_ = nullptr;
  NimBLEServer *server_ = nullptr;
  NimBLECharacteristic *eeg_char_ = nullptr;
  NimBLECharacteristic *tel_char_ = nullptr;
  NimBLECharacteristic *cmd_char_ = nullptr;

  bool enabled_ = false;
  bool initialized_ = false;
  volatile bool connected_ = false;
  bool prev_connected_ = false;
  String pending_cmd_;

  BleStreamMode stream_mode_ = BLE_MODE_AUTO;
  bool burst_armed_ = false;
  uint32_t burst_until_ms_ = 0;
  int16_t *prebuf_ = nullptr;
  uint16_t pre_head_ = 0;
  uint16_t pre_filled_ = 0;
  uint16_t pre_drain_idx_ = 0;
  uint16_t pre_drain_rem_ = 0;

  float batch_floats_[48] = {0};
  uint8_t batch_idx_ = 0;
  uint16_t decim_cnt_ = 0;
};
