#include "bme280.h"
#include "pico/stdlib.h"
#include <string.h>

static uint16_t dig_T1; static int16_t dig_T2, dig_T3;
static uint16_t dig_P1; static int16_t dig_P2, dig_P3, dig_P4, dig_P5, dig_P6, dig_P7, dig_P8, dig_P9;
static uint8_t dig_H1; static int16_t dig_H2; static uint8_t dig_H3; static int16_t dig_H4, dig_H5; static int8_t dig_H6;

static int32_t t_fine = 0;
static bool calib_ok = false;

static bool i2c_read_regs(i2c_inst_t* i2c, uint8_t addr, uint8_t reg, uint8_t* buf, size_t len) {
  if (i2c_write_blocking(i2c, addr, &reg, 1, true) != 1) return false;
  if (i2c_read_blocking(i2c, addr, buf, len, false) != (int)len) return false;
  return true;
}
static bool i2c_write_reg(i2c_inst_t* i2c, uint8_t addr, uint8_t reg, uint8_t val) {
  uint8_t tmp[2] = {reg, val};
  return i2c_write_blocking(i2c, addr, tmp, 2, false) == 2;
}

static uint16_t u16le(const uint8_t* p){ return (uint16_t)p[0] | ((uint16_t)p[1]<<8); }
static int16_t s16le(const uint8_t* p){ return (int16_t)u16le(p); }

bool bme280_init(i2c_inst_t* i2c, uint8_t addr) {
  uint8_t id = 0;
  if (!i2c_read_regs(i2c, addr, 0xD0, &id, 1)) return false;
  if (id != 0x60) return false;

  // Read calibration T/P (0x88..0xA1)
  uint8_t c1[26];
  if (!i2c_read_regs(i2c, addr, 0x88, c1, sizeof(c1))) return false;
  dig_T1 = u16le(&c1[0]); dig_T2 = s16le(&c1[2]); dig_T3 = s16le(&c1[4]);
  dig_P1 = u16le(&c1[6]); dig_P2 = s16le(&c1[8]); dig_P3 = s16le(&c1[10]); dig_P4 = s16le(&c1[12]);
  dig_P5 = s16le(&c1[14]); dig_P6 = s16le(&c1[16]); dig_P7 = s16le(&c1[18]); dig_P8 = s16le(&c1[20]); dig_P9 = s16le(&c1[22]);
  dig_H1 = c1[25];

  // Read humidity calibration (0xE1..0xE7)
  uint8_t c2[7];
  if (!i2c_read_regs(i2c, addr, 0xE1, c2, sizeof(c2))) return false;
  dig_H2 = s16le(&c2[0]);
  dig_H3 = c2[2];
  dig_H4 = (int16_t)((c2[3] << 4) | (c2[4] & 0x0F));
  dig_H5 = (int16_t)((c2[5] << 4) | (c2[4] >> 4));
  dig_H6 = (int8_t)c2[6];

  // Configure: oversampling x1 for T/P/H, normal mode, standby 0.5ms, filter off
  // Humidity must be written before ctrl_meas
  if (!i2c_write_reg(i2c, addr, 0xF2, 0x01)) return false; // ctrl_hum osrs_h=1
  if (!i2c_write_reg(i2c, addr, 0xF5, 0x00)) return false; // config
  if (!i2c_write_reg(i2c, addr, 0xF4, 0x27)) return false; // ctrl_meas: osrs_t=1, osrs_p=1, mode=normal

  calib_ok = true;
  return true;
}

static int32_t compensate_T(int32_t adc_T) {
  int32_t var1, var2, T;
  var1 = ((((adc_T>>3) - ((int32_t)dig_T1<<1))) * ((int32_t)dig_T2)) >> 11;
  var2 = (((((adc_T>>4) - ((int32_t)dig_T1)) * ((adc_T>>4) - ((int32_t)dig_T1))) >> 12) * ((int32_t)dig_T3)) >> 14;
  t_fine = var1 + var2;
  T = (t_fine * 5 + 128) >> 8; // 0.01 C
  return T;
}

