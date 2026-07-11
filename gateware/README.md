# Muon3 Gateware (iCE40UP5K)

Modern open-source flow for the timing engine: pulse capture, coincidences, ToT, PPS, SPI to nRF9151.

## Toolchain (modern)
- Yosys (synthesis)
- nextpnr-ice40 (PnR)
- icestorm (icepack)

Source env first:
```bash
source /Users/sawaiz/physics/firmware/setup_env.sh
```

## Build
```bash
cd /Users/sawaiz/physics/gateware
make
# -> build/muon3_timing.bin
```

## Program
```bash
make prog  # iceprog (update for board)
```

## Files
- top.v (skeleton per design)
- pinmap.pcf (update pins)
- Makefile (yosys + nextpnr + icepack)
- README.md

See top-level docs for full requirements (exact-subset, histograms, etc.).
