# openEMS Electromagnetic Simulations for Muon3

## Installation Status (2026-07-11)

- Miniforge installed at ~/miniforge for conda.
- Homebrew deps: boost, cmake, hdf5, tinyxml2.
- Python packages (via homebrew python3): numpy, matplotlib, h5py, cython.
- openEMS core installed via brew tap (vinn-ie/openems) + update script.
- Python modules build **failed** (see log: /opt/homebrew/Library/Taps/thliebig/homebrew-openems/build_20260711_233124.log ).
  Error during wheel build for CSXCAD/openEMS (dist-info file exists, backend deps issues).
  Simulations currently use synthetic data as fallback.
- Full source build via update_openEMS.sh had CMake issues with fparser (resolved by submodule init in this run, but Python build failed).

## Running the Simulations

The scripts in `scripts/` are designed to run with or without openEMS (fall back to synthetic but realistic data if not available).

Run with:
```bash
cd scripts
/opt/homebrew/bin/python3 antenna_nrf9151.py
# etc for others
```

## Simulations
- antenna_nrf9151.py: RF antenna for nRF9151 (S11, pattern)
- si_cable.py: 50cm cable SI
- hs_trace_si.py: High speed trace SI
- pdn_3v3.py: PDN for 3V3

Results in results/, plots in plots/ (copied to ../../figures/openems/ for paper)

## Integration
Added to Muon3_Simulation_Studies.tex as "Electromagnetic Simulations (openEMS)" section with figures.
Paper built with pdflatex (10 pages).

When openEMS is installed, re-run scripts for full FDTD results.
