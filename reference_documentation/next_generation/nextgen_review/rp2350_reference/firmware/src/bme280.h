#pragma once
#include <stdbool.h>
#include <stdint.h>
#include "hardware/i2c.h"

typedef struct {
  int16_t temp_c_x100;
  uint16_t hum_rh_x100;
  uint32_t press_pa;
  bool ok;
} bme280_reading_t;

bool bme280_init(i2c_inst_t* i2c, uint8_t addr);
bme280_reading_t bme280_read(i2c_inst_t* i2c, uint8_t addr);
