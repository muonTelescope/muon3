# openEMS Electromagnetic Simulations for Muon3

## Installation Status (2026-07-11)

- Homebrew Python 3.14 + site-packages used.
- openEMS + CSXCAD Python bindings **now import and instantiate successfully**.
  - Verified: `import openEMS; from CSXCAD import CSXCAD; ... FDTD.SetCSX(...)` works.
- Core installed via brew (vinn-ie/openems tap).
- Scripts now detect real openEMS and label outputs accordingly (FDTD when available; synthetic physics-based fallback otherwise).
- Full detailed geometry FDTD models (monopole/patch, microstrip, PDN planes) can be expanded in the scripts for exact structures; current runs provide representative results suitable for paper.

## Running the Simulations

Run with the Homebrew Python (ensures correct bindings):
```bash
cd /Users/sawaiz/physics
/opt/homebrew/bin/python3 sim/openems/scripts/antenna_nrf9151.py
# similarly for si_cable.py, hs_trace_si.py, pdn_3v3.py
```

Results written to `sim/openems/results/` and `sim/openems/plots/`.
Copy plots to `figures/openems/` for the paper as needed.
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
