#include <Arduino.h>
#include <SPI.h>
#include "pins_config.h"
#include "st7735s_drv.h"
#include "ads1299_drv.h"
#include "sd_holter.h"
#include "pc_bridge.h"

// ============================================================================
// Production Firmware: 8-Ch Portable EEG/EMG Holter & Live Monitor
// Dual-SPI + Dual-Core:
//   - Core 1: HSPI Mode 1 (4 MHz) đọc ADS1299 V1.4 qua ngắt DRDY -> g_ring
//   - Core 0: vspiMutex chia sẻ TFT 1.44" ST7735S + MicroSD Holter + 5-Way HMI
//   - Serial 921,600 bps: Tương thích song song WinForm/Studio Binary & CLI
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
static SampleRingBuffer<512> g_ring;

static TaskHandle_t g_adsTaskHandle = nullptr;
static volatile bool g_pauseStream = true;
static volatile bool g_adsTaskPaused = false;
static volatile uint32_t g_streamTotalSamples = 0;
static volatile uint32_t g_markerCount = 0;
static uint32_t g_lastMarkerSample = 0;
static uint32_t g_markerPopupUntilMs = 0;

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

// 5 Trang HMI: 0=CH1-4, 1=CH5-8, 2=8-CH Bars, 3=Lead-Off/Imp, 4=Config/SD Menu
static uint8_t g_uiPage = 0;
static bool g_menuEditMode = false;
static uint8_t g_menuCursor = 0; // 0:Mode, 1:Rate, 2:Gain, 3:BIAS, 4:Scale, 5:SD

static bool g_adsOk = false;
static uint8_t g_lastRegs[24] = {0};
static float g_drdyBootHz = 0.0f;
static float g_lastStreamSps = 0.0f;
static uint32_t g_fpsDisplay = 0;

static AdsSample g_postBuf[360];

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

