# Geant4 light-yield models

Two programs share this CMake project:

- **`hcal_tile`** (current): one decommissioned sPHENIX inner-HCal tile with its WLS fiber, coupler and Hamamatsu
  S12572-33-015P. This is the model behind the Muon3 station's threshold and efficiency numbers.
- `muon_panel` (legacy): the 200 × 200 × 10 mm looped-fiber panel of the earlier July design (MicroFC-30035). Kept for
  reference; not used by the station.

## Result (tile 01, 400 muons through the tile at random positions)

| | |
|---|---|
| Energy deposit | 1.31 MeV mean |
| **Photoelectrons per muon** | **19.5 mean** (σ 11, median 19, max 67) |
| Efficiency at a 5 p.e. threshold | **90 %** (a 3 p.e. threshold: about 95 %) |
| Per muon: scintillation photons → absorbed by the fiber → re-emitted → reach a SiPM window → detected | 15 300 → 3 650 → 3 370 → 108 → 20 |

![Plots](../../figures/hcal_inner_tile_summary.png)

The earlier documents quoted **58 p.e. per muon**. That number never came from the optical transport: whenever no tracked
photon reached the SiPM, the event action substituted `E_dep × 10 000 photons/MeV × 1.2 % × 0.25`, which is 57 p.e. at
1.9 MeV. That fallback is now opt-in (`HCAL_EFFECTIVE_YIELD=1`).

## How the transport was debugged

With the model as first written, tracked photons produced **0.0–0.1 p.e. per muon**. `HCAL_DEBUG=1` makes the stepping
action write `photon_fate.csv` (where and how every photon of the first `HCAL_DEBUG_EVENTS` events ended) and
`photon_tracks.csv` (every step of a sample of photons); `scripts/debug_photons.py` turns them into the figure below.
The first render of the model looked like the yellow fibers hanging outside a green plate, and the fates told the rest:

1. **Mirrored fiber pieces.** `G4PVPlacement` takes the *inverse* of the rotation that turns the tube; every diagonal
   piece was mirrored about its path and left the tile by 5.8 mm.
2. **Spectra on a coarse grid.** Y11 absorbs above about 2.7 eV and emits below it. On an 8-point grid the two overlapped,
   so re-emitted photons were re-absorbed at once (and cascaded).
3. **No refractive index on the SiPM.** Geant4 kills an optical photon at a boundary when the next material has no
   `RINDEX`, so not one photon ever entered the SiPM volume.
4. **Reflector as a skin on the tile.** It also sat between the tile and its fibers. The coating is now a border surface,
   and a second one covers light that comes back onto the tile edge from the coupler.
5. **Sharp corners and 3 mm chords.** A 1 mm fiber only guides round bends of radius above about 25 mm. The mesh path is
   a polyline whose serpentine turns are three-point stand-ins for semicircles (legs 56.78 mm apart, so R = 28.4 mm);
   they are rebuilt as true semicircles, and every bend is sampled every 1° with mitre-cut `G4CutTubs` chords. (`G4Torus`
   arcs were tried first; the quartic solver is unreliable for a 0.65 mm tube on a 28 mm ring, and photons hopped from
   core to tile to groove at every joint.)
6. **The connector pocket.** A fiber that bends across the pocket floor cannot be one volume, so the pocket is filled
   (`HCAL_POCKET=1` restores the mesh) and the fibers end flush with the tile's SiPM edge.
7. **The coupler.** With one SiPM 21 mm from each fiber end, even a white mixing slot delivers almost nothing: photons
   random-walk along a 3 mm slot losing 10 % per bounce, and 1.4 % of them arrive. See below.

![Debug figure](../../figures/hcal_geant4_debug.png)

*Left: sampled guided photons that reached the SiPM (colored paths) and where other guided photons left the fiber (grey).
Middle: the loss funnel. Right: where every photon ends.*

## What the model assumes (and does not know)

