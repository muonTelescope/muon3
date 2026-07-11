#include "dac7578.h"
#include <string.h>

// Command byte format per DACx578 family:
// - Upper nibble selects register/command, lower nibble selects channel.
// We'll use the "Write to DAC Register n" command.
// Many implementations use command 0x30 | ch for DAC write, followed by MSB, LSB.
// This matches common references for DAC7578 at addr 0x4C.
static bool i2c_write_bytes(i2c_inst_t* i2c, uint8_t addr, const uint8_t* buf, size_t len) {
  return i2c_write_blocking(i2c, addr, buf, len, false) == (int)len;
}

bool dac7578_init(i2c_inst_t* i2c, uint8_t addr) {
  // No special init required if LDAC# is tied low (immediate update).
  // We'll just probe by attempting a harmless write to channel 0 with 0.
  return dac7578_write_channel(i2c, addr, 0, 0);
}

bool dac7578_write_channel(i2c_inst_t* i2c, uint8_t addr, uint8_t ch, uint16_t code12) {
  if (ch > 7) return false;
  code12 &= 0x0FFF;
  uint8_t cmd = (uint8_t)(0x30 | (ch & 0x0F)); // write DAC reg n
  uint8_t buf[3];
  buf[0] = cmd;
  buf[1] = (uint8_t)(code12 >> 4);            // MSB (D11..D4)
  buf[2] = (uint8_t)((code12 & 0x0F) << 4);   // LSB nibble in upper bits
  return i2c_write_bytes(i2c, addr, buf, 3);
}

bool dac7578_write_all(i2c_inst_t* i2c, uint8_t addr, const uint16_t code12[8]) {
  bool ok = true;
  for (uint8_t ch=0; ch<8; ch++) {
    ok &= dac7578_write_channel(i2c, addr, ch, code12[ch]);
  }
  return ok;
}