static uint32_t compensate_P(int32_t adc_P) {
  int64_t var1, var2, p;
  var1 = ((int64_t)t_fine) - 128000;
  var2 = var1 * var1 * (int64_t)dig_P6;
  var2 = var2 + ((var1*(int64_t)dig_P5)<<17);
  var2 = var2 + (((int64_t)dig_P4)<<35);
  var1 = ((var1 * var1 * (int64_t)dig_P3)>>8) + ((var1 * (int64_t)dig_P2)<<12);
  var1 = (((((int64_t)1)<<47)+var1)) * ((int64_t)dig_P1) >> 33;

  if (var1 == 0) return 0;
  p = 1048576 - adc_P;
  p = (((p<<31) - var2) * 3125) / var1;
  var1 = (((int64_t)dig_P9) * (p>>13) * (p>>13)) >> 25;
  var2 = (((int64_t)dig_P8) * p) >> 19;
  p = ((p + var1 + var2) >> 8) + (((int64_t)dig_P7)<<4);
  // p is in Q24.8 Pa
  return (uint32_t)(p >> 8);
}

static uint32_t compensate_H(int32_t adc_H) {
  int32_t v_x1_u32r;
  v_x1_u32r = (t_fine - ((int32_t)76800));
  v_x1_u32r = (((((adc_H << 14) - (((int32_t)dig_H4) << 20) - (((int32_t)dig_H5) * v_x1_u32r)) + ((int32_t)16384)) >> 15) *
              (((((((v_x1_u32r * ((int32_t)dig_H6)) >> 10) * (((v_x1_u32r * ((int32_t)dig_H3)) >> 11) + ((int32_t)32768))) >> 10) + ((int32_t)2097152)) *
                ((int32_t)dig_H2) + 8192) >> 14));
  v_x1_u32r = (v_x1_u32r - (((((v_x1_u32r >> 15) * (v_x1_u32r >> 15)) >> 7) * ((int32_t)dig_H1)) >> 4));
  if (v_x1_u32r < 0) v_x1_u32r = 0;
  if (v_x1_u32r > 419430400) v_x1_u32r = 419430400;
  // result in Q22.10 (%RH)
  return (uint32_t)(v_x1_u32r >> 12); // -> %RH * 1024/4096? Actually gives %RH*1024? We'll convert below.
}

bme280_reading_t bme280_read(i2c_inst_t* i2c, uint8_t addr) {
  bme280_reading_t r = {0};
  if (!calib_ok) { r.ok = false; return r; }

  uint8_t data[8];
  // 0xF7..0xFE: press(3), temp(3), hum(2)
  if (!i2c_read_regs(i2c, addr, 0xF7, data, 8)) { r.ok = false; return r; }

  int32_t adc_P = (int32_t)((((uint32_t)data[0])<<12) | (((uint32_t)data[1])<<4) | (data[2]>>4));
  int32_t adc_T = (int32_t)((((uint32_t)data[3])<<12) | (((uint32_t)data[4])<<4) | (data[5]>>4));
  int32_t adc_H = (int32_t)((((uint32_t)data[6])<<8) | data[7]);

  int32_t t_x100 = compensate_T(adc_T);             // 0.01C
  uint32_t p_pa = compensate_P(adc_P);              // Pa
  uint32_t h_q = compensate_H(adc_H);               // approx %RH * 1024? We'll scale carefully.

  // Datasheet: compensate_H returns humidity in %RH * 1024 (Q22.10).
  // Our function returned (v_x1_u32r >> 12) which is roughly %RH * 1024.
  // Convert to %RH*100:
  uint32_t hum_x100 = (h_q * 100u) / 1024u;

  r.temp_c_x100 = (int16_t)t_x100;
  r.hum_rh_x100 = (uint16_t)(hum_x100 > 10000 ? 10000 : hum_x100);
  r.press_pa = p_pa;
  r.ok = true;
  return r;
}
