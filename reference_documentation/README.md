# Muon Telescope Reference and Documentation Archive

This directory consolidates the historical repositories, publications, prior design exports,
next-generation design package, and current review/requirements material.

## Directory map

- `repositories/` - all 28 cloned `muonTelescope` Git repositories; each `.git` history is preserved.
- `publications/` - locally archived public GSU and sPHENIX papers plus a publication index.
- `prior_design_exports/` - 2026 chat/decision exports, handoff material, and original package ZIP.
- `next_generation/` - unpacked KiCad, simulation, generator, and RP2350 reference artifacts.
- `review_and_requirements/` - current design review and the revised next-generation requirements.
- `working_files/` - temporary PDF renders and review intermediates retained for traceability.

The active starting points are:

1. `review_and_requirements/NEXT_GENERATION_REQUIREMENTS.md`
2. `review_and_requirements/NEXT_GENERATION_PCB_REVIEW.md`
3. `prior_design_exports/DECISIONS.md`
4. `next_generation/nextgen_review/hardware/README.md`

## External / collaborator reference simulations (phyxch)

Relevant public repositories from Xiaochun He (GSU) have been cloned under `repositories/` for offline reference and parameter cross-checks:

- `repositories/fiberPanel/` — GEANT4 simulation of scintillation light collection from a scintillator panel with embedded WLS fiber + SiPM. Direct prior/parallel art (straight-fiber position scans, detailed optical properties for EJ-200 / Y-11, Al wrapping, optical cement). Used for material definitions, surface modeling, photon counting approach, and yield scaling studies.
- `repositories/sPHENIX_HCal/` — standalone Geant4 + GDML geometry for sPHENIX Inner/Outer HCal tiles (originals retained). Muon3 builds STEP assemblies with fibers, light blockers, and coverings in `cad/sphenix_hcal/` and runs optical studies with `sim/geant4` target `hcal_tile`.
- `repositories/magnetocosmics/` — Cosmic-ray shower particle tracking through the geomagnetic field. Useful for future realistic primary generation (angular/energy spectra) beyond simple muon guns.

See the dedicated index `repositories/phyxch-references.md` for usage notes in the current analysis.

See also the local historical `repositories/scintillatorPanel/` (looped fiber CAD + assembly notes) and `publications/`.

