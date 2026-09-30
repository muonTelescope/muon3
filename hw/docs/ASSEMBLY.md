# Muon3 tile stack: mechanical assembly

Four sPHENIX inner-HCal tiles sit **100 mm apart** in a printed ABS frame on four M6 rods. The station board stands
**vertically behind the SiPM edge** (its plane is perpendicular to the tiles), in its case, with the USB-C port on the
side where a plug reaches it easily, and a small OLED pod beside it shows the live rates and the self-test result.
Everything is generated from the tile geometry by `hw/case/assembly.py` (FreeCAD) and rendered by
`hw/case/render_assembly.py` (Blender), so each of the 12 tile shapes gets its own correct frame:

```bash
freecadcmd hw/case/case.py                       # station case (from hw/out/board.json)
kicad-cli pcb export step --subst-models --no-dnp --force -o hw/out/assembly/pcb.step hw/out/kicad/muon3.kicad_pcb
TILE=1 freecadcmd hw/case/assembly.py            # one shape (1-12); SECTIONS=1 also cuts the section solids; STEP=1 writes a STEP
sh hw/case/build_assemblies.sh                   # all 12 shapes + renders, one heavy job at a time (memguard)
python hw/case/assembly_doc.py                   # copy the renders here and refill the table below
```

`hw/out/assembly/tileNN/station.FCStd` is the hierarchical FreeCAD document:

```text
Station
├── Tiles ─ Tile_0 … Tile_3        (placed at z = 0, 100, 200, 300 mm)
│            └── Body (PS + PTP/POPOP, grooved) · FiberA · FiberB (Y11, 1 mm) · Coupler · SiPM · SiPM_PCB · UFL
├── Frame ─ Clip_k_FL/FR/BR/BL     (4 corner clips per tile)    Rod_×4 + Nut_×8    Spacer_×14
│            └── PlateBar [+ PlateArm_L/R + PlateSplice_L/R]  (back plate, modular)   + inserts and screws
├── Electronics ─ Case_Base · Case_Lid · PCB · LidScrew_×4 · LidInsert_×4 · MountScrew_×4 · Antenna_FPC · Antenna_Pigtail
├── DisplayPod ─ Pod · OLED · PodScrew_×2
└── Cables ─ Cable_0 … Cable_3 (+ U.FL plugs)
```

## The 12 tile shapes

The shapes differ a lot: tile 01 is almost a rectangle (121 × 191 mm); tile 12 is a 403 × 191 mm parallelogram leaning
45°. All are drawn at the same scale below (rods, corner clips, serpentine fiber, coupler on the SiPM edge at the top):

![All 12 tile shapes, same scale](assembly/shapes_top.png)

<!-- SHAPES -->
| Tile | Bounding box (mm) | Left-edge slant | Stack footprint x × y × z (mm) | Plate | Cable (centre line, mm) | ABS volume |
|---|---|---|---|---|---|---|
| 01 | 121 × 191 | 0° | 188 × 244 × 344 | bar | 44–253 | 275 cm³ |
| 02 | 140 × 191 | 4° | 204 × 244 × 344 | bar | 44–253 | 276 cm³ |
| 03 | 151 × 191 | 9° | 206 × 244 × 344 | bar | 44–253 | 271 cm³ |
| 04 | 172 × 191 | 13° | 237 × 244 × 344 | bar | 44–253 | 277 cm³ |
| 05 | 192 × 191 | 18° | 251 × 244 × 344 | bar | 44–253 | 276 cm³ |
| 06 | 214 × 191 | 22° | 267 × 244 × 344 | bar | 44–253 | 276 cm³ |
| 07 | 237 × 191 | 26° | 284 × 244 × 344 | bar | 44–253 | 276 cm³ |
| 08 | 262 × 191 | 30° | 301 × 244 × 344 | bar | 44–253 | 275 cm³ |
| 09 | 289 × 191 | 34° | 320 × 244 × 344 | bar | 44–253 | 275 cm³ |
| 10 | 319 × 191 | 38° | 359 × 244 × 344 | bar + arm L | 44–253 | 288 cm³ |
| 11 | 334 × 191 | 42° | 361 × 244 × 344 | bar | 44–253 | 275 cm³ |
| 12 | 403 × 191 | 45° | 425 × 244 × 344 | bar + arm R | 44–253 | 298 cm³ |
<!-- /SHAPES -->

