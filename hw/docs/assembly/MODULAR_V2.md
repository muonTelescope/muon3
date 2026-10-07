# Modular ABS station — prototype revision 2

This revision replaces the long electronics strip and M6-rod structure with four local detector boards, one USB/Wi-Fi controller, and a printed modular frame. Four detector planes remain at 100 mm centre spacing. Each station uses four tiles of one selected sPHENIX shape; twelve complete station variants are generated. This does **not** promise that four different tile outlines can share one stack's corner columns.

The reclaimed scintillator, wavelength-shifting fibers, reflective coating/wrapping, Hamamatsu SiPMs, sensor daughterboards, PCB assemblies, connectors, wire harnesses, USB cable, and Wi-Fi antenna are supplied components. Structural parts, electronics pods, optical couplers, shelves and joint retainers are printed. No M6 rod, screw, nut, washer or heat-set insert is included in the new structure.

## Files and reproducibility

- `hw/case/modular_v2.py`: FreeCAD generator, selected with `TILE=1` through `TILE=12`.
- `hw/case/tile_geometry.py`: scintillator, fiber, wrap and optical-interface geometry derived from the same mesh metadata as the existing Geant4 simulation. It preserves the legacy optical model.
- `hw/case/build_modular.sh 1 2 ... 12`: build selected stations, then create print plates. The populated detector/controller STEP files in `hw/out/modular/` must exist first.
- `hw/out/assembly/modular_v2/tileNN/station.FCStd`: editable hierarchical CAD assembly.
- `hw/out/assembly/modular_v2/tileNN/station.step`: complete STEP assembly for ClassCAD or another CAD tool.
- `hw/out/assembly/modular_v2/tileNN/print/`: normalized, individual printable STEP and STL parts. Do not print the assembly STL leaves, which include nonprinted tiles, boards and wires.
- `hw/out/assembly/modular_v2/tileNN/manifest.json`: part quantities, source geometry, printer limits, wire centre-lines and initial cable lengths.
- `hw/out/assembly/modular_v2/tileNN/plates/`: packed, printer-aware CORE One 3MF projects and `plates.json`; no G-code is supplied.
- `hw/out/case/modular_v2/coupons/`: socket-clearance coupons, male gauge, and bridge retainer.
- `hw/case/check_modular.py`: exact positive-volume solid-intersection audit, selected with `TILE`.

The legacy `case.py`, `assembly.py` and their existing outputs remain available for comparison. This revision should become the fabrication baseline only after the electronics checks and physical prototype tests below are complete.

## Frame and snaps

Each corner consists of three 100 mm tower modules and a short top cradle module. The top closes at approximately Z=331 mm; feet extend to Z=-14 mm. Each tile rests on four shape-specific lower cradles with room for the modeled 0.28 mm surface wrap. C-shaped removable caps retain the tile without requiring it to bend during insertion.

The tower connection uses a 12 × 12 × 8 mm male post and a 12.5 × 12.5 × 8.5 mm socket. Compression transfers through the 18 × 18 mm shoulders. Separate bridge retainers prevent joint separation; a small flat tool accesses their central opening. The retainers' nominal active beam is 20 × 6 × 1.6 mm and nominal insertion deflection is 0.5 mm. The elementary cantilever estimate, `strain ≈ 1.5 × thickness × deflection / length²`, gives 0.30%. This calculation does not validate printed material strength, corner stress concentration, fatigue or creep.

Front/back rails and split side rails close each detector frame. Crossing rail ends have complementary half-laps and enter tower sockets. Side rail sleeves align the split rails. Sleeve sliding retention and the frame's lateral stiffness must be checked physically; the design has no claimed transport/drop-load rating. Carry it by the base after verification, never by a tile, sensor coupler or electronics pod.

Detector pods sit on printed shelves that sleeve over the rear frame rail. At the second plane, one combined shelf supports both its detector pod and the controller. Long shelf fingers engage pod grooves. Pod lids have accessible side snap fingers. Tile-cap jaws have matching recesses in the towers. The supplied shapes are assembly candidates, and all snaps need printed fit testing.

## PCB and wiring representation

The complete station imports the actual populated KiCad detector/controller STEP files. A rigid 180° rotation about Z maps KiCad's negative-Y export coordinates to the assembly; board X becomes `width − x`, while component tops remain upward. This avoids reflecting or mirroring the PCB.

