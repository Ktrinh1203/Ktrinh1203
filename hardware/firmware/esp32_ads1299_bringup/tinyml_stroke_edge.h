#pragma once

#include <Arduino.h>
#include <math.h>
#include "ads1299_drv.h"
#include "stroke_glasses_esp32.h"

// ============================================================================
// Tier-1 On-Chip TinyML Acute Stroke Screening Engine (ESP32 Edge AI)
// - Ánh xạ 8 đạo trình kính thông minh: CH1..CH8 = [FP1, FP2, F3, F4, F7, F8, T3, T4]
// - Tiền xử lý nhân quả tại 250 Hz: DC Highpass 0.5 Hz + IIR Notch 50 Hz (Q=20)
// - Trích xuất đúng 98 đặc trưng (256-pt Radix-2 FFT PSD, Hjorth, Spectral Entropy,
//   4 cặp đối xứng bán cầu BSI DAR/Delta) khớp 100% stroke_glasses_esp32.h
// - Cổng kiểm soát chất lượng tín hiệu (First-Contact SQI Gate) chống báo giả
// ============================================================================

enum EdgeAiState : uint8_t {
  AI_SIM_MODE     = 0, // Đang ở chế độ TEST / SHORT_NOISE
  AI_WARMING_UP   = 1, // Chưa đủ 256 mẫu @ 250 Hz (~1.024s)
  AI_SQI_ABSTAIN  = 2, // Tuột điện cực / bão hòa RAIL / phẳng tín hiệu
  AI_NORMAL       = 3, // Nhịp nền cân đối (RF < 0.40)
  AI_BORDERLINE   = 4, // Theo dõi bất đối xứng nhẹ (0.40 <= RF < 0.55)
  AI_STROKE_ALERT = 5  // Cảnh báo nguy cơ đột quỵ cấp (RF >= 0.55)
};

struct EdgeAiReport {
  EdgeAiState state          = AI_WARMING_UP;
  float       rf_prob        = 0.0f;
  float       lr_prob        = 0.0f;
  float       mean_dar       = 0.0f;
  float       bsi_dar        = 0.0f;
  float       bsi_delta      = 0.0f;
  uint8_t     usable_ch      = 0;
  uint32_t    latency_us     = 0;
  uint32_t    eval_count     = 0;
};

class TinyMlStrokeEdge {
public:
  static constexpr int N_FFT = 256;
  static constexpr float TARGET_FS = 250.0f;

  static const char *stateName(EdgeAiState st) {
    switch (st) {
      case AI_SIM_MODE:     return "SIM_MODE";
      case AI_WARMING_UP:   return "WARMUP";
      case AI_SQI_ABSTAIN:  return "SQI_ABSTAIN";
      case AI_NORMAL:       return "NORMAL";
      case AI_BORDERLINE:   return "BORDERLINE";
      case AI_STROKE_ALERT: return "STROKE_ALERT";
      default:              return "UNKNOWN";
    }
  }

  void reset(uint16_t sampleRateSps = 500) {
    configureRate(sampleRateSps);
    write_pos_ = 0;
    filled_ = 0;
    since_eval_ = 0;
    memset(win_buf_, 0, sizeof(win_buf_));
    memset(decim_acc_, 0, sizeof(decim_acc_));
    memset(rail_latch_, 0, sizeof(rail_latch_));
    memset(hp_prev_x_, 0, sizeof(hp_prev_x_));
    memset(hp_prev_y_, 0, sizeof(hp_prev_y_));
    memset(notch_x1_, 0, sizeof(notch_x1_));
    memset(notch_x2_, 0, sizeof(notch_x2_));
    memset(notch_y1_, 0, sizeof(notch_y1_));
    memset(notch_y2_, 0, sizeof(notch_y2_));
    report_ = EdgeAiReport{};
  }

  void configureRate(uint16_t sampleRateSps) {
    uint16_t decim = sampleRateSps / 250;
    if (decim < 1) decim = 1;
    decim_factor_ = decim;
    decim_phase_ = 0;
  }