- **Fibers follow each shape.** The source mesh files only have a valid fiber path for tile 01; for tiles 02–12 the path
  is the same bounding-box serpentine, which runs *outside* the slanted scintillator (tile 12's legs stick out 100 mm
  either side). `assembly.py` rebuilds the path for every shape: four horizontal legs at the source's heights, joined by
  semicircles of radius 28.4 mm (the tile design's minimum bend radius is 25 mm), each turn pushed as far out as the
  outline allows with 8 mm to the edge, and a return leg to the second exit. It reproduces tile 01's path to about
  1 mm. **Check this against GSU's drawings before cutting grooves.**
- **Both fiber ends are 43 mm apart** in the source, too far for one 3 × 3 mm SiPM to see both. The CAD shows the
  coupler block from the source (49 × 6 × 8 mm). Its interior is not in the source; see "Coupler" in the Geant4 notes.

## Bill of materials

| Part | Qty | How |
|---|---|---|
| Corner clip (ABS, 12.4 mm thick, 7.6 mm slot, M6 hole) | 16 | printed, flat |
| Spacer tube (ABS, Ø 12 / Ø 6.4) | 14 (10 × 87.6 mm, 4 × 4.8 mm) | printed |
| Back plate: center bar (universal) | 1 | printed, lying on its back |
| Back plate: rod arm + splice plate | 0–2 + 0–2, per tile shape | printed |
| Case base + lid | 1 + 1 | printed, each flat |
| Display pod | 1 | printed |
| M6 threaded rod, about 345 mm | 4 | cut from 1 m stock |
| M6 nut + washer | 8 + 8 | |
| M3 × 5.7 heat-set insert | 4 (case) + 4 (case mount) + 2 (pod) + 4 per plate joint | pressed in with a soldering iron |
| M3 × 12 socket-head screw (ISO 4762) | 4 | lid |
| M3 × 6 socket-head screw (ISO 4762) | 4 (case mount) + 2 (pod) + 4 per plate joint | |
| U.FL to U.FL micro-coax, Ø 1.13 mm, 300 mm | 4 | tile SiPM board to station board; 4 equal lengths |
| 2.4 GHz FPC antenna, 35 × 7 mm, with U.FL pigtail | 1 | sticks in the lid recess |
| 0.91" 128 × 32 I2C OLED + 100 mm STEMMA QT (JST-SH 4) cable | 1 + 1 | in the pod |

Print in ABS at 0.2 mm layers, 4 perimeters, 30 % infill, 100 °C bed, enclosure closed. The plate bar is the longest
part (about 190 mm); the widest whole plate is 235 mm, which is why arms and splices exist.

## Assembly, step by step

All M3 joints are **socket-head screws into heat-set inserts** (no nuts, no glue). The inserts go in first: hold each on
its hole with a soldering iron at 220–240 °C and push it flush.

![Explosion of the electronics](assembly/tile01_explode_elec.png)

1. **Tiles.** Wrap each tile in its light-tight wrap (Al foil, cling film, black vinyl) and lay the fiber in its groove
   (epoxy). Glue the coupler block on the SiPM edge with the SiPM board and its U.FL jack behind it.

   ![Step 1](assembly/tile01_step1.png)
2. **Frame.** Slide the four rods through the bottom clips, add the nuts, then build up: spacer, tile in its four
   corner clips, spacer, next tile. The four clips of a tile clamp the tile's corners in a 7.6 mm slot; the tile is
   never drilled.

   ![Step 2](assembly/tile01_step2.png)
3. **Back plate.** The center bar slips over the two back rods between tiles 2 and 3 (in place of the spacer there).
   Where a rod is beyond the bar's end, the rod arm replaces the bar's sleeve and a splice plate on the front face
   joins them with four M3 × 6 screws.

   ![Step 3](assembly/tile01_step3.png)
4. **Electronics.** Screw the case base to the plate from inside (four M3 × 6 socket-head screws; the heads sit in the
   4.6 mm gap under the board, which has no parts on its underside). Drop in the board, then close the lid (four
   M3 × 12). Screw the pod to the plate beside the case and plug its STEMMA QT cable into the board's QT port through
   the case's left wall.

   ![Step 4](assembly/tile01_step4.png)
5. **Cables and antenna.** Plug each micro-coax onto its SiPM board and lay it up the plate front, over the plate top
   edge, and down through the notch in the lid skirt above its U.FL jack. Zip-tie the four cables to the bar on top of
   the case. Stick the FPC antenna in the lid recess and click its pigtail onto the module's U.FL through the lid hole.

   ![Step 5](assembly/tile01_step5.png)

## Sections

Sections cut through the real solids (tile 01). Left: the SiPM edge (scintillator, fiber in its groove, coupler, SiPM,
board, plug and cable); right: through the case (lid, board on its 4.6 mm standoffs, base, plate, and the pod's screw).

| | |
|---|---|
| ![SiPM section](assembly/tile01_sec_x_sipm.png) | ![Case section](assembly/tile01_sec_x_case.png) |

![Case, plate and pod, cut at mid-height](assembly/tile01_sec_zcase.png)

![Fiber in the top tile, cut at its mid-plane](assembly/tile01_sec_ztile.png)

## Views of the largest shape (tile 12)

![Tile 12 from the back](assembly/tile12_iso_back.png)

## Design notes

- **Clips, not a tray.** Four small corner clips (each printable on any bed) replace a tile-sized tray, so one design
  handles a 121 mm and a 403 mm wide tile. The rods sit outside the corners (8.5 mm from each vertex along the outward
  normal), so they never touch the scintillator.
- **The plate is modular.** The center bar (case + pod + spare inserts) is the same for every shape; only the arms and
  splices change, and only when a back rod lies beyond the bar's 178 mm.
- **USB-C and the QT port face sideways.** The case is mounted with its cable edge up and its USB-C on the +x side, at
  the height where the plug is easy to reach; the pod sits above it.
- **The antenna is outside the case.** The ESP32-S3-WROOM-1U's U.FL connector is at the module's corner, 3.7 mm from
  the board edge, so the pigtail goes straight up through a 3.2 mm hole in the lid to a flat antenna on the lid's
  outer face (away from the rods, the SiPM cables and the printed-circuit copper).
