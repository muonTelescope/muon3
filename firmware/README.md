# Muon3 Firmware (nRF9151) + Gateware (iCE40UP5K)

## Overview
- **Gateware**: Deterministic timing, edge capture, exact-subset coincidence, ToT, PPS timestamps, SPI interface to nRF. Target: iCE40UP5K-SG48I.
- **Firmware**: nRF9151 app (control, LTE-M/NB-IoT + GNSS, thermal loops for 4x TECs, telemetry, SPI master to gateware).

## Modern Toolchains (installed via brew)
- Gateware: Yosys 0.66, nextpnr-ice40 0.10, icestorm (icepack/iceprog)
- Firmware: arm-none-eabi-gcc 16.1.0, west 1.5.0, cmake 4.4.0, ninja, etc. + Zephyr/NCS

Source env:
```bash
source /Users/sawaiz/physics/firmware/setup_env.sh
```

## Gateware Setup
```bash
cd /Users/sawaiz/physics/gateware
make
# Produces build/muon3_timing.bin
make prog  # (iceprog; adapt as needed)
```

See gateware/README.md, top.v, pinmap.pcf, Makefile.

## Firmware Setup (Zephyr + nRF Connect SDK)
1. Source the env above.
2. Init NCS (one-time, large download - take it slow):
   ```bash
   west init -m https://github.com/nrfconnect/sdk-nrf --mr v2.7.0 ~/ncs
   cd ~/ncs
   west update
   west zephyr-export
   ```
3. Build:
   ```bash
   cd /Users/sawaiz/physics/firmware
   west build -b nrf9151dk_nrf9151  # or your board
   west flash
   ```

See prj.conf for config, src/main.c for skeleton, west.yml, boards/ overlay.

## Project Files
- firmware/: CMakeLists.txt, prj.conf, west.yml, src/main.c, boards/, setup_env.sh, README.md
- gateware/: top.v, pinmap.pcf, Makefile, README.md, build/

## Notes
- Use most modern versions (as requested).
- Update pins/boards from final pcb/ design.
- Full NCS is heavy; gateware builds immediately.
- See top-level physics/README.md and pcb/ for architecture.
