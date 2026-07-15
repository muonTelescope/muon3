# Octave 3D plots (openEMS + Geant4)

Detailed **3D** visualization of RF/openEMS results and Geant4 hit tables using
**GNU Octave** + gnuplot toolkit (headless PNG).

## Requirements

- Octave ≥ 6 (`brew install octave`)
- gnuplot (`brew install gnuplot`) — required for headless `print -dpng`

## Run

From the `physics/` repository root:

```bash
octave-cli --no-gui --quiet --eval "run('sim/plots_octave/plot_3d_openems_geant4.m')"
```

## Inputs

| Source | Path |
|--------|------|
| Antenna S11 | `sim/openems/results/nrf9151_antenna_s11.csv` |
| Cable S-params | `sim/openems/results/cable_50cm_sparams.csv` |
| HS trace | `sim/openems/results/hs_trace_sparams.csv` |
| PDN Z | `sim/openems/results/pdn_3v3_impedance.csv` |
| HCal Geant4 | `sim/geant4/hcal_tile_hits.csv` |
| Muon3 Geant4 | `sim/geant4/hits_fresh.csv` |

## Outputs

Written to `figures/octave/` (paper) and `sim/plots_octave/out/`:

**RF / openEMS**
- `octave_nrf9151_pattern_3d.png` — 3D radiation pattern surface
- `octave_nrf9151_s11_3d.png` — S11 surface vs freq / azimuth model
- `octave_cable_s21_3d.png`, `octave_cable_s11_3d.png` — cable length × freq
- `octave_hs_trace_z0_3d.png`, `octave_hs_trace_s21_3d.png` — width × freq
- `octave_pdn_z_3d.png` — PDN |Z| vs f and C_dec

**Geant4**
- `octave_hcal_edep_surf_3d.png`, `octave_hcal_pe_surf_3d.png`
- `octave_hcal_scatter_3d.png`, `octave_hcal_pe_surface_3d.png`
- `octave_muon3_pe_surf_3d.png`, `octave_muon3_scatter_3d.png`

## Example

![Pattern 3D](../../figures/octave/octave_nrf9151_pattern_3d.png)

![HCal pe surface](../../figures/octave/octave_hcal_pe_surf_3d.png)
