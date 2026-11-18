#include <Arduino.h>
#include "ads1299_drv.h"

volatile uint32_t g_ads_drdy_irq_count = 0;
volatile TaskHandle_t g_ads_stream_task = nullptr;
volatile uint16_t g_ads_pending_marker = 0;

void IRAM_ATTR ads1299_drdy_isr() {
  g_ads_drdy_irq_count = g_ads_drdy_irq_count + 1;
  TaskHandle_t task = g_ads_stream_task;
  if (task != nullptr) {
    BaseType_t woken = pdFALSE;
    vTaskNotifyGiveFromISR(task, &woken);
    if (woken) {
      portYIELD_FROM_ISR();
    }
  }
}
