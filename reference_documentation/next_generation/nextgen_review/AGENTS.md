# AGENTS.md — SiPM Muon Telescope

Context for AI agents working in this repository.

## Read first, in order
1. `DECISIONS.md` — every design decision, its reasoning, verification status ([SIM]/[NET]/
   [DRC]/[DS]), and the consolidated OPEN/VERIFY list (D16). Treat [OPEN] items as the
   backlog; treat verified decisions as constraints, not suggestions.
2. `CHAT_HISTORY.md` — full design conversation, turn by turn, including two legacy project
   summaries (RP2040/RP2350 eras) embedded in Turn 1. The protocol/coincidence semantics in
   Summary B (exact-subset masks, framing, command set) carry forward onto LTE-M.
3. `hardware/README.md` — KiCad project specifics, library setup, sourcing status.
4. `sim/design_report.md` — analog design values with derivations and bench validation plan.

## Repository layout
- `hardware/muon_telescope_v10/` — PRIMARY KiCad project (open in KiCad 10; schematics in
  the 20250114 grammar KiCad 10 ships/migrates natively; board is v7 format, migrates on open).
- `hardware/muon_telescope_v7/`  — validation twin (kicad-cli 7 netlist-verified; identical
  structure; do not edit both — regenerate from generators instead).
- `hardware/generator/` — Python generators (gen_symbols.py, gen_sch.py, gen_pcb.py,
  convert_fp.py). The schematics/board are GENERATED; prefer editing generators + re-running
  (`python3 gen_sch.py v9` / `v7`, then gen_pcb.py) over hand-editing, until routing starts.
  After routing begins, the board file becomes hand-owned; freeze generators for the PCB.
- `sim/` — ngspice-42 environment: lib_frontend.lib (SiPM + OPA858/OPA356/TLV3601
  macromodels), run_sweep.sh (templated per-NPE runs), analyze.py (reproduces all plots).

## Hard constraints (do not regress)
- Comparator outputs are ACTIVE-LOW, idle HIGH; event = falling edge.
- Exact-subset coincidence semantics and mask order 3,5,9,6,10,12,7,11,13,14,15.
- Holdoff must be firmware-bypassable (muon-lifetime mode depends on double pulses).
- U.FL wiring: pin 1 center = SiPM anode signal; pins 2 AND 3 (both shield legs) = HV bias.
- One continuous ground domain on the PCB; never split planes; keep the four summing-node
  no-pour rule areas and the boost quarantine intact.
- iCE40/DAC/BME pin map is frozen in DECISIONS.md D11 — RTL and firmware must match it.
- Verification discipline (D15): any change to schematics must re-run the netlist
  assertions; any placement change must re-run DRC.

## Toolchain notes
- FPGA: yosys + nextpnr-ice40 + icestorm (iCE40UP5K-SG48).
- MCU: nRF Connect SDK / Zephyr for nRF9151 (on a carrier via headers J7/J8).
- ngspice 42 for sims; KiCad 10 for EDA (KiCad 7 CLI was used headlessly for validation).
