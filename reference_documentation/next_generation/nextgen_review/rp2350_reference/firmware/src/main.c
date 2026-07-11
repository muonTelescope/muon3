#include <stdio.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>

#include "pico/stdlib.h"
#include "pico/multicore.h"
#include "hardware/pio.h"
#include "hardware/i2c.h"
#include "hardware/irq.h"
#include "hardware/timer.h"

#include "tusb.h"

#include "edge_fall.pio.h"
#include "proto.h"
#include "bme280.h"
#include "dac7578.h"

// --- Pin map (from your schematic) ---
#define PIN_CH0 16
#define PIN_CH1 17
#define PIN_CH2 18
#define PIN_CH3 19
#define PIN_MAX1932_INT 22

#define PIN_I2C_SDA 4
#define PIN_I2C_SCL 5

// I2C addresses
#define BME280_ADDR 0x77  // SDO tied high
#define DAC7578_ADDR 0x4C // common default (see Adafruit docs)

// --- Capture ring buffer (core1 -> core0) ---
typedef struct { uint8_t ch; uint32_t ts; } edge_evt_t;
#define EVT_Q_SIZE 2048
static edge_evt_t evt_q[EVT_Q_SIZE];
static volatile uint32_t evt_w = 0;
static volatile uint32_t evt_r = 0;
static volatile uint32_t evt_drop = 0;

static inline bool evt_push(uint8_t ch, uint32_t ts) {
  uint32_t w = evt_w;
  uint32_t n = (w + 1) & (EVT_Q_SIZE - 1);
  if (n == evt_r) { evt_drop++; return false; }
  evt_q[w] = (edge_evt_t){ .ch = ch, .ts = ts };
  __compiler_memory_barrier();
  evt_w = n;
  return true;
}

static inline bool evt_pop(edge_evt_t* out) {
  uint32_t r = evt_r;
  if (r == evt_w) return false;
  *out = evt_q[r];
  __compiler_memory_barrier();
  evt_r = (r + 1) & (EVT_Q_SIZE - 1);
  return true;
}

// --- Counters ---
static uint32_t singles[4];
static uint32_t subset_counts[16]; // exact subset counts by mask index (1..15)

// exact subset masks ordering for report
static const uint8_t subset_order[11] = { 3,5,9,6,10,12,7,11,13,14,15 };

// --- Coincidence clustering state ---
static bool cluster_active = false;
static uint32_t cluster_tmin = 0;
static uint32_t cluster_tmax = 0;
static uint8_t cluster_mask = 0;
static uint32_t holdoff_until = 0;

// Config
static uint32_t report_period_ms = 60000;
static uint16_t window_ticks = 20;   // in PIO-loop ticks (not ns); adjust from dashboard
static uint16_t holdoff_ticks = 20;

// Status
static uint32_t err_flags = 0;
static uint32_t period_index = 0;
static absolute_time_t boot_time;

// I2C
static i2c_inst_t* I2C = i2c0;
static bool bme_ok = false;
static bool dac_ok = false;
static uint16_t dac_code[8] = {0,0,0,0, 0,0,0,0}; // 12-bit codes

// --- Helpers ---
static inline uint32_t uptime_ms(void) {
  return to_ms_since_boot(get_absolute_time());
}

static inline uint32_t ticks_diff(uint32_t a, uint32_t b) {
  return (uint32_t)(a - b); // wrap-safe unsigned
}

static void close_cluster_if_active(void) {
  if (!cluster_active) return;
  if (cluster_mask >= 1 && cluster_mask <= 15) {
    if (cluster_mask != 0) subset_counts[cluster_mask]++;
  }
  holdoff_until = cluster_tmax + holdoff_ticks;
  cluster_active = false;
  cluster_mask = 0;
}

static void on_leading_edge(uint8_t ch, uint32_t ts) {
  // raw singles always count
  if (ch < 4) singles[ch]++;

  // MAX1932 fault pin latch
  if (gpio_get(PIN_MAX1932_INT) == 0) err_flags |= ERR_MAX1932_INT;

  // coincidence processing
  if (ticks_diff(ts, holdoff_until) < 0x80000000u) { // ts >= holdoff_until in unsigned sense?
    // This check is tricky with wrap; simplest: if (ts - holdoff_until) has MSB set, ts < holdoff_until.
    // We'll do that:
  }
  // better wrap-safe:
  if ((int32_t)(ts - holdoff_until) < 0) {
    return;
  }

  uint8_t bit = (uint8_t)(1u << ch);
  if (!cluster_active) {
    cluster_active = true;
    cluster_tmin = cluster_tmax = ts;
    cluster_mask = bit;
    return;
  }

  // If within window from cluster start, merge; else close and start new
  if ((uint16_t)(ts - cluster_tmin) <= window_ticks) {
    cluster_tmax = ts;
    cluster_mask |= bit;
  } else {
    close_cluster_if_active();
    cluster_active = true;
    cluster_tmin = cluster_tmax = ts;
    cluster_mask = bit;
  }
}

