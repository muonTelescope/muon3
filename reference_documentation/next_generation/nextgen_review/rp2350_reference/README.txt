Muon Telescope RP2040 Firmware + Web Serial Dashboard
====================================================

This project implements:
- 4-channel leading-edge capture (active-low pulses) on GPIO16..19
- Exact-subset coincidence clustering within a programmable window
- Per-period (default 60s) counts for:
  * Singles CH0..CH3
  * 2-fold exact subsets: 01,02,03,12,13,23
  * 3-fold exact subsets: 012,013,023,123
  * 4-fold exact subset: 0123
- BME280 readout over I2C (addr 0x77; SDO tied high) on GPIO4/5
- DAC7578 8-channel I2C DAC control (default addr 0x4C) on same I2C bus
- USB CDC (TinyUSB) binary framing suitable for Web Serial
- Command interface to configure window/holdoff/period and DAC codes

Build (pico-sdk)
----------------
1) Install pico-sdk and set PICO_SDK_PATH
2) From firmware/:
   mkdir build && cd build
   cmake ..
   make -j

Flash to RP2040 as usual (UF2 or SWD).

Pins
----
CH0..CH3: GPIO16..19 (active-low pulses; leading edge = falling edge)
I2C SDA: GPIO4
I2C SCL: GPIO5
MAX1932_INT: GPIO22 (optional fault flag input)

USB Protocol
------------
Frames are:
  A5 5A TYPE LENlo LENhi PAYLOAD... CRC16lo CRC16hi
CRC16-CCITT (0x1021, init 0xFFFF) over TYPE+LEN+PAYLOAD.

Device->Host report (TYPE 0x11) payload:
  u32 period_index
  u32 period_ms
  u16 window_ticks
  u16 holdoff_ticks
  u32 singles[4]
  u32 exact_subset[11] (masks: 3,5,9,6,10,12,7,11,13,14,15)
  i16 temp_c_x100
  u16 hum_rh_x100
  u32 press_pa
  u16 dac_code[8]
  u32 dropped_events
  u32 err_flags
  u32 uptime_ms

Host->Device command (TYPE 0x80) payload:
  u8 cmd_id, u8 seq, u16 arg_len, args...

Device->Host ACK (TYPE 0x81) payload:
  u8 cmd_id, u8 seq, u8 status, u8 reserved, u16 ret_len, ret...

Commands
--------
0x01 SET_REPORT_PERIOD_MS   args: u32 period_ms
0x02 SET_WINDOW_TICKS       args: u16 window_ticks
0x03 SET_HOLDOFF_TICKS      args: u16 holdoff_ticks
0x04 RESET_COUNTERS         args: none
0x10 DAC_SET_CH             args: u8 ch (0..7), u16 code (0..4095)
0x11 DAC_SET_ALL            args: u16 code0..code7
0x12 DAC_GET_ALL            args: none, returns u16 code0..code7
0x20 GET_STATUS             args: none, returns a copy of last report fields (without counters reset)

Dashboard
---------
Open dashboard/index.html in Chrome/Edge, click Connect, select the USB CDC port.
You can change report period (e.g. 1000ms for realtime graphs), window/holdoff ticks, and DAC outputs.
