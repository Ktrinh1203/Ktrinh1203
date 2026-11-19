#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <Preferences.h>
#include "ads1299_drv.h"

// ============================================================================
// Non-Blocking Wi-Fi + RFC 6455 WebSocket Telemetry/Stream Client
// - Mặc định TẮT lúc khởi động để giữ nhiễu nền ADS1299 đạt ~0.25 uVrms khi POST.
// - Khi bật (WIFI_ON hoặc qua Menu), tự kết nối Wi-Fi (Modem-Sleep giảm nhiễu RF)
//   và mở kết nối WebSocket chuẩn RFC 6455 tới NeuroLink Server (/ws/hardware).
// - Không phụ thuộc bất kỳ thư viện WebSocket bên thứ ba nào (0 external deps).
// ============================================================================

enum WifiLinkState : uint8_t {
  WLINK_OFF             = 0,
  WLINK_WIFI_CONNECTING = 1,
  WLINK_WS_CONNECTING   = 2,
  WLINK_WS_STREAMING    = 3,
  WLINK_BACKOFF         = 4
};

class WifiWsLink {
public:
  using CommandCallback = void (*)(const String &cmdLine);

  static const char *stateName(WifiLinkState st) {
    switch (st) {
      case WLINK_OFF:             return "OFF";
      case WLINK_WIFI_CONNECTING: return "WIFI_WAIT";
      case WLINK_WS_CONNECTING:   return "WS_HANDSHAKE";
      case WLINK_WS_STREAMING:    return "WS_ONLINE";
      case WLINK_BACKOFF:         return "RETRY_WAIT";
      default:                    return "UNK";
    }
  }

  void begin(CommandCallback onRemoteCmd = nullptr) {
    on_cmd_ = onRemoteCmd;
    prefs_.begin("holter_net", true);
    ssid_ = prefs_.getString("ssid", "");
    pass_ = prefs_.getString("pass", "");
    host_ = prefs_.getString("host", "192.168.1.100");
    port_ = prefs_.getUShort("port", 4000);
    path_ = prefs_.getString("path", "/ws/hardware");
    prefs_.end();
    WiFi.mode(WIFI_OFF);
    state_ = WLINK_OFF;
  }

  void configure(const String &ssid, const String &pass, const String &host, uint16_t port, const String &path) {
    ssid_ = ssid;
    pass_ = pass;
    if (host.length() > 0) host_ = host;
    if (port > 0) port_ = port;
    if (path.length() > 0) path_ = path;

    prefs_.begin("holter_net", false);
    prefs_.putString("ssid", ssid_);
    prefs_.putString("pass", pass_);
    prefs_.putString("host", host_);
    prefs_.putUShort("port", port_);
    prefs_.putString("path", path_);
    prefs_.end();
  }

  bool setEnabled(bool en) {
    if (!en) {
      client_.stop();
      WiFi.disconnect(true);
      WiFi.mode(WIFI_OFF);
      state_ = WLINK_OFF;
      batch_idx_ = 0;
      return true;
    }
    if (ssid_.length() == 0) {
      return false;
    }
    WiFi.mode(WIFI_STA);
    WiFi.setSleep(true); // Giảm dòng đỉnh RF bảo vệ nền nhiễu analog ADS1299
    WiFi.begin(ssid_.c_str(), pass_.c_str());
    state_ = WLINK_WIFI_CONNECTING;
    state_ts_ms_ = millis();
    batch_idx_ = 0;
    return true;
  }

  bool isEnabled() const { return state_ != WLINK_OFF; }
  bool isStreaming() const { return state_ == WLINK_WS_STREAMING; }
  WifiLinkState state() const { return state_; }
  const String &ssid() const { return ssid_; }
  const String &host() const { return host_; }
  uint16_t port() const { return port_; }
  const String &path() const { return path_; }

  String ipString() const {
    if (WiFi.status() == WL_CONNECTED) {
      return WiFi.localIP().toString();
    }
    return "0.0.0.0";
  }