  void pushSample(const AdsSample &s, AdsInputMode mode, bool loffEnabled) {
    last_status24_ = s.status24;
    last_mode_ = mode;
    last_loff_en_ = loffEnabled;

    // Gom trung bình chống răng cưa (boxcar anti-alias) trước khi hạ tần xuống 250 Hz
    for (int ch = 0; ch < 8; ++ch) {
      decim_acc_[ch] += s.ch_uV[ch];
      if (abs(s.raw24[ch]) >= 8300000L) {
        rail_latch_[ch] = true;
      }
    }
    decim_phase_++;
    if (decim_phase_ < decim_factor_) return;

    float inv = 1.0f / static_cast<float>(decim_factor_);
    decim_phase_ = 0;

    // Hằng số bộ lọc tại fs = 250 Hz:
    // 1) 1st-order Highpass 0.5 Hz: alpha = 1 / (1 + 2*pi*0.5/250) = 0.98759f
    // 2) 2nd-order Biquad Notch 50 Hz (Q = 20): w0 = 2*pi*50/250 = 0.4*pi
    static constexpr float HP_A = 0.98759f;
    static constexpr float NB0 = 0.976775f;
    static constexpr float NB1 = -0.603680f;
    static constexpr float NB2 = 0.976775f;
    static constexpr float NA1 = -0.603680f;
    static constexpr float NA2 = 0.953550f;

    for (int ch = 0; ch < 8; ++ch) {
      float x = decim_acc_[ch] * inv;
      decim_acc_[ch] = 0.0f;

      // DC-blocker 0.5 Hz
      float y_hp = HP_A * (hp_prev_y_[ch] + x - hp_prev_x_[ch]);
      hp_prev_x_[ch] = x;
      hp_prev_y_[ch] = y_hp;

      // Notch 50 Hz
      float y_n = NB0 * y_hp + NB1 * notch_x1_[ch] + NB2 * notch_x2_[ch]
                  - NA1 * notch_y1_[ch] - NA2 * notch_y2_[ch];
      notch_x2_[ch] = notch_x1_[ch];
      notch_x1_[ch] = y_hp;
      notch_y2_[ch] = notch_y1_[ch];
      notch_y1_[ch] = y_n;

      win_buf_[ch][write_pos_] = y_n;
    }

    write_pos_ = (write_pos_ + 1) % N_FFT;
    if (filled_ < N_FFT) filled_++;
    since_eval_++;
  }

  // Chạy suy luận định kỳ mỗi 250 mẫu @ 250 Hz (~1.0 giây) ở luồng nền Core 0
  bool pollEvaluate() {
    if (filled_ < N_FFT || since_eval_ < 250) {
      if (filled_ < N_FFT) {
        report_.state = (last_mode_ == ADS_IN_TEST_SIGNAL || last_mode_ == ADS_IN_SHORT_NOISE)
                            ? AI_SIM_MODE
                            : AI_WARMING_UP;
      }
      return false;
    }
    since_eval_ = 0;
    evaluateNow();
    return true;
  }

  const EdgeAiReport &report() const { return report_; }
  const float *lastFeatures() const { return features_; }

private:
  uint16_t decim_factor_ = 2;
  uint16_t decim_phase_ = 0;
  float decim_acc_[8] = {0};

  float hp_prev_x_[8] = {0};
  float hp_prev_y_[8] = {0};
  float notch_x1_[8] = {0};
  float notch_x2_[8] = {0};
  float notch_y1_[8] = {0};
  float notch_y2_[8] = {0};

  float win_buf_[8][N_FFT] = {{0}};
  int write_pos_ = 0;
  int filled_ = 0;
  int since_eval_ = 0;

  bool rail_latch_[8] = {false};
  uint32_t last_status24_ = 0xC00000;
  AdsInputMode last_mode_ = ADS_IN_TEST_SIGNAL;
  bool last_loff_en_ = false;

  float features_[STROKE_GLASSES_NUM_FEATURES] = {0};
  EdgeAiReport report_{};

  // Bảng ánh xạ kênh vật lý ADS1299 CH1..CH8 = [FP1, FP2, F3, F4, F7, F8, T3, T4]
  // sang thứ tự khối 11 đặc trưng trong enum GlassesFeatureIndex:
  // [0:F3, 1:F4, 2:F7, 3:F8, 4:FP1, 5:FP2, 6:T3, 7:T4]
  static constexpr int PHYS_CH_TO_FEAT_BLOCK[8] PROGMEM = {4, 5, 0, 1, 2, 3, 6, 7};

