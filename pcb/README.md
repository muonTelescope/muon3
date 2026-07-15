# Muon3 next-generation PCB

**In plain English:**  
This is where the custom circuit board (PCB) for the muon telescope is being designed. The board reads tiny signals from four light sensors on the detector panels, times the particle arrivals very accurately using an FPGA chip, controls cooling for the sensors with Peltier devices, manages power (including future battery/solar support), and sends data over cellular networks using a built-in modem.

It is a complete clean-sheet design in KiCad 9, currently at an early architecture stage.

---

This directory follows the organization of the legacy `mppcInterface/pcb` directory while starting a clean KiCad project for the **HCal-tile workstation**: four-channel readout of **decommissioned sPHENIX Inner HCal tiles** with **Hamamatsu S12572-33-015P** and **LT3482** (~70 V) bias.

## Status

Revision: **P0 architecture baseline — not released for fabrication**.

The KiCad project is intentionally separate from the unsafe Rev A design. It captures the new hierarchical architecture, board envelope, placement regions, sourcing policy, exact preferred parts already verified in JLCPCB's catalog, and the outstanding component-selection gates. Electrical sheets must be completed and independently reviewed before routing or fabrication.

Open `muon3.kicad_pro` in KiCad 9 or later. The root schematic contains five sheets:

1. `power_usb_pd.kicad_sch` — USB-C input, PD sink, protected power tree, **LT3482 SiPM HV** (~70 V for S12572).
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
- Validate the **LT3482 (C515895)** bias converter at S12572 max OV (~75–80 V), USB transients and fault conditions; 100 V passives and OVP.
- Validate each Peltier loop with a current-limited supply, disconnected SiPM and independent temperature cutoff.
- RF layout must follow Nordic reference geometry and receive a conducted/RF review.

No fabricated board should use the architecture-only sheets as a substitute for completed electrical schematics.

## Schematic-freeze decisions (answered 2026-07-11)

All ten freeze questions are answered; see [freeze_questions.md](freeze_questions.md) for the
full record. In summary:

1. 100% JLCPCB assembly including the TEC section — `DRV8873` H-bridges frozen.
2. TPS25751-class PD + battery charger/power-path on board (battery/solar or 20 V/5 A support required).
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
- **Adopted**: Switch to TPS25751-class PD controller + charger/power-path. Onboard battery/solar or 20 V/5 A management is now required (no longer deferred).
- **Adopted**: TEC section must default-off in hardware (invalid NTC, hot overtemp, insufficient PD contract, watchdog loss, overcurrent). Firmware cannot override. See thermal interlock block.
- Add RP2040 (or nRF54 for BLE) as telemetry co-processor subsystem.
- Use two 8-channel precision DACs (DAC80508 class).
- Put charge-injection and optical-test hooks in the schematic even if fitted as DNP.
- Keep SiPM bias off exposed coax shells; use keyed touch-safe connectors for bias and TEC power.
- Reserve RF keepout and antenna placement before dense digital or power placement begins.

## Simulations

Electrical, detector-physics, and system simulations for Muon3 live in `../sim/` (sibling directory to `pcb/`). This is the active modeling home for the P0 baseline.

Full details and usage instructions are in `../sim/README.md`. Summary:

**circuit/**
- `muon3_frontend.lib`: **S12572_015P** + MicroFC models, OPA858 TIA, dual TLV3601, charge inject.
- `afe_hamamatsu_s12572.cir` / `hv_lt3482.cir`: **primary** HCal-tile AFE + LT3482 ~70 V (C515895).
- `afe_dual_threshold.cir` / `hv_tps61170.cir`: legacy MicroFC ~30 V reference only.
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

## 3D models

STEP models for visualization and MCAD integration have been collected for the major components:

- nRF9151 (LGA), iCE40UP5K (QFN48), USB-C, U.FL/IPEX, BME280, OPA858 (WSON8 approx), TPS61170 (WSON6 proxy), CH224K (ESSOP10 proxy), DRV8873 (HTSSOP24 approx), SiPM proxy, and common SOT/SOIC/QFN packages.
- Stored in `3dmodels/`.
- Referenced from custom footprints using `${KIPRJMOD}/3dmodels/NAME.step`.
- See `3dmodels/README.md` for the full list, sources, and usage notes.
- Additional legacy panel and assembly STEPs are in `reference_documentation/repositories/cad/`.

When footprints are completed and the board is routed, load in KiCad's 3D viewer and tune offsets/rotations per part. These models also feed any future MCAD export or enclosure design.

