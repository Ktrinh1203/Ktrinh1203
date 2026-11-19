#include <Arduino.h>
#include <SPI.h>
#include <Preferences.h>
#include "pins_config.h"
#include "st7735s_drv.h"
#include "ads1299_drv.h"
#include "sd_holter.h"
#include "pc_bridge.h"
#include "power_monitor.h"
#include "tinyml_stroke_edge.h"
#include "wifi_ws_link.h"

// ============================================================================
// Production Firmware v3: 8-Ch Portable EEG/EMG Holter, Edge AI & NeuroLink Bridge
// Dual-SPI + Dual-Core + Watchdog Resilience:
//   - Core 1: HSPI Mode 1 (4 MHz) đọc ADS1299 V1.4 qua ngắt DRDY -> g_ring
//   - Core 0: vspiMutex chia sẻ TFT 1.44" ST7735S + MicroSD Holter + 5-Way HMI
//   - Tier-1 Edge AI: 256-pt Radix-2 FFT + 16-Tree RF / Linear Stroke Screening
//   - Dual Link: USB Serial 921,600 bps + Optional Wi-Fi RFC6455 WebSocket
// ============================================================================

struct ChannelStats {
  float mean_uV[8] = {0};
  float rms_uV[8]  = {0};
  float pp_uV[8]   = {0};
  int samples = 0;
};

struct ButtonState {
  const char *shortName;
  const char *fullName;
  int pin;
  bool useInternalPullup;
  bool idleHigh;
  bool currentPressed;
  bool lastRawPressed;
  uint32_t lastDebounceMs;
  uint32_t pressStartMs;
  bool longFired;
  uint32_t pressCount;
};

static ButtonState g_buttons[6] = {
  {"UP",  "UP",  PIN_BTN_UP,  true,  true, false, false, 0, 0, false, 0},
  {"DN",  "DWN", PIN_BTN_DWN, true,  true, false, false, 0, 0, false, 0},
  {"LT",  "LET", PIN_BTN_LET, true,  true, false, false, 0, 0, false, 0},
  {"RT",  "RHT", PIN_BTN_RHT, true,  true, false, false, 0, 0, false, 0},
  {"OK",  "MID", PIN_BTN_MID, true,  true, false, false, 0, 0, false, 0},
  {"ST",  "SET", PIN_BTN_SET, true,  true, false, false, 0, 0, false, 0}
};

static SPIClass g_vspi(VSPI);
static SemaphoreHandle_t g_vspiMutex = nullptr;
static St7735sDriver g_tft;
static Ads1299Driver g_ads;
static SdHolterLogger g_sd;
static PcBridge g_bridge;
static PowerMonitor g_power;
static TinyMlStrokeEdge g_edgeAi;
static WifiWsLink g_wifi;
static Preferences g_prefs;
static SampleRingBuffer<256> g_ring;

static TaskHandle_t g_adsTaskHandle = nullptr;
static volatile bool g_pauseStream = true;
static volatile bool g_adsTaskPaused = false;
static volatile uint32_t g_streamTotalSamples = 0;
static volatile uint32_t g_markerCount = 0;
static uint32_t g_lastMarkerSample = 0;
static uint32_t g_markerPopupUntilMs = 0;
static uint32_t g_lastValidPopMs = 0;
static uint32_t g_lastHotplugRetryMs = 0;

// Popup thông báo trạng thái nhanh trên màn hình TFT
static char g_toastText[24] = "";
static uint16_t g_toastColor = 0xFFE0;
static uint32_t g_toastUntilMs = 0;

// Dữ liệu scope & AC-coupling DC blocker cho chế độ điện cực thật
static constexpr int SCOPE_W = 124;
static float g_scopeHist[8][SCOPE_W] = {{0}};
static float g_dcTrack[8] = {0};
static int g_scopeHead = 0;
static float g_livePp[8] = {0};
static float g_liveRms[8] = {0};
static float g_liveMin[8] = {0};
static float g_liveMax[8] = {0};
static double g_liveSum[8] = {0};
static double g_liveSq[8]  = {0};
static uint32_t g_liveStatCount = 0;
static uint32_t g_latestStatus24 = 0xC00000;
static bool g_chRail[8] = {false};

// Thang đo hiển thị sóng: 0=AUTO, 1=50uV, 2=200uV, 3=500uV, 4=2500uV
static uint8_t g_scaleIdx = 0;
static constexpr float SCALE_VALUES[5] = {0.0f, 50.0f, 200.0f, 500.0f, 2500.0f};
static constexpr const char *SCALE_NAMES[5] = {"AUTO", "50uV", "200u", "500u", "2.5m"};

// 6 Trang HMI: 0=CH1-4, 1=CH5-8, 2=8-CH Bars, 3=Lead-Off, 4=Config Menu, 5=P6: AI TRIAGE
static constexpr uint8_t NUM_UI_PAGES = 6;
static constexpr uint8_t NUM_MENU_ITEMS = 7; // 0:Mode, 1:Rate, 2:Gain, 3:BIAS, 4:Scale, 5:SD, 6:WiFi
static uint8_t g_uiPage = 0;
static bool g_menuEditMode = false;
static uint8_t g_menuCursor = 0;

static bool g_adsOk = false;
static uint8_t g_lastRegs[24] = {0};
static float g_drdyBootHz = 0.0f;
static float g_lastStreamSps = 0.0f;
static uint32_t g_fpsDisplay = 0;

static void showToast(const char *msg, uint16_t color, uint32_t durationMs = 1300) {
  strncpy(g_toastText, msg, sizeof(g_toastText) - 1);
  g_toastText[sizeof(g_toastText) - 1] = '\0';
  g_toastColor = color;
  g_toastUntilMs = millis() + durationMs;
}

static void resetScopeBuffers() {
  memset(g_scopeHist, 0, sizeof(g_scopeHist));
  memset(g_dcTrack, 0, sizeof(g_dcTrack));
  g_scopeHead = 0;
  g_liveStatCount = 0;
  for (int ch = 0; ch < 8; ++ch) {
    g_liveMin[ch] = 1e9f;
    g_liveMax[ch] = -1e9f;
    g_livePp[ch]  = 0.0f;
    g_liveRms[ch] = 0.0f;
    g_liveSum[ch] = 0.0;
    g_liveSq[ch]  = 0.0;
    g_chRail[ch]  = false;
  }
}

static void collectStatsBlocking(int maxSamples, int skipSamples, uint32_t timeoutMs, ChannelStats &out) {
  out = ChannelStats{};
  int totalNeeded = skipSamples + maxSamples;
  int got = 0;
  int validCount = 0;
  uint32_t lastEdge = g_ads_drdy_irq_count;
  uint32_t tStart = millis();

  float x0[8] = {0};
  float vmin[8] = {0};
  float vmax[8] = {0};
  double sumD[8] = {0};
  double sumSqD[8] = {0};
  AdsSample s{};

  while (got < totalNeeded && (millis() - tStart) < timeoutMs) {
    if (g_ads_drdy_irq_count != lastEdge || digitalRead(PIN_ADS_DRDY) == LOW) {
      lastEdge = g_ads_drdy_irq_count;
      if (g_ads.readFrame(s)) {
        if (got >= skipSamples) {
          for (int ch = 0; ch < 8; ++ch) {
            float v = s.ch_uV[ch];
            if (validCount == 0) {
              x0[ch] = v;
              vmin[ch] = v;
              vmax[ch] = v;
            } else {
              if (v < vmin[ch]) vmin[ch] = v;
              if (v > vmax[ch]) vmax[ch] = v;
            }
            double d = static_cast<double>(v) - static_cast<double>(x0[ch]);
            sumD[ch] += d;
            sumSqD[ch] += d * d;
          }
          validCount++;
        }
        got++;
      }
    } else {
      delayMicroseconds(100);
    }
  }

  out.samples = validCount;
  if (validCount <= 0) return;
  for (int ch = 0; ch < 8; ++ch) {
    double meanD = sumD[ch] / validCount;
    double var = (sumSqD[ch] / validCount) - (meanD * meanD);
    out.mean_uV[ch] = static_cast<float>(static_cast<double>(x0[ch]) + meanD);
    out.rms_uV[ch]  = (var > 0.0) ? static_cast<float>(sqrt(var)) : 0.0f;
    out.pp_uV[ch]   = vmax[ch] - vmin[ch];
  }
}