  void poll() {
    if (state_ == WLINK_OFF) return;
    uint32_t now = millis();

    if (state_ == WLINK_WIFI_CONNECTING) {
      if (WiFi.status() == WL_CONNECTED) {
        startWsConnect();
      } else if (now - state_ts_ms_ > 15000) {
        WiFi.disconnect();
        WiFi.begin(ssid_.c_str(), pass_.c_str());
        state_ts_ms_ = now;
      }
      return;
    }

    if (WiFi.status() != WL_CONNECTED) {
      client_.stop();
      state_ = WLINK_WIFI_CONNECTING;
      state_ts_ms_ = now;
      return;
    }

    if (state_ == WLINK_BACKOFF) {
      if (now - state_ts_ms_ >= 3000) {
        startWsConnect();
      }
      return;
    }

    if (state_ == WLINK_WS_CONNECTING) {
      if (!client_.connected()) {
        state_ = WLINK_BACKOFF;
        state_ts_ms_ = now;
        return;
      }
      while (client_.available()) {
        char c = static_cast<char>(client_.read());
        hs_buf_ += c;
        if (hs_buf_.endsWith("\r\n\r\n")) {
          if (hs_buf_.indexOf(" 101 ") >= 0) {
            state_ = WLINK_WS_STREAMING;
            state_ts_ms_ = now;
            hs_buf_ = "";
          } else {
            client_.stop();
            state_ = WLINK_BACKOFF;
            state_ts_ms_ = now;
          }
          return;
        }
        if (hs_buf_.length() > 1024) {
          client_.stop();
          state_ = WLINK_BACKOFF;
          state_ts_ms_ = now;
          return;
        }
      }
      if (now - state_ts_ms_ > 4000) {
        client_.stop();
        state_ = WLINK_BACKOFF;
        state_ts_ms_ = now;
      }
      return;
    }

    if (state_ == WLINK_WS_STREAMING) {
      if (!client_.connected()) {
        client_.stop();
        state_ = WLINK_BACKOFF;
        state_ts_ms_ = now;
        return;
      }
      pollIncomingWsFrames();
    }
  }

  // Đẩy mẫu EEG qua WebSocket Binary (tự hạ tần xuống <= 500 SPS để không nghẽn TCP Wi-Fi)
  void pushSample(const AdsSample &s, uint16_t sampleRateSps) {
    if (state_ != WLINK_WS_STREAMING) return;
    uint16_t decim = (sampleRateSps > 500) ? (sampleRateSps / 500) : 1;
    decim_cnt_++;
    if (decim_cnt_ < decim) return;
    decim_cnt_ = 0;

    for (int ch = 0; ch < 8; ++ch) {
      batch_floats_[batch_idx_ * 8 + ch] = s.ch_uV[ch];
    }
    batch_idx_++;
    if (batch_idx_ >= 6) {
      uint8_t frame[197];
      frame[0] = 0xA5;
      frame[1] = 0xC2;
      frame[2] = 0x11;
      frame[3] = 0xD3;
      memcpy(frame + 4, batch_floats_, 192);
      frame[196] = 0x5A;
      sendWsFrame(0x02, frame, sizeof(frame));
      batch_idx_ = 0;
    }
  }

  void sendJsonTelemetry(const char *jsonStr) {
    if (state_ != WLINK_WS_STREAMING || jsonStr == nullptr) return;
    size_t n = strlen(jsonStr);
    if (n > 0 && n <= 1400) {
      sendWsFrame(0x01, reinterpret_cast<const uint8_t *>(jsonStr), n);
    }
  }

private:
  Preferences prefs_;
  WiFiClient client_;
  CommandCallback on_cmd_ = nullptr;
  WifiLinkState state_ = WLINK_OFF;
  uint32_t state_ts_ms_ = 0;

  String ssid_;
  String pass_;
  String host_ = "192.168.1.100";
  uint16_t port_ = 4000;
  String path_ = "/ws/hardware";
  String hs_buf_;

  float batch_floats_[48] = {0};
  uint8_t batch_idx_ = 0;
  uint16_t decim_cnt_ = 0;

