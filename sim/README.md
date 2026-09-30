# Simulations

The simulations of the **current station** (Rev C: four sPHENIX inner-HCal tiles, S12572 SiPMs, ESP32-S3-WROOM-1U) live with
the hardware in [`hw/sim/`](../hw/sim) (ngspice bias supply, AFE and test screens, thermal, openEMS) and
[`hw/case/`](../hw/case) (FreeCAD assembly). This directory holds the detector-physics side.

| Path | What | Status |
|---|---|---|
| [`geant4/`](geant4/README.md) | Geant4 model of an inner-HCal tile, fiber, coupler and SiPM: **19.5 p.e. per muon, 90 % efficiency at 5 p.e.** (tile 01) | current; see its README for the debugging and the open coupler question |
| `python/coincidence_rates.py`, `python/sipm_to_tot.py` | Coincidence/accidental rate statistics; SiPM charge to time-over-threshold | physics still valid; feed them the p.e. numbers above |
| `reports/root_hcal_and_geant4.C`, `reports/make_root_charts.py`, `reports/build_reports.py`, `reports/muon3_simulation_report.tex` | ROOT charts and the July report | describe the July architecture; numbers superseded |
| `plots_octave/plot_3d_openems_geant4.m` | 3-D surface plots | July |
| `data/panel_yield_notes.md` | Notes on the legacy loop panel | July |

## What was removed

The July architecture (RJ45/Cat6 harness, LVDS head boards, TEC coolers, nRF9151 LTE modem, LT3482/TPS61170 bias, dual-threshold
front end) was deleted from the board in Rev B/C. Its simulation decks (`circuit/`, `openems/`), the battery and TEC models
(`python/power_budget.py`, `python/thermal_peltier.py`, `python/geant4_panel_standin.py`) and the generated plots and build artifacts were removed from the
tree on 2026-09-30; `git log --all -- sim/circuit sim/openems` finds them. The top-level paper
(`Muon3_Simulation_Studies.tex`) still describes that architecture and the earlier Geant4 numbers, so it needs a rewrite
before it is quoted; its figures were left in place for that reason.