static void printFloatArrayJson(const char *key, const float arr[8], bool commaAfter) {
  Serial.printf("\"%s\":[", key);
  for (int i = 0; i < 8; ++i) {
    Serial.printf("%.2f%s", arr[i], (i < 7) ? "," : "");
  }
  Serial.print(commaAfter ? "]," : "]");
}

static void drawBootSplash(const char *line1, const char *line2) {
  GFXcanvas16 &c = g_tft.canvas();
  c.fillScreen(0x0000);
  c.drawRect(0, 0, 128, 128, 0x3186);
  c.fillRect(108, 3, 5, 5, 0xF800);
  c.fillRect(114, 3, 5, 5, 0x07E0);
  c.fillRect(120, 3, 5, 5, 0x001F);

  c.setTextColor(0x07FF);
  c.setTextSize(1);
  c.setCursor(6, 10);
  c.print("NEUROLINK HOLTER V3");
  c.drawFastHLine(4, 22, 120, 0x3186);

  c.setTextColor(0xFFFF);
  c.setCursor(6, 46);
  c.print(line1);
  c.setTextColor(0xFFE0);
  c.setCursor(6, 62);
  c.print(line2);
  g_tft.flush();
}

static void pauseAdsTask() {
  g_pauseStream = true;
  __sync_synchronize();
  if (g_adsTaskHandle != nullptr) {
    xTaskNotifyGive(g_adsTaskHandle);
    uint32_t t0 = millis();
    while (!g_adsTaskPaused && (millis() - t0) < 150) {
      delay(1);
    }
  }
}

static void resumeAdsTask() {
  g_ring.clear();
  g_ads.startContinuous(g_adsTaskHandle);
  g_lastValidPopMs = millis();
  g_adsTaskPaused = false;
  __sync_synchronize();
  g_pauseStream = false;
  if (g_adsTaskHandle != nullptr) {
    xTaskNotifyGive(g_adsTaskHandle);
  }
}

static void applyRuntimeSettings(const AdsSettings &nextSettings) {
  bool wasRecording = g_sd.isRecording();
  if (wasRecording) {
    g_sd.stopRecording();
  }
  pauseAdsTask();
  g_ads.stopContinuous();
  delay(5);
  bool ok = g_ads.applySettings(nextSettings, false);
  g_adsOk = g_ads.isIdOk() && ok;
  resetScopeBuffers();
  g_edgeAi.reset(g_ads.sampleRate());
  resumeAdsTask();

  if (!g_bridge.isBinaryStreaming()) {
    Serial.printf("[CFG] mode=%s rate=%u pga=%u bias=%d loff=%d mask=0x%02X ok=%d\n",
                  Ads1299Driver::inputModeShortName(nextSettings.inputMode),
                  g_ads.sampleRate(),
                  g_ads.gain(),
                  nextSettings.biasAllCh ? 1 : 0,
                  nextSettings.loffEnable ? 1 : 0,
                  nextSettings.chEnableMask,
                  ok ? 1 : 0);
  }
}

static void triggerEventMarker() {
  g_markerCount = g_markerCount + 1;
  uint16_t mk = static_cast<uint16_t>((g_markerCount & 0xFFFF) == 0 ? 1 : (g_markerCount & 0xFFFF));
  __atomic_store_n(&g_ads_pending_marker, mk, __ATOMIC_SEQ_CST);
  g_lastMarkerSample = g_streamTotalSamples;
  g_markerPopupUntilMs = millis() + 1000;
  if (!g_bridge.isBinaryStreaming()) {
    Serial.printf("[MARKER] id=%u sample=%lu\n", mk, (unsigned long)g_lastMarkerSample);
  }
}

static void toggleSdRecording() {
  if (g_sd.isRecording()) {
    g_sd.stopRecording();
    showToast("SD STOPPED", 0xFFE0);
    if (!g_bridge.isBinaryStreaming()) {
      Serial.printf("[SD] stopped samples=%lu file=%s\n",
                    (unsigned long)g_sd.samplesWritten(), g_sd.currentFile());
    }
  } else {
    if (g_sd.startRecording(g_ads)) {
      char buf[24];
      snprintf(buf, sizeof(buf), "REC %s", g_sd.currentFile() + 1);
      showToast(buf, 0x07E0);
      if (!g_bridge.isBinaryStreaming()) {
        Serial.printf("[SD] recording=%s\n", g_sd.currentFile());
      }
    } else {
      showToast("NO SD CARD", 0xF800);
      if (!g_bridge.isBinaryStreaming()) {
        Serial.println("[SD] mount/open failed (no card)");
      }
    }
  }
}

static void toggleWifiLink() {
  if (g_wifi.isEnabled()) {
    g_wifi.setEnabled(false);
    showToast("WIFI OFF", 0xFFE0);
  } else {
    if (g_wifi.setEnabled(true)) {
      showToast("WIFI CONNECTING", 0x07FF);
    } else {
      showToast("NO WIFI SSID", 0xF800);
    }
  }
}

static void saveUserPrefs() {
  const AdsSettings &s = g_ads.settings();
  g_prefs.begin("holter_cfg", false);
  g_prefs.putUChar("rate", s.rateIdx);
  g_prefs.putUChar("pga", s.pgaIdx);
  g_prefs.putUChar("mode", static_cast<uint8_t>(s.inputMode));
  g_prefs.putBool("bias", s.biasAllCh);
  g_prefs.putBool("loff", s.loffEnable);
  g_prefs.putUChar("mask", s.chEnableMask);
  g_prefs.putUChar("scale", g_scaleIdx);
  g_prefs.end();
  showToast("CFG SAVED", 0x07E0);
}

static bool loadUserPrefs(AdsSettings &out) {
  g_prefs.begin("holter_cfg", true);
  if (!g_prefs.isKey("rate")) {
    g_prefs.end();
    return false;
  }
  out.rateIdx = g_prefs.getUChar("rate", 1);
  out.pgaIdx = g_prefs.getUChar("pga", 5);
  out.inputMode = static_cast<AdsInputMode>(g_prefs.getUChar("mode", 2) % 4);
  out.biasAllCh = g_prefs.getBool("bias", true);
  out.loffEnable = g_prefs.getBool("loff", false);
  out.chEnableMask = g_prefs.getUChar("mask", 0xFF);
  g_scaleIdx = g_prefs.getUChar("scale", 0) % 5;
  g_prefs.end();
  return true;
}

