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
- `fp-lib-table`, `sym-lib-table` — project-local + JLCPCB library tables.
- `components/JLCPCB-Kicad-Library/` — full JLCPCB footprints and symbols (copied from reference for assembly compatibility).
- `components/muon3.kicad_sym` and `muon3.pretty/` — project verified / custom symbols and footprints for nRF9151, ICE40, WSON parts, USB-C, U.FL, etc. (see components/README.md).

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

## Schematic-freeze decisions (answered 2026-07-11)

All ten freeze questions are answered; see [freeze_questions.md](freeze_questions.md) for the
full record. In summary:

1. 100% JLCPCB assembly including the TEC section — `DRV8873` H-bridges frozen.
2. USB-C PD input only this revision; battery/solar stays in an external qualified module.
3. TEC module: Same Sky `CP30238` (20 x 20 mm, 8.6 V/3 A) per SiPM, with aluminum cold block,
   40 mm-class heatsink, and 12 V tach fan — see [parts/tec_cp30238/](parts/tec_cp30238/README.md).
4. Four-channel board that ships populated for three panels; channel 4 is expansion.
5. 50 cm baseline panel cable.
6. One hybrid locking panel connector per channel (signal, bias, NTCs, TEC, fan/tach);
   exact family still to be selected.
7. Per-channel charge and optical calibration injection from the start.
8. USB-C 5 V fallback is a valid science mode with TECs and fans disabled.
9. Fan tach, hot-side NTCs, enclosure-open, and humidity/dew-point sensing are all in scope.
10. Nordic reference antenna geometry constrains the board outline from the start.

## Recommended schematic improvements

- Add a multichannel external ADC for temperatures, HV monitor, TEC telemetry, and rail readback.
- Prefer two 8-channel DACs so thresholds, baseline trims, HV trim, calibration, and TEC controls have spares.
- Treat CH224K as a simple first-prototype PD sink; use a TPS25751-class path if battery/solar or 100 W power management is required.
- Make TEC outputs hardware-default-off on sensor faults, watchdog loss, overcurrent, or insufficient PD contract.
- Put charge-injection and optical-test hooks in the schematic even if fitted as DNP.
- Keep SiPM bias off exposed coax shells; use keyed touch-safe connectors for bias and TEC power.
- Reserve RF keepout and antenna placement before dense digital or power placement begins.

## Simulations

Electrical, detector-physics, and system simulations for Muon3 live in `../sim/` (sibling directory to `pcb/`). This is the active modeling home for the P0 baseline.

Full details and usage instructions are in `../sim/README.md`. Summary:

**circuit/**
- `muon3_frontend.lib`: MicroFC-30035 SiPM (double-exp current), OPA858 TIA, dual TLV3601 comparators, charge-injection subckt.
- `afe_dual_threshold.cir`: complete channel netlist (DC-coupled, dual thresholds, protection, DAC refs, injection port).
- `hv_tps61170.cir`: TPS61170-class boost, filter stages, DAC trim, HV_MON divider.
- `cable_50cm.cir`: lossy-line model for the 50 cm hybrid cable.
- `run_sweeps.sh` + `analyze_muon3.py`: NPE families, ToT vs NPE (log fit), time-walk, pulse plots.

**geant4/**
- Full Geant4 11+ project: muon propagation + optical photons through 200×200×10 mm EJ-200 panel + looped WLS fiber + MicroFC-30035.
- Scintillation yield, WLS shift, surface reflectivity, PDE.
- Outputs: Edep, photon counts (produced / shifted / detected at SiPM), timing distributions, position maps.
- Build: `mkdir build; cd build; cmake ..; make`. Run with `../macros/run.mac` or `vis.mac`.

**python/**
- `thermal_peltier.py`: lumped model of CP30238 + cold block + hot-side + fan + dew-point interlock.
- `power_budget.py`: detailed consumption for 5 V fallback vs. 12/20 V PD (TECs + fans).
- `coincidence_rates.py` + `sipm_to_tot.py`: efficiency, accidentals, parametrized ToT.

**Recommended flow**
1. Use Geant4 to generate realistic light-yield distributions and photon arrival times from the actual panel geometry.
2. Drive ngspice models with those NPE/time constants for AFE performance (gain, bandwidth, ToT, overload recovery).
3. Use Python models for thermal safety margins, USB-PD power budgeting, and top-level rate/coincidence studies.
4. Cross-validate everything against bench measurements before freezing thresholds, DAC settings, or interlock values in the schematic/BOM.

See also `../sim/data/panel_yield_notes.md` for the critical measurements that must be performed on real panels.
