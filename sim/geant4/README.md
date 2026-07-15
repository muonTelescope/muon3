# Muon3 Geant4 Panel + WLS Fiber + SiPM Simulation

Full particle + optical photon simulation of one (or more) 200×200×10 mm plastic scintillator panel(s) with embedded looped WLS fiber read out by a MicroFC-30035 SiPM.

**Purpose**
- Predict light yield (photoelectrons at SiPM) as function of muon impact position, angle, and energy.
- Study fiber loop collection uniformity and single-end readout efficiency.
- Generate realistic pulse time profiles and photon arrival statistics for AFE / ToT validation.
- Support design of calibration (charge vs. optical injection) and threshold settings.

**Requirements**
- Geant4 11.0 or newer, built with CMake (recommended with Qt or OpenGL visualization).
- C++17 compiler.
- Optional: ROOT (for ntuples) — the example falls back to plain text/CSV output if ROOT is absent.
- Optional: gdml support if you want to export geometry.

**Quick build & run**

```bash
cd physics/sim/geant4
mkdir -p build && cd build
cmake .. -DGeant4_DIR=/path/to/geant4/install/lib/Geant4-11.2.0   # or let CMake find it
make -j$(nproc)
./muon_panel macros/run.mac
# or with visualization:
./muon_panel macros/vis.mac

# sPHENIX Inner HCal tile assembly (tessellated original + fiber + coating + wrap + blocker + SiPM)
./hcal_tile -g gdml/InnerHCalTile01_EJ200_assembly.gdml \
  --tile-center 60 95 0 55 90 macros/hcal_tile_run.mac
python3 ../scripts/plot_hcal_tile_results.py --csv muon_panel_hits.csv
```

**Important macros**
- `macros/run.mac` — batch run, 1000 vertical muons, text output.
- `macros/vis.mac` — interactive with OpenGL + trajectory + optical photon tracks (slow for many photons).
- `macros/scan_position.mac` — example for position-dependent yield study.
- `macros/hcal_tile_run.mac` / `hcal_tile_vis.mac` — Inner HCal tile batch / visualization.

**Geometry (configurable in PanelDetectorConstruction)**
- Scintillator box: 200×200×10 mm, EJ-200 equivalent material.
- Milled groove (approximated as a rounded rectangular loop path ~1.3 mm wide).
- WLS fiber: core + cladding, looped with two straight legs exiting one edge to a connector "port".
- Wrapping: highly reflective diffuse or specular surface on all faces except fiber exit.
- SiPM: 3×3 mm sensitive face optically coupled to one fiber end (simple dielectric interface + quantum efficiency applied in SD).

**Physics**
- Standard EM (muons, electrons, gammas).
- Optical physics enabled (G4OpticalPhysics).
- Scintillation process in the plastic.
- Wavelength shifting in the fiber core.
- Surface properties: polished groove interface (optical cement), diffuse reflector on outer surfaces.
- No hadronic physics needed for MIP muons in thin plastic.

**Output (default text mode)**
- Per event: primary muon position, deposited energy in scint, number of optical photons produced, number shifted in fiber, number detected at SiPM (after PDE).
- Summary histograms printed at end.
- Files: `muon_panel_hits.csv`, `photon_stats.txt`

To enable ROOT ntuples, build with `-DWITH_ROOT=ON` and have ROOT in your environment (Geant4 must have been built with analysis/root).

**Building against a system Geant4**

A helper script is provided:

```bash
cd sim/geant4
./build_with_system_geant4.sh $HOME/geant4/install     # adjust path
```

Or manually:

```bash
mkdir build && cd build
cmake -DGeant4_DIR=$HOME/geant4/install/lib/Geant4-11.3.0 ..
make -j
```

See `build_with_system_geant4.sh` for more details.