static void runFullDiagnostics() {
  g_bridge.setBinaryStreaming(false);
  g_sd.stopRecording();
  pauseAdsTask();
  g_ads.stopContinuous();
  g_ring.clear();
  delay(20);

  g_power.sampleNow();
  const PowerStatus &pwr = g_power.status();

  drawBootSplash("Testing ADS1299...", "Checking ID & DRDY");
  g_adsOk = g_ads.probeAndReadRegs(g_drdyBootHz, g_lastRegs);

  ChannelStats shortStats;
  ChannelStats testStats;
  bool shortCfgOk = false;
  bool testCfgOk = false;

  if (g_adsOk) {
    drawBootSplash("ADS1299 OK!", "Shorted Noise Test");
    AdsSettings sh{};
    sh.rateIdx = 1;
    sh.pgaIdx = 6; // Gain=24
    sh.inputMode = ADS_IN_SHORT_NOISE;
    sh.biasAllCh = false;
    sh.loffEnable = false;
    shortCfgOk = g_ads.applySettings(sh, false);
    g_ads.startContinuous(nullptr);
    collectStatsBlocking(128, 15, 600, shortStats);
    g_ads.stopContinuous();

    drawBootSplash("ADS1299 OK!", "2Hz Test Signal...");
    AdsSettings ts{};
    ts.rateIdx = 1;
    ts.pgaIdx = 5; // Gain=12
    ts.inputMode = ADS_IN_TEST_SIGNAL;
    ts.biasAllCh = false;
    ts.loffEnable = false;
    testCfgOk = g_ads.applySettings(ts, false);
    g_ads.startContinuous(nullptr);
    collectStatsBlocking(350, 25, 1100, testStats);
    g_ads.stopContinuous();
  } else {
    AdsSettings ts{};
    g_ads.applySettings(ts, false);
  }

  for (int i = 0; i < 6; ++i) {
    g_buttons[i].idleHigh = (digitalRead(g_buttons[i].pin) == HIGH);
  }

  Serial.println("=== POST_REPORT_BEGIN ===");
  Serial.print("{");
  Serial.printf("\"fw\":\"esp32_ads1299_holter_v3\",");
  Serial.printf("\"sd_cs_isolated\":%s,", digitalRead(PIN_SD_CS) == HIGH ? "true" : "false");
  Serial.printf("\"sd_ready\":%s,", g_sd.isMounted() ? "true" : "false");
  Serial.printf("\"sd_mb\":%lu,", (unsigned long)g_sd.cardMb());
  Serial.printf("\"tft_ok\":%s,", g_tft.isInitialized() ? "true" : "false");
  Serial.printf("\"tft_preset\":\"%s\",", g_tft.currentPresetName());
  Serial.printf("\"id_raw\":\"0x%02X\",", g_ads.idRaw());
  Serial.printf("\"id_masked\":\"0x%02X\",", g_ads.idRaw() & 0x1F);
  Serial.printf("\"id_ok\":%s,", g_adsOk ? "true" : "false");
  Serial.printf("\"drdy_boot_hz\":%.1f,", g_drdyBootHz);
  Serial.printf("\"drdy_ok\":%s,", (g_drdyBootHz >= 200.0f && g_drdyBootHz <= 300.0f) ? "true" : "false");
  Serial.printf("\"usb_only\":%s,", pwr.usb_only ? "true" : "false");
  Serial.printf("\"vbat_mv\":%u,", pwr.vbat_mv);
  Serial.printf("\"bat_pct\":%u,", pwr.bat_pct);
  Serial.printf("\"tinyml_features\":%d,", STROKE_GLASSES_NUM_FEATURES);
  Serial.printf("\"tinyml_trees\":%d,", STROKE_GLASSES_NUM_TREES);

  Serial.print("\"regs_hex\":\"");
  for (int i = 0; i < 24; ++i) {
    Serial.printf("%02X", g_lastRegs[i]);
  }
  Serial.print("\",");

  Serial.printf("\"short_cfg_ok\":%s,", shortCfgOk ? "true" : "false");
  Serial.printf("\"short_samples\":%d,", shortStats.samples);
  printFloatArrayJson("short_mean_uV", shortStats.mean_uV, true);
  printFloatArrayJson("short_rms_uV", shortStats.rms_uV, true);
  printFloatArrayJson("short_pp_uV", shortStats.pp_uV, true);

  Serial.printf("\"test_cfg_ok\":%s,", testCfgOk ? "true" : "false");
  Serial.printf("\"test_samples\":%d,", testStats.samples);
  Serial.printf("\"expected_test_pp_uV\":3750.0,");
  printFloatArrayJson("test_pp_uV", testStats.pp_uV, true);

  Serial.print("\"buttons_idle\":{");
  for (int i = 0; i < 6; ++i) {
    Serial.printf("\"%s\":%d%s", g_buttons[i].fullName, g_buttons[i].idleHigh ? 1 : 0, (i < 5) ? "," : "");
  }
  Serial.print("}");
  Serial.println("}");
  Serial.println("=== POST_REPORT_END ===");

  AdsSettings liveDef{};
  liveDef.rateIdx = 1;                  // 500 SPS
  liveDef.pgaIdx = 5;                   // Gain 12
  liveDef.inputMode = ADS_IN_TEST_SIGNAL;
  liveDef.biasAllCh = true;
  liveDef.loffEnable = false;
  liveDef.chEnableMask = 0xFF;
  g_ads.applySettings(liveDef, false);
  resetScopeBuffers();
  g_edgeAi.reset(g_ads.sampleRate());
  resumeAdsTask();
}

static void printRuntimeInfo() {
  const PowerStatus &pwr = g_power.status();
  const EdgeAiReport &ai = g_edgeAi.report();
  String ip = g_wifi.ipString();

  Serial.printf("{\"info\":1,\"fw\":\"V3.0.0\",\"ads_ok\":%s,\"id\":\"0x%02X\",\"mode\":%d,\"mode_name\":\"%s\",\"rate_sps\":%u,\"pga\":%u,\"bias\":%s,\"loff\":%s,\"ch_mask\":\"0x%02X\",\"spi_err\":%lu,\"recoveries\":%lu,\"sd_ready\":%s,\"sd_rec\":%s,\"sd_samples\":%lu,\"sd_err\":%lu,\"markers\":%lu,\"sps\":%.1f,\"fps\":%lu,\"total\":%lu,\"dropped\":%lu,\"loff_stat_p\":%lu,\"loff_stat_n\":%lu,\"usb_only\":%s,\"vbat_mv\":%u,\"bat_pct\":%u,\"wifi_state\":\"%s\",\"wifi_ip\":\"%s\",\"ai_state\":\"%s\",\"ai_rf_prob\":%.4f,\"ai_lr_prob\":%.4f,\"ai_bsi\":%.4f,\"ai_dar\":%.2f,\"ai_usable_ch\":%u,\"ai_us\":%lu,",
                g_adsOk ? "true" : "false",
                g_ads.idRaw(),
                static_cast<int>(g_ads.mode()),
                Ads1299Driver::inputModeShortName(g_ads.mode()),
                g_ads.sampleRate(),
                g_ads.gain(),
                g_ads.settings().biasAllCh ? "true" : "false",
                g_ads.settings().loffEnable ? "true" : "false",
                g_ads.settings().chEnableMask,
                (unsigned long)g_ads.spiErrorCount(),
                (unsigned long)g_ads.recoveryCount(),
                g_sd.isMounted() ? "true" : "false",
                g_sd.isRecording() ? "true" : "false",
                (unsigned long)g_sd.samplesWritten(),
                (unsigned long)g_sd.writeErrors(),
                (unsigned long)g_markerCount,
                g_lastStreamSps,
                (unsigned long)g_fpsDisplay,
                (unsigned long)g_streamTotalSamples,
                (unsigned long)g_ring.droppedCount(),
                static_cast<unsigned long>((g_latestStatus24 >> 12) & 0xFF),
                static_cast<unsigned long>((g_latestStatus24 >> 4) & 0xFF),
                pwr.usb_only ? "true" : "false",
                pwr.vbat_mv,
                pwr.bat_pct,
                WifiWsLink::stateName(g_wifi.state()),
                ip.c_str(),
                TinyMlStrokeEdge::stateName(ai.state),
                ai.rf_prob,
                ai.lr_prob,
                ai.bsi_dar,
                ai.mean_dar,
                ai.usable_ch,
                (unsigned long)ai.latency_us);
  printFloatArrayJson("pp_uV", g_livePp, true);
  Serial.print("\"buttons_idle\":{");
  for (int i = 0; i < 6; ++i) {
    Serial.printf("\"%s\":%d%s", g_buttons[i].fullName, g_buttons[i].idleHigh ? 1 : 0, (i < 5) ? "," : "");
  }
  Serial.println("}}");
}

