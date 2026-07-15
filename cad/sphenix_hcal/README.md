# sPHENIX Inner HCal Tile CAD Assemblies

STEP assemblies and tooling for the sPHENIX Inner Hadronic Calorimeter scintillator tiles, built from the original GDML tessellations in [phyxch/sPHENIX_HCal](https://github.com/phyxch/sPHENIX_HCal).

## Layout

| Path | Contents |
|------|----------|
| `originals/gdml/` | Pristine copies of all Inner/Outer tile GDMLs (never modified) |
| `../reference_documentation/repositories/sPHENIX_HCal/` | Full upstream application snapshot (sources + GDML tiles) |
| `tile_params.json` | Parsed bbox, groove pocket, dual-end fiber paths for tiles 01–12 |
| `step/InnerHCalTileNN_EJ200_assembly.step` | Multi-body STEP: scintillator + WLS fiber + coating + wrap + light blocker + SiPM |
| `step/*.FCStd` | FreeCAD documents for re-edit |
| `scripts/` | Parse / STEP / assembly GDML / Blender render pipeline |
| `renders/` | Local copies of paper figures |

## Assembly contents (each STEP)

1. **Scintillator (EJ-200)** — original tessellated solid from the upstream GDML (≈7 mm thick; radial length grows with tile index).
2. **WLS fiber** — dual-end serpentine path (Kuraray single-clad class, 1 mm diameter), outer-radius exit, design rules from Aidala et al. IEEE TNS 2018 (max deposit-to-fiber ≈2.5 cm, min bend radius ≈2.5 cm).
3. **Diffuse white coating** — TiO₂-style reflective layer (CAD thickness 0.1 mm; real process ≈50 μm chemical bath).
4. **Light-tight wrap** — outer black covering shell.
5. **Light blocker / SiPM coupler** — ABS-style plastic mount at the fiber exit (dual fiber ends).
6. **Hamamatsu SiPM** — **S12572-33-015P** (MPPC), 3×3 mm² active area, 15 μm pixels (~40k), package depth ≈1.5 mm, with a **0.75 mm air gap** from the polished fiber ends to the SiPM face (sPHENIX design: spreads light, limits optical saturation).

### Photosensor + station bias (HCal-tile workstation)

Station design is for **decommissioned HCal tile assemblies**:

| | This design (HCal tiles) | Legacy loop-panel ref |
|--|--------------------------|------------------------|
| Device | **Hamamatsu S12572-33-015P** | MicroFC-30035 |
| Station HV | **LT3482 C515895** (~70 V) | TPS61170 (~30 V) |
| Active area | 3×3 mm² | 3×3 mm² |
| Pixel pitch | 15 μm (~40k) | 35 μm class |
| PDE (sim) | **~25%** | ~38–40% |
| Coupling | Dual fiber + ~0.75 mm air gap | Single-end loop |
| Docs | `pcb/parts/hv_lt3482/`, `sipm_hamamatsu_s12572/` | `hv_tps61170/`, `sipm_microfc_30035/` |

Original GDML files contain only the scintillator solid (with fiber-exit pocket). Fibers, blockers, coverings, and the Hamamatsu SiPM are **added** here for CAD and Geant4 optical studies; they are not separate volumes in the upstream tessellations.

## Regenerate

```bash
# From physics/ root
python3 cad/sphenix_hcal/scripts/parse_inner_tile.py
python3 cad/sphenix_hcal/scripts/build_assembly_gdml.py   # -> sim/geant4/gdml/*_assembly.gdml + mesh JSON

# STEP (requires FreeCAD)
/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd \
  cad/sphenix_hcal/scripts/build_inner_tile_step.py

# Renders (requires Blender)
blender -b -P cad/sphenix_hcal/scripts/render_inner_tiles.py
```

## Geant4

See `sim/geant4/README.md`. Build target `hcal_tile` loads the original tessellated mesh (JSON export of the GDML), places fiber / coating / wrap / blocker / SiPM, and runs cosmic-like MIP muons with optical physics.

```bash
cd sim/geant4
./build_with_system_geant4.sh ~/geant4/install   # or cmake into build_hcal/
cd build_hcal   # or build/
./hcal_tile -g gdml/InnerHCalTile01_EJ200_assembly.gdml \
  --tile-center 60 95 0 55 90 macros/hcal_tile_run.mac
python3 ../scripts/plot_hcal_tile_results.py --csv muon_panel_hits.csv
```

Note: this Geant4 install may not have GDML support enabled; the `hcal_tile` app therefore builds geometry from `gdml/mesh/*_mesh.json` (exported from the original GDMLs) rather than calling `G4GDMLParser`.

## References

- phyxch/sPHENIX_HCal — standalone Geant4 geometry test of sPHENIX HCal tiles  
- Aidala et al., IEEE TNS 65 (2018) [arXiv:1704.01461] — HCal tile construction, fiber routing, reflective coating  
- Local archive: `reference_documentation/publications/sPHENIX_2018_Design_and_Beam_Test.pdf`