  void startWsConnect() {
    client_.stop();
    hs_buf_ = "";
    client_.setTimeout(1);
    if (!client_.connect(host_.c_str(), port_, 350)) {
      state_ = WLINK_BACKOFF;
      state_ts_ms_ = millis();
      return;
    }
    client_.setNoDelay(true);
    String req = String("GET ") + path_ + " HTTP/1.1\r\n" +
                 "Host: " + host_ + ":" + String(port_) + "\r\n" +
                 "Upgrade: websocket\r\n" +
                 "Connection: Upgrade\r\n" +
                 "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n" +
                 "Sec-WebSocket-Version: 13\r\n" +
                 "X-Device-Id: esp32-ads1299-holter-v3\r\n\r\n";
    client_.print(req);
    state_ = WLINK_WS_CONNECTING;
    state_ts_ms_ = millis();
  }

  void sendWsFrame(uint8_t opcode, const uint8_t *payload, size_t len) {
    if (!client_.connected() || len > 1500) return;
    uint8_t hdr[10];
    size_t hlen = 0;
    hdr[hlen++] = static_cast<uint8_t>(0x80 | (opcode & 0x0F));
    if (len < 126) {
      hdr[hlen++] = static_cast<uint8_t>(0x80 | len); // Client -> Server bắt buộc bật bit MASK
    } else {
      hdr[hlen++] = static_cast<uint8_t>(0x80 | 126);
      hdr[hlen++] = static_cast<uint8_t>((len >> 8) & 0xFF);
      hdr[hlen++] = static_cast<uint8_t>(len & 0xFF);
    }
    uint32_t m = esp_random();
    uint8_t mask[4] = {
      static_cast<uint8_t>(m & 0xFF),
      static_cast<uint8_t>((m >> 8) & 0xFF),
      static_cast<uint8_t>((m >> 16) & 0xFF),
      static_cast<uint8_t>((m >> 24) & 0xFF)
    };
    memcpy(hdr + hlen, mask, 4);
    hlen += 4;

    uint8_t out[1514];
    memcpy(out, hdr, hlen);
    for (size_t i = 0; i < len; ++i) {
      out[hlen + i] = payload[i] ^ mask[i & 3];
    }
    client_.write(out, hlen + len);
  }

  void pollIncomingWsFrames() {
    while (client_.available() >= 2) {
      int b0 = client_.read();
      int b1 = client_.read();
      if (b0 < 0 || b1 < 0) break;

      uint8_t opcode = static_cast<uint8_t>(b0 & 0x0F);
      bool masked = (b1 & 0x80) != 0;
      size_t len = static_cast<size_t>(b1 & 0x7F);
      if (len == 126) {
        uint8_t extLen[2] = {0};
        if (client_.readBytes(extLen, 2) < 2) {
          client_.stop();
          return;
        }
        len = (static_cast<size_t>(extLen[0]) << 8) | static_cast<size_t>(extLen[1]);
      } else if (len == 127) {
        client_.stop();
        return;
      }

      if (len > 256) {
        client_.stop();
        return;
      }

      uint8_t mask[4] = {0};
      if (masked) {
        if (client_.readBytes(mask, 4) < 4) {
          client_.stop();
          return;
        }
      }

      char payload[257] = {0};
      size_t got = (len > 0) ? client_.readBytes(reinterpret_cast<uint8_t *>(payload), len) : 0;
      if (got < len) {
        client_.stop();
        return;
      }
      if (masked) {
        for (size_t i = 0; i < got; ++i) payload[i] ^= mask[i & 3];
      }
      payload[got] = '\0';

      if (opcode == 0x08) { // Close
        client_.stop();
        return;
      } else if (opcode == 0x09) { // Ping -> Pong
        sendWsFrame(0x0A, reinterpret_cast<const uint8_t *>(payload), got);
      } else if (opcode == 0x01 && on_cmd_ != nullptr && got > 0) { // Text command
        String cmd(payload);
        cmd.trim();
        if (cmd.length() > 0) on_cmd_(cmd);
      }
    }
  }
};