static void printEdgeAiJson() {
  const EdgeAiReport &ai = g_edgeAi.report();
  Serial.printf("{\"ai\":1,\"state\":\"%s\",\"rf_prob\":%.4f,\"lr_prob\":%.4f,\"mean_dar\":%.3f,\"bsi_dar\":%.4f,\"bsi_delta\":%.4f,\"usable_ch\":%u,\"eval_count\":%lu,\"latency_us\":%lu}\n",
                TinyMlStrokeEdge::stateName(ai.state),
                ai.rf_prob,
                ai.lr_prob,
                ai.mean_dar,
                ai.bsi_dar,
                ai.bsi_delta,
                ai.usable_ch,
                (unsigned long)ai.eval_count,
                (unsigned long)ai.latency_us);
}

static void printPowerJson() {
  const PowerStatus &p = g_power.status();
  Serial.printf("{\"pwr\":1,\"usb_only\":%s,\"charging\":%s,\"vbat_mv\":%u,\"bat_pct\":%u,\"low_bat\":%s,\"crit_bat\":%s}\n",
                p.usb_only ? "true" : "false",
                p.charging ? "true" : "false",
                p.vbat_mv,
                p.bat_pct,
                p.low_bat ? "true" : "false",
                p.crit_bat ? "true" : "false");
}

static void sendWifiHeartbeat() {
  if (!g_wifi.isStreaming()) return;
  const PowerStatus &pwr = g_power.status();
  const EdgeAiReport &ai = g_edgeAi.report();
  char buf[384];
  snprintf(buf, sizeof(buf),
           "{\"type\":\"telemetry\",\"fw\":\"V3.0.0\",\"mode\":\"%s\",\"rate_sps\":%u,\"pga\":%u,\"sps\":%.1f,\"sd_rec\":%s,\"markers\":%lu,\"usb_only\":%s,\"vbat_mv\":%u,\"bat_pct\":%u,\"loff_p\":%lu,\"ai_state\":\"%s\",\"ai_rf_prob\":%.4f,\"ai_lr_prob\":%.4f,\"ai_bsi\":%.4f,\"ai_dar\":%.2f,\"ai_usable_ch\":%u}",
           Ads1299Driver::inputModeShortName(g_ads.mode()),
           g_ads.sampleRate(),
           g_ads.gain(),
           g_lastStreamSps,
           g_sd.isRecording() ? "true" : "false",
           (unsigned long)g_markerCount,
           pwr.usb_only ? "true" : "false",
           pwr.vbat_mv,
           pwr.bat_pct,
           static_cast<unsigned long>((g_latestStatus24 >> 12) & 0xFF),
           TinyMlStrokeEdge::stateName(ai.state),
           ai.rf_prob,
           ai.lr_prob,
           ai.bsi_dar,
           ai.mean_dar,
           ai.usable_ch);
  g_wifi.sendJsonTelemetry(buf);
}

// Task Core 1: Thu mẫu ADS1299 thời gian thực qua DRDY -> g_ring
static void adsAcqTask(void *param) {
  (void)param;
  AdsSample s;
  for (;;) {
    if (g_pauseStream) {
      g_adsTaskPaused = true;
      ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(10));
      continue;
    }
    g_adsTaskPaused = false;
    uint32_t notified = ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(50));
    if (g_pauseStream) {
      g_adsTaskPaused = true;
      continue;
    }
    if (notified > 0 || digitalRead(PIN_ADS_DRDY) == LOW) {
      if (g_ads.readFrame(s)) {
        g_ring.push(s);
        g_streamTotalSamples = g_streamTotalSamples + 1;
      }
    }
  }
}

static void handleMenuNavigation(int btnIdx) {
  AdsSettings next = g_ads.settings();
  if (btnIdx == 0) { // UP
    g_menuCursor = (g_menuCursor + NUM_MENU_ITEMS - 1) % NUM_MENU_ITEMS;
  } else if (btnIdx == 1) { // DWN
    g_menuCursor = (g_menuCursor + 1) % NUM_MENU_ITEMS;
  } else if (btnIdx == 2 || btnIdx == 3) { // LET / RHT
    int delta = (btnIdx == 3) ? 1 : -1;
    if (g_menuCursor == 0) {
      next.inputMode = static_cast<AdsInputMode>((static_cast<int>(next.inputMode) + delta + 4) % 4);
      applyRuntimeSettings(next);
    } else if (g_menuCursor == 1) {
      next.rateIdx = static_cast<uint8_t>((static_cast<int>(next.rateIdx) + delta + 5) % 5);
      applyRuntimeSettings(next);
    } else if (g_menuCursor == 2) {
      next.pgaIdx = static_cast<uint8_t>((static_cast<int>(next.pgaIdx) + delta + 7) % 7);
      applyRuntimeSettings(next);
    } else if (g_menuCursor == 3) {
      next.biasAllCh = !next.biasAllCh;
      applyRuntimeSettings(next);
    } else if (g_menuCursor == 4) {
      g_scaleIdx = static_cast<uint8_t>((static_cast<int>(g_scaleIdx) + delta + 5) % 5);
    } else if (g_menuCursor == 5) {
      toggleSdRecording();
    } else if (g_menuCursor == 6) {
      toggleWifiLink();
    }
  }
}

static void handleNormalAction(int btnIdx) {
  if (btnIdx == 0) { // UP -> lùi trang
    g_uiPage = (g_uiPage + NUM_UI_PAGES - 1) % NUM_UI_PAGES;
  } else if (btnIdx == 1) { // DWN -> tiến trang
    g_uiPage = (g_uiPage + 1) % NUM_UI_PAGES;
  } else if (btnIdx == 2 || btnIdx == 3) { // LET / RHT
    int delta = (btnIdx == 3) ? 1 : -1;
    if (g_uiPage <= 2) {
      g_scaleIdx = static_cast<uint8_t>((static_cast<int>(g_scaleIdx) + delta + 5) % 5);
    } else if (g_uiPage == 3) {
      AdsSettings next = g_ads.settings();
      next.loffEnable = !next.loffEnable;
      applyRuntimeSettings(next);
    } else if (g_uiPage == 4) {
      g_menuEditMode = true;
      handleMenuNavigation(btnIdx);
    } else if (g_uiPage == 5) {
      toggleWifiLink();
    }
  } else if (btnIdx == 4) { // OK (MID) short press
    if (g_uiPage <= 2) {
      AdsSettings next = g_ads.settings();
      next.inputMode = static_cast<AdsInputMode>((static_cast<int>(next.inputMode) + 1) % 4);
      applyRuntimeSettings(next);
    } else if (g_uiPage == 3) {
      AdsSettings next = g_ads.settings();
      next.loffEnable = !next.loffEnable;
      applyRuntimeSettings(next);
    } else if (g_uiPage == 4) {
      g_menuEditMode = !g_menuEditMode;
    } else if (g_uiPage == 5) {
      saveUserPrefs();
    }
  }
}