- **Tile:** extruded polystyrene + 1.5 % PTP + 0.01 % POPOP, 7 mm, n = 1.59, attenuation 2.2 m, POPOP emission at 420 nm,
  decay 2.4 ns, **8000 photons/MeV (an estimate)**; 50 µm painted TiO₂ reflector (R = 0.95, Lambertian); wrap of Al foil,
  cling film and black vinyl. Source: Aidala et al., IEEE TNS 65 (2018), Table II.
- **Fiber:** Kuraray Y11(200) single-clad, 1 mm: PS core (n = 1.59, radius 0.49 mm) in PMMA cladding (n = 1.49), in an
  epoxy groove (EPO-TEK 301, n = 1.52); absorption at 430 nm, emission at 476 nm, decay 7 ns, attenuation 3.5 m.
- **The loop is not closed.** The mesh path doubles back on itself at the far end (a loop closed on itself), so it is
  built as two half-loops A and B in separate mid-plane layers (they must cross three other legs). Photons heading for
  the far end are lost there; in the real loop they travel round and arrive at the second SiPM window. The real yield is
  therefore higher, by up to about 1.7× for the trapped light.
- **The coupler is a hypothesis.** The source CAD has both fiber ends 43 mm apart and one SiPM between them. The default
  (`direct`) follows the paper's description: each fiber end faces a 3 × 3 mm SiPM window across the published 0.75 mm
  air gap. `HCAL_COUPLER=cavity` puts a 47 mm white mixing slot with one SiPM in the middle instead: 0.3 p.e. per muon.
  **Ask GSU how the real coupler brings both ends to the SiPM.**
- **Tiles 02–12 are not simulated.** Their fiber paths in the mesh files run outside the scintillator (see
  `hw/docs/ASSEMBLY.md`); `hw/case/assembly.py` rebuilds valid paths, but the Geant4 model still reads tile 01's.
- **Photo-detection** is a flat PDE of 0.25 on photons reaching the SiPM; no cross-talk, after-pulsing or saturation
  (40 000 pixels, so saturation is small at 20 p.e.).

## Build and run

Geant4 11.4 from conda-forge is enough (`micromamba create -p g4 -c conda-forge geant4 cmake make cxx-compiler`, about 3.5 GB;
the environment's CMake needs `-DEXPAT_LIBRARY` and `-DZLIB_LIBRARY` pointing at its own `libexpat.1.dylib` / `libz.1.dylib`).
Run one heavy job at a time (`../../tools/memguard.sh`).

```bash
mkdir build && cd build && cmake .. -DCMAKE_PREFIX_PATH=$CONDA_PREFIX && make -j2 hcal_tile
printf '/run/initialize\n/run/beamOn 400\n' > run.mac
ln -s ../gdml gdml && ./hcal_tile run.mac                      # muon_panel_hits.csv: one row per event
HCAL_DEBUG=1 HCAL_DEBUG_EVENTS=20 ./hcal_tile run.mac          # + photon_fate.csv, photon_tracks.csv
python3 ../scripts/debug_photons.py . ../gdml/mesh/InnerHCalTile01_EJ200_mesh.json debug.png
python3 ../scripts/plot_hcal_tile_results.py --csv muon_panel_hits.csv
```

| Variable | Effect |
|---|---|
| `HCAL_DEBUG`, `HCAL_DEBUG_EVENTS` | photon fate and track logs |
| `HCAL_COUPLER=cavity` | white mixing-slot coupler instead of two SiPM windows |
| `HCAL_POCKET=1` | keep the connector pocket in the tile solid |
| `HCAL_EFFECTIVE_YIELD=1` | the old fallback formula (not a transport result) |

The 400-event run behind the table is `hcal_tile01_400events.csv`.

## Legacy panel model

`muon_panel` (`macros/run.mac`, `vis.mac`, `scan_position.mac`) simulates a 200 × 200 × 10 mm EJ-200 panel with a looped
WLS fiber and a MicroFC-30035; it comes from the July architecture and the `phyxch/fiberPanel` work of the same group
(`reference_documentation/repositories/fiberPanel`). Its material definitions were harmonised with that reference.
