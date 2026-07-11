# Muon3 next-generation PCB

This directory follows the organization of the legacy `mppcInterface/pcb` directory while starting a clean KiCad project for the next-generation four-channel MicroFC-30035 telescope.

## Status

Revision: **P0 architecture baseline — not released for fabrication**.

The KiCad project is intentionally separate from the unsafe Rev A design. It captures the new hierarchical architecture, board envelope, placement regions, sourcing policy, exact preferred parts already verified in JLCPCB's catalog, and the outstanding component-selection gates. Electrical sheets must be completed and independently reviewed before routing or fabrication.

Open `muon3.kicad_pro` in KiCad 9 or later. The root schematic contains five sheets:

1. `power_usb_pd.kicad_sch` — USB-C input, 12 V PD sink, protected power tree, HV bias.
2. `afe.kicad_sch` — four corrected SiPM TIAs and dual thresholds per channel.
3. `digital_radio.kicad_sch` — direct nRF9151-LACA, iCE40UP5K, flash, timing, SIM/eSIM and RF.
4. `thermal.kicad_sch` — four reversible Peltier H-bridges, current sensing and four NTC inputs.
5. `connectors_sensors.kicad_sch` — MPPC/panel connections, environmental sensing, debug and expansion.

## Directory layout

- `muon3.kicad_pro`, `muon3.kicad_sch`, `muon3.kicad_pcb` — new KiCad project.
- `bom.csv` — purchasing-oriented component plan with preferred and alternate parts.
- `PART_SELECTION.md` — reasoning and availability policy for every major block.
- `parts/` — per-component research folders with downloaded data sheets and selection notes.
- `DESIGN_RULES.md` — electrical, layout and release constraints.
- `components/` — project-local symbol/footprint source area, matching `mppcInterface` organization.
- `fp-lib-table`, `sym-lib-table` — project-local library tables.

## Non-negotiable release gates

- Every fitted reference must have an exact MPN and JLCPCB/LCSC number.
- Use JLCPCB **Standard PCBA** because nRF9151-LACA requires it and X-ray inspection.
- Upload BOM and CPL before release and reserve all low-stock extended components.
- ERC and DRC must pass with no unexplained violations.
- Validate OPA858 common-mode range and stability using extracted layout parasitics.
- Validate the TPS61170 bias converter at maximum SiPM bias, USB transients and fault conditions.
- Validate each Peltier loop with a current-limited supply, disconnected SiPM and independent temperature cutoff.
- RF layout must follow Nordic reference geometry and receive a conducted/RF review.

No fabricated board should use the architecture-only sheets as a substitute for completed electrical schematics.

## Schematic-freeze questions

Answering these will decide whether the P0 schematic becomes a compact JLC-built controller or a
larger board with integrated power-path and thermal control:

1. Is full JLCPCB assembly mandatory for the TEC/Peltier section?
2. Should battery/solar charging be integrated now or handled by an external module?
3. What exact TEC module, heatsink, fan, and cold-plate geometry are we designing around?
4. Is the baseline station mechanically three panels or four panels?
5. Should panel cabling be short internal wiring, roughly 1 m, or longer field-service cabling?
6. Should panel I/O use separate grounded signal coax plus an auxiliary connector, or one hybrid connector?
7. Should calibration injection be per-channel on the first prototype?
8. Should 5 V USB-C fallback collect science data with TEC disabled?
9. Do hot-side NTCs, fan tach, and condensation/sealing interlocks need first-revision connectors?
10. Should Nordic RF/reference antenna geometry override board-outline convenience?

## Recommended schematic improvements

- Add a multichannel external ADC for temperatures, HV monitor, TEC telemetry, and rail readback.
- Prefer two 8-channel DACs so thresholds, baseline trims, HV trim, calibration, and TEC controls have spares.
- Treat CH224K as a simple first-prototype PD sink; use a TPS25751-class path if battery/solar or 100 W power management is required.
- Make TEC outputs hardware-default-off on sensor faults, watchdog loss, overcurrent, or insufficient PD contract.
- Put charge-injection and optical-test hooks in the schematic even if fitted as DNP.
- Keep SiPM bias off exposed coax shells; use keyed touch-safe connectors for bias and TEC power.
- Reserve RF keepout and antenna placement before dense digital or power placement begins.