static void pollButtons() {
  uint32_t now = millis();
  for (int i = 0; i < 6; ++i) {
    bool rawPressed = (digitalRead(g_buttons[i].pin) == LOW);
    if (rawPressed != g_buttons[i].lastRawPressed) {
      g_buttons[i].lastRawPressed = rawPressed;
      g_buttons[i].lastDebounceMs = now;
    }

    if ((now - g_buttons[i].lastDebounceMs) >= 25 && rawPressed != g_buttons[i].currentPressed) {
      g_buttons[i].currentPressed = rawPressed;
      if (rawPressed) {
        g_buttons[i].pressCount++;
        g_buttons[i].pressStartMs = now;
        g_buttons[i].longFired = false;

        if (!g_bridge.isBinaryStreaming()) {
          Serial.printf("[BTN_EVENT] %s PRESSED count=%lu\n",
                        g_buttons[i].fullName,
                        (unsigned long)g_buttons[i].pressCount);
        }

        if (i == 5) { // SET -> bắn Event Marker tức thì
          triggerEventMarker();
        } else if (i != 4) { // UP/DWN/LET/RHT phản hồi ngay khi bấm xuống
          if (g_uiPage == 4 && g_menuEditMode) {
            handleMenuNavigation(i);
          } else {
            handleNormalAction(i);
          }
        }
      } else {
        // Khi nhả phím MID (index 4) trước 800ms -> xử lý short press
        if (i == 4 && !g_buttons[i].longFired) {
          if (g_uiPage == 4 && g_menuEditMode) {
            g_menuEditMode = false;
          } else {
            handleNormalAction(4);
          }
        }
      }
    }

    // Kiểm tra nhấn giữ phím MID >= 800ms để Bật/Tắt ghi MicroSD Holter
    if (i == 4 && g_buttons[4].currentPressed && !g_buttons[4].longFired) {
      if ((now - g_buttons[4].pressStartMs) >= 800) {
        g_buttons[4].longFired = true;
        toggleSdRecording();
      }
    }
  }
}

static void renderWavePage(GFXcanvas16 &c, int baseCh) {
  static const uint16_t CH_COLORS[4] = {0x07FF, 0x07E0, 0xFFE0, 0xF81F};
  float fixedScale = SCALE_VALUES[g_scaleIdx];

  float autoScale = 50.0f;
  if (fixedScale <= 0.1f) {
    float maxPp = 20.0f;
    for (int lane = 0; lane < 4; ++lane) {
      if (g_livePp[baseCh + lane] > maxPp) maxPp = g_livePp[baseCh + lane];
    }
    autoScale = maxPp * 0.65f;
    if (autoScale < 25.0f) autoScale = 25.0f;
  } else {
    autoScale = fixedScale;
  }

  for (int lane = 0; lane < 4; ++lane) {
    int ch = baseCh + lane;
    int yTop = 18 + lane * 23;
    int yMid = yTop + 11;
    c.drawFastHLine(2, yMid, 124, 0x18E3);

    c.setTextColor(g_chRail[ch] ? 0xF800 : CH_COLORS[lane]);
    c.setCursor(3, yTop + 1);
    c.printf("C%d", ch + 1);

    c.setCursor(84, yTop + 1);
    if (g_chRail[ch]) {
      c.print("RAIL!");
    } else if (g_livePp[ch] >= 100.0f) {
      c.printf("%5.0f", g_livePp[ch]);
    } else {
      c.printf("%5.1f", g_livePp[ch]);
    }

    int prevY = yMid;
    for (int x = 0; x < SCOPE_W; ++x) {
      int idx = (g_scopeHead + x) % SCOPE_W;
      float norm = g_scopeHist[ch][idx] / autoScale;
      if (norm > 1.0f) norm = 1.0f;
      if (norm < -1.0f) norm = -1.0f;
      int py = yMid - static_cast<int>(norm * 9.0f);
      if (x > 0) {
        c.drawLine(1 + x, prevY, 2 + x, py, CH_COLORS[lane]);
      }
      prevY = py;
    }
  }
}

static void renderBarsPage(GFXcanvas16 &c) {
  static const uint16_t CH_COLORS[4] = {0x07FF, 0x07E0, 0xFFE0, 0xF81F};
  c.setTextColor(0xFFFF);
  c.setCursor(4, 18);
  c.printf("8CH uVpp (%s)", SCALE_NAMES[g_scaleIdx]);
  float denom = (SCALE_VALUES[g_scaleIdx] > 0.1f) ? (SCALE_VALUES[g_scaleIdx] * 2.0f) : 4000.0f;
  if (g_ads.mode() == ADS_IN_SHORT_NOISE && SCALE_VALUES[g_scaleIdx] <= 0.1f) denom = 15.0f;

  for (int ch = 0; ch < 8; ++ch) {
    int y = 29 + ch * 10;
    c.setTextColor(g_chRail[ch] ? 0xF800 : 0xAD55);
    c.setCursor(3, y);
    c.printf("%d:", ch + 1);
    float ratio = g_livePp[ch] / denom;
    if (ratio > 1.0f) ratio = 1.0f;
    int bw = static_cast<int>(ratio * 60.0f);
    c.drawRect(18, y + 1, 62, 7, 0x3186);
    if (bw > 0) c.fillRect(19, y + 2, bw, 5, g_chRail[ch] ? 0xF800 : CH_COLORS[ch % 4]);
    c.setTextColor(g_chRail[ch] ? 0xF800 : 0xFFFF);
    c.setCursor(83, y);
    if (g_livePp[ch] >= 100.0f) c.printf("%6.0f", g_livePp[ch]);
    else c.printf("%6.1f", g_livePp[ch]);
  }
}

static void renderLeadOffPage(GFXcanvas16 &c) {
  const AdsSettings &s = g_ads.settings();
  c.setTextColor(0x07FF);
  c.setCursor(4, 18);
  c.print("ELECTRODE CHECK");
  c.setCursor(100, 18);
  c.setTextColor(s.loffEnable ? 0x07E0 : 0xFFE0);
  c.print(s.loffEnable ? "ON" : "OFF");

  uint8_t statP = static_cast<uint8_t>((g_latestStatus24 >> 12) & 0xFF);
  uint8_t statN = static_cast<uint8_t>((g_latestStatus24 >> 4) & 0xFF);
  bool isElec = (s.inputMode == ADS_IN_EEG_SRB1 || s.inputMode == ADS_IN_EMG_DIFF);

  for (int ch = 0; ch < 8; ++ch) {
    int col = ch % 2;
    int row = ch / 2;
    int bx = 4 + col * 61;
    int by = 29 + row * 18;
    bool openP = ((statP >> ch) & 1) != 0;
    bool openN = (s.inputMode == ADS_IN_EMG_DIFF) && (((statN >> ch) & 1) != 0);

    uint16_t boxCol = 0x3186;
    const char *stTxt = "OK";
    if (!isElec) {
      boxCol = 0x4208;
      stTxt = "SIM";
    } else if (!s.loffEnable) {
      boxCol = g_chRail[ch] ? 0xF800 : 0x7BEF;
      stTxt = g_chRail[ch] ? "RAIL" : "IDLE";
    } else if (openP || openN || g_chRail[ch]) {
      boxCol = 0xF800;
      stTxt = openP ? "OFFP" : (openN ? "OFFN" : "RAIL");
    } else {
      boxCol = 0x07E0;
      stTxt = "GOOD";
    }

    c.drawRoundRect(bx, by, 58, 16, 2, boxCol);
    c.setTextColor(0xFFFF);
    c.setCursor(bx + 3, by + 4);
    c.printf("C%d", ch + 1);
    c.setTextColor(boxCol);
    c.setCursor(bx + 24, by + 4);
    c.print(stTxt);
  }

  c.setTextColor(0xAD55);
  c.setCursor(4, 102);
  c.print(isElec ? "OK:Toggle LOFF" : "Switch EEG/EMG");
}

