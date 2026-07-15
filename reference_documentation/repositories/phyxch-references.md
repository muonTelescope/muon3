# phyxch (Xiaochun He / GSU) Reference Repositories

These external repositories from the same collaboration have been shallow-cloned here for reference and parameter harmonization with the Muon3 / muon telescope work.

## fiberPanel
- URL: https://github.com/phyxch/fiberPanel
- Purpose: GEANT4 simulation of scintillation light collection from a scintillator panel with an embedded WLS fiber read out by a photosensor (SiPM).
- Relevance to Muon3:
  - Very close model to the current `sim/geant4/` (EJ-200 panel, WLS fiber, optical cement, reflective wrapping, SiPM photon counting).
  - Supplies precise material definitions (mass fractions for EJ-200 at 1.023 g/cm³, Y-11 WLS, EJ-500 cement).
  - Demonstrates full optical physics configuration (scintillation + WLS + absorption + boundary processes).
  - Includes fiber position scan studies and Al wrapping with sensor port.
  - SiPM SD implementation is a simple optical-photon hit counter (PDE applied statistically).
- Local clone: `fiberPanel/`
- Notes from history: configurable via runConfig.txt; yield reduced for visualization in some commits; updated for Geant4 11.x.

## magnetocosmics
- URL: https://github.com/phyxch/magnetocosmics
- Purpose: Tracking of cosmic-ray shower particles in the geomagnetic field.
- Relevance: Source of more realistic primary cosmic muon / shower distributions (energy, zenith/azimuth angles) for future PrimaryGeneratorAction improvements. Current models use a simple particle gun.
- Local clone: `magnetocosmics/`

## sPHENIX_HCal
- URL: https://github.com/phyxch/sPHENIX_HCal
- Purpose: Standalone Geant4 application for studying sPHENIX HCal geometry via GDML (Inner/Outer tiles, absorbers, sectors).
- Relevance to Muon3:
  - Supplies original tessellated Inner HCal tile solids (EJ-200, ≈7 mm thick, fiber-exit pocket) used as the scintillator mesh for CAD STEP assemblies and the `hcal_tile` Geant4 app.
  - Demonstrates collaboration practice for GDML-driven geometry tests (Xiaochun He / GSU).
  - Complements fiberPanel (panel optics) with full calorimeter tile shapes from the sPHENIX program.
- Local snapshot: `sPHENIX_HCal/` (tile GDMLs kept in full; three multi-tens-of-MB sector steel/aluminum meshes replaced by upstream pointers — see `README_MUON3.md`).
- Muon3-derived products (not in upstream):
  - `cad/sphenix_hcal/step/*_assembly.step` — scintillator + WLS fiber + coating + wrap + light blocker + SiPM
  - `sim/geant4` target `hcal_tile` + `gdml/mesh/*_mesh.json`
  - Paper/README figures under `figures/hcal_*.png`

## How these are used in the current analysis
- Material composition for the EJ-200 scintillator was aligned with fiberPanel.
- Photon detection logic and optical process comments reference the fiberPanel SD and construction.
- Yield notes (`sim/data/panel_yield_notes.md`) and all major READMEs (`sim/`, `sim/geant4/`, top `physics/`, `reference_documentation/`) now cite these as related/prior work.
- Stand-in Python models and Geant4 sources contain cross-reference comments.
- sPHENIX Inner HCal tile GDMLs are the source of tessellated solids for STEP assemblies and `hcal_tile` optical runs.
- Future: position-dependent collection curves and geomagnetic primaries can be directly compared or imported.

See also the local historical `scintillatorPanel/` (looped-fiber CAD + assembly procedure using 1.3 mm ball mill groove, Kuraray K-11, optical cement, Spaz Stix / Plasti Dip coatings).

Owner context: Xiaochun He, Georgia State University — cosmic ray measurements, sPHENIX, EIC PID.
