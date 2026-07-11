# Project-local components

This directory mirrors the local-component organization of `mppcInterface/pcb/components`.

Only symbols and footprints independently checked against the selected manufacturer data sheet belong here. Store each complex component in its own subdirectory when added. Do not copy unverified Rev A footprints into this project.

`muon3.kicad_sym` and `muon3.pretty/` begin as empty valid libraries. Add a component only after its pin map and land pattern have been checked. This prevents KiCad from silently accepting placeholder pin maps as production library data.