static void renderEdgeAiHealthPage(GFXcanvas16 &c) {
  const EdgeAiReport &ai = g_edgeAi.report();
  const PowerStatus &pwr = g_power.status();

  c.setTextColor(0x07FF);
  c.setCursor(4, 18);
  c.print("P6: AI TRIAGE & SYS");

  uint16_t aiCol = 0x07E0;
  if (ai.state == AI_STROKE_ALERT) aiCol = ((millis() / 300) % 2) ? 0xF800 : 0xFFE0;
  else if (ai.state == AI_BORDERLINE || ai.state == AI_SQI_ABSTAIN) aiCol = 0xFD20;
  else if (ai.state == AI_SIM_MODE || ai.state == AI_WARMING_UP) aiCol = 0x07FF;

  c.drawRoundRect(3, 28, 122, 16, 2, aiCol);
  c.setTextColor(aiCol);
  c.setCursor(7, 32);
  c.printf("AI: %s", TinyMlStrokeEdge::stateName(ai.state));

  c.setTextColor(0xFFFF);
  c.setCursor(4, 48);
  c.printf("RF:%4.1f%%  LR:%4.1f%%", ai.rf_prob * 100.0f, ai.lr_prob * 100.0f);

  c.setCursor(4, 59);
  c.printf("BSI:%.3f DAR:%5.1f", ai.bsi_dar, ai.mean_dar);

  c.setCursor(4, 70);
  if (pwr.usb_only) {
    c.setTextColor(0x07E0);
    c.print("PWR: USB 5V (NO BAT)");
  } else {
    c.setTextColor(pwr.low_bat ? 0xF800 : 0x07E0);
    c.printf("BAT:%.2fV %u%%%s", pwr.vbat_mv / 1000.0f, pwr.bat_pct, pwr.charging ? " CHG" : "");
  }

  c.setTextColor(g_wifi.isStreaming() ? 0x07E0 : 0xFFE0);
  c.setCursor(4, 81);
  c.printf("NET: %s", WifiWsLink::stateName(g_wifi.state()));

  c.setTextColor(0xAD55);
  c.setCursor(4, 92);
  c.printf("SPI E:%lu R:%lu SQI:%u/8",
           (unsigned long)g_ads.spiErrorCount(),
           (unsigned long)g_ads.recoveryCount(),
           ai.usable_ch);

  c.setTextColor(0x7BEF);
  c.setCursor(4, 102);
  c.print("LT/RT:WiFi OK:Save");
}

static void renderConfigMenuPage(GFXcanvas16 &c) {
  const AdsSettings &s = g_ads.settings();
  c.setTextColor(g_menuEditMode ? 0xFD20 : 0x07FF);
  c.setCursor(4, 18);
  c.print(g_menuEditMode ? "CONFIG [EDIT MODE]" : "CONFIG (OK=Edit)");

  const char *sdStr = g_sd.isRecording() ? "REC" : (g_sd.isMounted() ? "READY" : "NO SD");
  char lines[NUM_MENU_ITEMS][22];
  snprintf(lines[0], 22, "Mode : %s", Ads1299Driver::inputModeShortName(s.inputMode));
  snprintf(lines[1], 22, "Rate : %u SPS", g_ads.sampleRate());
  snprintf(lines[2], 22, "Gain : x%u", g_ads.gain());
  snprintf(lines[3], 22, "BIAS : %s", s.biasAllCh ? "ON (RLD)" : "OFF");
  snprintf(lines[4], 22, "Scale: %s", SCALE_NAMES[g_scaleIdx]);
  snprintf(lines[5], 22, "SD   : %s", sdStr);
  snprintf(lines[6], 22, "WiFi : %s", WifiWsLink::stateName(g_wifi.state()));

  for (int i = 0; i < NUM_MENU_ITEMS; ++i) {
    int y = 29 + i * 11;
    bool sel = (g_menuEditMode && g_menuCursor == i);
    if (sel) {
      c.fillRect(3, y - 1, 122, 10, 0x0210);
      c.setTextColor(0xFFE0);
      c.setCursor(5, y);
      c.print(">");
    } else {
      c.setTextColor(0xFFFF);
    }
    c.setCursor(13, y);
    c.print(lines[i]);
  }
}

static void renderScreen() {
  GFXcanvas16 &c = g_tft.canvas();
  c.fillScreen(0x0000);
  c.drawRect(0, 0, 128, 128, g_menuEditMode ? 0xFD20 : 0x2945);

  // Header bar (y=1..15)
  c.fillRect(1, 1, 126, 14, 0x10A2);
  c.setTextSize(1);
  c.setCursor(3, 4);
  uint16_t modeCol = (g_ads.mode() == ADS_IN_TEST_SIGNAL) ? 0x07FF :
                     (g_ads.mode() == ADS_IN_SHORT_NOISE) ? 0xFD20 : 0x07E0;
  c.setTextColor(modeCol);
  c.print(Ads1299Driver::inputModeShortName(g_ads.mode()));

  c.setCursor(30, 4);
  c.setTextColor(g_adsOk ? 0xFFFF : 0xF800);
  c.printf("%u", g_ads.sampleRate());

  c.setCursor(58, 4);
  c.setTextColor(0xFFE0);
  c.printf("x%u", g_ads.gain());

  // Chỉ báo trạng thái SD Recording / WiFi WS / PC stream / Trang
  c.setCursor(82, 4);
  if (g_sd.isRecording()) {
    c.setTextColor((millis() / 400) % 2 ? 0xF800 : 0xFFE0);
    c.print("REC");
  } else if (g_wifi.isStreaming()) {
    c.setTextColor(0x07FF);
    c.print("WS ");
  } else if (g_bridge.isBinaryStreaming()) {
    c.setTextColor(0x07E0);
    c.print("PC ");
  } else {
    c.setTextColor(0xAD55);
    c.printf("P%u", g_uiPage + 1);
  }

  // 3 chấm màu RGB test panel góc phải trên
  c.fillRect(108, 4, 5, 6, 0xF800);
  c.fillRect(114, 4, 5, 6, 0x07E0);
  c.fillRect(120, 4, 5, 6, 0x001F);

  if (g_uiPage == 0) renderWavePage(c, 0);
  else if (g_uiPage == 1) renderWavePage(c, 4);
  else if (g_uiPage == 2) renderBarsPage(c);
  else if (g_uiPage == 3) renderLeadOffPage(c);
  else if (g_uiPage == 4) renderConfigMenuPage(c);
  else renderEdgeAiHealthPage(c);

  // Popup thông báo nhanh hoặc Marker
  if (millis() < g_toastUntilMs) {
    c.fillRect(14, 50, 100, 18, 0x0000);
    c.drawRect(14, 50, 100, 18, g_toastColor);
    c.setTextColor(g_toastColor);
    c.setCursor(20, 55);
    c.print(g_toastText);
  } else if (millis() < g_markerPopupUntilMs) {
    c.fillRect(36, 17, 56, 11, 0xFFE0);
    c.setTextColor(0x0000);
    c.setCursor(39, 19);
    c.printf("MKR #%lu", (unsigned long)g_markerCount);
  }

  // Thanh trạng thái 6 nút bấm ở đáy (y=112..126)
  c.drawFastHLine(1, 111, 126, 0x3186);
  for (int i = 0; i < 6; ++i) {
    int bx = 3 + i * 20;
    bool pressed = g_buttons[i].currentPressed;
    bool stuck = !g_buttons[i].idleHigh;
    uint16_t bg = pressed ? 0x07E0 : (stuck ? 0xF800 : 0x18E3);
    uint16_t fg = pressed ? 0x0000 : 0xFFFF;
    c.fillRoundRect(bx, 113, 18, 13, 2, bg);
    c.setTextColor(fg);
    c.setCursor(bx + 3, 116);
    c.print(g_buttons[i].shortName);
  }

  g_tft.flush();
}