  static void fft256(float re[N_FFT], float im[N_FFT]) {
    // Hoán vị đảo bit (Bit-reversal permutation)
    int j = 0;
    for (int i = 1; i < N_FFT; ++i) {
      int bit = N_FFT >> 1;
      while (j & bit) {
        j ^= bit;
        bit >>= 1;
      }
      j ^= bit;
      if (i < j) {
        float tr = re[i]; re[i] = re[j]; re[j] = tr;
        float ti = im[i]; im[i] = im[j]; im[j] = ti;
      }
    }
    // Cooley-Tukey Radix-2
    for (int len = 2; len <= N_FFT; len <<= 1) {
      float ang = -2.0f * 3.14159265358979323846f / static_cast<float>(len);
      float wlen_r = cosf(ang);
      float wlen_i = sinf(ang);
      int half = len >> 1;
      for (int i = 0; i < N_FFT; i += len) {
        float wr = 1.0f;
        float wi = 0.0f;
        for (int k = 0; k < half; ++k) {
          int u = i + k;
          int v = u + half;
          float vr = re[v] * wr - im[v] * wi;
          float vi = re[v] * wi + im[v] * wr;
          re[v] = re[u] - vr;
          im[v] = im[u] - vi;
          re[u] += vr;
          im[u] += vi;
          float next_wr = wr * wlen_r - wi * wlen_i;
          wi = wr * wlen_i + wi * wlen_r;
          wr = next_wr;
        }
      }
    }
  }

