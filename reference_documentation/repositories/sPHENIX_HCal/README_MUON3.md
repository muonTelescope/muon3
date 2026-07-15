# sPHENIX_HCal (vendored for Muon3)

Upstream: https://github.com/phyxch/sPHENIX_HCal  
Author: Xiaochun He et al. (GSU) — standalone Geant4 application for sPHENIX HCal geometry studies using GDML.

## What is kept here

- Full application sources (`HCal.cc`, `include/`, `src/`, CMake/GNUmakefile, macros).
- **All scintillator tile GDMLs** (Inner tiles 01–12, Outer tiles 01–12, chimney tiles, groove assemblies) in original form.
- Steering GDML and absorber-tile assembly files.

## Size note

Three multi-tens-of-MB sector absorber meshes were replaced with short placeholders that point back to the upstream files:

- `gdml/OuterHCalChimneySector_Steel.gdml`
- `gdml/OuterHCalSector_Steel.gdml`
- `gdml/InnerHCalSectorNoEndPlate_Aluminum.gdml`

Re-download those from GitHub if you need full sector steel/aluminum geometry. **All tile GDMLs remain complete originals.**

## Muon3 usage

- Originals are mirrored under `cad/sphenix_hcal/originals/gdml/`.
- STEP assemblies with fibers, light blockers, and coverings: `cad/sphenix_hcal/step/`.
- Geant4 optical tile app: `sim/geant4` target `hcal_tile`.
- Paper figures: `figures/hcal_*.png`.