**Tuning parameters (critical)**
Edit `src/PanelDetectorConstruction.cc` or pass via macros/UI commands:
- Scintillation yield (photons/MeV)
- Fiber absorption length, WLS efficiency, trapping fraction
- Surface reflectivity (0.85–0.98 realistic)
- SiPM PDE for the shifted wavelength (typical 30–45 % for green on MicroFC-30035)
- Groove-fiber optical coupling loss

**Example studies you can run**
1. Light yield map: vary gun position in X/Y, fit uniformity.
2. Angular dependence (0° vertical vs 60° inclined).
3. Effect of fiber loop radius / groove polish quality.
4. Export photon arrival time distribution → feed into ngspice AFE model (convolve with single-p.e. response).
5. Compare with measured single-p.e. staircase from real panels.

**Relation to other models**
- Geant4 → photon count + time series at SiPM → use as input charge or scaled current source in `../circuit/`
- The Python models in `../python/` can take mean p.e. from here for rate / coincidence Monte Carlo.

**References**
- EJ-200 datasheet (Eljen)
- Kuraray WLS fiber (Y-11 / K-11) technical notes
- onsemi MicroFC-30035 product spec (PDE vs wavelength)
- Historical muonTelescope panel assembly notes (see `reference_documentation/repositories/scintillatorPanel`)
- phyxch/fiberPanel — GEANT4 simulation of scintillation light collection from a scintillator panel with embedded fiber (https://github.com/phyxch/fiberPanel). Cloned locally under `reference_documentation/repositories/fiberPanel/`. Provides material mass-fraction definitions (EJ-200), optical cement (EJ-500), WLS Y-11 modeling, Al wrapping + sensor hole, position-dependent collection studies, and SiPM photon counting SD. The current looped-fiber model builds on and extends this prior work from the same collaboration (Xiaochun He / GSU group).
- phyxch/magnetocosmics — Cosmic ray propagation in geomagnetic field (https://github.com/phyxch/magnetocosmics). Reference for more realistic primary muon/ shower generation in future updates.

See the comprehensive paper `Muon3_Simulation_Studies.tex` (base directory) for full results, citations, and details of 2026 model improvements (realistic cosmic spectrum + angular distribution, refined geometry and optics). The paper is formatted following sPHENIX publication conventions.

**Limitations of this starter model**
- Simplified groove as union of tori/cylinders (real milled groove is more complex).
- No surface roughness scattering modeled in detail (can add UNIFIED model).
- Single fiber end readout (the real design uses one end).
- No afterpulsing / crosstalk in SiPM (apply statistically in post-processing).
- Cosmic muon spectrum not included (use GPS with appropriate angular + energy distribution for realism; see phyxch/magnetocosmics for geomagnetic tracking reference).

**Related external work (same group)**
The current looped model is informed by and cross-checked against `reference_documentation/repositories/fiberPanel` (straight-fiber Geant4 study with configurable fiber position, precise EJ-200 mass fractions, full optical surfaces, WLS + SiPM photon counting). Material definitions were harmonized with that reference.

**sPHENIX Inner HCal tiles (`hcal_tile`)**
- Originals: `reference_documentation/repositories/sPHENIX_HCal/` and `cad/sphenix_hcal/originals/gdml/` (unmodified tile GDMLs).
- STEP assemblies (scintillator + fiber + coating + wrap + light blocker + SiPM): `cad/sphenix_hcal/step/`.
- Mesh JSON used at runtime (no Geant4 GDML dependency): `gdml/mesh/*_mesh.json`.
- Example results (tile 01, 200 events): ⟨Edep⟩ ≈ 2.04 MeV, ⟨detected p.e.⟩ ≈ 55 — see `hcal_tile_hits.csv`, `plots/hcal_inner_tile_*.png`, and paper Section “sPHENIX Inner HCal Tile Models”.
- Build: `make hcal_tile` (same CMake project as `muon_panel`).

Improve the Muon3 loop-panel geometry further with CAD groove import once the mechanical model is frozen; HCal tile STEP/tessellated import is already wired via `hcal_tile`.
