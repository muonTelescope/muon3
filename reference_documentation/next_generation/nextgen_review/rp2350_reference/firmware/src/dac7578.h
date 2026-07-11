#pragma once
#include <stdbool.h>
#include <stdint.h>
#include "hardware/i2c.h"

// TI DAC7578, 12-bit, octal I2C DAC
// Default 7-bit address commonly used: 0x4C (can vary with ADDR pins).
bool dac7578_init(i2c_inst_t* i2c, uint8_t addr);
bool dac7578_write_channel(i2c_inst_t* i2c, uint8_t addr, uint8_t ch, uint16_t code12);
bool dac7578_write_all(i2c_inst_t* i2c, uint8_t addr, const uint16_t code12[8]);