Four detector boards are 60 × 45 mm; the controller is 100 × 80 mm. The real C5665 IDC connector models are included in the populated STEP. The detector's missing BSS131 supplier model is explicitly named as an envelope. An external Wi-Fi antenna and its pigtail are also conservative envelopes pending an exact antenna selection. Imported supplier models are useful for clearance inspection but are not a substitute for checking manufacturer drawings. USB pins projecting below the board are included in the populated controller STEP. The updated C5665 headers project about 3.5 mm below the PCB: the pod supports place its underside 7.0 mm above the datum, leaving 4.6 mm above the 2.4 mm floor; the pod is 21.6 mm high.

Four sensor micro-coax runs and forty individually modeled low-voltage harness conductors are included. The station manifest records each route and an initial cutting allowance. Connector pin assignments come from the electronics design, not from a wire's appearance or render color. Before cutting cables, measure the assembled routing and include the actual connector mating length, strain relief and service loop. The geometric wire paths are packaging routes, not signal-integrity or bend-life validation.

## CORE One printing

Parts are checked against a conservative 230 × 200 mm footprint within the CORE One's 250 × 220 × 270 mm envelope. Plates reserve 10 mm edge margins and 10 mm between part bounding boxes; 5 mm brims may meet. The generators validate closed meshes and positive CAD volumes. Large detector outlines themselves are not printed, so even the widest reclaimed tile is supported by split printable members.

Start with the fit coupons, not a full station. Three female sockets offer 0.15, 0.25 and 0.35 mm clearance per side. Print them in the intended ABS, same orientation and settings as the mating tower parts. Select clearance from the measured fit; update `CLEAR` before rebuilding the station. Test the retainer and one complete corner module/cap before committing to all parts.

The 3MF projects use the installed Prusa CORE One 0.4 mm machine profile and 0.20 mm structural print settings. The installed profile library has no CORE One ABS preset, so an ASA profile supplies machine-compatible defaults and explicit overrides label the material ABS with candidate 255 °C nozzle / 100 °C bed, five perimeters and 35% infill. These are uncalibrated starting assumptions. Set temperatures, cooling and chamber behavior to the chosen ABS manufacturer's guidance and your established printer profile before slicing.

Tower parts export upright: compressive load runs along their axis, and the cradle overhang requires supports. Inspect support contact around the optical cradles and socket roofs; remove supports without enlarging fitted surfaces. Retainers export flat; lids export exterior-face down. Shelves include short sleeve roofs and long pod supports: check the slicer preview and add local supports as needed. The projects are reviewable, unsliced artifacts, not a promise of unattended print success.

Optical couplers require opaque black material and a light-leak check. Other structural parts may use the same ABS or another color from the same calibrated material family.

## Assembly order

1. Measure the actual wrapped tile thickness and verify the optical coupler fit with an unpowered SiPM and the existing fiber ends. Preserve the simulation's optical geometry unless a separately validated optical change is intended.
2. Print and test the socket/retainer coupons, one lower cradle/cap, one rail junction and one pod lid. Confirm that release access works without overstressing either tile or PCB.
3. Install the four foot posts into the bottom tower modules. Insert rails and split-rail sleeves. Slide the detector shelf over the rear rail before closing that rail into its corner sockets.
4. Place the wrapped first tile into its four open cradles. Fit the removable corner caps and verify the tile is held without forced bending or compression of its wrapping.
5. Fit the detector PCB onto the pod edge shelves, connect the short SiPM coax and keyed low-voltage harness, then close the lid. Engage the pod in its shelf retainers.
6. Add the next tier on the load shoulders and install the bridge retainers. Repeat for all four planes; the second tier uses the combined detector/controller shelf, and the top tier uses the shorter modules.
7. Fit the controller, USB lead and external antenna; route the four harnesses with service slack and strain relief. Confirm each connector against the electronics interface document before powering.
8. Fit the tower caps. Verify every retainer is fully seated, no tile is stressed, all wire insulation is clear of snap hooks, and USB/lid release access remains available.

## Validation boundaries

The deliverable includes generated geometry, closed-mesh and envelope checks, print plate projects, and a mechanical solid-intersection audit. Imported populated PCB compounds are outside that audit's scope; their supplier geometry and documented envelopes need separate inspection. It does not certify a manufactured station. Physical work still required includes ABS shrinkage/clearance calibration, light tightness, cable pull/strain relief, repeated snap release, loaded-frame deflection and tipping resistance, thermal behavior, and electronics bring-up. Any nonzero entries in `interferences.json` require review before manufacture; envelopes and modeled supplier pin geometry must be distinguished from actual solid clashes.

ToT/coincidence acquisition measures pulses on large tiles. These four large-area tile planes do not provide the position resolution required for muon scattering tomography. Future position-sensitive planes require their own mechanical layout and readout expansion.
