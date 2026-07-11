#include "proto.h"
#include "tusb.h"
#include <string.h>

static uint8_t rx_state = 0;
static uint8_t rx_type = 0;
static uint16_t rx_len = 0;
static uint16_t rx_pos = 0;
static uint8_t rx_buf[1024]; // payload max
static uint8_t rx_hdr[3];    // type + lenlo + lenhi
static uint16_t rx_crc = 0;
static uint8_t rx_crc_bytes[2];
static uint8_t rx_crc_pos = 0;

// Parsed command storage (single-slot)
static bool cmd_ready = false;
static uint8_t cmd_id_s, cmd_seq_s;
static uint16_t cmd_arg_len_s;
static uint8_t cmd_args_s[512];

uint16_t crc16_ccitt(const uint8_t* data, uint32_t len) {
  uint16_t crc = 0xFFFF;
  for (uint32_t i=0;i<len;i++) {
    crc ^= (uint16_t)data[i] << 8;
    for (int b=0;b<8;b++) {
      if (crc & 0x8000) crc = (crc<<1) ^ 0x1021;
      else crc <<= 1;
    }
  }
  return crc;
}

static void reset_parser(void) {
  rx_state = 0;
  rx_len = 0;
  rx_pos = 0;
  rx_crc_pos = 0;
}

bool proto_try_parse_byte(uint8_t b) {
  switch (rx_state) {
    case 0: // SOF0
      if (b == SOF0) rx_state = 1;
      return false;
    case 1: // SOF1
      if (b == SOF1) rx_state = 2;
      else rx_state = 0;
      return false;
    case 2: // TYPE
      rx_type = b;
      rx_hdr[0] = b;
      rx_state = 3;
      return false;
    case 3: // LENlo
      rx_len = b;
      rx_hdr[1] = b;
      rx_state = 4;
      return false;
    case 4: // LENhi
      rx_len |= ((uint16_t)b << 8);
      rx_hdr[2] = b;
      if (rx_len > sizeof(rx_buf)) { reset_parser(); return false; }
      rx_pos = 0;
      rx_state = (rx_len ? 5 : 6);
      return false;
    case 5: // PAYLOAD
      rx_buf[rx_pos++] = b;
      if (rx_pos >= rx_len) {
        rx_state = 6;
        rx_crc_pos = 0;
      }
      return false;
    case 6: // CRC16
      rx_crc_bytes[rx_crc_pos++] = b;
      if (rx_crc_pos >= 2) {
        uint16_t got = (uint16_t)rx_crc_bytes[0] | ((uint16_t)rx_crc_bytes[1] << 8);
        // compute CRC over TYPE+LEN+PAYLOAD
        uint16_t calc;
        if (rx_len) {
          uint8_t tmp[3 + 1024];
          memcpy(tmp, rx_hdr, 3);
          memcpy(tmp+3, rx_buf, rx_len);
          calc = crc16_ccitt(tmp, 3 + rx_len);
        } else {
          calc = crc16_ccitt(rx_hdr, 3);
        }
        bool ok = (got == calc);

        if (ok && rx_type == PKT_CMD && !cmd_ready) {
          // parse cmd payload: cmd_id, seq, arg_len (u16 LE), args...
          if (rx_len >= 4) {
            uint8_t cmd_id = rx_buf[0];
            uint8_t seq = rx_buf[1];
            uint16_t arg_len = (uint16_t)rx_buf[2] | ((uint16_t)rx_buf[3] << 8);
            if ((uint32_t)arg_len + 4u == rx_len && arg_len <= sizeof(cmd_args_s)) {
              cmd_id_s = cmd_id;
              cmd_seq_s = seq;
              cmd_arg_len_s = arg_len;
              if (arg_len) memcpy(cmd_args_s, rx_buf + 4, arg_len);
              cmd_ready = true;
            }
          }
        }
        reset_parser();
        return ok;
      }
      return false;
  }
  reset_parser();
  return false;
}

bool proto_have_cmd(void) { return cmd_ready; }

bool proto_pop_cmd(uint8_t* cmd_id, uint8_t* seq, uint16_t* arg_len, uint8_t* args, uint16_t args_cap) {
  if (!cmd_ready) return false;
  *cmd_id = cmd_id_s;
  *seq = cmd_seq_s;
  *arg_len = cmd_arg_len_s;
  if (*arg_len > args_cap) return false;
  if (*arg_len) memcpy(args, cmd_args_s, *arg_len);
  cmd_ready = false;
  return true;
}

static bool send_frame(uint8_t type, const uint8_t* payload, uint16_t len) {
  if (!tud_cdc_connected()) return false;

  uint8_t hdr[5];
  hdr[0] = SOF0;
  hdr[1] = SOF1;
  hdr[2] = type;
  hdr[3] = (uint8_t)(len & 0xFF);
  hdr[4] = (uint8_t)(len >> 8);

  // CRC over type+len+payload
  uint8_t crc_in[3 + 1024];
  if (len > 1024) return false;
  crc_in[0] = type;
  crc_in[1] = hdr[3];
  crc_in[2] = hdr[4];
  if (len) memcpy(crc_in + 3, payload, len);
  uint16_t crc = crc16_ccitt(crc_in, 3 + len);
  uint8_t crc_bytes[2] = { (uint8_t)(crc & 0xFF), (uint8_t)(crc >> 8) };

  // write
  if (tud_cdc_write_available() < (int)(5 + len + 2)) {
    // let caller set ERR_USB_BACKLOG
    return false;
  }
  tud_cdc_write(hdr, 5);
  if (len) tud_cdc_write(payload, len);
  tud_cdc_write(crc_bytes, 2);
  tud_cdc_write_flush();
  return true;
}

bool proto_send_ack(uint8_t cmd_id, uint8_t seq, uint8_t status, const uint8_t* ret, uint16_t ret_len) {
  uint8_t payload[4 + 2 + 512];
  if (ret_len > 512) return false;
  payload[0] = cmd_id;
  payload[1] = seq;
  payload[2] = status;
  payload[3] = 0;
  payload[4] = (uint8_t)(ret_len & 0xFF);
  payload[5] = (uint8_t)(ret_len >> 8);
  if (ret_len) memcpy(payload + 6, ret, ret_len);
  return send_frame(PKT_ACK, payload, 6 + ret_len);
}

bool proto_send_report(const uint8_t* payload, uint16_t payload_len) {
  return send_frame(PKT_REPORT, payload, payload_len);
}