static void computeStats(const AdsSample *samples, int count, ChannelStats &out) {
  out.samples = count;
  if (count <= 0) return;

  for (int ch = 0; ch < 8; ++ch) {
    double sum = 0.0;
    float vmin = samples[0].ch_uV[ch];
    float vmax = samples[0].ch_uV[ch];
    for (int i = 0; i < count; ++i) {
      float v = samples[i].ch_uV[ch];
      sum += v;
      if (v < vmin) vmin = v;
      if (v > vmax) vmax = v;
    }
    double mean = sum / count;
    double sq = 0.0;
    for (int i = 0; i < count; ++i) {
      double d = samples[i].ch_uV[ch] - mean;
      sq += d * d;
    }
    out.mean_uV[ch] = static_cast<float>(mean);
    out.rms_uV[ch]  = static_cast<float>(sqrt(sq / count));
    out.pp_uV[ch]   = vmax - vmin;
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
  c.print("EEG HOLTER STUDIO");
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
  if (g_adsTaskHandle != nullptr) {
    xTaskNotifyGive(g_adsTaskHandle);
    uint32_t t0 = millis();
    while (!g_adsTaskPaused && (millis() - t0) < 120) {
      delay(1);
    }
  }
}

static void resumeAdsTask() {
  g_ring.clear();
  g_ads.startContinuous(g_adsTaskHandle);
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
  resetScopeBuffers();
  resumeAdsTask();

  if (!g_bridge.isBinaryStreaming()) {
    Serial.printf("[CFG] mode=%s rate=%u pga=%u bias=%d loff=%d ok=%d\n",
                  Ads1299Driver::inputModeShortName(nextSettings.inputMode),
                  g_ads.sampleRate(),
                  g_ads.gain(),
                  nextSettings.biasAllCh ? 1 : 0,
                  nextSettings.loffEnable ? 1 : 0,
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

static void runFullDiagnostics() {
  g_bridge.setBinaryStreaming(false);
  g_sd.stopRecording();
  pauseAdsTask();
  g_ads.stopContinuous();
  g_ring.clear();
  delay(20);

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
    int nShort = g_ads.collectBlocking(g_postBuf, 128, 15, 600);
    g_ads.stopContinuous();
    computeStats(g_postBuf, nShort, shortStats);

    drawBootSplash("ADS1299 OK!", "2Hz Test Signal...");
    AdsSettings ts{};
    ts.rateIdx = 1;
    ts.pgaIdx = 5; // Gain=12
    ts.inputMode = ADS_IN_TEST_SIGNAL;
    ts.biasAllCh = false;
    ts.loffEnable = false;
    testCfgOk = g_ads.applySettings(ts, false);
    g_ads.startContinuous(nullptr);
    int nTest = g_ads.collectBlocking(g_postBuf, 350, 25, 1100);
    g_ads.stopContinuous();
    computeStats(g_postBuf, nTest, testStats);
  } else {
    AdsSettings ts{};
    g_ads.applySettings(ts, false);
  }

  for (int i = 0; i < 6; ++i) {
    g_buttons[i].idleHigh = (digitalRead(g_buttons[i].pin) == HIGH);
  }

  Serial.println("=== POST_REPORT_BEGIN ===");
  Serial.print("{");
  Serial.printf("\"fw\":\"esp32_ads1299_holter_v2\",");
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
  g_ads.applySettings(liveDef, false);
  resetScopeBuffers();
  resumeAdsTask();
}

static void printRuntimeInfo() {
  Serial.printf("{\"info\":1,\"ads_ok\":%s,\"id\":\"0x%02X\",\"mode\":%d,\"mode_name\":\"%s\",\"rate_sps\":%u,\"pga\":%u,\"bias\":%s,\"loff\":%s,\"sd_ready\":%s,\"sd_rec\":%s,\"sd_samples\":%lu,\"markers\":%lu,\"sps\":%.1f,\"fps\":%lu,\"total\":%lu,\"dropped\":%lu,\"loff_stat_p\":%lu,\"loff_stat_n\":%lu,",
                g_adsOk ? "true" : "false",
                g_ads.idRaw(),
                static_cast<int>(g_ads.mode()),
                Ads1299Driver::inputModeShortName(g_ads.mode()),
                g_ads.sampleRate(),
                g_ads.gain(),
                g_ads.settings().biasAllCh ? "true" : "false",
                g_ads.settings().loffEnable ? "true" : "false",
                g_sd.isMounted() ? "true" : "false",
                g_sd.isRecording() ? "true" : "false",
                (unsigned long)g_sd.samplesWritten(),
                (unsigned long)g_markerCount,
                g_lastStreamSps,
                (unsigned long)g_fpsDisplay,
                (unsigned long)g_streamTotalSamples,
                (unsigned long)g_ring.droppedCount(),
                static_cast<unsigned long>((g_latestStatus24 >> 12) & 0xFF),
                static_cast<unsigned long>((g_latestStatus24 >> 4) & 0xFF));
  printFloatArrayJson("pp_uV", g_livePp, true);
  Serial.print("\"buttons_idle\":{");
  for (int i = 0; i < 6; ++i) {
    Serial.printf("\"%s\":%d%s", g_buttons[i].fullName, g_buttons[i].idleHigh ? 1 : 0, (i < 5) ? "," : "");
  }
  Serial.println("}}");
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
      g_ads.readFrame(s);
      g_ring.push(s);
      g_streamTotalSamples = g_streamTotalSamples + 1;
    }
  }
}

static void handleMenuNavigation(int btnIdx) {
  AdsSettings next = g_ads.settings();
  if (btnIdx == 0) { // UP
    g_menuCursor = (g_menuCursor + 5) % 6;
  } else if (btnIdx == 1) { // DWN
    g_menuCursor = (g_menuCursor + 1) % 6;
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
    }
  }
}

