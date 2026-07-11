# Project-local components

This directory mirrors the local-component organization of `mppcInterface/pcb/components`.

Only symbols and footprints independently checked against the selected manufacturer data sheet belong here. Store each complex component in its own subdirectory when added. Do not copy unverified Rev A footprints into this project.

`muon3.kicad_sym` and `muon3.pretty/` contain project-local verified symbols and footprints for custom / non-JLC or critical parts.

**Library setup (updated for latest KiCad 20250114 / 9.0 format):**
- JLCPCB full library copied from reference (footprints/JLCPCB.pretty + symbols/JLCPCB-*.kicad_sym) for the vast majority of parts (passives, standard IC packages, BME280, W25Q, etc.). All version headers bumped to 20250114 / generator 9.0.
- Local muon3 libs for: nRF9151 (LGA with RF note), ICE40UP5K, OPA858 WSON, TPS61170 WSON, DRV8873, CH224K, USB-C, U.FL, and any hybrid connectors. Footprints converted to modern (footprint ...) format.
- fp-lib-table and sym-lib-table updated to include both (table version 7 remains current).

**Adding new:**
- Verify pinout + land pattern from datasheet + JLCPCB LCSC page.
- Prefer JLCPCB lib entry when possible.
- Add only verified custom to muon3.* 

See also parts/*/README.md for each component's LCSC, package, and verification notes.

3D models (STEP) for custom footprints and key packages live in `../3dmodels/`. Custom footprints in `muon3.pretty/` now reference them via `${KIPRJMOD}/3dmodels/...`. JLCPCB parts resolve via your KiCad 3D search paths (or copy overrides into 3dmodels/). See `../3dmodels/README.md`.