  void evaluateNow() {
    uint32_t t0 = micros();
    float re[N_FFT];
    float im[N_FFT];

    uint8_t statP = static_cast<uint8_t>((last_status24_ >> 12) & 0xFF);
    uint8_t statN = static_cast<uint8_t>((last_status24_ >> 4) & 0xFF);
    uint8_t usable = 0;

    float phys_dar[8] = {0};
    float phys_rel_delta[8] = {0};

    for (int ch = 0; ch < 8; ++ch) {
      float mean = 0.0f;
      float vmin = 1e9f;
      float vmax = -1e9f;
      for (int i = 0; i < N_FFT; ++i) {
        float v = win_buf_[ch][(write_pos_ + i) % N_FFT];
        re[i] = v;
        mean += v;
        if (v < vmin) vmin = v;
        if (v > vmax) vmax = v;
      }
      mean /= static_cast<float>(N_FFT);
      float ptp = vmax - vmin;

      bool loffBad = last_loff_en_ && (((statP >> ch) & 1) != 0 ||
                     (last_mode_ == ADS_IN_EMG_DIFF && (((statN >> ch) & 1) != 0)));
      bool chBad = rail_latch_[ch] || loffBad || (ptp < 2.0f) || (ptp > 1200.0f && last_mode_ == ADS_IN_EEG_SRB1);
      rail_latch_[ch] = false;
      if (!chBad) usable++;

      // Trừ trung bình & tính tham số Hjorth (Activity, Mobility, Complexity) trực tiếp trên re[]
      double var0 = 0.0;
      double var1 = 0.0;
      double var2 = 0.0;
      for (int i = 0; i < N_FFT; ++i) {
        re[i] -= mean;
        im[i] = 0.0f;
        var0 += static_cast<double>(re[i]) * static_cast<double>(re[i]);
      }
      var0 /= N_FFT;

      double mean_d1 = 0.0;
      for (int i = 0; i < N_FFT - 1; ++i) {
        mean_d1 += (re[i + 1] - re[i]);
      }
      mean_d1 /= (N_FFT - 1);
      for (int i = 0; i < N_FFT - 1; ++i) {
        double d1 = (re[i + 1] - re[i]) - mean_d1;
        var1 += d1 * d1;
      }
      var1 /= (N_FFT - 1);

      double mean_d2 = 0.0;
      for (int i = 0; i < N_FFT - 2; ++i) {
        mean_d2 += (re[i + 2] - 2.0f * re[i + 1] + re[i]);
      }
      mean_d2 /= (N_FFT - 2);
      for (int i = 0; i < N_FFT - 2; ++i) {
        double d2 = (re[i + 2] - 2.0f * re[i + 1] + re[i]) - mean_d2;
        var2 += d2 * d2;
      }
      var2 /= (N_FFT - 2);

      float mobility = sqrtf(static_cast<float>(var1 / (var0 + 1e-12)));
      float complexity = sqrtf(static_cast<float>((var2 / (var1 + 1e-12)) / (static_cast<double>(mobility) * mobility + 1e-12)));

      // 256-point Radix-2 FFT -> rfft PSD ghi đè tại chỗ vào re[0..128] (df = 250 / 256 = 0.9765625 Hz)
      fft256(re, im);
      float psd_sum = 1e-12f;
      const float norm_scale = 1.0f / (static_cast<float>(N_FFT) * TARGET_FS);
      for (int k = 0; k <= 128; ++k) {
        float pk = (re[k] * re[k] + im[k] * im[k]) * norm_scale;
        re[k] = pk;
        psd_sum += pk;
      }

      // Bandpower theo đúng ranh giới [0.5,4), [4,8), [8,13), [13,30), [30,45) Hz
      float delta = 0.0f, theta = 0.0f, alpha = 0.0f, beta = 0.0f, gamma = 0.0f;
      for (int k = 1; k <= 46; ++k) {
        float f = k * (TARGET_FS / static_cast<float>(N_FFT));
        if (f >= 0.5f && f < 4.0f)       delta += re[k];
        else if (f >= 4.0f && f < 8.0f)  theta += re[k];
        else if (f >= 8.0f && f < 13.0f) alpha += re[k];
        else if (f >= 13.0f && f < 30.0f) beta += re[k];
        else if (f >= 30.0f && f < 45.0f) gamma += re[k];
      }
      if (delta < 1e-12f) delta = 1e-12f;
      if (theta < 1e-12f) theta = 1e-12f;
      if (alpha < 1e-12f) alpha = 1e-12f;
      if (beta  < 1e-12f) beta  = 1e-12f;
      if (gamma < 1e-12f) gamma = 1e-12f;

      float total = delta + theta + alpha + beta + gamma + 1e-12f;
      float rel_delta = delta / total;
      float rel_theta = theta / total;
      float rel_alpha = alpha / total;
      float rel_beta  = beta  / total;
      float rel_gamma = gamma / total;

      float dar   = delta / (alpha + 1e-12f);
      float dtabr = (delta + theta) / (alpha + beta + 1e-12f);
      float tar   = theta / (alpha + 1e-12f);

      float spec_ent = 0.0f;
      for (int k = 0; k <= 128; ++k) {
        if (re[k] > 0.0f) {
          float p = re[k] / psd_sum;
          spec_ent -= p * (logf(p + 1e-12f) * 1.44269504089f); // log2
        }
      }

      phys_dar[ch] = dar;
      phys_rel_delta[ch] = rel_delta;

      int base = PHYS_CH_TO_FEAT_BLOCK[ch] * 11;
      features_[base + 0]  = dar;
      features_[base + 1]  = dtabr;
      features_[base + 2]  = complexity;
      features_[base + 3]  = mobility;
      features_[base + 4]  = rel_alpha;
      features_[base + 5]  = rel_beta;
      features_[base + 6]  = rel_delta;
      features_[base + 7]  = rel_gamma;
      features_[base + 8]  = rel_theta;
      features_[base + 9]  = spec_ent;
      features_[base + 10] = tar;
    }

    // 4 cặp đối xứng bán cầu: (FP1,FP2)=(0,1), (F3,F4)=(2,3), (F7,F8)=(4,5), (T3,T4)=(6,7)
    float sum_asym_dar = 0.0f;
    float sum_asym_delta = 0.0f;
    float sum_abs_bsi_dar = 0.0f;
    float sum_abs_bsi_delta = 0.0f;
    for (int pair = 0; pair < 4; ++pair) {
      int cL = pair * 2;
      int cR = pair * 2 + 1;
      float adar = (phys_dar[cL] - phys_dar[cR]) / (phys_dar[cL] + phys_dar[cR] + 1e-6f);
      float adel = (phys_rel_delta[cL] - phys_rel_delta[cR]) / (phys_rel_delta[cL] + phys_rel_delta[cR] + 1e-6f);
      features_[88 + pair] = adar;
      features_[92 + pair] = adel;
      sum_asym_dar += adar;
      sum_asym_delta += adel;
      sum_abs_bsi_dar += fabsf(adar);
      sum_abs_bsi_delta += fabsf(adel);
    }
    features_[96] = sum_asym_dar * 0.25f;
    features_[97] = sum_asym_delta * 0.25f;

    float rf_p = esp32_stroke_predict_rf(features_);
    float lr_p = esp32_stroke_predict_linear(features_);

    float mean_dar = 0.0f;
    for (int ch = 0; ch < 8; ++ch) mean_dar += phys_dar[ch];
    mean_dar *= 0.125f;

    report_.rf_prob = rf_p;
    report_.lr_prob = lr_p;
    report_.mean_dar = mean_dar;
    report_.bsi_dar = sum_abs_bsi_dar * 0.25f;
    report_.bsi_delta = sum_abs_bsi_delta * 0.25f;
    report_.usable_ch = usable;
    report_.eval_count++;

    if (last_mode_ == ADS_IN_TEST_SIGNAL || last_mode_ == ADS_IN_SHORT_NOISE) {
      report_.state = AI_SIM_MODE;
    } else if (usable < 6) {
      report_.state = AI_SQI_ABSTAIN;
    } else if (rf_p >= 0.55f) {
      report_.state = AI_STROKE_ALERT;
    } else if (rf_p >= 0.40f) {
      report_.state = AI_BORDERLINE;
    } else {
      report_.state = AI_NORMAL;
    }

    report_.latency_us = micros() - t0;
  }
};
