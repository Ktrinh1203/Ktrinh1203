#pragma once

#include <Arduino.h>
#include "pins_config.h"

// ============================================================================
// Power & 1S LiPo Battery Telemetry Monitor (GPIO39 / ADC1_CH3, GPIO36 / ADC1_CH0)
// - Tương thích song song Wi-Fi (dùng ADC1, không đụng ADC2).
// - Tự động phân biệt chạy USB thuần trên DevKitC (chân G39 thả nổi/0V)
//   với chạy Pin LiPo qua cầu phân áp R_BAT1(100k)/R_BAT2(100k) + C_BAT(100nF).
// - Ngưỡng an toàn < 3.42V (3420 mV) tự động flush & đóng file MicroSD Holter.
// ============================================================================

struct PowerStatus {
  bool     usb_only   = true;
  bool     vbus_5v    = false;
  bool     charging   = false;
  uint16_t vbat_mv    = 0;
  uint8_t  bat_pct    = 100;
  bool     low_bat    = false;
  bool     crit_bat   = false;
};

class PowerMonitor {
public:
  static constexpr uint16_t LOW_BAT_CUTOFF_MV = 3420; // 3.42 V safe MicroSD flush threshold

  void begin() {
    pinMode(PIN_VBAT_ADC, INPUT);
    pinMode(PIN_VBUS_SENSE, INPUT);
    analogReadResolution(12);
    analogSetPinAttenuation(PIN_VBAT_ADC, ADC_11db);
    analogSetPinAttenuation(PIN_VBUS_SENSE, ADC_11db);
    initialized_ = true;
    sampleNow();
  }

  void poll() {
    if (!initialized_) return;
    uint32_t now = millis();
    if (now - last_poll_ms_ < 1000) return;
    last_poll_ms_ = now;
    sampleNow();
  }

  void sampleNow() {
    uint32_t sum_mv = 0;
    uint32_t min_mv = 99999;
    uint32_t max_mv = 0;
    for (int i = 0; i < 8; ++i) {
      uint32_t mv = analogReadMilliVolts(PIN_VBAT_ADC);
      sum_mv += mv;
      if (mv < min_mv) min_mv = mv;
      if (mv > max_mv) max_mv = mv;
      delayMicroseconds(60);
    }
    uint32_t avg_adc_mv = sum_mv / 8;
    uint32_t spread_mv = max_mv - min_mv;

    uint32_t vbus_sum = 0;
    uint32_t vbus_min = 99999;
    uint32_t vbus_max = 0;
    for (int i = 0; i < 4; ++i) {
      uint32_t mv = analogReadMilliVolts(PIN_VBUS_SENSE);
      vbus_sum += mv;
      if (mv < vbus_min) vbus_min = mv;
      if (mv > vbus_max) vbus_max = mv;
    }
    uint32_t vbus_avg = vbus_sum / 4;
    bool vbus_detected = (vbus_avg >= 1500 && (vbus_max - vbus_min) <= 120);

    // Cầu phân áp 100k/100k + tụ lọc 100nF cho dải LiPo 2.6V..4.5V -> ADC ~1300..2250 mV, độ nhiễu thấp.
    // Nếu chạy DevKitC cắm USB rời chưa hàn cầu phân áp, chân G39 < 1200 mV hoặc dao động rộng.
    bool valid_divider = (avg_adc_mv >= 1250 && avg_adc_mv <= 2350 && spread_mv <= 110);
    if (!valid_divider) {
      status_.usb_only = true;
      status_.vbus_5v = true;
      status_.charging = false;
      status_.vbat_mv = 0;
      status_.bat_pct = 100;
      status_.low_bat = false;
      status_.crit_bat = false;
      crit_strikes_ = 0;
      ema_vbat_mv_ = 0.0f;
      return;
    }

    float raw_vbat = static_cast<float>(avg_adc_mv) * 2.0f;
    if (ema_vbat_mv_ < 1000.0f) {
      ema_vbat_mv_ = raw_vbat;
    } else {
      ema_vbat_mv_ = 0.80f * ema_vbat_mv_ + 0.20f * raw_vbat;
    }

    uint16_t vbat = static_cast<uint16_t>(ema_vbat_mv_ + 0.5f);
    status_.usb_only = false;
    status_.vbus_5v = vbus_detected;
    status_.vbat_mv = vbat;
    status_.bat_pct = estimateLipoSocPct(vbat);
    status_.charging = vbus_detected || (vbat >= 4195);
    status_.low_bat = (vbat < LOW_BAT_CUTOFF_MV);

    if (vbat < LOW_BAT_CUTOFF_MV) {
      if (crit_strikes_ < 10) crit_strikes_++;
    } else if (vbat > (LOW_BAT_CUTOFF_MV + 40)) {
      crit_strikes_ = 0;
    }
    status_.crit_bat = (crit_strikes_ >= 2);
  }

  const PowerStatus &status() const { return status_; }

  static uint8_t estimateLipoSocPct(uint16_t mv) {
    // Đường cong xả phi tuyến thực tế của cell LiPo 1S 3.7V (4200 mV = 100%, 3300 mV = 0%)
    if (mv >= 4180) return 100;
    if (mv <= 3300) return 0;
    struct SocPoint { uint16_t mv; uint8_t pct; };
    static constexpr SocPoint CURVE[] = {
      {3300, 0}, {3450, 8}, {3600, 20}, {3700, 35},
      {3780, 50}, {3880, 68}, {3980, 82}, {4080, 92}, {4180, 100}
    };
    for (size_t i = 0; i + 1 < sizeof(CURVE) / sizeof(CURVE[0]); ++i) {
      if (mv >= CURVE[i].mv && mv <= CURVE[i + 1].mv) {
        float t = static_cast<float>(mv - CURVE[i].mv) /
                  static_cast<float>(CURVE[i + 1].mv - CURVE[i].mv);
        return static_cast<uint8_t>(CURVE[i].pct + t * (CURVE[i + 1].pct - CURVE[i].pct) + 0.5f);
      }
    }
    return 50;
  }

private:
  bool initialized_ = false;
  uint32_t last_poll_ms_ = 0;
  float ema_vbat_mv_ = 0.0f;
  uint8_t crit_strikes_ = 0;
  PowerStatus status_{};
};
