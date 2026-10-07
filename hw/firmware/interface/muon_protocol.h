#ifndef MUON_PROTOCOL_H
#define MUON_PROTOCOL_H
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

// Protocol v1. Wire integers are little-endian; SPI shifts each byte MSB first.
enum { MUON_READ_EVENT = 1, MUON_READ_STATUS = 2, MUON_RESET = 3 };
enum { MUON_EVENT_TRANSFER_BYTES = 26, MUON_STATUS_TRANSFER_BYTES = 65 };
typedef struct {
    uint64_t end_tick;
    uint32_t width_ticks[4];
    uint8_t pulse_mask, coincidence_mask, saturated_mask;
    bool coincidence_valid;
} muon_event;
typedef struct {
    uint32_t clock_hz;
    uint16_t fifo_level, coincidence_ticks;
    uint64_t ticks, fifo_full_ticks;
    uint32_t dropped_frames, dropped_pulses, dropped_coincidences;
    uint32_t singles[4], coincidences;
} muon_status;
static inline uint64_t muon_le(const uint8_t *p, size_t n) {
    uint64_t v = 0;
    for (size_t i = 0; i < n; ++i) v |= (uint64_t)p[i] << (8 * i);
    return v;
}
// Pass the complete full-duplex receive buffer, including the ignored command
// response at rx[0]. False means absent/invalid: never use the output then.
static inline bool muon_decode_event(const uint8_t *rx, size_t n, muon_event *out) {
    if (!rx || !out || n != MUON_EVENT_TRANSFER_BYTES || rx[1] != 1) return false;
    const uint8_t *e = rx + 2;
    if ((e[21] & 0xe0) || e[22] || e[23]) return false;
    out->end_tick = muon_le(e, 8);
    for (int ch = 0; ch < 4; ++ch) out->width_ticks[ch] = (uint32_t)muon_le(e + 8 + 3 * ch, 3);
    out->pulse_mask = e[20] & 15;
    out->coincidence_mask = e[20] >> 4;
    out->saturated_mask = e[21] & 15;
    out->coincidence_valid = (e[21] & 16) != 0;
    return true;
}
static inline bool muon_decode_status(const uint8_t *rx, size_t n, muon_status *out) {
    if (!rx || !out || n != MUON_STATUS_TRANSFER_BYTES) return false;
    const uint8_t *s = rx + 1;
    if (muon_le(s, 2) != 0x334d || muon_le(s + 2, 2) != 1) return false;
    out->clock_hz = (uint32_t)muon_le(s + 4, 4);
    out->fifo_level = (uint16_t)muon_le(s + 8, 2);
    out->coincidence_ticks = (uint16_t)muon_le(s + 10, 2);
    out->ticks = muon_le(s + 12, 8);
    out->fifo_full_ticks = muon_le(s + 20, 8);
    out->dropped_frames = (uint32_t)muon_le(s + 28, 4);
    out->dropped_pulses = (uint32_t)muon_le(s + 32, 4);
    out->dropped_coincidences = (uint32_t)muon_le(s + 36, 4);
    for (int ch = 0; ch < 4; ++ch) out->singles[ch] = (uint32_t)muon_le(s + 40 + 4 * ch, 4);
    out->coincidences = (uint32_t)muon_le(s + 56, 4);
    return true;
}
#endif