static void onBridgeApplyParams(uint8_t rateIdx, uint8_t pgaIdx, AdsInputMode mode) {
  AdsSettings next = g_ads.settings();
  next.rateIdx = rateIdx;
  next.pgaIdx = pgaIdx;
  next.inputMode = mode;
  applyRuntimeSettings(next);
}

static void onBridgeCycleTft() {
  const char *name = g_tft.cyclePreset();
  if (!g_bridge.isBinaryStreaming()) {
    Serial.printf("[TFT] preset=%s\n", name);
  }
}

static void onBridgeSetStream(bool en) {
  (void)en;
}

static void onBridgeSdCmd(uint8_t cmd) {
  if (cmd == 0) {
    bool ok = g_sd.mount();
    if (!g_bridge.isBinaryStreaming()) {
      Serial.printf("[SD] mount=%d mb=%lu\n", ok ? 1 : 0, (unsigned long)g_sd.cardMb());
    }
  } else if (cmd == 1) {
    if (!g_sd.isRecording()) toggleSdRecording();
  } else if (cmd == 2) {
    if (g_sd.isRecording()) toggleSdRecording();
  } else if (cmd == 3) {
    g_sd.printFileListJson(Serial);
  }
}

static void onBridgeExtendedCmd(const String &cmd) {
  if (cmd == "AI" || cmd == "ai") {
    if (!g_bridge.isBinaryStreaming()) printEdgeAiJson();
  } else if (cmd == "PWR" || cmd == "pwr") {
    if (!g_bridge.isBinaryStreaming()) printPowerJson();
  } else if (cmd == "RECOVER") {
    pauseAdsTask();
    g_adsOk = g_ads.recoverHardware();
    resumeAdsTask();
    if (!g_bridge.isBinaryStreaming()) {
      Serial.printf("{\"recover\":1,\"ads_ok\":%s,\"recoveries\":%lu}\n",
                    g_adsOk ? "true" : "false",
                    (unsigned long)g_ads.recoveryCount());
    }
  } else if (cmd.startsWith("RATE ")) {
    int sps = cmd.substring(5).toInt();
    int rIdx = (sps == 250) ? 0 : (sps == 500) ? 1 : (sps == 1000) ? 2 : (sps == 2000) ? 3 : (sps == 4000) ? 4 : -1;
    if (rIdx >= 0) {
      AdsSettings next = g_ads.settings();
      next.rateIdx = static_cast<uint8_t>(rIdx);
      applyRuntimeSettings(next);
    }
  } else if (cmd.startsWith("GAIN ")) {
    int pga = cmd.substring(5).toInt();
    int pIdx = (pga == 1) ? 0 : (pga == 2) ? 1 : (pga == 4) ? 2 : (pga == 6) ? 3 : (pga == 8) ? 4 : (pga == 12) ? 5 : (pga == 24) ? 6 : -1;
    if (pIdx >= 0) {
      AdsSettings next = g_ads.settings();
      next.pgaIdx = static_cast<uint8_t>(pIdx);
      applyRuntimeSettings(next);
    }
  } else if (cmd.startsWith("LOFF ")) {
    AdsSettings next = g_ads.settings();
    next.loffEnable = (cmd.substring(5).toInt() != 0);
    applyRuntimeSettings(next);
  } else if (cmd.startsWith("BIAS ")) {
    AdsSettings next = g_ads.settings();
    next.biasAllCh = (cmd.substring(5).toInt() != 0);
    applyRuntimeSettings(next);
  } else if (cmd.startsWith("CH_MASK ")) {
    uint8_t mask = static_cast<uint8_t>(strtoul(cmd.substring(8).c_str(), nullptr, 0) & 0xFF);
    if (mask != 0) {
      AdsSettings next = g_ads.settings();
      next.chEnableMask = mask;
      applyRuntimeSettings(next);
    }
  } else if (cmd == "CFG_SAVE") {
    saveUserPrefs();
    if (!g_bridge.isBinaryStreaming()) Serial.println("{\"cfg_saved\":true}");
  } else if (cmd == "CFG_LOAD") {
    AdsSettings loaded = g_ads.settings();
    if (loadUserPrefs(loaded)) {
      applyRuntimeSettings(loaded);
    }
  } else if (cmd == "CFG_RESET") {
    g_prefs.begin("holter_cfg", false);
    g_prefs.clear();
    g_prefs.end();
    if (!g_bridge.isBinaryStreaming()) Serial.println("{\"cfg_reset\":true}");
  } else if (cmd.startsWith("WIFI_SET ")) {
    // Cú pháp: WIFI_SET <ssid>|<pass>|<host>|<port>|<path>
    String body = cmd.substring(9);
    String parts[5];
    int partIdx = 0;
    int startPos = 0;
    while (partIdx < 4) {
      int sep = body.indexOf('|', startPos);
      if (sep < 0) break;
      parts[partIdx++] = body.substring(startPos, sep);
      startPos = sep + 1;
    }
    parts[partIdx++] = body.substring(startPos);

    if (parts[0].length() > 0) {
      String ssid = parts[0];
      String pass = (partIdx >= 2) ? parts[1] : "";
      String host = (partIdx >= 3 && parts[2].length() > 0) ? parts[2] : "192.168.1.100";
      uint16_t port = (partIdx >= 4 && parts[3].toInt() > 0) ? static_cast<uint16_t>(parts[3].toInt()) : 4000;
      String path = (partIdx >= 5 && parts[4].length() > 0) ? parts[4] : "/ws/hardware";
      g_wifi.configure(ssid, pass, host, port, path);
      if (!g_bridge.isBinaryStreaming()) {
        Serial.printf("{\"wifi_cfg\":1,\"ssid\":\"%s\",\"host\":\"%s\",\"port\":%u,\"path\":\"%s\"}\n",
                      ssid.c_str(), host.c_str(), port, path.c_str());
      }
    }
  } else if (cmd == "WIFI_ON") {
    bool ok = g_wifi.setEnabled(true);
    if (!g_bridge.isBinaryStreaming()) {
      Serial.printf("{\"wifi_en\":%s,\"state\":\"%s\"}\n",
                    ok ? "true" : "false", WifiWsLink::stateName(g_wifi.state()));
    }
  } else if (cmd == "WIFI_OFF") {
    g_wifi.setEnabled(false);
    if (!g_bridge.isBinaryStreaming()) Serial.println("{\"wifi_en\":false,\"state\":\"OFF\"}");
  } else if (cmd == "WIFI_STATUS") {
    if (!g_bridge.isBinaryStreaming()) {
      String ip = g_wifi.ipString();
      Serial.printf("{\"wifi\":1,\"state\":\"%s\",\"ip\":\"%s\",\"ssid\":\"%s\",\"host\":\"%s\",\"port\":%u,\"path\":\"%s\"}\n",
                    WifiWsLink::stateName(g_wifi.state()),
                    ip.c_str(),
                    g_wifi.ssid().c_str(),
                    g_wifi.host().c_str(),
                    g_wifi.port(),
                    g_wifi.path().c_str());
    }
  }
}