static void reset_counters(void) {
  memset(singles, 0, sizeof(singles));
  memset(subset_counts, 0, sizeof(subset_counts));
  cluster_active = false;
  cluster_mask = 0;
  holdoff_until = 0;
  evt_drop = 0;
}

// --- USB framing payload packing ---
static uint16_t pack_u16(uint8_t* p, uint16_t v){ p[0]=v&0xFF; p[1]=v>>8; return 2; }
static uint16_t pack_u32(uint8_t* p, uint32_t v){ p[0]=v&0xFF; p[1]=v>>8; p[2]=v>>16; p[3]=v>>24; return 4; }
static uint16_t pack_i16(uint8_t* p, int16_t v){ return pack_u16(p, (uint16_t)v); }

static void send_report(bme280_reading_t bme) {
  uint8_t payload[256];
  uint16_t off = 0;

  off += pack_u32(payload+off, period_index);
  off += pack_u32(payload+off, report_period_ms);
  off += pack_u16(payload+off, window_ticks);
  off += pack_u16(payload+off, holdoff_ticks);

  for (int i=0;i<4;i++) off += pack_u32(payload+off, singles[i]);

  for (int i=0;i<11;i++) {
    uint8_t m = subset_order[i];
    off += pack_u32(payload+off, subset_counts[m]);
  }

  off += pack_i16(payload+off, bme.temp_c_x100);
  off += pack_u16(payload+off, bme.hum_rh_x100);
  off += pack_u32(payload+off, bme.press_pa);

  for (int i=0;i<8;i++) off += pack_u16(payload+off, dac_code[i]);

  off += pack_u32(payload+off, evt_drop);
  off += pack_u32(payload+off, err_flags);
  off += pack_u32(payload+off, uptime_ms());

  if (!proto_send_report(payload, off)) {
    err_flags |= ERR_USB_BACKLOG;
  }
}

// --- Command handling ---
static void handle_cmd(uint8_t cmd_id, uint8_t seq, const uint8_t* args, uint16_t arg_len) {
  uint8_t status = 0;
  uint8_t ret[64];
  uint16_t ret_len = 0;

  switch (cmd_id) {
    case CMD_SET_REPORT_PERIOD_MS:
      if (arg_len != 4) { status = 1; break; }
      report_period_ms = (uint32_t)args[0] | ((uint32_t)args[1]<<8) | ((uint32_t)args[2]<<16) | ((uint32_t)args[3]<<24);
      if (report_period_ms < 200) report_period_ms = 200;
      break;

    case CMD_SET_WINDOW_TICKS:
      if (arg_len != 2) { status = 1; break; }
      window_ticks = (uint16_t)args[0] | ((uint16_t)args[1]<<8);
      break;

    case CMD_SET_HOLDOFF_TICKS:
      if (arg_len != 2) { status = 1; break; }
      holdoff_ticks = (uint16_t)args[0] | ((uint16_t)args[1]<<8);
      break;

    case CMD_RESET_COUNTERS:
      if (arg_len != 0) { status = 1; break; }
      reset_counters();
      period_index = 0;
      break;

    case CMD_DAC_SET_CH: {
      if (arg_len != 3) { status = 1; break; }
      uint8_t ch = args[0];
      uint16_t code = (uint16_t)args[1] | ((uint16_t)args[2]<<8);
      if (ch > 7 || code > 4095) { status = 2; break; }
      dac_code[ch] = code;
      if (!dac7578_write_channel(I2C, DAC7578_ADDR, ch, code)) {
        err_flags |= ERR_DAC_FAIL; status = 3;
      }
      break;
    }

    case CMD_DAC_SET_ALL: {
      if (arg_len != 16) { status = 1; break; }
      for (int i=0;i<8;i++) {
        uint16_t code = (uint16_t)args[i*2] | ((uint16_t)args[i*2+1]<<8);
        dac_code[i] = (code & 0x0FFF);
      }
      if (!dac7578_write_all(I2C, DAC7578_ADDR, dac_code)) {
        err_flags |= ERR_DAC_FAIL; status = 3;
      }
      break;
    }

    case CMD_DAC_GET_ALL: {
      if (arg_len != 0) { status = 1; break; }
      // return cached values (device is source of truth)
      for (int i=0;i<8;i++) {
        ret[ret_len++] = (uint8_t)(dac_code[i] & 0xFF);
        ret[ret_len++] = (uint8_t)(dac_code[i] >> 8);
      }
      break;
    }

    case CMD_GET_STATUS: {
      // Return: period_ms(u32), window(u16), holdoff(u16), err_flags(u32), uptime_ms(u32)
      ret_len = 0;
      ret_len += pack_u32(ret+ret_len, report_period_ms);
      ret_len += pack_u16(ret+ret_len, window_ticks);
      ret_len += pack_u16(ret+ret_len, holdoff_ticks);
      ret_len += pack_u32(ret+ret_len, err_flags);
      ret_len += pack_u32(ret+ret_len, uptime_ms());
      break;
    }

    default:
      status = 0xFF;
      break;
  }

  if (!proto_send_ack(cmd_id, seq, status, ret, ret_len)) {
    err_flags |= ERR_USB_BACKLOG;
  }
}