static void handleNormalAction(int btnIdx) {
  if (btnIdx == 0) { // UP -> lùi trang
    g_uiPage = (g_uiPage + 4) % 5;
  } else if (btnIdx == 1) { // DWN -> tiến trang
    g_uiPage = (g_uiPage + 1) % 5;
  } else if (btnIdx == 2 || btnIdx == 3) { // LET / RHT
    int delta = (btnIdx == 3) ? 1 : -1;
    if (g_uiPage <= 2) {
      g_scaleIdx = static_cast<uint8_t>((static_cast<int>(g_scaleIdx) + delta + 5) % 5);
    } else if (g_uiPage == 3) {
      AdsSettings next = g_ads.settings();
      next.loffEnable = !next.loffEnable;
      applyRuntimeSettings(next);
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

static void renderConfigMenuPage(GFXcanvas16 &c) {
  const AdsSettings &s = g_ads.settings();
  c.setTextColor(g_menuEditMode ? 0xFD20 : 0x07FF);
  c.setCursor(4, 18);
  c.print(g_menuEditMode ? "CONFIG [EDIT MODE]" : "CONFIG (OK=Edit)");

  const char *sdStr = g_sd.isRecording() ? "REC" : (g_sd.isMounted() ? "READY" : "NO SD");
  char lines[6][22];
  snprintf(lines[0], 22, "Mode : %s", Ads1299Driver::inputModeShortName(s.inputMode));
  snprintf(lines[1], 22, "Rate : %u SPS", g_ads.sampleRate());
  snprintf(lines[2], 22, "Gain : x%u", g_ads.gain());
  snprintf(lines[3], 22, "BIAS : %s", s.biasAllCh ? "ON (RLD)" : "OFF");
  snprintf(lines[4], 22, "Scale: %s", SCALE_NAMES[g_scaleIdx]);
  snprintf(lines[5], 22, "SD   : %s", sdStr);

  for (int i = 0; i < 6; ++i) {
    int y = 30 + i * 13;
    bool sel = (g_menuEditMode && g_menuCursor == i);
    if (sel) {
      c.fillRect(3, y - 1, 122, 11, 0x0210);
      c.setTextColor(0xFFE0);
      c.setCursor(5, y + 1);
      c.print(">");
    } else {
      c.setTextColor(0xFFFF);
    }
    c.setCursor(13, y + 1);
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

  // Chỉ báo trạng thái PC stream hoặc SD Recording
  c.setCursor(82, 4);
  if (g_sd.isRecording()) {
    c.setTextColor((millis() / 400) % 2 ? 0xF800 : 0xFFE0);
    c.print("REC");
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
  else renderConfigMenuPage(c);

  // Popup thông báo nhanh hoặc Marker
  if (millis() < g_toastUntilMs) {
    c.fillRect(14, 50, 100, 18, 0x0000);
    c.drawRect(14, 50, 100, 18, g_toastColor);
    c.setTextColor(g_toastColor);
    c.setCursor(22, 55);
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
  if (!en) {
    // Khởi tạo lại bộ đếm không để log rác tràn
  }
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
  }
}

void setup() {
  pinMode(PIN_SD_CS, OUTPUT);
  digitalWrite(PIN_SD_CS, HIGH);

  Serial.begin(921600);
  delay(150);
  Serial.println("\n[BOOT] esp32_ads1299_holter v2 starting @ 921600 bps...");

  for (int i = 0; i < 6; ++i) {
    pinMode(g_buttons[i].pin, g_buttons[i].useInternalPullup ? INPUT_PULLUP : INPUT);
  }

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

  g_bridge.pollSerial(g_ads.settings());
  pollButtons();

  AdsSample s;
  bool isElecMode = (g_ads.mode() == ADS_IN_EEG_SRB1 || g_ads.mode() == ADS_IN_EMG_DIFF);
  uint32_t statWindow = g_ads.sampleRate() / 2;
  if (statWindow < 100) statWindow = 100;

  while (g_ring.pop(s)) {
    g_latestStatus24 = s.status24;
    g_bridge.pushSampleToStream(s);
    g_sd.pushSample(s);

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
      // Reset cờ bão hòa cho chu kỳ mới
      for (int ch = 0; ch < 8; ++ch) g_chRail[ch] = false;
    }
  }

  g_sd.periodicFlush();

  uint32_t now = millis();
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