static void onWifiRemoteCommand(const String &cmdLine) {
  g_bridge.processExternalCommand(cmdLine, g_ads.settings());
}

void setup() {
  pinMode(PIN_SD_CS, OUTPUT);
  digitalWrite(PIN_SD_CS, HIGH);

  Serial.begin(921600);
  delay(150);
  Serial.println("\n[BOOT] esp32_ads1299_holter v3 starting @ 921600 bps...");

  for (int i = 0; i < 6; ++i) {
    pinMode(g_buttons[i].pin, g_buttons[i].useInternalPullup ? INPUT_PULLUP : INPUT);
  }

  g_power.begin();
  g_wifi.begin(onWifiRemoteCommand);

  g_vspiMutex = xSemaphoreCreateMutex();
  g_vspi.begin(PIN_VSPI_SCK, PIN_VSPI_MISO, PIN_VSPI_MOSI, -1);

  g_tft.begin(g_vspi, g_vspiMutex);
  drawBootSplash("Booting System...", "Probing MicroSD");

  g_sd.init(g_vspi, g_vspiMutex);
  g_sd.mount(); // Thử mount 1 lần; không có thẻ vẫn tiếp tục an toàn

  PcBridge::Callbacks cb{};
  cb.onRunPost = runFullDiagnostics;
  cb.onPrintInfo = printRuntimeInfo;
  cb.onCycleTftPreset = onBridgeCycleTft;
  cb.onApplyParams = onBridgeApplyParams;
  cb.onSetBinaryStream = onBridgeSetStream;
  cb.onTriggerMarker = triggerEventMarker;
  cb.onSdCommand = onBridgeSdCmd;
  cb.onExtendedCommand = onBridgeExtendedCmd;
  g_bridge.setCallbacks(cb);

  xTaskCreatePinnedToCore(
      adsAcqTask,
      "adsAcqTask",
      4096,
      nullptr,
      5,
      &g_adsTaskHandle,
      1);

  runFullDiagnostics();
}

void loop() {
  static uint32_t lastSpsMs = millis();
  static uint32_t lastSampleCounter = 0;
  static uint32_t lastFpsMs = millis();
  static uint32_t frameCounter = 0;
  static uint32_t lastRenderMs = 0;
  static uint32_t lastWsBeatMs = 0;

  g_bridge.pollSerial(g_ads.settings());
  pollButtons();
  g_power.poll();
  g_wifi.poll();

  // Bảo vệ chống sụt áp pin (< 3.42V): tự động flush & đóng file MicroSD trước khi sập nguồn
  if (g_power.status().crit_bat && g_sd.isRecording()) {
    g_sd.stopRecording();
    showToast("BAT <3.42V SAVED", 0xF800, 2500);
    if (!g_bridge.isBinaryStreaming()) {
      Serial.println("[PWR] CRITICAL BATTERY (<3.42V) -> MicroSD recording flushed & closed safely.");
    }
  }

  AdsSample s;
  bool isElecMode = (g_ads.mode() == ADS_IN_EEG_SRB1 || g_ads.mode() == ADS_IN_EMG_DIFF);
  bool loffOn = g_ads.settings().loffEnable;
  uint16_t curRate = g_ads.sampleRate();
  uint32_t statWindow = curRate / 2;
  if (statWindow < 100) statWindow = 100;

  while (g_ring.pop(s)) {
    g_lastValidPopMs = millis();
    g_latestStatus24 = s.status24;
    g_bridge.pushSampleToStream(s);
    g_wifi.pushSample(s, curRate);
    g_sd.pushSample(s);
    g_edgeAi.pushSample(s, g_ads.mode(), loffOn);

    for (int ch = 0; ch < 8; ++ch) {
      float rawV = s.ch_uV[ch];
      float plotV = rawV;
      if (isElecMode) {
        g_dcTrack[ch] = 0.99f * g_dcTrack[ch] + 0.01f * rawV;
        plotV = rawV - g_dcTrack[ch];
      }
      g_scopeHist[ch][g_scopeHead] = plotV;

      if (abs(s.raw24[ch]) >= 8300000L) {
        g_chRail[ch] = true;
      }
      if (plotV < g_liveMin[ch]) g_liveMin[ch] = plotV;
      if (plotV > g_liveMax[ch]) g_liveMax[ch] = plotV;
      g_liveSum[ch] += plotV;
      g_liveSq[ch]  += static_cast<double>(plotV) * static_cast<double>(plotV);
    }
    g_scopeHead = (g_scopeHead + 1) % SCOPE_W;
    g_liveStatCount++;

    if (g_liveStatCount >= statWindow) {
      for (int ch = 0; ch < 8; ++ch) {
        g_livePp[ch] = g_liveMax[ch] - g_liveMin[ch];
        double mean = g_liveSum[ch] / g_liveStatCount;
        double var = (g_liveSq[ch] / g_liveStatCount) - (mean * mean);
        g_liveRms[ch] = (var > 0.0) ? static_cast<float>(sqrt(var)) : 0.0f;
        g_liveMin[ch] = 1e9f;
        g_liveMax[ch] = -1e9f;
        g_liveSum[ch] = 0.0;
        g_liveSq[ch]  = 0.0;
      }
      g_liveStatCount = 0;
      for (int ch = 0; ch < 8; ++ch) g_chRail[ch] = false;
    }
  }

  g_edgeAi.pollEvaluate();
  g_sd.periodicFlush();

  uint32_t now = millis();

  // Watchdog phần cứng ADS1299: tự phục hồi nếu mất xung DRDY > 1600 ms hoặc cắm nóng lại module
  if (!g_pauseStream) {
    if (g_adsOk && (now - g_lastValidPopMs > 1600)) {
      pauseAdsTask();
      g_adsOk = g_ads.recoverHardware();
      resumeAdsTask();
      g_lastHotplugRetryMs = now;
      showToast(g_adsOk ? "ADS RECOVERED" : "ADS DISCONN!", g_adsOk ? 0xFFE0 : 0xF800);
      if (!g_bridge.isBinaryStreaming()) {
        Serial.printf("[WDG] ADS1299 stall detected -> recover ok=%d total=%lu\n",
                      g_adsOk ? 1 : 0, (unsigned long)g_ads.recoveryCount());
      }
    } else if (!g_adsOk && (now - g_lastHotplugRetryMs > 5000)) {
      g_lastHotplugRetryMs = now;
      pauseAdsTask();
      if (g_ads.recoverHardware()) {
        g_adsOk = true;
        g_edgeAi.reset(g_ads.sampleRate());
        showToast("ADS CONNECTED", 0x07E0);
      }
      resumeAdsTask();
    }
  }

  if (now - lastWsBeatMs >= 2000) {
    lastWsBeatMs = now;
    sendWifiHeartbeat();
  }

  if (now - lastSpsMs >= 1000) {
    uint32_t curTotal = g_streamTotalSamples;
    g_lastStreamSps = static_cast<float>(curTotal - lastSampleCounter) * 1000.0f / static_cast<float>(now - lastSpsMs);
    lastSampleCounter = curTotal;
    lastSpsMs = now;
  }

  if (now - lastRenderMs >= 50) { // ~20 FPS
    lastRenderMs = now;
    renderScreen();
    frameCounter++;
  }

  if (now - lastFpsMs >= 1000) {
    g_fpsDisplay = frameCounter;
    frameCounter = 0;
    lastFpsMs = now;
  }

  delay(1);
}