// --- Core1: PIO capture ---
static void core1_entry(void) {
  PIO pio = pio0;
  uint offset = pio_add_program(pio, &edge_fall_program);

  // Configure GPIOs as inputs with pull-ups (active-low pulses)
  const uint pins[4] = {PIN_CH0, PIN_CH1, PIN_CH2, PIN_CH3};
  for (int i=0;i<4;i++) {
    gpio_init(pins[i]);
    gpio_set_dir(pins[i], GPIO_IN);
    gpio_pull_up(pins[i]);
  }

  uint sm_mask = 0;
  for (int ch=0; ch<4; ch++) {
    uint sm = ch; // SM 0..3
    pio_sm_config c = edge_fall_program_get_default_config(offset);

    // Use JMP PIN for this channel
    sm_config_set_jmp_pin(&c, pins[ch]);

    // RX FIFO only, joined for deeper FIFO
    sm_config_set_fifo_join(&c, PIO_FIFO_JOIN_RX);

    // Run at full pio clock (clkdiv=1)
    sm_config_set_clkdiv(&c, 1.0f);

    pio_sm_init(pio, sm, offset, &c);
    pio_sm_set_enabled(pio, sm, false);
    sm_mask |= (1u << sm);
  }

  // Start all SMs in sync
  pio_enable_sm_mask_in_sync(pio, sm_mask);

  while (true) {
    // Drain FIFO for each SM
    for (int ch=0; ch<4; ch++) {
      uint sm = ch;
      while (!pio_sm_is_rx_fifo_empty(pio, sm)) {
        uint32_t ts = pio_sm_get(pio, sm);
        evt_push((uint8_t)ch, ts);
      }
    }
    tight_loop_contents();
  }
}

int main() {
  stdio_init_all();
  boot_time = get_absolute_time();

  // MAX1932 INT input (active low)
  gpio_init(PIN_MAX1932_INT);
  gpio_set_dir(PIN_MAX1932_INT, GPIO_IN);
  gpio_pull_up(PIN_MAX1932_INT);

  // I2C init
  i2c_init(I2C, 400 * 1000);
  gpio_set_function(PIN_I2C_SDA, GPIO_FUNC_I2C);
  gpio_set_function(PIN_I2C_SCL, GPIO_FUNC_I2C);
  gpio_pull_up(PIN_I2C_SDA);
  gpio_pull_up(PIN_I2C_SCL);

  bme_ok = bme280_init(I2C, BME280_ADDR);
  if (!bme_ok) err_flags |= ERR_BME_FAIL;

  dac_ok = dac7578_init(I2C, DAC7578_ADDR);
  if (!dac_ok) err_flags |= ERR_DAC_FAIL;

  // Apply initial DAC codes
  if (!dac7578_write_all(I2C, DAC7578_ADDR, dac_code)) err_flags |= ERR_DAC_FAIL;

  // USB init
  tusb_init();

  // Launch capture core
  multicore_launch_core1(core1_entry);

  absolute_time_t next_report = make_timeout_time_ms(report_period_ms);

  while (true) {
    tud_task();

    // RX bytes -> parser
    if (tud_cdc_available()) {
      uint8_t buf[64];
      uint32_t n = tud_cdc_read(buf, sizeof(buf));
      for (uint32_t i=0;i<n;i++) {
        bool ok = proto_try_parse_byte(buf[i]);
        (void)ok;
      }
    }

    // Handle parsed commands
    if (proto_have_cmd()) {
      uint8_t cmd_id, seq;
      uint16_t arg_len;
      uint8_t args[512];
      if (proto_pop_cmd(&cmd_id, &seq, &arg_len, args, sizeof(args))) {
        handle_cmd(cmd_id, seq, args, arg_len);
      } else {
        err_flags |= ERR_RX_FRAMING;
      }
    }

    // Process captured edges
    edge_evt_t ev;
    while (evt_pop(&ev)) {
      on_leading_edge(ev.ch, ev.ts);
    }

    // Report timer
    if (absolute_time_diff_us(get_absolute_time(), next_report) <= 0) {
      // Flush cluster so last event doesn't get lost at boundary
      close_cluster_if_active();

      bme280_reading_t bme = bme280_read(I2C, BME280_ADDR);
      if (!bme.ok) {
        err_flags |= ERR_BME_FAIL;
        // keep last values as zero
      }

      send_report(bme);

      // Increment period
      period_index++;

      // Reset counters for next period
      reset_counters();

      // Schedule next report with drift-free increment
      next_report = delayed_by_ms(next_report, report_period_ms);
    }

    tight_loop_contents();
  }
}
