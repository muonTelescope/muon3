#pragma once
#include <stdint.h>
#include <stdbool.h>

#define SOF0 0xA5
#define SOF1 0x5A

// Packet types
#define PKT_REPORT 0x11
#define PKT_CMD    0x80
#define PKT_ACK    0x81

// Commands
#define CMD_SET_REPORT_PERIOD_MS 0x01
#define CMD_SET_WINDOW_TICKS     0x02
#define CMD_SET_HOLDOFF_TICKS    0x03
#define CMD_RESET_COUNTERS       0x04
#define CMD_DAC_SET_CH           0x10
#define CMD_DAC_SET_ALL          0x11
#define CMD_DAC_GET_ALL          0x12
#define CMD_GET_STATUS           0x20

// Error flags
enum {
  ERR_PIO_DROP        = (1u<<0),
  ERR_USB_BACKLOG     = (1u<<1),
  ERR_BME_FAIL        = (1u<<2),
  ERR_DAC_FAIL        = (1u<<3),
  ERR_I2C_RECOVER     = (1u<<4),
  ERR_MAX1932_INT     = (1u<<5),
  ERR_RX_CRC          = (1u<<6),
  ERR_RX_FRAMING      = (1u<<7),
};

uint16_t crc16_ccitt(const uint8_t* data, uint32_t len);

bool proto_try_parse_byte(uint8_t b); // feed bytes from RX
bool proto_have_cmd(void);
bool proto_pop_cmd(uint8_t* cmd_id, uint8_t* seq, uint16_t* arg_len, uint8_t* args, uint16_t args_cap);

bool proto_send_ack(uint8_t cmd_id, uint8_t seq, uint8_t status, const uint8_t* ret, uint16_t ret_len);
bool proto_send_report(const uint8_t* payload, uint16_t payload_len);
