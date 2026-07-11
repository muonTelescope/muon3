# RP2040 as Telemetry / Interface Subsystem (co-processor)

## Recommendation
Add RP2040 (Raspberry Pi RP2040) as a dedicated telemetry, logging, debug, and local interface co-processor alongside the primary nRF9151.

**Why RP2040 is preferred here over (or in addition to) a standalone nRF54 for the telemetry role:**

- nRF9151 remains the **primary** for long-range cellular (LTE-M/NB-IoT) + GNSS telemetry. This is the core value for a distributed muon telescope network.
- RP2040 excels as a "telemetry brain":
  - PIO (programmable I/O) state machines are perfect for:
    - Precise fan tach counting / period measurement
    - Custom protocols to FPGA or sensors
    - Bit-banged or hardware-assisted ADC oversampling on NTCs
  - Dual Cortex-M0+ cores: one for real-time I/O, one for higher-level logging/USB stack.
  - Native USB (device + limited host) for direct desktop/laptop tools, data dump, firmware update of co-proc without JTAG.
  - Extremely cheap, excellent availability, mature mature ecosystem (MicroPython, C SDK, CircuitPython).
  - No radio: avoids extra certification/layout burden on this subsystem (the hard RF is already on nRF9151).

**nRF54 alternative / addition**
- nRF54L/H series brings excellent BLE 5.4 + higher perf + RISC-V coprocessor.
- Great for **local Bluetooth** field access (phone app for status, config, live plots without cellular or USB cable).
- If local wireless is a hard requirement, the cleanest is:
  1. nRF9151 (cellular) + RP2040 (telemetry/IO/USB)
  2. OR nRF9151 + small nRF54 footprint/module for BLE
  3. Future option: evaluate replacing secondary roles with one powerful nRF54 + cellular module, but loses integration.

Current decision: Add RP2040 as the telemetry subsystem. Leave pads/footprint option for a small BLE module or nRF54 if field experience shows strong need for Bluetooth.

## Interconnect with rest of system
- UART or SPI to nRF9151 (science data, commands, status).
- Direct GPIOs / SPI to iCE40 FPGA (for fast control or timestamping).
- Dedicated ADC channels or external ADC for the many NTCs + current monitors.
- USB for local engineering interface.
- Possibly SD card or flash for local logging when cellular is unavailable.

## Power / clock
- 3V3 domain.
- Can run from the always-on rail even in low-power modes.
- Can provide a "safe" heartbeat for the hardware TEC watchdog.

## References
- Raspberry Pi RP2040 datasheet
- PIO examples for tachometry and sensor capture (very common in instrumentation)
- Prior muon telescope projects that used RP2040 or similar co-processors for sensor aggregation
